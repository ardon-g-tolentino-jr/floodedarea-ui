import React from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

function pinIcon(): L.DivIcon {
  const html = `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(45deg);background:#4338CA;border:3px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,.4)"></div>`;
  return L.divIcon({ html, className: 'bw-divicon', iconSize: [22, 22], iconAnchor: [11, 22] });
}

const ClickToMove: React.FC<{ onPick: (lat: number, lng: number) => void }> = ({ onPick }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/** Pans the map to `lat`/`lng` whenever they change from outside (e.g. a new search/intersection
 *  pick) — skips the very first render, since MapContainer already centers there on mount. */
const Recenter: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.panTo([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

interface MapPickFieldProps {
  lat: number;
  lng: number;
  /** Fired on a map click or a marker drag-end, with the new coordinates. */
  onPick: (lat: number, lng: number) => void;
  /** false renders no marker (nothing has been picked yet) and overlays a "tap to drop the pin"
   *  hint instead — used for the admin incident modal's map tab before a first pick. Defaults to
   *  true, the original "fine-tune an already-picked point" behavior every other caller relies on. */
  pinned?: boolean;
}

/**
 * Compact map (~220px) for fine-tuning an already-picked location: click anywhere to move the
 * pin, or drag it directly. Same OSM tile source as FloodMap.tsx. Used by the admin "Report
 * incident" modal's Intersection and Pick-on-map tabs so a resolved point can be nudged onto the
 * exact spot.
 */
const MapPickField: React.FC<MapPickFieldProps> = ({ lat, lng, onPick, pinned = true }) => {
  const icon = React.useMemo(() => pinIcon(), []);
  return (
    <div style={{ position: 'relative', height: 220, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bw-line)' }}>
      <MapContainer center={[lat, lng]} zoom={17} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToMove onPick={onPick} />
        <Recenter lat={lat} lng={lng} />
        {pinned && (
          <Marker
            position={[lat, lng]}
            icon={icon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onPick(p.lat, p.lng);
              },
            }}
          />
        )}
      </MapContainer>
      {!pinned && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 900, background: 'rgba(15,23,42,.72)', color: '#fff', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(15,23,42,.3)' }}>
          Tap the map to drop the pin
        </div>
      )}
    </div>
  );
};

export default MapPickField;
