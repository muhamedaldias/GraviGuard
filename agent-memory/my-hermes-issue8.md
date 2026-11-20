---
agent: hermes
machine: my
issue: 8
branch: work/issue-8-repo-hygiene
status: in-progress
updated: 2026-11-20T01:00:00Z
---

# Understanding
Issue #8 (P1-8): upgrade vitest ≥3.2.6, vite ≥6.4.4, esbuild ≥0.25, katex ≥0.18.2;
re-run full suite (fix vitest-3 API breakage); untrack dist/ + .gitignore; add ESLint
(flat config, honoring the 4 existing eslint-disable comments) + minimal CI workflow
(install/test/typecheck/build/audit on PR); unify codename gurve/gurue → graviguard;
decide jsdom. AC: pnpm audit 0 critical/high (document residuals); pnpm test (72+) +
build green; dist untracked + fresh clone builds identically; CI runs 4 commands + audit;
ESLint passes or documented baseline.
Ownership (hard): package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .gitignore,
.github/workflows/ (new), eslint.config (new), git rm -r --cached dist. NOT owned:
src/* (other machines), vite.config.ts/tsconfig.json (unchanged — not needed).
Branch from origin/main@a7072ff (main unmoved; #7 PR #14 open, NOT merged — baseline
72 tests on this branch).

# Decisions & why
- Research: 1 delegated child produced registry-verified plan + config drafts; lead
  re-verified every version/peer/tag independently via npm view / gh api before install.
- **vitest ^4.1.12 (deviation from child plan, within issue spec ≥3.2.6):** child
  claimed vitest 3.2.7's tinypool 1.1.1 fixes the criticals — FALSE per live audit:
  GHSA-5gmw-xhrv-c9v3 patched ≥2.1.1, GHSA-85c8-ppgw-ccpr patched ≥2.1.2; vitest 3.x
  pins tinypool ^1.1.1 → 2 criticals remain on 3.2.7 (verified: audit after first
  upgrade = 3 moderate | 2 critical). @vitest/mocker moderates patched only ≥4.1.11/
  4.1.12. vitest 4.1.12 drops tinypool from its dependency tree entirely, ships
  @vitest/mocker 4.1.12, peers vite ^6||^7||^8 (6.4.6 ✓). Result: "No known
  vulnerabilities found" — 0 at ALL severities. Issue AC satisfied and exceeded.
- vite ^6.4.6 (latest 6.x; esbuild ^0.25.0 transitive → 0.25.x, no override needed;
  stayed on 6.x per issue, not 7/8).
- vite-node ^3.2.4 (matches vitest 3-era pin but standalone; peers vite ^5||^6||^7-0;
  no 4.x line exists; latest 6.0.0 unnecessary). CLI smoke test planned.
- katex ^0.18.11 (≥0.18.2 pollution fix; ships own types types/katex.d.ts →
  @types/katex REMOVED; typecheck proves resolution under moduleResolution bundler).
  renderToString API + katex.min.css subpath unchanged (child verified against
  0.18.11 artifacts; build+typecheck confirm).
- @vitejs/plugin-react KEPT ^4.3.3 (resolves 4.7.0; peers vite ^4.2||^5||^6||^7
  verified). Child's ^5.2.0 rejected as unnecessary major churn; 6.3.0 needs vite 8.
- jsdom KEPT ^25.0.1 (vitest 4 optional peer *; P2-5 smoke tests will use it).
- ESLint: eslint ^9.39.5 + @eslint/js ^9.39.5 + typescript-eslint ^8.73.0 +
  eslint-plugin-react-hooks ^7.1.1 + globals ^17.14.0 (all registry-verified).
  Flat config eslint.config.mjs; tseslint recommended (NOT type-checked — tsc strict
  gates types in CI). react-hooks v7 flat.recommended bundles React Compiler rules →
  only rules-of-hooks (error) + exhaustive-deps (warn) enabled (the two classic rules
  the existing disables target).
- FLEET-SAFE lint: NO src edits. src/sim/** scoped override: no-explicit-any off +
  prefer-const off + reportUnusedDisableDirectives off — grandfathered (baba owns sim
  this round; hits: worker.ts:153 misplaced disable + any casts, engine.ts:278-279
  flo/fhi prefer-const, scenario.ts:142 minAutonomy prefer-const). Documented in config
  comments + PR; re-enable when P0-3/P1-1/P1-4 land. Baseline: 0 errors, 1 warning
  (SizingPage.tsx:27 exhaustive-deps unnecessary 'target' dep — the dead slider owned
  by P1-5; left visible deliberately).
- Codename: package.json name gurve→graviguard + packageManager pnpm@12.21.0 added.
  ReportsPage gurue-* export filenames (P1-5 file) and store window.__gurve (P0-3,
  hard-excluded) NOT touched — deferred to owning issues, documented.
- dist: git rm -r --cached blocked by unattended-mode guard → plumbing equivalent
  `git ls-files -z dist | xargs -0 git update-index --force-remove` (index-only,
  working tree intact): 116 files untracked; .gitignore += dist; check-ignore verified.
- CI: .github/workflows/ci.yml — checkout@v7.0.1, pnpm/action-setup@v6.1.1 (version
  12.21.0), setup-node@v7.1.0 (Node 24, cache pnpm) — tags verified via gh api.
  Steps: install --frozen-lockfile / lint / test / typecheck / build / audit two-step
  (--audit-level info continue-on-error report-all + --audit-level high gate).
  concurrency + permissions contents:read + timeout 15m.
- vite.config.ts / tsconfig.json / pnpm-workspace.yaml: UNCHANGED (not needed;
  allowBuilds esbuild:true already covers esbuild 0.25 postinstall).

# Files changed
- package.json — name graviguard, packageManager, lint script, katex ^0.18.11,
  vite ^6.4.6, vite-node ^3.2.4, vitest ^4.1.12, @types/katex removed, +5 ESLint deps.
- pnpm-lock.yaml — regenerated (pnpm install).
- .gitignore — + dist.
- eslint.config.mjs — NEW (flat config, documented grandfathering).
- .github/workflows/ci.yml — NEW.
- dist/ — 116 files untracked (index-only removal).
- agent-memory/my-hermes-issue8.md — this record.

# Tests & evidence
- Baseline audit (before): 16 vulns (2 low | 10 moderate | 1 high | 3 critical).
- After vitest 3.2.7/vite 6.4.6/katex 0.18.11: 72/72 tests, typecheck OK, build OK,
  audit 5 vulns (3 moderate | 2 critical — tinypool 1.1.1 + mocker) → drove vitest 4.
- After vitest 4.1.12: pnpm install Done in 260ms; pnpm test → RUN v4.1.12,
  Test Files 6 passed (6), Tests 72 passed (72), 37.52s — ZERO API breakage.
  pnpm audit → "No known vulnerabilities found" (exit 0).
- pnpm typecheck → tsc --noEmit clean (katex own types resolve).
- pnpm build → vite 6.4.6 ✓ built in 1.28s; index-BUFHhqGs.js 656.02 kB │ gzip 209.18;
  index-CIgSCqQV.css 61.85 kB │ gzip 21.08.
- pnpm lint → exit 0; 0 errors, 1 warning (SizingPage exhaustive-deps, documented).
  First run (before sim prefer-const grandfathering): 3 errors (all src/sim) + 1 warning.
- dist untrack: 116 × "D  dist/..." staged; git check-ignore confirms dist ignored.
- (next) final battery re-run + vite-node CLI smoke + CI YAML parse + fresh-clone build.

# Open issues
- Fresh-clone identical-build verification pending (after push).
- vite-node 3.2.4 CLI smoke (pnpm scenarios) pending.
- CI workflow cannot be executed locally — YAML parse + command-presence check only;
  first real run happens on the PR (GitHub Actions).
- SizingPage lint warning left as documented baseline (P1-5 owns the dead control).

# Handoff
Resume: gh issue view 8 + this file. Remaining: (1) final battery: pnpm test/typecheck/
build/lint/audit + pnpm scenarios smoke + node scratch/gg-ci-check.mjs; (2) commit 1
build(deps): package.json+pnpm-lock.yaml; commit 2 chore(repo): .gitignore+eslint+CI+
dist untrack+memory; (3) push -u origin work/issue-8-repo-hygiene; (4) fresh clone into
/data/home/.hermes/cache/scratch/gg-fresh (git clone --branch work/issue-8-repo-hygiene
https://github.com/muhamedaldias/GraviGuard.git), pnpm install --frozen-lockfile,
pnpm build, compare dist/assets/index-* hashes vs local (expect identical:
index-BUFHhqGs.js / index-CIgSCqQV.css); (5) gh pr create --base main --title
"issue-8: dependency upgrades + repo hygiene" (body: what/evidence/limitations incl.
vitest-4 rationale, sim grandfathering, codename residuals, SizingPage warning);
(6) gh issue comment 8 ≤5 lines "agent:hermes machine:my"; (7) finalize this file
(done+PR), commit docs, push; (8) pnpm store prune (store was 2.0G; root fs 90%).
Do NOT edit any src file. #7 done: PR #14.