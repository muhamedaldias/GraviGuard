import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../src/state/hashRoute';

describe('hash route parsing', () => {
  it('maps empty and root hashes to landing', () => {
    expect(parseHash('')).toBe('landing');
    expect(parseHash('#')).toBe('landing');
    expect(parseHash('#/')).toBe('landing');
  });

  it('parses app-prefixed and bare page hashes', () => {
    expect(parseHash('#/app/twin')).toBe('twin');
    expect(parseHash('#/app/simulator')).toBe('simulator');
    expect(parseHash('#/twin')).toBe('twin');
    expect(parseHash('#/app/settings/')).toBe('settings');
  });

  it('returns null for unknown pages so callers can fall back', () => {
    expect(parseHash('#/app/nope')).toBeNull();
    expect(parseHash('#/galaxy')).toBeNull();
  });

  it('formats landing as the root hash and pages under app', () => {
    expect(formatHash('landing')).toBe('#/');
    expect(formatHash('twin')).toBe('#/app/twin');
    expect(formatHash('settings')).toBe('#/app/settings');
  });

  it('round-trips every page id', () => {
    const pages = [
      'landing', 'simulator', 'curves', 'twin', 'pump', 'controller', 'sensors',
      'transients', 'sizing', 'applicability', 'montecarlo', 'scenarios',
      'reports', 'methodology', 'tour', 'settings',
    ] as const;
    for (const p of pages) {
      expect(parseHash(formatHash(p))).toBe(p);
    }
  });
});
