---
agent: hermes
machine: saqer
issue: 6
branch: work/issue-6-guided-tour
status: in-progress
updated: 2026-11-20T00:55:00Z
---

# Understanding
Issue #6 (P0-2): TourPage self-unmounted — its step effect called setPage(step.page)
(old TourPage.tsx:68), so clicking Tour immediately landed on Simulator. Fixed with the
issue's option A: tour is an overlay panel rendered by App while App drives the target
page; aria-current="page" added to the active nav button.
Scope HARD: src/pages/TourPage.tsx + src/App.tsx only (+ new test files + this memory).
STRINGS region kept byte-identical (P1 owns it per analysis §8). Issue body has stale
numbering (issue-5); user TASK overrides → issue-6 branch/memory. Branch from origin/main
@ a7072ff (issue-5 PR #10 unmerged; files disjoint).

# Decisions & why
- TourPage → controlled overlay: props {idx, playing, onIdx, onPlaying, onExit}; exports
  TOUR_STEPS (page: PageId). NO setPage anywhere in TourPage. Keeps 8 s auto-advance
  timer and scenario fetch effect (setScenario → useSimLifecycle sends 'scenario' to
  worker → snapshot.t resets). Added cancelled-flag to fetch (stale-response race),
  scenario-id/page display line, data-testid="tour-panel", fixed-position inline styling
  (var(--bg-1)/var(--line) exist in both themes — no CSS edits needed).
- App owns tourIdx/tourPlaying; page==='tour' → renders PAGES[TOUR_STEPS[idx].page]
  underneath + overlay. PAGES tour entry component: null (type widened to | null).
  Entry effect resets idx/playing → deterministic step-1 re-entry. Exit → 'landing'.
  aria-current={p.id===page ? 'page' : undefined} on every nav button.
- Tests: tests/tour.test.ts (6 tests, jsdom docblock + helpers/jsdom-stubs.ts recreated
  byte-identical from issue-5 branch → clean add/add merge). Mocks: ../src/hooks/sim
  (no Worker in jsdom) + global.fetch (scenario JSONs). Real timers; auto-advance test
  waits 8.5 s. Worker-side scenario reset verified in REAL browser instead.
- dist/ rebuilt by pnpm build but EXCLUDED from commit (restored to HEAD) — same fleet
  conflict-avoidance decision as issue-5.

# Files changed
- src/pages/TourPage.tsx — controlled overlay panel (no self-navigation), TOUR_STEPS
  export, scenario-id display, fetch cancellation, inline overlay styling.
- src/App.tsx — tour state + entry reset + exitTour, target-page rendering under overlay,
  aria-current on nav, PAGES type widened.
- tests/tour.test.ts — 6 regression tests.
- tests/helpers/jsdom-stubs.ts — identical to issue-5 branch copy.
- agent-memory/saqer-hermes-issue6.md — this record.

# Tests & evidence
- TDD red (before fix): `pnpm vitest run tests/tour.test.ts` → Tests 6 failed (6);
  headline failure: "expected 'simulator' to be 'tour'" (the reported self-unmount).
- TDD green: same command → Tests 6 passed (6) (17.4 s incl. real 8.5 s auto-advance).
- `pnpm test` (full) → Test Files 7 passed (7); Tests 78 passed (78); 39.55s.
- `pnpm build` → tsc --noEmit clean; vite ✓ built in 1.30s (645.43 kB JS).
- REAL BROWSER (built app, vite preview :4173, real worker):
  * Simulator playing t=1.4 s → click Tour: panel visible 1/5 "simulator · S0",
    aria-current=['Tour'], Simulator charts observable underneath.
  * Manual Next through all 5 steps: panel === same DOM node every step (sameNode=True);
    counters 1/5→5/5; scenario ids S0,S1,default,S6,S10a visible; footer sim time RESET
    on each scenario load (0.8 s / 0.6 s / 0.5 s right after Next; twin step inits default);
    target content observable: Twin at step 3, Transients at step 5, Simulator otherwise.
  * Exit → panel gone, page 'landing', aria-current=['Concept'].
  * Re-entry → 1/5, S0, footer t reset to 0.8 s (deterministic).
  * Auto-advance: first attempt appeared stalled — tab visibilityState 'hidden' → Chrome
    timer throttling; tour HAD advanced 1→4→5 while throttled. Page.bringToFront →
    visibility 'visible'; Start tour → 8.5 s later counter 2/5, S1, sameNode=True ✓.
  * aria-current='page' on exactly the active nav button in all states checked.

# Open issues
- None blocking. Limitations: tour does not auto-play the sim (Play button on the target
  page remains user-controlled; P0-3 owns play-resync semantics); hidden-tab timer
  throttling delays auto-advance (browser behavior, not app bug); overlay covers bottom-
  right of target page on small viewports (fixed panel, scrollable, max-height capped).

# Handoff
Code complete + fully verified; next: commit, push, PR "issue-6: guided tour works",
≤5-line issue comment starting "agent:hermes machine:saqer", finalize this file (done).