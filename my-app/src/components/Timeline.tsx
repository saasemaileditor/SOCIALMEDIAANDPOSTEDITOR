import React, { useRef, useEffect, useState, useMemo, useCallback, startTransition } from 'react';
import ReactDOM from 'react-dom';
import { Play, Pause, Plus, LayoutGrid, Music, Maximize, CloudUpload, StepForward, Scissors, Copy, Trash2, RectangleHorizontal, SkipBack, SkipForward } from 'lucide-react';
import { useFloating, shift, offset, autoUpdate } from '@floating-ui/react';
import { useEditorStore, getHistoryControls } from '../store/useEditorStore';
import { CustomTimelineIcon } from './CustomTimelineIcon';

interface TimelineProps {
    currentTime: number;
    setCurrentTime: (time: number | ((prev: number) => number)) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isDark: boolean;
    onOpenMediaPanel: () => void;
    canvasZoom: number;
    setCanvasZoom: (z: number) => void;
    zoomTarget: 'canvas' | 'timeline';
    setZoomTarget: (target: 'canvas' | 'timeline') => void;
}

const PROJECT_FPS = 30; // Default FPS for timecode display

export const Timeline = ({
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    isDark,
    onOpenMediaPanel,
    canvasZoom,
    setCanvasZoom,
    zoomTarget,
    setZoomTarget,
}: TimelineProps) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    };




    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [zoom, setZoom] = useState(380); // 10 to 1000 zoom scale
    const [localTimelineZoom, setLocalTimelineZoom] = useState<number | null>(null);
    const [localCanvasZoom, setLocalCanvasZoom] = useState<number | null>(null);

    // Sync local slider state back to global when the heavy transition finishes
    useEffect(() => { setLocalTimelineZoom(null); }, [zoom]);
    useEffect(() => { setLocalCanvasZoom(null); }, [canvasZoom]);

    const timelineRef = useRef<HTMLDivElement>(null);
    // New state: scrubber follows resize handle and fades while dragging
    const [scrubberTime, setScrubberTime] = useState(currentTime);
    const [scrubberFaded, setScrubberFaded] = useState(false);
    const [dragState, setDragState] = useState<{
        scrubberSnapped: boolean;
        resizeTooltip: { x: number; y: number } | null;
    }>({ scrubberSnapped: false, resizeTooltip: null });


    // ─── Global Scene State (shared undo/redo via zustand-travel) ──────────────
    const scenes = useEditorStore((state) => state.scenes);
    const { addScene, updateScene, removeScene } = useEditorStore();

    // Derived duration from scenes (minimum 5s, like Canva)
    const duration = useMemo(() => {
        const contentDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
        return Math.max(contentDuration, 5.0);
    }, [scenes]);

    // Smart snap: only pull the scrubber back if the total duration shrinks (via undo, delete, or shrinking a clip)
    const prevDuration = useRef(duration);
    useEffect(() => {
        if (duration < prevDuration.current) {
            if (currentTime > duration) {
                setCurrentTime(duration);
            }
        }
        prevDuration.current = duration;
    }, [duration, currentTime, setCurrentTime]);

    // Click vs Drag detection for resize handles
    const [pendingResizeClick, setPendingResizeClick] = useState<{
        sceneId: string;
        side: 'left' | 'right';
        startX: number;
        startY: number;
        clickTime: number;
        startDuration: number;
        startLeadingGap: number;
    } | null>(null);
    const RESIZE_DRAG_THRESHOLD = 5; // pixels - must move more than this to be considered a drag

    const [containerWidth, setContainerWidth] = useState(0);
    const tracksScrollRef = useRef<HTMLDivElement>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverScrubberPos, setHoverScrubberPos] = useState<{ top: number; left: number } | null>(null);
    const [activeGapTooltip, setActiveGapTooltip] = useState<{ text: string, pos: { top: number, left: number } } | null>(null);
    const [showPlusDropdown, setShowPlusDropdown] = useState(false);
    const { refs: plusDropdownRefs, floatingStyles: plusDropdownStyles } = useFloating({
        open: showPlusDropdown,
        placement: 'top-start',
        strategy: 'fixed',
        middleware: [offset(8), shift({ padding: 16 })],
        whileElementsMounted: autoUpdate,
    });

    const [showGapDropdown, setShowGapDropdown] = useState(false);
    const { refs: gapDropdownRefs, floatingStyles: gapDropdownStyles } = useFloating({
        open: showGapDropdown,
        placement: 'top',
        strategy: 'fixed',
        middleware: [offset(8), shift({ padding: 16 })],
        whileElementsMounted: autoUpdate,
    });
    const [activeGapIndex, setActiveGapIndex] = useState<number | null>(null);
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

    const [showSceneDropdown, setShowSceneDropdown] = useState(false);
    const { refs: sceneDropdownRefs, floatingStyles: sceneDropdownStyles } = useFloating({
        open: showSceneDropdown,
        placement: 'top',
        strategy: 'fixed',
        middleware: [offset(4), shift({ padding: 16 })],
        whileElementsMounted: autoUpdate,
    });



    const [resizingScene, setResizingScene] = useState<{
        id: string;
        side: 'left' | 'right';
        startX: number;
        startScrollLeft: number;  // scroll offset at drag start — makes deltaX scroll-aware
        startDuration: number;
        startLeadingGap: number;
    } | null>(null);
    // Stores the live mouse X position so the persistent RAF loop can read it every frame
    const liveMouseX = useRef<number>(0);

    const [hoveredHandleSceneId, setHoveredHandleSceneId] = useState<string | null>(null);
    const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);

    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const gapDropdownRef = useRef<HTMLDivElement>(null);
    const sceneDropdownRef = useRef<HTMLDivElement>(null);
    // Refs for left-handle DOM-direct updates — no React re-renders during drag = zero shake
    const spacerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const sceneRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const liveLeftDrag = useRef<{ sceneId: string | null; spacerPx: number; scenePx: number; duration: number }>(
        { sceneId: null, spacerPx: 0, scenePx: 0, duration: 0 }
    );
    const liveRightDrag = useRef<{ sceneId: string | null; scenePx: number; duration: number }>(
        { sceneId: null, scenePx: 0, duration: 0 }
    );
    const grayBarRef = useRef<HTMLDivElement>(null);
    const autoScrollRAF = useRef<number | null>(null);

    // Connect Plus Button reference to Floating UI when opened
    useEffect(() => {
        if (showPlusDropdown && plusBtnRef.current) {
            plusDropdownRefs.setReference(plusBtnRef.current);
        }
    }, [showPlusDropdown, plusDropdownRefs]);

    // Close gap dropdown on click outside
    useEffect(() => {
        if (!showGapDropdown) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-dropdown-trigger="gap"]')) return;
            if (gapDropdownRef.current && !gapDropdownRef.current.contains(target)) {
                setShowGapDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [showGapDropdown]);

    // Close scene dropdown on click outside
    useEffect(() => {
        if (!showSceneDropdown) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-dropdown-trigger="scene"]')) return;
            if (sceneDropdownRef.current && !sceneDropdownRef.current.contains(target)) {
                setShowSceneDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [showSceneDropdown]);

    // Close main dropdown on click outside
    useEffect(() => {
        if (!showPlusDropdown) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                dropdownRef.current && !dropdownRef.current.contains(target) &&
                plusBtnRef.current && !plusBtnRef.current.contains(target)
            ) {
                setShowPlusDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [showPlusDropdown]);


    // Track the tracks scroll area's width to draw full-width rulers
    const recentWidths = useRef<{ width: number, time: number }[]>([]);
    useEffect(() => {
        if (!tracksScrollRef.current) return;
        const observer = new ResizeObserver(() => {
            if (tracksScrollRef.current) {
                const newWidth = tracksScrollRef.current.clientWidth;
                const now = performance.now();

                // Ultimate Loop Breaker (Safety Net for older Safari + Mouse)
                const isLooping = recentWidths.current.some(
                    entry => entry.width === newWidth && (now - entry.time) < 150
                );

                if (isLooping) return; // Break the oscillation loop

                recentWidths.current.push({ width: newWidth, time: now });
                if (recentWidths.current.length > 5) {
                    recentWidths.current.shift();
                }

                setContainerWidth(newWidth);
            }
        });
        observer.observe(tracksScrollRef.current);
        return () => observer.disconnect();
    }, []);

    const pixelsPerSecond = (() => {
        // Map 10-1000 zoom range to a 0.0 -> 1.0 slider ratio
        const zoomRatio = (zoom - 10) / 990;
        // Exponentially scale up to exactly 150x the power (12 * 150 = 1800 max pps)
        return 12 * Math.pow(150, zoomRatio);
    })();

    // Actual pixel width of the video content at current zoom
    const contentWidth = Math.ceil(duration * pixelsPerSecond);
    // 66px for the plus button area + 20px fixed extra visual scrolling gap
    const TAIL_PX = 66 + 20;
    const timelineWidth = Math.max(contentWidth + TAIL_PX, containerWidth);
    // Scrubber is allowed to hit the absolute edge (no dead zone)
    const rulerDuration = timelineWidth / pixelsPerSecond;

    // ─── Filmora "Viewport Leash" (Scrubber physical bounding during zoom) ──
    const prevZoomForLeash = useRef(zoom);

    useEffect(() => {
        // We strictly ONLY want to unleash the leash when the zoom mathematically changes
        if (prevZoomForLeash.current === zoom) return;
        prevZoomForLeash.current = zoom;

        // The user JUST zoomed. Get physical box boundaries of the timeline viewport.
        if (!tracksScrollRef.current) return;

        const scrollLeft = tracksScrollRef.current.scrollLeft;
        const clientWidth = tracksScrollRef.current.clientWidth;

        // Calculate precisely where the zoom is trying to blast the scrubber
        const scrubberPx = timeToPixel(currentTime);

        // Define safe glass walls (with 10px breathing room)
        const leftEdgePx = scrollLeft + 10;
        const rightEdgePx = scrollLeft + clientWidth - 10;

        // If the scrubber is blasting past the walls, overwrite its time to pin it against the glass!
        if (scrubberPx < leftEdgePx) {
            const newTime = pixelToTime(leftEdgePx);
            setCurrentTime(newTime);
            if (scrubberFaded) setScrubberTime(newTime);
        } else if (scrubberPx > rightEdgePx) {
            const newTime = pixelToTime(rightEdgePx);
            setCurrentTime(newTime);
            if (scrubberFaded) setScrubberTime(newTime);
        }
    }, [zoom, pixelsPerSecond, currentTime, scrubberFaded]);

    const canSplitSelectedScene = useMemo(() => {
        if (!selectedSceneId) return false;
        let pastDuration = 0;
        for (const scene of scenes) {
            const start = pastDuration + (scene.leadingGap || 0);
            const end = start + scene.duration;
            if (scene.id === selectedSceneId) {
                // To split, scrubber must be strictly inside the scene (not exactly on edges, giving 0.1s tolerance)
                return currentTime >= start + 0.1 && currentTime <= end - 0.1;
            }
            pastDuration = end;
        }
        return false;
    }, [selectedSceneId, scenes, currentTime]);

    const handleSplitScene = useCallback((sceneIdOverride?: string) => {
        const targetId = sceneIdOverride ?? selectedSceneId;
        if (!targetId) return;
        const currentScenes = useEditorStore.getState().scenes;
        const sceneIndex = currentScenes.findIndex(s => s.id === targetId);
        if (sceneIndex === -1) return;

        let pastDuration = 0;
        for (let i = 0; i < sceneIndex; i++) {
            pastDuration += currentScenes[i].duration + (currentScenes[i].leadingGap || 0);
        }

        const originalScene = currentScenes[sceneIndex];
        const sceneStart = pastDuration + (originalScene.leadingGap || 0);

        const leftDuration = parseFloat((currentTime - sceneStart).toFixed(2));
        const rightDuration = parseFloat((originalScene.duration - leftDuration).toFixed(2));

        if (leftDuration <= 0.1 || rightDuration <= 0.1) return;

        // Update first half
        updateScene(originalScene.id, { duration: leftDuration });

        // Create second half using universal deep clone
        const clonedScene = JSON.parse(JSON.stringify(originalScene));
        const newId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
        clonedScene.id = newId;
        clonedScene.duration = rightDuration;
        clonedScene.leadingGap = 0;

        addScene(clonedScene, sceneIndex + 1);
        getHistoryControls().archive();
        window.dispatchEvent(new CustomEvent('history-updated'));

        setSelectedSceneId(newId);
    }, [selectedSceneId, currentTime, addScene, updateScene]);

    const handleDuplicateScene = useCallback(() => {
        if (!selectedSceneId) return;
        const currentScenes = useEditorStore.getState().scenes;
        const sceneIndex = currentScenes.findIndex(s => s.id === selectedSceneId);
        if (sceneIndex === -1) return;

        const originalScene = currentScenes[sceneIndex];
        // Universal deep clone logic for all future nested properties on scene objects
        const clonedScene = JSON.parse(JSON.stringify(originalScene));
        const newId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
        clonedScene.id = newId;

        // Ensure inserted right after the current scene
        addScene(clonedScene, sceneIndex + 1);
        getHistoryControls().archive();
        window.dispatchEvent(new CustomEvent('history-updated'));

        setSelectedSceneId(newId);
        const priorDuration = currentScenes.slice(0, sceneIndex + 1).reduce((sum, s) => sum + s.duration, 0);
        setCurrentTime(priorDuration);
    }, [selectedSceneId, addScene, setCurrentTime]);

    // ─── Timeline Keyboard Shortcuts ──────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable) return;

            const frameDuration = 1 / PROJECT_FPS;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (!isPlaying && currentTime >= duration - 0.05) {
                        setCurrentTime(0);
                    }
                    setIsPlaying(!isPlaying);
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    if (e.shiftKey) {
                        setCurrentTime((prev: number) => Math.max(0, prev - 1));
                    } else {
                        setCurrentTime((prev: number) => Math.max(0, prev - frameDuration));
                    }
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    if (e.shiftKey) {
                        setCurrentTime((prev: number) => Math.min(rulerDuration, prev + 1));
                    } else {
                        setCurrentTime((prev: number) => Math.min(rulerDuration, prev + frameDuration));
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    setCurrentTime(0);
                    break;

                case 'End':
                    e.preventDefault();
                    setCurrentTime(rulerDuration);
                    break;

                case '+':
                case '=':
                    e.preventDefault();
                    setZoom(prev => Math.min(1000, prev + 100));
                    break;

                case '-':
                    e.preventDefault();
                    setZoom(prev => Math.max(10, prev - 100));
                    break;

                case 's':
                case 'S':
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                        // Find the scene the scrubber is inside — works selected or unselected
                        const currentScenes = useEditorStore.getState().scenes;
                        let pastDur = 0;
                        let targetId: string | undefined;
                        for (const scene of currentScenes) {
                            const start = pastDur + (scene.leadingGap || 0);
                            const end = start + scene.duration;
                            if (currentTime >= start + 0.1 && currentTime <= end - 0.1) {
                                targetId = scene.id;
                                break;
                            }
                            pastDur = end;
                        }
                        if (targetId) {
                            e.preventDefault();
                            handleSplitScene(targetId);
                        }
                    }
                    break;

                case 'd':
                case 'D':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleDuplicateScene();
                    }
                    break;

                case 'Delete':
                case 'Backspace':
                    if (selectedSceneId) {
                        e.preventDefault();
                        removeScene(selectedSceneId);
                        getHistoryControls().archive();
                        window.dispatchEvent(new CustomEvent('history-updated'));
                        setSelectedSceneId(null);
                    }
                    break;

                // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y are handled globally in SaasVideoEditor
                // via getHistoryControls().back() / .forward() which now covers scenes too.
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, setIsPlaying, setCurrentTime, rulerDuration, setZoom, selectedSceneId, removeScene, handleDuplicateScene, handleSplitScene]);


    // ─── Adaptive ruler tick generation (industry-standard: intervals adapt to zoom) ──
    const rulerTicks = useMemo(() => {
        const MIN_MAJOR_TICK_SPACING = 180; // minimum pixels between major tick labels

        // User-requested progression: 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60...
        const NICE_INTERVALS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

        // Pick the smallest interval that keeps labels from overlapping based on actual screen pixels
        let majorInterval = NICE_INTERVALS[NICE_INTERVALS.length - 1];
        for (const interval of NICE_INTERVALS) {
            if (interval * pixelsPerSecond >= MIN_MAJOR_TICK_SPACING) {
                majorInterval = interval;
                break;
            }
        }

        // Sub-divisions per major interval
        const getSubDivisions = (interval: number): number => {
            if (interval <= 0.1) return 5; // 0.02 gap
            if (interval <= 0.2) return 4; // 0.05 gap
            if (interval <= 0.5) return 5; // 0.1 gap
            if (interval <= 1) return 5;   // 0.2 gap
            if (interval <= 2) return 4;   // 0.5 gap
            if (interval <= 5) return 5;   // 1 gap
            if (interval <= 10) return 5;  // 2 gap
            if (interval <= 15) return 3;  // 5 gap
            if (interval <= 30) return 6;  // 5 gap
            if (interval <= 60) return 6;  // 10 gap
            if (interval <= 120) return 4; // 30 gap
            if (interval <= 300) return 5; // 60 gap
            return 6;
        };
        const subDivisions = getSubDivisions(majorInterval);

        const ticks: { time: number; isMajor: boolean }[] = [];
        const totalMajor = Math.ceil(rulerDuration / majorInterval);

        for (let i = 0; i <= totalMajor; i++) {
            const majorTime = parseFloat((i * majorInterval).toFixed(4));
            if (majorTime > rulerDuration) break;
            ticks.push({ time: majorTime, isMajor: true });

            // Sub-ticks within this segment
            if (i < totalMajor) {
                for (let sub = 1; sub < subDivisions; sub++) {
                    const subTime = parseFloat((majorTime + sub * (majorInterval / subDivisions)).toFixed(4));
                    if (subTime <= rulerDuration && subTime < parseFloat(((i + 1) * majorInterval).toFixed(4))) {
                        ticks.push({ time: subTime, isMajor: false });
                    }
                }
            }
        }
        return ticks;
    }, [rulerDuration, pixelsPerSecond]);

    // ─── Time ↔ pixel helpers ─────────────────────────────────────────────────
    const timeToPixel = (t: number) => t * pixelsPerSecond;
    const pixelToTime = (px: number) => {
        const clamped = Math.max(0, px);
        return Math.min(clamped / pixelsPerSecond, rulerDuration);
    };

    const getViewportEdgeState = (clientX: number): 'right' | null => {
        if (!tracksScrollRef.current) return null;
        const rect = tracksScrollRef.current.getBoundingClientRect();
        // Approx half the tooltip width (20px) to detect text pushed off screen
        const threshold = 24;
        if (clientX > rect.right - threshold) return 'right';
        return null;
    };

    const formatTooltipTime = (t: number, edge: 'right' | null = null) => {
        if (edge === 'right') {
            return Math.floor(t) + '...';
        }
        const decimals = zoom >= 400 ? 2 : 1;
        const factor = Math.pow(10, decimals);
        // Truncate cleanly while avoiding strict floating-point underflow (e.g. 0.19999->0.19)
        return (Math.floor(t * factor + 1e-6) / factor).toFixed(decimals) + 's';
    };

    // Magnetic Snapping Utility (4 pixels pull radius)
    const getSnappedTime = (rawTime: number) => {
        if (!rulerTicks || rulerTicks.length === 0) return rawTime;
        const timeSnapThreshold = 4 / pixelsPerSecond;
        let closestTick = rulerTicks[0];
        let minDiff = Infinity;
        for (const tick of rulerTicks) {
            const diff = Math.abs(tick.time - rawTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestTick = tick;
            }
        }
        if (minDiff <= timeSnapThreshold) {
            return closestTick.time;
        }
        return rawTime;
    };

    const handleTimelineMouseMove = (e: React.MouseEvent) => {
        // Don't update hover state during an active resize drag or when scene dropdown is open
        if (resizingScene !== null || showSceneDropdown) {
            setHoverTime(null);
            setHoverScrubberPos(null);
            return;
        }

        // Guard: hide ghost scrubber if hovering exactly over the 3-dot pill
        const target = e.target as HTMLElement;
        if (target.closest('[data-dropdown-trigger="scene"]')) {
            setHoverTime(null);
            setHoverScrubberPos(null);
            return;
        }

        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left - 4;
            const time = getSnappedTime(pixelToTime(x));
            setHoverTime(time);

            setHoverScrubberPos({
                top: tracksScrollRef.current ? tracksScrollRef.current.getBoundingClientRect().top : rect.top,
                left: rect.left + 4 + timeToPixel(time)
            });
        }
    };

    const handleTimelineMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        // Guard 1: resize handle or 3-dot pill
        if (target.closest('[data-resize-handle]') || target.closest('[data-dropdown-trigger="scene"]')) return;

        // Clicking empty timeline area deselects any selected scene
        if (!target.closest('[data-scene-block]')) {
            setSelectedSceneId(null);
        }

        // Guard 2: native vertical scrollbar
        if (tracksScrollRef.current) {
            const el = tracksScrollRef.current;
            const scrollbarWidth = el.offsetWidth - el.clientWidth;
            const scrollRect = el.getBoundingClientRect();
            const threshold = scrollRect.right - scrollbarWidth;
            if (scrollbarWidth > 0 && e.clientX > threshold) return;
        }

        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 4;
        const rawTime = pixelToTime(x);
        const snapped = getSnappedTime(rawTime);

        setIsDraggingPlayhead(true);
        setCurrentTime(snapped);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingPlayhead && timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left - 4;
                setCurrentTime(getSnappedTime(pixelToTime(x)));
            }
        };
        const handleMouseUp = () => setIsDraggingPlayhead(false);

        if (isDraggingPlayhead) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingPlayhead, setCurrentTime, duration]);


    // Simulated Playback Logic
    useEffect(() => {
        let interval: number;
        if (isPlaying) {
            interval = window.setInterval(() => {
                setCurrentTime((prev) => {
                    const nextTime = prev + 0.1;
                    // God-Tier Fix: Look ahead to next frame AND use a 0.001s epsilon buffer.
                    // Guarantees zero overshoots and instantly absorbs floating-point math ghost frames.
                    if (nextTime >= duration - 0.001) {
                        setIsPlaying(false);
                        return duration;
                    }
                    return nextTime;
                });
            }, 100);
        }
        return () => window.clearInterval(interval);
    }, [isPlaying, setIsPlaying, setCurrentTime, duration]);



    // ─── Ruler label formatter (smart: shows m:ss for ≥60s) ──
    const formatRulerLabel = (seconds: number) => {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `${seconds}s`;
    };

    // ─── Scene Resize Handlers ────────────────────────────────────────────────
    const handleResizeStart = (
        e: React.MouseEvent,
        sceneId: string,
        side: 'left' | 'right',
        currentDuration: number
    ) => {
        e.stopPropagation();
        e.preventDefault();
        const scene = scenes.find(s => s.id === sceneId);

        // Set up pending click - we don't know yet if this is a click or drag
        setPendingResizeClick({
            sceneId,
            side,
            startX: e.clientX,
            startY: e.clientY,
            clickTime: Date.now(),
            startDuration: currentDuration,
            startLeadingGap: scene?.leadingGap || 0
        });

        // Don't start resize yet - wait to see if user drags
        // Scrubber stays at current position for now
        setScrubberFaded(true);
        setScrubberTime(currentTime);
        setDragState(prev => ({ ...prev, scrubberSnapped: false }));
    };

    useEffect(() => {
        if (!resizingScene) return;

        const updateDragDOM = () => {
            const currentScrollLeft = tracksScrollRef.current?.scrollLeft ?? 0;
            const deltaX = (liveMouseX.current + currentScrollLeft) - (resizingScene.startX + resizingScene.startScrollLeft);

            const currentScenes = useEditorStore.getState().scenes;
            const sceneIdx = currentScenes.findIndex(s => s.id === resizingScene.id);
            const priorDuration = currentScenes.slice(0, sceneIdx).reduce((sum, s) => sum + s.duration, 0);
            const sceneStartTime = priorDuration + (currentScenes[sceneIdx].leadingGap || 0);

            let currentEdgeTime: number;
            if (resizingScene.side === 'right') {
                const startScenePx = Math.round(resizingScene.startDuration * pixelsPerSecond);
                const minScenePx = Math.round(0.1 * pixelsPerSecond);
                const newScenePxRaw = Math.max(minScenePx, startScenePx + deltaX);
                currentEdgeTime = sceneStartTime + (newScenePxRaw / pixelsPerSecond);
            } else {
                const startLeadingPx = Math.round(resizingScene.startLeadingGap * pixelsPerSecond);
                const startScenePx = Math.round(resizingScene.startDuration * pixelsPerSecond);
                const rightEdge = startLeadingPx + startScenePx;
                const minScenePx = Math.round(0.1 * pixelsPerSecond);

                let newSpacerPxRaw = startLeadingPx + deltaX;
                if (newSpacerPxRaw < 0) {
                    newSpacerPxRaw = 0;
                } else {
                    const newScenePxCheck = rightEdge - newSpacerPxRaw;
                    if (newScenePxCheck < minScenePx) {
                        newSpacerPxRaw = rightEdge - minScenePx;
                    }
                }
                currentEdgeTime = priorDuration + (newSpacerPxRaw / pixelsPerSecond);
            }

            const snapThresholdPx = 5;
            const snapThresholdTime = snapThresholdPx / pixelsPerSecond;
            const distanceToScrubber = Math.abs(currentEdgeTime - scrubberTime);
            const isNearScrubber = distanceToScrubber <= snapThresholdTime;

            if (resizingScene.side === 'right') {
                const startScenePx = Math.round(resizingScene.startDuration * pixelsPerSecond);
                const minScenePx = Math.round(0.1 * pixelsPerSecond);
                let newScenePx = Math.max(minScenePx, startScenePx + deltaX);

                if (isNearScrubber) {
                    const targetScenePx = (scrubberTime - sceneStartTime) * pixelsPerSecond;
                    newScenePx = Math.max(minScenePx, targetScenePx);
                }

                liveRightDrag.current = {
                    sceneId: resizingScene.id,
                    scenePx: newScenePx,
                    duration: newScenePx / pixelsPerSecond,
                };

                const sceneEl = sceneRefs.current.get(resizingScene.id);
                if (sceneEl) sceneEl.style.width = newScenePx + 'px';
            } else {
                const startLeadingPx = Math.round(resizingScene.startLeadingGap * pixelsPerSecond);
                const startScenePx = Math.round(resizingScene.startDuration * pixelsPerSecond);
                const rightEdge = startLeadingPx + startScenePx;
                const minScenePx = Math.round(0.1 * pixelsPerSecond);

                let newSpacerPx = startLeadingPx + deltaX;
                let newScenePx;

                if (newSpacerPx < 0) {
                    newScenePx = startScenePx + Math.abs(newSpacerPx);
                    newSpacerPx = 0;
                } else {
                    newScenePx = rightEdge - newSpacerPx;
                    if (newScenePx < minScenePx) {
                        newScenePx = minScenePx;
                        newSpacerPx = rightEdge - minScenePx;
                    }
                }

                if (isNearScrubber) {
                    const targetSpacerPx = (scrubberTime - priorDuration) * pixelsPerSecond;
                    newSpacerPx = Math.max(0, targetSpacerPx);
                    newScenePx = rightEdge - newSpacerPx;
                    if (newScenePx < minScenePx) {
                        newScenePx = minScenePx;
                        newSpacerPx = rightEdge - minScenePx;
                    }
                }

                liveLeftDrag.current = {
                    sceneId: resizingScene.id,
                    spacerPx: newSpacerPx,
                    scenePx: newScenePx,
                    duration: newScenePx / pixelsPerSecond,
                };

                const spacerEl = spacerRefs.current.get(resizingScene.id);
                const sceneEl = sceneRefs.current.get(resizingScene.id);
                if (spacerEl) spacerEl.style.width = newSpacerPx + 'px';
                if (sceneEl) sceneEl.style.width = newScenePx + 'px';
            }

            const afterDuration = currentScenes.slice(sceneIdx + 1).reduce((sum, s) => sum + s.duration, 0);
            let liveSceneDuration: number;
            if (resizingScene.side === 'right') {
                liveSceneDuration = liveRightDrag.current.duration;
            } else {
                liveSceneDuration = (liveLeftDrag.current.spacerPx + liveLeftDrag.current.scenePx) / pixelsPerSecond;
            }
            const liveTotalDuration = priorDuration + liveSceneDuration + afterDuration;
            const liveGrayWidth = Math.max(Math.ceil(Math.max(liveTotalDuration, 5.0) * pixelsPerSecond) + 66, containerWidth * 0.95);
            if (grayBarRef.current) grayBarRef.current.style.width = liveGrayWidth + 'px';
            if (timelineRef.current) timelineRef.current.style.minWidth = liveGrayWidth + 'px';

            return isNearScrubber;
        };

        const handleMouseMove = (e: MouseEvent) => {
            // Store live mouse position for the persistent RAF loop to read every frame
            liveMouseX.current = e.clientX;

            // Grow the clip using pure DOM physics
            const isNearScrubber = updateDragDOM();

            // Single React re-render per pixel: update tooltip position and snap state together
            setDragState(prev => ({
                ...prev,
                scrubberSnapped: isNearScrubber,
                resizeTooltip: prev.resizeTooltip ? { ...prev.resizeTooltip, x: e.clientX } : null
            }));
            // NOTE: Auto-scroll is handled by the persistent RAF loop started below — NOT here
        };

        // ─── Persistent auto-scroll RAF loop (industry standard) ──────────────────
        // Runs every frame for the ENTIRE drag. Reads liveMouseX set by mousemove.
        // Because deltaX is scroll-aware, scrolling naturally grows the clip — no wall ever.
        const EDGE_ZONE = 80;
        const MAX_SPEED = 20;
        const autoScrollLoop = () => {
            if (!tracksScrollRef.current) return;
            const el = tracksScrollRef.current;
            const rect = el.getBoundingClientRect();
            const mx = liveMouseX.current;

            let scrollSpeed = 0;
            if (mx > rect.right - EDGE_ZONE) {
                scrollSpeed = Math.round(((mx - (rect.right - EDGE_ZONE)) / EDGE_ZONE) * MAX_SPEED);
            } else if (mx < rect.left + EDGE_ZONE) {
                scrollSpeed = -Math.round((((rect.left + EDGE_ZONE) - mx) / EDGE_ZONE) * MAX_SPEED);
            }
            if (scrollSpeed !== 0) {
                el.scrollLeft += scrollSpeed;
                // ZERO-TRADEOFF WALL FIX: Tell the inner content to grow instantly inside the scroll loop!
                updateDragDOM();
            }
            autoScrollRAF.current = requestAnimationFrame(autoScrollLoop);
        };
        autoScrollRAF.current = requestAnimationFrame(autoScrollLoop);

        const handleMouseUp = () => {
            // Read scenes imperatively to avoid stale closure
            const currentScenes = useEditorStore.getState().scenes;
            if (resizingScene.side === 'right') {
                // Commit final right-handle duration from DOM to React state
                const finalDuration = liveRightDrag.current.sceneId === resizingScene.id
                    ? liveRightDrag.current.duration
                    : resizingScene.startDuration;
                // Update scene via global store
                updateScene(resizingScene.id, { duration: parseFloat(finalDuration.toFixed(2)) });
                getHistoryControls().archive();
                window.dispatchEvent(new CustomEvent('history-updated'));
                // Calculate new right edge position for scrubber (sum of prior durations + new duration)
                const sceneIdx = currentScenes.findIndex(s => s.id === resizingScene.id);
                const priorDuration = currentScenes.slice(0, sceneIdx).reduce((sum, s) => sum + s.duration, 0);
                const newEdgePosition = priorDuration + parseFloat(finalDuration.toFixed(2));
                setScrubberTime(newEdgePosition);
                setCurrentTime(newEdgePosition);
                liveRightDrag.current = { sceneId: null, scenePx: 0, duration: 0 };
            } else {
                // Commit final left-handle duration, reset leadingGap to 0 — scenes snap back
                const finalDuration = liveLeftDrag.current.sceneId === resizingScene.id
                    ? liveLeftDrag.current.duration
                    : resizingScene.startDuration;
                updateScene(resizingScene.id, { duration: parseFloat(finalDuration.toFixed(2)), leadingGap: 0 });
                getHistoryControls().archive();
                window.dispatchEvent(new CustomEvent('history-updated'));
                // Update scrubber position to the new start of the scene (left handle)
                const sceneIdx = currentScenes.findIndex(s => s.id === resizingScene.id);
                const priorDuration = currentScenes.slice(0, sceneIdx).reduce((sum, s) => sum + s.duration, 0);
                setScrubberTime(priorDuration);
                setCurrentTime(priorDuration);
                liveLeftDrag.current = { sceneId: null, spacerPx: 0, scenePx: 0, duration: 0 };
            }
            // End of resize: restore grey box to correct final width using LIVE DOM width (not stale React state)
            if (grayBarRef.current && tracksScrollRef.current) {
                const liveContainerWidth = tracksScrollRef.current.clientWidth;
                const currentScenes = useEditorStore.getState().scenes;
                const finalContentWidth = Math.ceil(Math.max(currentScenes.reduce((sum, s) => sum + s.duration, 0), 5.0) * pixelsPerSecond);
                const finalGrayWidth = Math.max(finalContentWidth + 66, liveContainerWidth * 0.95);
                grayBarRef.current.style.width = finalGrayWidth + 'px';
            }
            setScrubberFaded(false);
            setDragState({ scrubberSnapped: false, resizeTooltip: null });
            setResizingScene(null);
            setPendingResizeClick(null); // Also clear any pending click

            if (autoScrollRAF.current !== null) {
                cancelAnimationFrame(autoScrollRAF.current);
                autoScrollRAF.current = null;
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (autoScrollRAF.current !== null) {
                cancelAnimationFrame(autoScrollRAF.current);
                autoScrollRAF.current = null;
            }
        };
    }, [resizingScene, pixelsPerSecond, duration, dragState.scrubberSnapped, scrubberTime]);

    // Click vs Drag detection for resize handles
    useEffect(() => {
        if (!pendingResizeClick) return;

        let hasDragged = false;
        const startX = pendingResizeClick.startX;
        const startY = pendingResizeClick.startY;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // If moved more than threshold, this is a drag - start actual resize
            if (totalDelta > RESIZE_DRAG_THRESHOLD && !hasDragged) {
                hasDragged = true;

                // Convert pending click to actual resize — capture scrollLeft so deltaX stays scroll-aware
                setResizingScene({
                    id: pendingResizeClick.sceneId,
                    side: pendingResizeClick.side,
                    startX: pendingResizeClick.startX,
                    startScrollLeft: tracksScrollRef.current?.scrollLeft ?? 0,
                    startDuration: pendingResizeClick.startDuration,
                    startLeadingGap: pendingResizeClick.startLeadingGap
                });
                setDragState(prev => ({ ...prev, resizeTooltip: { x: e.clientX, y: e.clientY } }));

                // Clear pending click
                setPendingResizeClick(null);
            }
        };

        const handleMouseUp = () => {
            if (!hasDragged) {
                // This was a simple click - move scrubber to actual click position
                // Use the actual X coordinate where user clicked, converted to time
                if (timelineRef.current) {
                    const rect = timelineRef.current.getBoundingClientRect();
                    const clickX = pendingResizeClick.startX - rect.left - 4; // 4px padding
                    const clickTimePosition = getSnappedTime(pixelToTime(clickX));

                    // Move scrubber to actual click position
                    setScrubberTime(clickTimePosition);
                    setCurrentTime(clickTimePosition);
                }
            }

            // Clean up
            setPendingResizeClick(null);
            setScrubberFaded(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [pendingResizeClick, pixelsPerSecond, duration, scenes]);

    // ─── Timeline wheel zoom: Ctrl+scroll / pinch on trackpad zooms timeline, never the page ───
    useEffect(() => {
        const el = tracksScrollRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            setZoom(prev => {
                const factor = e.deltaY < 0 ? 1.1 : 0.9;
                return Math.round(Math.max(10, Math.min(1000, prev * factor)));
            });
            // Immediately hide ghost scrubber to prevent stale positions while zooming
            setHoverTime(null);
            setHoverScrubberPos(null);
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    return (
        <>
            <div className={`h-full pt-0 pb-2 flex-shrink-0 flex flex-col transition-colors duration-200 overflow-hidden ${isDark ? 'bg-[#1e1e2e] border-t border-[#2a2d45]' : 'bg-white border-t border-gray-200'}`}>


                {/* Main Timeline Area — single unified scroll container */}
                <div className="flex-1 flex flex-col overflow-hidden timeline-hover-container">

                    <div
                        ref={tracksScrollRef}
                        className={`flex-1 overflow-x-auto overflow-y-auto custom-scrollbar timeline-scroll-area relative ${isDark ? 'bg-[#14141d]' : 'bg-white'}`}
                        style={{ scrollbarGutter: 'stable' }}
                    >
                        <div
                            className="relative transition-all duration-300 ease-out px-1 min-h-full"
                            style={{ minWidth: `${timelineWidth}px` }}
                            ref={timelineRef}
                            onMouseDown={handleTimelineMouseDown}
                            onMouseMove={handleTimelineMouseMove}
                            onMouseLeave={() => { setHoverTime(null); setHoverScrubberPos(null); }}
                        >

                            {/* ── Ruler Row ── sticky top so it stays pinned during vertical scroll */}
                            <div
                                className={`sticky top-0 z-40 h-[30px] relative px-1 ${isDark ? 'bg-[#14141d]' : 'bg-white'}`}
                                style={{ minWidth: `${timelineWidth}px` }}
                            >
                                {/* Ghost scrubber triangle (ruler only) */}
                                {hoverTime !== null && !isDraggingPlayhead && hoveredHandleSceneId === null && resizingScene === null && (
                                    <div className="absolute top-0 bottom-0 w-[2px] z-35 pointer-events-none left-0"
                                        style={{ transform: `translateX(calc(${timeToPixel(hoverTime)}px - 1px))` }}
                                    >
                                        <svg width="10" height="8" viewBox="0 0 10 8" className="absolute top-[2px] left-1/2 -translate-x-1/2 text-[#1f2937]" fill="currentColor">
                                            <path d="M2.5 1h5c1.1 0 1.6 1.3.8 2.1L5.8 5.7c-.4.4-1.1.4-1.5 0L1.7 3.1C.9 2.3 1.4 1 2.5 1z" />
                                        </svg>
                                    </div>
                                )}

                                {/* Playhead triangle (ruler only) */}
                                <div
                                    data-playhead-triangle
                                    className="absolute top-0 bottom-0 w-[2px] z-35 pointer-events-none left-0"
                                    style={{
                                        transform: `translateX(calc(${timeToPixel(scrubberFaded ? scrubberTime : currentTime)}px - 1px))`,
                                        opacity: dragState.scrubberSnapped ? 1 : (scrubberFaded ? 0.5 : 1)
                                    }}
                                >
                                    <svg width="10" height="8" viewBox="0 0 10 8" className={`absolute top-[2px] left-1/2 -translate-x-1/2 transition-colors duration-150 ${dragState.scrubberSnapped ? 'text-[#7c3aed]' : 'text-gray-800'}`} fill="currentColor">
                                        <path d="M2.5 1h5c1.1 0 1.6 1.3.8 2.1L5.8 5.7c-.4.4-1.1.4-1.5 0L1.7 3.1C.9 2.3 1.4 1 2.5 1z" />
                                    </svg>
                                </div>

                                {/* Ruler ticks */}
                                <div className="h-[30px] flex absolute inset-x-0 z-10 pt-2 cursor-col-resize">
                                    {rulerTicks.map((tick) => (
                                        <div
                                            key={tick.time}
                                            className="absolute top-0 bottom-0 flex flex-row items-start pointer-events-none pt-2"
                                            style={{ left: `calc(${timeToPixel(tick.time)}px - 1px)` }}
                                        >
                                            <div className={`w-[2px] rounded-full ${tick.isMajor ? 'h-5' : 'h-2.5 mt-[5px]'} ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                            {tick.isMajor && (
                                                <span className={`text-[14px] font-medium select-none ml-1.5 whitespace-nowrap -mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {formatRulerLabel(tick.time)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Ghost scrubber line (full height — ruler + tracks) */}
                            {hoverTime !== null && !isDraggingPlayhead && hoveredHandleSceneId === null && resizingScene === null && (
                                <div className="absolute top-[30px] bottom-0 w-[2px] z-35 pointer-events-none left-1"
                                    style={{ transform: `translateX(calc(${timeToPixel(hoverTime)}px - 1px))` }}
                                >
                                    <div className="absolute top-0 bottom-0 left-0 right-0 bg-gray-800 opacity-60 rounded-full" />
                                </div>
                            )}

                            {/* Playhead line (full height — ruler + tracks) */}
                            <div
                                id="debug-playhead-line"
                                className="absolute top-[30px] bottom-0 w-[2px] z-35 pointer-events-none left-1"
                                style={{
                                    transform: `translateX(calc(${timeToPixel(scrubberFaded ? scrubberTime : currentTime)}px - 1px))`,
                                    opacity: dragState.scrubberSnapped ? 1 : (scrubberFaded ? 0.5 : 1)
                                }}
                            >
                                <div className={`absolute top-0 bottom-0 left-0 right-0 rounded-full transition-colors duration-150 ${dragState.scrubberSnapped ? 'bg-[#7c3aed]' : 'bg-gray-800'}`} />
                            </div>

                            {/* Tracks content */}
                            <div className="flex flex-col gap-[2px] py-0 relative pb-[20px]">

                                {/* Row 1: Add Elements */}
                                <div className="relative h-9 shrink-0 flex items-center">
                                    <button className={`sticky left-0 z-15 flex items-center gap-2.5 px-4 py-1.5 rounded-[10px] text-[13px] font-semibold shadow-sm transition-colors ${isDark ? 'bg-[#1e1e2e] text-gray-300 hover:bg-gray-800' : 'bg-[#e5e7eb] text-gray-700 hover:bg-[#d1d5db]'}`}>
                                        <LayoutGrid size={15} />
                                        Add elements
                                    </button>
                                </div>

                                <div className="relative h-[62px] shrink-0 flex items-center">
                                    <div
                                        ref={grayBarRef}
                                        className={`absolute inset-y-0 left-0 rounded-xl flex items-center z-10 ${isDark ? 'bg-[#1e1e2e]' : 'bg-[#e5e7eb]'}`}
                                        style={{ width: `${Math.max(contentWidth + 66, containerWidth * 0.95)}px` }}
                                    >

                                        {scenes.map((scene, sceneIndex) => {
                                            const isSelected = selectedSceneId === scene.id;
                                            const isLiveLeftDrag = liveLeftDrag.current.sceneId === scene.id;
                                            const isLiveRightDrag = liveRightDrag.current.sceneId === scene.id;
                                            const spacerPx = isLiveLeftDrag
                                                ? liveLeftDrag.current.spacerPx
                                                : (scene.leadingGap || 0) * pixelsPerSecond;
                                            const scenePx = isLiveLeftDrag
                                                ? liveLeftDrag.current.scenePx
                                                : isLiveRightDrag
                                                    ? liveRightDrag.current.scenePx
                                                    : timeToPixel(scene.duration);
                                            // Hide inner chrome when the tile is too narrow to fit them
                                            const isTinyHandles = scenePx < 28;
                                            const isTinyText = scenePx < 32;

                                            return (
                                                <React.Fragment key={scene.id}>
                                                    {/* Leading gap spacer */}
                                                    <div
                                                        ref={(el) => { spacerRefs.current.set(scene.id, el); }}
                                                        className="h-full flex-shrink-0 pointer-events-none"
                                                        style={{ width: `${spacerPx}px` }}
                                                    />
                                                    <div
                                                        ref={(el) => { sceneRefs.current.set(scene.id, el); }}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedSceneId(scene.id); }}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            // Select scene if not already selected
                                                            setSelectedSceneId(scene.id);
                                                            // Set floating reference to a virtual element at cursor position
                                                            sceneDropdownRefs.setReference({
                                                                getBoundingClientRect: () => ({
                                                                    x: e.clientX,
                                                                    y: e.clientY,
                                                                    top: e.clientY,
                                                                    left: e.clientX,
                                                                    bottom: e.clientY,
                                                                    right: e.clientX,
                                                                    width: 0,
                                                                    height: 0,
                                                                }),
                                                            });
                                                            setShowSceneDropdown(true);
                                                        }}
                                                        className={`relative h-full bg-white rounded-md overflow-hidden flex items-end p-2 flex-shrink-0 cursor-pointer border-[1.5px] group/scene ${isSelected ? 'border-[#7c3aed]' : 'border-[#d1d5db]'}`}
                                                        style={{ width: `${scenePx}px` }}
                                                        data-scene-block="true"
                                                    >
                                                        {isSelected && resizingScene?.id !== scene.id && !isTinyText && (
                                                            <span className={`text-[12.5px] font-bold text-[#1f2937] leading-none tracking-tight transition-opacity ${hoveredHandleSceneId === scene.id ? 'opacity-0' : 'opacity-100'}`}>
                                                                {scene.duration.toFixed(1)}s
                                                            </span>
                                                        )}

                                                        <>
                                                            <div
                                                                data-resize-handle="left"
                                                                className={`absolute left-0 top-0 bottom-0 w-[40px] flex items-center justify-start pl-[9px] cursor-ew-resize transition-opacity z-10 ${!isTinyHandles && hoveredHandleSceneId === scene.id ? 'opacity-100' : 'opacity-0'}`}
                                                                style={{ background: isTinyHandles ? 'none' : 'linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.07) 55%, transparent 100%)' }}
                                                                onMouseEnter={() => setHoveredHandleSceneId(scene.id)}
                                                                onMouseLeave={() => setHoveredHandleSceneId(null)}
                                                                onMouseDown={(e) => handleResizeStart(e, scene.id, 'left', scene.duration)}
                                                            >
                                                                {!isTinyHandles && <div className="w-[3px] h-[26px] bg-white rounded-full shadow-md flex-shrink-0" />}
                                                            </div>
                                                            <div
                                                                data-resize-handle="right"
                                                                className={`absolute right-0 top-0 bottom-0 w-[40px] flex items-center justify-end pr-[9px] cursor-ew-resize transition-opacity z-10 ${!isTinyHandles && hoveredHandleSceneId === scene.id ? 'opacity-100' : 'opacity-0'}`}
                                                                style={{ background: isTinyHandles ? 'none' : 'linear-gradient(to left, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.07) 55%, transparent 100%)' }}
                                                                onMouseEnter={() => setHoveredHandleSceneId(scene.id)}
                                                                onMouseLeave={() => setHoveredHandleSceneId(null)}
                                                                onMouseDown={(e) => handleResizeStart(e, scene.id, 'right', scene.duration)}
                                                            >
                                                                {!isTinyHandles && <div className="w-[3px] h-[26px] bg-white rounded-full shadow-md flex-shrink-0" />}
                                                            </div>
                                                        </>

                                                        {isSelected && !isTinyText && (
                                                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/scene:opacity-100 transition-opacity z-20">
                                                                <div
                                                                    data-dropdown-trigger="scene"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        sceneDropdownRefs.setReference(e.currentTarget as HTMLElement);
                                                                        setShowSceneDropdown(prev => !prev);
                                                                    }}
                                                                    className="bg-[#4b5563] hover:bg-[#7c3aed] rounded-full px-[7px] py-[5px] flex items-center gap-[3px] shadow-sm transition-colors cursor-pointer"
                                                                >
                                                                    <span className="w-[2px] h-[2px] rounded-full bg-white" />
                                                                    <span className="w-[2px] h-[2px] rounded-full bg-white" />
                                                                    <span className="w-[2px] h-[2px] rounded-full bg-white" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {sceneIndex < scenes.length - 1 && (
                                                        <div
                                                            className="relative flex-shrink-0 self-stretch"
                                                            style={{ width: '0px', zIndex: 25 }}
                                                        >
                                                            <div
                                                                className="absolute inset-y-0 flex items-center justify-center"
                                                                style={{ width: '8px', left: '-4px', cursor: 'default' }}
                                                                onMouseEnter={() => setHoveredGapIndex(sceneIndex)}
                                                                onMouseLeave={() => setHoveredGapIndex(null)}
                                                            >
                                                                <div
                                                                    className="flex flex-col items-center gap-[6px] transition-all duration-150"
                                                                    style={{
                                                                        opacity: hoveredGapIndex === sceneIndex ? 1 : 0,
                                                                        transform: hoveredGapIndex === sceneIndex ? 'scale(1)' : 'scale(0.7)',
                                                                        pointerEvents: hoveredGapIndex === sceneIndex ? 'auto' : 'none',
                                                                    }}
                                                                >
                                                                    <div className="relative group/plus">
                                                                        <div
                                                                            data-dropdown-trigger="gap"
                                                                            className="w-[24px] h-[24px] rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                gapDropdownRefs.setReference(e.currentTarget as HTMLElement);
                                                                                setActiveGapIndex(sceneIndex);
                                                                                setShowGapDropdown(prev => !prev);
                                                                                setActiveGapTooltip(null);
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                                setActiveGapTooltip({ text: 'Add media / blank', pos: { top: rect.top, left: rect.left + rect.width / 2 } });
                                                                            }}
                                                                            onMouseLeave={() => setActiveGapTooltip(null)}
                                                                        >
                                                                            <Plus size={13} strokeWidth={2.5} className="text-gray-600" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="relative group/trans">
                                                                        <div
                                                                            className="w-[24px] h-[24px] rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-colors"
                                                                            onClick={(e) => { e.stopPropagation(); }}
                                                                            onMouseEnter={(e) => {
                                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                                setActiveGapTooltip({ text: 'Add transition', pos: { top: rect.top, left: rect.left + rect.width / 2 } });
                                                                            }}
                                                                            onMouseLeave={() => setActiveGapTooltip(null)}
                                                                        >
                                                                            <StepForward size={12} strokeWidth={2} className="text-gray-600" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}

                                        <div className="sticky left-0 px-2 pl-2 flex items-center gap-3 h-full py-[8px] flex-shrink-0 ml-[2px]">
                                            <div className="relative h-full">
                                                <button
                                                    ref={plusBtnRef}
                                                    onClick={(e) => { e.stopPropagation(); setShowPlusDropdown(!showPlusDropdown); }}
                                                    className={`h-full aspect-square rounded-lg flex items-center justify-center shadow-sm cursor-pointer ${isDark ? 'bg-[#2a2d45] text-gray-300 hover:bg-[#323652]' : 'bg-[#d1d5db] text-gray-600 hover:bg-[#c2c6cc] transition-colors'}`}
                                                >
                                                    <Plus size={18} strokeWidth={2.5} />
                                                </button>

                                                {/* Plus Dropdown Menu — rendered via Portal to escape overflow clipping */}
                                            </div>
                                            {scenes.length === 0 && (
                                                <span className={`text-sm font-medium whitespace-nowrap ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>or drag and drop media</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Add Audio */}
                                <div className="relative h-9 shrink-0 flex items-center">
                                    <button className={`sticky left-0 z-15 flex items-center gap-2.5 px-4 py-1.5 rounded-[10px] text-[13px] font-semibold shadow-sm transition-colors ${isDark ? 'bg-[#1e1e2e] text-gray-300 hover:bg-gray-800' : 'bg-[#e5e7eb] text-gray-700 hover:bg-[#d1d5db]'}`}>
                                        <Music size={15} />
                                        Add audio
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>

                </div>







                {/* Bottom Row */}
                <div className="flex-shrink-0 flex items-center justify-between h-6 mt-1 pl-3 pr-3">

                    {/* Left Side: Timecode and Play button */}
                    <div className="flex items-center gap-[10px] text-xs font-medium">
                        {/* Current Time */}
                        <button className={`h-[29px] w-[46px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-[14px] font-medium tracking-[0.02em] tabular-nums flex-shrink-0 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                            {formatTime(currentTime)}
                        </button>

                        <div className="flex items-center gap-1">
                            {/* Skip Back Button */}
                            <button
                                onClick={() => setCurrentTime(0)}
                                className={`w-[29px] h-[29px] rounded-md transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                            >
                                <SkipBack size={16} fill="currentColor" strokeWidth={2.5} />
                            </button>

                            {/* Play / Pause Button */}
                            <button
                                onClick={() => {
                                    if (!isPlaying && currentTime >= duration - 0.05) {
                                        setCurrentTime(0);
                                    }
                                    setIsPlaying(!isPlaying);
                                }}
                                className={`w-[29px] h-[29px] rounded-md transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                            >
                                {isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" className="ml-0.5" />}
                            </button>

                            {/* Skip Forward Button */}
                            <button
                                onClick={() => {
                                    setCurrentTime(duration);
                                    setIsPlaying(false);
                                }}
                                className={`w-[29px] h-[29px] rounded-md transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                            >
                                <SkipForward size={16} fill="currentColor" strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Total Duration */}
                        <button className={`h-[29px] w-[46px] flex items-center justify-center rounded-md transition-colors cursor-pointer text-[14px] font-medium tracking-[0.02em] tabular-nums flex-shrink-0 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                            {formatTime(duration)}
                        </button>
                    </div>

                    {/* Right Side: Zoom Controls and Icons */}
                    <div className="flex items-center gap-3 text-xs font-medium">
                        {/* Zoom Slider — toggles between canvas and timeline zoom */}
                        <div className="flex items-center gap-2">
                            {/* Canvas zoom icon (rectangle = canvas) */}
                            <button
                                onClick={() => setZoomTarget(zoomTarget === 'canvas' ? 'timeline' : 'canvas')}
                                className={`flex-shrink-0 flex items-center justify-center w-[29px] h-[29px] rounded-md transition-colors cursor-pointer ${isDark
                                    ? 'hover:bg-gray-800'
                                    : 'hover:bg-gray-100'
                                    }`}
                                title={zoomTarget === 'canvas' ? 'Switch to Timeline zoom' : 'Switch to Canvas zoom'}
                            >
                                <CustomTimelineIcon size={31.5} activeTarget={zoomTarget} isDark={isDark} />
                            </button>
                            <div className="relative flex items-center group">
                                {zoomTarget === 'canvas' ? (
                                    <input
                                        type="range"
                                        min="10"
                                        max="500"
                                        value={localCanvasZoom !== null ? localCanvasZoom : Math.round(canvasZoom * 100)}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setLocalCanvasZoom(val);
                                            startTransition(() => {
                                                setCanvasZoom(val / 100);
                                            });
                                        }}
                                        className={`w-40 h-1 rounded-full appearance-none cursor-pointer outline-none transition-colors ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}
                                        style={{
                                            backgroundImage: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(((localCanvasZoom !== null ? localCanvasZoom : Math.round(canvasZoom * 100)) - 10) / 490) * 100}%, transparent ${(((localCanvasZoom !== null ? localCanvasZoom : Math.round(canvasZoom * 100)) - 10) / 490) * 100}%, transparent 100%)`,
                                        }}
                                    />
                                ) : (
                                    <input
                                        type="range"
                                        min="10"
                                        max="1000"
                                        value={localTimelineZoom !== null ? localTimelineZoom : zoom}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setLocalTimelineZoom(val);
                                            startTransition(() => {
                                                setZoom(val);
                                            });
                                        }}
                                        className={`w-40 h-1 rounded-full appearance-none cursor-pointer outline-none transition-colors ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}
                                        style={{
                                            backgroundImage: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((localTimelineZoom !== null ? localTimelineZoom : zoom) / 1000) * 100}%, transparent ${((localTimelineZoom !== null ? localTimelineZoom : zoom) / 1000) * 100}%, transparent 100%)`,
                                        }}
                                    />
                                )}
                                <style>{`
                                input[type='range']::-webkit-slider-thumb {
                                    -webkit-appearance: none;
                                    appearance: none;
                                    width: 14px;
                                    height: 14px;
                                    background: #8b5cf6;
                                    border-radius: 50%;
                                    cursor: pointer;
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                                }
                                input[type='range']::-moz-range-thumb {
                                    width: 14px;
                                    height: 14px;
                                    background: #8b5cf6;
                                    border-radius: 50%;
                                    cursor: pointer;
                                    border: none;
                                }
                            `}</style>
                            </div>
                            <button
                                className={`flex items-center justify-center h-[29px] w-[38px] rounded-md transition-colors cursor-pointer text-[14px] font-medium tracking-wide ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                            >
                                {zoomTarget === 'canvas' ? `${localCanvasZoom !== null ? localCanvasZoom : Math.round(canvasZoom * 100)}%` : `${localTimelineZoom !== null ? localTimelineZoom : zoom}%`}
                            </button>
                        </div>

                        {/* Icons */}
                        <div className="flex items-center gap-0.5">
                            <button className={`w-[29px] h-[29px] flex items-center justify-center rounded-md transition-colors cursor-pointer ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                                <LayoutGrid size={21} />
                            </button>
                            <button className={`w-[29px] h-[29px] flex items-center justify-center rounded-md transition-colors cursor-pointer ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                                <Maximize size={21} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Portal-based dropdown — renders at body level to escape all overflow containers */}
            {showPlusDropdown && ReactDOM.createPortal(
                <div
                    ref={(node) => {
                        plusDropdownRefs.setFloating(node);
                        if (dropdownRef) dropdownRef.current = node;
                    }}
                    className={`fixed w-44 rounded-xl shadow-lg border py-1.5 z-[9999] ${isDark ? 'bg-[#1e1e2e] border-gray-700' : 'bg-white border-gray-200'}`}
                    style={plusDropdownStyles}
                >
                    <button
                        onClick={() => { setShowPlusDropdown(false); onOpenMediaPanel(); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <CloudUpload size={18} /> Uploads
                    </button>
                    <button
                        onClick={() => {
                            setShowPlusDropdown(false);
                            const newId = Date.now().toString();
                            const currentScenes = useEditorStore.getState().scenes;
                            const newBlankEnd = currentScenes.reduce((sum, s) => sum + s.duration, 0) + 5.0;
                            addScene({ id: newId, duration: 5.0 });
                            getHistoryControls().archive();
                            window.dispatchEvent(new CustomEvent('history-updated'));
                            setSelectedSceneId(newId);
                            setCurrentTime(newBlankEnd);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <RectangleHorizontal size={18} /> Blank
                    </button>
                </div>,
                document.body
            )}

            {/* Portal-based Gap Dropdown — same style as main plus dropdown */}
            {showGapDropdown && ReactDOM.createPortal(
                <div
                    ref={(node) => {
                        gapDropdownRefs.setFloating(node);
                        if (gapDropdownRef) gapDropdownRef.current = node;
                    }}
                    className={`fixed w-44 rounded-xl shadow-lg border py-1.5 z-[9999] ${isDark ? 'bg-[#1e1e2e] border-gray-700' : 'bg-white border-gray-200'}`}
                    style={gapDropdownStyles}
                >
                    <button
                        onClick={() => {
                            setShowGapDropdown(false);
                            onOpenMediaPanel();
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <CloudUpload size={18} /> Uploads
                    </button>
                    <button
                        onClick={() => {
                            setShowGapDropdown(false);
                            if (activeGapIndex === null) return;
                            const newId = Date.now().toString();
                            const currentScenes = useEditorStore.getState().scenes;
                            addScene({ id: newId, duration: 5.0 }, activeGapIndex + 1);
                            getHistoryControls().archive();
                            window.dispatchEvent(new CustomEvent('history-updated'));
                            setSelectedSceneId(newId);
                            // move scrubber to end of new blank
                            const priorDuration = currentScenes.slice(0, activeGapIndex + 1).reduce((sum, s) => sum + s.duration, 0);
                            setCurrentTime(priorDuration + 5.0);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <RectangleHorizontal size={18} /> Blank
                    </button>
                </div>,
                document.body
            )}

            {/* Portal-based Ghost Scrubber Tooltip */}
            {hoverTime !== null && hoverScrubberPos && !isDraggingPlayhead && hoveredHandleSceneId === null && resizingScene === null && ReactDOM.createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none flex flex-col items-center"
                    style={{
                        top: hoverScrubberPos.top,
                        left: hoverScrubberPos.left,
                        transform: 'translate(-50%, -100%)',
                        marginTop: '4px'
                    }}
                >
                    <div className="bg-[#1f2937] text-white text-[14px] font-semibold px-3 py-1.5 rounded-[8px] shadow-md">
                        {formatTooltipTime(hoverTime, getViewportEdgeState(hoverScrubberPos.left))}
                    </div>
                </div>,
                document.body
            )}

            {/* Portal-based Gap Buttons Tooltip */}
            {activeGapTooltip !== null && !showGapDropdown && ReactDOM.createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none flex flex-col items-center"
                    style={{
                        top: activeGapTooltip.pos.top - 6,
                        left: activeGapTooltip.pos.left,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <div className="bg-[#1f2937] text-white text-[11px] font-medium px-2 py-1 rounded-md shadow-lg whitespace-nowrap relative z-10">
                        {activeGapTooltip.text}
                    </div>
                    {/* Tooltip triangle caret */}
                    <svg width="12" height="9" viewBox="0 0 10 8" className="text-[#1f2937] mt-[-2.5px] mx-auto relative z-0" fill="currentColor">
                        <path d="M2.5 1h5c1.1 0 1.6 1.3.8 2.1L5.8 5.7c-.4.4-1.1.4-1.5 0L1.7 3.1C.9 2.3 1.4 1 2.5 1z" />
                    </svg>
                </div>,
                document.body
            )}

            {/* Portal-based Real Scrubber Timer Tooltip — shown only while dragging the playhead */}
            {isDraggingPlayhead && timelineRef.current && (() => {
                const rect = timelineRef.current!.getBoundingClientRect();
                const scrubberLeft = rect.left + 4 + timeToPixel(currentTime);
                return ReactDOM.createPortal(
                    <div
                        className="fixed z-[9999] pointer-events-none flex flex-col items-center"
                        style={{
                            top: tracksScrollRef.current ? tracksScrollRef.current.getBoundingClientRect().top : rect.top,
                            left: scrubberLeft,
                            transform: 'translate(-50%, -100%)',
                            marginTop: '4px'
                        }}
                    >
                        <div className="bg-[#1f2937] text-white text-[14px] font-semibold px-3 py-1.5 rounded-[8px] shadow-md">
                            {formatTooltipTime(currentTime, getViewportEdgeState(scrubberLeft))}
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* Portal-based Resize Tooltip — appears above blank while dragging resize handle */}
            {resizingScene && dragState.resizeTooltip && (() => {
                const activeScene = scenes.find(s => s.id === resizingScene.id);
                if (!activeScene) return null;
                // Both handles now use DOM — read live refs for accurate tooltip display
                const displayDuration = (resizingScene.side === 'left' && liveLeftDrag.current.sceneId === resizingScene.id)
                    ? liveLeftDrag.current.duration
                    : (resizingScene.side === 'right' && liveRightDrag.current.sceneId === resizingScene.id)
                        ? liveRightDrag.current.duration
                        : activeScene.duration;
                return ReactDOM.createPortal(
                    <div
                        className="fixed z-[9999] pointer-events-none flex flex-col items-center"
                        style={{
                            top: dragState.resizeTooltip.y - 78,
                            left: dragState.resizeTooltip.x,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        {/* Dark pill showing live duration */}
                        <div className="bg-[#1f2937] text-white text-[14px] font-semibold px-3 py-1.5 rounded-[8px] shadow-lg">
                            {displayDuration.toFixed(1)}s
                        </div>
                        {/* Downward-pointing triangle — same caret style as ghost scrubber */}
                        <svg width="12" height="9" viewBox="0 0 10 8" className="text-[#1f2937] mt-[-2.5px]" fill="currentColor">
                            <path d="M2.5 1h5c1.1 0 1.6 1.3.8 2.1L5.8 5.7c-.4.4-1.1.4-1.5 0L1.7 3.1C.9 2.3 1.4 1 2.5 1z" />
                        </svg>
                    </div>,
                    document.body
                );
            })()}

            {/* Portal-based Scene Dropdown (3-dot menu) */}
            {showSceneDropdown && ReactDOM.createPortal(
                <div
                    ref={(node) => {
                        sceneDropdownRefs.setFloating(node);
                        if (sceneDropdownRef) sceneDropdownRef.current = node;
                    }}
                    className={`fixed w-48 rounded-xl shadow-lg border py-1.5 z-[9999] ${isDark ? 'bg-[#1e1e2e] border-gray-700' : 'bg-white border-gray-200'}`}
                    style={sceneDropdownStyles}
                >
                    {canSplitSelectedScene && (
                        <button
                            onClick={() => {
                                setShowSceneDropdown(false);
                                handleSplitScene();
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                        >
                            <div className={`flex items-center gap-3 text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <Scissors size={16} /> Split
                            </div>
                            <div className={`text-[10.5px] tracking-wide font-medium px-1.5 py-0.5 rounded-[4px] ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-[#e4e6eb] text-[#4b5563]'}`}>S</div>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setShowSceneDropdown(false);
                            // TODO: Implement add transition
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                    >
                        <div className={`flex items-center gap-3 text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <StepForward size={16} /> Add Transition
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            setShowSceneDropdown(false);
                            handleDuplicateScene();
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                    >
                        <div className={`flex items-center gap-3 text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <Copy size={16} /> Duplicate
                        </div>
                        <div className={`text-[10.5px] tracking-wide font-medium px-1.5 py-0.5 rounded-[4px] ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-[#e4e6eb] text-[#4b5563]'}`}>Ctrl+D</div>
                    </button>
                    <button
                        onClick={() => {
                            setShowSceneDropdown(false);
                            if (selectedSceneId) {
                                removeScene(selectedSceneId);
                                getHistoryControls().archive();
                                window.dispatchEvent(new CustomEvent('history-updated'));
                                setSelectedSceneId(null);
                            }
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                    >
                        <div className={`flex items-center gap-3 text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <Trash2 size={16} /> Delete
                        </div>
                        <div className={`text-[10.5px] tracking-wide font-medium px-1.5 py-0.5 rounded-[4px] ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-[#e4e6eb] text-[#4b5563]'}`}>DELETE</div>
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};
