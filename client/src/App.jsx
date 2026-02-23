
import { ClerkProvider } from '@clerk/clerk-react';
import { Toaster } from 'sonner';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Biographer from './pages/Biographer';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Memoir from './pages/Memoir';

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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/*" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Biographer /></ProtectedRoute>} />
        <Route path="/memoir" element={<ProtectedRoute><Memoir /></ProtectedRoute>} />
      </Routes>
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
