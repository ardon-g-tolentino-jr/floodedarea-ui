import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { EvacuationCenter, FloodProneArea, LatLng, RoadSegment, TripStop } from '../../types';
import { RESCUE_STATUS_META, ROAD_META } from '../../utils/floodMeta';
import { affectedRadiusKm, type EnrichedReport, type EnrichedRescue, type PossibleClosure } from '../../utils/viewModel';
import { formatDuration } from '../../utils/format';
import { LEVEL_STYLE } from '../panels/AlertRibbon';

export interface MapFocus extends LatLng {
  /** Bumped on every search so re-selecting the same place still re-flies the map. */
  key: number;
}

export interface SearchMark extends LatLng {
  label: string;
}

interface FloodMapProps {
  userLoc: LatLng;
  /** GPS accuracy radius (meters) for the latest fix; draws the uncertainty ring. Null = unknown. */
  userAccuracyM?: number | null;
  reports: EnrichedReport[];
  centers: EvacuationCenter[];
  roadSegments: RoadSegment[];
  /** Inferred possible-closure roads (area-based). Optional — consumers that don't infer omit it. */
  possibleClosures?: PossibleClosure[];
  showRoads: boolean;
  showShelters: boolean;
  /** Projected extra water rise (cm) for the predictive outer ring; 0 = current state only. */
  projectedRiseCm: number;
  monitorRadiusKm: number;
  selectedReportId: number | null;
  selEvacId: number | null;
  reportMode: boolean;
  pending: LatLng | null;
  focus: MapFocus | null;
  searchMark: SearchMark | null;
  onMapClick: (latlng: LatLng) => void;
  onSelectReport: (id: number) => void;
  onSelectEvac: (id: number) => void;
  /** Optional rescue-request layer (response console): status-colored pins. */
  rescues?: EnrichedRescue[];
  selectedRescueId?: number | null;
  onSelectRescue?: (id: number) => void;
  /** Ordered stops of the active trip, if any. */
  tripStops?: TripStop[];
  /** Ids of stops with a currently-matching active report — drawn amber instead of violet. */
  affectedStopIds?: string[];
  selectedStopId?: string | null;
  onSelectStop?: (id: string) => void;
  /** Admin-pinned flood-prone areas (persistent pin + radius), shown to every visitor. */
  floodProneAreas?: FloodProneArea[];
  /** Layer toggle for the flood-prone zones — omit/true shows them, false hides. */
  showFloodProne?: boolean;
}

const shelterIconHtml = (color: string): string =>
  `<div style="width:26px;height:26px;border-radius:8px;background:${color};border:2px solid #fff;box-shadow:0 2px 7px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center">
     <svg viewBox="0 0 24 24" style="width:13px;height:13px"><path d="M12 3 L21 11 H18 V20 H14 V14 H10 V20 H6 V11 H3 Z" fill="#fff"/></svg>
   </div>`;

function shelterIcon(): L.DivIcon {
  return L.divIcon({ html: shelterIconHtml('#0E7490'), className: 'bw-divicon', iconSize: [26, 26], iconAnchor: [13, 13] });
}

function youIcon(): L.DivIcon {
  const html = `
    <div style="position:relative;width:40px;height:40px">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(14,165,233,.35);animation:youPulse 2.6s ease-out infinite"></div>
      <div style="position:absolute;left:13px;top:13px;width:14px;height:14px;border-radius:50%;background:#0EA5E9;border:3px solid #fff;box-shadow:0 2px 7px rgba(14,165,233,.6)"></div>
      <div style="position:absolute;left:34px;top:11px;padding:2px 7px;background:#0EA5E9;color:#fff;font-size:10px;font-weight:800;border-radius:7px;white-space:nowrap;box-shadow:0 2px 6px rgba(14,165,233,.4)">You</div>
    </div>`;
  return L.divIcon({ html, className: 'bw-divicon', iconSize: [40, 40], iconAnchor: [20, 20] });
}

function pendingIcon(): L.DivIcon {
  const html = `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(45deg);background:#0EA5E9;border:3px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,.4)"></div>`;
  return L.divIcon({ html, className: 'bw-divicon', iconSize: [22, 22], iconAnchor: [11, 22] });
}

function stopIcon(n: number, alerted: boolean): L.DivIcon {
  const bg = alerted ? '#F59E0B' : '#7C3AED';
  const html = `<div style="width:26px;height:26px;border-radius:9px;background:${bg};border:2.5px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12.5px;font-weight:800;line-height:1">${n}</div>`;
  return L.divIcon({ html, className: 'bw-divicon', iconSize: [26, 26], iconAnchor: [13, 13] });
}

function searchIcon(): L.DivIcon {
  // Indigo teardrop pin — distinct from the blue "you"/pending pins.
  const html = `<div style="position:relative;width:24px;height:24px">
      <div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(45deg);background:#6366F1;border:3px solid #fff;box-shadow:0 4px 12px rgba(79,70,229,.45)"></div>
      <div style="position:absolute;left:8px;top:8px;width:8px;height:8px;border-radius:50%;background:#fff"></div>
    </div>`;
  return L.divIcon({ html, className: 'bw-divicon', iconSize: [24, 24], iconAnchor: [12, 24] });
}

/** Imperatively flies the map to `focus` whenever its `key` changes. */
const FlyTo: React.FC<{ focus: { lat: number; lng: number; key: number } | null }> = ({ focus }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  return null;
};

const ClickCatcher: React.FC<{ onMapClick: (latlng: LatLng) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const FloodMap: React.FC<FloodMapProps> = ({
  userLoc,
  userAccuracyM,
  reports,
  centers,
  roadSegments,
  possibleClosures = [],
  showRoads,
  showShelters,
  projectedRiseCm,
  monitorRadiusKm,
  selectedReportId,
  selEvacId,
  reportMode,
  pending,
  focus,
  searchMark,
  onMapClick,
  onSelectReport,
  onSelectEvac,
  rescues,
  selectedRescueId,
  onSelectRescue,
  tripStops,
  affectedStopIds,
  selectedStopId,
  onSelectStop,
  floodProneAreas = [],
  showFloodProne = true,
}) => {
  return (
    <MapContainer
      center={[userLoc.lat, userLoc.lng]}
      zoom={13}
      scrollWheelZoom
      className={reportMode ? 'bw-report' : undefined}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickCatcher onMapClick={onMapClick} />
      <FlyTo focus={focus} />

      {/* Monitoring boundary (citizen view only — the response console passes 0 to hide it) */}
      {monitorRadiusKm > 0 && (
        <Circle
          center={[userLoc.lat, userLoc.lng]}
          radius={monitorRadiusKm * 1000}
          pathOptions={{ color: '#0EA5E9', weight: 2, dashArray: '6 8', fillColor: '#0EA5E9', fillOpacity: 0.04 }}
        />
      )}

      {/* Inferred possible closures — roads inside each report's flooded ring, graded by estimated
          depth. Dashed + translucent so they read as inferred, distinct from the reported roads below. */}
      {showRoads &&
        possibleClosures.map((c) => {
          const rm = ROAD_META[c.status];
          const positions = c.path.map((p) => [p.lat, p.lng] as [number, number]);
          if (positions.length < 2) return null;
          return (
            <Polyline key={`closure-${c.roadId}`} positions={positions} pathOptions={{ color: rm.color, weight: 3, opacity: 0.55, dashArray: '4 7' }}>
              <Tooltip direction="top" sticky opacity={1}>
                <span style={{ fontWeight: 700 }}>{c.name}</span> · possible closure · {rm.label} · ~{Math.round(c.estDepthCm)} cm
              </Tooltip>
            </Polyline>
          );
        })}

      {/* Reported road segments (the road each report sits on). White casing for legibility, colored
          by passability — matches RoadLegend. */}
      {showRoads &&
        roadSegments.map((seg) => {
          const rm = ROAD_META[seg.status];
          const positions = seg.path.map((p) => [p.lat, p.lng] as [number, number]);
          if (positions.length < 2) return null;
          return (
            <React.Fragment key={`road-${seg.id}`}>
              <Polyline positions={positions} pathOptions={{ color: '#fff', weight: 8, opacity: 0.9 }} />
              <Polyline positions={positions} pathOptions={{ color: rm.color, weight: 5 }}>
                <Tooltip direction="top" sticky opacity={1}>
                  <span style={{ fontWeight: 700 }}>{seg.name ?? 'Road'}</span> · {rm.label}
                  {seg.reportsCount > 0 ? ` · ${seg.reportsCount} report${seg.reportsCount > 1 ? 's' : ''}` : ''}
                </Tooltip>
              </Polyline>
            </React.Fragment>
          );
        })}

      {/* Admin-pinned flood-prone areas — persistent advisory pins, drawn below the live report
          layers so an active report never reads as "under" a standing advisory. Dashed + low
          fill so they read as "watch this place" rather than "water is here now" (that's a report). */}
      {showFloodProne &&
        floodProneAreas.map((a) => {
          const color = (LEVEL_STYLE[a.level] ?? LEVEL_STYLE.orange).chip;
          return (
            <Circle
              key={`zone-${a.id}`}
              center={[a.latitude, a.longitude]}
              radius={a.radiusM}
              pathOptions={{ color, weight: 2, dashArray: '6 5', fill: true, fillColor: color, fillOpacity: 0.08 }}
            >
              <Tooltip direction="top" sticky opacity={1}>
                <span style={{ fontWeight: 700 }}>⚠ {a.name}</span> · {a.district}
              </Tooltip>
            </Circle>
          );
        })}

      {/* Flood reports. Affected area uses the planar inundation model (radius ≈ depth ÷ ground
          slope): a solid ring at the radius implied by the CURRENT depth (filled with the
          severity-category color at 20% opacity), and — when projecting a water rise — a wider
          dashed ring at the radius the flood would reach at depth + projectedRiseCm. */}
      {reports.map((r) => {
        const sel = r.id === selectedReportId;
        const projectedKm = projectedRiseCm > 0 ? affectedRadiusKm(r.depthCm + projectedRiseCm) : null;
        return (
          <React.Fragment key={r.id}>
            {/* Predicted widening if water keeps rising (outer dashed ring) */}
            {projectedKm != null && projectedKm > r.affectedKm && (
              <Circle
                center={[r.latitude, r.longitude]}
                radius={projectedKm * 1000}
                pathOptions={{ color: '#9333EA', weight: 2.25, dashArray: '2 6', fill: false }}
                eventHandlers={{ click: () => onSelectReport(r.id) }}
              />
            )}
            {/* Current affected area: filled with the severity-category color at 20% opacity, matching outline. */}
            <Circle
              center={[r.latitude, r.longitude]}
              radius={r.affectedKm * 1000}
              pathOptions={{ color: r.sev.color, weight: sel ? 2.5 : 1.5, fill: true, fillColor: r.sev.color, fillOpacity: 0.2 }}
              eventHandlers={{ click: () => onSelectReport(r.id) }}
            />
            {/* Center marker: ring encodes flood SEVERITY; inner dot encodes ROAD passability. */}
            <CircleMarker
              center={[r.latitude, r.longitude]}
              radius={sel ? 9 : 8}
              pathOptions={{ color: r.sev.color, weight: 3, fillColor: ROAD_META[r.road].color, fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelectReport(r.id) }}
            />
          </React.Fragment>
        );
      })}

      {/* Evacuation centers */}
      {showShelters &&
        centers.map((c) => (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={shelterIcon()}
            eventHandlers={{ click: () => onSelectEvac(c.id) }}
          >
            {/* status dot via a tiny circle marker overlay */}
          </Marker>
        ))}

      {/* Selected evac emphasis ring */}
      {showShelters &&
        centers
          .filter((c) => c.id === selEvacId)
          .map((c) => (
            <CircleMarker
              key={`sel-${c.id}`}
              center={[c.latitude, c.longitude]}
              radius={18}
              pathOptions={{ color: '#0E7490', weight: 3, fill: false }}
            />
          ))}

      {/* Rescue requests (response console). Status-colored pins; selected gets an outer ring. */}
      {rescues?.map((r) => {
        const meta = RESCUE_STATUS_META[r.status] ?? RESCUE_STATUS_META.pending;
        const sel = r.id === selectedRescueId;
        return (
          <React.Fragment key={`rescue-${r.id}`}>
            {sel && (
              <CircleMarker
                center={[r.latitude, r.longitude]}
                radius={16}
                pathOptions={{ color: meta.color, weight: 2, fill: false }}
              />
            )}
            <CircleMarker
              center={[r.latitude, r.longitude]}
              radius={sel ? 10 : 8}
              pathOptions={{ color: '#fff', weight: 2.5, fillColor: meta.color, fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelectRescue?.(r.id) }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                <span style={{ fontWeight: 700 }}>{meta.label}</span> · {r.place}
                {r.waitMin > 0 ? ` · waiting ${formatDuration(r.waitMin)}` : ''}
              </Tooltip>
            </CircleMarker>
          </React.Fragment>
        );
      })}

      {/* Trip: dashed order line → per-stop rings → numbered pins. Painted after rescues and before
          the search/pending/You markers so those stay on top exactly as they do today. */}
      {tripStops && tripStops.length > 1 && (
        <Polyline
          positions={tripStops.map((s) => [s.lat, s.lng] as [number, number])}
          pathOptions={{ color: '#7C3AED', weight: 3, opacity: 0.45, dashArray: '2 9' }}
        />
      )}
      {tripStops?.map((s, i) => {
        const alerted = affectedStopIds?.includes(s.id) ?? false;
        const c = alerted ? '#F59E0B' : '#7C3AED';
        return (
          <React.Fragment key={`stop-${s.id}`}>
            <Circle
              center={[s.lat, s.lng]}
              radius={s.radiusKm * 1000}
              pathOptions={{ color: c, weight: s.id === selectedStopId ? 2.5 : 1.75, dashArray: '3 7', fillColor: c, fillOpacity: 0.05 }}
              eventHandlers={{ click: () => onSelectStop?.(s.id) }}
            />
            <Marker position={[s.lat, s.lng]} icon={stopIcon(i + 1, alerted)} eventHandlers={{ click: () => onSelectStop?.(s.id) }}>
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                <span style={{ fontWeight: 700 }}>{i + 1}. {s.label}</span>{alerted ? ' · ⚠' : ''}
              </Tooltip>
            </Marker>
          </React.Fragment>
        );
      })}

      {/* Searched location */}
      {searchMark && (
        <Marker position={[searchMark.lat, searchMark.lng]} icon={searchIcon()}>
          <Tooltip direction="top" offset={[0, -22]} opacity={1}>{searchMark.label}</Tooltip>
        </Marker>
      )}

      {/* Pending report pin */}
      {pending && <Marker position={[pending.lat, pending.lng]} icon={pendingIcon()} />}

      {/* GPS uncertainty ring — sized to the fix's accuracy so users can see how precise it is
          (and watch it shrink as the fix converges). Hidden once the fix is already tight. */}
      {userAccuracyM != null && userAccuracyM > 15 && (
        <Circle
          center={[userLoc.lat, userLoc.lng]}
          radius={userAccuracyM}
          pathOptions={{ color: '#0EA5E9', weight: 1, opacity: 0.35, fillColor: '#0EA5E9', fillOpacity: 0.08 }}
        />
      )}

      {/* You */}
      <Marker position={[userLoc.lat, userLoc.lng]} icon={youIcon()} />
    </MapContainer>
  );
};

export default FloodMap;
