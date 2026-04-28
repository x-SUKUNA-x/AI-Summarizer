# AI Summarizer

A full-stack AI-powered web app for summarizing text and audio, with a live stock dashboard — built with React, Node.js, Supabase, Gemini, and Groq Whisper.

---

## Features

### AI Summarizer
- Paste any text and get a concise AI-generated summary (Gemini 2.5 Flash)
- Record your voice via microphone — transcribed by Groq Whisper, then summarized
- Upload an audio file (up to 25MB) for the same transcription + summary pipeline
- Live speech preview while recording (browser SpeechRecognition API)
- Text-to-speech playback for any summary
- Save, bookmark, and delete summaries from your profile

### Stock Dashboard *(integrated post-interview)*
- Search any US or Indian NSE ticker (e.g. `AAPL`, `TSLA`, `RELIANCE`, `TCS`)
- See real-time price, daily % change, and trading volume via Marketstack API
- AI-generated plain-English insight for every stock result (Gemini 2.5 Flash)
- Personal watchlist — save and track favourite tickers
- Recent searches chips for quick re-access
- 10-minute smart cache to preserve API quota

### Auth
- Secure signup and login with bcrypt password hashing
- JWT stored in HTTP-only cookie (XSS-safe)
- Session restored on page load without a database query
- All user data (summaries, watchlist) is private and scoped per account

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js + Express 5 |
| Database | Supabase (Postgres) |
| AI — Text | Gemini 2.5 Flash (Google) |
| AI — Audio | Whisper via Groq API |
| Stock Data | Marketstack API |
| Auth | JWT + bcrypt + HTTP-only cookies |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Project Structure

```
AI-Summarizer/
├── backend/
│   ├── index.js                  # Entry point — env validation, CORS, route mounting
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT verification for all protected routes
│   ├── db/
│   │   └── supabaseClient.js     # Single shared Supabase client
│   ├── routes/
│   │   ├── auth.js               # signup, login, me, logout
│   │   ├── summarize.js          # transcribe, correct, summarize
│   │   ├── summaries.js          # saved summaries CRUD
│   │   ├── stock.js              # stock data + AI insight (auth-protected, cached)
│   │   └── watchlist.js          # user watchlist CRUD
│   └── services/
│       └── aiService.js          # All AI logic — Gemini + Groq functions
│
└── frontend/
    └── src/
        ├── main.jsx              # App entry — AuthProvider + BrowserRouter
        ├── App.jsx               # Chat UI — summarizer, mic, file upload
        ├── AuthContext.jsx       # Global auth state + session restore
        ├── api.js                # Central fetch wrapper (credentials:include)
        ├── config.js             # API_BASE URL (single place for env switch)
        ├── geminiApi.js          # Direct Gemini calls from frontend
        ├── groqApi.js            # Direct Groq/Whisper calls from frontend
        ├── StockPage.jsx         # Stock dashboard UI
        ├── WatchlistPage.jsx     # Watchlist UI
        ├── Profile.jsx           # Saved summaries UI
        ├── useMicrophone.js      # MediaRecorder + SpeechRecognition hook
        └── hooks/
            └── useSpeech.js      # SpeechSynthesis (text-to-speech) hook
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- API keys for: Gemini, Groq, Marketstack

### Backend Setup

```bash
cd backend
npm install
```



### Frontend Setup

```bash
cd frontend
npm install
```



```bash
npm run dev
```

---



## Key Design Decisions

**HTTP-only cookie for JWT** — Cannot be read by JavaScript, protecting against XSS attacks. Requires `credentials: "include"` on every frontend fetch and `sameSite: "none"` + `secure: true` for cross-origin Vercel ↔ Render communication.

**10-minute stock cache** — Marketstack free tier allows 100 requests/month. The in-memory cache ensures repeated searches for the same ticker return instantly without consuming quota.

**AI fallback for stock insight** — If Gemini is unavailable, `analyzeStock()` builds the same 3-sentence explanation programmatically. The stock dashboard never fails because of an AI outage.

**Atomic signup** — Inserts directly and catches Postgres error code `23505` (unique violation) instead of SELECT-then-INSERT, which would have a race condition.

**Multer 25MB cap** — Matches Groq Whisper's own file size limit exactly, so oversized files are rejected early with a clean error before reaching the API.

---

## Deployment

### Backend (Render)
- Build command: `npm install`
- Start command: `node index.js`
- Add all backend `.env` variables in Render's environment settings

### Frontend (Vercel)
- Framework: Vite
- Add all frontend `.env` variables in Vercel's environment settings
- `vercel.json` is included for SPA routing

---

