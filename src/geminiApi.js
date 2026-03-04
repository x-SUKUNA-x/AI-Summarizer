export async function summarizeText(text) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Gemini API key is required in .env');
    }

    const prompt = `Please summarize the following text.\n\nText: "${text}"\n\nGive me a 3-bullet summary and 1 main action item.`;

    // Use Gemini 2.5 Flash via the standard REST API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Invalid response format from Gemini API.');
    }
}
