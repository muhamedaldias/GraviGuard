---
agent: hermes
machine: baba
issue: 3
branch: work/issue-3-worker-hardening
status: in-progress
updated: 2026-11-19T23:57:00Z
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
Children A/B implementing per contract above. Next: review their diffs, run
pnpm test + typecheck + build, browser-verify AC1/2/4 on vite preview :4173,
commit (conventional), push, PR "issue-3: worker lifecycle + message hardening",
issue comment ≤5 lines starting "agent:hermes machine:baba", finalize this file.
Then issue #4 on work/issue-4-sensor-synthesis from origin/main.
