// @vitest-environment jsdom
// Landing smoke: the platform shell renders the landing by default, shows the
// real CTA, and the hash route mirrors the store page ('#/' on first render).
import './helpers/jsdom-stubs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// No Worker in jsdom: mock the sim lifecycle hook (same pattern as tour.test).
vi.mock('../src/hooks/sim', () => ({
  useSimLifecycle: () => {},
  simSend: vi.fn(),
}));

import App from '../src/App';
import '../src/i18n';

let host: HTMLElement;
let root: Root;

describe('landing shell', () => {
  beforeEach(() => {
    window.location.hash = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    window.location.hash = '';
  });

  it('renders the landing with a plain-verb CTA and syncs the hash', () => {
    act(() => root.render(<App />));
    const buttons = [...host.querySelectorAll('button')];
    const cta = buttons.find((b) => b.textContent === 'Open the platform');
    expect(cta, 'CTA button must exist with its exact action label').toBeDefined();
    expect(['#/', '#']).toContain(window.location.hash);
    // the schematic signature is present
    expect(host.querySelector('.schematic-svg')).not.toBeNull();
    expect(host.querySelectorAll('.s-flowline').length).toBeGreaterThan(0);
  });

  it('landing CTA navigates into the app shell', () => {
    act(() => root.render(<App />));
    const cta = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Open the platform',
    ) as HTMLButtonElement;
    act(() => cta.click());
    expect(window.location.hash).toBe('#/app/simulator');
    expect(host.querySelector('.schematic-svg')).toBeNull();
  });
});
