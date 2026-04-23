import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, User, BarChart2 } from 'lucide-react';
import { useMicrophone } from './useMicrophone';
import { useSpeech } from './hooks/useSpeech';
import { transcribeAudio } from './groqApi';
import { summarizeText } from './geminiApi';
import { useAuth } from './AuthContext';
import { api } from './api';
import { Link } from 'react-router-dom';
import LandingPage from './LandingPage';
import { PromptInputBox } from './components/ui/ai-prompt-box';
import ParticleBackground from './ParticleBackground';
import { AnimatePresence } from 'framer-motion';
import SummaryCard from './components/app/SummaryCard';
import ThinkingBubble from './components/app/ThinkingBubble';
import UserBubble from './components/app/UserBubble';
import ErrorBubble from './components/app/ErrorBubble';
import './App.css';

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const { user, logout } = useAuth();

  const [messages, setMessages] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { speakingId, isSpeaking, toggleSpeech: handleSpeak } = useSpeech();
  const [burstCount, setBurstCount] = useState(0);
  const chatEndRef = useRef(null);
  const uid = useRef(0);
  const nextId = () => `msg-${++uid.current}`;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSummarizing]);

  // ── Summarize ───────────────────────────────────────────────────────────────
  const runSummarize = async (text, displayText, type = 'text') => {
    setBurstCount(c => c + 1); // scatter particles on every new message
    setMessages(prev => [...prev, { id: nextId(), kind: 'user', text: displayText || text, type }]);
    setIsSummarizing(true);
    try {
      const result = await summarizeText(text.trim());
      setMessages(prev => [...prev, { id: nextId(), kind: 'summary', text: result, saved: false, rawInput: text }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: nextId(), kind: 'error', text: `Error: ${err.message}` }]);
    } finally {
      setIsSummarizing(false);
    }
  };

  // ── Audio pipeline (NO correctText — avoids "Speech unclear" false positive) ─
  const processAudio = async (blob, label = '🎙️ Voice message') => {
    setBurstCount(c => c + 1); // scatter on audio input too
    const placeholderId = nextId();
    setMessages(prev => [...prev, { id: placeholderId, kind: 'user', text: `${label} — transcribing…`, type: 'audio' }]);
    setIsTranscribing(true);
    try {
      const transcript = await transcribeAudio(blob);
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: transcript } : m));
      setIsTranscribing(false);

      // Go straight to summarize — skip correctText to avoid false "Speech unclear" errors
      setIsSummarizing(true);
      try {
        const result = await summarizeText(transcript);
        setMessages(prev => [...prev, { id: nextId(), kind: 'summary', text: result, saved: false, rawInput: transcript }]);
      } catch (err) {
        setMessages(prev => [...prev, { id: nextId(), kind: 'error', text: `Summarization error: ${err.message}` }]);
      } finally {
        setIsSummarizing(false);
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === placeholderId ? { ...m, text: `Transcription failed: ${err.message}`, kind: 'error' } : m
      ));
      setIsTranscribing(false);
    }
  };

  // ── Microphone via useMicrophone ────────────────────────────────────────────
  const { isRecording, toggleRecording } = useMicrophone({
    onStopCallback: (blob) => processAudio(blob, '🎙️ Voice recording'),
    onLiveTranscript: () => { },   // no live transcript in chat mode
  });

  // ── Handle audio file from prompt box paperclip ─────────────────────────────
  const handleFileSelect = (file) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      setMessages(prev => [...prev, { id: nextId(), kind: 'error', text: 'Please upload an audio file (MP3, WAV, M4A…)' }]);
      return;
    }
    processAudio(file, `📎 ${file.name}`);
  };

  // ── Typed text send ─────────────────────────────────────────────────────────
  const handleSend = (text) => {
    if (!user) { window.location.href = '/login'; return; }
    const trimmed = text.trim();
    if (!trimmed || isSummarizing || isTranscribing) return;
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (words < 5) {
      setMessages(prev => [...prev, { id: nextId(), kind: 'error', text: '⚠️ Please enter at least a sentence to summarize (5+ words).' }]);
      return;
    }
    runSummarize(trimmed, trimmed, 'text');
  };

  // ── Save / reject / speak ───────────────────────────────────────────────────
  const handleSave = async (item) => {
    try { await api.saveSummary(item.rawInput || '', item.text); }
    catch (e) { console.error('Save failed', e); }
  };

  const handleReject = (id) => setMessages(prev => prev.filter(m => m.id !== id));



  // ── Gate ────────────────────────────────────────────────────────────────────
  if (!user) return <LandingPage />;

  const busy = isSummarizing || isTranscribing;

  return (
    <div className="min-h-screen bg-[#09090b]/80 text-zinc-100 font-sans flex flex-col selection:bg-indigo-500/30 relative">

      {/* Always-on particle swarm background — scatters on each input */}
      <ParticleBackground burstCount={burstCount} />

      {/* Topbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-zinc-800/60 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Summarizer
          </span>
        </div>
        {/* Nav links grouped on the right — wrapping in div keeps them together under justify-between */}
        <div className="flex items-center gap-2">
          <Link to="/stock"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/60"
          >
            <BarChart2 size={13} /> Stocks
          </Link>
          <Link to="/profile"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/60"
          >
            <User size={13} /> Profile
          </Link>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 App-custom-scrollbar relative z-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 min-h-full">

          {messages.length === 0 && !busy && (
            <div className="flex-1" />
          )}

          <AnimatePresence initial={false}>
            {messages.map(msg => {
              if (msg.kind === 'user') return <UserBubble key={msg.id} text={msg.text} type={msg.type} />;
              if (msg.kind === 'error') return <ErrorBubble key={msg.id} text={msg.text} onDismiss={() => handleReject(msg.id)} />;
              if (msg.kind === 'summary') return (
                <SummaryCard
                  key={msg.id}
                  item={msg}
                  onSave={handleSave}
                  onReject={handleReject}
                  onSpeak={handleSpeak}
                  isSpeaking={isSpeaking}
                  speakingId={speakingId}
                />
              );
              return null;
            })}
          </AnimatePresence>

          <AnimatePresence>
            {busy && <ThinkingBubble key="thinking" />}
          </AnimatePresence>

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Prompt box */}
      <div className="sticky bottom-0 z-20 bg-black/40 backdrop-blur-xl border-t border-zinc-800/40 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <PromptInputBox
            placeholder="Type to summarize, record audio, or upload a file…"
            isLoading={busy}
            onSend={handleSend}
            onMicClick={toggleRecording}
            isExternalRecording={isRecording}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
