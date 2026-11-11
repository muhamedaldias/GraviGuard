// Headless scenario runner CLI: runs every scenario and prints a pass/fail matrix.
// Usage: pnpm scenarios
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScenario, scenarioPassBadge } from '../src/sim/scenario';
import type { Scenario } from '../src/sim/types';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'scenarios');
const ids = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => f.replace('.json', ''))
  .sort();

let pass = 0;
let fail = 0;
for (const id of ids) {
  const sc = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as Scenario;
  if (sc.mode === 'AB' && sc.id === 'S14') continue; // sweep handled in the UI
  const runs = runScenario(sc, { recordInterval: 2 });
  for (const r of runs) {
    const badge = scenarioPassBadge(r);
    if (badge === 'pass') pass++;
    else fail++;
    const failed = r.assertions.filter((a) => !a.passed).map((a) => a.id);
    console.log(
      `${badge.toUpperCase().padEnd(6)} ${id} [${r.mode}] minR=${r.kpis.minR.toFixed(2)} ` +
        `tankMin=${r.kpis.tankMin.toFixed(2)} trans=${r.kpis.transitions} ` +
        `cycles=${r.kpis.injectionCycles} false=${r.kpis.falseInjections}` +
        (failed.length ? `  FAILED: ${failed.join(',')}` : ''),
    );
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
