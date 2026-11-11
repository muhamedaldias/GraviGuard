// Global UI store (zustand). Holds presentation state and the latest sim snapshot.
import { create } from 'zustand';
import type { SimState, PlantParams, Scenario, HistorySample } from '../sim/types';
import { CAVITY_STATES, CTRL_STATES } from '../sim/types';
import { defaultPlant } from '../sim/defaults';
import type { UnitSystem, DigitStyle } from '../sim/units';
import type { LangCode } from '../i18n';

const MAX_HISTORY = 3600;

function sampleFromState(s: SimState): HistorySample {
  return {
    t: s.t,
    R: s.R,
    NPSHa: s.NPSHa,
    NPSH3: s.NPSH3,
    Q: s.Q,
    H: s.H_pump,
    P_suction: s.sensors.P_suction_gauge,
    P_discharge: s.sensors.P_discharge,
    T: s.sensors.T,
    Pv: 0,
    level: s.sensors.level,
    tankH: s.tankH,
    theta: s.theta,
    CI: s.CI,
    damage: s.damage,
    vibration: s.sensors.vibrationRMS,
    n: s.n,
    headDrop: s.headDrop,
    state: CAVITY_STATES.indexOf(s.cavState),
    ctrl: CTRL_STATES.indexOf(s.controller.name),
    advisor: s.advisor.id,
    surge: s.surge.surgePeak,
  };
}

export type PageId =
  | 'landing'
  | 'simulator'
  | 'curves'
  | 'twin'
  | 'pump'
  | 'controller'
  | 'sensors'
  | 'transients'
  | 'sizing'
  | 'applicability'
  | 'montecarlo'
  | 'scenarios'
  | 'reports'
  | 'methodology'
  | 'tour'
  | 'settings';

interface AppState {
  lang: LangCode;
  theme: 'dark' | 'light';
  units: UnitSystem;
  digits: DigitStyle;
  quality: 'high' | 'medium' | 'low';
  page: PageId;
  snapshot: SimState | null;
  history: HistorySample[];
  playing: boolean;
  speed: number;
  seed: number;
  scenario: Scenario | null;
  params: PlantParams;
  historyVersion: number;

  setLang: (l: LangCode) => void;
  setTheme: (t: 'dark' | 'light') => void;
  setUnits: (u: UnitSystem) => void;
  setDigits: (d: DigitStyle) => void;
  setQuality: (q: 'high' | 'medium' | 'low') => void;
  setPage: (p: PageId) => void;
  setSnapshot: (s: SimState) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setSeed: (s: number) => void;
  setScenario: (sc: Scenario | null) => void;
  setParams: (mutate: (p: PlantParams) => void) => void;
}

export const useApp = create<AppState>((set) => ({
  lang: 'en',
  theme: 'dark',
  units: 'SI',
  digits: 'western',
  quality: 'high',
  page: 'landing',
  snapshot: null,
  history: [],
  playing: false,
  speed: 1,
  seed: 12345,
  scenario: null,
  params: defaultPlant(),
  historyVersion: 0,

  setLang: (lang) => set({ lang }),
  setTheme: (theme) => set({ theme }),
  setUnits: (units) => set({ units }),
  setDigits: (digits) => set({ digits }),
  setQuality: (quality) => set({ quality }),
  setPage: (page) => set({ page }),
  setSnapshot: (snapshot) =>
    set((s) => {
      const shouldAppend = snapshot.t - (s.history[s.history.length - 1]?.t ?? -1) >= 0.1;
      const history = shouldAppend
        ? [...s.history, sampleFromState(snapshot)].slice(-MAX_HISTORY)
        : s.history;
      return { snapshot, history, historyVersion: s.historyVersion + 1 };
    }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setSeed: (seed) => set({ seed }),
  setScenario: (scenario) => set({ scenario }),
  setParams: (mutate) =>
    set((s) => {
      const params = structuredClone(s.params);
      mutate(params);
      return { params };
    }),
  }));

  // Debug/testing handle (harmless in production).
  if (typeof window !== 'undefined') {
  (window as unknown as { __gurve: typeof useApp }).__gurve = useApp;
  }
