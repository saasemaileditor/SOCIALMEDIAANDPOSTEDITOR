import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Zap, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function AuthPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                // Since this is a simple setup, auto sign in if they just signed up
                alert('Account created! Logging you in...');
                const loginRes = await supabase.auth.signInWithPassword({ email, password });
                if (loginRes.error) throw loginRes.error;
                navigate('/');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/');
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'An error occurred during authentication.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
        >
            {/* Background glowing orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#7c3aed] rounded-full blur-[150px] opacity-20 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-[420px] relative z-10"
            >
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            borderRadius: 16,
                            padding: '10px 12px',
                            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)'
                        }}
                    >
                        <Zap size={24} fill="white" color="white" />
                    </div>
                    <span
                        style={{
                            fontWeight: 800,
                            fontSize: 32,
                            background: 'linear-gradient(135deg, #ffffff, #a855f7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-1px',
                        }}
                    >
                        VideoFlow
                    </span>
                </div>

                {/* Glassmorphism Card */}
                <div
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)'
                    }}
                    className="rounded-3xl p-8"
                >
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                            {isSignUp ? 'Create an account' : 'Welcome back'}
                        </h2>
                        <p className="text-gray-400 text-sm">
                            {isSignUp
                                ? 'Start building your professional video projects today.'
                                : 'Sign in to continue to your workspace.'}
                        </p>
                    </div>

                    {errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl mb-6 text-center"
                        >
                            {errorMsg}
                        </motion.div>
                    )}

                    <form onSubmit={handleAuth} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider ml-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-500" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Password</label>
                                {!isSignUp && (
                                    <a href="#" className="text-xs text-[#a855f7] hover:text-white transition-colors">Forgot password?</a>
                                )}
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-500" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent transition-all"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#c026d3] text-white font-semibold py-3.5 px-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    {isSignUp ? 'Create Account' : 'Sign In'}
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-400">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setErrorMsg('');
                            }}
                            className="text-white font-semibold hover:text-[#a855f7] transition-colors"
                        >
                            {isSignUp ? 'Sign in' : 'Sign up for free'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
