// Metro Manila street-level flood hotspots — the curated list the admin Quick report page ticks
// through during a habagat event, so a known corridor can be put on the map without re-pinning it
// by hand every time (that one-off flow is AdminReportIncidentModal).
//
// PROVENANCE — every row comes from the reporting on the 8–19 August 2026 habagat episode
// (MMDA road advisories, LGU/DRRMO bulletins and the national roundups that cite them). Ranked by
// `timesReported`: how many DISTINCT days the location was independently reported flooded inside
// that window. Locations reported on >= 3 distinct days are `tier: 1` — chronic; the rest are
// `tier: 2` — situational. Both flood; tier is about how reliably, not how badly.
//
// DEPTH — `maxDepthCm` is the DEEPEST water observed at that spot during that episode, converted
// from the inch figures and qualitative descriptors the advisories use:
//   gutter-deep 8in ≈ 20cm · above-gutter 9in ≈ 23cm · ~1ft ≈ 30cm · half-tire 13in ≈ 33cm
//   half-tire 18in ≈ 46cm · knee-deep 19in ≈ 48cm · tire-deep 26in ≈ 66cm · waist-deep 37in ≈ 94cm
//   chest-deep 45in ≈ 114cm · above-head 60in ≈ 152cm
// It is a HISTORICAL high-water mark used only to prefill the depth field — never a current
// reading, and never posted without the admin confirming it.
//
// COORDINATES — resolved once against OpenStreetMap (the same Nominatim service `api/geocode.ts`
// calls), then reverse-geocoded to confirm each pin lands on the named road in the named city.
// "A cor. B" rows sit on the computed crossing where OSM carries both streets; where it only
// carries one, the pin sits on the arterial at its closest approach to the cross street and the
// row gets a `pinNote`. Corridor rows (Taft, Roxas, EDSA) are pinned at the intersection the
// advisories cite most, not at the corridor's midpoint — a flood report is a point, not a line.
// Admins can nudge any pin from the Quick report page; nudges are saved per-device (utils/hotspotStore.ts).

/** One curated flood hotspot. Coordinates and history are fixed; depth is only ever a suggestion. */
export interface FloodHotspot {
  /** Stable slug — the key pin nudges and selections are stored under. Never reuse or renumber. */
  id: string;
  name: string;
  barangay: string | null;
  city: string;
  /** "City, Province", the app-wide district convention — see FloodProneArea.district and phGeo.ts. */
  district: string;
  lat: number;
  lng: number;
  /** 1 = reported on >= 3 distinct days in the Aug 2026 window (chronic); 2 = situational. */
  tier: 1 | 2;
  timesReported: number;
  /** Historical max depth (cm) for this spot. Prefill only — see the DEPTH note above. */
  maxDepthCm: number;
  /** Set when the pin is corridor-accurate rather than junction-exact; surfaced as a nudge hint. */
  pinNote?: string;
}

export const FLOOD_HOTSPOTS: FloodHotspot[] = [
  // ── Tier 1 — reported flooded on 3 or more distinct days ────────────────────────────────────
  { id: 'qc-araneta-maria-clara', name: 'G. Araneta Ave cor. Maria Clara St', barangay: 'Sto. Domingo (Matalahib)', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6306026, lng: 121.0111529, tier: 1, timesReported: 5, maxDepthCm: 94 },
  { id: 'qc-amoranto-banawe', name: 'NS Amoranto Sr. Ave cor. Banawe St', barangay: 'Sto. Domingo / Sienna', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6327076, lng: 121.0017254, tier: 1, timesReported: 4, maxDepthCm: 94 },
  { id: 'mal-gov-pascual-catmon', name: 'Gov. Pascual Ave cor. Catmon', barangay: 'Catmon', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6707443, lng: 120.9532568, tier: 1, timesReported: 4, maxDepthCm: 33 },
  { id: 'val-macarthur-dalandanan', name: 'MacArthur Highway, Dalandanan', barangay: 'Dalandanan', city: 'Valenzuela', district: 'Valenzuela, Metro Manila', lat: 14.7041124, lng: 120.9614783, tier: 1, timesReported: 4, maxDepthCm: 46 },
  { id: 'mnl-taft-pedro-gil', name: 'Taft Ave cor. Pedro Gil St', barangay: 'Ermita / Malate', city: 'Manila', district: 'Manila, Metro Manila', lat: 14.5760293, lng: 120.9883363, tier: 1, timesReported: 4, maxDepthCm: 30, pinNote: 'Taft floods along its whole Ermita–Malate stretch; pinned at Pedro Gil.' },
  { id: 'mnl-espana-lacson', name: 'España Blvd cor. Lacson Ave', barangay: 'Sampaloc', city: 'Manila', district: 'Manila, Metro Manila', lat: 14.6100994, lng: 120.9931603, tier: 1, timesReported: 3, maxDepthCm: 114, pinNote: 'On España; OSM lacks the full Lacson centreline, so check the pin before posting.' },
  { id: 'mnl-roxas-kalaw', name: 'Roxas Blvd cor. T.M. Kalaw Ave', barangay: 'Ermita', city: 'Manila', district: 'Manila, Metro Manila', lat: 14.5799230, lng: 120.9773342, tier: 1, timesReported: 3, maxDepthCm: 23, pinNote: 'On Roxas Blvd near Kalaw; the corridor also floods at Kalaw, EDSA and the Buendia flyover.' },
  { id: 'par-dr-a-santos-sucat', name: 'Dr. A. Santos Ave (Sucat)', barangay: 'San Dionisio', city: 'Parañaque', district: 'Parañaque, Metro Manila', lat: 14.4770664, lng: 120.9994371, tier: 1, timesReported: 3, maxDepthCm: 33 },
  { id: 'mal-mh-del-pilar', name: 'M.H. Del Pilar St, Maysilo', barangay: 'Maysilo / Santulan', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6788167, lng: 120.9617673, tier: 1, timesReported: 3, maxDepthCm: 48, pinNote: 'Corridor pin inside Maysilo — nudge it to the block that is actually flooded.' },
  { id: 'mal-don-basilio-bautista', name: 'Don Basilio Bautista Blvd', barangay: 'Hulong Duhat', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6796709, lng: 120.9416075, tier: 1, timesReported: 3, maxDepthCm: 48 },
  { id: 'qc-quezon-ave-d-tuazon', name: 'Quezon Ave cor. D. Tuazon St', barangay: 'Doña Josefa / Lourdes', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6192170, lng: 121.0034267, tier: 1, timesReported: 3, maxDepthCm: 66, pinNote: 'On Quezon Ave near D. Tuazon; impassable to light vehicles at its worst.' },
  { id: 'qc-a-bonifacio-sgt-rivera', name: 'A. Bonifacio Ave cor. Sgt. Rivera St', barangay: 'La Loma / Manresa', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6438077, lng: 120.9937841, tier: 1, timesReported: 3, maxDepthCm: 66 },
  { id: 'qc-e-rodriguez-araneta', name: 'E. Rodriguez Sr. Ave cor. G. Araneta Ave', barangay: 'Tatalon', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6188550, lng: 121.0147922, tier: 1, timesReported: 3, maxDepthCm: 48 },
  { id: 'qc-edsa-kamuning', name: 'EDSA cor. Kamuning Rd', barangay: 'Kamuning', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6307667, lng: 121.0458406, tier: 1, timesReported: 3, maxDepthCm: 20, pinNote: 'EDSA also ponds at North Ave, Bansalangin, Balintawak and the Aurora tunnel.' },

  // ── Tier 2 — reported on 1–2 days in the window. Situational, not less dangerous: the two
  // deepest readings of the whole episode (Damayan, Pasig) sit here. ─────────────────────────────
  { id: 'mal-c-arellano', name: 'C. Arellano St', barangay: 'Ibaba / San Agustin', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6648524, lng: 120.9485803, tier: 2, timesReported: 2, maxDepthCm: 33 },
  { id: 'qc-west-riverside-damayan', name: 'West Riverside Dr, Damayan', barangay: 'Damayan / Del Monte', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6413585, lng: 121.0122197, tier: 2, timesReported: 2, maxDepthCm: 152, pinNote: 'Riverside barangay — reached above head height on 17 Aug 2026. Life-threatening, not just impassable.' },
  { id: 'lp-marcos-alvarez-alabang-zapote', name: 'Marcos Alvarez Rd cor. Alabang–Zapote Rd', barangay: 'Talon', city: 'Las Piñas', district: 'Las Piñas, Metro Manila', lat: 14.4366335, lng: 121.0069061, tier: 2, timesReported: 2, maxDepthCm: 48 },
  { id: 'man-f-ortigas-boni', name: 'Boni Ave cor. F. Ortigas Jr. Ave', barangay: 'Plainview', city: 'Mandaluyong', district: 'Mandaluyong, Metro Manila', lat: 14.5764197, lng: 121.0386378, tier: 2, timesReported: 2, maxDepthCm: 20, pinNote: 'On Boni Ave inside Plainview — OSM has no F. Ortigas Jr. Ave here.' },
  { id: 'mal-potrero-university', name: 'University Ave, Potrero', barangay: 'Potrero', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6683484, lng: 120.9799666, tier: 2, timesReported: 2, maxDepthCm: 48 },
  { id: 'mal-san-agustin-rizal-magsaysay', name: 'Rizal Ave Ext, San Agustin', barangay: 'San Agustin', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6591692, lng: 120.9537387, tier: 2, timesReported: 2, maxDepthCm: 48 },
  { id: 'mal-tanong-central-market', name: 'Tañong Central Market', barangay: 'Tañong', city: 'Malabon', district: 'Malabon, Metro Manila', lat: 14.6542607, lng: 120.9536968, tier: 2, timesReported: 2, maxDepthCm: 33 },
  { id: 'par-ninoy-aquino-kabihasnan', name: 'Ninoy Aquino Ave, Kabihasnan', barangay: 'Kabihasnan', city: 'Parañaque', district: 'Parañaque, Metro Manila', lat: 14.4922329, lng: 120.9919362, tier: 2, timesReported: 2, maxDepthCm: 33 },
  { id: 'mnl-rizal-ave-bambang', name: 'Rizal Ave cor. Bambang St', barangay: 'Sta. Cruz', city: 'Manila', district: 'Manila, Metro Manila', lat: 14.6109918, lng: 120.9826912, tier: 2, timesReported: 1, maxDepthCm: 48 },
  { id: 'mnl-abad-santos-yuseco', name: 'Abad Santos Ave cor. Yuseco St', barangay: 'Tondo', city: 'Manila', district: 'Manila, Metro Manila', lat: 14.6196194, lng: 120.9776402, tier: 2, timesReported: 1, maxDepthCm: 48, pinNote: 'On Abad Santos in Gagalangin; OSM barely carries Yuseco, so check the pin.' },
  { id: 'mnl-blumentritt-piy-margal', name: 'Blumentritt Rd cor. Piy Margal St', barangay: 'Sta. Cruz / Sampaloc', city: 'Manila', district: 'Manila, Metro Manila', lat: 14.6187368, lng: 120.9982493, tier: 2, timesReported: 1, maxDepthCm: 48 },
  { id: 'mak-chino-roces-arnaiz', name: 'Chino Roces Ave cor. Arnaiz Ave', barangay: 'Pio del Pilar', city: 'Makati', district: 'Makati, Metro Manila', lat: 14.5487963, lng: 121.0141890, tier: 2, timesReported: 1, maxDepthCm: 20, pinNote: 'On Chino Roces; the corridor crosses into Taguig, counted once.' },
  { id: 'cal-c3-nlex-connector', name: 'C-3 Road cor. NLEX Connector', barangay: null, city: 'Caloocan', district: 'Caloocan, Metro Manila', lat: 14.6440373, lng: 120.9908975, tier: 2, timesReported: 1, maxDepthCm: 30 },
  { id: 'cal-manggahan-brgy-180', name: 'Manggahan St, Barangay 180', barangay: 'Barangay 180', city: 'Caloocan', district: 'Caloocan, Metro Manila', lat: 14.7632481, lng: 121.0807423, tier: 2, timesReported: 1, maxDepthCm: 66 },
  { id: 'mar-marcos-hwy-sm-underloop', name: 'Marcos Hwy, SM Marikina underloop', barangay: 'Calumpang', city: 'Marikina', district: 'Marikina, Metro Manila', lat: 14.6252848, lng: 121.0833696, tier: 2, timesReported: 1, maxDepthCm: 20 },
  { id: 'mak-edsa-pasong-tamo-tunnel', name: 'EDSA–Pasong Tamo (Arnaiz) Tunnel', barangay: 'Bangkal', city: 'Makati', district: 'Makati, Metro Manila', lat: 14.5412239, lng: 121.0180720, tier: 2, timesReported: 1, maxDepthCm: 20 },
  { id: 'pas-rosario-blvd', name: 'Rosario Blvd / Villa Eusebio', barangay: 'Rosario / San Miguel', city: 'Pasig', district: 'Pasig, Metro Manila', lat: 14.5904898, lng: 121.0882718, tier: 2, timesReported: 1, maxDepthCm: 91, pinNote: 'Barangay-level pin — Rosario Blvd itself is not mapped in OSM. Nudge before posting.' },
  { id: 'qc-mother-ignacia-timog', name: 'Mother Ignacia Ave cor. Timog Ave', barangay: 'South Triangle / Laging Handa', city: 'Quezon City', district: 'Quezon City, Metro Manila', lat: 14.6345736, lng: 121.0264270, tier: 2, timesReported: 1, maxDepthCm: 48, pinNote: 'On Mother Ignacia near the Timog end — check the pin before posting.' },
];
