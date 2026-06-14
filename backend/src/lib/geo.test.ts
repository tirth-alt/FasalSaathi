import { describe, it, expect } from 'vitest';
import { haversineKm, nearestByDistance } from '@/lib/geo.ts';

describe('haversineKm', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineKm(22.7196, 75.8577, 22.7196, 75.8577)).toBeCloseTo(0, 5);
  });

  it('matches a known distance: Indore → Ujjain (~52 km)', () => {
    // Indore (22.7196, 75.8577) → Ujjain (23.1793, 75.7849). Great-circle ≈ 51–52 km.
    const d = haversineKm(22.7196, 75.8577, 23.1793, 75.7849);
    expect(d).toBeGreaterThan(48);
    expect(d).toBeLessThan(56);
  });

  it('matches a known distance: Indore → Dewas (~33 km)', () => {
    const d = haversineKm(22.7196, 75.8577, 22.9623, 76.0508);
    expect(d).toBeGreaterThan(28);
    expect(d).toBeLessThan(38);
  });
});

describe('nearestByDistance', () => {
  const points = [
    { id: 'a', lat: 22.7196, lng: 75.8577 }, // Indore
    { id: 'b', lat: 23.1793, lng: 75.7849 }, // Ujjain (~52 km from Indore)
    { id: 'c', lat: 22.9623, lng: 76.0508 }, // Dewas (~33 km from Indore)
  ];

  it('sorts ascending by distance, nearest first', () => {
    const result = nearestByDistance(points, 22.7196, 75.8577, 3);
    expect(result.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    // distance is attached and non-decreasing
    expect(result[0]!.distance_km).toBeLessThanOrEqual(result[1]!.distance_km);
    expect(result[1]!.distance_km).toBeLessThanOrEqual(result[2]!.distance_km);
  });

  it('respects the limit (returns the N nearest)', () => {
    const result = nearestByDistance(points, 22.7196, 75.8577, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('attaches a rounded distance_km (1 decimal)', () => {
    const result = nearestByDistance(points, 22.7196, 75.8577, 1);
    const d = result[0]!.distance_km;
    expect(Number.isFinite(d)).toBe(true);
    // one decimal place at most
    expect(Math.round(d * 10) / 10).toBe(d);
  });
});
