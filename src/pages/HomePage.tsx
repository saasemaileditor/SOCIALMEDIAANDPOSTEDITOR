import { useState } from 'react';
import { Sparkles, Zap, Monitor, Smartphone, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';

const RATIOS = [
    {
        id: '16:9',
        label: '16:9',
        sublabel: 'YouTube / Landscape',
        icon: Monitor,
        width: 1920,
        height: 1080,
        emoji: '🖥️',
        gradient: 'from-violet-600 to-indigo-600',
        previewW: 160,
        previewH: 90,
    },
    {
        id: '9:16',
        label: '9:16',
        sublabel: 'Reels / TikTok / Portrait',
        icon: Smartphone,
        width: 1080,
        height: 1920,
        emoji: '📱',
        gradient: 'from-pink-500 to-rose-500',
        previewW: 67,
        previewH: 120,
    },
    {
        id: '1:1',
        label: '1:1',
        sublabel: 'Instagram / Square',
        icon: Square,
        width: 1080,
        height: 1080,
        emoji: '◻️',
        gradient: 'from-amber-500 to-orange-500',
        previewW: 110,
        previewH: 110,
    },
];

export default function Home() {
    const [hovered, setHovered] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleSelect = async (ratio: typeof RATIOS[0]) => {
        if (isCreating) return;
        setIsCreating(true);

        try {
            // 0. Get the current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("You must be logged in to create a project.");

            // 1. Create the project in the database
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    width: ratio.width,
                    height: ratio.height,
                    aspect_ratio: ratio.id,
                    title: 'Untitled Project',
                    user_id: user.id
                })
                .select('id')
                .single();

            if (error) throw error;

            // 2. Open the editor with the new database ID (Canva/Figma style)
            const url = `/editor/${data.id}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error("Failed to create project:", error);
            alert("Failed to create project. Check console for details.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
        >
            {/* ── Navbar ── */}
            <nav
                style={{
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                }}
                className="flex items-center justify-between px-8 py-4"
            >
                <div className="flex items-center gap-3">
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            borderRadius: 12,
                            padding: '6px 8px',
                        }}
                    >
                        <Zap size={18} fill="white" color="white" />
                    </div>
                    <span
                        style={{
                            fontWeight: 700,
                            fontSize: 20,
                            background: 'linear-gradient(135deg, #a78bfa, #f0abfc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.5px',
                        }}
                    >
                        VideoFlow
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    {['Templates', 'Pricing', 'Blog'].map((link) => (
                        <a
                            key={link}
                            href="#"
                            style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: 14,
                                fontWeight: 500,
                                textDecoration: 'none',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                        >
                            {link}
                        </a>
                    ))}
                    <button
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 18px',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
                            transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        Sign In
                    </button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <main className="flex-1 flex flex-col items-center justify-center px-6" style={{ paddingTop: 72, paddingBottom: 80 }}>
                {/* Badge */}
                <div
                    className="flex items-center gap-2 mb-6"
                    style={{
                        background: 'rgba(124,58,237,0.18)',
                        border: '1px solid rgba(124,58,237,0.4)',
                        borderRadius: 100,
                        padding: '5px 14px',
                    }}
                >
                    <Sparkles size={13} color="#a78bfa" />
                    <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>
                        AI-Powered Video Editor
                    </span>
                </div>

                {/* Heading */}
                <h1
                    style={{
                        fontSize: 'clamp(36px, 6vw, 72px)',
                        fontWeight: 800,
                        textAlign: 'center',
                        lineHeight: 1.1,
                        letterSpacing: '-2px',
                        color: 'white',
                        marginBottom: 20,
                        maxWidth: 780,
                    }}
                >
                    Create stunning videos{' '}
                    <span
                        style={{
                            background: 'linear-gradient(135deg, #a78bfa, #f0abfc)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        in seconds
                    </span>
                </h1>

                <p
                    style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 18,
                        textAlign: 'center',
                        maxWidth: 520,
                        lineHeight: 1.6,
                        marginBottom: 56,
                    }}
                >
                    Pick your canvas format and jump straight into the editor. No signup needed to start.
                </p>

                {/* Ratio Cards */}
                <p
                    style={{
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        marginBottom: 24,
                    }}
                >
                    Choose your format to get started
                </p>

                <div className="flex items-stretch gap-6" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                    {RATIOS.map((ratio) => {
                        const isHovered = hovered === ratio.id;
                        return (
                            <button
                                key={ratio.id}
                                onClick={() => handleSelect(ratio)}
                                onMouseEnter={() => setHovered(ratio.id)}
                                onMouseLeave={() => setHovered(null)}
                                style={{
                                    background: isHovered
                                        ? 'rgba(255,255,255,0.10)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: isHovered
                                        ? '1.5px solid rgba(167,139,250,0.7)'
                                        : '1.5px solid rgba(255,255,255,0.10)',
                                    borderRadius: 20,
                                    padding: '32px 36px',
                                    width: 220,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 16,
                                    cursor: 'pointer',
                                    transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                                    transform: isHovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                                    boxShadow: isHovered
                                        ? '0 20px 40px rgba(124,58,237,0.25)'
                                        : '0 2px 12px rgba(0,0,0,0.2)',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >
                                {/* Preview rectangle */}
                                <div
                                    style={{
                                        width: ratio.previewW,
                                        height: ratio.previewH,
                                        borderRadius: ratio.id === '9:16' ? 10 : 6,
                                        background: isHovered
                                            ? `linear-gradient(135deg, rgba(124,58,237,0.4), rgba(168,85,247,0.25))`
                                            : 'rgba(255,255,255,0.08)',
                                        border: isHovered
                                            ? '2px solid rgba(167,139,250,0.6)'
                                            : '2px solid rgba(255,255,255,0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.22s ease',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span style={{ fontSize: 24 }}>{ratio.emoji}</span>
                                </div>

                                {/* Label */}
                                <div style={{ textAlign: 'center' }}>
                                    <div
                                        style={{
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: 22,
                                            letterSpacing: '-0.5px',
                                            marginBottom: 4,
                                        }}
                                    >
                                        {ratio.label}
                                    </div>
                                    <div
                                        style={{
                                            color: 'rgba(255,255,255,0.45)',
                                            fontSize: 12,
                                            fontWeight: 500,
                                        }}
                                    >
                                        {ratio.sublabel}
                                    </div>
                                </div>

                                {/* CTA */}
                                <div
                                    style={{
                                        marginTop: 4,
                                        padding: '7px 18px',
                                        borderRadius: 100,
                                        background: isHovered
                                            ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                                            : 'rgba(255,255,255,0.07)',
                                        color: isHovered ? 'white' : 'rgba(255,255,255,0.4)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        transition: 'all 0.2s ease',
                                        boxShadow: isHovered ? '0 4px 12px rgba(124,58,237,0.4)' : 'none',
                                    }}
                                >
                                    {isHovered ? 'Open Editor →' : `${ratio.width} × ${ratio.height}`}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </main>

            {/* ── Footer ── */}
            <footer
                style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    padding: '20px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: 13,
                }}
            >
                © 2026 VideoFlow. Built for creators.
            </footer>
        </div>
    );
}
