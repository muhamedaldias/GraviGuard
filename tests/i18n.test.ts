import { describe, it, expect } from 'vitest';
import { assertKeyParity, flattenKeys, en as enDict, ar as arDict } from '../src/i18n';
import { CTRL_ALARM_KEYS } from '../src/components/Badges';

/** Look up a dotted key in a nested catalogue. */
function lookup(dict: Record<string, unknown>, path: string): unknown {
  let cur: unknown = dict;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

/** Round-1 (issue #7) keys: hardcoded-English islands moved into the catalogue. */
const ROUND1_KEYS = [
  'applicability.caseHeader',
  'applicability.outOfScope',
  ...[
    'variableSuction', 'strainerFouling', 'lowFlowRecirc', 'airIngestion', 'nearBoiling',
    'roHpp', 'reciprocating', 'fastPhenomena', 'thermalDeaerator',
  ].flatMap((id) => [`applicability.cases.${id}.case`, `applicability.cases.${id}.reason`]),
  ...[
    'waterHammer', 'cavitation', 'airIngestion', 'recirculation', 'roRampLimit',
    'valveStroke', 'vfdRamp', 'temperatureDrift', 'tideFouling',
  ].map((id) => `applicability.scale.${id}`),
  'methodology.name',
  'methodology.syntheticBody',
  'methodology.unverifiedItems.marginFactors',
  'methodology.unverifiedItems.roRamp',
  'methodology.unverifiedItems.patent',
  'methodology.limitItems.hydraulics',
  'methodology.limitItems.damageIndex',
  'methodology.limitItems.vibration',
  'methodology.limitItems.noRealData',
  'methodology.referenceItems.hi961',
  'methodology.referenceItems.hi963',
  'methodology.referenceItems.hi98',
  'methodology.referenceItems.hi66',
  'methodology.referenceItems.roVendors',
  ...[
    'surfacePressure', 'vapourPressure', 'density', 'gravity', 'staticLift', 'suctionLoss',
    'lossCoefficients', 'velocity', 'temperature', 'npsha', 'npsh3Drop', 'speed',
    'flowPerEye', 'requiredNpsh', 'waveSpeed', 'pipeLength', 'strokeTime', 'usableVolume',
    'suppliedFlow',
  ].map((id) => `methodology.vars.${id}`),
  'sim.cvLeak',
  'sensors.vs',
  'sensors.bits',
  'transients.roSummary',
  'alarm.reserve', 'alarm.r-low', 'alarm.r-watch', 'alarm.sensor', 'alarm.valve',
  'alarm.recirc', 'alarm.air', 'alarm.checkvalve',
  'alarm.ctrl-tank', 'alarm.ctrl-valve', 'alarm.ctrl-sensor', 'alarm.ctrl-cycles',
  'chart.speedPct', 'chart.tank', 'chart.valve', 'chart.vib', 'chart.damage', 'chart.ghost',
];

/** Stable engine alarm ids (src/sim/engine.ts updateAlarms) — must stay translatable. */
const ENGINE_ALARM_IDS = ['reserve', 'r-low', 'r-watch', 'sensor', 'valve', 'recirc', 'air', 'checkvalve'];

/** The exact raw controller alarm strings (src/sim/controller.ts) the UI must map. */
const CONTROLLER_ALARM_MESSAGES = [
  'Tank at reserve — injection blocked, VFD fallback',
  'Valve fault detected — GraviGuard unavailable',
  'Sensor fault detected — fail-safe active',
  'Injection cycle limit exceeded (3/hour)',
];

/** Latin tokens allowed inside Arabic values: identifiers, brands, standards, units. */
const AR_LATIN_ALLOWLIST = new Set([
  'GraviGuard', 'NPSHa', 'NPSH3', 'NPSH', 'NPIPa', 'RO', 'HPP', 'HI', 'ANSI',
  'DuPont', 'Hydranautics', 'Toray', 'VFD', 'LPG', 'SWA', 'BEP', 'bar', 'VERIFY',
]);

describe('i18n catalogue (Section 8)', () => {
  it('English and Arabic have identical key sets', () => {
    const { missingInAr, missingInEn, empty } = assertKeyParity();
    expect(missingInAr, `missing in ar: ${missingInAr.join(', ')}`).toEqual([]);
    expect(missingInEn, `missing in en: ${missingInEn.join(', ')}`).toEqual([]);
    expect(empty, `empty values: ${empty.join(', ')}`).toEqual([]);
  });

  it('has a substantial catalogue in both languages', () => {
    const enKeys = flattenKeys(enDict as Record<string, unknown>);
    const arKeys = flattenKeys(arDict as Record<string, unknown>);
    expect(enKeys.length).toBeGreaterThan(150);
    expect(arKeys.length).toBeGreaterThan(150);
  });

  it('contains the required glossary terms in Arabic', () => {
    const ar = arDict as Record<string, unknown>;
    const adv = (ar.advisor as Record<string, string>).recirculation;
    expect(adv).toContain('إعادة التدوير');
    const sim = (ar.sim as Record<string, string>).npsha;
    expect(sim).toContain('ضغط الشفط الصافي الموجب');
  });
});

describe('i18n round-1 completeness (issue #7)', () => {
  it('has every round-1 key in both catalogues', () => {
    const en = enDict as Record<string, unknown>;
    const ar = arDict as Record<string, unknown>;
    const missing: string[] = [];
    for (const key of ROUND1_KEYS) {
      const ev = lookup(en, key);
      const av = lookup(ar, key);
      if (typeof ev !== 'string' || ev.trim() === '') missing.push(`en:${key}`);
      if (typeof av !== 'string' || av.trim() === '') missing.push(`ar:${key}`);
    }
    expect(missing, `missing/empty round-1 keys: ${missing.join(', ')}`).toEqual([]);
  });

  it('Arabic round-1 values contain no English words (identifiers/units excepted)', () => {
    const ar = arDict as Record<string, unknown>;
    const offenders: string[] = [];
    for (const key of ROUND1_KEYS) {
      const v = lookup(ar, key);
      if (typeof v !== 'string') continue; // covered by the existence test
      // Interpolation placeholders render as numbers, not words — strip them.
      const rendered = v.replace(/\{\{[^}]+\}\}/g, '');
      const latinRuns = rendered.match(/[A-Za-z]{2,}/g) ?? [];
      for (const run of latinRuns) {
        if (!AR_LATIN_ALLOWLIST.has(run)) offenders.push(`${key}: "${run}"`);
      }
    }
    expect(offenders, `English words in AR values: ${offenders.join('; ')}`).toEqual([]);
  });

  it('maps every controller alarm message to a key present in both catalogues', () => {
    const en = enDict as Record<string, unknown>;
    const ar = arDict as Record<string, unknown>;
    // The map must cover exactly the engine's current controller strings (no drift).
    expect(Object.keys(CTRL_ALARM_KEYS).sort()).toEqual([...CONTROLLER_ALARM_MESSAGES].sort());
    for (const [message, key] of Object.entries(CTRL_ALARM_KEYS)) {
      expect(typeof lookup(en, key), `en missing ${key} (for "${message}")`).toBe('string');
      expect(typeof lookup(ar, key), `ar missing ${key} (for "${message}")`).toBe('string');
    }
  });

  it('has catalogue entries for every stable engine alarm id', () => {
    const en = enDict as Record<string, unknown>;
    const ar = arDict as Record<string, unknown>;
    for (const id of ENGINE_ALARM_IDS) {
      expect(typeof lookup(en, `alarm.${id}`), `en missing alarm.${id}`).toBe('string');
      expect(typeof lookup(ar, `alarm.${id}`), `ar missing alarm.${id}`).toBe('string');
    }
  });

  it('RO limit badge label carries the literal [VERIFY] marker in both languages', () => {
    const en = enDict as Record<string, unknown>;
    const ar = arDict as Record<string, unknown>;
    expect(lookup(en, 'transients.roLimit')).toContain('[VERIFY]');
    expect(lookup(ar, 'transients.roLimit')).toContain('[VERIFY]');
  });

  it('grew the catalogue to at least 398 keys per language', () => {
    expect(flattenKeys(enDict as Record<string, unknown>).length).toBeGreaterThanOrEqual(398);
    expect(flattenKeys(arDict as Record<string, unknown>).length).toBeGreaterThanOrEqual(398);
  });
});