import { describe, it, expect } from 'vitest';
import { runScenario, type ScenarioRun } from '../src/sim/scenario';
import type { Scenario } from '../src/sim/types';

import s0 from '../public/scenarios/S0.json';
import s1 from '../public/scenarios/S1.json';
import s2 from '../public/scenarios/S2.json';
import s3 from '../public/scenarios/S3.json';
import s4 from '../public/scenarios/S4.json';
import s5 from '../public/scenarios/S5.json';
import s6 from '../public/scenarios/S6.json';
import s7 from '../public/scenarios/S7.json';
import s8 from '../public/scenarios/S8.json';
import s9a from '../public/scenarios/S9a.json';
import s9b from '../public/scenarios/S9b.json';
import s9c from '../public/scenarios/S9c.json';
import s9d from '../public/scenarios/S9d.json';
import s10a from '../public/scenarios/S10a.json';
import s10b from '../public/scenarios/S10b.json';
import s10c from '../public/scenarios/S10c.json';
import s12 from '../public/scenarios/S12.json';
import s13 from '../public/scenarios/S13.json';

const scenarios = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8,
  s9a, s9b, s9c, s9d,
  s10a, s10b, s10c,
  s12, s13,
] as unknown as Scenario[];

describe('scenario pack (Section 5)', () => {
  const results: { id: string; mode: string; passed: boolean; failed: string[]; kpis: string }[] = [];

  for (const sc of scenarios) {
    it(`${sc.id} — ${sc.name}`, () => {
      const runs: ScenarioRun[] = runScenario(sc, { recordInterval: 1.0 });
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) {
        const failed = run.assertions.filter((a) => !a.passed).map((a) => `${a.id}: ${a.expected} (actual ${a.actual})`);
        results.push({
          id: sc.id,
          mode: run.mode,
          passed: run.passed,
          failed,
          kpis: `minR=${run.kpis.minR.toFixed(2)} tankMin=${run.kpis.tankMin.toFixed(2)} trans=${run.kpis.transitions} cycles=${run.kpis.injectionCycles} false=${run.kpis.falseInjections}`,
        });
        expect(run.passed, `${sc.id} [${run.mode}] failed:\n${failed.join('\n')}`).toBe(true);
      }
    });
  }

  it('writes a calibration summary', () => {
    // eslint-disable-next-line no-console
    console.log(
      '\nScenario calibration:\n' +
        results.map((r) => `${r.id} [${r.mode}] ${r.passed ? 'PASS' : 'FAIL'} ${r.kpis}`).join('\n'),
    );
    expect(results.length).toBeGreaterThan(0);
  });
});
