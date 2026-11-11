# GraviGuard — Demo Video Script (English)

**Runtime:** 5:00 · **Format:** 16:9, 1080p · **Voice:** narrated, EN + AR captions
**Screen drive:** the live app at `pnpm dev` (or `pnpm preview`)

---

### 0:00 – 0:20 · Cold open

**Visual:** Cut to the live Simulator. The P&ID schematic fills the frame; the source
tank breathes with the tide, the pump impeller turns. The margin gauge sits at **R = 2.31**.

**Narration:**
> "A centrifugal pump does not fail because it is weak. It fails because the water it
> needs is not always there. This is GraviGuard — a way to lift suction pressure
> dynamically, only when it matters."

**On-screen text:** `Synthetic data / simulation` badge pinned top-right.

---

### 0:20 – 0:55 · The problem

**Visual:** Switch to the Curves page. The NPSHa vs NPSH3 chart; the margin arrow closes
as the source level slider drops. Cut back to the Simulator; lower the source level
slider from +1.0 m to −4.5 m.

**Narration:**
> "NPSH available is what the system gives the pump. NPSH required is what the pump
> needs. The ratio between them is the margin. Tide, strainer fouling and temperature
> all erode it — and when it crosses one, the pump starts to cavitate."

**Caption (AR):** «ضغط الشفط الصافي الموجب المتاح هو ما يعطيه النظام للمضخة…»

---

### 0:55 – 1:40 · The idea

**Visual:** Load scenario **S1 — Tidal drawdown**. Watch the advisor arm, the tank branch
valve open, and the junction pressure rise. Zoom into the tank level falling.

**Narration:**
> "GraviGuard watches that margin. When it erodes, an elevated gravity tank injects into
> the suction line through a modulating valve. A check valve on the source line stops the
> lifted water flowing back. When the source recovers, the valve closes and the tank
> refills. Nothing moves until it is needed."

---

### 1:40 – 2:30 · The evidence

**Visual:** Open the **A/B Digital Twin**. Both plants run the same seed. The OFF plant
dips into severe cavitation; the ON plant holds the margin. The delta panel shows the
avoided damage.

**Narration:**
> "Same plant, same seed, two fates. With GraviGuard off, the margin collapses and the
> damage accumulates. With it on, the margin is held at 1.7 — and the damage curve stays
> flat."

---

### 2:30 – 3:15 · Where it does not work

**Visual:** Load **S6 — Low-flow recirculation**. The margin stays healthy while the
recirculation index climbs. The advisor card reads "Recirculation, not NPSH. Not
addressable by GraviGuard." Then **S7 — Air ingestion**: the disagreement detector fires.

**Narration:**
> "But the tool is honest about its limits. At low flow the pump recirculates internally
> — the margin looks fine, yet the damage rises. Raising suction pressure cannot fix
> that. And if the intake is starving, the vibration tells a different story than the
> pressure does. GraviGuard says so, instead of claiming a cure."

---

### 3:15 – 4:00 · The hard constraint

**Visual:** Open **Transients**. Drag the valve stroke from 0.05 s to 30 s. The Joukowsky
estimate collapses from 14.5 bar to a few metres of water.

**Narration:**
> "The tank and valve are not free. A valve that moves faster than the pressure wave can
> travel — about 80 milliseconds here — creates a hammer of over 14 bar. A 12-second
> stroke keeps it under a tenth of that. Stroke time is a hard constraint, not a
> preference."

---

### 4:00 – 4:40 · The honest economics

**Visual:** Open **Sizing**. Adjust flow, event duration and tank elevation; the required
volume and stroke update. Then **Monte Carlo**: run S14 and show the ON vs OFF
histograms.

**Narration:**
> "Sizing is illustrative, and it says so. A tank sized for a twenty-minute tide is not a
> tank sized for continuous duty — and the simulator will show you the autonomy running
> out rather than pretend otherwise. Across three hundred seeded runs, the protected
> plant stays out of the danger zone."

---

### 4:40 – 5:00 · Close

**Visual:** Cut back to the landing page. The positioning sentence holds the frame.

**Narration:**
> "GraviGuard targets centrifugal pumps in water networks with variable suction
> conditions — raising NPSH available dynamically, only when needed. Every number you
> have seen is synthetic, seeded, and reproducible."

**On-screen text:** `GraviGuard · Synthetic data / simulation · not a design tool`
