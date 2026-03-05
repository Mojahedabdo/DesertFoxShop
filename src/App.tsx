import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileAudio, 
  TrendingUp, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  BarChart3,
  Quote,
  ThumbsUp,
  ThumbsDown,
  StickyNote,
  Clock,
  PenLine,
  Download,
  Share2,
  User,
  Briefcase
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeSalesCall, CallAnalysis, TranscriptSegment } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [notes, setNotes] = useState<string>('');
  const [duration, setDuration] = useState<string | null>(null);
  const [callTitle, setCallTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
      
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };

      setError(null);
    } else {
      setError("Please upload a valid audio file.");
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const base64 = await readFileAsBase64(file);
      const result = await analyzeSalesCall(base64, file.type);
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);
      
      let userMessage = "Failed to analyze the call. Please try again.";
      
      switch (err.message) {
        case "QUOTA_EXCEEDED":
          userMessage = "API quota exceeded. Please wait a moment before trying again or check your billing settings.";
          break;
        case "SAFETY_BLOCK":
          userMessage = "The audio content was flagged by safety filters. Please ensure the recording follows our community guidelines.";
          break;
        case "INVALID_FORMAT":
          userMessage = "The AI returned an invalid response format. This might be a temporary glitch; please try re-uploading.";
          break;
        case "EMPTY_RESPONSE":
          userMessage = "The AI returned an empty response. Please check if the audio file is clear and has audible speech.";
          break;
        default:
          if (err.message?.includes("fetch")) {
            userMessage = "Network error. Please check your internet connection and try again.";
          }
      }
      
      setError(userMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl(null);
    setAnalysis(null);
    setRatings({});
    setNotes('');
    setDuration(null);
    setCallTitle('');
    setError(null);
  };

  const handleExport = () => {
    if (!analysis) return;

    const exportData = {
      title: callTitle || file?.name || 'Untitled Call',
      date: new Date().toISOString(),
      duration,
      analysis,
      notes,
      ratings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.title.replace(/\s+/g, '_')}_analysis.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async (text: string, title: string) => {
    const shareData = {
      title: `Sales Call Insight: ${title}`,
      text: text,
      url: window.location.href
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          copyToClipboard(text);
        }
      }
    } else {
      copyToClipboard(text);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // We could add a toast here, but for now just a simple alert or silent success
      // Given the constraints, I'll just rely on the clipboard success
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  };

  const handleRate = (id: string, type: 'up' | 'down') => {
    setRatings(prev => ({
      ...prev,
      [id]: prev[id] === type ? undefined : type as any
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-zinc-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SalesCoach AI</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Intelligence Platform</p>
            </div>
          </div>
          {analysis && (
            <button 
              onClick={reset}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Upload New Call
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        <AnimatePresence mode="wait">
          {!analysis ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto mt-20"
            >
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold tracking-tight mb-4">Analyze your sales calls</h2>
                <p className="text-zinc-600 text-lg">Upload a recording to get a full transcript, sentiment analysis, and AI-powered coaching insights.</p>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all",
                  file ? "border-indigo-400 bg-indigo-50/50" : "border-zinc-300 hover:border-indigo-400 hover:bg-zinc-100/50"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="audio/*" 
                  className="hidden" 
                />
                
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                      <FileAudio size={32} />
                    </div>
                    <p className="font-semibold text-zinc-900">{file.name}</p>
                    <p className="text-sm text-zinc-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-2xl flex items-center justify-center mb-4">
                      <Upload size={32} />
                    </div>
                    <p className="font-semibold text-zinc-900">Click to upload or drag and drop</p>
                    <p className="text-sm text-zinc-500 mt-1">MP3, WAV, or M4A (Max 20MB)</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-5 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                      <AlertCircle size={18} className="text-rose-600" />
                    </div>
                    <p className="font-bold text-sm tracking-tight">Analysis Error</p>
                  </div>
                  <p className="text-sm leading-relaxed opacity-90 pl-11">
                    {error}
                  </p>
                  <div className="pl-11">
                    <button 
                      onClick={() => setError(null)}
                      className="text-xs font-bold uppercase tracking-widest text-rose-600 hover:text-rose-800 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <button
                disabled={!file || isAnalyzing}
                onClick={handleAnalyze}
                className={cn(
                  "w-full mt-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg",
                  file && !isAnalyzing 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200" 
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Analyzing Call...
                  </>
                ) : (
                  <>
                    Start Analysis
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Call Title Input */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                  <PenLine size={24} />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={callTitle}
                    onChange={(e) => setCallTitle(e.target.value)}
                    placeholder="Enter a title for this sales call (e.g., Q1 Review with Acme Corp)"
                    className="w-full text-2xl font-bold text-zinc-900 placeholder:text-zinc-300 focus:outline-none bg-transparent"
                  />
                  <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-bold">Call Title</p>
                </div>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200"
                >
                  <Download size={16} />
                  Export Data
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary & Coaching Card */}
              <div className="lg:col-span-1 space-y-8">
                {/* Audio Player */}
                {audioUrl && (
                  <section className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                      <FileAudio size={16} />
                      Call Recording
                    </h3>
                    <audio controls src={audioUrl} className="w-full" />
                    <p className="text-[10px] text-zinc-400 mt-2 text-center uppercase tracking-widest font-bold">
                      {file?.name}
                    </p>
                  </section>
                )}

                {/* Call Summary */}
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} />
                      Call Summary
                    </div>
                    <button 
                      onClick={() => handleShare(analysis.insights.summary, "Call Summary")}
                      className="p-1.5 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="Share Summary"
                    >
                      <Share2 size={14} />
                    </button>
                  </h3>
                  <p className="text-zinc-700 leading-relaxed italic">
                    "{analysis.insights.summary}"
                  </p>
                  <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase font-bold">Overall Sentiment</p>
                      <p className={cn(
                        "text-xl font-bold",
                        analysis.overallSentiment > 0 ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {(analysis.overallSentiment * 100).toFixed(0)}% Positive
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {duration && (
                        <div className="text-right">
                          <p className="text-xs text-zinc-400 uppercase font-bold">Duration</p>
                          <div className="flex items-center gap-1 text-zinc-600 font-bold">
                            <Clock size={14} />
                            {duration}
                          </div>
                        </div>
                      )}
                      <div className="w-12 h-12 rounded-full border-4 border-zinc-100 flex items-center justify-center">
                         <span className="text-lg font-bold">{analysis.transcript.length}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Coaching Card */}
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-6 flex items-center gap-2">
                    <Quote size={16} />
                    Coaching Card
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-emerald-600 font-bold flex items-center gap-2 mb-3">
                        <CheckCircle2 size={18} />
                        Strengths
                      </h4>
                      <ul className="space-y-3">
                        {analysis.insights.strengths.map((s, i) => {
                          const ratingId = `strength-${i}`;
                          const rating = ratings[ratingId];
                          return (
                            <li key={i} className="group text-sm text-zinc-700 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-start justify-between gap-3">
                              <span>{s}</span>
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleShare(s, "Strength")}
                                  className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="Share Insight"
                                >
                                  <Share2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleRate(ratingId, 'up')}
                                  className={cn(
                                    "p-1 rounded-md transition-colors",
                                    rating === 'up' ? "text-emerald-600 bg-emerald-100" : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50"
                                  )}
                                >
                                  <ThumbsUp size={14} />
                                </button>
                                <button 
                                  onClick={() => handleRate(ratingId, 'down')}
                                  className={cn(
                                    "p-1 rounded-md transition-colors",
                                    rating === 'down' ? "text-rose-600 bg-rose-100" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                                  )}
                                >
                                  <ThumbsDown size={14} />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-amber-600 font-bold flex items-center gap-2 mb-3">
                        <AlertCircle size={18} />
                        Opportunities
                      </h4>
                      <ul className="space-y-3">
                        {analysis.insights.opportunities.map((o, i) => {
                          const ratingId = `opportunity-${i}`;
                          const rating = ratings[ratingId];
                          return (
                            <li key={i} className="group text-sm text-zinc-700 bg-amber-50/50 p-3 rounded-xl border border-amber-100 flex items-start justify-between gap-3">
                              <span>{o}</span>
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleShare(o, "Opportunity")}
                                  className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="Share Insight"
                                >
                                  <Share2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleRate(ratingId, 'up')}
                                  className={cn(
                                    "p-1 rounded-md transition-colors",
                                    rating === 'up' ? "text-emerald-600 bg-emerald-100" : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50"
                                  )}
                                >
                                  <ThumbsUp size={14} />
                                </button>
                                <button 
                                  onClick={() => handleRate(ratingId, 'down')}
                                  className={cn(
                                    "p-1 rounded-md transition-colors",
                                    rating === 'down' ? "text-rose-600 bg-rose-100" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                                  )}
                                >
                                  <ThumbsDown size={14} />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Internal Notes */}
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                    <StickyNote size={16} />
                    Internal Notes
                  </h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your own observations or follow-up items here..."
                    className="w-full h-32 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  />
                  <p className="text-[10px] text-zinc-400 mt-2 text-right">
                    Notes are saved locally for this session.
                  </p>
                </section>
              </div>

              {/* Right Column: Sentiment Graph & Transcript */}
              <div className="lg:col-span-2 space-y-8">
                {/* Sentiment Graph */}
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-6 flex items-center gap-2">
                    <TrendingUp size={16} />
                    Engagement & Sentiment Graph
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={analysis.transcript}
                        onClick={(data) => {
                          if (data && data.activePayload && data.activePayload.length) {
                            const segment = data.activePayload[0].payload;
                            console.log("User clicked graph at:", segment.timestamp, "Content:", segment.text);
                          }
                        }}
                      >
                        <defs>
                          <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis 
                          dataKey="timestamp" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#a1a1aa' }}
                        />
                        <YAxis 
                          domain={[-1, 1]} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#a1a1aa' }}
                          ticks={[-1, 0, 1]}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 rounded-2xl shadow-xl border border-zinc-100">
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{data.timestamp}</p>
                                  <p className="text-sm font-bold text-zinc-900">
                                    Sentiment: <span className={cn(data.sentiment > 0 ? "text-emerald-600" : "text-rose-600")}>
                                      {(data.sentiment * 100).toFixed(0)}%
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 max-w-[200px]">
                                    "{data.text}"
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="sentiment" 
                          stroke="#4f46e5" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorSentiment)" 
                          activeDot={{ 
                            r: 6, 
                            stroke: '#fff', 
                            strokeWidth: 2,
                            onClick: (e, payload) => {
                              console.log("User interested in call segment at:", payload.payload.timestamp);
                            }
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Diarized Transcript */}
                <section className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-6 flex items-center gap-2">
                    <MessageSquare size={16} />
                    Diarized Transcript
                  </h3>
                  <div className="space-y-6 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                    {analysis.transcript.map((segment, i) => (
                      <div key={i} className={cn(
                        "flex flex-col gap-1",
                        segment.speaker === "Sales Representative" ? "items-start" : "items-end"
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full border",
                            segment.speaker === "Sales Representative" 
                              ? "bg-indigo-50 text-indigo-700 border-indigo-100" 
                              : "bg-zinc-50 text-zinc-700 border-zinc-200"
                          )}>
                            {segment.speaker === "Sales Representative" ? (
                              <Briefcase size={10} className="shrink-0" />
                            ) : (
                              <User size={10} className="shrink-0" />
                            )}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {segment.speaker}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono">{segment.timestamp}</span>
                        </div>
                        <div className={cn(
                          "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                          segment.speaker === "Sales Representative" 
                            ? "bg-zinc-50 text-zinc-800 rounded-tl-none border border-zinc-100" 
                            : "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100"
                        )}>
                          {segment.text}
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          segment.speaker === "Sales Representative" ? "justify-start" : "justify-end"
                        )}>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            segment.sentiment > 0.3 ? "bg-emerald-400" : segment.sentiment < -0.3 ? "bg-rose-400" : "bg-zinc-300"
                          )} />
                          <span className="text-[10px] text-zinc-400">
                            {segment.sentiment > 0.3 ? "Positive" : segment.sentiment < -0.3 ? "Negative" : "Neutral"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d4d4d8;
        }
      `}</style>
    </div>
  );
}
