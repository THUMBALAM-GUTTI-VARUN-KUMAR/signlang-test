document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const currentCharEl = document.getElementById('current-char');
    const charBoxEl = document.getElementById('char-box');
    const confValEl = document.getElementById('conf-val');
    const confBarEl = document.getElementById('conf-bar');
    const sentenceTextEl = document.getElementById('sentence-text');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const handIndicator = document.getElementById('hand-indicator');
    const handText = document.getElementById('hand-text');
    
    // Buttons
    const btnSpeak = document.getElementById('btn-speak');
    const btnClear = document.getElementById('btn-clear');
    const btnSpace = document.getElementById('btn-space');
    const btnBackspace = document.getElementById('btn-backspace');
    const btnCopy = document.getElementById('btn-copy');
    const btnDownload = document.getElementById('btn-download');
    
    // Modal elements
    const btnInfoModal = document.getElementById('btn-info-modal');
    const chartModal = document.getElementById('chart-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    let previousSymbol = '-';

    // Status polling loop (high responsiveness)
    async function updateStatus() {
        try {
            const res = await fetch('/api/status');
            if (!res.ok) return;
            const data = await res.json();

            // Update detected symbol & animate if changed
            if (data.symbol !== previousSymbol) {
                currentCharEl.textContent = data.symbol || '-';
                charBoxEl.classList.add('char-bump');
                setTimeout(() => charBoxEl.classList.remove('char-bump'), 200);
                previousSymbol = data.symbol;
            }

            // Update confidence
            const conf = Math.max(0, Math.min(100, data.confidence || 0));
            confValEl.textContent = `${conf}%`;
            confBarEl.style.width = `${conf}%`;

            // Update hand indicator
            if (data.hand_detected) {
                handIndicator.className = 'status-dot green pulse';
                handText.textContent = 'Hand Tracking Active';
            } else {
                handIndicator.className = 'status-dot gray';
                handText.textContent = 'No Hand in Frame';
            }

            // Update sentence textarea if not currently focused by user typing
            if (document.activeElement !== sentenceTextEl) {
                sentenceTextEl.value = data.sentence || '';
            }

            // Update smart suggestions
            renderSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Status fetch error:', err);
        }
    }

    function renderSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<span class="no-suggestions">Spell letters to view word completions...</span>';
            return;
        }

        suggestionsContainer.innerHTML = '';
        suggestions.forEach(word => {
            const chip = document.createElement('button');
            chip.className = 'suggestion-chip';
            chip.textContent = word;
            chip.onclick = () => applySuggestion(word);
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

    function applySuggestion(word) {
        sendAction('suggest', word);
    }

    // TTS Speak Logic (Browser Web Speech API + Server Fallback)
    btnSpeak.addEventListener('click', () => {
        const text = sentenceTextEl.value.trim();
        if (!text) return;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
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
            const origHTML = btnCopy.innerHTML;
            btnCopy.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981;"></i>';
            setTimeout(() => btnCopy.innerHTML = origHTML, 1500);
        }
    });

    btnDownload.addEventListener('click', () => {
        const text = sentenceTextEl.value;
        if (!text) return;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sign_language_transcript_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Modal Events
    btnInfoModal.addEventListener('click', () => chartModal.classList.add('active'));
    btnCloseModal.addEventListener('click', () => chartModal.classList.remove('active'));
    chartModal.addEventListener('click', (e) => {
        if (e.target === chartModal) chartModal.classList.remove('active');
    });

    // Start 150ms interval polling for real-time responsiveness
    setInterval(updateStatus, 150);
});
