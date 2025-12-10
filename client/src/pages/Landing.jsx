
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Feather, Mic, FileText } from "lucide-react";

export default function Landing() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
            <header className="px-6 h-20 flex items-center justify-between max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary rounded-lg text-white">
                        <Feather size={24} />
                    </div>
                    <span className="text-2xl font-bold tracking-tight">Jeevani</span>
                </div>
                <nav className="flex gap-4">
                    <Link to="/auth/sign-in" className="px-5 py-2.5 rounded-full font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Log in
                    </Link>
                    <Link to="/auth/sign-up" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
                        Get Started
                    </Link>
                </nav>
            </header>

            <main className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="space-y-4"
                    >
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                            Every life is a story <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-purple-600">
                                waiting to be told.
                            </span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Jeevani is your intelligent digital biographer. It listens to your voice, reads your journals,
                            and helps you craft the memoir you deserve.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="flex items-center justify-center gap-4"
                    >
                        <Link to="/auth/sign-up" className="px-8 py-4 rounded-full bg-primary text-white text-lg font-semibold shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center gap-2">
                            Start Your Journey <ArrowRight size={20} />
                        </Link>
                    </motion.div>

                    {/* Features Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="grid md:grid-cols-3 gap-6 pt-12 text-left"
                    >
                        <FeatureCard
                            icon={<UploadCloudIcon />}
                            title="Memory Vault"
                            desc="Securely store your journals, photos, and voice notes in one place."
                        />
                        <FeatureCard
                            icon={<MicIcon />}
                            title="Active Interviewer"
                            desc="Jeevani asks thoughtful questions to uncover hidden memories."
                        />
                        <FeatureCard
                            icon={<BookIcon />}
                            title="Living Memoir"
                            desc="Watch your life story unfold in a beautifully structured timeline."
                        />
                    </motion.div>
                </div>
            </main>
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="p-6 rounded-2xl bg-card border border-border/40 hover:border-primary/20 hover:shadow-lg transition-all group">
            <div className="h-12 w-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground leading-snug">{desc}</p>
        </div>
    );
}

// Icons
const UploadCloudIcon = () => <FileText size={24} />;
const MicIcon = () => <Mic size={24} />;
const BookIcon = () => <Feather size={24} />;
