import React from 'react';
import { depthReference } from '../../utils/floodMeta';
import { useI18n } from '../../i18n';

/**
 * A real-world reference for a flood depth so people can relate to the raw cm value: which body part
 * the water reaches on an average adult (shown as a small silhouette that fills to the level) plus a
 * vehicle cue. Derived purely from `depthCm` via `depthReference`. Used live under the report depth
 * slider (full) and inline on report cards (compact — just the word).
 */
interface Props {
  depthCm: number;
  /** Accent used to tint the "water" fill (usually the severity color). */
  color: string;
  /** Word-only, for inline use next to a cm value on a report card. */
  compact?: boolean;
}

const DepthReference: React.FC<Props> = ({ depthCm, color, compact }) => {
  const { t } = useI18n();
  const { band, fill, vehicle } = depthReference(depthCm);
  const label = t(`depthRef.${band}`);

  if (compact) {
    // e.g. "knee-deep" — the caller supplies any leading separator.
    return <span style={{ textTransform: 'lowercase' }}>{label}</span>;
  }

  const clipId = React.useId();
  // Silhouette geometry in a 24×60 viewBox: head circle + a torso that tapers to two legs.
  const head = <circle cx="12" cy="8" r="5.5" />;
  const body = <path d="M8 14 L16 14 L16.5 33 L15 58 L12.8 58 L12 39 L11.2 58 L9 58 L7.5 33 Z" />;
  const waterY = 60 * (1 - fill);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: 'var(--bw-bg-subtle)', border: '1px solid var(--bw-line)', borderRadius: 11 }}>
      <svg width={26} height={52} viewBox="0 0 24 60" aria-hidden="true" style={{ flex: 'none' }}>
        <defs>
          <clipPath id={clipId}>
            {head}
            {body}
          </clipPath>
        </defs>
        {/* Dry body (gray) then the water fill rising from the feet, both clipped to the silhouette. */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="24" height="60" fill="var(--bw-line)" />
          <rect x="0" y={waterY} width="24" height={60 - waterY} fill={color} opacity={0.85} />
        </g>
        {/* Thin outline so the figure reads clearly at small size. */}
        <g fill="none" stroke="var(--bw-faint)" strokeWidth={0.9}>
          {head}
          {body}
        </g>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color, lineHeight: 1.2 }}>≈ {label}</div>
        {vehicle && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--bw-muted)', marginTop: 2 }}>
            🚗 {t(`depthVeh.${vehicle}`)}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepthReference;
