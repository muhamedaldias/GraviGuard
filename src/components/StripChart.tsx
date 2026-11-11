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
  series: ChartSeries[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
  /** Horizontal reference lines. */
  hlines?: { y: number; color: string; label?: string }[];
  /** Y-axis fixed range. */
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

export function StripChart({ series, height = 150, yLabel, xLabel, hlines }: StripChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const ready = (series[0]?.data.length ?? 0) > 1;

  useEffect(() => {
    if (!ref.current || !ready) return;
    const data = [series[0].data, ...series.map((s) => s.data)];
    const opts: uPlot.Options = {
      width: ref.current.clientWidth,
      height,
      padding: [8, 8, 8, 8],
      legend: { show: true, live: true },
      cursor: { drag: { x: true, y: false } },
      scales: {
        x: { time: false, auto: true },
        y: { auto: true },
        y2: { auto: true },
      },
      axes: [
        { stroke: resolveColor('var(--text-2)'), grid: { stroke: resolveColor('var(--line-soft)'), width: 1 }, font: '11px Inter, sans-serif' },
        { stroke: resolveColor('var(--accent)'), grid: { stroke: resolveColor('var(--line-soft)'), width: 1 }, font: '11px Inter, sans-serif', scale: 'y', label: yLabel, labelFont: '11px Inter, sans-serif' },
        { stroke: resolveColor('var(--water)'), grid: { show: false }, font: '11px Inter, sans-serif', scale: 'y2', side: 1, label: 'NPSH (m)', labelFont: '11px Inter, sans-serif' },
      ],
      series: [
        { label: xLabel ?? 't', value: (_u, v) => formatNumber(v ?? 0, { decimals: 1, locale, digitStyle: digits }) + ' s' },
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
        draw: [
          (u) => {
            if (!hlines || hlines.length === 0) return;
            const ctx = u.ctx;
            ctx.save();
            for (const h of hlines) {
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
    // Park the cursor on the latest sample so the live legend shows values.
    const lastX = series[0].data[series[0].data.length - 1];
    if (lastX !== undefined) {
      plot.setCursor({ left: plot.valToPos(lastX, 'x', true), top: plot.bbox.height / 2 });
    }
    return () => {
      plot.destroy();
      plotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, series.map((s) => s.label).join('|'), height, yLabel, xLabel, lang, digits]);

  useEffect(() => {
    if (!plotRef.current || !ready) return;
    const data = [series[0].data, ...series.map((s) => s.data)];
    plotRef.current.setData(data as unknown as uPlot.AlignedData);
  }, [series, ready]);

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
