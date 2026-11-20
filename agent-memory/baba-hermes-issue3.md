---
agent: hermes
machine: baba
issue: 3
branch: work/issue-3-worker-hardening
status: done
updated: 2026-11-20T00:55:00Z
pr: https://github.com/muhamedaldias/GraviGuard/pull/9
---

# Understanding
Issue #3 (P0-3): worker lifecycle + message hardening. Scope (hard): src/hooks/sim.ts,
src/sim/worker.ts, src/sim/client.ts, src/state/store.ts. Forbidden: src/pages/*,
src/components/*, src/i18n/*, package.json, CI. App.tsx is NOT owned by any other
issue (checked analysis §8) — a minimal error banner there is the only way to meet
AC4 "visible UI error" without touching pages; decision recorded below.
Repo facts: React 18 StrictMode ON (src/main.tsx); vitest env=node, jsdom available
via per-file docblock; pages (SensorsPage/ControllerPage/TransientsPage) send stale
'params' via simSend — that duplication is issue #6's cleanup, NOT ours; hook must
send live params from store and never 'init' on params edits. Worker module state:
engine/timeline/timer/speed/acc/last. Baseline at a7072ff: pnpm test 72/72 pass (41.8s).

# Decisions & why
- Branch work/issue-3-worker-hardening from origin/main (a7072ff) per task instructions
  (issue body's older branch name work/issue-2-* is superseded by the task assignment).
- worker.ts refactor for testability: export processMessage(raw): WorkerOutbound[] and
  loop(): WorkerOutbound[]; self.onmessage/timer wrappers post returned messages; all
  worker-global (self) access guarded so the module imports cleanly under vitest node.
  Validation via exported validateInbound + template-based validatePlantParams
  (defaultPlant() as shape template; every numeric leaf must be finite; missing
  sections rejected; returns structuredClone of sanitized object).
- Speed: non-finite → error outbound; finite out-of-range → clamp [0.25, 200].
  Step seconds: negative/non-finite → error; cap 3600 s (clamp). Unknown type → error.
- WorkerOutbound 'error' gains optional fatal?: boolean. loop() try/catch posts
  fatal error and STOPS the timer (no 33 ms error spam); hook sets playing=false on
  fatal so the button label matches worker activity (AC2).
- client.ts: onerror + onmessageerror → onError(msg, fatal=true); 'ready' → onReady
  (clears store error). Constructor (onSnapshot, onError?, onReady?).
- store.ts: workerError: string|null + setWorkerError. Hook onError writes it.
- hooks/sim.ts: three effects — mount (client lifecycle), init [seed, scenario]
  (reads params/playing via useApp.getState(), re-sends play if playing, records
  lastParams ref), params [params] (skips if identical ref to last init/params send).
  No stale closures, no init on params edits, StrictMode-safe.
- App.tsx: minimal role="alert" banner rendering store.workerError (plain English
  literal — i18n keys are issue #7's scope; recorded as limitation).
- Delegation: 2 parallel children — A: worker.ts + tests/worker.test.ts;
  B: client/store/hook/App banner + tests. Fixed API contract above given to both.
  Lead: integration, full suite, browser verification (AC1/2/4), PR.

# Files changed
(planned — children in flight)
- src/sim/worker.ts — validation + processMessage/loop exports + fatal error channel.
- tests/worker.test.ts — new, malformed-message + throwing-step unit tests.
- src/sim/client.ts — onerror/onmessageerror/ready routing.
- src/state/store.ts — workerError state.
- src/hooks/sim.ts — lifecycle split, live params, play re-sync.
- src/App.tsx — error banner only.
- tests/client.test.ts (+ store/hook tests) — new.

# Tests & evidence
- Baseline: `pnpm test` → Test Files 6 passed (6); Tests 72 passed (72); 41.79s (exit 0).
- Integrated: `pnpm test` → Test Files 10 passed (10); Tests 122 passed (122); 42.94s.
  New: worker 29, client 9, store 4, sim-hook 8 (jsdom+act).
- `pnpm typecheck` → tsc --noEmit exit 0. `pnpm build` → ✓ built in 1.70s (645.60 kB JS).
- Browser (vite preview :4173, built app, headed Chromium):
  AC1 sensor slider: playing, t 12.21→14.19 across noise σ 1→3 drag (NO reset);
    voting spread 102→396 Pa proves worker applied live params; label ⏸ Pause.
  AC1 controller slider: t 3.77→7.27 across Kp 0.3→0.2 drag (NO reset), playing true.
  AC2 scenario load while playing (S1): playing stays true, label ⏸ Pause, t advances
    from 0 (scenario restart is intended); params edits keep playing (AC1 runs).
  AC4 throwing step: evil scenario timeline param 'pump.bogus' → fatal loop error →
    red role=alert banner "Simulation worker error: unknown param: pump.bogus" visible,
    playing=false, label ▶ Play; clearing scenario removes banner (ready clears error).
  NOTE: two early browser-script misfires were test-harness errors (direct store
  setPlaying without worker 'play'; play button only exists on Simulator page),
  not app defects — resolved by toggling through the UI.

# Open issues
- Page-side stale 'params' sends remain (issue #6). Duplicate params sends are
  harmless (no reset); hook's fresh send lands after the page's stale one.
- Banner text is a plain English literal (i18n keys are issue #7's scope).
- dist/ is committed in this repo; local build dirtied it — NOT committed (P1-8 owns
  dist removal); restored with git checkout before branch switch.

# Handoff
DONE. Commit b505ac6 on work/issue-3-worker-hardening, pushed. PR #9 OPEN against
main: https://github.com/muhamedaldias/GraviGuard/pull/9 (title "issue-3: worker
lifecycle + message hardening"). Issue comment posted (issuecomment-7025989809).
All 5 acceptance criteria verified (unit + browser). Preview server proc_0ed38610c01e
may still run on :4173 — kill by port if needed. Next: issue #4 on
work/issue-4-sensor-synthesis from origin/main; see agent-memory/baba-hermes-issue4.md.

# Fix-round-1 (independent verdict FAIL → addressed)
Tester verdict: /tmp/verdict-issue3.md — all 5 ACs PASS, overall FAIL on F1 (MAJOR).
Worktree: /data/home/projects/GraviGuard-verify-3, branch work/issue-3-worker-hardening.

## Findings addressed (TDD: red commit → green commit each)
- F1 MAJOR (prototype pollution via scenario JSON bypassing validateScenario):
  validateScenario now rejects any params key / timeline param whose dotted
  segments include __proto__/constructor/prototype (isSafeParamPath). Also closed
  an inherited-sections bypass: sanitizeAgainstTemplate uses own-enumerable
  hasOwnProperty checks instead of `key in raw`. Defense in depth at the sink:
  defaultParamsWith (now exported for tests) walks OWN properties only and
  assigns only to keys the plant already owns — no prototype access, no
  unexpected-key injection; unknown/metadata keys ignored (matches applyParam).
  applyParam itself lives in out-of-scope scenario.ts — untouched; hostile
  timeline paths are rejected at validation before Timeline construction.
  Red fa14550: 7 failed / 1 passed on ba05c7d code (all 3 tester variants +
  pump.__proto__.* + bare __proto__ + inherited params). Green 98fffb1: 11/11.
  Red-run safety: validation assertions precede processMessage so the failing
  run never actually pollutes Object.prototype in the test process.
- F3 MINOR (step path blocks worker ~5 s at 3600 s cap): chose the minimal fix —
  MAX_STEP_SECONDS 3600 → 10 (1000 steps ≈ 14 ms, inside loop()'s 20 ms frame
  budget at measured ~14 µs/step). Exact step semantics preserved; UI sends
  seconds:1 only. Red 0077042: clamp 3600≠10 and max-cap step blocked 5698 ms
  (independent repro of tester's 4888 ms). Green 9e74e09: both pass, ~14 ms.
  dt-convergence tests (engine-level + scenario pack) unaffected — all green.
- F4 MINOR (redundant structuredClone in validatePlantParams): returned
  sanitized directly (template rebuild is already a fresh deep copy).
  Efficiency-only, no behavioral red possible; added two-way mutation-isolation
  test. Green 51617fa; full worker file 42/42.
- F2 MINOR (App.tsx beyond 4-file ownership): no code change per verdict
  ("owner confirms ownership; no code change required"). Banner is required for
  AC4; decision documented above; sanction pending owner. Noted in issue comment.
- F5 INFO (English banner literal): SKIPPED per task — deferred to issue #7
  (i18n owner). Noted in issue comment.

## Evidence
- pnpm test → Test Files 10 passed (10); Tests 135 passed (135); 45.03s (exit 0).
  Was 122 pre-round; +13 new (F1 11, F3 net +1, F4 +1). Logs:
  /data/home/.hermes/cache/scratch/fixround-test.log, f1-red.log, f3-red.log.
- pnpm build → tsc --noEmit && vite build ✓ built in 1.64s (exit 0).
- Bypass proof: F1 tests fail on the old code path (red run at fa14550 before
  any src edit, HEAD ba05c7d worker.ts) and pass after 98fffb1.
- dist/ build artifacts restored (git checkout + rm of new hashed assets);
  dist removal stays with P1-8. Scope check: git diff main..HEAD unchanged
  file set — this round touched only src/sim/worker.ts + tests/worker.test.ts.

## Remaining risks
- applyParam (scenario.ts, out of scope) still walks keys unchecked; safe today
  because validateScenario rejects hostile paths before Timeline construction,
  but a future caller bypassing validation would re-expose it. Recommend
  scenario.ts hardening under its owning issue.
- Step cap 10 s is a behavior change for hypothetical >10 s step callers (none
  exist in-repo; UI sends 1 s). Chunking across frames was rejected as
  non-minimal (breaks synchronous processMessage contract).
- F2 ownership sanction and F5 i18n remain open with their owners (#7 / repo owner).
