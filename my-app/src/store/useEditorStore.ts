import { create } from 'zustand';
import { travel } from 'zustand-travel';
import type { ManualTravelsControls } from 'zustand-travel';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimelineScene = {
    id: string;
    duration: number;
    leadingGap?: number;
};

// ─── Easing & Keyframe ────────────────────────────────────────────────────────

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

export type Keyframe = {
    frame: number;
    value: number;
    easing?: EasingType;
};

// ─── Node Animation ───────────────────────────────────────────────────────────
// Every SceneNode (element AND sub-layer) carries its own independent
// animation list. A card can slide in while its child text types itself.

export type NodeAnimation = {
    property: 'x' | 'y' | 'opacity' | 'rotation' | 'scaleX' | 'scaleY' | 'width' | 'height';
    keyframes: Keyframe[];
};

// ─── Universal Effects ────────────────────────────────────────────────────────
// Every node gets the same effects panel — blur, glow, shadow, colorGrade.
// Effects are universal: they do not care about element type (After Effects model).

export type EffectType = 'blur' | 'glow' | 'shadow' | 'colorGrade';

export type UniversalEffect = {
    type: EffectType;
    // All effect params live here as key/value pairs.
    // blur:       { intensity: 4 }
    // glow:       { radius: 10, color: '#ffffff', opacity: 0.8 }
    // shadow:     { offsetX: 2, offsetY: 4, blur: 8, color: '#000000', opacity: 0.5 }
    // colorGrade: { brightness: 1, contrast: 1, saturation: 1, hue: 0 }
    params: Record<string, number | string>;
    enabled: boolean;
};

// ─── Serializable value type ──────────────────────────────────────────────────
// Enforces compile-time safety: only plain JSON-compatible values are allowed.
// Prevents functions, DOM nodes, and class instances from entering Zustand state
// and breaking database saves or undo/redo snapshots.

export type SerializableValue =
    | string
    | number
    | boolean
    | null
    | SerializableValue[]
    | { [key: string]: SerializableValue };

// ─── Scene Node ───────────────────────────────────────────────────────────────
// The core unit of the Scene Graph. Replaces CanvasElement entirely.
// Every element on the canvas IS a SceneNode.
// Every sub-component inside an element IS also a SceneNode (a child node).
// This enables infinite nesting: Card → [Text, Icon, Background → [Gradient, Border]]

export type SceneNode = {
    id: string;

    // Node category type — extend this union as you add more node types.
    // 'group' is for user-created merged element groups.
    type:
        | 'text'
        | 'device'
        | 'card'
        | '3d'
        | 'chart'
        | 'counter'
        | 'button'
        | 'icon'
        | 'shape'
        | 'list'
        | 'searchBar'
        | 'notification'
        | 'group';

    // ─── Transform (raw numbers, NOT css strings) ─────────────────────────────
    // For child nodes, x/y are relative to parent origin (local space).
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;   // degrees
    scaleX: number;     // 1 = normal
    scaleY: number;     // 1 = normal
    opacity: number;    // 0 to 1

    // ─── Stacking ─────────────────────────────────────────────────────────────
    zIndex?: number;

    // ─── Real Parent-Child Tree ───────────────────────────────────────────────
    // Replaces the old fake `parentId` pointer system.
    // children holds the sub-layers that live inside this node.
    // Example: Card → children: [TextNode, IconNode, BackgroundNode]
    // Each child has its own animations, effects, and transform independently.
    children: SceneNode[];

    // ─── Typed data block ─────────────────────────────────────────────────────
    // Replaces the old generic `props` blob.
    // Still 100% JSON-serializable via SerializableValue.
    // Example: text node → { fontFamily: 'Inter', fontSize: 24, color: '#fff' }
    data: Record<string, SerializableValue>;

    // ─── Per-node animations ──────────────────────────────────────────────────
    // Every node — parent OR child — has its own independent animation list.
    animations: NodeAnimation[];

    // ─── Per-node effects ─────────────────────────────────────────────────────
    // Every node gets the same universal effects panel (After Effects model).
    effects: UniversalEffect[];

    // ─── Content ──────────────────────────────────────────────────────────────
    content?: string; // text string or URL for image/video

    // ─── Bounding size ────────────────────────────────────────────────────────
    // Used by CanvaBoundingBox for selection outline before scale is applied.
    boundingSize?: [number, number];
};

// ─── CSS Matrix Parser ────────────────────────────────────────────────────────

/**
 * Parses a CSS transform string from react-moveable into raw numbers.
 * react-moveable outputs strings like: "translate(150px, 200px) rotate(45deg) scale(1.2, 1)"
 * or matrix format: "matrix(a, b, c, d, tx, ty)"
 * We extract raw x, y, rotation, scaleX, scaleY numbers for Zustand storage.
 */
export function parseTransformToNumbers(transform: string): {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
} {
    try {
        const matrix = new DOMMatrix(transform);
        const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
        const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
        const rotation = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
        return {
            x: matrix.m41,
            y: matrix.m42,
            rotation,
            scaleX,
            scaleY,
        };
    } catch {
        return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    }
}

// ─── UI State Store (Non-Undoable) ──────────────────────────────────────────

interface UIState {
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;

    // Timeline state
    isPlaying: boolean;
    setIsPlaying: (isPlaying: boolean) => void;
    currentTime: number;
    setCurrentTime: (time: number | ((prev: number) => number)) => void;

    // Canvas Settings
    canvasFormat: { width: number; height: number; ratio: string } | null;
    setCanvasFormat: (format: { width: number; height: number; ratio: string }) => void;

    // Canvas zoom & pan
    zoom: number;
    panX: number;
    panY: number;
    setZoom: (z: number) => void;
    setPan: (x: number, y: number) => void;

    // Zoom slider target toggle (bottom bar slider controls this target)
    zoomTarget: 'canvas' | 'timeline';
    setZoomTarget: (target: 'canvas' | 'timeline') => void;
}

export const useUIStore = create<UIState>((set) => ({
    selectedId: null,
    setSelectedId: (id) => set({ selectedId: id }),

    isPlaying: false,
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    currentTime: 0,
    setCurrentTime: (time) => set((state) => ({
        currentTime: typeof time === 'function' ? time(state.currentTime) : time
    })),

    canvasFormat: null,
    setCanvasFormat: (format) => set({ canvasFormat: format }),

    // Canvas zoom & pan
    zoom: 1,
    panX: 0,
    panY: 0,
    setZoom: (z) => set({ zoom: z }),
    setPan: (x, y) => set({ panX: x, panY: y }),

    // Zoom slider target toggle
    zoomTarget: 'canvas',
    setZoomTarget: (target) => set({ zoomTarget: target }),
}));

// ─── Document State Store (Undoable) ──────────────────────────────────────────

interface EditorState {
    // ─── Scene Graph State ────────────────────────────────────────────────────
    // nodes: ordered array of ROOT-level SceneNodes (top-level canvas elements).
    // Children live INSIDE each node's .children array — not here.
    // This is the single source of truth for the entire canvas.
    nodes: SceneNode[];

    // nodeMap: flat lookup table { [id]: SceneNode } for O(1) access by id.
    // Includes ALL nodes at ALL depths (root + all children recursively).
    // Always kept in sync with `nodes` by every action that mutates the tree.
    nodeMap: Record<string, SceneNode>;

    // UNDOABLE — timeline scenes (shared undo/redo with nodes)
    scenes: TimelineScene[];

    // ─── Node Actions ─────────────────────────────────────────────────────────

    // Adds a root-level node to the canvas.
    // If parentId is provided, adds as a child of that parent node instead.
    addNode: (node: SceneNode, parentId?: string) => void;

    // Updates any fields of a node by id. Works at any depth in the tree.
    updateNode: (id: string, data: Partial<SceneNode>) => void;

    // Removes a node by id. Also removes all its children recursively.
    removeNode: (id: string) => void;

    // Reorders root-level nodes (changes canvas z-order / layer panel order).
    reorderNodes: (oldIndex: number, newIndex: number) => void;

    // ─── Scene Actions (unchanged) ────────────────────────────────────────────
    setScenes: (scenes: TimelineScene[] | ((prev: TimelineScene[]) => TimelineScene[])) => void;
    addScene: (scene: TimelineScene, atIndex?: number) => void;
    updateScene: (id: string, data: Partial<Omit<TimelineScene, 'id'>>) => void;
    removeScene: (id: string) => void;
}

// ─── Tree Helper Functions ────────────────────────────────────────────────────
// Pure functions — no side effects. Take the nodes array, return a new one.
// Used inside store actions to keep action bodies clean and readable.

/**
 * Rebuilds the flat nodeMap from the root nodes array.
 * Walks the entire tree recursively and indexes every node by its id.
 * Must be called after ANY mutation so nodeMap never goes stale.
 */
function buildNodeMap(nodes: SceneNode[]): Record<string, SceneNode> {
    const map: Record<string, SceneNode> = {};
    function walk(node: SceneNode) {
        map[node.id] = node;
        node.children.forEach(walk);
    }
    nodes.forEach(walk);
    return map;
}

/**
 * Immutably updates a single node anywhere in the tree by id.
 * Recursively descends until it finds the target, then merges `data` into it.
 * Returns a brand new nodes array — original is never mutated.
 */
function updateNodeInTree(
    nodes: SceneNode[],
    id: string,
    data: Partial<SceneNode>
): SceneNode[] {
    return nodes.map((node) => {
        if (node.id === id) {
            return { ...node, ...data };
        }
        if (node.children.length > 0) {
            return { ...node, children: updateNodeInTree(node.children, id, data) };
        }
        return node;
    });
}

/**
 * Immutably removes a node anywhere in the tree by id.
 * Removing a parent automatically removes all its children (they live inside it).
 * Returns a brand new nodes array — original is never mutated.
 */
function removeNodeFromTree(nodes: SceneNode[], id: string): SceneNode[] {
    return nodes
        .filter((node) => node.id !== id)
        .map((node) => ({
            ...node,
            children: removeNodeFromTree(node.children, id),
        }));
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()(
    travel(
        (set) => ({
            // Scene Graph state — starts empty
            nodes: [] as SceneNode[],
            nodeMap: {} as Record<string, SceneNode>,
            scenes: [] as TimelineScene[],

            // ─── addNode ──────────────────────────────────────────────────────
            // No parentId → adds as a root-level node on the canvas.
            // With parentId → injects node into that parent's children array.
            addNode: (node, parentId) =>
                set((state) => {
                    let newNodes: SceneNode[];
                    if (!parentId) {
                        // Root-level: append to the end of the canvas layer stack
                        newNodes = [...state.nodes, node];
                    } else {
                        // Child-level: inject into parent's children array
                        const parent = state.nodeMap[parentId];
                        newNodes = updateNodeInTree(state.nodes, parentId, {
                            children: [...(parent?.children ?? []), node],
                        });
                    }
                    return {
                        nodes: newNodes,
                        nodeMap: buildNodeMap(newNodes),
                        scenes: state.scenes,
                    };
                }),

            // ─── updateNode ───────────────────────────────────────────────────
            // Works at ANY depth in the tree. Merges `data` into the target node.
            updateNode: (id, data) =>
                set((state) => {
                    const newNodes = updateNodeInTree(state.nodes, id, data);
                    return {
                        nodes: newNodes,
                        nodeMap: buildNodeMap(newNodes),
                        scenes: state.scenes,
                    };
                }),

            // ─── removeNode ───────────────────────────────────────────────────
            // Removes node AND all its children recursively at any depth.
            removeNode: (id) =>
                set((state) => {
                    const newNodes = removeNodeFromTree(state.nodes, id);
                    return {
                        nodes: newNodes,
                        nodeMap: buildNodeMap(newNodes),
                        scenes: state.scenes,
                    };
                }),

            // ─── reorderNodes ─────────────────────────────────────────────────
            // Reorders root-level nodes only (canvas layer order / layers panel).
            reorderNodes: (oldIndex, newIndex) =>
                set((state) => {
                    const updated = [...state.nodes];
                    const [moved] = updated.splice(oldIndex, 1);
                    updated.splice(newIndex, 0, moved);
                    return {
                        nodes: updated,
                        nodeMap: buildNodeMap(updated),
                        scenes: state.scenes,
                    };
                }),

            // ─── Scene actions (logic unchanged, references updated) ───────────

            // Replaces the entire scenes array (supports updater function)
            setScenes: (scenesOrFn) =>
                set((state) => ({
                    nodes: state.nodes,
                    nodeMap: state.nodeMap,
                    scenes: typeof scenesOrFn === 'function'
                        ? scenesOrFn(state.scenes)
                        : scenesOrFn,
                })),

            // Adds a scene at the end, or at a specific index
            addScene: (scene, atIndex) =>
                set((state) => {
                    const updated = [...state.scenes];
                    if (atIndex !== undefined) {
                        updated.splice(atIndex, 0, scene);
                    } else {
                        updated.push(scene);
                    }
                    return {
                        nodes: state.nodes,
                        nodeMap: state.nodeMap,
                        scenes: updated,
                    };
                }),

            // Updates a single scene's fields by id
            updateScene: (id, data) =>
                set((state) => ({
                    nodes: state.nodes,
                    nodeMap: state.nodeMap,
                    scenes: state.scenes.map((s) =>
                        s.id === id ? { ...s, ...data } : s
                    ),
                })),

            // Removes a scene by id
            removeScene: (id) =>
                set((state) => ({
                    nodes: state.nodes,
                    nodeMap: state.nodeMap,
                    scenes: state.scenes.filter((s) => s.id !== id),
                })),
        }),
        {
            // Manual archive: we call controls.archive() ourselves on drag/scale end.
            // This means ONE checkpoint per gesture, not one per pixel.
            autoArchive: false,
            maxHistory: 50,
        }
    )
);

// ─── History controls ─────────────────────────────────────────────────────────

/**
 * Returns the zustand-travel controls object.
 * Call controls.archive() to save a history checkpoint.
 * Call controls.back() / controls.forward() for undo / redo.
 */
export function getHistoryControls(): ManualTravelsControls<EditorState, false> {
    // getControls is injected by the travel middleware onto the store.
    // Double-cast via unknown because the middleware wraps state in StoreApi<T>.
    return useEditorStore.getControls!() as unknown as ManualTravelsControls<EditorState, false>;
}
