// Philippine administrative geography helpers for the admin "scoped warn" flow — cascading
// island group → province → city dropdowns over the flood-prone zone list. Pure, no component
// imports: every `district` in the data is stored as exactly "City/Municipality, Province"
// (see FloodProneArea.district), so parsing it is all this module does.

export type IslandGroup = 'Luzon' | 'Visayas' | 'Mindanao';

/** The city/municipality half of a "City, Province" district label. */
export const cityOf = (district: string): string => district.split(',')[0].trim();

/** The province half of a "City, Province" district label (last comma-separated segment, so a
 *  city name that itself contains a comma still resolves to the trailing province). */
export const provinceOf = (district: string): string => district.split(',').pop()!.trim();

/**
 * Province → island group, per the standard PSA administrative island grouping. Note MIMAROPA
 * (Occidental/Oriental Mindoro, Marinduque, Romblon, Palawan) and the Bicol Region (Camarines
 * Norte/Sur, Albay, Sorsogon, Catanduanes, Masbate) are grouped under Luzon, not treated as a
 * separate archipelago — that's the standard convention this table follows.
 */
const PROVINCE_ISLAND: Record<string, IslandGroup> = {
  // Luzon (36)
  'Abra': 'Luzon',
  'Albay': 'Luzon',
  'Apayao': 'Luzon',
  'Bataan': 'Luzon',
  'Batangas': 'Luzon',
  'Benguet': 'Luzon',
  'Bulacan': 'Luzon',
  'Cagayan': 'Luzon',
  'Camarines Norte': 'Luzon',
  'Camarines Sur': 'Luzon',
  'Catanduanes': 'Luzon',
  'Cavite': 'Luzon',
  'Ifugao': 'Luzon',
  'Ilocos Norte': 'Luzon',
  'Ilocos Sur': 'Luzon',
  'Isabela': 'Luzon',
  'Kalinga': 'Luzon',
  'La Union': 'Luzon',
  'Laguna': 'Luzon',
  'Marinduque': 'Luzon',
  'Masbate': 'Luzon',
  'Metro Manila': 'Luzon',
  'Mountain Province': 'Luzon',
  'Nueva Ecija': 'Luzon',
  'Nueva Vizcaya': 'Luzon',
  'Occidental Mindoro': 'Luzon',
  'Oriental Mindoro': 'Luzon',
  'Palawan': 'Luzon',
  'Pampanga': 'Luzon',
  'Pangasinan': 'Luzon',
  'Quezon': 'Luzon',
  'Quirino': 'Luzon',
  'Rizal': 'Luzon',
  'Sorsogon': 'Luzon',
  'Tarlac': 'Luzon',
  'Zambales': 'Luzon',

  // Visayas (15)
  'Aklan': 'Visayas',
  'Antique': 'Visayas',
  'Biliran': 'Visayas',
  'Bohol': 'Visayas',
  'Capiz': 'Visayas',
  'Cebu': 'Visayas',
  'Eastern Samar': 'Visayas',
  'Guimaras': 'Visayas',
  'Iloilo': 'Visayas',
  'Leyte': 'Visayas',
  'Negros Occidental': 'Visayas',
  'Negros Oriental': 'Visayas',
  'Northern Samar': 'Visayas',
  'Samar': 'Visayas',
  'Southern Leyte': 'Visayas',

  // Mindanao (22)
  'Agusan del Norte': 'Mindanao',
  'Agusan del Sur': 'Mindanao',
  'Bukidnon': 'Mindanao',
  'Cotabato': 'Mindanao',
  'Davao Occidental': 'Mindanao',
  'Davao Oriental': 'Mindanao',
  'Davao de Oro': 'Mindanao',
  'Davao del Norte': 'Mindanao',
  'Davao del Sur': 'Mindanao',
  'Lanao del Norte': 'Mindanao',
  'Lanao del Sur': 'Mindanao',
  'Maguindanao del Norte': 'Mindanao',
  'Maguindanao del Sur': 'Mindanao',
  'Misamis Occidental': 'Mindanao',
  'Misamis Oriental': 'Mindanao',
  'South Cotabato': 'Mindanao',
  'Sultan Kudarat': 'Mindanao',
  'Surigao del Norte': 'Mindanao',
  'Surigao del Sur': 'Mindanao',
  'Zamboanga Sibugay': 'Mindanao',
  'Zamboanga del Norte': 'Mindanao',
  'Zamboanga del Sur': 'Mindanao',
};

/**
 * Island group for a zone's district, or null when the province isn't in the table above. Reachable
 * by city/area scope but not island/province — deliberately, rather than guessing and mis-bucketing
 * a province into the wrong archipelago.
 */
export const islandOf = (district: string): IslandGroup | null => PROVINCE_ISLAND[provinceOf(district)] ?? null;

export const ISLAND_GROUPS: IslandGroup[] = ['Luzon', 'Visayas', 'Mindanao'];
