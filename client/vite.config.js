import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — tiny, needed everywhere
          'vendor-react': ['react', 'react-dom'],
          // Route-level navigation (react-router-dom)
          'vendor-router': ['react-router-dom'],
          // Clerk auth SDK — heavy, not needed until user interacts with auth
          'vendor-clerk': ['@clerk/clerk-react', '@clerk/themes'],
          // GSAP + premium plugins — only used on landing + animations
          'vendor-gsap': ['gsap'],
          // Framer Motion — preloader + landing transitions
          'vendor-motion': ['framer-motion'],
          // Lenis smooth scroll — landing only
          'vendor-lenis': ['lenis'],
          // Icons — used across app routes, not landing
          'vendor-icons': ['lucide-react'],
          // Misc utilities
          'vendor-misc': ['axios', 'sonner', 'react-markdown'],
        },
      },
    },
  },
})
