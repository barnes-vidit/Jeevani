import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import axios from "axios";
import { Send, User, Bot, Loader2, Mic, MicOff, Book, X, Calendar, Sparkles, Search, Trash2 } from "lucide-react";
import TypewriterText from "../components/TypewriterText";

export default function Biographer() {
    const { getToken } = useAuth();
    const { user } = useUser();

    // Chat State
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: `Hello ${user?.firstName || "there"}! I'm ready to document your story. What's on your mind today?`,
            animate: true
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const scrollRef = useRef(null);

    // History State
    const [showHistory, setShowHistory] = useState(false);
    const [historyList, setHistoryList] = useState([]); // List of dates
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [deletingId, setDeletingId] = useState(null);

    // Use Vite env vars
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Cleanup speech recognition on unmount
    useEffect(() => {
        return () => {
            if (window.speechRecognitionInstance) {
                window.speechRecognitionInstance.stop();
            }
        };
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (showHistory) {
                fetchHistoryList(searchQuery);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, showHistory]);

    const fetchHistoryList = async (query = "") => {
        setLoadingHistory(true);
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/biographer/history`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { q: query }
            });
            if (Array.isArray(res.data)) {
                setHistoryList(res.data);
            } else {
                setHistoryList([]); // Fallback
            }
        } catch (err) {
            console.error("Failed to fetch history list", err);
            // Optionally set error state here if needed
        } finally {
            setLoadingHistory(false);
        }
    };

    const loadHistoryEntry = async (entryId) => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/biographer/history/${entryId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Loaded history should not animate
            const loadedMessages = res.data.map(msg => ({ ...msg, animate: false }));
            setMessages(loadedMessages);
            setShowHistory(false); // Close drawer
        } catch (err) {
            console.error("Failed to load entry", err);
        } finally {
            setLoading(false);
        }
    };

    const deleteEntry = async (e, entryId) => {
        e.stopPropagation(); // Prevent loading the entry
        if (!window.confirm("Are you sure you want to delete this conversation?")) return;

        setDeletingId(entryId);
        try {
            const token = await getToken();
            await axios.delete(`${API_URL}/biographer/history/${entryId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Refresh list
            fetchHistoryList(searchQuery);

            // If deleted entry was current view? (Optional: reset view, but keep simpler for now)
        } catch (err) {
            console.error("Failed to delete entry", err);
            alert("Failed to delete entry");
        } finally {
            setDeletingId(null);
        }
    };

    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    const startListening = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            window.speechRecognitionInstance = recognition;

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
            };
            recognition.onerror = (event) => {
                console.error("Speech error", event.error);
                setIsListening(false);
            };
            recognition.onend = () => setIsListening(false);
            recognition.start();
        } else {
            alert("Speech recognition not supported.");
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = { role: "user", content: input, animate: false };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const token = await getToken();
            const res = await axios.post(`${API_URL}/biographer/chat`, {
                message: userMessage.content
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const aiMessage = {
                role: "assistant",
                content: res.data.answer,
                animate: true // Animate only new AI messages
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (err) {
            console.error("Chat failed", err);
            setMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again.", animate: false }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full relative overflow-hidden bg-background rounded-l-2xl md:rounded-2xl border border-border/50 shadow-sm">

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col transition-all duration-300 ${showHistory ? 'mr-80' : ''}`}>

                {/* Chat Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm z-10 h-16 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <Sparkles size={18} fill="currentColor" className="text-white/90" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-sm">The Biographer</h2>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Online & Listening
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleHistory}
                        className={`p-2 rounded-full transition-all duration-200 ${showHistory
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-muted-foreground"
                            }`}
                        title="Open Journal History"
                    >
                        <Book size={20} />
                    </button>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                            {/* Avatar */}
                            {msg.role === "user" ? (
                                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground shadow-sm">
                                    <User size={16} />
                                </div>
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 text-white shadow-sm mt-1">
                                    <Sparkles size={14} fill="currentColor" />
                                </div>
                            )}

                            {/* Message Bubble */}
                            <div className={`p-4 rounded-2xl max-w-[85%] md:max-w-[75%] text-sm leading-7 shadow-sm ${msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-card border border-border/60 rounded-tl-sm"
                                }`}>
                                {msg.role === "user" ? (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                ) : (
                                    <TypewriterText
                                        content={msg.content}
                                        animate={msg.animate}
                                        onUpdate={scrollToBottom}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 text-white shadow-sm mt-1">
                                <Sparkles size={14} fill="currentColor" />
                            </div>
                            <div className="p-4 rounded-2xl bg-card border border-border/60 rounded-tl-sm shadow-sm">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 pt-2 bg-background border-t border-border mt-auto shrink-0">
                    <form onSubmit={handleSend} className="relative flex items-center gap-3">
                        <button
                            type="button"
                            onClick={startListening}
                            className={`p-3 rounded-full transition-all duration-300 ${isListening ? "bg-red-500 text-white animate-pulse shadow-md scale-110" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"}`}
                            title={isListening ? "Stop Listening" : "Start Speaking"}
                        >
                            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your message..."
                                disabled={loading}
                                className="w-full bg-muted/30 border border-border rounded-full py-3.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-medium"
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* History Drawer */}
            <div className={`absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out z-30 ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-4 h-16 border-b border-border flex justify-between items-center bg-muted/20">
                    <h2 className="font-semibold flex items-center gap-2 text-sm"><Book size={16} /> Journal History</h2>
                    <button onClick={toggleHistory} className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-3 border-b border-border bg-card">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 text-muted-foreground h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search memories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto h-[calc(100%-128px)] p-4 space-y-3">
                    {loadingHistory ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                    ) : historyList.length === 0 ? (
                        <div className="text-center py-10 px-4">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                                <Book size={20} className="text-muted-foreground/50" />
                            </div>
                            <p className="text-muted-foreground text-sm">
                                {searchQuery ? "No matching entries found." : "No journal entries yet."}
                            </p>
                        </div>
                    ) : (
                        historyList.map((entry) => (
                            <button
                                key={entry.id}
                                onClick={() => loadHistoryEntry(entry.id)}
                                className="w-full text-left p-3.5 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/20 transition-all group duration-200 relative pr-10"
                            >
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5 group-hover:text-primary transition-colors">
                                    <Calendar size={12} />
                                    <span>{entry.date}</span>
                                </div>
                                <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                                    {entry.preview}
                                </p>
                                {/* Delete Button */}
                                <div
                                    onClick={(e) => deleteEntry(e, entry.id)}
                                    className="absolute right-2 top-2 p-1.5 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="Delete Entry"
                                >
                                    {deletingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}
