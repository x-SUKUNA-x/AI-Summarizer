export const speakText = (text, onStart, onEnd) => {
    if (!window.speechSynthesis) return;

    // Always cancel ongoing speech before starting a new one
    window.speechSynthesis.cancel();

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd; // reset state on error too
    }

    window.speechSynthesis.speak(utterance);
};

export const stopSpeech = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};
