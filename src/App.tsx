import React, { useState, useEffect, useRef } from "react";
import {
  Compass,
  Plane,
  Calendar,
  MapPin,
  Share2,
  Copy,
  Check,
  Plus,
  Trash2,
  History,
  LogIn,
  LogOut,
  User,
  Globe,
  FileText,
  Sparkles,
  ChevronRight,
  AlertCircle,
  X,
  UploadCloud,
  FileCode,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Itinerary, User as UserType } from "./types";

const CAPTIONS = [
  "Gathering suggestions from quiet neighborhood guides...",
  "Sieving traditional pastry spots and scenic pathways...",
  "Formulating a thoughtful, morning wanderer's pace...",
  "Drafting hand-written advice on local transit and logistics...",
  "Tucking in details for curated dining and quiet gardens...",
  "Polishing your custom hand-drawn guide notebook..."
];

export default function App() {
  // App navigation & Share states
  const [isShareView, setIsShareView] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [sharedItinerary, setSharedItinerary] = useState<Itinerary | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // User Auth States
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");

  // Planner States
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<string | null>(null);
  const [history, setHistory] = useState<Itinerary[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Generation Inputs
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [manualDestination, setManualDestination] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");

  // Interaction feedback states
  const [loading, setLoading] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [displayMode, setDisplayMode] = useState<"tabs" | "stream">("tabs");
  const [clipboardFeedback, setClipboardFeedback] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interactive pre-travel checklist for a premium human feel
  const [checklist, setChecklist] = useState([
    { id: 1, text: "Confirm passport is valid for at least 6 months", checked: false },
    { id: 2, text: "Save an offline map of the target region", checked: false },
    { id: 3, text: "Notify bank of upcoming international dates", checked: false },
    { id: 4, text: "Pack a compact universal power adapter", checked: false },
    { id: 5, text: "Keep a small amount of local currency cash on hand", checked: false }
  ]);

  const toggleChecklistItem = (id: number) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  // Parse location paths on launch to support instant public sharing links representation
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/share/")) {
      const id = path.split("/share/")[1];
      if (id) {
        setIsShareView(true);
        setShareId(id);
        fetchSharedItinerary(id);
      }
    } else {
      // Check query params if routing is flat
      const params = new URLSearchParams(window.location.search);
      const qShare = params.get("share");
      if (qShare) {
        setIsShareView(true);
        setShareId(qShare);
        fetchSharedItinerary(qShare);
      }
    }

    // Load auth token
    const savedToken = localStorage.getItem("trrip_token");
    if (savedToken) {
      setAuthToken(savedToken);
      fetchUserContext(savedToken);
    }
  }, []);

  // Sync history when token is fetched
  useEffect(() => {
    if (authToken) {
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [authToken]);

  // Loading caption rotation
  useEffect(() => {
    let interval: any;
    if (loading) {
      setCaptionIndex(0);
      interval = setInterval(() => {
        setCaptionIndex((prev) => (prev + 1) % CAPTIONS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const fetchSharedItinerary = async (id: string) => {
    setLoading(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/itinerary/share/${id}`);
      if (!res.ok) {
        throw new Error("Could not find this shared itinerary. It might have been deleted.");
      }
      const data = await res.json();
      setSharedItinerary(data);
    } catch (e: any) {
      setShareError(e.message || "Failed to load shared details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserContext = async (token: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      } else {
        // Clear stale token
        logout();
      }
    } catch (e) {
      console.error("Context retrieval error:", e);
    }
  };

  const fetchHistory = async () => {
    if (!authToken) return;
    try {
      const res = await fetch("/api/itinerary/history", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("History fetch error:", e);
    }
  };

  const logout = () => {
    localStorage.removeItem("trrip_token");
    setAuthToken(null);
    setCurrentUser(null);
    setShowHistory(false);
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const isLogin = authModal === "login";
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, name: authName };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Authentication failed");
        return;
      }

      localStorage.setItem("trrip_token", data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setAuthModal(null);
      
      // Reset forms
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (err) {
      setAuthError("Network error. Please try again.");
    }
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Submit generator
  const handleGenerate = async () => {
    if (!file && !rawText && !manualDestination) {
      setItineraryError("Please provide a file, paste ticketing text, or specify a destination.");
      return;
    }

    setLoading(true);
    setItineraryError(null);
    setItinerary(null);
    setExtractedPreview(null);

    const formData = new FormData();
    if (file && inputMode === "file") {
      formData.append("file", file);
    }
    if (rawText && inputMode === "text") {
      formData.append("rawText", rawText);
    }
    if (manualDestination) {
      formData.append("destination", manualDestination);
    }

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse files.");
      }

      setItinerary(data.itinerary);
      if (data.extractedPreview) {
        setExtractedPreview(data.extractedPreview);
      }
      setActiveDayIdx(0);
      
      // Update sidebar list if logged in
      if (authToken) {
        fetchHistory();
      }
    } catch (e: any) {
      setItineraryError(e.message || "An unexpected error occurred during travel design.");
    } finally {
      setLoading(false);
    }
  };

  // Delete itinerary
  const handleDeleteItinerary = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authToken || !confirm("Are you sure you want to remove this itinerary from your records?")) return;

    try {
      const res = await fetch(`/api/itinerary/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (res.ok) {
        // If modern view is deleted plan, clear it
        if (itinerary?.id === id || itinerary?._id === id) {
          setItinerary(null);
        }
        fetchHistory();
      }
    } catch (error) {
      console.error("Delete failure:", error);
    }
  };

  const copyShareLink = (id: string) => {
    const fullShareUrl = `${window.location.origin}/share/${id}`;
    // Fallback if URL rewrite isn't active
    const flatShareUrl = `${window.location.origin}?share=${id}`;
    
    const urlToUse = window.location.pathname.includes("/share/") ? window.location.href : flatShareUrl;
    
    navigator.clipboard.writeText(urlToUse);
    setClipboardFeedback(true);
    setTimeout(() => setClipboardFeedback(false), 2000);
  };

  const loadFromHistory = (histItem: Itinerary) => {
    setItinerary(histItem);
    setActiveDayIdx(0);
    setShowHistory(false);
    setExtractedPreview(null);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-200">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 glass-panel border-b border-white/5 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => {
          setIsShareView(false);
          setItinerary(null);
        }}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Globe className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5 font-display">
              Trrip
            </h1>
            <p className="text-xs text-indigo-300 font-display font-light">Next-Gen Travel Curator</p>
          </div>
        </div>

        {/* AUTH BUTTONS AND USER STATUS */}
        <div className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-gray-300 bg-white/5 hover:bg-white/10 text-sm transition"
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">History ({history.length})</span>
              </button>

              <div className="h-8 w-px bg-white/10"></div>

              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold leading-3 text-gray-100">{currentUser.name}</p>
                  <p className="text-[10px] text-gray-400">{currentUser.email}</p>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAuthModal("login")}
                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition font-medium"
              >
                <LogIn className="h-4 w-4" />
                <span>Log In</span>
              </button>
              <button
                onClick={() => setAuthModal("register")}
                className="flex items-center space-x-1 px-3.5 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm transition hover:from-indigo-400 hover:to-purple-500 font-medium shadow-lg shadow-indigo-500/25"
              >
                <Plus className="h-4 w-4" />
                <span>Sign Up</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* VIEWPORT CANVAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-6 relative">
        
        {/* PUBLIC SHARE VIEW BANNER */}
        {isShareView && (
          <div className="w-full lg:col-span-12 flex flex-col glass-card border-indigo-500/30 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden mb-2">
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10 scale-150 text-indigo-400">
              <Sparkles className="h-40 w-40" />
            </div>
            <div className="z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full">
                  Shared Travel Guide
                </span>
                <h3 className="text-xl font-bold mt-2 font-display">Shared Travel Itinerary</h3>
                <p className="text-sm text-gray-300 max-w-xl">
                  A companion has shared this generated travel guide with you.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsShareView(false);
                  setSharedItinerary(null);
                  setItinerary(null);
                  window.history.pushState({}, "", "/");
                }}
                className="shrink-0 bg-white text-indigo-900 font-semibold px-4 py-2 text-sm rounded-xl hover:bg-gray-100 transition shadow-md flex items-center gap-1.5"
              >
                <Compass className="h-4 w-4" />
                Create Your Own
              </button>
            </div>
          </div>
        )}

        {/* LOADING SCREEN OVERLAY */}
        {loading && (
          <div className="absolute inset-0 z-30 glass-panel backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-8 text-center min-h-[500px]">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-gray-800 border-t-indigo-500 animate-spin"></div>
              <Zap className="h-6 w-6 text-indigo-400 animate-pulse absolute inset-0 m-auto" />
            </div>
            <h3 className="text-xl font-bold text-white mt-6 font-display">Curating your adventure...</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-xs">{CAPTIONS[captionIndex]}</p>
            <div className="w-48 bg-gray-800 h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full animate-progress-bar rounded-full"></div>
            </div>
          </div>
        )}

        {/* LEFT COMPONENT: CONTROL FLIGHT SHEET & UPLOADER (Avoid rendering if in pure public view mode) */}
        {!isShareView && !itinerary && (
          <div className="w-full lg:w-5/12 flex flex-col gap-6">
            <div className="glass-card rounded-2xl p-5 lg:p-6 transition">
              <span className="text-indigo-400 font-semibold text-[10px] uppercase tracking-wider block mb-1">
                Step 1: Input Details
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight font-display">Generate Itinerary</h2>
              <p className="text-sm text-gray-400 mt-1">
                Upload your travel PDF, tickets, or type your destinations to begin. Our AI will curate an elite experience.
              </p>

              {/* TOGGLE TABS */}
              <div className="flex gap-2 rounded-xl bg-black/20 p-1 mt-5">
                <button
                  onClick={() => setInputMode("file")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                    inputMode === "file" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  Upload Document
                </button>
                <button
                  onClick={() => setInputMode("text")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                    inputMode === "text" ? "bg-white/10 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Paste Text
                </button>
              </div>

              {/* FILE DRAG AREA */}
              {inputMode === "file" ? (
                <div className="mt-4">
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center flex flex-col items-center justify-center cursor-pointer transition glass-input ${
                      dragActive
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-gray-700 hover:border-gray-500 hover:bg-white/5"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="travel-file-upload"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      className="hidden"
                    />
                    
                    <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 mb-2">
                      <FileCode className="h-6 w-6 text-indigo-400" />
                    </div>
                    {file ? (
                      <div className="w-full">
                        <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • Click or drag to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-300">Drag travel PDF or image here</p>
                        <p className="text-[10px] text-gray-500 mt-1">Supports PDF, JPEG, or PNG files (up to 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                    Enter Ticket Details or Itinerary Context
                  </label>
                  <textarea
                    rows={4}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Example: Indigo flight from Delhi to Mumbai, staying 3 days at Hyatt..."
                    className="w-full px-3 py-2 rounded-xl text-xs resize-none glass-input"
                  ></textarea>
                </div>
              )}

              {/* ADDITIONAL DESIGNATION TARGET */}
              <div className="mt-4">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Manual Focus Destination (Optional)
                </label>
                <div className="relative">
                  <MapPin className="h-4 w-4 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={manualDestination}
                    onChange={(e) => setManualDestination(e.target.value)}
                    placeholder="e.g. Kyoto, Japan"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs glass-input"
                  />
                </div>
              </div>

              {itineraryError && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <p>{itineraryError}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold py-3 px-4 rounded-xl mt-5 shadow-lg shadow-indigo-500/25 active:translate-y-px transition flex items-center justify-center gap-1.5 text-sm cursor-pointer border-none"
              >
                <Sparkles className="h-4 w-4" />
                Generate Elite Itinerary
              </button>
            </div>

            {/* PRE-TRAVEL CHECKLIST */}
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 opacity-5 text-indigo-400">
                <Globe className="h-32 w-32" />
              </div>
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-0.5 font-display">Essentials</h4>
              <p className="text-sm font-bold text-white font-display">Pre-Travel Checklists</p>
              
              <div className="space-y-2.5 text-left mt-4">
                {checklist.map((item) => (
                  <label key={item.id} className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="mt-0.5 accent-indigo-500 cursor-pointer h-3.5 w-3.5"
                    />
                    <span className={`text-xs transition ${item.checked ? "line-through text-gray-500" : "text-gray-300"}`}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT DISPLAY WINDOW: PRESENTATION ITINERARY SHEET */}
        <div className={`w-full ${isShareView || itinerary ? "lg:w-12/12 flex-1" : "lg:w-7/12"}`}>
          {isShareView && sharedItinerary ? (
            <ItineraryView
              itinerary={sharedItinerary}
              isPublic={true}
              copyLink={copyShareLink}
              clipboardFeedback={clipboardFeedback}
              activeDayIdx={activeDayIdx}
              setActiveDayIdx={setActiveDayIdx}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
            />
          ) : isShareView && shareError ? (
            <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <AlertCircle className="h-12 w-12 text-rose-500 mb-3" />
              <h3 className="text-xl font-bold text-white font-display">Shared link does not exist</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-sm">{shareError}</p>
              <button
                onClick={() => {
                  setIsShareView(false);
                  setShareError(null);
                  window.history.pushState({}, "", "/");
                }}
                className="mt-5 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition"
              >
                Go back to Hub
              </button>
            </div>
          ) : itinerary ? (
            <div className="relative">
              {/* BACK BUTTON TO LOAD OTHER / START OVER */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => { setItinerary(null); setExtractedPreview(null); }}
                  className="flex items-center space-x-1 py-1.5 px-3 glass-card hover:bg-white/10 rounded-lg text-gray-300 hover:text-white text-xs font-semibold transition"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  <span>Start Over</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white py-1.5 px-3.5 rounded-lg text-xs font-semibold transition shadow-md shadow-indigo-500/20"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share Trip</span>
                  </button>
                </div>
              </div>

              {extractedPreview && (
                <div className="mb-6 p-4 glass-card border border-indigo-500/30 rounded-xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 bg-indigo-500/20 px-2 py-1 rounded-bl-lg text-[9px] text-indigo-300 font-bold uppercase tracking-wider">
                     Extracted Details
                   </div>
                   <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-indigo-400"/> Parsed from your PDF</h4>
                   <p className="text-[11px] text-gray-400 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                     {extractedPreview}
                   </p>
                </div>
              )}

              <ItineraryView
                itinerary={itinerary}
                isPublic={false}
                copyLink={copyShareLink}
                clipboardFeedback={clipboardFeedback}
                activeDayIdx={activeDayIdx}
                setActiveDayIdx={setActiveDayIdx}
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
              />
            </div>
          ) : (
            /* EMPTY STATS LAYOUT */
            <div className="glass-panel rounded-2xl p-8 lg:p-12 text-center flex flex-col items-center justify-center min-h-[460px] relative">
              <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none rounded-b-2xl"></div>
              
              <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-indigo-400 animate-pulse-glow">
                <Sparkles className="h-7 w-7" />
              </div>

              <h2 className="text-3xl font-semibold text-white font-display tracking-tight text-gradient">Your Next Adventure Awaits</h2>
              <p className="text-sm text-gray-400 max-w-md mt-3 leading-relaxed">
                Upload your travel vouchers, raw ideas, or flight details. Our intelligent engine will architect a comprehensive, stunning travel experience for you.
              </p>

              {/* INTERACTIVE BOARD EXAMPLE BULLETS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-8 max-w-lg w-full text-left">
                <div className="p-4 glass-card rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <Plane className="h-4 w-4 text-indigo-400" />
                    <h5 className="text-[11.5px] font-bold text-white">1. Smart Parsing</h5>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-normal">We instantly digest complex flight data, layovers, and unstructured PDF itineraries.</p>
                </div>
                <div className="p-4 glass-card rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="h-4 w-4 text-purple-400" />
                    <h5 className="text-[11.5px] font-bold text-white">2. Beautiful Timelines</h5>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-normal">Presents your schedule in an elegant, responsive timeline that's easy to read on the go.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL ARCHITECTURE: JWT PROFILE FORMS */}
      <AnimatePresence>
        {authModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setAuthModal(null)}
                className="absolute right-4 top-4 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-2.5 mb-5 select-none text-left">
                <div className="h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-lg text-white font-display">
                  {authModal === "login" ? "Welcome Back" : "Create Account"}
                </h3>
              </div>

              {authError && (
                <div className="p-2.5 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-1.5 text-left">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <p>{authError}</p>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3.5 text-left">
                {authModal === "register" && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3 py-2 rounded-xl text-xs glass-input"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Email address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3 py-2 rounded-xl text-xs glass-input"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl text-xs glass-input"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold py-2.5 rounded-xl mt-4 text-xs transition shadow-lg shadow-indigo-500/20 border-none"
                >
                  {authModal === "login" ? "Sign In" : "Register"}
                </button>
              </form>

              <div className="h-px bg-white/10 my-5"></div>

              <p className="text-[10px] text-center text-gray-400">
                {authModal === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => {
                    setAuthModal(authModal === "login" ? "register" : "login");
                    setAuthError("");
                  }}
                  className="text-indigo-400 font-bold hover:text-indigo-300"
                >
                  {authModal === "login" ? "Sign Up" : "Log In"}
                </button>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHARE TRIP DIALOG OVERLAY */}
      <AnimatePresence>
        {showShareModal && itinerary && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowShareModal(false)}
                className="absolute right-4 top-4 p-1 rounded-lg text-gray-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-white font-display">Share Itinerary</h3>
                <p className="text-gray-400 text-[11px] max-w-xs mx-auto mt-1 leading-relaxed">
                  Anyone with this link can view your itinerary.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <div className="p-3 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="truncate text-left pr-2">
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block leading-3">Public Link</p>
                    <p className="text-xs text-indigo-300 font-mono truncate font-semibold mt-0.5">
                      {window.location.origin}?share={itinerary.shareId}
                    </p>
                  </div>

                  <button
                    onClick={() => copyShareLink(itinerary.shareId || "")}
                    className="shrink-0 p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition ml-2 border border-white/10"
                  >
                    {clipboardFeedback ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyShareLink(itinerary.shareId || "")}
                    className="flex-1 py-2 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold rounded-xl text-xs transition border-none"
                  >
                    {clipboardFeedback ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAWER: USER TRIP HISTORIC ARCHIVES */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 z-40 w-80 glass-panel border-l border-white/10 shadow-2xl flex flex-col p-5">
          <div className="flex items-center justify-between mb-5 select-none text-left">
            <h3 className="font-bold text-xs tracking-wide text-white uppercase flex items-center gap-1.5 font-display">
              <History className="h-4 w-4 text-indigo-400" /> Your History
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {history.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <Compass className="h-8 w-8 text-gray-600 animate-pulse" />
                <p className="text-xs text-gray-400 mt-2">No itineraries found.</p>
              </div>
            ) : (
              history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => loadFromHistory(item)}
                  className={`p-3.5 rounded-xl border transition text-left cursor-pointer relative group ${
                    itinerary?.id === item.id || itinerary?._id === item._id
                      ? "bg-indigo-500/20 border-indigo-500/40"
                      : "bg-white/5 hover:bg-white/10 border-white/10"
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">
                    {item.duration}
                  </span>
                  <h4 className="font-bold text-sm text-white truncate mt-0.5 pr-6">{item.title}</h4>
                  <p className="text-[10px] text-gray-400 flex items-center mt-1 gap-1.5">
                    <MapPin className="h-3 w-3" /> {item.destination}
                  </p>

                  <button
                    onClick={(e) => handleDeleteItinerary(item.id || item._id || "", e)}
                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================
// SUB-COMPONENT: DISPLAY PRESENTATION SHEET
// ====================================================
interface ViewProps {
  itinerary: Itinerary;
  isPublic: boolean;
  copyLink: (id: string) => void;
  clipboardFeedback: boolean;
  activeDayIdx: number;
  setActiveDayIdx: (idx: number) => void;
  displayMode: "tabs" | "stream";
  setDisplayMode: (mode: "tabs" | "stream") => void;
}

function ItineraryView({
  itinerary,
  activeDayIdx,
  setActiveDayIdx,
  displayMode,
  setDisplayMode
}: ViewProps) {
  const currentDay = itinerary.days[activeDayIdx] || itinerary.days[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5 lg:p-8 relative select-none"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-5 gap-3 text-left">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-display text-[11px] px-3.5 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 animate-pulse text-indigo-400" /> Premium Itinerary
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-3 font-display">
            {itinerary.title}
          </h2>

          <div className="flex flex-wrap items-center mt-3 text-gray-400 text-xs gap-3">
            <span className="flex items-center gap-1 font-semibold text-gray-300 bg-white/5 px-2.5 py-1 border border-white/10 rounded-xl">
              <MapPin className="h-3.5 w-3.5 text-purple-400" /> {itinerary.destination}
            </span>
            <span className="flex items-center gap-1 font-semibold text-gray-300 bg-white/5 px-2.5 py-1 border border-white/10 rounded-xl">
              <Calendar className="h-3.5 w-3.5 text-indigo-400" /> {itinerary.duration}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center">
          <div className="flex rounded-lg bg-black/30 p-1 text-xs">
            <button
              onClick={() => setDisplayMode("tabs")}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                displayMode === "tabs" ? "bg-white/10 text-white shadow-xs" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Day-by-Day
            </button>
            <button
              onClick={() => setDisplayMode("stream")}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                displayMode === "stream" ? "bg-white/10 text-white shadow-xs" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {displayMode === "tabs" ? (
        <div className="mt-6 text-left">
          <div className="flex gap-2 overflow-x-auto pb-4 border-b border-white/5 scrollbar-hide">
            {itinerary.days.map((d, index) => (
              <button
                key={index}
                onClick={() => setActiveDayIdx(index)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                  activeDayIdx === index
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-500/20"
                    : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-400 hover:text-white"
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>

          <motion.div
            key={activeDayIdx}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            className="py-5"
          >
            <div className="text-left mb-6">
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                Active Schedule • Day {currentDay.day}
              </span>
              <h3 className="text-xl font-bold text-white mt-1 font-display">
                {currentDay.theme || "Daily Agenda"}
              </h3>
            </div>

            <div className="relative border-l border-white/10 pl-6 ml-2 space-y-6">
              {currentDay.activities.map((act, actIdx) => (
                <div key={actIdx} className="relative group text-left">
                  <div className="absolute -left-[29px] top-1.5 h-3 w-3 bg-gray-900 border-2 border-indigo-500 rounded-full group-hover:bg-indigo-500 transition"></div>
                  <div>
                    <span className="text-[10px] font-mono text-purple-400 font-semibold block leading-none">
                      {act.time || "Flexible Hour"}
                    </span>
                    <h4 className="text-sm font-semibold text-white mt-1.5 leading-tight flex items-center gap-1.5 flex-wrap">
                      {act.activity}
                      {act.location && (
                        <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 rounded px-1.5 py-0.5">
                          {act.location}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1.5 max-w-2xl leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="mt-6 space-y-8 text-left">
          {itinerary.days.map((d, dIdx) => (
            <div key={dIdx} className="border-b border-white/5 pb-8 last:border-none last:pb-0">
              <div className="text-left mb-5">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider block">
                  Timeline • Day {d.day}
                </span>
                <h3 className="text-lg font-bold text-white mt-1 font-display">
                  {d.theme}
                </h3>
              </div>

              <div className="relative border-l border-white/10 pl-6 ml-2 space-y-6">
                {d.activities.map((act, actIdx) => (
                  <div key={actIdx} className="relative group text-left">
                    <div className="absolute -left-[29px] top-1.5 h-3 w-3 bg-gray-900 border-2 border-indigo-500 rounded-full group-hover:bg-indigo-500 transition"></div>
                    <div>
                      <span className="text-[10px] font-mono text-purple-400 font-semibold block">
                        {act.time}
                      </span>
                      <h4 className="text-sm font-semibold text-white mt-1 flex items-center gap-1.5 flex-wrap leading-tight">
                        {act.activity}
                        {act.location && (
                          <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 rounded px-1.5 py-0.5">
                            {act.location}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed max-w-2xl">
                        {act.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {itinerary.additionalNotes && (
        <div className="glass-card border border-indigo-500/20 rounded-xl p-5 text-left mt-8">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-display mb-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Trip Logistics & Advice
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
            {itinerary.additionalNotes}
          </p>
        </div>
      )}
    </motion.div>
  );
}
