import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
    Book, Sparkles, Download, FileText, ChevronRight, Loader2,
    AlertCircle, RefreshCw, BookOpen, Clock, Hash, Map, Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const PHASE_LABELS = {
    queued:     "Preparing...",
    harvesting: "Gathering all your memories...",
    planning:   "Planning your life story...",
    writing:    "Writing your chapters...",
    assembling: "Weaving the narrative together...",
    editing:    "Polishing the prose...",
    verifying:  "Final quality checks...",
    complete:   "Your life sketch is ready!",
    failed:     "Generation failed",
};

const slugify = (str) => {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
};

const getText = (node) => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(getText).join("");
    if (node.props && node.props.children) return getText(node.props.children);
    return "";
};

// Parse ## headings from markdown for chapter nav
function extractChapters(text) {
    if (!text) return [];
    return text.split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => {
            const title = line.replace(/^## /, "").trim();
            return {
                id: `ch-${slugify(title)}`,
                title: title,
            };
        });
}

// Build components for react-markdown that add scroll IDs to ## headings
function buildMarkdownComponents() {
    return {
        h1: ({ children }) => (
            <h1 className="text-4xl font-extrabold text-center font-serif mt-12 mb-10 text-foreground tracking-tight leading-tight border-b-2 border-primary/20 pb-6 max-w-2xl mx-auto">
                {children}
            </h1>
        ),
        h2: ({ children }) => {
            const text = getText(children);
            const id = `ch-${slugify(text)}`;
            return (
                <div id={id} className="text-center mt-16 mb-8 scroll-mt-10">
                    <h2 className="text-3xl font-bold font-serif text-foreground tracking-wide">
                        {children}
                    </h2>
                    <div className="flex justify-center gap-1.5 mt-3 text-primary/30 text-lg select-none">
                        <span>·</span>
                        <span>·</span>
                        <span>·</span>
                    </div>
                </div>
            );
        },
        h3: ({ children }) => (
            <h3 className="text-lg font-semibold font-serif mt-8 mb-3 text-foreground/95">{children}</h3>
        ),
        p: ({ children }) => (
            <p className="text-base leading-8 text-foreground/90 mb-5">{children}</p>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-4">
                {children}
            </blockquote>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        img: ({ src, alt }) => (
            <span className="block my-6 text-center">
                <img
                    src={src}
                    alt={alt || ""}
                    className="inline-block max-w-full max-h-96 rounded-lg shadow-md object-contain"
                />
                {alt && <span className="block text-xs text-muted-foreground mt-2 italic">{alt}</span>}
            </span>
        ),
    };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onGenerate, generating, error }) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-md space-y-6"
            >
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary/20 to-amber-500/10 rounded-full flex items-center justify-center">
                    <Book size={48} className="text-primary" />
                </div>

                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                    Life Sketch
                </h1>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                        Transform everything you've shared — photos, audio, documents, and journal
                        conversations — into a beautifully written biography of your life.
                    </p>
                    <ul className="text-sm text-muted-foreground text-left space-y-2">
                        {[
                            "Every memory included — nothing is missed",
                            "Chapters organised by era of your life",
                            "Written in literary, narrative prose",
                            "Takes 10–15 minutes to generate",
                        ].map((item) => (
                            <li key={item} className="flex items-start gap-2">
                                <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {generating ? (
                            <><Loader2 size={16} className="animate-spin" /> Starting…</>
                        ) : (
                            <><Sparkles size={16} /> Generate Life Sketch</>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function ProgressView({ jobStatus }) {
    const phase = jobStatus?.status || "queued";
    const progress = jobStatus?.progress || 0;
    const label = PHASE_LABELS[phase] || "Processing…";

    const steps = ["harvesting", "planning", "writing", "assembling", "editing", "verifying"];
    const currentStep = steps.indexOf(phase);

    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg w-full space-y-8"
            >
                <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <BookOpen size={32} className="text-primary animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Writing Your Story</h2>
                    <p className="text-muted-foreground text-sm">
                        This takes 10–15 minutes. You can leave this page and come back.
                    </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{label}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    </div>
                </div>

                {/* Step indicators */}
                <div className="grid grid-cols-3 gap-3">
                    {steps.map((step, i) => {
                        const done = i < currentStep;
                        const active = i === currentStep;
                        return (
                            <div
                                key={step}
                                className={`rounded-lg px-3 py-2 text-xs text-center font-medium transition-colors ${
                                    done
                                        ? "bg-primary/20 text-primary"
                                        : active
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {PHASE_LABELS[step]?.replace("...", "") || step}
                            </div>
                        );
                    })}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                    Powered by Qwen3-235B &amp; DeepSeek-V3
                </p>
            </motion.div>
        </div>
    );
}

const ERA_COLORS = {
    childhood:   "bg-yellow-400/80",
    youth:       "bg-green-400/80",
    early_adult: "bg-amber-500/80",
    adult:       "bg-purple-400/80",
    recent:      "bg-rose-400/80",
};

function LifeTimeline({ plan }) {
    if (!plan?.chapters?.length) {
        return (
            <p className="text-xs text-muted-foreground px-4 py-6 text-center">
                Timeline available after generation.
            </p>
        );
    }
    return (
        <div className="px-3 py-3 space-y-3">
            {plan.chapters.map((ch) => (
                <div key={ch.chapter_number} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${ERA_COLORS[ch.era_tag] || "bg-muted-foreground"}`} />
                        <div className="w-px flex-1 bg-border mt-1" />
                    </div>
                    <div className="pb-2 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug truncate">{ch.title}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                            {ch.era_tag?.replace(/_/g, " ")}
                        </p>
                        {ch.key_events?.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                                {ch.key_events.slice(0, 3).map((ev, i) => (
                                    <li key={i} className="text-[10px] text-muted-foreground line-clamp-1">· {ev}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ))}
            {plan.recurring_people?.length > 0 && (
                <div className="pt-2 border-t border-border">
                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
                        <Users size={9} /> Key people
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {plan.recurring_people.slice(0, 8).map((p) => (
                            <span key={p.name} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                                {p.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function BiographyReader({ manuscript, chapters, activeChapter, onChapterClick, onExportDocx, onExportPdf, onNewGeneration, pastJobs, activeJobId, onLoadManuscript }) {
    const [showHistory, setShowHistory] = useState(false);
    const [sidebarTab, setSidebarTab] = useState("chapters"); // "chapters" | "timeline"

    const readMinutes = Math.ceil((manuscript.wordCount || 0) / 238);

    return (
        <div className="h-full flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <BookOpen size={14} className="text-primary" />
                        Life Sketch
                    </h2>
                    {manuscript.title && (
                        <p className="text-xs text-muted-foreground mt-1 italic truncate">
                            {manuscript.title}
                        </p>
                    )}
                </div>

                {/* Tab switcher */}
                <div className="flex border-b border-border shrink-0">
                    <button
                        onClick={() => setSidebarTab("chapters")}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                            sidebarTab === "chapters" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <BookOpen size={10} /> Chapters
                    </button>
                    <button
                        onClick={() => setSidebarTab("timeline")}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                            sidebarTab === "timeline" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Map size={10} /> Timeline
                    </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto py-2">
                    {sidebarTab === "chapters" ? (
                        chapters.map((ch) => (
                            <button
                                key={ch.id}
                                onClick={() => onChapterClick(ch.id)}
                                className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-start gap-2 ${
                                    activeChapter === ch.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                <ChevronRight size={12} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{ch.title}</span>
                            </button>
                        ))
                    ) : (
                        <LifeTimeline plan={manuscript.plan} />
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-3 border-t border-border space-y-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
                        <Hash size={10} />
                        <span>{manuscript.wordCount?.toLocaleString()} words</span>
                        <span className="mx-1">·</span>
                        <span>{chapters.length} chapters</span>
                        <span className="mx-1">·</span>
                        <Clock size={10} />
                        <span>{readMinutes} min read</span>
                    </div>

                    <button
                        onClick={onExportDocx}
                        className="w-full flex items-center justify-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md px-3 py-2 transition-colors"
                    >
                        <Download size={12} />
                        Download as Word
                    </button>

                    <button
                        onClick={onExportPdf}
                        className="w-full flex items-center justify-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md px-3 py-2 transition-colors"
                    >
                        <FileText size={12} />
                        Download as PDF
                    </button>

                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded-md px-3 py-2 transition-colors"
                    >
                        <Clock size={12} />
                        {showHistory ? "Hide" : "Past"} Sketches
                    </button>

                    {showHistory && pastJobs.length > 0 && (
                        <div className="space-y-1 mt-1">
                            {pastJobs.map((job) => (
                                <button
                                    key={job._id}
                                    onClick={() => onLoadManuscript(job._id)}
                                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                                        job._id === activeJobId
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-muted"
                                    }`}
                                >
                                    {new Date(job.createdAt).toLocaleDateString()}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={onNewGeneration}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 rounded-md px-3 py-1.5 transition-colors"
                    >
                        <RefreshCw size={12} />
                        Regenerate
                    </button>
                </div>
            </div>

            {/* Main reading area */}
            <div id="biography-reader-container" className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-8 py-10">
                    <AnimatePresence mode="wait">
                        <motion.article
                            key={activeJobId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="prose prose-neutral dark:prose-invert max-w-none"
                            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                        >
                            <ReactMarkdown components={buildMarkdownComponents()}>
                                {manuscript.manuscript}
                            </ReactMarkdown>
                        </motion.article>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Memoir() {
    const { getToken } = useAuth();
    const [pageState, setPageState] = useState("loading"); // loading | empty | generating | reading
    const [jobs, setJobs] = useState([]);
    const [activeJobId, setActiveJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [manuscript, setManuscript] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [activeChapter, setActiveChapter] = useState(null);
    const [error, setError] = useState(null);
    const pollRef = useRef(null);

    const authConfig = async () => {
        const token = await getToken();
        return { headers: { Authorization: `Bearer ${token}` } };
    };

    // On mount: load existing biographies
    useEffect(() => {
        loadJobs();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const loadJobs = async () => {
        try {
            const config = await authConfig();
            const res = await axios.get(`${API_URL}/memoir/list`, config);
            setJobs(res.data);
            if (res.data.length > 0) {
                await loadManuscript(res.data[0]._id);
            } else {
                setPageState("empty");
            }
        } catch (err) {
            console.error("[memoir] load jobs error:", err);
            setPageState("empty");
        }
    };

    const loadManuscript = async (jobId) => {
        try {
            const config = await authConfig();
            const res = await axios.get(`${API_URL}/memoir/result/${jobId}`, config);
            if (res.data.manuscript) {
                const ch = extractChapters(res.data.manuscript);
                setManuscript(res.data);
                setChapters(ch);
                setActiveChapter(ch[0]?.id || null);
                setActiveJobId(jobId);
                setPageState("reading");
            }
        } catch (err) {
            console.error("[memoir] load manuscript error:", err);
            setPageState("empty");
        }
    };

    const startGeneration = async () => {
        try {
            setError(null);
            setPageState("generating");
            const config = await authConfig();
            const res = await axios.post(`${API_URL}/memoir/generate`, {}, config);
            const { jobId } = res.data;
            setActiveJobId(jobId);
            setJobStatus({ status: "queued", progress: 0, currentPhase: "queued" });
            startPolling(jobId);
        } catch (err) {
            const msg = err.response?.data?.error || "Failed to start generation. Please try again.";
            // If there's an in-progress job, resume polling it
            if (err.response?.data?.jobId) {
                setActiveJobId(err.response.data.jobId);
                startPolling(err.response.data.jobId);
            } else {
                setError(msg);
                setPageState("empty");
            }
        }
    };

    const startPolling = (jobId) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const config = await authConfig();
                const res = await axios.get(`${API_URL}/memoir/status/${jobId}`, config);
                setJobStatus(res.data);

                if (res.data.status === "complete") {
                    clearInterval(pollRef.current);
                    await loadManuscript(jobId);
                    await loadJobs();
                } else if (res.data.status === "failed") {
                    clearInterval(pollRef.current);
                    setError(res.data.errorMessage || "Generation failed. Please try again.");
                    setPageState("empty");
                }
            } catch (err) {
                console.error("[memoir] poll error:", err);
            }
        }, 5000);
    };

    const scrollToChapter = (chapterId) => {
        setActiveChapter(chapterId);
        const el = document.getElementById(chapterId);
        const container = document.getElementById("biography-reader-container");
        if (el && container) {
            const containerTop = container.getBoundingClientRect().top;
            const elementTop = el.getBoundingClientRect().top;
            const scrollOffset = elementTop - containerTop + container.scrollTop - 20;
            container.scrollTo({
                top: scrollOffset,
                behavior: "smooth"
            });
        }
    };

    const handleExportPdf = async () => {
        if (!activeJobId) return;
        try {
            const config = await authConfig();
            const res = await axios.get(`${API_URL}/memoir/export/pdf/${activeJobId}`, {
                ...config,
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `life-sketch.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("[memoir] PDF export error:", err);
        }
    };

    const handleExportDocx = async () => {
        if (!activeJobId) return;
        try {
            const config = await authConfig();
            const res = await axios.get(`${API_URL}/memoir/export/docx/${activeJobId}`, {
                ...config,
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = `life-sketch.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("[memoir] DOCX export error:", err);
        }
    };

    // ── Render ──

    if (pageState === "loading") {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (pageState === "generating") {
        return <ProgressView jobStatus={jobStatus} />;
    }

    if (pageState === "reading" && manuscript) {
        return (
            <BiographyReader
                manuscript={manuscript}
                chapters={chapters}
                activeChapter={activeChapter}
                onChapterClick={scrollToChapter}
                onExportDocx={handleExportDocx}
                onExportPdf={handleExportPdf}
                onNewGeneration={startGeneration}
                pastJobs={jobs}
                activeJobId={activeJobId}
                onLoadManuscript={loadManuscript}
            />
        );
    }

    return (
        <EmptyState
            onGenerate={startGeneration}
            generating={pageState === "generating"}
            error={error}
        />
    );
}
