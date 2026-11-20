// @vitest-environment jsdom
// Regression tests for issue #5 (P0-1): StripChart must plot against the explicit
// independent variable `x`, never against its first y-series.
// Uses REAL uPlot (jsdom stubs imported first) with a constructor-capturing spy.
import './helpers/jsdom-stubs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type uPlot from 'uplot';
import { StripChart, type ChartSeries } from '../src/components/StripChart';

const { plots } = vi.hoisted(() => ({
  plots: [] as { opts: any; data: any; instance: any }[],
}));

vi.mock('uplot', async (importOriginal) => {
  const mod = await importOriginal<{ default: typeof uPlot }>();
  const Real = mod.default;
  // uPlot's factory returns a fresh `self` object; super() binds `this` to it,
  // so the subclass instance IS the live plot (verified against uPlot 1.6.32).
  class Spy extends Real {
    constructor(opts: uPlot.Options, data: uPlot.AlignedData, target?: HTMLElement) {
      super(opts, data, target);
      plots.push({ opts, data, instance: this });
    }
  }
  return { ...mod, default: Spy };
});

const x = [0, 10, 20, 30];
const yA = [1.1, 1.2, 1.3, 1.4];
const yB = [5, 6, 7, 8];
const series: ChartSeries[] = [
  { label: 'R', color: '#ff0000', data: yA },
  { label: 'NPSHa', color: '#0000ff', data: yB, scale: 'y2' },
];

let root: Root;
let container: HTMLDivElement;

async function renderChart(props: any) {
  await act(async () => {
    root.render(React.createElement(StripChart, props));
    // let uPlot's microtask commit + rAF draw run (hooks.ready, legend, cursor)
    await new Promise((r) => setTimeout(r, 80));
  });
}

beforeEach(() => {
  plots.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('StripChart independent variable (issue #5 regression)', () => {
  it('builds uPlot data as [x, ...series] — data[0] === supplied x', async () => {
    await renderChart({ x, series });
    expect(plots.length).toBe(1);
    const { data, instance } = plots[0];
    expect(data[0]).toBe(x); // identity: the supplied x array, not a y-series
    expect(data.length).toBe(series.length + 1);
    expect(data[1]).toBe(yA);
    expect(data[2]).toBe(yB);
    expect(instance.data[0]).toBe(x);
  });

  it('keeps data[0] === new x on live updates without rebuilding the plot', async () => {
    await renderChart({ x, series });
    const x2 = [0, 5, 10, 15, 20, 25];
    const yA2 = [2.1, 2.2, 2.3, 2.4, 2.5, 2.6];
    const yB2 = [9, 8, 7, 6, 5, 4];
    const series2: ChartSeries[] = [
      { label: 'R', color: '#ff0000', data: yA2 },
      { label: 'NPSHa', color: '#0000ff', data: yB2, scale: 'y2' },
    ];
    await renderChart({ x: x2, series: series2 });
    expect(plots.length).toBe(1); // same labels/scales -> setData, not rebuild
    const inst = plots[0].instance;
    expect(inst.data[0]).toBe(x2);
    expect(inst.data[1]).toBe(yA2);
    expect(inst.data[0].length).toBe(6);
  });

  it('renders no right axis when no series uses scale y2', async () => {
    await renderChart({ x, series: [{ label: 'R', color: '#ff0000', data: yA }] });
    const { opts } = plots[0];
    expect(opts.axes.length).toBe(2);
  });

  it('keeps the right axis when a series uses scale y2', async () => {
    await renderChart({ x, series });
    const { opts } = plots[0];
    expect(opts.axes.length).toBe(3);
    expect(opts.axes[2].scale).toBe('y2');
    expect(opts.axes[2].side).toBe(1);
  });

  it('makes hlines reactive to prop changes without rebuilding', async () => {
    await renderChart({ x, series, hlines: [{ y: 1.6, color: '#ffaa00', label: 'A' }] });
    expect(plots.length).toBe(1);
    const inst = plots[0].instance;
    let redraws = 0;
    const origRedraw = inst.redraw.bind(inst);
    inst.redraw = (...args: any[]) => {
      redraws++;
      return origRedraw(...args);
    };
    await renderChart({ x, series, hlines: [{ y: 2.5, color: '#ffaa00', label: 'B' }] });
    expect(plots.length).toBe(1); // no rebuild
    expect(redraws).toBeGreaterThanOrEqual(1); // hlines change triggered a redraw
    // The draw hook must read the LATEST hlines, not a stale closure.
    inst.ctx.__calls.length = 0;
    plots[0].opts.hooks.draw[0](inst);
    const texts = inst.ctx.__calls.filter((c: any[]) => c[0] === 'fillText').map((c: any[]) => c[1]);
    expect(texts).toContain('B');
    expect(texts).not.toContain('A');
  });

  it('formats the x legend value with xUnit/xDecimals and labels the x axis', async () => {
    await renderChart({ x, series, xLabel: 'Q', xUnit: 'm³/s', xDecimals: 3 });
    const { opts, instance } = plots[0];
    expect(opts.series[0].label).toBe('Q');
    expect(opts.axes[0].label).toBe('Q');
    expect(opts.series[0].value(instance, 0.1234, 0, 3)).toBe('0.123 m³/s');
  });

  it('defaults the x legend unit to seconds with 1 decimal', async () => {
    await renderChart({ x, series });
    const { opts, instance } = plots[0];
    expect(opts.series[0].value(instance, 2.13, 0, 1)).toBe('2.1 s');
  });

  it('parks the cursor on the latest x so the live legend shows sim time', async () => {
    await renderChart({ x, series });
    const inst = plots[0].instance;
    expect(Number.isFinite(inst.cursor.left)).toBe(true);
    expect(inst.cursor.left).toBeGreaterThanOrEqual(0);
    // x legend must show the last supplied x (30 -> "30.0 s"), not a y value (1.4)
    expect(container.textContent).toContain('30.0 s');
    expect(container.textContent).not.toContain('1.4 s');
  });

  it('honours yMin/yMax as a fixed y range when both are supplied', async () => {
    await renderChart({ x, series, yMin: 0, yMax: 100 });
    const inst = plots[0].instance;
    expect(inst.scales.y.min).toBe(0);
    expect(inst.scales.y.max).toBe(100);
  });
});