import { describe, it, expect } from 'vitest';
import { assertKeyParity, flattenKeys, en as enDict, ar as arDict } from '../src/i18n';

describe('i18n catalogue (Section 8)', () => {
  it('English and Arabic have identical key sets', () => {
    const { missingInAr, missingInEn, empty } = assertKeyParity();
    expect(missingInAr, `missing in ar: ${missingInAr.join(', ')}`).toEqual([]);
    expect(missingInEn, `missing in en: ${missingInEn.join(', ')}`).toEqual([]);
    expect(empty, `empty values: ${empty.join(', ')}`).toEqual([]);
  });

  it('has a substantial catalogue in both languages', () => {
    const enKeys = flattenKeys(enDict as Record<string, unknown>);
    const arKeys = flattenKeys(arDict as Record<string, unknown>);
    expect(enKeys.length).toBeGreaterThan(150);
    expect(arKeys.length).toBeGreaterThan(150);
  });

  it('contains the required glossary terms in Arabic', () => {
    const ar = arDict as Record<string, unknown>;
    const adv = (ar.advisor as Record<string, string>).recirculation;
    expect(adv).toContain('إعادة التدوير');
    const sim = (ar.sim as Record<string, string>).npsha;
    expect(sim).toContain('ضغط الشفط الصافي الموجب');
  });
});
