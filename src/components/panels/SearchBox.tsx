import React from 'react';
import { searchPlaces, MIN_QUERY_LENGTH, type GeoResult } from '../../api/geocode';

interface SearchBoxProps {
  isMobile: boolean;
  onSelect: (r: GeoResult) => void;
  /** Notifies the parent when the mobile field expands, so the TopBar can free the row for it. */
  onExpandedChange?: (expanded: boolean) => void;
}

const DEBOUNCE_MS = 350;

const SearchBox: React.FC<SearchBoxProps> = ({ isMobile, onSelect, onExpandedChange }) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  // Mobile: the input is collapsed behind a search icon until tapped.
  const [expanded, setExpanded] = React.useState(false);

  // While the mobile field is open it takes over the whole bar — tell the TopBar to hide its
  // action cluster so the input and the results list have room to be legible.
  React.useEffect(() => {
    onExpandedChange?.(isMobile && expanded);
  }, [isMobile, expanded, onExpandedChange]);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Debounced geocode whenever the query changes.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const found = await searchPlaces(q, ac.signal);
      if (ac.signal.aborted) return;
      setResults(found);
      setActiveIndex(found.length ? 0 : -1);
      setLoading(false);
      setOpen(true);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Close the dropdown on an outside click.
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Always collapse on mobile so the action cluster (SOS, alerts, menu) comes back.
        if (isMobile) setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isMobile, query]);

  const choose = (r: GeoResult): void => {
    onSelect(r);
    setQuery(r.label);
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
    if (isMobile) setExpanded(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[activeIndex] ?? results[0];
      if (pick) choose(pick);
    }
  };

  const showDropdown = open && (loading || results.length > 0);

  const dropdown = showDropdown && (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        right: 0,
        zIndex: 1400,
        background: '#fff',
        border: '1px solid var(--bw-line)',
        borderRadius: 11,
        boxShadow: '0 12px 34px rgba(15,23,42,.18)',
        overflow: 'hidden',
        maxHeight: 320,
        overflowY: 'auto',
      }}
    >
      {loading && results.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--bw-muted)' }}>Searching…</div>
      ) : (
        results.map((r, i) => (
          <button
            key={r.id}
            type="button"
            // Use mousedown so the input's blur doesn't close the list before the click lands.
            onMouseDown={(e) => { e.preventDefault(); choose(r); }}
            onMouseEnter={() => setActiveIndex(i)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              width: '100%',
              textAlign: 'left',
              padding: '10px 13px',
              border: 0,
              borderTop: i === 0 ? 'none' : '1px solid var(--bw-line)',
              background: i === activeIndex ? 'var(--bw-bg-subtle)' : '#fff',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--bw-ink)',
              lineHeight: 1.35,
            }}
          >
            <span style={{ fontSize: 13, color: '#9AA8B4', flex: 'none', marginTop: 1 }}>⚲</span>
            <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>{r.label}</span>
          </button>
        ))
      )}
    </div>
  );

  // ── Mobile: collapsed icon button that expands into the input ──
  if (isMobile && !expanded) {
    return (
      <button
        onClick={() => { setExpanded(true); window.setTimeout(() => inputRef.current?.focus(), 0); }}
        aria-label="Search a location"
        style={{
          width: 40,
          height: 40,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--bw-line)',
          background: 'var(--bw-bg-subtle)',
          borderRadius: 11,
          fontSize: 16,
          color: '#9AA8B4',
          cursor: 'pointer',
        }}
      >
        ⌕
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        flex: 1,
        ...(isMobile ? { minWidth: 0 } : { maxWidth: 440, margin: '0 8px' }),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 14px',
          height: 40,
          background: 'var(--bw-bg-subtle)',
          border: '1px solid var(--bw-line)',
          borderRadius: 11,
        }}
      >
        <span style={{ fontSize: 14, color: '#9AA8B4', flex: 'none' }}>⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder="Search a barangay, street or landmark…"
          style={{ border: 0, background: 'transparent', outline: 'none', fontSize: 13.5, width: '100%', color: 'var(--bw-ink)' }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            style={{ border: 0, background: 'transparent', color: '#9AA8B4', fontSize: 15, cursor: 'pointer', flex: 'none', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
};

export default SearchBox;
