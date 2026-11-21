# DESIGN.md — GraviGuard Platform design contract

Single design system for every page of the platform (landing, stations map, dashboard, and the
existing app pages). Every page builds from this file verbatim — no page invents one-off tokens.

## Direction — «صهريج / The Reservoir Ink»

Subject-grounded, not style-menu: GraviGuard monitors **gravity-fed water infrastructure** —
reservoirs, pump stations, NPSH margins, hydraulic curves. The design borrows the palette of
its world: deep water in a concrete reservoir (petrol-tinted darks, never neutral black), the
brass of field instruments (warm warning accent), the coral of an alarm lamp, and the precise
linework of P&ID hydraulic schematics. **One signature motif**: the animated *flow line* —
a thin dashed line marching in the direction of flow — used semantically (hero schematic,
map station links, dashboard status rail) and nowhere as decoration.

**Where the boldness is spent**: the landing hero — a live P&ID-style schematic (tank → gravity
line → pump station → network) drawn in precise hairline SVG, gauges ticking with values from
the real engine. Everything else stays quiet and disciplined.

## Default-review record (anti-slop pass — required reading for builders)

Each row = an initial idea that was REJECTED as a second-order default (avoid-ai-design SD
clusters), and what replaced it:

| Rejected default | Why rejected | What ships instead |
|---|---|---|
| Near-black #0B0B0B + single acid-green accent | SD2 verbatim | Petrol-tinted surface family (bg-0 #081E26 → bg-2 #14363F), TWO accents (flow teal + instrument brass) + alarm coral + a 5-hue chart series palette |
| Broadsheet hairlines + zero radius everywhere | SD3 | Hairlines only as semantic rules (panel borders, table rows); 6px radius on controls, 10px on raised panels |
| Warm cream + terracotta (light variant) | SD1 | Cool petrol family; brass is an instrument-material reference, not terracotta décor |
| ALL-CAPS mono eyebrows on every heading | SD5 / fd-tells | Sentence-case micro-labels in Plex Sans, muted ink-2; mono reserved for live numerals only |
| One accented word in the headline | fd-tells | Headlines carry emphasis through weight and scale only |
| `word →` arrows on CTAs, `A · B · C` meta strings | SD5 | CTAs say the action in plain verbs; metadata joined by normal punctuation |
| Identical rounded stat cards in a 3-col row | SD4 | Instrument rail: one ruled horizontal strip with varied-width modules (gauge / count / status), shared baseline |
| Decorative 01/02/03 markers | fd-tells | Numbering ONLY where content is a true sequence (pump startup stages, the 3-step "how gravity supplies" row) |

## Tokens

### Color (dark, petrol reservoir family)
```css
--bg-0: #081E26;      /* page background — deep petrol ink */
--bg-1: #0E2B33;      /* panels */
--bg-2: #14363F;      /* raised / hover surfaces */
--ink:  #EAF4F2;      /* primary text (aqua-tinted white) */
--ink-2: #9FB9B6;     /* muted text */
--line: rgba(159,185,182,0.16);   /* hairline */
--flow: #43BFB2;      /* primary accent — moving water */
--brass: #D9A441;     /* secondary accent — instruments, warnings, [VERIFY] */
--alarm: #E4685D;     /* alarms, damage */
--ok:   #67B279;      /* nominal status */
```
Chart series (data-encoding, fixed order): flow `#43BFB2` · head `#6FA8DC` · power `#D9A441` ·
vibration `#E4685D` · efficiency `#9DB25A`. Contrast: body text on bg-0 ≥ 7:1; muted ≥ 4.5:1;
every accent pairing checked against bg-1 for AA. No gradients as decoration; the only
permitted gradient is the flow-line sweep inside the hero schematic (part of the motif).

### Type — IBM Plex family (engineering institution, bilingual by design)
```
--font-ui:  'IBM Plex Sans Arabic', 'IBM Plex Sans', sans-serif;  /* Arabic glyphs from Plex Arabic, Latin falls through to Plex Sans */
--font-num: 'IBM Plex Mono', monospace;   /* live numerals, units, gauge readouts ONLY */
```
- Weights: 400 body · 500 emphasis · 650 headlines (tight tracking −0.02em, line-height 1.15)
- Scale: 12 / 13 / 15 / 18 / 24 / 32 / 44 px; body line-height 1.6; measure ≤ 68ch
- Arabic-first: `dir="rtl"` on the root when locale=ar (default), logical CSS properties
  everywhere (`margin-inline-start`, `padding-inline`, `inset-inline-end`) — never left/right
- Mono is semantically gated: gauges, readings, unit suffixes. Never for labels or eyebrows

### Space & surface
- Scale: 4 / 8 / 12 / 16 / 24 / 40 / 64
- Radius: controls 6px · panels 10px (nothing else)
- Elevation: borders over shadows; the only shadow is `0 1px 2px rgba(4,14,18,.5)` on raised panels
- Focus: `2px solid var(--flow)`, offset 2px, always visible (`:focus-visible`)

### Motion
- Interactions 150ms ease-out; page transitions instant (no fade on route change)
- ONE orchestrated landing-load moment (≤900ms): schematic linework draws in, gauges tick up,
  flow line starts marching. After that, only live-data motion (flow dashes, gauge needles)
- `prefers-reduced-motion`: flow animation and load sequence off; everything renders static

## Pages (one system, four faces)

1. **Landing** (`#/` — default first visit; "افتح المنصة" → `#/app`)
   Asymmetric split: RTL headline block (real domain copy — gravity networks, NPSH protection,
   Arabic first) beside/below the live schematic hero. Then an instrument rail (3 varied-width
   modules: stations online count · network throughput ticking · worst NPSH margin), a true
   3-step sequence (source → gravity line → pump lift — numbered because it IS a sequence),
   one dense credibility block (physics verified E1–E10 · 168 tests · CI-gated), minimal footer.
   Copy: plain verbs, no "elevate/unlock/supercharge", no emoji.
2. **Stations map** (`#/map`, lazy-loaded chunk)
   Full-bleed MapLibre map (Carto dark raster tiles — tokenless), custom DOM station markers:
   brass ring + status color + pulsing flow tick. Left inline panel (not floating card):
   station list with live level/flow, click → station summary inline (sparklines) →
   «افتح في المحاكي» deep-link to `#/app/simulator?scenario=<id>`.
   Map impl: useRef + useEffect init, `map.remove()` cleanup, `map.on('error')` surfaced,
   dynamic `import('maplibre-gl')` so landing bundle stays lean.
3. **Dashboard home** (`#/app`) — the existing app shell gains a status rail on top
   (stations · worst margin · active alarms), then the existing page grid unchanged beneath.
4. **Existing pages** (Simulator, Curves, Twin, Sensors, Transients, Sizing, Reports,
   Scenarios, Methodology, Applicability, Tour) — surgical token adoption only: they already
   read the CSS custom properties, so they inherit the new values automatically. Do NOT
   restructure them. 168 tests stay green; suite only grows.

## Implementation contract (binding)

- New dep: `maplibre-gl` ONLY (no mapbox-gl, no router lib, no UI kit). Fonts self-hosted via
  `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-sans-arabic`, `@fontsource/ibm-plex-mono`.
- Routing: hash-based via a tiny `useHashRoute` hook (no dependency). Routes: `#/` landing,
  `#/app` dashboard, `#/map`, existing pages keep their internal nav under `#/app/...`.
- Station data: `src/data/stations.ts` — 7 demo stations around Amman/Zarqa (real coords,
  Arabic names + translit), each mapping to an existing scenario id + nominal set-points.
  Typed, exported, unit-testable.
- i18n: every new string through `t()`; `en.json` + `ar.json` key parity must hold (battery
  checks it). No hardcoded user-facing strings anywhere.
- Tests: add unit tests for `useHashRoute`, `stations.ts` integrity (coords in Jordan bbox,
  scenario ids exist), landing render smoke. Suite grows, never shrinks.
- Accessibility floor: semantic landmarks, labelled inputs/buttons, visible focus, AA contrast,
  reduced-motion honored, map keyboard-alternative (the side list IS the accessible path).
- `vercel.json` at repo root: SPA static deploy config (build `pnpm build`, output `dist`,
  no rewrites needed — hash routing).
- never print secrets; no tokens in code (MapLibre needs none).
