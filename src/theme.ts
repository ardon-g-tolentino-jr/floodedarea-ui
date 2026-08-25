// Lightweight app-wide theme (dark mode) store. Mirrors i18n.ts's shape exactly: a tiny
// module-level store + a useSyncExternalStore hook rather than React Context/Redux (per the
// project's "no global store" convention) so any component can call useTheme() without threading
// props through App.tsx (which already passes ~20 callbacks into TopBar alone).
//
// Three modes: 'system' (default — follows the OS/browser's prefers-color-scheme), 'light', 'dark'.
// `choice` is what the user picked; `resolved` is what we actually render (system resolves to
// light/dark live). localStorage — not sessionStorage — is deliberate: it's not auth-bound and
// survives across visits for guests too, exactly like baha_lang_v1.
//
// index.html has a small inline script that duplicates the storage-read + resolve logic below so
// the theme can be stamped on <html> before the first paint (a module import can't run that early).
// Keep the STORAGE_KEY string and the resolve rule in sync with that script if either changes.

import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'baha_theme_v1';

const media: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function systemPrefersDark(): boolean {
  return media?.matches ?? false;
}

function loadChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    return 'system';
  }
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : choice;
}

let currentChoice: ThemeChoice = loadChoice();
let currentResolved: ResolvedTheme = resolve(currentChoice);
const listeners = new Set<() => void>();

export function getChoice(): ThemeChoice {
  return currentChoice;
}

export function getResolved(): ResolvedTheme {
  return currentResolved;
}

/** Stamps the resolved theme on <html> and updates the runtime theme-color meta tag (overrides
 *  index.html's static light/dark media-query pair once a choice has actually been resolved here). */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1017' : '#0ea5e9');
}

export function setChoice(choice: ThemeChoice): void {
  currentChoice = choice;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* storage blocked — theme still applies for this session */
  }
  currentResolved = resolve(currentChoice);
  applyTheme(currentResolved);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Follow the OS/browser theme live, but only while the user hasn't overridden it — an explicit
// Light/Dark choice must never move when the OS theme flips.
media?.addEventListener('change', () => {
  if (currentChoice !== 'system') return;
  currentResolved = resolve(currentChoice);
  applyTheme(currentResolved);
  for (const fn of listeners) fn();
});

// Stamp the initial theme once at import. index.html's pre-paint script already set the <html>
// attribute, but nothing has touched meta[name=theme-color] yet — and the static media-scoped pair
// in index.html tracks the *OS*, which is the wrong answer whenever the user's explicit choice
// disagrees with it (pick Dark on a light-set phone and the address bar would stay sky blue).
applyTheme(currentResolved);

/** React hook: current choice + resolved theme + the setter. Re-renders on theme change. */
export function useTheme(): { choice: ThemeChoice; resolved: ResolvedTheme; setChoice: (c: ThemeChoice) => void } {
  const choice = useSyncExternalStore(subscribe, getChoice, getChoice);
  const resolved = useSyncExternalStore(subscribe, getResolved, getResolved);
  return { choice, resolved, setChoice };
}
