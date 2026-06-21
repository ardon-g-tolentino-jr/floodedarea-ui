import React from 'react';

/** Mobile when the viewport is narrower than the desktop two-pane layout breakpoint. */
export function useIsMobile(breakpoint = 820): boolean {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  React.useEffect(() => {
    const onResize = (): void => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
}
