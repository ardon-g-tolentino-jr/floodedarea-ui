// Tap-to-talk voice input for the in-transit quick-report mode. A thin wrapper around the Web
// Speech API (SpeechRecognition for listening, SpeechSynthesis for the TTS confirmation) — both
// are unevenly supported (solid in Chrome desktop/Android, spotty on iOS Safari, absent in
// Firefox), so every entry point here degrades to a no-op rather than throwing. The quick-report
// UI treats voice as a progressive enhancement on top of the always-available tap buttons.

import type { Lang } from '../i18n';
import type { Severity } from '../types';

// Chrome/Safari still expose this under the vendor-prefixed name; Firefox has neither.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether this browser can listen for speech at all. */
export function speechSupported(): boolean {
  return getRecognitionCtor() != null;
}

/** Whether this browser can speak a confirmation back. */
export function speechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

const RECOGNITION_LANG: Record<Lang, string> = { en: 'en-PH', fil: 'fil-PH' };

// Keyword → severity. Phrases mirror the severity picker's own copy (chest/knee-waist/ankle,
// impassable/risky/passable) plus the plain "high/medium/low" a driver is most likely to say.
const SEVERITY_KEYWORDS: [RegExp, Severity][] = [
  [/\b(high|deep|chest|impassable|severe)\b/i, 'high'],
  [/\b(medium|med|knee|waist|risky)\b/i, 'medium'],
  [/\b(low|ankle|passable|shallow|mild)\b/i, 'low'],
];

function matchSeverity(transcript: string): Severity | null {
  for (const [re, sev] of SEVERITY_KEYWORDS) {
    if (re.test(transcript)) return sev;
  }
  return null;
}

export interface ListenForSeverityOptions {
  lang: Lang;
  /** Called with the recognized severity, or null when nothing in the transcript matched. */
  onResult: (sev: Severity | null, transcript: string) => void;
  /** Called on a recognition error (permission denied, no speech, network, ...). */
  onError?: (message: string) => void;
  /** Called once the mic has stopped listening, success or not — good for resetting UI state. */
  onEnd?: () => void;
}

/**
 * Start a single-utterance listen for a severity word. Returns a cancel function; safe to call
 * even after the recognition has already ended. No-ops (never calls back) when unsupported.
 */
export function listenForSeverity(opts: ListenForSeverityOptions): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return () => {};

  const recognition = new Ctor();
  recognition.lang = RECOGNITION_LANG[opts.lang];
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let cancelled = false;

  recognition.onresult = (event: any) => {
    if (cancelled) return;
    const transcript: string = event.results?.[0]?.[0]?.transcript ?? '';
    opts.onResult(matchSeverity(transcript), transcript);
  };
  recognition.onerror = (event: any) => {
    if (cancelled) return;
    opts.onError?.(event.error ?? 'speech-error');
  };
  recognition.onend = () => {
    if (cancelled) return;
    opts.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    opts.onError?.('speech-start-failed');
  }

  return () => {
    cancelled = true;
    try {
      recognition.stop();
    } catch {
      // already stopped
    }
  };
}

/** Speak a short confirmation, e.g. "Reported high flood here". No-op if unsupported. */
export function speak(text: string, lang: Lang): void {
  if (!speechSynthesisSupported()) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = RECOGNITION_LANG[lang];
  window.speechSynthesis.speak(utter);
}
