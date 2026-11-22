// @vitest-environment jsdom
// Stations map smoke: the page renders the side panel (the accessible path)
// with all 7 stations; maplibre init failure (no WebGL in jsdom) is caught and
// surfaced as an inline note — the page must never crash.
import './helpers/jsdom-stubs';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../src/hooks/sim', () => ({
  useSimLifecycle: () => {},
  simSend: vi.fn(),
}));

import { StationsMapPage } from '../src/pages/StationsMapPage';
import { STATIONS } from '../src/data/stations';

describe('stations map page', () => {
  it('renders the full station list as the accessible panel', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(React.createElement(StationsMapPage));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    const rows = host.querySelectorAll('.st-row');
    expect(rows.length).toBe(STATIONS.length);
    expect(host.querySelector('.map-title')).not.toBeNull();
    act(() => root.unmount());
    host.remove();
  });

  it('selecting a station reveals facts and a plain-verb CTA', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(React.createElement(StationsMapPage));
    });
    const first = host.querySelector('.st-row') as HTMLButtonElement;
    await act(async () => {
      first.click();
    });
    expect(host.querySelector('.st-detail')).not.toBeNull();
    const open = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Open in simulator',
    );
    expect(open).toBeDefined();
    act(() => root.unmount());
    host.remove();
  });
});
