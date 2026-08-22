document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // THEME MANAGEMENT (LIGHT / WHITE & DARK)
    // ==========================================
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
            document.documentElement.setAttribute('data-theme', 'light');
            if (themeToggleIcon) {
                themeToggleIcon.className = 'fa-solid fa-moon';
            }
            if (btnThemeToggle) {
                btnThemeToggle.title = 'Switch to Dark Theme';
            }
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeToggleIcon) {
                themeToggleIcon.className = 'fa-solid fa-sun';
            }
            if (btnThemeToggle) {
                btnThemeToggle.title = 'Switch to White / Light Theme';
            }
        }
        localStorage.setItem('signai_theme', theme);
    }

    const savedTheme = localStorage.getItem('signai_theme') || 'dark';
    applyTheme(savedTheme);

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
            applyTheme(nextTheme);
        });
    }

    // ==========================================
    // 1. TAB SWITCHING LOGIC
    // ==========================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');

            if (targetTab === 'tab-speech-to-sign') {
                initGestureCanvas();
            } else if (targetTab === 'tab-conversation') {
                fetchConversation();
            }
        });
    });

    // ==========================================
    // 2. TAB 1: SIGN TO SPEECH LOGIC
    // ==========================================
    const currentCharEl = document.getElementById('current-char');
    const charBoxEl = document.getElementById('char-box');
    const charBoxLabel = document.getElementById('char-box-label');
    const hudTitleText = document.getElementById('hud-title-text');
    const metaHelpText = document.getElementById('meta-help-text');
    const confValEl = document.getElementById('conf-val');
    const confBarEl = document.getElementById('conf-bar');
    const sentenceTextEl = document.getElementById('sentence-text');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const suggestionsCard = document.getElementById('suggestions-card');
    const wordCheatsheetBox = document.getElementById('word-cheatsheet-box');
    const handIndicator = document.getElementById('hand-indicator');
    const handText = document.getElementById('hand-text');
    
    const btnModeWord = document.getElementById('btn-mode-word');
    const btnModeLetter = document.getElementById('btn-mode-letter');
    
    const btnSpeak = document.getElementById('btn-speak');
    const btnClear = document.getElementById('btn-clear');
    const btnSpace = document.getElementById('btn-space');
    const btnBackspace = document.getElementById('btn-backspace');
    const btnCopy = document.getElementById('btn-copy');
    const btnDownload = document.getElementById('btn-download');
    const btnSendToDialog = document.getElementById('btn-send-to-dialog');
    const cooldownTimerWrap = document.getElementById('cooldown-timer-wrap');
    const cooldownTimerText = document.getElementById('cooldown-timer-text');
    const cooldownTimerBar = document.getElementById('cooldown-timer-bar');

    let previousSymbol = '-';
    let isPolling = false;
    let currentMode = 'word';
    const chkAutoSpeak = document.getElementById('chk-auto-speak');
    const gestureRibbonCard = document.getElementById('gesture-ribbon-card');

    // Recognition Mode Toggle Handler
    async function setRecognitionMode(mode) {
        currentMode = mode;
        if (mode === 'word') {
            if (btnModeWord) btnModeWord.classList.add('active');
            if (btnModeLetter) btnModeLetter.classList.remove('active');
            if (hudTitleText) hudTitleText.textContent = 'Detected Word / Sign';
            if (charBoxLabel) charBoxLabel.textContent = 'Active Word';
            if (metaHelpText) metaHelpText.querySelector('span').textContent = 'Hold any word gesture steady to recognize and chain into complete sentences.';
            if (wordCheatsheetBox) wordCheatsheetBox.style.display = 'flex';
            if (suggestionsCard) suggestionsCard.style.display = 'none';
            if (gestureRibbonCard) gestureRibbonCard.style.display = 'block';
        } else {
            if (btnModeLetter) btnModeLetter.classList.add('active');
            if (btnModeWord) btnModeWord.classList.remove('active');
            if (hudTitleText) hudTitleText.textContent = 'Detected Letter';
            if (charBoxLabel) charBoxLabel.textContent = 'Character :';
            if (metaHelpText) metaHelpText.querySelector('span').textContent = 'Hold fingers steady to recognize ASL alphabet letters; spell words sequentially.';
            if (wordCheatsheetBox) wordCheatsheetBox.style.display = 'none';
            if (suggestionsCard) suggestionsCard.style.display = 'block';
            if (gestureRibbonCard) gestureRibbonCard.style.display = 'none';
        }

        try {
            await fetch('/api/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
        } catch (err) {}
    }

    // Initialize in Word Mode by default
    setRecognitionMode('word');

    if (btnModeWord) btnModeWord.addEventListener('click', () => setRecognitionMode('word'));
    if (btnModeLetter) btnModeLetter.addEventListener('click', () => setRecognitionMode('letter'));

    // Multi-Gesture Sequence & Sentence Builder State
    const gestureRibbonTrack = document.getElementById('gesture-ribbon-track');
    const btnPolishSentence = document.getElementById('btn-polish-sentence');
    const btnUndoGesture = document.getElementById('btn-undo-gesture');
    const btnClearRibbon = document.getElementById('btn-clear-ribbon') || document.getElementById('btnClearRibbon');
    const sentenceToneSelect = document.getElementById('sentence-tone-select');

    // Gemini AI Sentence Guesser State & Handlers
    const geminiToneSelect = document.getElementById('gemini-tone-select');
    const btnAiGuess = document.getElementById('btn-ai-guess');
    const aiAlternativesBox = document.getElementById('ai-alternatives-box');
    let aiGuessTimeout = null;

    async function triggerGeminiAiGuess(tokens = null, explicitTone = null) {
        if (!tokens) {
            tokens = activeGestureSequence.map(g => g.word);
        }
        const text = sentenceTextEl.value.trim();
        if (tokens.length === 0 && !text) {
            if (aiAlternativesBox) {
                aiAlternativesBox.innerHTML = '<span class="ai-prompt-hint">🤖 Sign gestures to see real-time Gemini AI sentence guesses and smart completions here...</span>';
            }
            return;
        }

        const tone = explicitTone || (geminiToneSelect ? geminiToneSelect.value : 'natural');
        if (aiAlternativesBox) {
            aiAlternativesBox.innerHTML = '<span class="ai-prompt-hint"><i class="fa-solid fa-spinner fa-spin"></i> Gemini 2.5 Flash is generating smart sentence predictions...</span>';
        }

        try {
            const res = await fetch('/api/ai/guess-sentence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokens, text, tone })
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (data.guessed_sentence && document.activeElement !== sentenceTextEl) {
                    sentenceTextEl.value = data.guessed_sentence;
                }
                renderAiAlternatives(data.guessed_sentence, data.alternatives || []);
            }
        } catch (err) {
            console.error("AI Guess error:", err);
            if (aiAlternativesBox) {
                aiAlternativesBox.innerHTML = '<span class="ai-prompt-hint" style="color: #f87171;">AI temporary offline. Using local polisher.</span>';
            }
        }
    }

    function renderAiAlternatives(primary, alternatives) {
        if (!aiAlternativesBox) return;
        aiAlternativesBox.innerHTML = '';

        const allOptions = [];
        if (primary && !alternatives.includes(primary)) {
            allOptions.push(primary);
        }
        allOptions.push(...alternatives);

        if (allOptions.length === 0) {
            aiAlternativesBox.innerHTML = '<span class="ai-prompt-hint">No alternatives generated.</span>';
            return;
        }

        allOptions.forEach((option, idx) => {
            const chip = document.createElement('div');
            chip.className = 'ai-alt-chip';
            chip.innerHTML = `
                <span><strong>#${idx + 1}</strong> "${option}"</span>
                <span class="chip-action-hint"><i class="fa-solid fa-volume-high"></i> Click to Speak</span>
            `;
            chip.addEventListener('click', () => {
                sentenceTextEl.value = option;
                speakText(option);
            });
            aiAlternativesBox.appendChild(chip);
        });
    }

    if (btnAiGuess) {
        btnAiGuess.addEventListener('click', () => triggerGeminiAiGuess());
    }

    if (geminiToneSelect) {
        geminiToneSelect.addEventListener('change', () => triggerGeminiAiGuess());
    }

    let activeGestureSequence = []; // [{ word: 'HELLO', emoji: '👋' }]
    let lastSentenceVal = '';
    let noHandTimer = null;
    let hasAutoPolished = false;

    const GESTURE_EMOJIS = {
        "HELLO": "👋", "GOOD": "👍", "BAD": "👎", "PEACE": "✌️", "OK": "👌", "YES": "✊", "NO": "🤏",
        "WATER": "💧", "STOP": "🛑", "CALL ME": "🤙", "YOU": "👉", "ME": "☝️", "ROCK ON": "🤘", "I LOVE YOU": "🤟",
        "THANK YOU": "🙏", "PLEASE": "🤲", "HELP": "🆘", "FOOD": "🍲", "TABLET": "💊", "MEDICINE": "💊",
        "WANT": "🤲", "SLEEP": "🛏️", "RESTROOM": "🚻", "MORE": "➕", "FAMILY": "👨‍👩‍👧‍👦", "HOUSE": "🏠", "HOME": "🏠",
        "FRIEND": "🤝", "BOOK": "📖", "WORK": "💼", "PLAY": "🎮",
        "HAPPY": "😊", "SAD": "😢", "TIRED": "😴", "WHERE": "📍", "WHAT": "❓",
        "HOW": "🤔", "WHY": "🧐", "DOCTOR": "🩺", "COFFEE": "☕"
    };

    function renderGestureRibbon() {
        if (!gestureRibbonTrack) return;
        gestureRibbonTrack.innerHTML = '';

        if (activeGestureSequence.length === 0) {
            gestureRibbonTrack.innerHTML = '<span class="ribbon-placeholder">Show consecutive gestures in camera to chain full sentences...</span>';
            return;
        }

        activeGestureSequence.forEach((item, idx) => {
            const chip = document.createElement('div');
            chip.className = 'ribbon-chip';
            chip.innerHTML = `<span class="chip-emoji">${item.emoji || '✨'}</span><span>${item.word}</span>`;
            gestureRibbonTrack.appendChild(chip);

            if (idx < activeGestureSequence.length - 1) {
                const arrow = document.createElement('span');
                arrow.className = 'ribbon-arrow';
                arrow.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
                gestureRibbonTrack.appendChild(arrow);
            }
        });

        // Pulsating next sign chip
        const nextChip = document.createElement('div');
        nextChip.className = 'next-sign-chip';
        nextChip.innerHTML = '<i class="fa-solid fa-plus"></i> Next Sign...';
        gestureRibbonTrack.appendChild(nextChip);
    }

    if (btnPolishSentence) {
        btnPolishSentence.addEventListener('click', () => triggerGeminiAiGuess(null, sentenceToneSelect ? sentenceToneSelect.value : 'natural'));
    }

    if (btnUndoGesture) {
        btnUndoGesture.addEventListener('click', async () => {
            if (activeGestureSequence.length > 0) {
                activeGestureSequence.pop();
                renderGestureRibbon();
            }
            lastSentenceVal = activeGestureSequence.map(item => item.word).join(' ');
            if (sentenceTextEl) sentenceTextEl.value = lastSentenceVal;
            await sendAction('add', 'Backspace');
            triggerGeminiAiGuess();
        });
    }

    if (btnClearRibbon) {
        btnClearRibbon.addEventListener('click', async () => {
            activeGestureSequence = [];
            lastSentenceVal = '';
            if (sentenceTextEl) sentenceTextEl.value = '';
            renderGestureRibbon();
            if (aiAlternativesBox) {
                aiAlternativesBox.innerHTML = '<span class="ai-prompt-hint">🤖 Sign gestures to see real-time Gemini AI sentence guesses and smart completions here...</span>';
            }
            await sendAction('clear');
        });
    }

    // 50+ Quick Smart Sentences Explorer Handlers
    document.querySelectorAll('.sentence-quick-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const signs = pill.getAttribute('data-signs') || '';
            const fullSentence = pill.getAttribute('data-sentence') || '';
            
            if (signs) {
                const words = signs.split(/\s+/).filter(w => w.length > 0);
                activeGestureSequence = words.map(w => {
                    const cleanW = w.toUpperCase();
                    return {
                        word: cleanW,
                        emoji: GESTURE_EMOJIS[cleanW] || '✨'
                    };
                });
                renderGestureRibbon();
            }
            
            if (fullSentence) {
                sentenceTextEl.value = fullSentence;
                speakText(fullSentence);
                triggerGeminiAiGuess(null);
            }
        });
    });

    // Gesture Shortcuts Guide Tabs Filter
    document.querySelectorAll('.guide-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter') || 'all';

            document.querySelectorAll('.gesture-guide-item').forEach(item => {
                const itemType = item.getAttribute('data-type');
                if (filter === 'all' || itemType === filter) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // Clicking a Gesture Guide item adds it into active ribbon and triggers voice
    document.querySelectorAll('.gesture-guide-item').forEach(item => {
        item.addEventListener('click', () => {
            const nameEl = item.querySelector('.guide-name');
            const emojiEl = item.querySelector('.guide-emoji');
            if (nameEl) {
                const word = nameEl.textContent.trim().toUpperCase().split('/')[0].trim();
                const emoji = emojiEl ? emojiEl.textContent.trim() : '✨';
                
                activeGestureSequence.push({ word, emoji });
                renderGestureRibbon();
                sendAction('add', word);
                triggerGeminiAiGuess();
            }
        });
    });

    // Word Practice State
    let activePractice = null; // { word: 'WATER', letters: ['W','A','T','E','R'], index: 0 }

    async function updateSignStatus() {
        if (isPolling) return;
        isPolling = true;

        try {
            // Poll when Tab 1, Tab 2 (practice), or Tab 4 is active
            const tab1Active = document.getElementById('tab-sign-to-speech').classList.contains('active');
            const tab2Active = document.getElementById('tab-words-studio').classList.contains('active');
            const tab4Active = document.getElementById('tab-conversation').classList.contains('active');
            
            if (tab1Active || tab2Active || tab4Active) {
                const res = await fetch('/api/status');
                if (res.ok) {
                    const data = await res.json();

                    if (tab1Active) {
                        if (data.symbol !== previousSymbol) {
                            const sym = data.symbol || '-';
                            const emoji = GESTURE_EMOJIS[sym.toUpperCase()] || data.detected_emoji || '';
                            
                            if (sym !== '-' && emoji && !sym.includes(emoji)) {
                                currentCharEl.innerHTML = `<span style="font-size: 0.9em; margin-right: 4px;">${emoji}</span><span>${sym}</span>`;
                            } else {
                                currentCharEl.textContent = sym;
                            }

                            if (sym.length > 10) {
                                currentCharEl.style.fontSize = '15px';
                            } else if (sym.length > 6) {
                                currentCharEl.style.fontSize = '18px';
                            } else if (sym.length > 2) {
                                currentCharEl.style.fontSize = '24px';
                            } else {
                                currentCharEl.style.fontSize = '44px';
                            }
                            previousSymbol = data.symbol;
                        }

                        const conf = Math.max(0, Math.min(100, data.confidence || 0));
                        confValEl.textContent = `${conf}%`;
                        confBarEl.style.width = `${conf}%`;

                        if (data.hand_detected) {
                            handIndicator.className = 'status-dot green pulse';
                            if (data.num_hands_detected >= 2) {
                                handText.textContent = '👐 2 Hands Active';
                            } else {
                                handText.textContent = '🖐️ Hand Active';
                            }
                        } else {
                            handIndicator.className = 'status-dot gray';
                            handText.textContent = 'No Hand';
                        }

                        // 3-Second Pacing Gap Cooldown Bar & Label Status
                        if (data.is_locked_in_cooldown && data.cooldown_remaining > 0) {
                            if (cooldownTimerWrap) cooldownTimerWrap.style.display = 'block';
                            if (cooldownTimerText) cooldownTimerText.textContent = `Next sign in ${data.cooldown_remaining.toFixed(1)}s`;
                            if (cooldownTimerBar) cooldownTimerBar.style.width = `${((data.cooldown_remaining / (data.cooldown_total || 3.0)) * 100)}%`;
                            if (charBoxLabel) charBoxLabel.innerHTML = `<span style="color: #c4b5fd;"><i class="fa-solid fa-hourglass-half fa-spin"></i> 3s Gap (${data.cooldown_remaining.toFixed(1)}s)</span>`;
                        } else {
                            if (cooldownTimerWrap) cooldownTimerWrap.style.display = 'none';
                            if (charBoxLabel) charBoxLabel.textContent = currentMode === 'word' ? 'Active Word (Ready)' : 'Character :';
                        }

                        // Track newly added or cleared words in sentence for gesture ribbon
                        const currSent = data.sentence || '';
                        if (currSent !== lastSentenceVal) {
                            lastSentenceVal = currSent;
                            const trimmed = currSent.trim();
                            const words = trimmed ? trimmed.split(/\s+/).filter(w => w.length > 0) : [];
                            activeGestureSequence = words.map(w => {
                                const cleanW = w.toUpperCase();
                                return {
                                    word: cleanW,
                                    emoji: GESTURE_EMOJIS[cleanW] || data.detected_emoji || '✨'
                                };
                            });
                            renderGestureRibbon();

                            if (words.length > 0) {
                                // Debounce real-time Gemini AI Sentence Guess
                                clearTimeout(aiGuessTimeout);
                                aiGuessTimeout = setTimeout(() => {
                                    triggerGeminiAiGuess(words);
                                }, 450);
                            } else {
                                if (aiAlternativesBox) {
                                    aiAlternativesBox.innerHTML = '<span class="ai-prompt-hint">🤖 Sign gestures to see real-time Gemini AI sentence guesses and smart completions here...</span>';
                                }
                            }
                        }

                        if (document.activeElement !== sentenceTextEl) {
                            sentenceTextEl.value = data.polished_sentence || data.sentence || '';
                        }

                        if (currentMode === 'letter') {
                            renderSuggestions(data.suggestions || []);
                        }
                    }

                    // Word Practice live evaluation
                    if (activePractice && data.symbol && data.symbol !== ' ' && data.symbol !== '-') {
                        // Extract plain letter if format is "👋 HELLO" or "A"
                        const cleanSym = data.symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        handlePracticeSymbol(cleanSym);
                    }

                    // Live 3-Gesture Vault biometric scanning hook
                    if (typeof checkLiveSignForUnlock === 'function') {
                        checkLiveSignForUnlock(data);
                    }
                }
            }
        } catch (err) {
            // Silent catch to keep UI responsive
        } finally {
            isPolling = false;
            setTimeout(updateSignStatus, 150);
        }
    }

    function handlePracticeSymbol(symbol) {
        if (!activePractice) return;
        const currentTargetLetter = activePractice.letters[activePractice.index];
        
        if (symbol === currentTargetLetter) {
            const letterBadges = document.querySelectorAll('.practice-letter-badge');
            if (letterBadges[activePractice.index]) {
                letterBadges[activePractice.index].classList.remove('current');
                letterBadges[activePractice.index].classList.add('matched');
            }
            
            activePractice.index++;
            const progress = (activePractice.index / activePractice.letters.length) * 100;
            const progBar = document.getElementById('practice-progress-bar');
            if (progBar) progBar.style.width = `${progress}%`;

            if (activePractice.index < activePractice.letters.length) {
                if (letterBadges[activePractice.index]) {
                    letterBadges[activePractice.index].classList.add('current');
                }
            } else {
                // Word Completed!
                const wordTip = document.getElementById('practice-word-tip');
                if (wordTip) {
                    wordTip.innerHTML = `🎉 <strong>Awesome! You successfully signed ${activePractice.word}!</strong>`;
                    wordTip.style.color = '#10b981';
                }
                speakText(activePractice.word);
                setTimeout(() => {
                    if (wordTip) {
                        wordTip.textContent = 'Sign each letter in front of the camera to complete the word!';
                        wordTip.style.color = '';
                    }
                }, 3000);
            }
        }
    }

    function renderSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<span class="no-suggestions">Spell letters to view completions...</span>';
            return;
        }

        suggestionsContainer.innerHTML = '';
        suggestions.forEach(word => {
            const chip = document.createElement('button');
            chip.className = 'suggestion-chip';
            chip.textContent = word;
            chip.onclick = () => sendAction('suggest', word);
            suggestionsContainer.appendChild(chip);
        });
    }

    async function sendAction(action, value = '') {
        try {
            const res = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, value })
            });
            const data = await res.json();
            sentenceTextEl.value = data.sentence || '';
            renderSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Action error:', err);
        }
    }

    btnSpeak.addEventListener('click', () => {
        const text = sentenceTextEl.value.trim();
        if (!text) return;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            window.speechSynthesis.speak(utterance);
        } else {
            sendAction('speak');
        }
    });

    btnClear.addEventListener('click', () => sendAction('clear'));
    btnSpace.addEventListener('click', () => sendAction('add', 'Space'));
    btnBackspace.addEventListener('click', () => sendAction('add', 'Backspace'));

    btnCopy.addEventListener('click', () => {
        if (sentenceTextEl.value) {
            navigator.clipboard.writeText(sentenceTextEl.value);
            const orig = btnCopy.innerHTML;
            btnCopy.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981;"></i>';
            setTimeout(() => btnCopy.innerHTML = orig, 1500);
        }
    });

    btnDownload.addEventListener('click', () => {
        const text = sentenceTextEl.value;
        if (!text) return;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sign_transcript_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    btnSendToDialog.addEventListener('click', async () => {
        const text = sentenceTextEl.value.trim();
        if (!text) return;
        await postConversationMessage('deaf', text);
        // Switch to dialog tab
        document.querySelector('[data-tab="tab-conversation"]').click();
    });

    // ==========================================
    // 3. TAB 2: SPEECH & TEXT TO SIGN ENGINE
    // ==========================================
    const canvas = document.getElementById('gesture-canvas');
    const ctx = canvas.getContext('2d');
    const activeSignLetter = document.getElementById('active-sign-letter');
    const activeSignDesc = document.getElementById('active-sign-desc');
    const activeSignTypePill = document.getElementById('active-sign-type-pill');
    const animStatusBadge = document.getElementById('anim-status-badge');
    const sequenceTiles = document.getElementById('sequence-tiles');
    const animScrubber = document.getElementById('anim-scrubber');
    
    const btnAnimPlay = document.getElementById('btn-anim-play');
    const playIcon = document.getElementById('play-icon');
    const btnAnimPrev = document.getElementById('btn-anim-prev');
    const btnAnimNext = document.getElementById('btn-anim-next');
    const btnAnimReplay = document.getElementById('btn-anim-replay');
    const speedButtons = document.querySelectorAll('.btn-speed');

    const btnModeFullword = document.getElementById('btn-mode-fullword');
    const btnModeFingerspell = document.getElementById('btn-mode-fingerspell');

    const btnVoiceRecord = document.getElementById('btn-voice-record');
    const voiceStatusText = document.getElementById('voice-status-text');
    const voiceWaveform = document.getElementById('voice-waveform');
    const textToSignInput = document.getElementById('text-to-sign-input');
    const btnTranslateToSign = document.getElementById('btn-translate-to-sign');
    const btnClearTextInput = document.getElementById('btn-clear-text-input');
    const quickChips = document.querySelectorAll('.chip-btn');

    let currentSequence = [];
    let currentSignIndex = 0;
    let isPlaying = false;
    let playSpeed = 1.0;
    let animTimer = null;
    let wordKeyframeTimer = null;
    let currentSpeechToSignMode = 'word'; // 'word' or 'spelling'
    let isSpeechRecording = false;
    let speechRecognizer = null;

    if (btnModeFullword && btnModeFingerspell) {
        btnModeFullword.addEventListener('click', () => {
            btnModeFullword.classList.add('active');
            btnModeFingerspell.classList.remove('active');
            currentSpeechToSignMode = 'word';
            const val = textToSignInput.value.trim();
            if (val) translateTextToSign(val);
        });

        btnModeFingerspell.addEventListener('click', () => {
            btnModeFingerspell.classList.add('active');
            btnModeFullword.classList.remove('active');
            currentSpeechToSignMode = 'spelling';
            const val = textToSignInput.value.trim();
            if (val) translateTextToSign(val);
        });
    }

    function initGestureCanvas() {
        if (currentSequence.length === 0) {
            const defaultLandmarks = window.getLandmarksForWordOrChar ? window.getLandmarksForWordOrChar('HELLO').landmarks : window.getLandmarksForChar('A').landmarks;
            window.renderHandSkeleton(ctx, defaultLandmarks);
        }
    }

    // Translate text into animated sign sequence
    async function translateTextToSign(text) {
        if (!text.trim()) return;

        try {
            animStatusBadge.textContent = 'Translating...';
            const res = await fetch('/api/text-to-sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, mode: currentSpeechToSignMode })
            });
            const data = await res.json();
            currentSequence = data.sequence || [];

            renderSequenceTiles(currentSequence);
            currentSignIndex = 0;
            updateSignDisplay(currentSignIndex);
            playSequence();
        } catch (err) {
            console.error('Translation error:', err);
            animStatusBadge.textContent = 'Error';
        }
    }

    function renderSequenceTiles(seq) {
        if (!seq || seq.length === 0) {
            sequenceTiles.innerHTML = '<span class="no-sequence">No gestures generated.</span>';
            return;
        }

        sequenceTiles.innerHTML = '';
        seq.forEach((item, idx) => {
            const tile = document.createElement('div');
            const isWord = typeof item === 'string' && item.length > 1 && item !== ' ';
            tile.className = `tile ${isWord ? 'tile-word' : ''} ${idx === currentSignIndex ? 'active' : ''}`;
            
            if (item === ' ') {
                tile.textContent = '␣';
                tile.title = 'Pause between words';
            } else if (isWord) {
                const wordInfo = window.getLandmarksForWordOrChar ? window.getLandmarksForWordOrChar(item) : null;
                const emoji = wordInfo && wordInfo.emoji ? wordInfo.emoji + ' ' : '⚡ ';
                tile.innerHTML = `<span class="tile-emoji">${emoji}</span><span class="tile-text">${item}</span>`;
                tile.title = `Full ASL Gesture: ${item}`;
            } else {
                tile.textContent = item;
                tile.title = `Fingerspelling: ${item}`;
            }

            tile.onclick = () => {
                pauseSequence();
                currentSignIndex = idx;
                updateSignDisplay(idx);
            };
            sequenceTiles.appendChild(tile);
        });

        animScrubber.max = Math.max(1, seq.length - 1);
        animScrubber.value = 0;
    }

    function updateSignDisplay(index) {
        if (!currentSequence || currentSequence.length === 0) return;
        if (index < 0 || index >= currentSequence.length) return;

        // Clear any previous word keyframe loop
        if (wordKeyframeTimer) {
            clearInterval(wordKeyframeTimer);
            wordKeyframeTimer = null;
        }

        const item = currentSequence[index];
        const info = window.getLandmarksForWordOrChar ? window.getLandmarksForWordOrChar(item) : window.getLandmarksForChar(item);

        if (item === ' ') {
            activeSignLetter.textContent = 'PAUSE';
            activeSignDesc.textContent = 'Short pause between signs';
            if (activeSignTypePill) {
                activeSignTypePill.textContent = '⏸️ Pause';
                activeSignTypePill.className = 'active-sign-type-pill pause-mode';
            }
            window.renderHandSkeleton(ctx, info.landmarks || DEFAULT_PALM);
        } else if (info.isWord) {
            activeSignLetter.textContent = `${info.emoji || '⚡'} ${info.name}`;
            activeSignDesc.textContent = info.description || 'Full-Word ASL Gesture';
            if (activeSignTypePill) {
                activeSignTypePill.textContent = '⚡ Word Sign';
                activeSignTypePill.className = 'active-sign-type-pill word-mode';
            }

            // Animate through keyframes in a loop
            if (info.keyframes && info.keyframes.length > 1) {
                let kIndex = 0;
                window.renderHandSkeleton(ctx, info.keyframes[kIndex]);
                const frameInterval = Math.max(180, Math.round(300 / playSpeed));
                wordKeyframeTimer = setInterval(() => {
                    kIndex = (kIndex + 1) % info.keyframes.length;
                    window.renderHandSkeleton(ctx, info.keyframes[kIndex]);
                }, frameInterval);
            } else {
                window.renderHandSkeleton(ctx, info.landmarks);
            }
        } else {
            activeSignLetter.textContent = item;
            activeSignDesc.textContent = info.description || `Fingerspelling letter '${item}'`;
            if (activeSignTypePill) {
                activeSignTypePill.textContent = '🔤 Letter';
                activeSignTypePill.className = 'active-sign-type-pill letter-mode';
            }
            window.renderHandSkeleton(ctx, info.landmarks);
        }

        // Update active tile highlight
        const tiles = sequenceTiles.querySelectorAll('.tile');
        tiles.forEach((t, i) => {
            if (i === index) {
                t.classList.add('active');
                t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            } else {
                t.classList.remove('active');
            }
        });

        animScrubber.value = index;
    }

    function playSequence() {
        if (currentSequence.length === 0) return;
        isPlaying = true;
        playIcon.className = 'fa-solid fa-pause';
        animStatusBadge.textContent = 'Playing';

        clearInterval(animTimer);
        // Base delay per step in sequence (words have longer presentation time)
        const currentItem = currentSequence[currentSignIndex];
        const isWord = typeof currentItem === 'string' && currentItem.length > 1 && currentItem !== ' ';
        const baseDelay = isWord ? 1400 : 900;
        const delay = Math.round(baseDelay / playSpeed);

        animTimer = setInterval(() => {
            if (currentSignIndex < currentSequence.length - 1) {
                currentSignIndex++;
                updateSignDisplay(currentSignIndex);
            } else {
                pauseSequence();
                animStatusBadge.textContent = 'Finished';
            }
        }, delay);
    }

    function pauseSequence() {
        isPlaying = false;
        playIcon.className = 'fa-solid fa-play';
        animStatusBadge.textContent = 'Paused';
        clearInterval(animTimer);
    }

    btnAnimPlay.addEventListener('click', () => {
        if (isPlaying) {
            pauseSequence();
        } else {
            if (currentSignIndex >= currentSequence.length - 1) {
                currentSignIndex = 0;
            }
            updateSignDisplay(currentSignIndex);
            playSequence();
        }
    });

    btnAnimPrev.addEventListener('click', () => {
        pauseSequence();
        if (currentSignIndex > 0) {
            currentSignIndex--;
            updateSignDisplay(currentSignIndex);
        }
    });

    btnAnimNext.addEventListener('click', () => {
        pauseSequence();
        if (currentSignIndex < currentSequence.length - 1) {
            currentSignIndex++;
            updateSignDisplay(currentSignIndex);
        }
    });

    btnAnimReplay.addEventListener('click', () => {
        currentSignIndex = 0;
        updateSignDisplay(0);
        playSequence();
    });

    animScrubber.addEventListener('input', (e) => {
        pauseSequence();
        currentSignIndex = parseInt(e.target.value);
        updateSignDisplay(currentSignIndex);
    });

    speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playSpeed = parseFloat(btn.getAttribute('data-speed'));
            if (isPlaying) {
                playSequence(); // Restart interval with new speed
            }
        });
    });

    btnTranslateToSign.addEventListener('click', () => {
        const text = textToSignInput.value.trim();
        if (text) translateTextToSign(text);
    });

    btnClearTextInput.addEventListener('click', () => {
        textToSignInput.value = '';
    });

    quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const phrase = chip.getAttribute('data-phrase');
            textToSignInput.value = phrase;
            translateTextToSign(phrase);
        });
    });

    // Voice Microphone Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        speechRecognizer = new SpeechRec();
        speechRecognizer.continuous = false;
        speechRecognizer.interimResults = false;
        speechRecognizer.lang = 'en-US';

        speechRecognizer.onstart = () => {
            isSpeechRecording = true;
            btnVoiceRecord.classList.add('recording');
            voiceStatusText.textContent = 'Listening... Speak now';
            voiceWaveform.classList.add('recording');
        };

        speechRecognizer.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            voiceStatusText.textContent = `Heard: "${transcript}"`;
            textToSignInput.value = transcript;
            translateTextToSign(transcript);
        };

        speechRecognizer.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            voiceStatusText.textContent = `Microphone error: ${event.error}`;
            stopVoiceRecord();
        };

        speechRecognizer.onend = () => {
            stopVoiceRecord();
        };
    } else {
        voiceStatusText.textContent = 'Voice recognition not supported in this browser. Use text input below.';
    }

    function stopVoiceRecord() {
        isSpeechRecording = false;
        btnVoiceRecord.classList.remove('recording');
        voiceWaveform.classList.remove('recording');
    }

    btnVoiceRecord.addEventListener('click', () => {
        if (!speechRecognizer) {
            alert('Speech Recognition is not supported on this browser. Try Chrome/Edge.');
            return;
        }

        if (isSpeechRecording) {
            speechRecognizer.stop();
        } else {
            speechRecognizer.start();
        }
    });

    // ==========================================
    // 4. TAB 3: TWO-WAY LIVE DIALOG
    // ==========================================
    const dialogMessages = document.getElementById('dialog-messages');
    const dialogInput = document.getElementById('dialog-input');
    const btnDialogSend = document.getElementById('btn-dialog-send');
    const btnClearDialog = document.getElementById('btn-clear-dialog');

    async function fetchConversation() {
        try {
            const res = await fetch('/api/conversation');
            if (!res.ok) return;
            const data = await res.json();
            renderConversation(data.history || []);
        } catch (err) {
            console.error('Conversation fetch error:', err);
        }
    }

    function renderConversation(history) {
        if (!history || history.length === 0) {
            dialogMessages.innerHTML = `
                <div class="dialog-welcome">
                    <i class="fa-solid fa-handshake-angle"></i>
                    <h3>Two-Way Communication Active</h3>
                    <p>Deaf user signs into camera ➔ translated into speech and text here.<br>Hearing user speaks or types ➔ translated into animated sign gestures.</p>
                </div>`;
            return;
        }

        dialogMessages.innerHTML = '';
        history.forEach(item => {
            const bubble = document.createElement('div');
            bubble.className = `dialog-bubble ${item.sender}`;
            
            const isDeaf = item.sender === 'deaf';
            bubble.innerHTML = `
                <div class="bubble-header">
                    <span><i class="fa-solid ${isDeaf ? 'fa-hands-asl-interpreting' : 'fa-user'}"></i> ${isDeaf ? 'Signer (Deaf)' : 'Speaker (Hearing)'}</span>
                    <span>${item.timestamp || ''}</span>
                </div>
                <div class="bubble-text">${item.message}</div>
                <button class="bubble-play-sign" onclick="window.playMessageInSign('${encodeURIComponent(item.message)}')">
                    <i class="fa-solid fa-play"></i> Show in Sign Animation
                </button>
            `;
            dialogMessages.appendChild(bubble);
        });

        dialogMessages.scrollTop = dialogMessages.scrollHeight;
    }

    window.playMessageInSign = (encodedMsg) => {
        const msg = decodeURIComponent(encodedMsg);
        document.querySelector('[data-tab="tab-speech-to-sign"]').click();
        textToSignInput.value = msg;
        translateTextToSign(msg);
    };

    async function postConversationMessage(sender, message) {
        if (!message.trim()) return;
        try {
            const res = await fetch('/api/conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender, message })
            });
            const data = await res.json();
            renderConversation(data.history || []);
        } catch (err) {
            console.error('Post conversation error:', err);
        }
    }

    btnDialogSend.addEventListener('click', async () => {
        const text = dialogInput.value.trim();
        if (text) {
            await postConversationMessage('hearing', text);
            dialogInput.value = '';
        }
    });

    dialogInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnDialogSend.click();
        }
    });

    btnClearDialog.addEventListener('click', async () => {
        await fetch('/api/conversation?action=clear');
        fetchConversation();
    });

    // ==========================================
    // 5. WORDS & PHRASES STUDIO LOGIC
    // ==========================================
    const wordSearchInput = document.getElementById('word-search-input');
    const categoryPillsContainer = document.getElementById('category-pills');
    const wordsGrid = document.getElementById('words-grid');
    const wordsCountLabel = document.getElementById('words-count-label');
    const wordPracticeBox = document.getElementById('word-practice-box');
    const practiceWordTitle = document.getElementById('practice-word-title');
    const practiceLettersRow = document.getElementById('practice-letters-row');
    const practiceProgressBar = document.getElementById('practice-progress-bar');
    const practiceWordTip = document.getElementById('practice-word-tip');
    const btnClosePractice = document.getElementById('btn-close-practice');

    let currentCategory = 'All';

    function initWordsStudio() {
        renderWordsGrid(window.WORD_DATABASE || []);

        if (categoryPillsContainer) {
            categoryPillsContainer.querySelectorAll('.cat-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    categoryPillsContainer.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    currentCategory = pill.getAttribute('data-category');
                    filterAndRenderWords();
                });
            });
        }

        if (wordSearchInput) {
            wordSearchInput.addEventListener('input', () => {
                filterAndRenderWords();
            });
        }

        if (btnClosePractice) {
            btnClosePractice.addEventListener('click', () => {
                activePractice = null;
                if (wordPracticeBox) wordPracticeBox.style.display = 'none';
            });
        }
    }

    function filterAndRenderWords() {
        const query = wordSearchInput ? wordSearchInput.value.trim() : '';
        let list = window.filterWordsByCategory ? window.filterWordsByCategory(currentCategory) : window.WORD_DATABASE;
        if (query) {
            const q = query.toUpperCase();
            list = list.filter(item => item.word.includes(q) || item.category.toUpperCase().includes(q) || item.description.toUpperCase().includes(q));
        }
        renderWordsGrid(list);
    }

    function renderWordsGrid(words) {
        if (!wordsGrid) return;
        wordsGrid.innerHTML = '';

        if (wordsCountLabel) {
            wordsCountLabel.textContent = `${words.length} Words Available`;
        }

        if (words.length === 0) {
            wordsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No matching words found.</div>';
            return;
        }

        words.forEach(item => {
            const card = document.createElement('div');
            card.className = 'word-card';
            card.innerHTML = `
                <div class="word-card-top">
                    <div class="word-card-info">
                        <span class="word-name">${item.word}</span>
                        <span class="word-category-tag">${item.category}</span>
                    </div>
                    <span class="word-emoji">${item.emoji || '🖐️'}</span>
                </div>
                <div class="word-desc"><strong>Meaning:</strong> ${item.meaning || item.description}</div>
                <div class="word-card-actions">
                    <button class="btn-card-action btn-meaning-info" title="View full meaning, hand mechanics and context">
                        <i class="fa-solid fa-lightbulb"></i> Meaning &amp; Guide
                    </button>
                    <button class="btn-card-action btn-preview-sign" title="Play animated sign sequence">
                        <i class="fa-solid fa-play"></i> Preview
                    </button>
                    <button class="btn-card-action btn-practice-sign" title="Practice in front of camera">
                        <i class="fa-solid fa-bullseye"></i> Practice
                    </button>
                </div>
            `;

            // Meaning / Guide Action
            card.querySelector('.btn-meaning-info').addEventListener('click', () => {
                openWordMeaningModal(item);
            });

            // Preview Action
            card.querySelector('.btn-preview-sign').addEventListener('click', () => {
                document.querySelector('[data-tab="tab-speech-to-sign"]').click();
                if (textToSignInput) textToSignInput.value = item.word;
                translateTextToSign(item.word);
            });

            // Practice Action
            card.querySelector('.btn-practice-sign').addEventListener('click', () => {
                startWordPractice(item);
            });

            wordsGrid.appendChild(card);
        });
    }

    // Modal Word Details & Meaning
    const wordMeaningModal = document.getElementById('word-meaning-modal');
    const btnCloseMeaningModal = document.getElementById('btn-close-meaning-modal');
    const modalWordEmoji = document.getElementById('modal-word-emoji');
    const modalWordTitle = document.getElementById('modal-word-title');
    const modalWordCategory = document.getElementById('modal-word-category');
    const modalWordMeaning = document.getElementById('modal-word-meaning');
    const modalWordMechanics = document.getElementById('modal-word-mechanics');
    const modalWordExample = document.getElementById('modal-word-example');
    const modalWordCultural = document.getElementById('modal-word-cultural');
    const modalSpellingStrip = document.getElementById('modal-spelling-strip');
    const btnModalSpeak = document.getElementById('btn-modal-speak');
    const btnModalPreview = document.getElementById('btn-modal-preview');
    const btnModalPractice = document.getElementById('btn-modal-practice');

    let activeModalItem = null;

    function openWordMeaningModal(item) {
        activeModalItem = item;
        if (modalWordEmoji) modalWordEmoji.textContent = item.emoji || '🖐️';
        if (modalWordTitle) modalWordTitle.textContent = item.word;
        if (modalWordCategory) modalWordCategory.textContent = item.category;
        if (modalWordMeaning) modalWordMeaning.textContent = item.meaning || item.description;
        if (modalWordMechanics) modalWordMechanics.innerHTML = `<strong>Hand Movement:</strong> ${item.howToSign || item.tip || 'Sign letters in sequence.'}`;
        if (modalWordExample) modalWordExample.textContent = item.exampleSentence || `"${item.word} is used in everyday conversation."`;
        if (modalWordCultural) modalWordCultural.innerHTML = `<strong>Facial Expression &amp; Grammar:</strong> ${item.culturalNote || 'Maintain natural, clear eye contact.'}`;

        if (modalSpellingStrip) {
            modalSpellingStrip.innerHTML = '';
            (item.sequence || []).forEach(char => {
                if (char.trim()) {
                    const tile = document.createElement('span');
                    tile.className = 'spelling-tile-mini';
                    tile.textContent = char;
                    modalSpellingStrip.appendChild(tile);
                }
            });
        }

        if (wordMeaningModal) wordMeaningModal.classList.add('active');
    }

    if (btnCloseMeaningModal) {
        btnCloseMeaningModal.addEventListener('click', () => {
            if (wordMeaningModal) wordMeaningModal.classList.remove('active');
        });
    }

    if (wordMeaningModal) {
        wordMeaningModal.addEventListener('click', (e) => {
            if (e.target === wordMeaningModal) wordMeaningModal.classList.remove('active');
        });
    }

    if (btnModalSpeak) {
        btnModalSpeak.addEventListener('click', () => {
            if (activeModalItem) speakText(activeModalItem.word);
        });
    }

    if (btnModalPreview) {
        btnModalPreview.addEventListener('click', () => {
            if (wordMeaningModal) wordMeaningModal.classList.remove('active');
            if (activeModalItem) {
                document.querySelector('[data-tab="tab-speech-to-sign"]').click();
                if (textToSignInput) textToSignInput.value = activeModalItem.word;
                translateTextToSign(activeModalItem.word);
            }
        });
    }

    if (btnModalPractice) {
        btnModalPractice.addEventListener('click', () => {
            if (wordMeaningModal) wordMeaningModal.classList.remove('active');
            if (activeModalItem) {
                startWordPractice(activeModalItem);
            }
        });
    }

    function startWordPractice(item) {
        const letters = item.sequence.filter(c => c.trim().length > 0 && c.match(/[A-Z0-9]/i));
        if (letters.length === 0) return;

        activePractice = {
            word: item.word,
            letters: letters,
            index: 0
        };

        if (practiceWordTitle) practiceWordTitle.textContent = `${item.emoji || ''} ${item.word}`;
        if (practiceProgressBar) practiceProgressBar.style.width = '0%';
        if (practiceWordTip) practiceWordTip.textContent = item.tip ? `💡 Tip: ${item.tip}. Hold gesture steady to register.` : 'Sign each letter in front of the camera to complete the word!';

        if (practiceLettersRow) {
            practiceLettersRow.innerHTML = '';
            letters.forEach((lt, idx) => {
                const badge = document.createElement('div');
                badge.className = `practice-letter-badge ${idx === 0 ? 'current' : ''}`;
                badge.textContent = lt;
                practiceLettersRow.appendChild(badge);
            });
        }

        if (wordPracticeBox) {
            wordPracticeBox.style.display = 'block';
            wordPracticeBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // ==========================================
    // 6. MODAL LOGIC
    // ==========================================
    const btnInfoModal = document.getElementById('btn-info-modal');
    const chartModal = document.getElementById('chart-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    btnInfoModal.addEventListener('click', () => chartModal.classList.add('active'));
    btnCloseModal.addEventListener('click', () => chartModal.classList.remove('active'));
    chartModal.addEventListener('click', (e) => {
        if (e.target === chartModal) chartModal.classList.remove('active');
    });

    // ==========================================
    // 7. CUSTOM GESTURE STUDIO LOGIC
    // ==========================================
    const customGesturesGrid = document.getElementById('custom-gestures-grid');
    const customGesturesCount = document.getElementById('custom-gestures-count');
    const customSearchInput = document.getElementById('custom-search-input');
    const btnRefreshCustom = document.getElementById('btn-refresh-custom');
    const btnRecordCustomGesture = document.getElementById('btn-record-custom-gesture');
    const btnTestCustomCapture = document.getElementById('btn-test-custom-capture');
    const recorderOverlay = document.getElementById('recorder-overlay');
    const recordCountdown = document.getElementById('record-countdown');
    const recordCountdownText = document.getElementById('record-countdown-text');
    const customRecorderStatus = document.getElementById('custom-recorder-status');
    const customNameInput = document.getElementById('custom-gesture-name');
    const customEmojiInput = document.getElementById('custom-gesture-emoji');
    const customPhraseInput = document.getElementById('custom-gesture-phrase');

    let allCustomGestures = [];

    async function fetchCustomGestures() {
        try {
            const res = await fetch('/api/custom_gestures');
            const data = await res.json();
            allCustomGestures = data.gestures || [];
            renderCustomGesturesList(allCustomGestures);
        } catch (e) {
            console.error("Error fetching custom gestures:", e);
        }
    }

    function renderCustomGesturesList(gestures) {
        if (!customGesturesGrid) return;
        customGesturesGrid.innerHTML = '';
        if (customGesturesCount) {
            customGesturesCount.textContent = `${gestures.length} Gesture${gestures.length === 1 ? '' : 's'}`;
        }

        if (gestures.length === 0) {
            customGesturesGrid.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">No custom gestures yet. Record one using the form on the left!</div>';
            return;
        }

        gestures.forEach(g => {
            const card = document.createElement('div');
            card.className = 'custom-card';
            card.innerHTML = `
                <div class="custom-card-main">
                    <span class="custom-card-emoji">${g.emoji || '✨'}</span>
                    <div class="custom-card-details">
                        <div class="custom-card-name">${g.name}</div>
                        <div class="custom-card-phrase">"${g.phrase || g.name}"</div>
                        <div class="custom-card-meta">${g.vector ? '✅ 21 3D Landmarks Trained' : '⚠️ Template Pending'}</div>
                    </div>
                </div>
                <div class="custom-card-actions">
                    <button class="btn-card-icon speak" title="Speak Phrase">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                    <button class="btn-card-icon delete" title="Delete Gesture">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            card.querySelector('.btn-card-icon.speak').addEventListener('click', () => {
                speakText(g.phrase || g.name);
            });

            card.querySelector('.btn-card-icon.delete').addEventListener('click', async () => {
                if (confirm(`Delete custom gesture "${g.name}"?`)) {
                    try {
                        const res = await fetch(`/api/custom_gestures/${encodeURIComponent(g.name)}`, { method: 'DELETE' });
                        const d = await res.json();
                        allCustomGestures = d.gestures || [];
                        renderCustomGesturesList(allCustomGestures);
                    } catch (err) {
                        alert("Error deleting gesture.");
                    }
                }
            });

            customGesturesGrid.appendChild(card);
        });
    }

    if (customSearchInput) {
        customSearchInput.addEventListener('input', () => {
            const query = customSearchInput.value.trim().toUpperCase();
            if (!query) {
                renderCustomGesturesList(allCustomGestures);
            } else {
                const filtered = allCustomGestures.filter(g => g.name.toUpperCase().includes(query) || (g.phrase && g.phrase.toUpperCase().includes(query)));
                renderCustomGesturesList(filtered);
            }
        });
    }

    if (btnRefreshCustom) {
        btnRefreshCustom.addEventListener('click', fetchCustomGestures);
    }

    async function recordNewCustomGesture() {
        const name = (customNameInput ? customNameInput.value.trim() : '').toUpperCase();
        const emoji = (customEmojiInput ? customEmojiInput.value.trim() : '') || '✨';
        const phrase = (customPhraseInput ? customPhraseInput.value.trim() : '') || name;

        if (!name) {
            alert("Please enter a Gesture Name (e.g. 'MY NAME IS VARUN' or 'WATER PLEASE')");
            if (customNameInput) customNameInput.focus();
            return;
        }

        if (recorderOverlay) recorderOverlay.classList.add('active');
        if (customRecorderStatus) customRecorderStatus.textContent = "Hold your hand steady in the camera...";

        // 3-second countdown
        let count = 3;
        if (recordCountdown) recordCountdown.textContent = count;

        const countdownInterval = setInterval(async () => {
            count--;
            if (count > 0) {
                if (recordCountdown) recordCountdown.textContent = count;
            } else {
                clearInterval(countdownInterval);
                if (recordCountdown) recordCountdown.textContent = "📸";
                if (recordCountdownText) recordCountdownText.textContent = "Capturing 3D landmarks...";

                // Fetch live landmarks
                try {
                    const capRes = await fetch('/api/custom_gestures/capture_live');
                    const capData = await capRes.json();

                    if (!capData.success) {
                        if (recorderOverlay) recorderOverlay.classList.remove('active');
                        if (customRecorderStatus) {
                            customRecorderStatus.innerHTML = `<span style="color: #ef4444;">❌ ${capData.message}</span>`;
                        }
                        alert(capData.message);
                        return;
                    }

                    // Save to backend
                    const saveRes = await fetch('/api/custom_gestures', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            emoji: emoji,
                            phrase: phrase,
                            vector: capData.vector
                        })
                    });

                    const saveData = await saveRes.json();
                    if (recorderOverlay) recorderOverlay.classList.remove('active');

                    if (saveData.status === 'success') {
                        if (customRecorderStatus) {
                            customRecorderStatus.innerHTML = `<span style="color: #10b981;">✅ Gesture '${name}' trained &amp; active! Show it to your camera anytime!</span>`;
                        }
                        if (customNameInput) customNameInput.value = '';
                        if (customEmojiInput) customEmojiInput.value = '';
                        if (customPhraseInput) customPhraseInput.value = '';
                        allCustomGestures = saveData.gestures || [];
                        renderCustomGesturesList(allCustomGestures);
                        speakText(`Custom gesture ${name} registered successfully!`);
                    } else {
                        alert(saveData.message || "Failed to save custom gesture.");
                    }
                } catch (err) {
                    if (recorderOverlay) recorderOverlay.classList.remove('active');
                    alert("Error communicating with gesture server.");
                }
            }
        }, 1000);
    }

    if (btnRecordCustomGesture) {
        btnRecordCustomGesture.addEventListener('click', recordNewCustomGesture);
    }

    if (btnTestCustomCapture) {
        btnTestCustomCapture.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/custom_gestures/capture_live');
                const data = await res.json();
                if (data.success) {
                    if (customRecorderStatus) {
                        customRecorderStatus.innerHTML = `<span style="color: #10b981;">✅ Hand detected! (${data.landmarks_count} landmarks ready to capture)</span>`;
                    }
                } else {
                    if (customRecorderStatus) {
                        customRecorderStatus.innerHTML = `<span style="color: #ef4444;">⚠️ No hand detected. Hold hand inside webcam box.</span>`;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    // ==========================================
    // TAB 6: 3-GESTURE LOCK VAULT CONTROLLER
    // ==========================================
    let vaultSelectedCombo = []; // [{ gesture: 'PEACE', emoji: '✌️' }]
    let activeUnlockTargetId = 'msg_demo_001';
    let unlockSubmittedCombo = []; // [{ gesture: 'PEACE', emoji: '✌️' }]
    let lastScanSign = '';
    let scanHoldTimer = 0;
    let isVerifyingUnlock = false;

    function renderVaultComboSlots() {
        for (let i = 1; i <= 3; i++) {
            const slotEl = document.getElementById(`combo-slot-${i}`);
            if (!slotEl) continue;
            const emojiEl = slotEl.querySelector('.slot-emoji');
            const nameEl = slotEl.querySelector('.slot-name');

            if (vaultSelectedCombo[i - 1]) {
                const item = vaultSelectedCombo[i - 1];
                slotEl.classList.add('filled');
                if (emojiEl) emojiEl.textContent = item.emoji || '✨';
                if (nameEl) nameEl.textContent = item.gesture;
            } else {
                slotEl.classList.remove('filled');
                if (emojiEl) emojiEl.textContent = '❓';
                if (nameEl) nameEl.textContent = `Gesture ${i}`;
            }
        }

        const countEl = document.getElementById('vault-combo-count');
        if (countEl) {
            countEl.textContent = `${vaultSelectedCombo.length} / 3 Selected`;
            countEl.style.color = vaultSelectedCombo.length === 3 ? '#10b981' : '#c084fc';
        }
    }

    function addGestureToVaultCombo(gesture, emoji) {
        if (vaultSelectedCombo.length >= 3) {
            return;
        }
        vaultSelectedCombo.push({ gesture: gesture.toUpperCase(), emoji });
        renderVaultComboSlots();
    }

    // Gesture Picker Buttons in Create Vault
    document.querySelectorAll('.vault-pick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const g = chip.getAttribute('data-gesture') || '';
            const em = chip.getAttribute('data-emoji') || '✨';
            if (g) addGestureToVaultCombo(g, em);
        });
    });

    const btnVaultClearCombo = document.getElementById('btn-vault-clear-combo');
    if (btnVaultClearCombo) {
        btnVaultClearCombo.addEventListener('click', () => {
            vaultSelectedCombo = [];
            renderVaultComboSlots();
        });
    }

    const btnVaultCaptureLive = document.getElementById('btn-vault-capture-live');
    if (btnVaultCaptureLive) {
        btnVaultCaptureLive.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const sym = (data.symbol || '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase();
                if (sym && sym !== '-' && sym !== 'NONE') {
                    const cleanWord = sym.split(' ')[0];
                    const em = GESTURE_EMOJIS[cleanWord] || data.detected_emoji || '✨';
                    addGestureToVaultCombo(cleanWord, em);
                } else {
                    alert("No clear hand gesture currently detected. Please hold sign in front of camera.");
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    // Create Gesture-Locked Message
    const btnVaultCreate = document.getElementById('btn-vault-create');
    const vaultSecretInput = document.getElementById('vault-secret-input');
    const vaultHintInput = document.getElementById('vault-hint-input');
    const vaultSenderInput = document.getElementById('vault-sender-input');
    const vaultBurnCheck = document.getElementById('vault-burn-check');
    const vaultCreatedAlert = document.getElementById('vault-created-alert');
    const vaultShareLink = document.getElementById('vault-share-link');

    if (btnVaultCreate) {
        btnVaultCreate.addEventListener('click', async () => {
            const message = vaultSecretInput ? vaultSecretInput.value.trim() : '';
            if (!message) {
                alert("Please enter confidential message content.");
                return;
            }
            if (vaultSelectedCombo.length !== 3) {
                alert("Please select exactly 3 gestures for your security combination lock.");
                return;
            }

            const payload = {
                message: message,
                gesture_combo: vaultSelectedCombo.map(item => item.gesture),
                hint: vaultHintInput ? vaultHintInput.value.trim() : '',
                sender: vaultSenderInput ? vaultSenderInput.value.trim() : 'User 1',
                burn_after_read: vaultBurnCheck ? vaultBurnCheck.checked : false
            };

            try {
                const res = await fetch('/api/vault/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.status === 'success') {
                    if (vaultCreatedAlert) vaultCreatedAlert.style.display = 'flex';
                    if (vaultShareLink) vaultShareLink.value = `${window.location.origin}${data.share_url}`;
                    speakText("Secret message encrypted and locked with 3-gesture security PIN!");
                    fetchVaultInbox();
                } else {
                    alert(data.message || "Failed to create locked message.");
                }
            } catch (e) {
                alert("Error communicating with vault server.");
            }
        });
    }

    const btnCopyVaultLink = document.getElementById('btn-copy-vault-link');
    if (btnCopyVaultLink && vaultShareLink) {
        btnCopyVaultLink.addEventListener('click', () => {
            vaultShareLink.select();
            navigator.clipboard.writeText(vaultShareLink.value);
            btnCopyVaultLink.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                btnCopyVaultLink.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
            }, 2000);
        });
    }

    // Vault Inbox & Unlocking Logic
    const vaultInboxList = document.getElementById('vault-inbox-list');
    const btnRefreshVaultInbox = document.getElementById('btn-refresh-vault-inbox');
    const challengeSender = document.getElementById('challenge-sender');
    const challengeHint = document.getElementById('challenge-hint');
    const unlockEnvelopeId = document.getElementById('unlock-envelope-id');
    const unlockStatusBanner = document.getElementById('unlock-status-banner');
    const unlockBannerText = document.getElementById('unlock-banner-text');
    const vaultDecryptedBox = document.getElementById('vault-decrypted-box');
    const vaultDecryptedContent = document.getElementById('vault-decrypted-content');
    const btnSpeakDecrypted = document.getElementById('btn-speak-decrypted');
    const btnCopyDecrypted = document.getElementById('btn-copy-decrypted');
    let lastDecryptedText = '';

    async function fetchVaultInbox() {
        if (!vaultInboxList) return;
        try {
            const res = await fetch('/api/vault/list');
            const data = await res.json();
            if (data.status === 'success') {
                renderVaultInbox(data.messages || []);
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderVaultInbox(messages) {
        if (!vaultInboxList) return;
        vaultInboxList.innerHTML = '';

        if (messages.length === 0) {
            vaultInboxList.innerHTML = '<div class="inbox-loading">No locked messages in vault. Create one on the left!</div>';
            return;
        }

        messages.forEach(msg => {
            const card = document.createElement('div');
            card.className = `inbox-card-item ${msg.id === activeUnlockTargetId ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="inbox-sender"><i class="fa-solid fa-lock"></i> ${msg.sender || 'Anonymous'}</div>
                <div class="inbox-hint">${msg.hint || '3-Gesture Lock'}</div>
            `;
            card.addEventListener('click', () => {
                selectVaultMessageToUnlock(msg);
            });
            vaultInboxList.appendChild(card);
        });
    }

    function selectVaultMessageToUnlock(msg) {
        activeUnlockTargetId = msg.id;
        document.querySelectorAll('.inbox-card-item').forEach(c => c.classList.remove('selected'));
        fetchVaultInbox();

        if (unlockEnvelopeId) unlockEnvelopeId.textContent = `ID: ${msg.id}`;
        if (challengeSender) challengeSender.textContent = msg.sender || 'User 1';
        if (challengeHint) challengeHint.textContent = msg.hint || '3-Gesture Combination Pattern';

        resetUnlockChallengeState();
    }

    function resetUnlockChallengeState() {
        unlockSubmittedCombo = [];
        isVerifyingUnlock = false;
        renderUnlockSlots();

        if (unlockStatusBanner) {
            unlockStatusBanner.className = 'unlock-status-banner initial';
            if (unlockBannerText) unlockBannerText.textContent = 'Stand in front of camera and perform Gesture #1 to begin authentication';
        }
        if (vaultDecryptedBox) vaultDecryptedBox.style.display = 'none';
    }

    function renderUnlockSlots() {
        for (let i = 1; i <= 3; i++) {
            const slot = document.getElementById(`unlock-slot-${i}`);
            const statusEl = document.getElementById(`unlock-slot-status-${i}`);
            const labelEl = document.getElementById(`unlock-slot-label-${i}`);
            if (!slot) continue;

            const targetIdx = i - 1;
            if (unlockSubmittedCombo[targetIdx]) {
                slot.className = 'unlock-slot matched';
                if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i>';
                if (labelEl) labelEl.textContent = `${unlockSubmittedCombo[targetIdx].emoji || '✨'} ${unlockSubmittedCombo[targetIdx].gesture}`;
            } else if (targetIdx === unlockSubmittedCombo.length) {
                slot.className = 'unlock-slot active';
                if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-camera"></i>';
                if (labelEl) labelEl.textContent = `Sign Gesture ${i}`;
            } else {
                slot.className = 'unlock-slot';
                if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-lock"></i>';
                if (labelEl) labelEl.textContent = `Gesture ${i}`;
            }
        }
    }

    async function handleUnlockGestureDetection(detectedWord, detectedEmoji) {
        if (!detectedWord || detectedWord === '-' || isVerifyingUnlock) return;
        if (unlockSubmittedCombo.length >= 3) return;

        const currentStep = unlockSubmittedCombo.length; // 0, 1, or 2
        unlockSubmittedCombo.push({ gesture: detectedWord, emoji: detectedEmoji });
        renderUnlockSlots();

        if (unlockStatusBanner) {
            unlockStatusBanner.className = 'unlock-status-banner in-progress';
            if (unlockBannerText) {
                if (unlockSubmittedCombo.length < 3) {
                    unlockBannerText.textContent = `🟢 Step ${unlockSubmittedCombo.length}/3 Captured: ${detectedEmoji} ${detectedWord}. Now perform Gesture #${unlockSubmittedCombo.length + 1}!`;
                } else {
                    unlockBannerText.textContent = `⚡ 3 Gestures Captured! Verifying Security Pattern...`;
                }
            }
        }

        // When all 3 gestures are captured, verify with backend
        if (unlockSubmittedCombo.length === 3) {
            isVerifyingUnlock = true;
            await verifySubmittedUnlockPattern();
        }
    }

    async function verifySubmittedUnlockPattern() {
        try {
            const payload = {
                message_id: activeUnlockTargetId,
                submitted_combo: unlockSubmittedCombo.map(item => item.gesture)
            };

            const res = await fetch('/api/vault/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.status === 'success') {
                // SUCCESS: ACCESS GRANTED!
                if (unlockStatusBanner) {
                    unlockStatusBanner.className = 'unlock-status-banner success';
                    if (unlockBannerText) unlockBannerText.innerHTML = '<strong>🔓 SUCCESS: ACCESS GRANTED!</strong> Gesture pattern verified.';
                }

                lastDecryptedText = data.decrypted_text || '';
                if (vaultDecryptedContent) vaultDecryptedContent.textContent = lastDecryptedText;
                if (vaultDecryptedBox) vaultDecryptedBox.style.display = 'flex';

                speakText(`Access Granted! Decrypted message: ${lastDecryptedText}`);
            } else {
                // FAILURE: INCORRECT GESTURE PATTERN!
                if (unlockStatusBanner) {
                    unlockStatusBanner.className = 'unlock-status-banner error';
                    if (unlockBannerText) unlockBannerText.innerHTML = `<strong>❌ INCORRECT GESTURE PATTERN! Access Denied.</strong>`;
                }

                speakText("Incorrect gesture pattern. Access denied.");

                // Reset slots after 2.4 seconds for retry
                setTimeout(() => {
                    resetUnlockChallengeState();
                }, 2400);
            }
        } catch (e) {
            console.error(e);
            isVerifyingUnlock = false;
        }
    }

    const btnUnlockResetSlots = document.getElementById('btn-unlock-reset-slots');
    if (btnUnlockResetSlots) {
        btnUnlockResetSlots.addEventListener('click', resetUnlockChallengeState);
    }

    const btnManualConfirmGesture = document.getElementById('btn-manual-confirm-gesture');
    if (btnManualConfirmGesture) {
        btnManualConfirmGesture.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const sym = (data.symbol || '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase();
                if (sym && sym !== '-' && sym !== 'NONE') {
                    const cleanWord = sym.split(' ')[0];
                    const em = GESTURE_EMOJIS[cleanWord] || data.detected_emoji || '✨';
                    handleUnlockGestureDetection(cleanWord, em);
                } else {
                    alert("No hand gesture currently detected. Please hold sign in camera view.");
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    if (btnRefreshVaultInbox) {
        btnRefreshVaultInbox.addEventListener('click', fetchVaultInbox);
    }

    if (btnSpeakDecrypted) {
        btnSpeakDecrypted.addEventListener('click', () => {
            if (lastDecryptedText) speakText(lastDecryptedText);
        });
    }

    if (btnCopyDecrypted) {
        btnCopyDecrypted.addEventListener('click', () => {
            if (lastDecryptedText) {
                navigator.clipboard.writeText(lastDecryptedText);
                btnCopyDecrypted.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    btnCopyDecrypted.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Text';
                }, 2000);
            }
        });
    }

    // Auto-populate from URL hash if opened via share link (#vault=msg_1234)
    if (window.location.hash.startsWith('#vault=')) {
        const targetId = window.location.hash.replace('#vault=', '').trim();
        if (targetId) {
            activeUnlockTargetId = targetId;
            // Switch to Vault Tab
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const vaultTabBtn = document.querySelector('.tab-btn[data-tab="tab-gesture-vault"]');
            const vaultSection = document.getElementById('tab-gesture-vault');
            if (vaultTabBtn) vaultTabBtn.classList.add('active');
            if (vaultSection) vaultSection.classList.add('active');
        }
    }

    // Check Live Sign in Unlock Station when Vault Tab is active
    function checkLiveSignForUnlock(data) {
        const isVaultActive = document.getElementById('tab-gesture-vault') && document.getElementById('tab-gesture-vault').classList.contains('active');
        if (!isVaultActive) return;

        const liveGestureNameEl = document.getElementById('unlock-live-gesture-name');
        const sym = (data.symbol || '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase();
        if (sym && sym !== '-' && sym !== 'NONE') {
            const cleanWord = sym.split(' ')[0];
            const em = GESTURE_EMOJIS[cleanWord] || data.detected_emoji || '✨';
            if (liveGestureNameEl) liveGestureNameEl.textContent = `${em} ${cleanWord}`;

            // Automatic hold detection (5 consecutive cycles ~ 750ms) to commit into unlock slot
            if (cleanWord === lastScanSign) {
                scanHoldTimer++;
                if (scanHoldTimer === 6 && !isVerifyingUnlock && unlockSubmittedCombo.length < 3) {
                    handleUnlockGestureDetection(cleanWord, em);
                }
            } else {
                lastScanSign = cleanWord;
                scanHoldTimer = 1;
            }
        } else {
            if (liveGestureNameEl) liveGestureNameEl.textContent = "Show Hand Sign...";
            lastScanSign = '';
            scanHoldTimer = 0;
        }
    }

    // Hook checkLiveSignForUnlock into updateSignStatus polling
    const origUpdateSignStatus = updateSignStatus;

    // Start background status polling, studio, custom gestures, and vault
    updateSignStatus();
    initGestureCanvas();
    initWordsStudio();
    fetchCustomGestures();
    fetchVaultInbox();
    renderVaultComboSlots();
    resetUnlockChallengeState();
});
