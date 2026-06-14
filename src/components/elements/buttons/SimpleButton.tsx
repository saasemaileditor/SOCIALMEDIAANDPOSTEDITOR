import type { CSSProperties } from 'react';

// ─── SimpleButton ─────────────────────────────────────────────────────────────
// A self-contained button element for the canvas.
//
// Design contract (shared with all elements):
//   • Accepts `isDark` for theme-awareness during canvas rendering.
//   • Accepts `style` (injected by SceneElement as width/boxSizing/pointerEvents).
//   • Accepts `children` so the panel preview can pass "Preview" as a child string.
//   • All other visual state (label, variant, size) comes from `node.data` via
//     defaultProps and is spread onto this component by SceneElement.
//   • Built with React + Tailwind v4 — zero vanilla CSS, zero trade-offs.
// ──────────────────────────────────────────────────────────────────────────────

export type SimpleButtonVariant = 'solid' | 'outline' | 'ghost' | 'soft';
export type SimpleButtonSize    = 'sm' | 'md' | 'lg';

export interface SimpleButtonProps {
  /** Text displayed on the button. Falls back to "Click me" if omitted. */
  label?:    string;
  /** Visual style of the button. */
  variant?:  SimpleButtonVariant;
  /** Predefined size token. */
  size?:     SimpleButtonSize;
  /** Passed by the canvas dark-mode system. */
  isDark?:   boolean;
  /** Injected by SceneElement (width, boxSizing, pointerEvents). */
  style?:    CSSProperties;
  /** Used by DraggableElementCard preview ("Preview" string). */
  children?: React.ReactNode;
}

// ─── Style maps (Tailwind v4 utility strings) ─────────────────────────────────

const SIZE_CLASSES: Record<SimpleButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg  gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl  gap-2',
  lg: 'px-7 py-3.5 text-base rounded-2xl gap-2.5',
};

// Variant classes are split into light / dark pairs so both themes render
// correctly on the canvas without any runtime JS logic.
const VARIANT_CLASSES: Record<SimpleButtonVariant, { light: string; dark: string }> = {
  solid: {
    light: 'bg-violet-600 text-white border border-violet-600 shadow-sm shadow-violet-200 hover:bg-violet-700 hover:border-violet-700 active:scale-[0.97]',
    dark:  'bg-violet-500 text-white border border-violet-500 shadow-sm shadow-violet-900/40 hover:bg-violet-600 hover:border-violet-600 active:scale-[0.97]',
  },
  outline: {
    light: 'bg-transparent text-violet-700 border border-violet-400 hover:bg-violet-50 active:scale-[0.97]',
    dark:  'bg-transparent text-violet-300 border border-violet-500 hover:bg-violet-950/60 active:scale-[0.97]',
  },
  ghost: {
    light: 'bg-transparent text-violet-700 border border-transparent hover:bg-violet-50 active:scale-[0.97]',
    dark:  'bg-transparent text-violet-300 border border-transparent hover:bg-violet-950/50 active:scale-[0.97]',
  },
  soft: {
    light: 'bg-violet-100 text-violet-800 border border-violet-100 hover:bg-violet-200 hover:border-violet-200 active:scale-[0.97]',
    dark:  'bg-violet-950/70 text-violet-300 border border-violet-900 hover:bg-violet-900/80 active:scale-[0.97]',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SimpleButton({
  label    = 'Click me',
  variant  = 'solid',
  size     = 'md',
  isDark   = false,
  style,
  children,
}: SimpleButtonProps) {
  const themeKey  = isDark ? 'dark' : 'light';
  const sizeClass = SIZE_CLASSES[size]    ?? SIZE_CLASSES.md;
  const varClass  = VARIANT_CLASSES[variant]?.[themeKey] ?? VARIANT_CLASSES.solid.light;

  return (
    <button
      type="button"
      style={style}
      // Tailwind v4 — all classes are plain utilities (no @apply, no plugin needed)
      className={[
        // Layout
        'inline-flex items-center justify-center whitespace-nowrap',
        // Typography
        'font-semibold tracking-wide leading-none select-none',
        // Transition
        'transition-all duration-150 ease-out',
        // Focus ring
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
        // Size + variant
        sizeClass,
        varClass,
      ].join(' ')}
    >
      {/* children takes precedence (panel preview injects "Preview") */}
      {children ?? label}
    </button>
  );
}
