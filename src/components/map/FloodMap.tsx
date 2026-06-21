import React from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { EvacuationCenter, LatLng, RoadSegment } from '../../types';
import { ROAD_META } from '../../utils/floodMeta';
import { type EnrichedReport } from '../../utils/viewModel';

export interface MapFocus extends LatLng {
  /** Bumped on every search so re-selecting the same place still re-flies the map. */
  key: number;
}

export interface SearchMark extends LatLng {
  label: string;
}

interface FloodMapProps {
  userLoc: LatLng;
  reports: EnrichedReport[];
  centers: EvacuationCenter[];
  roadSegments: RoadSegment[];
  showRoads: boolean;
  showShelters: boolean;
  reportRadiusKm: number;
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
  reports,
  centers,
  roadSegments,
  showRoads,
  showShelters,
  reportRadiusKm,
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

      {/* Monitoring boundary */}
      <Circle
        center={[userLoc.lat, userLoc.lng]}
        radius={monitorRadiusKm * 1000}
        pathOptions={{ color: '#0EA5E9', weight: 2, dashArray: '6 8', fillColor: '#0EA5E9', fillOpacity: 0.04 }}
      />

      {/* Flooded road segments (map-matched by baha-api). White casing for legibility, colored
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

      {/* Flood reports */}
      {reports.map((r) => {
        const sel = r.id === selectedReportId;
        return (
          <React.Fragment key={r.id}>
            <Circle
              center={[r.latitude, r.longitude]}
              radius={reportRadiusKm * 1000}
              pathOptions={{
                color: r.sev.color,
                weight: sel ? 3 : 2,
                dashArray: sel ? undefined : '5 7',
                fillColor: r.sev.color,
                fillOpacity: sel ? 0.22 : 0.13,
              }}
              eventHandlers={{ click: () => onSelectReport(r.id) }}
            />
            {/* Outer ring encodes flood SEVERITY; inner dot encodes ROAD passability. */}
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

      {/* Searched location */}
      {searchMark && (
        <Marker position={[searchMark.lat, searchMark.lng]} icon={searchIcon()}>
          <Tooltip direction="top" offset={[0, -22]} opacity={1}>{searchMark.label}</Tooltip>
        </Marker>
      )}

      {/* Pending report pin */}
      {pending && <Marker position={[pending.lat, pending.lng]} icon={pendingIcon()} />}

      {/* You */}
      <Marker position={[userLoc.lat, userLoc.lng]} icon={youIcon()} />
    </MapContainer>
  );
};

export default FloodMap;
