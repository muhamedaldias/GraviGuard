import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useApp } from '../state/store';
import { formatNumber } from '../sim/units';

export interface ChartSeries {
  label: string;
  color: string;
  data: number[];
  /** Draw as a filled area. */
  fill?: boolean;
  /** Scale key: 'y' (left) or 'y2' (right). */
  scale?: 'y' | 'y2';
}

interface StripChartProps {
  /** Independent variable (time, flow, …). Must align with every series.data. */
  x: number[];
  series: ChartSeries[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
  /** Unit suffix for the x legend value. Default 's'. */
  xUnit?: string;
  /** Decimals for the x legend value. Default 1. */
  xDecimals?: number;
  /** Horizontal reference lines. Reactive: changes redraw without rebuilding. */
  hlines?: { y: number; color: string; label?: string }[];
  /** Y-axis fixed range (both must be supplied to take effect). */
  yMin?: number;
  yMax?: number;
}

function resolveColor(c: string): string {
  if (c && c.startsWith('var(')) {
    const name = c.slice(4, -1).trim();
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || c;
  }
  return c;
}

export function StripChart({
  x,
  series,
  height = 150,
  yLabel,
  xLabel,
  xUnit = 's',
  xDecimals = 1,
  hlines,
  yMin,
  yMax,
}: StripChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  // Live ref so the draw hook always reads the latest hlines without a rebuild.
  const hlinesRef = useRef(hlines);
  hlinesRef.current = hlines;
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const ready = x.length > 1;
  const hasY2 = series.some((s) => s.scale === 'y2');
  const labelsJoin = series.map((s) => s.label).join('|');
  const scalesJoin = series.map((s) => s.scale ?? 'y').join('|');

  useEffect(() => {
    if (!ref.current || !ready) return;
    const data = [x, ...series.map((s) => s.data)];
    const axes: uPlot.Axis[] = [
      { stroke: resolveColor('var(--text-2)'), grid: { stroke: resolveColor('var(--line-soft)'), width: 1 }, font: '11px Inter, sans-serif', label: xLabel, labelFont: '11px Inter, sans-serif' },
      { stroke: resolveColor('var(--accent)'), grid: { stroke: resolveColor('var(--line-soft)'), width: 1 }, font: '11px Inter, sans-serif', scale: 'y', label: yLabel, labelFont: '11px Inter, sans-serif' },
    ];
    if (hasY2) {
      axes.push({ stroke: resolveColor('var(--water)'), grid: { show: false }, font: '11px Inter, sans-serif', scale: 'y2', side: 1, label: 'NPSH (m)', labelFont: '11px Inter, sans-serif' });
    }
    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height,
      padding: [8, 8, 8, 8],
      legend: { show: true, live: true },
      cursor: { drag: { x: true, y: false } },
      scales: {
        x: { time: false, auto: true },
        y: { auto: true, range: yMin != null && yMax != null ? [yMin, yMax] : undefined },
        y2: { auto: true },
      },
      axes,
      series: [
        { label: xLabel ?? 't', value: (_u, v) => formatNumber(v ?? 0, { decimals: xDecimals, locale, digitStyle: digits }) + ' ' + xUnit },
        ...series.map((s) => ({
          label: s.label,
          stroke: resolveColor(s.color),
          width: 1.6,
          scale: s.scale ?? 'y',
          fill: s.fill ? resolveColor(s.color) + '33' : undefined,
          points: { show: false },
        })),
      ],
      hooks: {
        // Scales are only ranged in the first commit microtask, so parking the
        // cursor must wait for 'ready' — valToPos right after new uPlot() is Infinity.
        ready: [
          (u) => {
            const xs = u.data[0];
            const lastX = xs[xs.length - 1];
            if (lastX !== undefined) {
              u.setCursor({ left: u.valToPos(lastX, 'x', true), top: u.bbox.height / 2 });
            }
          },
        ],
        draw: [
          (u) => {
            const lines = hlinesRef.current;
            if (!lines || lines.length === 0) return;
            const ctx = u.ctx;
            ctx.save();
            for (const h of lines) {
              const y = u.valToPos(h.y, 'y', true);
              ctx.strokeStyle = resolveColor(h.color);
              ctx.setLineDash([5, 4]);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(u.bbox.left, y);
              ctx.lineTo(u.bbox.left + u.bbox.width, y);
              ctx.stroke();
              if (h.label) {
                ctx.fillStyle = resolveColor(h.color);
                ctx.font = '10px Inter, sans-serif';
                ctx.fillText(h.label, u.bbox.left + 6, y - 3);
              }
            }
            ctx.restore();
          },
        ],
      },
    };
    const plot = new uPlot(opts, data as unknown as uPlot.AlignedData, ref.current);
    plotRef.current = plot;
    return () => {
      plot.destroy();
      plotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, labelsJoin, scalesJoin, series.length, hasY2, height, yLabel, xLabel, xUnit, xDecimals, yMin, yMax, lang, digits]);

  useEffect(() => {
    if (!plotRef.current || !ready) return;
    const data = [x, ...series.map((s) => s.data)];
    plotRef.current.setData(data as unknown as uPlot.AlignedData);
  }, [x, series, ready]);

  // hlines are read through hlinesRef in the draw hook; a redraw picks up changes
  // without rebuilding the plot. redraw(false) reuses cached series paths.
  useEffect(() => {
    plotRef.current?.redraw(false);
  }, [hlines]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (plotRef.current) plotRef.current.setSize({ width: el.clientWidth, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  return <div ref={ref} className="chart-box" style={{ height }} />;
}