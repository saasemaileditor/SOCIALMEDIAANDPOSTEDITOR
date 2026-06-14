// ─── Element Registry ─────────────────────────────────────────────────────────
// Maps element type string → lazy React component.
// This file only imports from category index files — never from individual
// component files directly. That keeps this file permanently small.
//
// To register a new category:
//   1. Create the category folder with its own index.ts
//   2. Import its registry slice here and spread into ELEMENT_REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

import { buttonRegistry }     from './buttons';
import { cardRegistry }       from './cards';
import { textRegistry }       from './text';
import { inputRegistry }      from './inputs';
import { uiBadgeRegistry }    from './uiBadges';
import { avatarRegistry }     from './avatars';
import { alertRegistry }      from './alerts';
import { tooltipRegistry }    from './tooltips';
import { shapeRegistry }      from './shapes';
import { layoutRegistry }     from './layouts';
import { dividerRegistry }    from './dividers';
import { mediaFrameRegistry } from './mediaFrames';
import { iconRegistry }       from './icons';
import { socialProofRegistry }from './socialProof';
import { progressRegistry }   from './progress';
import { chartRegistry }      from './charts';

const ELEMENT_REGISTRY: Record<string, React.LazyExoticComponent<any>> = {
  ...buttonRegistry,
  ...cardRegistry,
  ...textRegistry,
  ...inputRegistry,
  ...uiBadgeRegistry,
  ...avatarRegistry,
  ...alertRegistry,
  ...tooltipRegistry,
  ...shapeRegistry,
  ...layoutRegistry,
  ...dividerRegistry,
  ...mediaFrameRegistry,
  ...iconRegistry,
  ...socialProofRegistry,
  ...progressRegistry,
  ...chartRegistry,
};

/**
 * Returns the lazy React component for the given element type,
 * or null if no component has been registered for that type.
 *
 * Consumed by:
 *   • DraggableElementCard  (panel preview, 55% scale)
 *   • SceneElement          (canvas render, full size)
 */
export const getElementComponent = (type: string): React.LazyExoticComponent<any> | null =>
  ELEMENT_REGISTRY[type] ?? null;
