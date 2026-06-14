'use client';
import { useEffect } from 'react';

interface GlobalLoaderProps {
    className?: string;
    size?: number;
    fullScreen?: boolean;
}

export function GlobalLoader({
    className,
    size = 80,
    fullScreen = true
}: GlobalLoaderProps) {
    useEffect(() => {
        if (fullScreen) {
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [fullScreen]);

    const loader = (
        <div className="relative flex items-center justify-center">
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes global-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-global-spin {
                    animation: global-spin 1.2s linear infinite !important;
                }
            `}} />
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                className={`animate-global-spin ${className || ''}`}
            >
                {/* Background track */}
                <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-gray-200 dark:text-gray-700 opacity-30"
                />
                {/* App purple spinner segment - solid color, no gradient */}
                <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="66 198"
                    strokeDashoffset="0"
                />
            </svg>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 dark:bg-black/90 backdrop-blur-md">
                {loader}
            </div>
        );
    }
    return loader;
}
