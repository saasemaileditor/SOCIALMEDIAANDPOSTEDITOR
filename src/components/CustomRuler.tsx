import React from 'react';

interface CustomRulerProps {
    size?: number | string;
    className?: string;
    color?: string;
    strokeWidth?: number | string;
}

export const CustomRuler: React.FC<CustomRulerProps> = ({ 
    size = 24, 
    className = '', 
    color = 'currentColor',
    strokeWidth = 2
}) => {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke={color} 
            strokeWidth={strokeWidth} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="M10 15v-3" />
            <path d="M14 15v-3" />
            <path d="M18 15v-3" />
            <path d="M6 15v-3" />
            <rect x="2" y="12" width="20" height="8" rx="2" />
        </svg>
    );
};
