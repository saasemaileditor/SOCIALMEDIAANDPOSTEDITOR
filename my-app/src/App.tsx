import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import SaasVideoEditor from './pages/SaasVideoEditor'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import { ExportStudio } from './export/ExportStudio'

const queryClient = new QueryClient()

// --- Auth Guard ---
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-[#7c3aed] border-white/20 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/editor/:projectId" element={<RequireAuth><SaasVideoEditor /></RequireAuth>} />
          <Route path="/export" element={<RequireAuth><ExportStudio /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
