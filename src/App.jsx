import React, { useState, useRef } from 'react';
import { Mic, Upload, Send, StopCircle, FileText, CheckCircle2, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import { useMicrophone } from './useMicrophone';
import { transcribeAudio } from './groqApi';
import { summarizeText } from './geminiApi';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { Link, Navigate } from 'react-router-dom';
import { User } from 'lucide-react';
import './App.css';

function App() {
  const { user, session } = useAuth();
  const [textInput, setTextInput] = useState('');
  const [summary, setSummary] = useState('');

  if (session === undefined || (!user && session === null)) {
    // Basic catch if context hasn't loaded (authLoading exists in the provider but we destructure session/user)
    // Actually, let's just use user check because AuthProvider only renders children when loading=false!
    if (!user) {
      return <Navigate to="/signup" replace />;
    }
  }

  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processAudioPipeline = async (audioBlob, autoSummarize = false) => {
    try {
      setTranscriptError('');
      setIsTranscribing(true);
      const text = await transcribeAudio(audioBlob);
      setTranscript(text);

      const newText = textInput ? textInput + '\n' + text : text;
      setTextInput(newText);
      setIsTranscribing(false);

      if (autoSummarize) {
        setSummaryError('');
        setSummary('');
        setIsSummarizing(true);
        const generatedSummary = await summarizeText(newText);
        setSummary(generatedSummary);

        if (user) {
          await supabase.from('summaries').insert([
            { user_id: user.id, transcript: newText, summary: generatedSummary, is_bookmarked: false }
          ]);
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      setTranscriptError(`Error: ${error.message}`);
    } finally {
      setIsTranscribing(false);
      setIsSummarizing(false);
    }
  };

  const handleAudioStop = (audioBlob) => {
    processAudioPipeline(audioBlob, false);
  };

  const { isRecording, toggleRecording } = useMicrophone(handleAudioStop);

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    try {
      setSummaryError('');
      setSummary('');
      setIsSummarizing(true);

      const generatedSummary = await summarizeText(textInput);
      setSummary(generatedSummary);

      if (user) {
        await supabase.from('summaries').insert([
          { user_id: user.id, transcript: textInput, summary: generatedSummary, is_bookmarked: false }
        ]);
      }

    } catch (error) {
      console.error('Summarization error:', error);
      setSummaryError(`Error: ${error.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      setTranscriptError("Error: Valid audio file required (MP3, WAV, M4A, etc.)");
      return;
    }
    setTranscript('');
    setTranscriptError('');
    processAudioPipeline(file, true);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30 overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col h-full md:h-[calc(100vh-4rem)]">

        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Summarizer
            </h1>
            <p className="text-zinc-400 mt-2">Upload, speak, or type to get instant, concise summaries.</p>
          </div>
          <div className="flex items-center gap-4 border border-zinc-800 bg-zinc-900/50 rounded-xl px-4 py-2">
            {user ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors text-sm font-medium">
                  <User size={16} />
                  Profile
                </Link>
                <div className="w-px h-4 bg-zinc-700"></div>
                <button onClick={() => supabase.auth.signOut()} className="text-zinc-400 hover:text-rose-400 transition-colors text-sm font-medium">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-zinc-300 hover:text-white transition-colors text-sm font-medium">Log in</Link>
                <Link to="/signup" className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Sign up</Link>
              </>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden md:min-h-0 min-h-[800px]">

          {/* Left Panel: Inputs */}
          <div className="flex flex-col gap-6 overflow-y-auto pr-2 pb-4 App-custom-scrollbar">

            {/* Record & Upload Buttons Row */}
            <div className="grid grid-cols-2 gap-4 shrink-0">

              {/* Record Button Card */}
              <button
                onClick={toggleRecording}
                className={`group flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden ${isRecording
                  ? 'border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-emerald-500/50 hover:bg-zinc-800/80 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]'
                  }`}
              >
                {isRecording && (
                  <span className="absolute inset-0 bg-rose-500/5 animate-pulse rounded-3xl pointer-events-none"></span>
                )}
                <div className={`p-4 rounded-full mb-4 shadow-lg transition-transform duration-300 ${isRecording
                  ? 'bg-rose-500 text-white scale-110 shadow-rose-500/25 animate-pulse'
                  : 'bg-zinc-800 text-zinc-300 group-hover:bg-emerald-500 group-hover:text-white group-hover:-translate-y-1'
                  }`}>
                  {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
                </div>
                <span className={`font-medium text-lg ${isRecording ? 'text-rose-400' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
                  {isRecording ? 'Stop Recording' : 'Record Audio'}
                </span>
                <span className={`text-sm mt-1 sm:block hidden ${isRecording ? 'text-rose-500/70 font-semibold' : 'text-zinc-500'}`}>
                  {isRecording ? 'Recording in progress...' : 'Click to start'}
                </span>
              </button>

              {/* Upload Button Card */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden ${isDragging
                  ? 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-purple-500/50 hover:bg-zinc-800/80 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]'
                  }`}
              >
                {isDragging && (
                  <span className="absolute inset-0 bg-purple-500/5 animate-pulse rounded-3xl pointer-events-none"></span>
                )}
                <div className={`p-4 rounded-full mb-4 shadow-lg transition-transform duration-300 ${isDragging
                  ? 'bg-purple-500 text-white scale-110 shadow-purple-500/25 animate-pulse'
                  : 'bg-zinc-800 text-zinc-300 group-hover:-translate-y-1 group-hover:bg-purple-500 group-hover:text-white'
                  }`}>
                  <Upload size={32} />
                </div>
                <span className={`font-medium text-lg ${isDragging ? 'text-purple-400' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
                  {isDragging ? 'Drop audio here' : 'Upload File'}
                </span>
                <span className={`text-sm mt-1 sm:block hidden ${isDragging ? 'text-purple-500/70 font-semibold' : 'text-zinc-500'}`}>
                  MP3, WAV, M4A
                </span>
              </button>
            </div>

            {/* Transcript Section (Dynamic) */}
            {(transcript || isTranscribing || transcriptError) && (
              <div className="shrink-0 flex flex-col bg-zinc-900/60 rounded-3xl border border-zinc-800/80 overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-4">
                <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-300">Audio Transcript</span>
                  </div>
                  {isTranscribing && (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                      <span>Transcribing via Groq...</span>
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                  )}
                </div>
                <div className="p-4 bg-zinc-950/30 max-h-[200px] overflow-y-auto App-custom-scrollbar">
                  {transcriptError ? (
                    <div className="text-rose-400 text-sm leading-relaxed font-mono whitespace-pre-wrap">{transcriptError}</div>
                  ) : isTranscribing && !transcript ? (
                    <div className="flex items-center gap-3 text-zinc-500 italic text-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Listening and processing audio using Whisper Large v3...
                    </div>
                  ) : (
                    <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {transcript}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chat/Text Input Section */}
            <div className="flex-1 flex flex-col relative min-h-[200px]">
              <form onSubmit={handleTextSubmit} className="flex-1 flex flex-col h-full bg-zinc-900/40 rounded-3xl border border-zinc-800 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-lg group">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste or edit transcribed text here to summarize..."
                  className="w-full flex-1 bg-transparent p-6 text-zinc-200 resize-none outline-none placeholder:text-zinc-600 focus:ring-0 App-custom-scrollbar"
                />
                <div className="px-4 py-3 bg-zinc-900/80 flex justify-between items-center border-t border-zinc-800/80 backdrop-blur-md">
                  <div className="text-xs text-zinc-500 hidden sm:flex items-center gap-1.5 ">
                    <CheckCircle2 size={14} className="text-indigo-500/70" />
                    <span>Gemini 2.5 Flash Support</span>
                  </div>
                  {user ? (
                    <button
                      disabled={!textInput.trim() || isSummarizing}
                      type="submit"
                      className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none translate-y-0 hover:-translate-y-[1px] active:translate-y-[1px] ml-auto"
                    >
                      {isSummarizing ? (
                        <>
                          <span>Summarizing...</span>
                          <Loader2 size={16} className="animate-spin mb-[1px]" />
                        </>
                      ) : (
                        <>
                          <span>Summarize</span>
                          <Send size={16} className="mb-[1px]" />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link to="/login" className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg ml-auto">
                      Log in to Summarize
                    </Link>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Panel: Summary */}
          <div className="h-full relative flex flex-col min-h-[400px]">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl border border-zinc-800/80 shadow-2xl backdrop-blur-3xl overflow-hidden flex flex-col">

              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-black/20 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-inner shadow-white/10 relative">
                    {isSummarizing && (
                      <span className="absolute inset-0 rounded-xl bg-white/20 animate-pulse"></span>
                    )}
                    <Sparkles size={18} className="text-white relative z-10" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-100">Summary Result</h2>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto App-custom-scrollbar z-10 relative">
                {summaryError ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm whitespace-pre-wrap">
                    {summaryError}
                  </div>
                ) : isSummarizing ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-6">
                    <Loader2 size={40} className="text-indigo-500 animate-spin" />
                    <p className="text-center font-medium max-w-[250px] animate-pulse">
                      Analyzing text with Gemini 2.5 Flash...
                    </p>
                  </div>
                ) : summary ? (
                  <div className="text-zinc-300 leading-relaxed text-base md:text-lg animate-in fade-in slide-in-from-bottom-4 duration-500 whitespace-pre-wrap markdown-body">
                    {summary}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
                    <div className="p-6 rounded-full bg-zinc-900/50 border border-zinc-800/50 border-dashed">
                      <FileText size={48} className="text-zinc-700/50" />
                    </div>
                    <p className="text-center font-medium max-w-[250px] text-zinc-500">
                      Your summary will appear here once generated.
                    </p>
                  </div>
                )}
              </div>

              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl opacity-50 translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
