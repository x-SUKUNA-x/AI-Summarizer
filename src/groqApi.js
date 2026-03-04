export async function transcribeAudio(audioBlob) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API key is required in .env');
    }

    const formData = new FormData();
    // Whisper on Groq expects a file with a name/extension
    const filename = audioBlob.name || 'audio.webm';
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
            // Omit Content-Type; standard behavior lets the browser set Content-Type with FormData boundary
        },
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
}
