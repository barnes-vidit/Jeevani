
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import api from "../lib/api";
import { Upload, FileText, Music, Trash2, Loader2, CheckCircle, AlertCircle, LayoutGrid, Calendar, Image as ImageIcon, Search as SearchIcon, ExternalLink, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function Dashboard() {
    const { getToken } = useAuth();
    const [memories, setMemories] = useState([]);
    const [viewMode, setViewMode] = useState('recent'); // 'recent' | 'bucketed'
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);



    const fetchMemories = async () => {
        try {
            const token = await getToken();
            const res = await api.get(`/vault/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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

        // Client-side file validation
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (file.size > maxSize) {
            toast.error("File too large", { description: "Maximum file size is 25MB." });
            return;
        }

        const allowedTypes = [
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'audio/mpeg', 'audio/wav', 'audio/webm',
            'image/jpeg', 'image/png', 'image/webp'
        ];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Unsupported file type", { description: `"${file.type}" is not supported.` });
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = await getToken();
            await api.post(`/vault/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percent);
                }
            });
            toast.success("Memory uploaded!", { description: `"${file.name}" saved to your vault.` });
            fetchMemories();
        } catch (err) {
            console.error("Upload failed", err);
            toast.error("Upload failed", { description: "Something went wrong. Please try again." });
        } finally {
            setUploading(false);
            setUploadProgress(0);
            // Reset the file input
            e.target.value = '';
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure? This memory will be forgotten.")) return;
        try {
            const token = await getToken();
            await api.delete(`/vault/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMemories(memories.filter((m) => m._id !== id));
            toast.success("Memory removed");
        } catch (err) {
            console.error("Delete failed", err);
            toast.error("Delete failed", { description: "Could not remove this memory." });
        }
    };

    const getIcon = (type) => {
        if (!type) return <FileText className="text-gray-500" />;
        if (type.includes("audio")) return <Music className="text-pink-500" />;
        if (type.includes("image")) return <ImageIcon className="text-purple-500" />;
        if (type.includes("pdf")) return <FileText className="text-orange-500" />;
        return <FileText className="text-primary" />;
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
            <div className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center bg-card/50 hover:bg-card hover:border-primary/50 transition-all group relative overflow-hidden">
                <label className="cursor-pointer flex flex-col items-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                        {uploading ? <Loader2 className="animate-spin" size={32} /> : <Upload size={32} />}
                    </div>
                    <span className="text-lg font-medium">
                        {uploading ? "Uploading to Vault..." : "Click to Upload Files"}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                        Supports PDF, DOCX, TXT, MP3, WAV, JPG, PNG (max 25MB)
                    </span>
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                        accept=".pdf,.docx,.txt,.mp3,.wav,.jpg,.jpeg,.png,.webp"
                    />
                </label>

                {/* Upload Progress Bar */}
                {uploading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-xs mt-6"
                    >
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadProgress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    </motion.div>
                )}
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

                        <div className="flex bg-muted/60 border border-border/80 rounded-lg p-1 shadow-inner">
                            <button
                                onClick={() => setViewMode('recent')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'recent'
                                    ? 'bg-card text-foreground shadow-sm border border-border/10'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <LayoutGrid size={16} /> Recent
                            </button>
                            <button
                                onClick={() => setViewMode('bucketed')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'bucketed'
                                    ? 'bg-card text-foreground shadow-sm border border-border/10'
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
                    /* Item 14: Enhanced Empty State */
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-16 px-8 border border-dashed border-border rounded-2xl bg-muted/10"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-amber-500/10 rounded-full flex items-center justify-center mb-6">
                            <FolderOpen size={36} className="text-primary/60" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Your vault is empty</h3>
                        <p className="text-muted-foreground text-center max-w-sm mb-6">
                            Upload your first memory — a journal entry, a photo, or a voice note — and let Jeevani start learning your story.
                        </p>
                        <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
                            <Upload size={18} />
                            Upload Your First Memory
                            <input
                                type="file"
                                className="hidden"
                                onChange={handleUpload}
                                accept=".pdf,.docx,.txt,.mp3,.wav,.jpg,.jpeg,.png,.webp"
                            />
                        </label>
                    </motion.div>
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
                    {memory.summary && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {memory.summary}
                        </p>
                    )}
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
