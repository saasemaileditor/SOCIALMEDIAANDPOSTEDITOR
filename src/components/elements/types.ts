// ─── Element Types ────────────────────────────────────────────────────────────
// All shared interfaces and types live here.
// No actual data. No imports of components. Just type definitions.
// ─────────────────────────────────────────────────────────────────────────────

export type ElementType = string;

/**
 * Definition of a single element shown in the Elements panel.
 * Each element component folder exports one of these per component.
 */
export interface PanelElementDef {
  /** Unique string key — must match the key in ELEMENT_REGISTRY */
  type: string;
  /** Label shown under the element card in the panel */
  label: string;
  /** Category folder id (e.g. 'buttons') */
  category: string;
  /** Human-readable category label shown in the sidebar */
  categoryLabel: string;
  /** [width, height] in pixels when placed on canvas */
  boundingSize: [number, number];
  /** Emoji shown as preview thumbnail in the panel card */
  previewEmoji?: string;
  /** Default prop values merged into node.data when dropped onto canvas */
  defaultProps?: Record<string, any>;
}
