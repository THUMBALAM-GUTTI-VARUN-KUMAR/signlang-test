document.addEventListener('DOMContentLoaded', () => {
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

    let previousSymbol = '-';
    let isPolling = false;
    let currentMode = 'word';

    // Word Mode Toggle Handler
    async function setRecognitionMode(mode) {
        currentMode = mode;
        if (mode === 'word') {
            if (btnModeWord) btnModeWord.classList.add('active');
            if (btnModeLetter) btnModeLetter.classList.remove('active');
            if (hudTitleText) hudTitleText.textContent = 'Detected Word / Sign';
            if (charBoxLabel) charBoxLabel.textContent = 'Active Word';
            if (metaHelpText) metaHelpText.querySelector('span').textContent = 'Hold any word gesture steady to auto-speak and add to sentence!';
            if (wordCheatsheetBox) wordCheatsheetBox.style.display = 'flex';
            if (suggestionsCard) suggestionsCard.style.display = 'none';
        } else {
            if (btnModeLetter) btnModeLetter.classList.add('active');
            if (btnModeWord) btnModeWord.classList.remove('active');
            if (hudTitleText) hudTitleText.textContent = 'Detected Letter';
            if (charBoxLabel) charBoxLabel.textContent = 'Letter';
            if (metaHelpText) metaHelpText.querySelector('span').textContent = 'Hold steady to recognize letter; spell words sequentially.';
            if (wordCheatsheetBox) wordCheatsheetBox.style.display = 'none';
            if (suggestionsCard) suggestionsCard.style.display = 'block';
        }

        try {
            await fetch('/api/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
        } catch (err) {}
    }

    if (btnModeWord) btnModeWord.addEventListener('click', () => setRecognitionMode('word'));
    if (btnModeLetter) btnModeLetter.addEventListener('click', () => setRecognitionMode('letter'));

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
                            currentCharEl.textContent = data.symbol || '-';
                            charBoxEl.classList.add('char-bump');
                            setTimeout(() => charBoxEl.classList.remove('char-bump'), 180);
                            previousSymbol = data.symbol;
                        }

                        const conf = Math.max(0, Math.min(100, data.confidence || 0));
                        confValEl.textContent = `${conf}%`;
                        confBarEl.style.width = `${conf}%`;

                        if (data.hand_detected) {
                            handIndicator.className = 'status-dot green pulse';
                            handText.textContent = 'Hand Active';
                        } else {
                            handIndicator.className = 'status-dot gray';
                            handText.textContent = 'No Hand';
                        }

                        if (document.activeElement !== sentenceTextEl) {
                            sentenceTextEl.value = data.sentence || '';
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
    const animStatusBadge = document.getElementById('anim-status-badge');
    const sequenceTiles = document.getElementById('sequence-tiles');
    const animScrubber = document.getElementById('anim-scrubber');
    
    const btnAnimPlay = document.getElementById('btn-anim-play');
    const playIcon = document.getElementById('play-icon');
    const btnAnimPrev = document.getElementById('btn-anim-prev');
    const btnAnimNext = document.getElementById('btn-anim-next');
    const btnAnimReplay = document.getElementById('btn-anim-replay');
    const speedButtons = document.querySelectorAll('.btn-speed');

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
    let isSpeechRecording = false;
    let speechRecognizer = null;

    function initGestureCanvas() {
        if (currentSequence.length === 0) {
            const defaultLandmarks = window.getLandmarksForChar('A').landmarks;
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
                body: JSON.stringify({ text })
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
            tile.className = `tile ${idx === currentSignIndex ? 'active' : ''}`;
            tile.textContent = item === ' ' ? '␣' : item;
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

        const char = currentSequence[index];
        const info = window.getLandmarksForChar(char);

        activeSignLetter.textContent = char === ' ' ? 'PAUSE' : char;
        activeSignDesc.textContent = char === ' ' ? 'Short pause between words' : info.description;

        window.renderHandSkeleton(ctx, info.landmarks);

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
        const delay = Math.round(900 / playSpeed);

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

    // Start background status polling and studio
    updateSignStatus();
    initGestureCanvas();
    initWordsStudio();
});
