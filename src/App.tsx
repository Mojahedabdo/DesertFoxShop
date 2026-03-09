import React, { useState, useRef, useEffect } from 'react';
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
  User as UserIcon,
  Briefcase,
  Plus,
  Settings2,
  Trash2,
  Mail,
  Send,
  Pencil,
  LogOut,
  History,
  Search,
  LayoutDashboard,
  LogIn,
  Mic,
  MicOff,
  Radio,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ExternalLink,
  Star
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
import { 
  analyzeSalesCall, 
  CallAnalysis, 
  TranscriptSegment,
  connectLiveCoaching
} from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  auth, 
  db, 
  storage,
  googleProvider, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CoachingTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

const DEFAULT_TEMPLATES: CoachingTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Sales Coaching',
    description: 'General feedback on discovery, objection handling, and closing.',
    instructions: 'Focus on general sales best practices: effective discovery questions, active listening, handling objections professionally, and clear next steps.'
  },
  {
    id: 'discovery',
    name: 'Discovery Deep Dive',
    description: 'Focus on identifying pain points and qualifying leads.',
    instructions: 'Focus heavily on the discovery phase. Did the rep ask open-ended questions? Did they identify the "pain"? Did they qualify the budget and authority?'
  },
  {
    id: 'closing',
    name: 'Closing & Negotiation',
    description: 'Focus on the final stages of the deal and handling pushback.',
    instructions: 'Focus on the closing techniques. How did the rep handle price objections? Was the call to action clear? Did they create urgency?'
  }
];

interface AppUser extends User {
  role: 'sales_rep' | 'manager' | 'admin';
}

function AudioPlayer({ 
  src, 
  onTimeUpdate, 
  seekTo 
}: { 
  src: string; 
  onTimeUpdate?: (time: number) => void;
  seekTo?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current && seekTo !== null && seekTo !== undefined) {
      audioRef.current.currentTime = seekTo;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [seekTo]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-3xl p-6 text-white shadow-2xl">
      <audio 
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <button 
              onClick={() => { if(audioRef.current) audioRef.current.currentTime = 0; }}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <RotateCcw size={20} />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
                if (v > 0) setIsMuted(false);
              }}
              className="w-20 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <input 
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveCoachingController({ onTip }: { onTip: (tip: string) => void }) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const playNextInQueue = async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) return;

    isPlayingRef.current = true;
    const base64 = audioQueueRef.current.shift()!;
    
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      // Live API sends Int16 PCM at 24kHz
      const pcm = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768;

      const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        playNextInQueue();
      };
      source.start();
    } catch (err) {
      console.error("Audio playback error", err);
      isPlayingRef.current = false;
      playNextInQueue();
    }
  };

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Using ScriptProcessor for simplicity in this environment
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const session = await connectLiveCoaching({
        onTranscript: (text, speaker, sentiment) => {
          console.log("Transcript:", text, speaker, sentiment);
        },
        onCoachingTip: (tip) => {
          onTip(tip);
        },
        onAudioData: (base64) => {
          audioQueueRef.current.push(base64);
          playNextInQueue();
        },
        onError: (err) => {
          if (err?.name === 'AbortError') return;
          console.error("Live session error", err);
          stopSession();
        },
        onClose: () => {
          setIsActive(false);
          stopSession();
        },
      });

      sessionRef.current = session;

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        session.sendRealtimeInput({ 
          media: { 
            data: base64Data, 
            mimeType: 'audio/pcm;rate=16000' 
          } 
        });
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      setIsActive(true);
    } catch (err) {
      console.error("Failed to start live session", err);
      alert("Could not access microphone. Please check permissions.");
    } finally {
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {isActive && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 0.2 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="absolute inset-0 bg-red-500 rounded-full"
          />
        )}
        <button 
          onClick={isActive ? stopSession : startSession}
          disabled={isConnecting}
          className={cn(
            "relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl",
            isActive 
              ? "bg-red-500 hover:bg-red-600" 
              : "bg-indigo-600 hover:bg-indigo-700 hover:scale-105",
            isConnecting && "opacity-50 cursor-not-allowed"
          )}
        >
          {isConnecting ? (
            <Loader2 className="text-white animate-spin" size={32} />
          ) : isActive ? (
            <MicOff size={32} className="text-white" />
          ) : (
            <Mic size={32} className="text-white" />
          )}
        </button>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-zinc-900">
          {isActive ? "Coach is Listening" : "Live Coaching"}
        </h3>
        <p className="text-zinc-500 text-sm max-w-[200px] mx-auto leading-relaxed">
          {isActive 
            ? "Gemini is analyzing your speech and will provide tips shortly." 
            : "Connect your microphone to get real-time sales advice."}
        </p>
      </div>

      {isActive && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              animate={{ height: [8, 16, 8] }}
              transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
              className="w-1 bg-indigo-600 rounded-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'dashboard' | 'history' | 'analysis' | 'live' | 'manager'>('dashboard');
  const [liveTips, setLiveTips] = useState<{id: string, text: string, timestamp: string}[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedTeamUser, setSelectedTeamUser] = useState<any | null>(null);
  const [teamUserHistory, setTeamUserHistory] = useState<any[]>([]);
  
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [notes, setNotes] = useState<string>('');
  const [duration, setDuration] = useState<string | null>(null);
  const [callTitle, setCallTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [isEmailing, setIsEmailing] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [accuracyRating, setAccuracyRating] = useState<number>(0);
  const [usefulnessRating, setUsefulnessRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);
  const [templates, setTemplates] = useState<CoachingTemplate[]>(() => {
    const saved = localStorage.getItem('salescoach_templates');
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('standard');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', instructions: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredHistory = callHistory.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const inTitle = call.title?.toLowerCase().includes(query);
    const inSummary = call.insights?.summary?.toLowerCase().includes(query);
    const inStrengths = call.insights?.strengths?.some((s: string) => s.toLowerCase().includes(query));
    const inOpportunities = call.insights?.opportunities?.some((o: string) => o.toLowerCase().includes(query));
    const inTranscript = call.transcript?.some((t: any) => t.text.toLowerCase().includes(query));
    const inNotes = call.notes?.toLowerCase().includes(query);
    
    return inTitle || inSummary || inStrengths || inOpportunities || inTranscript || inNotes;
  });

  const filteredTeamHistory = teamUserHistory.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const inTitle = call.title?.toLowerCase().includes(query);
    const inSummary = call.insights?.summary?.toLowerCase().includes(query);
    const inStrengths = call.insights?.strengths?.some((s: string) => s.toLowerCase().includes(query));
    const inOpportunities = call.insights?.opportunities?.some((o: string) => o.toLowerCase().includes(query));
    const inTranscript = call.transcript?.some((t: any) => t.text.toLowerCase().includes(query));
    const inNotes = call.notes?.toLowerCase().includes(query);
    
    return inTitle || inSummary || inStrengths || inOpportunities || inTranscript || inNotes;
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Sync user to Firestore and get role
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          let role: 'sales_rep' | 'manager' | 'admin' = 'sales_rep';
          
          if (userDoc.exists()) {
            role = userDoc.data().role || 'sales_rep';
          } else {
            // Default admin check
            if (currentUser.email === "mojahedabdo1996@gmail.com") {
              role = 'admin';
            }
          }

          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            role,
            createdAt: Timestamp.now()
          }, { merge: true });

          setUser({ ...currentUser, role } as AppUser);
        } catch (err) {
          console.error("Auth sync error:", err);
          // Fallback for initial login if getDoc fails due to rules
          setUser({ ...currentUser, role: 'sales_rep' } as AppUser);
        }
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync Templates from Firestore
  useEffect(() => {
    if (!user) {
      setTemplates(DEFAULT_TEMPLATES);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'templates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customTemplates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoachingTemplate[];
      setTemplates([...DEFAULT_TEMPLATES, ...customTemplates]);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/templates`);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync All Users (for Managers/Admins)
  useEffect(() => {
    if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
      setAllUsers([]);
      return;
    }

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUsers(users);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Selected Team User History
  useEffect(() => {
    if (!user || !selectedTeamUser || (user.role !== 'manager' && user.role !== 'admin')) {
      setTeamUserHistory([]);
      return;
    }

    const q = query(
      collection(db, 'users', selectedTeamUser.id, 'calls'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: (doc.data().date as Timestamp).toDate().toISOString()
      }));
      setTeamUserHistory(history);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${selectedTeamUser.id}/calls`);
    });

    return () => unsubscribe();
  }, [user, selectedTeamUser]);

  // Sync Call History from Firestore
  useEffect(() => {
    if (!user) {
      setCallHistory([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'calls'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: (doc.data().date as Timestamp).toDate().toISOString()
      }));
      setCallHistory(history);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/calls`);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('dashboard');
      setAnalysis(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const saveTemplates = async (newTemplates: CoachingTemplate[]) => {
    // This is now handled by onSnapshot for custom templates
    // Local storage fallback for non-auth users
    if (!user) {
      setTemplates(newTemplates);
      localStorage.setItem('salescoach_templates', JSON.stringify(newTemplates));
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.instructions) return;
    
    if (user) {
      try {
        if (editingTemplateId) {
          const templateRef = doc(db, 'users', user.uid, 'templates', editingTemplateId);
          await setDoc(templateRef, {
            ...newTemplate,
            userId: user.uid
          }, { merge: true });
          setEditingTemplateId(null);
        } else {
          const templatesRef = collection(db, 'users', user.uid, 'templates');
          await addDoc(templatesRef, {
            ...newTemplate,
            userId: user.uid
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/templates`);
      }
    } else {
      // Local storage logic
      if (editingTemplateId) {
        const updatedTemplates = templates.map(t => 
          t.id === editingTemplateId ? { ...t, ...newTemplate } : t
        );
        saveTemplates(updatedTemplates);
        setEditingTemplateId(null);
      } else {
        const template: CoachingTemplate = {
          id: Date.now().toString(),
          ...newTemplate
        };
        saveTemplates([...templates, template]);
        setSelectedTemplateId(template.id);
      }
    }
    
    setNewTemplate({ name: '', description: '', instructions: '' });
    setIsAddingTemplate(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (DEFAULT_TEMPLATES.find(t => t.id === id)) return;
    
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'templates', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/templates/${id}`);
      }
    } else {
      const filtered = templates.filter(t => t.id !== id);
      saveTemplates(filtered);
    }
    
    if (selectedTemplateId === id) setSelectedTemplateId('standard');
  };

  const handleEditTemplate = (template: CoachingTemplate) => {
    setNewTemplate({
      name: template.name,
      description: template.description,
      instructions: template.instructions
    });
    setEditingTemplateId(template.id);
    setIsAddingTemplate(true);
  };

  const cancelTemplateEdit = () => {
    setNewTemplate({ name: '', description: '', instructions: '' });
    setEditingTemplateId(null);
    setIsAddingTemplate(false);
  };

  const parseTimestamp = (timestamp: string) => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const handleSeekToSegment = (timestamp: string) => {
    const seconds = parseTimestamp(timestamp);
    setSeekToTime(seconds);
    // Reset seekToTime after a short delay so it can be triggered again for the same timestamp
    setTimeout(() => setSeekToTime(null), 100);
  };

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
      let downloadUrl = audioUrl;
      
      // 1. Upload file to Firebase Storage if logged in
      if (user) {
        try {
          const storageRef = ref(storage, `calls/${user.uid}/${Date.now()}_${file.name}`);
          const uploadResult = await uploadBytes(storageRef, file);
          downloadUrl = await getDownloadURL(uploadResult.ref);
          setAudioUrl(downloadUrl);
        } catch (err) {
          console.error("Failed to upload audio to storage", err);
          // Continue with local URL for analysis if upload fails
        }
      }

      const base64 = await readFileAsBase64(file);
      const template = templates.find(t => t.id === selectedTemplateId);
      const result = await analyzeSalesCall(base64, file.type, template?.instructions);
      setAnalysis(result);
      setAccuracyRating(0);
      setUsefulnessRating(0);
      setFeedbackComment('');
      setFeedbackSubmitted(false);
      setView('analysis');

      // 2. Save to history if logged in
      if (user) {
        try {
          const callsRef = collection(db, 'users', user.uid, 'calls');
          await addDoc(callsRef, {
            userId: user.uid,
            title: callTitle || file.name,
            date: Timestamp.now(),
            duration: duration || '0:00',
            overallSentiment: result.overallSentiment,
            insights: result.insights,
            transcript: result.transcript,
            notes: '',
            ratings: {},
            templateId: selectedTemplateId,
            audioUrl: downloadUrl // Store the cloud URL
          });
        } catch (err) {
          console.error("Failed to save call to history", err);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
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

  const handleEmailReport = async () => {
    if (!analysis || !emailAddress) return;
    
    setIsEmailing(true);
    setEmailStatus(null);

    const exportData = {
      title: callTitle || file?.name || 'Untitled Call',
      date: new Date().toISOString(),
      duration,
      analysis,
      notes,
      ratings
    };

    try {
      const response = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddress,
          data: exportData,
          title: exportData.title
        })
      });

      const result = await response.json();

      if (response.ok) {
        setEmailStatus({ type: 'success', message: 'Email sent successfully!' });
        setShowEmailInput(false);
        setEmailAddress('');
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setEmailStatus({ type: 'error', message: err.message });
    } finally {
      setIsEmailing(false);
    }
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

  const handleConvertToTemplate = (feedback: string) => {
    setNewTemplate({
      name: `قالب: ${feedback.slice(0, 30)}...`,
      description: `قالب مخصص بناءً على ملاحظة: ${feedback.slice(0, 50)}...`,
      instructions: `ركز على هذه الملاحظة المحددة: ${feedback}`
    });
    setIsAddingTemplate(true);
    setEditingTemplateId(null);
    setView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // We could add a toast here, but for now just a simple alert or silent success
      // Given the constraints, I'll just rely on the clipboard success
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  };

  const handleRate = async (id: string, type: 'up' | 'down') => {
    const newRatings = { ...ratings, [id]: ratings[id] === type ? undefined : type };
    setRatings(newRatings as any);

    // Persist rating to Firestore if in history view/analysis
    if (user && analysis && (analysis as any).id) {
      try {
        const callRef = doc(db, 'users', user.uid, 'calls', (analysis as any).id);
        await updateDoc(callRef, { ratings: newRatings });
      } catch (err) {
        console.error("Failed to update ratings", err);
      }
    }
  };

  const handleNotesChange = async (val: string) => {
    setNotes(val);
    // Persist notes to Firestore
    if (user && analysis && (analysis as any).id) {
      try {
        const callRef = doc(db, 'users', user.uid, 'calls', (analysis as any).id);
        await updateDoc(callRef, { notes: val });
      } catch (err) {
        console.error("Failed to update notes", err);
      }
    }
  };

  const loadFromHistory = (call: any) => {
    setAnalysis(call);
    setCallTitle(call.title);
    setDuration(call.duration);
    setAudioUrl(call.audioUrl || null);
    setNotes(call.notes || '');
    setRatings(call.ratings || {});
    setAccuracyRating(call.feedback?.accuracy || 0);
    setUsefulnessRating(call.feedback?.usefulness || 0);
    setFeedbackComment(call.feedback?.comment || '');
    setFeedbackSubmitted(!!call.feedback);
    setView('analysis');
  };

  const handleFeedbackSubmit = async () => {
    if (!user || !analysis || !(analysis as any).id) return;
    
    setIsSubmittingFeedback(true);
    try {
      const callRef = doc(db, 'users', user.uid, 'calls', (analysis as any).id);
      await updateDoc(callRef, {
        feedback: {
          accuracy: accuracyRating,
          usefulness: usefulnessRating,
          comment: feedbackComment,
          submittedAt: new Date().toISOString()
        }
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error("Failed to submit feedback", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const deleteFromHistory = async (e: React.MouseEvent, callId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'calls', callId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/calls/${callId}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => { setView('dashboard'); setAnalysis(null); }}
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <TrendingUp className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-900">SALES<span className="text-indigo-600">COACH</span></h1>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">AI Intelligence</p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value && view !== 'history') setView('history');
                }}
                placeholder="Search calls, transcripts, insights..."
                className="w-full pl-12 pr-4 py-2.5 bg-zinc-100 border border-transparent rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user ? (
              <>
                <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-full pr-4">
                  <button 
                    onClick={() => setView('dashboard')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                      view === 'dashboard' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <LayoutDashboard size={16} />
                    Analyze
                  </button>
                  <button 
                    onClick={() => setView('history')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                      view === 'history' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    <History size={16} />
                    History
                  </button>
                  {(user.role === 'manager' || user.role === 'admin') && (
                    <button 
                      onClick={() => setView('manager')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                        view === 'manager' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                      )}
                    >
                      <BarChart3 size={16} />
                      Team
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-bold text-zinc-900">{user.displayName}</p>
                      <p className="text-[10px] text-zinc-400 font-medium">{user.email}</p>
                    </div>
                    <img src={user.photoURL || ''} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-zinc-400 hover:text-rose-600 transition-colors"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <LogIn size={16} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'manager' && (
            <motion.div
              key="manager"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-zinc-900">Team Management</h2>
                  <p className="text-zinc-500 font-medium">Monitor team performance and call history</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User List */}
                <div className="lg:col-span-1 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Team Members</h3>
                  <div className="space-y-2">
                    {allUsers.map(teamUser => (
                      <button
                        key={teamUser.id}
                        onClick={() => setSelectedTeamUser(teamUser)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group",
                          selectedTeamUser?.id === teamUser.id 
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-200" 
                            : "bg-white border-zinc-200 text-zinc-900 hover:border-indigo-300"
                        )}
                      >
                        <img src={teamUser.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-white/20" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{teamUser.displayName}</p>
                          <p className={cn(
                            "text-[10px] font-bold uppercase tracking-widest truncate opacity-60",
                            selectedTeamUser?.id === teamUser.id ? "text-white" : "text-zinc-400"
                          )}>
                            {teamUser.role}
                          </p>
                        </div>
                        {user?.role === 'admin' && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <select 
                              value={teamUser.role}
                              onChange={async (e) => {
                                const newRole = e.target.value;
                                try {
                                  await updateDoc(doc(db, 'users', teamUser.id), { role: newRole });
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.UPDATE, `users/${teamUser.id}`);
                                }
                              }}
                              className={cn(
                                "text-[10px] font-bold bg-transparent border-none focus:ring-0 cursor-pointer rounded-lg",
                                selectedTeamUser?.id === teamUser.id 
                                  ? "text-white bg-indigo-500/50 hover:bg-indigo-500" 
                                  : "text-zinc-500 bg-zinc-100 hover:bg-zinc-200"
                              )}
                            >
                              <option value="sales_rep">Rep</option>
                              <option value="manager">Mgr</option>
                              <option value="admin">Adm</option>
                            </select>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected User History */}
                <div className="lg:col-span-2 space-y-4">
                  {selectedTeamUser ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                          {selectedTeamUser.displayName}'s History
                        </h3>
                        <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
                          {teamUserHistory.length} Calls
                        </span>
                      </div>
                      
                      <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/50">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Title</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Duration</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Sentiment</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Recording</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {filteredTeamHistory.length > 0 ? (
                              filteredTeamHistory.map((call) => (
                                <tr 
                                  key={call.id}
                                  onClick={() => {
                                    setAnalysis(call as any);
                                    setAudioUrl(call.audioUrl || null);
                                    setDuration(call.duration);
                                    setCallTitle(call.title);
                                    setNotes(call.notes || '');
                                    setRatings(call.ratings || {});
                                    setView('analysis');
                                  }}
                                  className="hover:bg-zinc-50/50 transition-colors cursor-pointer group"
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                        <FileAudio size={16} />
                                      </div>
                                      <span className="font-bold text-zinc-900 truncate max-w-[200px]">{call.title}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500">
                                      <Clock size={14} className="text-zinc-400" />
                                      {call.duration}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium text-zinc-500">
                                    {new Date(call.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                      call.overallSentiment > 0.5 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                      {(call.overallSentiment * 100).toFixed(0)}% Pos
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {call.audioUrl ? (
                                      <a 
                                        href={call.audioUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-all"
                                      >
                                        <ExternalLink size={12} />
                                        <span>Listen</span>
                                      </a>
                                    ) : (
                                      <span className="text-xs font-bold text-zinc-300 italic">No Audio</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <ChevronRight size={16} className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center">
                                  <p className="text-zinc-400 font-bold">
                                    {teamUserHistory.length > 0 ? `No calls matching "${searchQuery}" for this user.` : "No calls found for this user."}
                                  </p>
                                  {teamUserHistory.length > 0 && (
                                    <button 
                                      onClick={() => setSearchQuery('')}
                                      className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                    >
                                      Clear Search
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white border border-dashed border-zinc-300 rounded-3xl">
                      <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4">
                        <UserIcon className="text-zinc-300" size={32} />
                      </div>
                      <h4 className="text-lg font-bold text-zinc-900 mb-1">Select a Team Member</h4>
                      <p className="text-sm text-zinc-400 max-w-xs">Choose a member from the list to view their sales performance and call history.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-zinc-900">Call History</h2>
                  <p className="text-zinc-500 mt-1 font-medium">Review your past sales call analyses and coaching insights.</p>
                </div>
                {user && (
                  <div className="bg-white px-4 py-2 rounded-2xl border border-zinc-200 shadow-sm">
                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest mr-2">Total Calls:</span>
                    <span className="text-xl font-black text-indigo-600">{callHistory.length}</span>
                  </div>
                )}
              </div>

              {!user ? (
                <div className="bg-white rounded-[40px] p-20 border border-zinc-200 text-center shadow-sm">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <LogIn size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900 mb-2">Sign in to view history</h3>
                  <p className="text-zinc-500 max-w-sm mx-auto mb-8">
                    Your call history is securely stored in your account. Sign in to access your recordings and insights from anywhere.
                  </p>
                  <button 
                    onClick={handleLogin}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 mx-auto"
                  >
                    <LogIn size={20} />
                    Sign In with Google
                  </button>
                </div>
              ) : callHistory.length === 0 ? (
                <div className="bg-white rounded-[40px] p-20 border border-zinc-200 text-center">
                  <div className="w-20 h-20 bg-zinc-50 text-zinc-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <History size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">No calls analyzed yet</h3>
                  <p className="text-zinc-500 mt-2 max-w-md mx-auto">Upload your first sales call recording to start building your coaching history.</p>
                  <button 
                    onClick={() => setView('dashboard')}
                    className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Analyze New Call
                  </button>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="bg-white rounded-[40px] p-20 border border-zinc-200 text-center">
                  <div className="w-20 h-20 bg-zinc-50 text-zinc-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Search size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">No matches found</h3>
                  <p className="text-zinc-500 mt-2 max-w-md mx-auto">We couldn't find any calls matching "{searchQuery}". Try a different keyword.</p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/50">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Title</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Duration</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Sentiment</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Recording</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {filteredHistory.map((call) => (
                        <tr 
                          key={call.id}
                          onClick={() => loadFromHistory(call)}
                          className="hover:bg-zinc-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                <FileAudio size={16} />
                              </div>
                              <span className="font-bold text-zinc-900 truncate max-w-[200px]">{call.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500">
                              <Clock size={14} className="text-zinc-400" />
                              {call.duration}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-zinc-500">
                            {new Date(call.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                call.overallSentiment > 0 ? "bg-emerald-500" : "bg-amber-500"
                              )} />
                              <span className="text-xs font-bold text-zinc-600">
                                {(call.overallSentiment * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {call.audioUrl ? (
                              <a 
                                href={call.audioUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-all"
                              >
                                <ExternalLink size={12} />
                                <span>Listen</span>
                              </a>
                            ) : (
                              <span className="text-xs font-bold text-zinc-300 italic">No Audio</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={(e) => deleteFromHistory(e, call.id)}
                                className="p-2 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Record"
                              >
                                <Trash2 size={16} />
                              </button>
                              <ChevronRight size={16} className="text-zinc-300 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {view === 'dashboard' && !analysis && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-12">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest mb-6"
                >
                  <BarChart3 size={14} />
                  Intelligence Suite v2.0
                </motion.div>
                <h2 className="text-5xl font-black tracking-tighter text-zinc-900 mb-4">
                  Coach your sales team <br />
                  <span className="text-indigo-600">with AI precision.</span>
                </h2>
                <p className="text-lg text-zinc-500 font-medium max-w-xl mx-auto">
                  Upload any sales call recording and get instant, actionable feedback on discovery, objection handling, and closing.
                </p>
                
                {!user && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-white rounded-3xl border border-zinc-200 shadow-sm inline-block"
                  >
                    <p className="text-sm text-zinc-600 mb-4 font-medium">Sign in to save your history and access custom templates.</p>
                    <button 
                      onClick={handleLogin}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all"
                    >
                      <LogIn size={18} />
                      Sign In with Google
                    </button>
                  </motion.div>
                )}
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
                  <div className="flex flex-col items-center w-full max-w-md">
                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                      <FileAudio size={32} />
                    </div>
                    <p className="font-semibold text-zinc-900 mb-1">{file.name}</p>
                    <p className="text-sm text-zinc-500 mb-6">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    
                    {audioUrl && (
                      <div className="w-full bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm mb-4">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 text-center">Preview Recording</p>
                        <AudioPlayer src={audioUrl} />
                      </div>
                    )}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setAudioUrl(null);
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 uppercase tracking-widest"
                    >
                      Remove File
                    </button>
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

              {/* Template Selection */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Settings2 size={16} />
                    Coaching Template
                  </h3>
                  <button 
                    onClick={() => isAddingTemplate ? cancelTemplateEdit() : setIsAddingTemplate(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    {isAddingTemplate ? 'Cancel' : 'Create Custom'}
                  </button>
                </div>

                {isAddingTemplate ? (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-4 mb-6"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-zinc-900">
                        {editingTemplateId ? 'تعديل قالب التدريب' : 'قالب تدريب جديد'}
                      </h4>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">اسم القالب</label>
                      <input 
                        type="text" 
                        value={newTemplate.name}
                        onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                        placeholder="مثال: مهارات الاتصال البارد"
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">الوصف</label>
                      <input 
                        type="text" 
                        value={newTemplate.description}
                        onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
                        placeholder="صف باختصار ما يستهدفه هذا القالب"
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">تعليمات مدرب الذكاء الاصطناعي</label>
                      <textarea 
                        value={newTemplate.instructions}
                        onChange={e => setNewTemplate({...newTemplate, instructions: e.target.value})}
                        placeholder="أخبر الذكاء الاصطناعي بما يجب البحث عنه والتدريب عليه تحديداً..."
                        rows={3}
                        className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button 
                      onClick={handleAddTemplate}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                      {editingTemplateId ? 'تحديث القالب' : 'حفظ القالب'}
                    </button>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={cn(
                          "relative p-4 rounded-2xl border text-left transition-all group",
                          selectedTemplateId === t.id 
                            ? "border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100" 
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        )}
                      >
                        <h4 className="font-bold text-sm mb-1 pr-12">{t.name}</h4>
                        <p className="text-xs text-zinc-500 line-clamp-2">{t.description}</p>
                        {selectedTemplateId === t.id && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-600 rounded-full" />
                        )}
                        {!DEFAULT_TEMPLATES.find(dt => dt.id === t.id) && (
                          <div className="absolute bottom-4 right-4 flex items-center gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTemplate(t);
                              }}
                              className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1"
                              title="تعديل القالب"
                            >
                              <Pencil size={14} />
                              <span className="text-[10px] font-bold uppercase">تعديل</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(t.id);
                              }}
                              className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all flex items-center gap-1"
                              title="حذف القالب"
                            >
                              <Trash2 size={14} />
                              <span className="text-[10px] font-bold uppercase">حذف</span>
                            </button>
                          </div>
                        )}
                      </button>
                    ))}
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

              {/* Live Coaching Entry */}
              <div className="mt-12 pt-12 border-t border-zinc-100">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setView('live')}
                  className="bg-indigo-600 rounded-3xl p-8 shadow-xl shadow-indigo-100 cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Radio size={120} className="text-white" />
                  </div>
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                      <Activity className="text-white" size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Live Coaching</h3>
                    <p className="text-indigo-100 mb-6 max-w-xs">
                      Get real-time feedback and tips while you're on a call. Gemini listens and whispers advice.
                    </p>
                    <div className="flex items-center gap-2 text-white font-bold">
                      Start Session <ChevronRight size={20} />
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {view === 'live' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setView('dashboard')}
                  className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors font-bold"
                >
                  <ChevronRight size={20} className="rotate-180" />
                  Back to Dashboard
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-bold animate-pulse">
                  <div className="w-2 h-2 bg-red-600 rounded-full" />
                  Live Session Ready
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-200 text-center">
                    <LiveCoachingController onTip={(tip) => {
                      setLiveTips(prev => [{
                        id: Date.now().toString(),
                        text: tip,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      }, ...prev].slice(0, 50));
                    }} />
                  </div>

                  <div className="bg-zinc-900 rounded-3xl p-6 text-white">
                    <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                      <Settings2 size={14} />
                      Live Settings
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-sm font-medium">Voice Feedback</span>
                        <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-sm font-medium">Transcription</span>
                        <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                      <h3 className="font-black uppercase tracking-widest text-xs text-zinc-500 flex items-center gap-2">
                        <MessageSquare size={14} className="text-indigo-600" />
                        Real-time Coaching Feed
                      </h3>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {liveTips.length} tips received
                      </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                      <AnimatePresence initial={false}>
                        {liveTips.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-12">
                            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                              <Quote size={24} className="text-zinc-300" />
                            </div>
                            <p className="text-zinc-400 font-medium italic">
                              Start talking to receive real-time coaching tips...
                            </p>
                          </div>
                        ) : (
                          liveTips.map((tip) => (
                            <motion.div
                              key={tip.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl relative group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                                  <TrendingUp size={16} />
                                </div>
                                <div>
                                  <p className="text-indigo-900 font-medium leading-relaxed">
                                    {tip.text}
                                  </p>
                                  <span className="text-[10px] text-indigo-400 font-mono mt-2 block">
                                    {tip.timestamp}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {view === 'analysis' && analysis && (
            <motion.div 
              key="analysis"
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
                <div className="flex items-center gap-2">
                  {audioUrl && (
                    <a 
                      href={audioUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-all"
                    >
                      <ExternalLink size={16} />
                      Original Recording
                    </a>
                  )}
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors"
                    title="Export as JSON"
                  >
                    <Download size={16} />
                    Export JSON
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowEmailInput(!showEmailInput)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                        showEmailInput 
                          ? "bg-indigo-600 text-white" 
                          : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-200"
                      )}
                    >
                      <Mail size={16} />
                      Email Report
                    </button>

                    <AnimatePresence>
                      {showEmailInput && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl p-4 shadow-2xl border border-zinc-100 z-20"
                        >
                          <p className="text-xs font-bold text-zinc-400 uppercase mb-3 tracking-wider">Recipient Email</p>
                          <div className="flex flex-col gap-3">
                            <input 
                              type="email"
                              value={emailAddress}
                              onChange={(e) => setEmailAddress(e.target.value)}
                              placeholder="colleague@company.com"
                              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                              autoFocus
                            />
                            <button
                              disabled={isEmailing || !emailAddress}
                              onClick={handleEmailReport}
                              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                            >
                              {isEmailing ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Send size={16} />
                              )}
                              Send Analysis
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {emailStatus && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-2xl text-sm font-medium flex items-center justify-between",
                    emailStatus.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                  )}
                >
                  <p>{emailStatus.message}</p>
                  <button onClick={() => setEmailStatus(null)} className="text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100">Dismiss</button>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary & Coaching Card */}
                <div className="lg:col-span-1 space-y-8">
                  {/* Sentiment Score Card (New Refined Version) */}
                  <div className="bg-white rounded-[32px] p-8 shadow-sm border border-zinc-200 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                      <BarChart3 size={14} className="text-indigo-600" />
                      Sentiment Score
                    </h3>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-7xl font-black tracking-tighter text-zinc-900 leading-none">
                        {(analysis.overallSentiment * 100).toFixed(0)}
                      </span>
                      <span className="text-2xl font-black text-zinc-300 mb-1">%</span>
                    </div>
                    <p className="text-sm font-bold text-zinc-500 mb-8">Overall call positivity rating</p>
                    
                    <div className="space-y-4">
                      <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.overallSentiment * 100}%` }}
                          className={cn(
                            "h-full transition-all duration-1000",
                            analysis.overallSentiment > 0.6 ? "bg-emerald-500" : 
                            analysis.overallSentiment > 0.3 ? "bg-amber-500" : "bg-rose-500"
                          )}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>Negative</span>
                        <span>Neutral</span>
                        <span>Positive</span>
                      </div>
                    </div>
                  </div>
                {/* Audio Player */}
                {audioUrl && (
                  <AudioPlayer 
                    src={audioUrl} 
                    onTimeUpdate={setCurrentAudioTime}
                    seekTo={seekToTime}
                  />
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
                                  onClick={() => handleConvertToTemplate(s)}
                                  className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="تحويل إلى قالب"
                                >
                                  <Plus size={14} />
                                </button>
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
                                  onClick={() => handleConvertToTemplate(o)}
                                  className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="تحويل إلى قالب"
                                >
                                  <Plus size={14} />
                                </button>
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

                    {/* Feedback Section */}
                    <div className="pt-6 border-t border-zinc-100">
                      <h4 className="text-zinc-900 font-bold text-sm mb-4">How accurate and useful was this coaching?</h4>
                      
                      {feedbackSubmitted ? (
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                          <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={24} />
                          <p className="text-sm font-bold text-emerald-700">Thank you for your feedback!</p>
                          <button 
                            onClick={() => setFeedbackSubmitted(false)}
                            className="mt-2 text-xs font-bold text-emerald-600 hover:underline"
                          >
                            Edit Feedback
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Accuracy</p>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setAccuracyRating(star)}
                                    className={cn(
                                      "p-1 transition-colors",
                                      accuracyRating >= star ? "text-amber-400" : "text-zinc-200 hover:text-amber-200"
                                    )}
                                  >
                                    <Star size={20} fill={accuracyRating >= star ? "currentColor" : "none"} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Usefulness</p>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setUsefulnessRating(star)}
                                    className={cn(
                                      "p-1 transition-colors",
                                      usefulnessRating >= star ? "text-amber-400" : "text-zinc-200 hover:text-amber-200"
                                    )}
                                  >
                                    <Star size={20} fill={usefulnessRating >= star ? "currentColor" : "none"} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Comments (Optional)</p>
                            <textarea
                              value={feedbackComment}
                              onChange={(e) => setFeedbackComment(e.target.value)}
                              placeholder="What could be improved? Was anything particularly helpful?"
                              className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-all resize-none h-20"
                            />
                          </div>

                          <button
                            disabled={isSubmittingFeedback || (accuracyRating === 0 && usefulnessRating === 0)}
                            onClick={handleFeedbackSubmit}
                            className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all"
                          >
                            {isSubmittingFeedback ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                            Submit Feedback
                          </button>
                        </div>
                      )}
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
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Add your own observations or follow-up items here..."
                    className="w-full h-32 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  />
                  <p className="text-[10px] text-zinc-400 mt-2 text-right">
                    {user ? "Notes are synced to your profile." : "Notes are saved locally for this session."}
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
                  <div className="space-y-8 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                    {analysis.transcript.map((segment, idx) => {
                      const segmentStartTime = parseTimestamp(segment.timestamp);
                      const nextSegment = analysis.transcript[idx + 1];
                      const segmentEndTime = nextSegment ? parseTimestamp(nextSegment.timestamp) : Infinity;
                      const isActive = currentAudioTime >= segmentStartTime && currentAudioTime < segmentEndTime;

                      return (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={cn(
                            "relative group transition-all duration-500",
                            isActive ? "scale-[1.02] z-10" : "opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0"
                          )}
                        >
                          {isActive && (
                            <motion.div 
                              layoutId="active-segment"
                              className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-600 rounded-full"
                            />
                          )}
                          <div 
                            onClick={() => handleSeekToSegment(segment.timestamp)}
                            className={cn(
                              "flex flex-col gap-2 p-6 rounded-[32px] cursor-pointer transition-all",
                              segment.speaker === "Sales Representative" 
                                ? "bg-white border border-zinc-100 shadow-sm" 
                                : "bg-zinc-900 text-white shadow-xl shadow-zinc-200"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                                  segment.speaker === "Sales Representative" 
                                    ? "bg-indigo-600 text-white border-indigo-500" 
                                    : "bg-emerald-500 text-white border-emerald-400"
                                )}>
                                  {segment.speaker === "Sales Representative" ? (
                                    <>
                                      <Briefcase size={10} className="shrink-0" />
                                      <span>مندوب المبيعات</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserIcon size={10} className="shrink-0" />
                                      <span>العميل</span>
                                    </>
                                  )}
                                </div>
                                <span className={cn(
                                  "text-[10px] font-mono flex items-center gap-1.5",
                                  segment.speaker === "Sales Representative" ? "text-zinc-400" : "text-zinc-500"
                                )}>
                                  <div 
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      segment.sentiment > 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                                      segment.sentiment < 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-zinc-400"
                                    )} 
                                    style={{ opacity: 0.4 + Math.abs(segment.sentiment) * 0.6 }}
                                  />
                                  {segment.timestamp}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex flex-col items-end gap-0.5">
                                  <div className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                    {Math.abs(segment.sentiment * 100).toFixed(0)}% {segment.sentiment > 0 ? 'Pos' : segment.sentiment < 0 ? 'Neg' : 'Neu'}
                                  </div>
                                  {segment.confidence !== undefined && (
                                    <div className="flex items-center gap-1.5">
                                      <div className={cn(
                                        "w-12 h-1 rounded-full overflow-hidden",
                                        segment.speaker === "Sales Representative" ? "bg-zinc-100" : "bg-white/10"
                                      )}>
                                        <div 
                                          className={cn(
                                            "h-full transition-all duration-500",
                                            segment.confidence > 0.8 ? "bg-indigo-500" : 
                                            segment.confidence > 0.5 ? "bg-amber-500" : "bg-rose-500"
                                          )}
                                          style={{ width: `${segment.confidence * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-[8px] font-black opacity-30 uppercase tracking-tighter">
                                        Conf: {(segment.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <button className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  segment.speaker === "Sales Representative" ? "hover:bg-zinc-100 text-zinc-400" : "hover:bg-white/10 text-zinc-500"
                                )}>
                                  <Play size={12} fill="currentColor" />
                                </button>
                              </div>
                            </div>
                            <p className={cn(
                              "text-[15px] leading-relaxed tracking-tight",
                              segment.speaker === "Sales Representative" ? "text-zinc-800" : "text-zinc-100"
                            )}>
                              {segment.text}
                            </p>
                            
                            {/* Sentiment Indicator for segment */}
                            <div className="mt-3 flex items-center gap-2">
                              <div className={cn(
                                "flex-1 h-1 rounded-full overflow-hidden",
                                segment.speaker === "Sales Representative" ? "bg-zinc-100" : "bg-white/10"
                              )}>
                                <div 
                                  className={cn(
                                    "h-full transition-all duration-500",
                                    segment.sentiment > 0 ? "bg-emerald-500" : 
                                    segment.sentiment < 0 ? "bg-rose-500" : "bg-zinc-400"
                                  )}
                                  style={{ 
                                    width: `${Math.abs(segment.sentiment) * 100}%`,
                                    opacity: 0.5 + Math.abs(segment.sentiment) * 0.5
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
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
