// ─── Panel Elements ───────────────────────────────────────────────────────────
// The flat list of all elements shown as cards in the elements panel.
// Built by merging the panelDefs slice from every category index.
//
// To add a new element: add its def to its category's index.ts panelDefs array.
// This file never needs to change — it merges everything automatically.
// ─────────────────────────────────────────────────────────────────────────────

import type { PanelElementDef } from './types';

import { buttonPanelDefs }      from './buttons';
import { cardPanelDefs }        from './cards';
import { textPanelDefs }        from './text';
import { inputPanelDefs }       from './inputs';
import { uiBadgePanelDefs }     from './uiBadges';
import { avatarPanelDefs }      from './avatars';
import { alertPanelDefs }       from './alerts';
import { tooltipPanelDefs }     from './tooltips';
import { shapePanelDefs }       from './shapes';
import { layoutPanelDefs }      from './layouts';
import { dividerPanelDefs }     from './dividers';
import { mediaFramePanelDefs }  from './mediaFrames';
import { iconPanelDefs }        from './icons';
import { socialProofPanelDefs } from './socialProof';
import { progressPanelDefs }    from './progress';
import { chartPanelDefs }       from './charts';

export const PANEL_ELEMENTS: PanelElementDef[] = [
  ...buttonPanelDefs,
  ...cardPanelDefs,
  ...textPanelDefs,
  ...inputPanelDefs,
  ...uiBadgePanelDefs,
  ...avatarPanelDefs,
  ...alertPanelDefs,
  ...tooltipPanelDefs,
  ...shapePanelDefs,
  ...layoutPanelDefs,
  ...dividerPanelDefs,
  ...mediaFramePanelDefs,
  ...iconPanelDefs,
  ...socialProofPanelDefs,
  ...progressPanelDefs,
  ...chartPanelDefs,
];
