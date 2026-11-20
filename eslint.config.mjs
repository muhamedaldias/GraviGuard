// ESLint 9 flat config for GraviGuard (issue #8).
// Stack: eslint 9.39.5, @eslint/js 9.39.5, typescript-eslint 8.73.0,
// eslint-plugin-react-hooks 7.1.1, globals 17.14.0.
//
// Choice: typescript-eslint `recommended` (NOT recommended-type-checked).
// `tsc --noEmit` (strict) already gates types in CI; type-aware rules would add
// an unverifiable baseline across React event handlers and worker code and need
// parserOptions.projectService. Upgrade path: spread
// tseslint.configs.recommendedTypeChecked + projectService later.
//
// react-hooks: plugin v7's configs.flat.recommended bundles React Compiler rules
// (set-state-in-effect, immutability, ...). We register the latest plugin but
// enable only the two classic rules the codebase's existing eslint-disable
// comments target. Opt into flat.recommended once that baseline is triaged.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Global ignores.
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**', 'analysis/**', 'agent-memory/**'],
  },

  // Keep the four pre-existing eslint-disable directives meaningful.
  {
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
  },

  // JS baseline (also covers this file).
  js.configs.recommended,

  // TS baseline: parser + recommended rules + eslint-recommended overrides.
  ...tseslint.configs.recommended,

  // Browser app code.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // 'warn' keeps the StripChart.tsx exhaustive-deps disable meaningful.
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Fleet grandfathering (round-1): src/sim/* is owned by other machines this
  // round (issues #3/#4). Its module-boundary `any` casts (worker.ts,
  // scenario.ts, engine.ts), the misplaced worker.ts:153 disable comment, and
  // three prefer-const hits (engine.ts:278-279 flo/fhi, scenario.ts:142
  // minAutonomy — the dead KPI owned by P1-4) are left untouched. Re-enable
  // these rules for src/sim/** once the sim owners land P0-3/P1-1/P1-4.
  {
    files: ['src/sim/**/*.ts'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'off',
    },
  },

  // Node-side code: tests and build config.
  {
    files: ['tests/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Enabled so tests/scenarios.test.ts:53 `eslint-disable-next-line no-console`
      // stays meaningful (it suppresses the calibration-summary console.log).
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // CLI scripts: printing is their job.
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);