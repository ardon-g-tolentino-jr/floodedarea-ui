import React from 'react';

// Inline-SVG icons for controls whose glyph IS the whole visible label. Unicode symbols are not a
// safe way to draw those: `⋯` (U+22EF), which used to be the mobile overflow button, has no glyph
// in the font stack of X's in-app browser (an Android WebView) and rendered as *nothing* — leaving
// an empty box that was still tappable but invisible, hiding the only route to Sign out and every
// secondary action on a phone. SVG can't fail that way. Follows the same inline-SVG approach as the
// TopBar logo. Icons draw in `currentColor`, so callers keep styling them with their own `color`.

export type IconName = 'more' | 'search';

interface IconProps {
  name: IconName;
  /** Square size in px — matches the `fontSize` the replaced glyph used at each call site. */
  size?: number;
}

const Icon: React.FC<IconProps> = ({ name, size = 18 }) => {
  // Decorative in every case: each call site already carries an aria-label or a placeholder.
  const common = { width: size, height: size, viewBox: '0 0 18 18', 'aria-hidden': true, focusable: false } as const;

  if (name === 'more') {
    return (
      <svg {...common} fill="currentColor">
        <circle cx="4" cy="9" r="1.6" />
        <circle cx="9" cy="9" r="1.6" />
        <circle cx="14" cy="9" r="1.6" />
      </svg>
    );
  }

  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
      <circle cx="7.8" cy="7.8" r="5" />
      <line x1="11.5" y1="11.5" x2="15.5" y2="15.5" />
    </svg>
  );
};

export default Icon;
