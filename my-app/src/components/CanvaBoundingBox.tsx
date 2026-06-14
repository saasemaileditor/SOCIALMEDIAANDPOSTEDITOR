import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Moveable from 'moveable';
import type { OnDrag, OnScale, OnRotate } from 'moveable';
import type { SceneNode } from '../store/useEditorStore';
import { useEditorStore, useUIStore, getHistoryControls, parseTransformToNumbers } from '../store/useEditorStore';
// Raw SVG import — zero React overhead, pure CSS injection for canvas performance
import refreshCwRaw from 'lucide-static/icons/refresh-cw.svg?raw';

// Modify the raw SVG: slightly increase stroke-width to 1.5 for better visibility
const thinRefreshCw = refreshCwRaw.replace(/stroke-width="[^"]+"/g, 'stroke-width="1.5"');

// Encode once at module load (not on every render)
const ROTATE_ICON_URL = `url("data:image/svg+xml,${encodeURIComponent(thinRefreshCw)}")`;

const SizeTooltipPortal = ({ tooltipRef }: { tooltipRef: React.RefObject<HTMLDivElement | null> }) => {
    return createPortal(
        <div
            ref={tooltipRef}
            style={{
                position: 'fixed',
                display: 'none',
                top: 0,
                left: 0,
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.3px',
                pointerEvents: 'none',
                zIndex: 999999,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
        >
            w: 0 h: 0
        </div>,
        document.body
    );
};

export interface CanvaBoundingBoxProps {
    el: SceneNode;
    updateNode: (id: string, data: Partial<SceneNode>) => void;
    containerRef: React.RefObject<HTMLElement | null>;
    targetRef: React.RefObject<HTMLElement | null>;
    zoom?: number;
}

const lockCursor = (cursorStyle: string) => {
    document.body.style.setProperty('cursor', cursorStyle, 'important');
    let styleEl = document.getElementById('canva-cursor-lock');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'canva-cursor-lock';
        document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `* { cursor: ${cursorStyle} !important; }`;
};

const unlockCursor = () => {
    document.body.style.removeProperty('cursor');
    const styleEl = document.getElementById('canva-cursor-lock');
    if (styleEl) styleEl.remove();
};

export function CanvaBoundingBox({ el, updateNode, containerRef, targetRef, zoom = 1 }: CanvaBoundingBoxProps) {
    const removeNode = useEditorStore((s) => s.removeNode);
    const setSelectedId = useUIStore((s) => s.setSelectedId);
    const target = targetRef?.current;
    const moveableRef = useRef<InstanceType<typeof Moveable> | null>(null);

    // Tracks the last corner handle the user dragged — used for Stage 4 (only 1 corner visible)
    const lastUsedCornerRef = useRef<string>('se');

    // ─── Canva-Style Handle Visibility ───────────────────────────────────────
    // Rules (from Canva analysis):
    //  1. Corner pointer-events (logic) NEVER disappear — all 4 corners always grabbable
    //  2. Pill logic disappears PER AXIS only — not all at once
    //
    // Stage 1: Pill touches a corner → pill invisible, hover logic STAYS
    // Stage 2: Adjacent corners touch (one axis) → pills on that axis lose logic too
    // Stage 3: Both axes squished → 2 diagonal corners visible, 2 invisible but logic stays, all pills gone
    // Stage 4: Diagonal corners touch → 1 corner visible (last used), all 4 logic stays, all pills gone
    const checkHandleCollisions = (activeHandle?: string) => {
        // Scoped to THIS element's Moveable instance via its unique class — safe for future multi-select
        const moveableEl = document.querySelector(`.moveable-el-${el.id}`);
        if (!moveableEl) return;

        const getRect = (cls: string): DOMRect | null => {
            const el = moveableEl.querySelector(`.moveable-${cls}`) as HTMLElement;
            return el ? el.getBoundingClientRect() : null;
        };

        // visible = shown on screen. hasLogic = pointer-events on (can hover/grab).
        const setHandle = (cls: string, visible: boolean, hasLogic: boolean) => {
            const el = moveableEl.querySelector(`.moveable-${cls}`) as HTMLElement;
            if (!el) return;
            el.style.opacity = visible ? '' : '0';
            el.style.pointerEvents = hasLogic ? '' : 'none';
        };

        const rects = {
            nw: getRect('nw'), ne: getRect('ne'),
            sw: getRect('sw'), se: getRect('se'),
            n: getRect('n'), s: getRect('s'),
            w: getRect('w'), e: getRect('e'),
        };

        const overlaps = (a: DOMRect | null, b: DOMRect | null): boolean => {
            if (!a || !b) return false;
            return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
        };

        // Which axes are squished?
        const horizSquished = overlaps(rects.nw, rects.ne) || overlaps(rects.sw, rects.se);
        const vertSquished = overlaps(rects.nw, rects.sw) || overlaps(rects.ne, rects.se);
        const diagTouch = overlaps(rects.nw, rects.se) || overlaps(rects.ne, rects.sw);

        // ── CORNERS: logic ALWAYS stays, only visibility changes ──────────────
        if (diagTouch) {
            // Stage 4: 1 corner visible, all 4 logic stays
            const last = lastUsedCornerRef.current;
            ['nw', 'ne', 'sw', 'se'].forEach(c => setHandle(c, c === last, true));
        } else if (horizSquished && vertSquished) {
            // Stage 3: 2 diagonal corners visible, 2 invisible — ALL 4 logic stays
            const showNwSe = !overlaps(rects.nw, rects.se);
            setHandle('nw', showNwSe, true);
            setHandle('se', showNwSe, true);
            setHandle('ne', !showNwSe, true);
            setHandle('sw', !showNwSe, true);
        } else {
            // Stage 1/2: all 4 corners visible, all logic stays
            ['nw', 'ne', 'sw', 'se'].forEach(c => setHandle(c, true, true));
        }

        // ── PILLS: logic disappears per-axis when that axis is squished ────────
        if (diagTouch || (horizSquished && vertSquished)) {
            // Stage 3/4: all pills completely gone — no visibility, no logic
            ['n', 's', 'w', 'e'].forEach(p => setHandle(p, false, false));
        } else {
            // Stage 1/2:
            // n + s pills: lose logic when horizontal axis is squished (NW touched NE)
            // w + e pills: lose logic when vertical axis is squished (NW touched SW)
            const pillLogic: Record<string, boolean> = {
                n: !horizSquished, s: !horizSquished,
                w: !vertSquished, e: !vertSquished,
            };

            ['n', 's', 'w', 'e'].forEach(pill => {
                if (pill === activeHandle) {
                    // Actively dragged pill: always show it
                    setHandle(pill, true, true);
                    return;
                }
                const hasLogic = pillLogic[pill];
                const pillRect = rects[pill as keyof typeof rects];
                const touchingCorner = ['nw', 'ne', 'sw', 'se'].some(c =>
                    overlaps(pillRect, rects[c as keyof typeof rects])
                );
                // Visible only if not touching any corner; logic based on axis
                setHandle(pill, !touchingCorner, hasLogic);
            });
        }
    };

    // ─── Vanilla Moveable instantiation ──────────────────────────────────────
    // Created once imperatively in useEffect — zero React in the update path.
    // All drag/scale/rotate events go DOM → handler → DOM, never through React.
    useEffect(() => {
        if (!target || !containerRef.current) return;

        const moveable = new Moveable(containerRef.current, {
            target,
            // Reverses canvas zoom so handles stay constant finger-size
            zoom: 1 / zoom,
            className: `canva-moveable-style moveable-el-${el.id}`,
            origin: false,
            edge: false,
            // Dragging
            draggable: true,
            dragArea: true,
            throttleDrag: 0,
            // Scaling
            scalable: true,
            throttleScale: 0,
            renderDirections: ["nw", "ne", "sw", "se", "w", "e", "n", "s"],
            // Rotating
            rotatable: true,
            throttleRotate: 0,
            rotationPosition: rotPosRef.current,
            // Snapping
            snappable: true,
            snapDirections: { top: true, center: true, bottom: true, left: true, middle: true, right: true },
            elementGuidelines: [],
            snapThreshold: 5,
            isDisplaySnapDigit: true,
            snapGap: true,
        });

        // Store instance on ref so other functions (updateRotationPosition, checkHandleCollisions) can use it
        moveableRef.current = moveable;

        // Wire all event handlers
        moveable.on('dragStart',    handleDragStart);
        moveable.on('drag',         handleDrag);
        moveable.on('dragEnd',      handleEnd);
        moveable.on('scaleStart',   handleScaleStart);
        moveable.on('beforeScale',  handleBeforeScale);
        moveable.on('scale',        handleScale);
        moveable.on('scaleEnd',     handleEnd);
        moveable.on('rotateStart',  handleRotateStart);
        moveable.on('rotate',       handleRotate);
        moveable.on('rotateEnd',    handleEnd);

        // Initial position + handle state
        moveable.updateRect();
        updateRotationPosition(target.getBoundingClientRect());
        requestAnimationFrame(() => checkHandleCollisions());

        return () => {
            moveable.destroy();
            moveableRef.current = null;
        };
    // Re-create when target element or zoom changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, zoom]);

    const pendingUpdatesRef = useRef<Partial<SceneNode> | null>(null);
    // Stores the cursor style that SHOULD be applied once actual movement is proven
    const pendingCursorRef = useRef<string | null>(null);

    // Tooltip for dimensions
    const tooltipRef = useRef<HTMLDivElement>(null);
    const resizeDirRef = useRef<number[]>([1, 1]);

    // Tracks the raw transform string during drag for live DOM update
    const liveTransformRef = useRef<string>('');
    // rotationPos is now a ref — updated imperatively on the Moveable instance, zero re-render
    const rotPosRef = useRef<"top" | "bottom" | "left" | "right">("right");

    const updateRotationPosition = (rect: DOMRect) => {
        const container = containerRef.current?.getBoundingClientRect();
        if (!container) return;
        const padding = 50; // Space needed for the rotation circle outside the element
        let newPos: "top" | "bottom" | "left" | "right" = "right";

        // Divide the screen-space offsets by zoom so they map to canvas-local space
        const rightSpace = (container.right - rect.right) / zoom;
        const leftSpace = (rect.left - container.left) / zoom;
        const bottomSpace = (container.bottom - rect.bottom) / zoom;

        if (rightSpace < padding) {
            if (leftSpace > padding) {
                newPos = "left";
            } else if (bottomSpace > padding) {
                newPos = "bottom";
            } else {
                newPos = "top";
            }
        }

        if (rotPosRef.current !== newPos) {
            rotPosRef.current = newPos;
            // Imperatively update Moveable instance — zero React re-render
            if (moveableRef.current) {
                moveableRef.current.rotationPosition = newPos;
            }
        }
    };

    const lockPendingCursor = () => {
        if (pendingCursorRef.current) {
            lockCursor(pendingCursorRef.current);
            pendingCursorRef.current = null; // Ensure it only fires once per drag
        }
    };

    const handleDragStart = () => {
        pendingCursorRef.current = 'move';
        pendingUpdatesRef.current = null;
    };

    const handleScaleStart = (e: any) => {
        let cursor = 'nwse-resize';
        const [dx, dy] = e.direction;
        if (dx === 0 && dy !== 0) cursor = 'ns-resize';
        else if (dx !== 0 && dy === 0) cursor = 'ew-resize';
        else if ((dx === 1 && dy === -1) || (dx === -1 && dy === 1)) cursor = 'nesw-resize';
        else cursor = 'nwse-resize';

        pendingCursorRef.current = cursor;
        pendingUpdatesRef.current = null;
        resizeDirRef.current = e.direction;

        // Track the last corner used (for Stage 4 — only 1 corner stays visible at minimum size)
        const isCorner = dx !== 0 && dy !== 0;
        if (isCorner) {
            if (dx === -1 && dy === -1) lastUsedCornerRef.current = 'nw';
            else if (dx === 1 && dy === -1) lastUsedCornerRef.current = 'ne';
            else if (dx === -1 && dy === 1) lastUsedCornerRef.current = 'sw';
            else if (dx === 1 && dy === 1) lastUsedCornerRef.current = 'se';
        }
    };

    const handleRotateStart = () => {
        pendingCursorRef.current = 'grabbing';
        pendingUpdatesRef.current = null;
    };

    const handleDrag = (e: OnDrag) => {
        lockPendingCursor();
        // Live DOM update — bypasses React for 60fps smoothness
        e.target.style.transform = e.transform;
        liveTransformRef.current = e.transform;

        const parsed = parseTransformToNumbers(e.transform);
        pendingUpdatesRef.current = {
            ...pendingUpdatesRef.current,
            x: parsed.x,
            y: parsed.y,
        };
        updateRotationPosition(e.target.getBoundingClientRect());
    };

    const handleBeforeScale = (e: any) => {
        // Enforce the lock at 10% of the TRUE NATIVE size (original file resolution).
        //
        // Fallback chain (best → acceptable → last resort):
        //   1. nativeWidth  — saved at drop time for all new elements (most accurate)
        //   2. boundingSize — stored at drop time, never mutated by user resizing (good for old projects)
        //   3. el.width     — last resort for very old projects without either field
        const nativeW = (el.data?.nativeWidth as number)
            ?? el.boundingSize?.[0]
            ?? el.width;
        const nativeH = (el.data?.nativeHeight as number)
            ?? el.boundingSize?.[1]
            ?? el.height;

        // What is 10% of the native original size?
        const minAllowedW = nativeW * 0.1;
        const minAllowedH = nativeH * 0.1;

        // Guard against division by zero (el.width/height should never be 0 but be safe)
        const baseW = Math.max(1, el.width);
        const baseH = Math.max(1, el.height);

        // Convert that to a minimum scale limit — each axis is independently clamped.
        // Each axis is only limited by its OWN 10% native size, not the other axis.
        const minScaleX = minAllowedW / baseW;
        const minScaleY = minAllowedH / baseH;

        let scaleX = Math.max(minScaleX, e.scale[0]);
        let scaleY = Math.max(minScaleY, e.scale[1]);

        // --- Corner Handle Proportional Lock ---
        const [dx, dy] = resizeDirRef.current;
        if (dx !== 0 && dy !== 0) {
            // Project the raw scale vector onto the element's diagonal.
            // This elegantly handles out-of-bounds dragging (negative scales) without
            // "explosive" snapping, and correctly weights skewed aspect ratios.
            const w2 = baseW * baseW;
            const h2 = baseH * baseH;
            const rawProjectedScale = (e.scale[0] * w2 + e.scale[1] * h2) / (w2 + h2);

            // Unified scale must respect both limits (though in our system they are usually equal)
            const unifiedScale = Math.max(rawProjectedScale, minScaleX, minScaleY);
            scaleX = unifiedScale;
            scaleY = unifiedScale;
        }

        e.setScale([scaleX, scaleY]);
    };


    const handleScale = (e: OnScale) => {
        lockPendingCursor();
        // Live DOM update
        e.target.style.transform = e.drag.transform;
        liveTransformRef.current = e.drag.transform;

        // Re-check all handle collisions after DOM update.
        // Pass active pill name so it stays visible during its own drag.
        const [dx, dy] = resizeDirRef.current;
        const isCornerDrag = dx !== 0 && dy !== 0;
        if (isCornerDrag) {
            checkHandleCollisions();
        } else {
            const pillName = dx === 0 ? (dy < 0 ? 'n' : 's') : (dx < 0 ? 'w' : 'e');
            checkHandleCollisions(pillName);
        }

        const parsed = parseTransformToNumbers(e.drag.transform);
        pendingUpdatesRef.current = {
            ...pendingUpdatesRef.current,
            x: parsed.x,
            y: parsed.y,
            scaleX: parsed.scaleX,
            scaleY: parsed.scaleY,
        };
        const rect = e.target.getBoundingClientRect();
        updateRotationPosition(rect);

        if (tooltipRef.current) {
            tooltipRef.current.style.display = 'block';
            const w = Math.round((e.target as HTMLElement).offsetWidth * Math.abs(parsed.scaleX));
            const h = Math.round((e.target as HTMLElement).offsetHeight * Math.abs(parsed.scaleY));

            const eAny = e as any;
            const clientX = eAny.clientX ?? eAny.drag?.clientX ?? rect.right;
            const clientY = eAny.clientY ?? eAny.drag?.clientY ?? rect.bottom;

            // Offset slightly so it doesn't cover the cursor
            const tooltipX = clientX + 16;
            const tooltipY = clientY + 16;

            tooltipRef.current.style.transform = `translate(${tooltipX}px, ${tooltipY}px)`;
            tooltipRef.current.innerText = `w: ${w} h: ${h}`;
        }
    };

    const handleRotate = (e: OnRotate) => {
        lockPendingCursor();
        // Live DOM update
        e.target.style.transform = e.drag.transform;
        liveTransformRef.current = e.drag.transform;

        const parsed = parseTransformToNumbers(e.drag.transform);
        pendingUpdatesRef.current = {
            ...pendingUpdatesRef.current,
            x: parsed.x,
            y: parsed.y,
            rotation: parsed.rotation,
        };

        if (tooltipRef.current) {
            tooltipRef.current.style.display = 'block';
            const rect = e.target.getBoundingClientRect();

            const eAny = e as any;
            const clientX = eAny.clientX ?? eAny.drag?.clientX ?? rect.right;
            const clientY = eAny.clientY ?? eAny.drag?.clientY ?? rect.bottom;

            // Offset slightly so it doesn't cover the cursor
            const tooltipX = clientX + 16;
            const tooltipY = clientY + 16;

            tooltipRef.current.style.transform = `translate(${tooltipX}px, ${tooltipY}px)`;

            // Format degree correctly
            const deg = Math.round(parsed.rotation);
            tooltipRef.current.innerText = `${deg}°`;
        }
    };

    const handleEnd = () => {
        let isCompletelyOut = false;
        if (targetRef.current && containerRef.current) {
            const elRect = targetRef.current.getBoundingClientRect();
            const canvasRect = containerRef.current.getBoundingClientRect();
            isCompletelyOut = (
                elRect.right < canvasRect.left ||
                elRect.left > canvasRect.right ||
                elRect.bottom < canvasRect.top ||
                elRect.top > canvasRect.bottom
            );
        }

        pendingCursorRef.current = null; // Clear it just in case it never fired
        unlockCursor();

        if (tooltipRef.current) {
            tooltipRef.current.style.display = 'none';
        }

        if (isCompletelyOut) {
            removeNode(el.id);
            setSelectedId(null);
            getHistoryControls().archive();
            window.dispatchEvent(new CustomEvent('history-updated'));
            return;
        }

        if (pendingUpdatesRef.current) {
            updateNode(el.id, pendingUpdatesRef.current);
            pendingUpdatesRef.current = null;
        }
        getHistoryControls().archive();
        window.dispatchEvent(new CustomEvent('history-updated'));

        // Re-check all handle states now that drag is done.
        requestAnimationFrame(() => checkHandleCollisions());
    };

    if (!target) return null;

    // Only portal + styles are in JSX — the Moveable instance is fully imperative (above useEffect).
    // Zero React renders affect the control box position during drag/scale/rotate.
    return (
        <>
            <SizeTooltipPortal tooltipRef={tooltipRef} />
            <style>{`
                .canva-moveable-style {
                    --moveable-color: #7c3aed !important; 
                }
                .canva-moveable-style .moveable-control {
                    background: #fff !important;
                    border: 1px solid #6b7280 !important;
                    width: 12.5px !important;
                    height: 12.5px !important;
                    margin-top: -6.25px !important;
                    margin-left: -6.25px !important;
                    border-radius: 50% !important;
                    transition: background-color 0.15s ease !important;
                }
                /* Explicitly targeting only the 8 resize directions for the purple hover effect */
                .canva-moveable-style .moveable-control.moveable-nw:hover, .canva-moveable-style .moveable-control.moveable-nw:active,
                .canva-moveable-style .moveable-control.moveable-ne:hover, .canva-moveable-style .moveable-control.moveable-ne:active,
                .canva-moveable-style .moveable-control.moveable-sw:hover, .canva-moveable-style .moveable-control.moveable-sw:active,
                .canva-moveable-style .moveable-control.moveable-se:hover, .canva-moveable-style .moveable-control.moveable-se:active,
                .canva-moveable-style .moveable-control.moveable-n:hover,  .canva-moveable-style .moveable-control.moveable-n:active,
                .canva-moveable-style .moveable-control.moveable-s:hover,  .canva-moveable-style .moveable-control.moveable-s:active,
                .canva-moveable-style .moveable-control.moveable-w:hover,  .canva-moveable-style .moveable-control.moveable-w:active,
                .canva-moveable-style .moveable-control.moveable-e:hover,  .canva-moveable-style .moveable-control.moveable-e:active {
                    background: #7c3aed !important;
                }
                .canva-moveable-style .moveable-control.moveable-w,
                .canva-moveable-style .moveable-control.moveable-e {
                    width: 8px !important;
                    height: 20px !important;
                    border-radius: 4px !important;
                    margin-top: -10px !important;
                    margin-left: -4px !important;
                }
                .canva-moveable-style .moveable-control.moveable-n,
                .canva-moveable-style .moveable-control.moveable-s {
                    width: 20px !important;
                    height: 8px !important;
                    border-radius: 4px !important;
                    margin-left: -10px !important;
                    margin-top: -4px !important;
                }
                .canva-moveable-style .moveable-rotation-control {
                    width: 24px !important;
                    height: 24px !important;
                    border-radius: 50% !important;
                    background: #fff !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: none !important;
                    background-image: ${ROTATE_ICON_URL} !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                    background-size: 14px 14px !important;
                    margin-top: -12px !important;
                    margin-left: -12px !important;
                    cursor: grab !important;
                    transition: background-color 0.15s ease !important;
                }
                .canva-moveable-style .moveable-rotation-control:active {
                    cursor: grabbing !important;
                }
                .canva-moveable-style .moveable-rotation-control:hover {
                    background-color: #f9fafb !important;
                    background-image: ${ROTATE_ICON_URL} !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                    background-size: 14px 14px !important;
                }
                .canva-moveable-style .moveable-rotation-line {
                    display: none !important;
                }
                .canva-moveable-style .moveable-line {
                    background: #7c3aed !important;
                    box-shadow: 0 0 0 0.5px #7c3aed !important;
                }
                /* ─── Hiding Inactive Handles During Interaction ─── */
                .canva-moveable-style.moveable-dragging .moveable-control:not(:active),
                .canva-moveable-style.moveable-scaling .moveable-control:not(:active),
                .canva-moveable-style.moveable-rotating .moveable-control:not(:active) {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                .canva-moveable-style.moveable-dragging .moveable-rotation-control:not(:active),
                .canva-moveable-style.moveable-scaling .moveable-rotation-control:not(:active),
                .canva-moveable-style.moveable-rotating .moveable-rotation-control:not(:active) {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `}</style>
        </>
    );
}
