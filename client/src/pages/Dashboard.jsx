
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { Upload, FileText, Music, Trash2, Loader2, CheckCircle, AlertCircle, LayoutGrid, Calendar, Image as ImageIcon, Search as SearchIcon, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
    const { getToken } = useAuth();
    const [memories, setMemories] = useState([]);
    const [viewMode, setViewMode] = useState('recent'); // 'recent' | 'bucketed'
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Use Vite env vars
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

    const fetchMemories = async () => {
        try {
            const token = await getToken();
            const res = await axios.get(`${API_URL}/vault/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Memories fetched:", res.data); // Debugging
            if (Array.isArray(res.data)) {
                setMemories(res.data);
            } else {
                setMemories([]);
            }
        } catch (err) {
            console.error("Failed to fetch memories", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMemories();
    }, [getToken]);

    // Poll for status updates if any memory is processing
    useEffect(() => {
        const hasProcessing = memories.some(m => m.processingStatus === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            fetchMemories();
        }, 3000); // Poll every 3s

        return () => clearInterval(interval);
    }, [memories, getToken]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            console.log("Uploading to:", `${API_URL}/vault/upload`); // Debug URL
            const token = await getToken();
            await axios.post(`${API_URL}/vault/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                    // Let Axios set Content-Type with boundary automatically
                }
            });
            // Refresh list
            fetchMemories();
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure? This memory will be forgotten.")) return;
        try {
            const token = await getToken();
            await axios.delete(`${API_URL}/vault/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMemories(memories.filter((m) => m._id !== id));
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const getIcon = (type) => {
        if (!type) return <FileText className="text-gray-500" />;
        if (type.includes("audio")) return <Music className="text-pink-500" />;
        if (type.includes("image")) return <ImageIcon className="text-purple-500" />;
        if (type.includes("pdf")) return <FileText className="text-orange-500" />;
        return <FileText className="text-blue-500" />;
    };

    // Filter memories based on search
    const filteredMemories = memories.filter(memory => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const matchesName = memory.originalName.toLowerCase().includes(q);
        const matchesDate = new Date(memory.createdAt).toLocaleDateString().includes(q);
        return matchesName || matchesDate;
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Memory Vault</h1>
                <p className="text-muted-foreground mt-2">
                    Upload your journals, audio recordings, and documents to fill your life story.
                </p>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center bg-card/50 hover:bg-card hover:border-primary/50 transition-all group">
                <label className="cursor-pointer flex flex-col items-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                        {uploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
                    </div>
                    <span className="text-lg font-medium">
                        {uploading ? "Uploading to Vault..." : "Click to Upload Files"}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                        Supports PDF, DOCX, TXT, MP3, WAV, JPG, PNG
                    </span>
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                        accept=".pdf,.docx,.txt,.mp3,.wav,.jpg,.jpeg,.png,.webp"
                    />
                </label>
            </div>

            {/* List Control Bar */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Your Memories</h2>
                    <div className="flex items-center gap-3">
                        {/* Expandable Search */}
                        <div
                            className="flex items-center bg-muted rounded-lg p-1 relative"
                            onMouseEnter={() => setIsSearchOpen(true)}
                            onMouseLeave={() => {
                                if (!searchQuery) setIsSearchOpen(false);
                            }}
                        >
                            <div className="px-2 cursor-pointer text-muted-foreground hover:text-foreground">
                                <SearchIcon size={16} />
                            </div>
                            <motion.input
                                initial={{ width: 0, opacity: 0 }}
                                animate={{
                                    width: isSearchOpen || searchQuery ? 200 : 0,
                                    opacity: isSearchOpen || searchQuery ? 1 : 0
                                }}
                                transition={{ duration: 0.3 }}
                                placeholder="Search by name or date..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none focus:outline-none text-sm px-1 overflow-hidden"
                            />
                        </div>

                        <div className="flex bg-muted rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('recent')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'recent'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <LayoutGrid size={16} /> Recent
                            </button>
                            <button
                                onClick={() => setViewMode('bucketed')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'bucketed'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Calendar size={16} /> By Date
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : memories.length === 0 ? (
                    <div className="text-center p-8 border rounded-xl bg-muted/20">
                        <p className="text-muted-foreground">No memories found. Start uploading above!</p>
                    </div>
                ) : viewMode === 'recent' ? (
                    /* RECENT VIEW */
                    <motion.div layout className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <AnimatePresence mode="popLayout">
                            {filteredMemories.map((memory) => (
                                <MemoryCard key={memory._id} memory={memory} getIcon={getIcon} handleDelete={handleDelete} />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    /* BUCKETED VIEW */
                    <div className="space-y-8">
                        {Object.entries(
                            filteredMemories.reduce((groups, memory) => {
                                const date = new Date(memory.createdAt).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });
                                if (!groups[date]) groups[date] = [];
                                groups[date].push(memory);
                                return groups;
                            }, {})
                        ).map(([date, groupMemories]) => (
                            <div key={date}>
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                    <div className="h-px bg-border flex-1"></div>
                                    {date}
                                    <div className="h-px bg-border flex-1"></div>
                                </h3>
                                <motion.div layout className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    <AnimatePresence mode="popLayout">
                                        {groupMemories.map((memory) => (
                                            <MemoryCard key={memory._id} memory={memory} getIcon={getIcon} handleDelete={handleDelete} />
                                        ))}
                                    </AnimatePresence>
                                </motion.div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Reusable Card Component
const MemoryCard = ({ memory, getIcon, handleDelete }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
                opacity: 0,
                scale: 1.1,
                filter: "blur(10px)",
                transition: { duration: 0.4 }
            }}
            className="p-4 rounded-xl border border-border bg-card flex items-start justify-between shadow-sm hover:shadow-md transition-shadow"
        >
            <div className="flex items-start gap-3 overflow-hidden">
                <div className="mt-1 p-2 bg-muted rounded-lg">
                    {getIcon(memory.fileType)}
                </div>
                <div className="overflow-hidden">
                    <a
                        href={memory.cloudUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium truncate pr-2 hover:text-primary hover:underline flex items-center gap-1 group/link"
                        title="View File"
                    >
                        {memory.originalName}
                        <ExternalLink size={12} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                        {new Date(memory.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs">
                        {memory.processingStatus === 'completed' ? (
                            <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> Ready</span>
                        ) : memory.processingStatus === 'failed' ? (
                            <span className="flex items-center gap-1 text-red-600"><AlertCircle size={12} /> Failed</span>
                        ) : (
                            <span className="flex items-center gap-1 text-amber-600"><Loader2 size={12} className="animate-spin" /> Processing</span>
                        )}
                    </div>
                </div>
            </div>
            <button
                onClick={() => handleDelete(memory._id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                title="Forget Memory"
            >
                <Trash2 size={18} />
            </button>
        </motion.div>
    );
}
