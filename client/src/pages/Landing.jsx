import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Sparkles, BookOpen, Lock } from "lucide-react";
import Logo from "../components/Logo";

export default function Landing() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl opacity-50" />
            </div>

            {/* Header */}
            <header className="fixed top-0 inset-x-0 z-50 h-20 px-6 backdrop-blur-md bg-background/70 border-b border-border/40">
                <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
                    <Logo withText={true} />
                    <nav className="flex gap-4">
                        <Link to="/auth/sign-in" className="px-5 py-2.5 rounded-full font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                            Log in
                        </Link>
                        <Link to="/auth/sign-up" className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95">
                            Get Started
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 pt-32 relative z-10">
                <div className="max-w-5xl mx-auto text-center space-y-12">

                    {/* Hero Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="space-y-6"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border/50 text-xs font-medium text-muted-foreground mb-4">
                            <Sparkles size={12} className="text-amber-500" />
                            <span>Preserve your legacy with AI</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1]">
                            Every life is a story <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-600 to-indigo-600 animate-gradient-x">
                                waiting to be told.
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                            Jeevani is your intelligent digital biographer. <br className="hidden md:block" />
                            It listens, learns, and helps you craft the memoir you deserve.
                        </p>
                    </motion.div>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link to="/auth/sign-up" className="group relative px-8 py-4 rounded-full bg-primary text-white text-lg font-semibold shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 hover:-translate-y-1 transition-all flex items-center gap-2 overflow-hidden">
                            <span className="relative z-10">Start Your Journey</span>
                            <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <Link to="/auth/sign-in" className="px-8 py-4 rounded-full bg-card border border-border text-foreground text-lg font-medium hover:bg-muted/50 hover:border-foreground/20 transition-all">
                            Continue Writing
                        </Link>
                    </motion.div>

                    {/* Features Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="grid md:grid-cols-3 gap-8 pt-20 text-left"
                    >
                        <FeatureCard
                            icon={<Lock className="w-6 h-6" />}
                            title="Memory Vault"
                            desc="Securely store your journals, photos, and voice notes in a private, encrypted vault."
                            color="bg-amber-500/10 text-amber-600"
                        />
                        <FeatureCard
                            icon={<Mic className="w-6 h-6" />}
                            title="Active Interviewer"
                            desc="Jeevani acts as a curious biographer, asking thoughtful questions to uncover hidden memories."
                            color="bg-blue-500/10 text-blue-600"
                        />
                        <FeatureCard
                            icon={<BookOpen className="w-6 h-6" />}
                            title="Living Memoir"
                            desc="Watch your life story unfold in a beautifully structured timeline that you can share with loved ones."
                            color="bg-purple-500/10 text-purple-600"
                        />
                    </motion.div>
                </div>
            </main>

            <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border mt-12 bg-muted/20">
                <p>&copy; {new Date().getFullYear()} Jeevani. All rights reserved.</p>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc, color }) {
    return (
        <div className="p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group duration-300 hover:-translate-y-1">
            <div className={`h-14 w-14 rounded-2xl ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 rotate-3 group-hover:rotate-0`}>
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
        </div>
    );
}
