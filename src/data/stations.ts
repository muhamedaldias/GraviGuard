/**
 * Demo network topology for the stations map (Session B) and the landing rail.
 * Places are real Amman/Zarqa water-system locations; every station maps to a
 * bundled scenario so a marker click can deep-link into the running simulator.
 */
export type StationKind = 'source' | 'lift' | 'reservoir' | 'network';

export interface Station {
  id: string;
  nameAr: string;
  nameEn: string;
  kind: StationKind;
  lat: number;
  lng: number;
  scenarioId: string;
  /** Nominal display set-points (labels only — live values come from the engine). */
  nominal: { flowM3s: number; headM: number; levelM: number };
}

export const STATIONS: readonly Station[] = [
  {
    id: 'st-zai',
    nameAr: 'محطة الزاء',
    nameEn: 'Zai treatment plant',
    kind: 'source',
    lat: 31.872,
    lng: 35.594,
    scenarioId: 'S0',
    nominal: { flowM3s: 1.6, headM: 0, levelM: 4.2 },
  },
  {
    id: 'st-suweileh',
    nameAr: 'خزان صويلح',
    nameEn: 'Suweileh reservoir',
    kind: 'reservoir',
    lat: 32.022,
    lng: 35.865,
    scenarioId: 'S1',
    nominal: { flowM3s: 0.42, headM: 0, levelM: 6.8 },
  },
  {
    id: 'st-zarqa',
    nameAr: 'محطة الزرقاء الرئيسية',
    nameEn: 'Zarqa main lift',
    kind: 'lift',
    lat: 32.066,
    lng: 36.092,
    scenarioId: 'S2',
    nominal: { flowM3s: 0.31, headM: 64, levelM: 2.9 },
  },
  {
    id: 'st-russeifa',
    nameAr: 'محطة الرصيفة',
    nameEn: 'Russeifa booster',
    kind: 'lift',
    lat: 32.014,
    lng: 36.044,
    scenarioId: 'S3',
    nominal: { flowM3s: 0.22, headM: 48, levelM: 3.4 },
  },
  {
    id: 'st-hashemi',
    nameAr: 'خزان الحسينية',
    nameEn: 'Al-Hashemi reservoir',
    kind: 'reservoir',
    lat: 31.998,
    lng: 36.231,
    scenarioId: 'S5',
    nominal: { flowM3s: 0.18, headM: 0, levelM: 5.1 },
  },
  {
    id: 'st-dahiat',
    nameAr: 'محطة الضاحية',
    nameEn: 'Dahiat lift',
    kind: 'lift',
    lat: 31.873,
    lng: 35.921,
    scenarioId: 'S6',
    nominal: { flowM3s: 0.27, headM: 52, levelM: 3.0 },
  },
  {
    id: 'st-salt',
    nameAr: 'خزان السلط',
    nameEn: 'Salt balancing tank',
    kind: 'network',
    lat: 32.033,
    lng: 35.731,
    scenarioId: 'S12',
    nominal: { flowM3s: 0.15, headM: 0, levelM: 4.6 },
  },
] as const;

/** Map initial view: Amman–Zarqa corridor. */
export const NETWORK_VIEW = { center: [31.94, 35.95] as [number, number], zoom: 10.2 };

/** Jordan bounding box used by the stations integrity test. */
export const JORDAN_BBOX = { minLat: 29.2, maxLat: 32.7, minLng: 34.9, maxLng: 39.3 };
