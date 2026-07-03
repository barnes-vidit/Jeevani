
import { UserButton, useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, MessageSquare, UploadCloud, Menu, X, Feather, Sun, Moon, ChevronLeft } from "lucide-react";
import Logo from "./Logo";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dark } from "@clerk/themes";

export default function Layout({ children }) {
    const { user } = useUser();
    const location = useLocation();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile breakpoint
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(true); // Auto-open on desktop
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-close sidebar on navigation (mobile only)
    useEffect(() => {
        if (isMobile) setSidebarOpen(false);
    }, [location.pathname]);

    // Theme State
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const navItems = [
        { label: "Memory Vault", icon: UploadCloud, path: "/dashboard" },
        { label: "The Biographer", icon: MessageSquare, path: "/chat" },
        { label: "Life Sketch", icon: BookOpen, path: "/memoir" },
    ];

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Mobile Backdrop Overlay */}
            <AnimatePresence>
                {isSidebarOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <AnimatePresence mode="wait">
                {isSidebarOpen && (
                    <motion.aside
                        initial={{ x: -260, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -260, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`w-[260px] border-r border-white/5 bg-[#05060A] text-[#F0EDE8] shadow-sm flex flex-col z-40
                            ${isMobile ? 'fixed inset-y-0 left-0' : 'relative'}`}
                    >
                        <div className="p-6 flex items-center justify-between border-b border-white/5">
                            <Logo withText={true} className="h-10 w-10" forceDark={true} />
                            {isMobile && (
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        <nav className="flex-1 p-4 space-y-2">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                            ? "bg-[#F2C94C]/10 text-[#F2C94C] font-medium"
                                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            }`}
                                    >
                                        <item.icon size={20} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t border-white/5 space-y-2">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all duration-200"
                            >
                                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                <span className="text-sm font-medium">
                                    {theme === 'light' ? "Dark Mode" : "Light Mode"}
                                </span>
                            </button>

                            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                                <UserButton afterSignOutUrl="/" appearance={{ baseTheme: dark, variables: { colorPrimary: '#F2C94C' } }} />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium truncate text-white">
                                        {user?.fullName || user?.firstName}
                                    </span>
                                    <span className="text-xs text-zinc-400 truncate">
                                        {user?.primaryEmailAddress?.emailAddress}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden">
                {/* Header */}
                <header className="h-16 px-6 border-b border-border flex items-center justify-between bg-background/50 backdrop-blur-sm z-10">
                    <button
                        onClick={() => setSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-all duration-200"
                        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {isSidebarOpen && !isMobile ? <ChevronLeft size={20} /> : <Menu size={20} />}
                    </button>
                </header>

                {/* Page Content */}
                <div className={`flex-1 p-6 ${location.pathname === '/chat' ? 'overflow-hidden' : 'overflow-auto scroll-smooth'}`}>
                    <div className="max-w-5xl mx-auto h-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
