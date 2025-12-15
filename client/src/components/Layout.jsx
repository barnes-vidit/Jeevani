
import { UserButton, useUser } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, MessageSquare, UploadCloud, Menu, X, Feather, Sun, Moon } from "lucide-react";
import Logo from "./Logo";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Layout({ children }) {
    const { user } = useUser();
    const location = useLocation();
    const [isSidebarOpen, setSidebarOpen] = useState(true);

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
            {/* Sidebar */}
            <AnimatePresence mode="wait">
                {isSidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="border-r border-border bg-card shadow-sm flex flex-col z-20"
                    >
                        <div className="p-6 flex items-center justify-start border-b border-border">
                            <Logo withText={true} className="h-10 w-10" />
                        </div>

                        <nav className="flex-1 p-4 space-y-2">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            }`}
                                    >
                                        <item.icon size={20} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t border-border space-y-2">
                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
                            >
                                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                <span className="text-sm font-medium">
                                    {theme === 'light' ? "Dark Mode" : "Light Mode"}
                                </span>
                            </button>

                            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                                <UserButton afterSignOutUrl="/" />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium truncate">
                                        {user?.fullName || user?.firstName}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
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
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    {/* Breadcrumbs or Page Title could go here */}
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
