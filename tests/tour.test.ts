// @vitest-environment jsdom
// Regression tests for issue #6 (P0-2): the Guided Tour must stay visible while it
// drives the target page/scenario, advance manually and on an 8 s timer, load each
// step's scenario, exit sanely, re-enter at step 1, and mark the active nav button
// with aria-current="page".
import './helpers/jsdom-stubs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// No Worker in jsdom: mock the sim lifecycle hook; scenario->worker wiring is
// verified in a real browser instead.
vi.mock('../src/hooks/sim', () => ({
  useSimLifecycle: () => {},
  simSend: vi.fn(),
}));

import App from '../src/App';
import '../src/i18n';
import { useApp } from '../src/state/store';

const SCENARIO_IDS = ['S0', 'S1', 'S6', 'S10a'];
function scenarioJson(id: string) {
  return {
    id,
    name: `Scenario ${id}`,
    nameAr: `سيناريو ${id}`,
    description: 'test',
    descriptionAr: 'اختبار',
    tags: [],
    duration: 600,
    seed: 12345,
    mode: 'ON',
  };
}

let root: Root;
let container: HTMLDivElement;

async function flush(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

async function renderApp() {
  await act(async () => {
    root.render(React.createElement(App));
  });
  await flush();
}

function navButton(label: string): HTMLButtonElement {
  const b = [...document.querySelectorAll('nav button')].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`nav button not found: ${label}`);
  return b as HTMLButtonElement;
}

async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

function panel(): HTMLElement | null {
  return document.querySelector('[data-testid="tour-panel"]');
}

function buttonIn(scope: ParentNode, label: string): HTMLButtonElement {
  const b = [...scope.querySelectorAll('button')].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`button not found: ${label}`);
  return b as HTMLButtonElement;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => {
        if (String(url).includes('index.json')) return SCENARIO_IDS;
        const id = String(url).split('/').pop()?.replace('.json', '') ?? '';
        return scenarioJson(id);
      },
    })),
  );
  useApp.setState({ page: 'landing', scenario: null, snapshot: null, playing: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe('Guided Tour (issue #6 regression)', () => {
  it('keeps the tour panel visible and shows the target page when Tour is clicked', async () => {
    await renderApp();
    await click(navButton('Tour'));
    expect(useApp.getState().page).toBe('tour');
    const p = panel();
    expect(p).not.toBeNull();
    expect(p!.textContent).toContain('Guided Tour');
    expect(p!.textContent).toContain('1/5');
    // target page (Simulator) content is observable underneath
    expect(container.textContent).toContain('Strip charts');
  });

  it('advances manually through all 5 steps without unmounting the tour', async () => {
    await renderApp();
    await click(navButton('Tour'));
    const p = panel();
    expect(p).not.toBeNull();
    const targets = ['Strip charts', 'Strip charts', 'A/B Digital Twin', 'Strip charts', 'Transients & Water Hammer'];
    for (let i = 0; i < 5; i++) {
      expect(panel()).toBe(p); // same DOM node: never unmounted
      expect(p!.textContent).toContain(`${i + 1}/5`);
      expect(container.textContent).toContain(targets[i]);
      if (i < 4) await click(buttonIn(p!, 'Next'));
    }
  });

  it('auto-advances after 8 s while playing, without unmounting the tour', async () => {
    await renderApp();
    await click(navButton('Tour'));
    const p = panel();
    expect(p).not.toBeNull();
    await click(buttonIn(p!, 'Start tour'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 8500));
    });
    expect(panel()).toBe(p);
    expect(p!.textContent).toContain('2/5');
  }, 20000);

  it("loads each step's scenario into the store and shows its id", async () => {
    await renderApp();
    await click(navButton('Tour'));
    await flush(100);
    const expected: (string | null)[] = ['S0', 'S1', null, 'S6', 'S10a'];
    const p = panel()!;
    for (let i = 0; i < 5; i++) {
      expect(useApp.getState().scenario?.id ?? null).toBe(expected[i]);
      if (expected[i]) expect(p!.textContent).toContain(expected[i]);
      if (i < 4) await click(buttonIn(p!, 'Next'));
      await flush(100);
    }
  });

  it('exits to a sane page and re-enters deterministically at step 1', async () => {
    await renderApp();
    await click(navButton('Tour'));
    const p = panel()!;
    await click(buttonIn(p, 'Next'));
    await click(buttonIn(p, 'Next'));
    expect(p.textContent).toContain('3/5');
    await click(buttonIn(p, 'Exit'));
    expect(panel()).toBeNull();
    expect(useApp.getState().page).toBe('landing');
    expect(container.textContent).not.toContain('Guided Tour');
    // re-entry starts at step 1 with step 1's scenario
    await click(navButton('Tour'));
    await flush(100);
    const p2 = panel();
    expect(p2).not.toBeNull();
    expect(p2!.textContent).toContain('1/5');
    expect(useApp.getState().scenario?.id ?? null).toBe('S0');
  });

  it('marks the active nav button with aria-current="page"', async () => {
    await renderApp();
    expect(navButton('Concept').getAttribute('aria-current')).toBe('page');
    expect(navButton('Tour').getAttribute('aria-current')).toBeNull();
    await click(navButton('Tour'));
    expect(navButton('Tour').getAttribute('aria-current')).toBe('page');
    expect(navButton('Concept').getAttribute('aria-current')).toBeNull();
    expect(navButton('Simulator').getAttribute('aria-current')).toBeNull();
  });
});