import { useState } from 'react';
import { speakText, stopSpeech } from '../speechUtils';

// ── useSpeech ─────────────────────────────────────────────────────────────────
// Supports two call signatures — no changes needed at call sites:
//   toggleSpeech(id, text)   — used in Profile.jsx
//   toggleSpeech(item)       — used in App.jsx (item has .id and .text)
export function useSpeech() {
    const [speakingId, setSpeakingId] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const toggleSpeech = (idOrItem, text) => {
        const id = typeof idOrItem === 'object' ? idOrItem.id : idOrItem;
        const content = typeof idOrItem === 'object' ? idOrItem.text : text;

        if (speakingId === id) {
            stopSpeech();
            setIsSpeaking(false);
            setSpeakingId(null);
        } else {
            stopSpeech();
            setSpeakingId(id);
            speakText(
                content,
                () => setIsSpeaking(true),
                () => { setIsSpeaking(false); setSpeakingId(null); }
            );
        }
    };

    return { speakingId, isSpeaking, toggleSpeech };
}
