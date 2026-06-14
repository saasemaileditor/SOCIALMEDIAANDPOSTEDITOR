// ─── Category Index: cards ────────────────────────────────────────────────────
// Add card components here as you build them.
// ─────────────────────────────────────────────────────────────────────────────
import type { PanelElementDef } from '../types';

export const cardRegistry: Record<string, React.LazyExoticComponent<any>> = {
  // 'card-simple': lazy(() => import('./SimpleCard')),
};

export const cardPanelDefs: PanelElementDef[] = [
  // { type: 'card-simple', label: 'Simple Card', category: 'cards', categoryLabel: 'Cards', boundingSize: [320, 200], previewEmoji: '🃏' },
];
