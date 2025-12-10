
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { Upload, FileText, Music, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function Dashboard() {
    const { getToken, userId } = useAuth();
    const [memories, setMemories] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

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

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const token = await getToken();
            await axios.post(`${API_URL}/vault/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data"
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
        if (type.includes("pdf")) return <FileText className="text-orange-500" />;
        return <FileText className="text-blue-500" />;
    };

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
                        Supports PDF, DOCX, TXT, MP3, WAV
                    </span>
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                        accept=".pdf,.docx,.txt,.mp3,.wav"
                    />
                </label>
            </div>

            {/* List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Your Memories</h2>

                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : memories.length === 0 ? (
                    <div className="text-center p-8 border rounded-xl bg-muted/20">
                        <p className="text-muted-foreground">No memories found. Start uploading above!</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {memories.map((memory) => (
                            <div key={memory._id} className="p-4 rounded-xl border border-border bg-card flex items-start justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3 overflow-hidden">
                                    <div className="mt-1 p-2 bg-muted rounded-lg">
                                        {getIcon(memory.fileType)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h3 className="font-medium truncate pr-2" title={memory.originalName}>
                                            {memory.originalName}
                                        </h3>
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
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
