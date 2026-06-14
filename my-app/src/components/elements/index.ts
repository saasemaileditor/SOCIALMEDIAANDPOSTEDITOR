// ─── elements/index.ts ────────────────────────────────────────────────────────
// THE FRONT DOOR. Re-exports only. No logic. No data. Stays ≤15 lines forever.
// ─────────────────────────────────────────────────────────────────────────────

export type { ElementType, PanelElementDef } from './types';
export { getElementComponent }               from './registry';
export { ELEMENT_CATEGORIES }                from './categories';
export { PANEL_ELEMENTS }                    from './panelElements';
