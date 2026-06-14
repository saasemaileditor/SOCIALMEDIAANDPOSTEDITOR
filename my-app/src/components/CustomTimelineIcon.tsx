import React from 'react';

interface CustomTimelineIconProps {
    className?: string;
    activeTarget?: 'canvas' | 'timeline';
    isDark?: boolean;
    strokeWidth?: number | string;
    size?: number;
}

export const CustomTimelineIcon: React.FC<CustomTimelineIconProps> = ({ 
    className = '', 
    activeTarget = 'canvas',
    isDark = false,
    strokeWidth = 2,
    size = 24
}) => {
    const activeColor = isDark ? '#e5e7eb' : '#1f2937'; // gray-200 : gray-800
    const inactiveColor = isDark ? '#6b7280' : '#9ca3af'; // gray-500 : gray-400

    const canvasColor = activeTarget === 'canvas' ? activeColor : inactiveColor;
    const timelineColor = activeTarget === 'timeline' ? activeColor : inactiveColor;

    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            strokeWidth={strokeWidth} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            {/* RectangleGraphic - Canvas Mode */}
            <g transform="translate(4, 0.5) scale(0.6666)" stroke={canvasColor}>
                <rect width="20" height="12" x="2" y="6" rx="2" />
            </g>
            
            {/* RulerGraphic - Timeline Mode */}
            <g transform="translate(4, 6.4) scale(0.6666)" stroke={timelineColor}>
                <path d="M10 15v-3" />
                <path d="M14 15v-3" />
                <path d="M18 15v-3" />
                <path d="M6 15v-3" />
                <rect x="2" y="12" width="20" height="8" rx="2" />
            </g>
        </svg>
    );
};
