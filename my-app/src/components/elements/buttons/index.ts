// ─── Category Index: buttons ──────────────────────────────────────────────────
// This file is the single collector for EVERYTHING inside the buttons/ folder.
//
// How to add a new button:
//   1. Create ButtonMyName.tsx in this folder
//   2. Export the component as default from that file
//   3. Add one import + one panelDef entry here
//   4. Done. registry.ts and panelElements.ts pick it up automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { lazy } from 'react';
import type { PanelElementDef } from '../types';

// ── Lazy component imports (code-split per button) ───────────────────────────
export const SimpleButton = lazy(() => import('./SimpleButton'));

// ── Registry slice — consumed by registry.ts ─────────────────────────────────
export const buttonRegistry: Record<string, React.LazyExoticComponent<any>> = {
  'button-simple': SimpleButton,
};

// ── Panel definitions slice — consumed by panelElements.ts ───────────────────
export const buttonPanelDefs: PanelElementDef[] = [
  {
    type:          'button-simple',
    label:         'Simple Button',
    category:      'buttons',
    categoryLabel: 'Buttons',
    boundingSize:  [200, 48],
    previewEmoji:  '🟣',
    defaultProps:  {
      label:   'Click me',
      variant: 'solid',
      size:    'md',
    },
  },
];
