import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { STATIONS, JORDAN_BBOX } from '../src/data/stations';

describe('station data integrity', () => {
  it('stations sit inside the Jordan bounding box', () => {
    for (const s of STATIONS) {
      expect(s.lat, s.id).toBeGreaterThan(JORDAN_BBOX.minLat);
      expect(s.lat, s.id).toBeLessThan(JORDAN_BBOX.maxLat);
      expect(s.lng, s.id).toBeGreaterThan(JORDAN_BBOX.minLng);
      expect(s.lng, s.id).toBeLessThan(JORDAN_BBOX.maxLng);
    }
  });

  it('ids are unique and every station is bilingual', () => {
    const ids = STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STATIONS) {
      expect(s.nameAr.length, s.id).toBeGreaterThan(0);
      expect(s.nameEn.length, s.id).toBeGreaterThan(0);
      expect(s.nameAr, s.id).not.toBe(s.nameEn);
    }
  });

  it('every scenarioId exists in the bundled scenario index', () => {
    const index: string[] = JSON.parse(readFileSync('public/scenarios/index.json', 'utf-8'));
    for (const s of STATIONS) {
      expect(index, s.id).toContain(s.scenarioId);
    }
  });
});
