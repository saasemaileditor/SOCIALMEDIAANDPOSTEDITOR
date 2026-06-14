import React, { useRef } from 'react';
import { useEditorStore, useUIStore } from '../store/useEditorStore';
import { CanvaBoundingBox } from './CanvaBoundingBox';
import type { SceneNode } from '../store/useEditorStore';

// ─── Element component registry ──────────────────────────────────────────────
// As you build more elements, import and add them here.
// Key = element type string, Value = React component
const ELEMENT_REGISTRY: Record<string, React.FC<any>> = {
};

// ─── Single node renderer ─────────────────────────────────────────────────────
// Renders one SceneNode as a positioned div on the canvas.
// For child nodes, x/y are in parent-local space — the parent div handles
// the offset naturally via CSS (children are positioned inside the parent div).
function CanvasNodeRenderer({
    node,
    containerRef,
}: {
    node: SceneNode;
    containerRef: React.RefObject<HTMLDivElement | null>;
}) {
    const targetRef = useRef<HTMLDivElement>(null);
    const { selectedId, setSelectedId } = useUIStore();
    const updateNode = useEditorStore((s) => s.updateNode);
    const isSelected = selectedId === node.id;

    // Build CSS transform from raw numbers stored on the node
    const transform = `translate(${node.x}px, ${node.y}px) rotate(${node.rotation}deg) scale(${node.scaleX}, ${node.scaleY})`;

    // Look up the correct component from registry
    const NodeComponent = ELEMENT_REGISTRY[node.type];

    return (
        <>
            <div
                ref={targetRef}
                onClick={(e) => { e.stopPropagation(); setSelectedId(node.id); }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: node.width,
                    height: node.height,
                    transform,
                    transformOrigin: 'center center',
                    opacity: node.opacity,
                    zIndex: node.zIndex ?? 0,
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                {/* Render the actual element component with its typed data block */}
                {NodeComponent && (
                    <NodeComponent
                        {...node.data}
                        width={node.width}
                        height={node.height}
                        content={node.content}
                    />
                )}

                {/* Render children recursively — they are positioned inside this div */}
                {node.children.map((child) => (
                    <CanvasNodeRenderer
                        key={child.id}
                        node={child}
                        containerRef={containerRef}
                    />
                ))}
            </div>

            {/* Show bounding box only when this node is selected */}
            {isSelected && (
                <CanvaBoundingBox
                    el={node}
                    updateNode={updateNode}
                    containerRef={containerRef}
                    targetRef={targetRef}
                />
            )}
        </>
    );
}

// ─── Main Canvas Renderer ─────────────────────────────────────────────────────
// Iterates over root-level nodes only. Children are rendered recursively
// inside CanvasNodeRenderer — they do not appear here at the root level.
export function CanvasRenderer() {
    const nodes = useEditorStore((s) => s.nodes);
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                background: '#1a1a1a',
            }}
        >
            {nodes.map((node) => (
                <CanvasNodeRenderer
                    key={node.id}
                    node={node}
                    containerRef={containerRef}
                />
            ))}
        </div>
    );
}
