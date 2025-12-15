import { Book, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Memoir() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-md space-y-6"
            >
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
                    <Book size={48} className="text-primary" />
                </div>

                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Life Sketch
                </h1>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <p className="text-muted-foreground leading-relaxed">
                        This feature is coming soon. Till then, keep accumulating your memories so that you have enough to get a book on your life.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <span className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                            <Sparkles size={12} /> Coming Soon
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
