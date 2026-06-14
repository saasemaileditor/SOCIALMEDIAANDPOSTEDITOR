import React, { useState } from 'react';
import { Sparkles, MoreVertical } from 'lucide-react';

interface PropertiesPanelProps {
    isDark: boolean;
    selectedId: string | null;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ isDark, selectedId }) => {
    const [panelMode, setPanelMode] = useState<'universal' | 'ai'>('universal');

    return (
        <div className={`w-[280px] px-4 pt-[5px] pb-4 flex flex-col gap-4 flex-shrink-0 overflow-y-auto transition-colors duration-200 z-10 relative ${isDark ? 'bg-[#1e2235] border-l border-[#2a2d45]' : 'bg-white border-l border-gray-200'}`}>
            {/* Top Bar: Toggle & Settings */}
            <div className="flex items-center w-full gap-[5px]">
                {/* Segmented Control Toggle */}
                <div className={`flex flex-1 p-1 rounded-xl select-none -ml-[11px] ${isDark ? 'bg-[#161625] border border-[#2a2d45]' : 'bg-gray-100'}`}>
                    <button
                        onClick={() => setPanelMode('universal')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${panelMode === 'universal'
                            ? 'bg-[#7c3aed] text-white shadow-md'
                            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Universal
                    </button>
                    <button
                        onClick={() => setPanelMode('ai')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${panelMode === 'ai'
                            ? 'bg-[#7c3aed] text-white shadow-md'
                            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Sparkles size={12} />
                        AI Mode
                    </button>
                </div>

                <button className={`px-0.5 py-1.5 flex-shrink-0 rounded-lg transition-colors -mr-[11px] ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                    <MoreVertical size={18} />
                </button>
            </div>

            {/* Content Area */}
            {panelMode === 'ai' ? (
                <div className={`flex flex-col items-center justify-center py-8 text-center px-2 border border-dashed rounded-xl mt-2 ${isDark ? 'border-[#2a2d45] bg-[#161625]' : 'border-gray-200 bg-gray-50'}`}>
                    <Sparkles size={24} className="text-[#7c3aed] mb-3" />
                    <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>AI Assistant Active</span>
                    <span className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Describe changes to automatically apply them to the element.</span>
                </div>
            ) : (
                <div className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selectedId ? (
                        <div>Properties for selected element...</div>
                    ) : (
                        <div>Select an element to view its properties.</div>
                    )}
                </div>
            )}
        </div>
    );
};
