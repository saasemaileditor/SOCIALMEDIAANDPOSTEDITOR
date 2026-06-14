import React, { useRef } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { Layers } from 'lucide-react';

interface LayerPanelProps {
    isDark: boolean;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ isDark, selectedId, setSelectedId }) => {
    const nodes = useEditorStore((s) => s.nodes);
    const reversedNodes = [...nodes].reverse();
    const rootRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={rootRef} className={`h-full flex flex-col overflow-hidden transition-colors duration-200 ${isDark ? 'bg-[#1e1e2e] border-t border-r border-[#2a2d45]' : 'bg-white border-t border-r border-gray-200'}`}>
            {/* Header */}
            <div className={`flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 ${isDark ? 'border-[#2a2d45]' : 'border-gray-200'}`}>
                <Layers size={14} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                <span className={`text-xs font-bold tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>LAYERS</span>
                <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#2a2d45] text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                    {nodes.length}
                </span>
            </div>

            {/* Layer List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
                {reversedNodes.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-full gap-2 opacity-50 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Layers size={20} />
                        <span className="text-xs">No layers yet</span>
                    </div>
                ) : (
                    reversedNodes.map((node, idx) => {
                        const isSelected = node.id === selectedId;
                        return (
                            <div
                                key={node.id}
                                onClick={() => setSelectedId(node.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors rounded-[10px] shadow-sm ${
                                    isSelected
                                        ? isDark
                                            ? 'bg-[#2d1f5e] border border-[#7c3aed]/40'
                                            : 'bg-[#ede9fe] border border-[#7c3aed]/30'
                                        : isDark
                                            ? 'bg-[#2a2d45] hover:bg-[#323652] border border-transparent'
                                            : 'bg-[#e5e7eb] hover:bg-[#d1d5db] border border-transparent'
                                }`}
                            >
                                {/* Color swatch */}
                                <div
                                    className="w-3 h-3 rounded-sm flex-shrink-0 opacity-80"
                                    style={{ backgroundColor: isSelected ? '#7c3aed' : isDark ? '#4a4a6a' : '#9ca3af' }}
                                />

                                {/* Label */}
                                <span className={`flex-1 text-[11px] font-semibold truncate ${
                                    isSelected
                                        ? isDark ? 'text-white' : 'text-[#7c3aed]'
                                        : isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                    {node.type ?? `Layer ${nodes.length - idx}`}
                                </span>

                                {/* Layer number */}
                                <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {nodes.length - idx}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
