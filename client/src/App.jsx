import { lazy, Suspense } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { Toaster } from 'sonner';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';

// Non-landing routes are lazy-loaded — they won't be downloaded on the
// first visit to "/" so the landing page gets a much smaller initial payload.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Biographer = lazy(() => import('./pages/Biographer'));
const Auth = lazy(() => import('./pages/Auth'));
const Memoir = lazy(() => import('./pages/Memoir'));

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key");
}

function ClerkProviderWithRoutes() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      navigate={(to) => navigate(to)}
    >
      {/* Suspense boundary: while a lazy chunk is downloading, render nothing
          (the route chunks are small enough that the flash is imperceptible
          and only happens once per session — subsequent navigations use cache) */}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/*" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Biographer /></ProtectedRoute>} />
          <Route path="/memoir" element={<ProtectedRoute><Memoir /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </ClerkProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ClerkProviderWithRoutes />
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
