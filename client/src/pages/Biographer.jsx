
import { useState, useRef, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import axios from "axios";
import { Send, User, Bot, Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';

export default function Biographer() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const [messages, setMessages] = useState([
        { role: "assistant", content: `Hello ${user?.firstName || "there"}! I've been reading through your Memory Vault. What would you like to talk about today?` }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    // Use Vite env vars
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = { role: "user", content: input };
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

            console.log("Biographer Response:", res.data); // Debugging
            const aiMessage = { role: "assistant", content: res.data.answer };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (err) {
            console.error("Chat failed", err);
            setMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting to my memory right now. Please try again later." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)]">
            <div className="flex-1 overflow-y-auto space-y-4 p-4 pr-2">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"
                            }`}
                    >
                        <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                }`}
                        >
                            {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div
                            className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-card border border-border rounded-tl-sm"
                                }`}
                        >
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Bot size={16} />
                        </div>
                        <div className="p-3 rounded-2xl bg-card border border-border rounded-tl-sm">
                            <Loader2 className="animate-spin" size={16} />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            <div className="mt-4">
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={loading}
                        className="w-full bg-card border border-border rounded-full py-3 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="absolute right-2 p-2 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
