import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { UniversalPanel } from './UniversalPanel';
import { Video, Play, ChevronLeft, ChevronRight, Upload, UploadCloud, Check, X, Folder, Trash2, MoreHorizontal, Info, FolderOpen, Download, CheckSquare2, FolderMinus, Pencil } from 'lucide-react';
import { useUserAssets, useInvalidateUserAssets, type UserAsset } from '../hooks/useUserAssets';
import { VIDEO_RULES, validateVideo } from '../utils/validators/videoRules';
import { IMAGE_RULES, validateImage } from '../utils/validators/imageRules';
import { uploadAssetToSupabase, deleteAssetFromSupabase } from '../utils/supabaseUpload';

interface YourAssetsPanelProps {
    onClose: () => void;
    isDark: boolean;
    addSafeBoxElement: (type: string, size: [number, number], position: null, mediaProps: { url: string; thumbnail: string; label: string }) => void;
}

type AssetTab = 'Videos' | 'Images' | 'Elements' | 'Animations' | 'Effects';
const ASSET_TABS: AssetTab[] = ['Videos', 'Images', 'Elements', 'Animations', 'Effects'];

// AssetItem is now just an alias for UserAsset for clarity in this file
type AssetItem = UserAsset;

// ── Time helper ─────────────────────────────────────────────────────────────
function timeAgo(dateStr: string | undefined | null): string {
    if (!dateStr) return 'unknown time';
    const ms = new Date(dateStr).getTime();
    if (isNaN(ms)) return 'unknown time';
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return `${diff} second${diff !== 1 ? 's' : ''} ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d !== 1 ? 's' : ''} ago`;
}

export const YourAssetsPanel: React.FC<YourAssetsPanelProps> = ({ onClose, isDark, addSafeBoxElement }) => {
    const [assetsSubTab, setAssetsSubTab] = useState<AssetTab>('Videos');
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const invalidateAssets = useInvalidateUserAssets();
    const hasSelection = selectedAssetIds.size > 0;
    const [activeMenu, setActiveMenu] = useState<{ id: string; asset: AssetItem; x: number; y: number } | null>(null);

    const clearSelection = () => setSelectedAssetIds(new Set());

    const handleBulkDelete = async () => {
        setIsDeleting(true);
        const selectedIds = Array.from(selectedAssetIds);
        const assetsToDelete = flatAssets.filter(a => a.id && selectedIds.includes(a.id)) as AssetItem[];
        for (const asset of assetsToDelete) {
            if (asset.id) {
                await deleteAssetFromSupabase(asset.id, asset.file_url);
            }
        }
        setIsDeleting(false);
        setShowDeleteModal(false);
        clearSelection();
        invalidateAssets(assetsSubTab);
    };

    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSet = new Set(selectedAssetIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedAssetIds(newSet);
    };

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useUserAssets(assetsSubTab, searchQuery);
    const flatAssets = data?.pages.flatMap((page) => page.data) ?? [];

    // ── Upload Logic ──────────────────────────────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploadError(null);

        // Step 1 — Rulebook check (browser-side, free)
        let validationResult: { valid: boolean; error?: string } = { valid: true };
        if (assetsSubTab === 'Videos') {
            validationResult = validateVideo(file);
        } else if (assetsSubTab === 'Images') {
            validationResult = validateImage(file);
        } else {
            setUploadError(`Upload for ${assetsSubTab} is coming soon!`);
            return;
        }

        if (!validationResult.valid) {
            setUploadError(validationResult.error ?? 'Invalid file.');
            return;
        }

        // Step 2 — Upload to Supabase
        setIsUploading(true);
        const assetType = assetsSubTab === 'Videos' ? 'video' : 'image';
        const result = await uploadAssetToSupabase(file, assetType);
        setIsUploading(false);

        if (!result.success) {
            setUploadError(result.error ?? 'Upload failed.');
            return;
        }

        // Step 3 — Refresh the grid instantly
        invalidateAssets(assetsSubTab);
    };

    const getAcceptString = () => {
        if (assetsSubTab === 'Videos') return VIDEO_RULES.acceptString;
        if (assetsSubTab === 'Images') return IMAGE_RULES.acceptString;
        return undefined;
    };

    // ── Sliding indicator ──────────────────────────────────────────────────
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

    useLayoutEffect(() => {
        const idx = ASSET_TABS.indexOf(assetsSubTab);
        const el = tabRefs.current[idx];
        if (el) {
            setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
        }
    }, [assetsSubTab]);

    // ── Horizontal chevron-scroll ─────────────────────────────────────────────
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = useCallback(() => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
        }
    }, []);

    const startScroll = useCallback((direction: 'left' | 'right') => {
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = window.setInterval(() => {
            if (!scrollRef.current) return;
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            if (direction === 'left' && scrollLeft <= 0) {
                if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
                return;
            }
            if (direction === 'right' && scrollLeft + clientWidth >= scrollWidth - 1) {
                if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
                return;
            }
            scrollRef.current.scrollBy({ left: direction === 'left' ? -5 : 5, behavior: 'auto' });
        }, 16);
    }, []);

    const stopScroll = useCallback(() => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => {
            window.removeEventListener('resize', checkScroll);
            if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        };
    }, [checkScroll]);

    return (
        <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
            <UniversalPanel
                title="Your Assets"
                onClose={onClose}
                items={flatAssets}
                width={480}
                height="100%"
                itemHeight={140}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                placeholder={`Search ${assetsSubTab.toLowerCase()}...`}
                isLoading={isLoading}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                fetchNextPage={fetchNextPage}
                getItemId={(el) => (el as AssetItem).id ?? 'asset'}
                getItemLabel={(el) => (el as AssetItem).file_name ?? ''}
                panelName="Your Assets"
                panelIcon={Video}
                isDark={isDark}
                showCloseButton={true}
                emptyStateContent={
                    <div className="flex flex-col items-center justify-center text-center px-6">
                        <div className={`w-32 h-32 rounded-3xl border-2 border-dashed flex items-center justify-center mb-4 transition-colors ${isDark
                            ? 'border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#7c3aed]'
                            : 'border-[#7c3aed]/30 bg-[#7c3aed]/5 text-[#7c3aed]'
                            }`}>
                            <UploadCloud size={56} />
                        </div>
                        <p className={`text-base font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                            No {assetsSubTab.toLowerCase()} yet
                        </p>
                        <p className={`text-sm max-w-[200px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Upload your first file to get started
                        </p>
                    </div>
                }
                customHeaderContent={
                    <>
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept={getAcceptString()}
                            className="hidden"
                        />

                        {/* Upload Error Banner */}
                        {uploadError && (
                            <div className="w-full mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium">
                                {uploadError}
                            </div>
                        )}

                        {/* Upload Files Button */}
                        <div className="w-full mt-3 mb-1">
                            <button
                                onClick={handleUploadClick}
                                disabled={isUploading}
                                className={`w-full py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${isUploading
                                    ? 'bg-[#7c3aed]/50 cursor-not-allowed text-white/70'
                                    : isDark
                                        ? 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
                                        : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
                                    }`}>
                                <Upload size={16} />
                                {isUploading ? 'Uploading...' : 'Upload files'}
                            </button>
                        </div>

                        {/* Underline-style tab strip matching design reference */}
                        <div className="relative mt-1 mb-3" onMouseLeave={stopScroll}>

                            {/* Left chevron */}
                            {canScrollLeft && (
                                <div className={`absolute left-0 top-0 bottom-[2px] w-8 z-10 flex items-center justify-start bg-gradient-to-r pointer-events-none ${isDark ? 'from-[#1e2235] via-[#1e2235]/80 to-transparent' : 'from-white via-white/80 to-transparent'}`}>
                                    <button
                                        onMouseEnter={() => startScroll('left')}
                                        onMouseLeave={stopScroll}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center pointer-events-auto transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Scrollable tab row with sliding indicator */}
                            <div
                                ref={scrollRef}
                                onScroll={checkScroll}
                                className="relative flex overflow-x-auto scrollbar-hide"
                            >
                                {ASSET_TABS.map((tab, idx) => {
                                    const isActive = assetsSubTab === tab;
                                    return (
                                        <button
                                            key={tab}
                                            ref={(el) => { tabRefs.current[idx] = el; }}
                                            onClick={() => {
                                                setAssetsSubTab(tab);
                                                setSearchQuery('');
                                            }}
                                            className={`relative flex-shrink-0 px-4 pb-2.5 pt-1 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors duration-150 ${isActive
                                                ? isDark ? 'text-white' : 'text-gray-900'
                                                : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {tab}
                                        </button>
                                    );
                                })}

                                {/* Sliding purple underline indicator */}
                                <span
                                    className="absolute bottom-0 h-[2px] bg-[#7c3aed] rounded-full pointer-events-none"
                                    style={{
                                        left: indicatorStyle.left,
                                        width: indicatorStyle.width,
                                        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
                                    }}
                                />
                            </div>



                            {/* Right chevron */}
                            {canScrollRight && (
                                <div className={`absolute right-0 top-0 bottom-[2px] w-8 z-10 flex items-center justify-end bg-gradient-to-l pointer-events-none ${isDark ? 'from-[#1e2235] via-[#1e2235]/80 to-transparent' : 'from-white via-white/80 to-transparent'}`}>
                                    <button
                                        onMouseEnter={() => startScroll('right')}
                                        onMouseLeave={stopScroll}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center pointer-events-auto transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                }
                renderItem={(el) => {
                    const asset = el as AssetItem;
                    const isSelected = asset.id ? selectedAssetIds.has(asset.id) : false;

                    if (assetsSubTab === 'Videos') {
                        const duration = typeof asset.metadata?.duration_seconds === 'number'
                            ? `${asset.metadata.duration_seconds}s`
                            : null;
                        return (
                            <div
                                onClick={(e) => {
                                    if (hasSelection && asset.id) {
                                        toggleSelection(e, asset.id);
                                    } else {
                                        addSafeBoxElement(
                                            'videoPlaceholder',
                                            [280, 180],
                                            null,
                                            { url: asset.file_url, thumbnail: '', label: asset.file_name }
                                        );
                                    }
                                }}
                                className={`relative w-full h-[140px] rounded-xl overflow-hidden cursor-pointer group ${isSelected
                                    ? `ring-2 ring-[#7c3aed] border-transparent ${isDark ? 'bg-[#161625]' : 'bg-gray-50'}`
                                    : `border ${isDark ? 'border-[#2a2d45] bg-[#161625]' : 'border-gray-200 bg-gray-50'}`
                                    }`}
                            >
                                <video
                                    src={asset.file_url}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                                {duration && (
                                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                                        <span className="text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">{duration}</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 pointer-events-none">
                                    <span className="text-[10px] font-bold text-white bg-[#7c3aed]/80 px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">VIDEO</span>
                                </div>

                                {/* Checkbox - top left, slides up/down with selection mode */}
                                <button
                                    onClick={(e) => {
                                        if (asset.id) toggleSelection(e, asset.id);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                    className={`absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center transition-all duration-300 cursor-pointer z-20 ${isSelected
                                        ? 'bg-[#7c3aed] border-none text-white opacity-100 translate-y-0 shadow-sm'
                                        : hasSelection
                                            ? 'bg-white border border-gray-300 text-transparent opacity-100 translate-y-0 shadow-sm hover:border-gray-400'
                                            : 'bg-white border border-gray-300 text-transparent opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 shadow-sm hover:border-gray-400'
                                        }`}
                                >
                                    {isSelected && <Check size={16} strokeWidth={2.5} className="mt-[0.5px]" />}
                                </button>

                                {/* 3-dot menu - hidden when any asset is selected */}
                                {!hasSelection && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setActiveMenu(prev =>
                                                prev?.id === asset.id
                                                    ? null
                                                    : { id: asset.id, asset, x: rect.right, y: rect.top }
                                            );
                                        }}
                                        className="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center cursor-pointer z-20 opacity-0 group-hover:opacity-100 transition-all bg-white shadow-sm text-gray-500 hover:text-white hover:bg-[#7c3aed]"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                )}

                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="bg-white/20 backdrop-blur-md p-2 rounded-full shadow-lg">
                                        <Play size={20} className="text-white fill-current" />
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    if (assetsSubTab === 'Images') {
                        return (
                            <div
                                onClick={(e) => {
                                    if (hasSelection && asset.id) {
                                        toggleSelection(e, asset.id);
                                    }
                                    // else: TODO: Add image to canvas
                                }}
                                className={`relative w-full h-[140px] rounded-xl overflow-hidden cursor-pointer group ${isSelected
                                    ? `ring-2 ring-[#7c3aed] border-transparent ${isDark ? 'bg-[#161625]' : 'bg-gray-50'}`
                                    : `border ${isDark ? 'border-[#2a2d45] bg-[#161625]' : 'border-gray-200 bg-gray-50'}`
                                    }`}
                            >
                                <img
                                    src={asset.file_url}
                                    alt={asset.file_name}
                                    className="w-full h-full object-cover"
                                />

                                {/* Checkbox - top left, slides up/down with selection mode */}
                                <button
                                    onClick={(e) => {
                                        if (asset.id) toggleSelection(e, asset.id);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                    className={`absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center transition-all duration-300 cursor-pointer z-20 ${isSelected
                                        ? 'bg-[#7c3aed] border-none text-white opacity-100 translate-y-0 shadow-sm'
                                        : hasSelection
                                            ? 'bg-white border border-gray-300 text-transparent opacity-100 translate-y-0 shadow-sm hover:border-gray-400'
                                            : 'bg-white border border-gray-300 text-transparent opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 shadow-sm hover:border-gray-400'
                                        }`}
                                >
                                    {isSelected && <Check size={16} strokeWidth={2.5} className="mt-[0.5px]" />}
                                </button>

                                {/* 3-dot menu - hidden when any asset is selected */}
                                {!hasSelection && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setActiveMenu(prev =>
                                                prev?.id === asset.id
                                                    ? null
                                                    : {
                                                        id: asset.id,
                                                        asset,
                                                        x: Math.min(rect.right + 12, window.innerWidth - 248),
                                                        y: rect.top,
                                                    }
                                            );
                                        }}
                                        className="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center cursor-pointer z-20 opacity-0 group-hover:opacity-100 transition-all bg-white shadow-sm text-gray-500 hover:text-white hover:bg-[#7c3aed]"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                )}
                            </div>
                        );
                    }
                    return (
                        <div className={`w-full h-[140px] rounded-xl border flex items-center justify-center ${isDark ? 'border-[#2a2d45] bg-[#161625] text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                            Coming Soon
                        </div>
                    );
                }}
            />

            {/* ── Floating Action Bar ── */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4 transition-transform duration-300 ease-in-out pointer-events-none ${hasSelection ? 'translate-y-0' : 'translate-y-full'
                    }`}
            >
                <div className={`w-[300px] flex items-center justify-between px-4 py-3 rounded-2xl shadow-2xl pointer-events-auto ${isDark
                    ? 'bg-[#1e2235] border border-[#2a2d45]'
                    : 'bg-white border border-gray-200'
                    }`}>
                    {/* Left: X | Count */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={clearSelection}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                            title="Clear selection"
                        >
                            <X size={18} />
                        </button>
                        {/* Divider between X and count */}
                        <div className={`w-px h-5 ${isDark ? 'bg-[#2a2d45]' : 'bg-gray-200'}`} />
                        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                            {selectedAssetIds.size} selected
                        </span>
                    </div>

                    {/* Right: Folder + Trash */}
                    <div className="flex items-center gap-3">
                        <button
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                            title="Move to folder (coming soon)"
                        >
                            <Folder size={18} />
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                            title="Delete selected"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Delete Confirmation Modal (Full-screen Portal) ── */}
            {showDeleteModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className={`w-[400px] rounded-2xl shadow-2xl p-6 flex flex-col ${isDark ? 'bg-[#1e2235] border border-[#2a2d45]' : 'bg-white border border-gray-200'
                        }`}>
                        <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Move {selectedAssetIds.size} item{selectedAssetIds.size > 1 ? 's' : ''} to Trash?
                        </h3>
                        <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Items can be restored from Trash in the next 30 days.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-60"
                            >
                                {isDeleting ? 'Deleting...' : 'Move to Trash'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Asset Context Menu Portal ── */}
            {activeMenu && ReactDOM.createPortal(
                <>
                    {/* Invisible backdrop to close menu */}
                    <div
                        className="fixed inset-0 z-[9990]"
                        onClick={() => setActiveMenu(null)}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            zIndex: 9991,
                            left: activeMenu.x,
                            top: Math.max(8, Math.min(activeMenu.y, window.innerHeight - 320)),
                        }}
                        className={`w-60 rounded-xl shadow-2xl border overflow-hidden ${isDark ? 'bg-[#1e2235] border-[#2a2d45]' : 'bg-white border-gray-200'
                            }`}
                    >
                        {/* Header: file name + pencil + time */}
                        <div className="px-4 pt-3 pb-2.5">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-lg font-bold truncate max-w-[175px] leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {activeMenu.asset.file_name.replace(/\.[^/.]+$/, '')}
                                </span>
                                <Pencil size={14} className={`flex-shrink-0 ${isDark ? 'text-white' : 'text-gray-900'}`} strokeWidth={2} />
                            </div>
                            <p className={`text-[11px] leading-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                Uploaded {timeAgo(activeMenu.asset.created_at)}
                            </p>
                        </div>

                        {/* Divider */}
                        <div className={`h-px ${isDark ? 'bg-[#2a2d45]' : 'bg-gray-100'}`} />

                        {/* Menu items */}
                        {([
                            { Icon: Info, label: 'Details', onAction: undefined },
                            { Icon: FolderOpen, label: 'Move', onAction: undefined },
                            { Icon: Download, label: 'Download', onAction: undefined },
                            { Icon: CheckSquare2, label: 'Select items', onAction: () => setSelectedAssetIds(prev => new Set([...prev, activeMenu!.id])) },
                            { Icon: FolderMinus, label: 'Remove from folder', onAction: undefined },
                        ] as { Icon: React.FC<{ size?: number; className?: string }>; label: string; onAction: (() => void) | undefined }[]).map(({ Icon, label, onAction }) => (
                            <button
                                key={label}
                                onClick={(e) => { e.stopPropagation(); setActiveMenu(null); if (onAction) onAction(); }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={16} />
                                {label}
                            </button>
                        ))}

                        {/* Move to Trash */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setActiveMenu(null); setShowDeleteModal(true); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 mb-1 text-sm font-medium transition-colors cursor-pointer ${isDark ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <Trash2 size={16} />
                            Move to Trash
                        </button>
                    </div>
                </>,
                document.body
            )}

        </div>
    );
};
