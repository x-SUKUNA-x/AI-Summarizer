import { useState, useRef, useCallback, useEffect } from 'react';

export function useMicrophone({ onStopCallback, onLiveTranscript }) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recognitionRef = useRef(null);
    const streamRef = useRef(null);

    // Setup SpeechRecognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                // We combine whatever is finalized plus the current interim
                // This gives a nice smooth live text update
                const combined = finalTranscript + interimTranscript;
                if (onLiveTranscript) {
                    onLiveTranscript(combined);
                }
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("SpeechRecognition API not supported in this browser.");
        }
    }, [onLiveTranscript]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (onStopCallback) {
                    onStopCallback(audioBlob);
                }

                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.start();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.warn('SpeechRecognition might already be running', e);
                }
            }
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    }, [onStopCallback]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn('SpeechRecognition stop error', e);
            }
        }
        setIsRecording(false);
    }, []);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    return { isRecording, toggleRecording, startRecording, stopRecording };
}
