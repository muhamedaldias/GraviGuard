---
agent: hermes
machine: baba
issue: analysis-001
branch: work/analysis-001-repo-deep-review
status: done
updated: 2026-11-19T23:42:37Z
pr: https://github.com/muhamedaldias/GraviGuard/pull/1
---

# Understanding
Deep repository analysis of GraviGuard (main @ c006f41, single commit). Analysis only —
no source changes. Deliverables: analysis/REPO-ANALYSIS-001.md (9 sections incl. P0/P1/P2
roadmap, 19 items), agent-memory/README.md + this checkpoint, PR to main titled
"analysis-001: deep repo review". Repo: React 18 + Vite 5 + TS 5.6 strict + zustand +
i18next + uPlot + KaTeX; physics in Web Worker (src/sim/, pure TS, dt=0.01); 21 scenario
JSONs; 16 pages; en/ar i18n (316 keys each). ~4.9k LOC src, 472 LOC tests.

# Decisions & why
- Branch work/analysis-001-repo-deep-review created from main at session start.
- Lead read ALL src/ + tests/ files in full. One delegated subagent did an independent
  physics cross-check with numerical vite-node probes (18/20 lead candidates confirmed,
  1 corrected, 12 new findings). Delegation budget (oneshot_max_children=2) refused the
  second call → UI and docs reviews done by lead directly. No model switch was needed.
- Report assembled from parts: report-A (§1-3), report-B (§4-7), report-C (§8 roadmap +
  §9 evidence) concatenated into analysis/REPO-ANALYSIS-001.md; supporting evidence kept
  in analysis/parts/{physics-review,ui-review,docs-review}.md.
- Browser smoke test of built app (vite preview :4173) confirmed the two headline UI
  defects before reporting them.
- dist/ is committed (116 files) — reported as hygiene finding, NOT removed (analysis only).

# Files changed
- agent-memory/README.md — memory-file format spec (created).
- agent-memory/baba-hermes-analysis.md — this session record (created, updated at milestones).
- analysis/REPO-ANALYSIS-001.md — full report, 632 lines (created).
- analysis/parts/physics-review.md — subagent cross-check, 189 lines (created by child).
- analysis/parts/ui-review.md — lead UI review, 64 lines (created).
- analysis/parts/docs-review.md — drift register, 29 items (created).
- analysis/parts/report-{A,B,C}.md — report chunks (created; kept for provenance).
- No src/tests/scripts/public/config files touched. Scratch probes in
  /data/home/.hermes/cache/scratch/ (i18n-parity.cjs, parse_audit.py, audit.json, child gg-probe*.ts).

# Tests & evidence
- `pnpm install` → Done in 1.5s, pnpm v12.15.0 (exit 0).
- `pnpm test` → Test Files 6 passed (6); Tests 72 passed (72); 38.85s.
  Per-file actual counts: fluid 7, pump 11, network 8, engine 24, scenarios 19, i18n 3.
- `pnpm build` → tsc --noEmit clean; vite ✓ built in 1.40s; JS 644.78 kB (gzip 207.64).
- `pnpm audit` → 16 vulns: 3 critical (vitest, 2× tinypool), 1 high (vite/launch-editor),
  10 moderate (vite/esbuild/@vitest/mocker), 2 low (katex runtime, vite). All dev-time
  except katex. Full list in report §7.
- i18n parity script: en 316 / ar 316, missing [], empty [], 6 legitimate identical values.
- Assertion census: 37 assertions / 11 types; minNPSHa & maxDamage claimed in TEST_REPORT
  but absent from pack; 'custom' unused (auto-pass hole latent).
- Browser (built app): Simulator chart "t" legends show 2.3/0.1/5.0/0.0 s at sim time
  2.1 s → x-axis = first y-series (StripChart.tsx:49). Tour click → active page Simulator
  (TourPage.tsx:68 self-unmount). Both reproduced, not inferred.
- Physics probes (child, vite-node): R baseline 2.30727; S10a surge 1,450,078 Pa;
  estimator bias +0.0318 m; gauge −11325 Pa @ Patm 90 kPa; backflow 0.926 vs 0.355 m³/s;
  inject 0.01 s after threshold crossing; drift ΔR_est 0.0007 (invisible).

# Open issues
- None blocking. Report §9 lists what was NOT verified (exhaustive console sweep, full
  visual review, measured contrast, AR demo parity line-by-line, generator not executed).
- Top findings for PR: (1) StripChart wrong x-axis [browser-verified]; (2) TourPage
  self-unmount [browser-verified]; (3) estimator velocity-head double count + P_discharge
  synthesis error (engine.ts:480-481, sensors.ts:170); (4) controller timer semantics +
  truth R_src leak + unsafe recovery closure (controller.ts:107,142,157; engine.ts:537);
  (5) six dead UI controls incl. Strategy A/B/C no-op and dead SVG/PNG exports;
  (6) SensorsPage truth-vs-measured identical arrays; (7) drift fault invisible (S9b);
  (8) 16 audit vulns (dev-time) + dist committed + no CI/lint.
- Roadmap: P0=3, P1=9, P2=7 (19 items), file-ownership partitioned, sequenced.

# Handoff
DONE. Commits: 3ac5649 (report + memory) + final checkpoint commit on
work/analysis-001-repo-deep-review, pushed to origin. PR #1 OPEN against main:
https://github.com/muhamedaldias/GraviGuard/pull/1 (verified via gh pr view: +1668/−0).
Everything needed is in analysis/REPO-ANALYSIS-001.md. Next session (if any): create
GitHub issues from report §8 roadmap items (P0=3, P1=9, P2=7) — each is self-contained
with acceptance criteria and partitioned file ownership. Preview server may still be
running on :4173 (kill by port if needed; do NOT pkill -f 'vite preview' — matches own shell).
