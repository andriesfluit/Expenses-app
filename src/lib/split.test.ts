import { describe, expect, it } from 'vitest';
import { splitCents, weightsFor } from '@/lib/split';
import type { Household } from '@/types';

/** De echte reisgenoten: 5 huishoudens, 13 personen. */
const HOUSEHOLDS: Household[] = [
  { id: 'a', name: 'Gezin van 5', size: 5 },
  { id: 'b', name: 'Koppel 1', size: 2 },
  { id: 'c', name: 'Koppel 2', size: 2 },
  { id: 'd', name: 'Alleen', size: 1 },
  { id: 'e', name: 'Gezin van 3', size: 3 },
];

const ALL = HOUSEHOLDS.map((h) => h.id);
const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

describe('weightsFor', () => {
  it('weegt per persoon naar gezinsgrootte', () => {
    expect(weightsFor(HOUSEHOLDS, ALL, 'per-person')).toEqual([
      { id: 'a', weight: 5 },
      { id: 'b', weight: 2 },
      { id: 'c', weight: 2 },
      { id: 'd', weight: 1 },
      { id: 'e', weight: 3 },
    ]);
  });

  it('geeft elk huishouden één deel bij per-household', () => {
    const weights = weightsFor(HOUSEHOLDS, ALL, 'per-household');
    expect(weights.every((w) => w.weight === 1)).toBe(true);
    expect(weights).toHaveLength(5);
  });

  it('laat niet-deelnemers weg', () => {
    expect(weightsFor(HOUSEHOLDS, ['a', 'd'], 'per-person')).toEqual([
      { id: 'a', weight: 5 },
      { id: 'd', weight: 1 },
    ]);
  });

  it('negeert onbekende ids', () => {
    expect(weightsFor(HOUSEHOLDS, ['a', 'bestaat-niet'], 'per-person')).toEqual([
      { id: 'a', weight: 5 },
    ]);
  });
});

describe('splitCents', () => {
  it('verdeelt een deelbaar bedrag exact naar hoofdtelling', () => {
    const shares = splitCents(13_000, weightsFor(HOUSEHOLDS, ALL, 'per-person'));
    expect(shares.get('a')).toBe(5_000);
    expect(shares.get('b')).toBe(2_000);
    expect(shares.get('c')).toBe(2_000);
    expect(shares.get('d')).toBe(1_000);
    expect(shares.get('e')).toBe(3_000);
  });

  it('verliest geen cent bij een onmogelijke deling', () => {
    // 100,00 € over 13 personen is 7,6923... € per persoon.
    const shares = splitCents(10_000, weightsFor(HOUSEHOLDS, ALL, 'per-person'));
    expect(sum(shares)).toBe(10_000);
  });

  it('houdt de som gelijk aan het bedrag voor elk bedrag tot 10 euro', () => {
    const weights = weightsFor(HOUSEHOLDS, ALL, 'per-person');
    for (let cents = 1; cents <= 1_000; cents++) {
      expect(sum(splitCents(cents, weights))).toBe(cents);
    }
  });

  it('houdt de som gelijk bij een verdeling per huishouden', () => {
    const weights = weightsFor(HOUSEHOLDS, ALL, 'per-household');
    for (let cents = 1; cents <= 1_000; cents++) {
      expect(sum(splitCents(cents, weights))).toBe(cents);
    }
  });

  it('deelt restcenten uit aan de grootste resten', () => {
    // 10 cent over 3 gelijke delen: 4/3/3, niet 3/3/3 met een zwevende cent.
    const shares = splitCents(10, [
      { id: 'x', weight: 1 },
      { id: 'y', weight: 1 },
      { id: 'z', weight: 1 },
    ]);
    expect(sum(shares)).toBe(10);
    expect([...shares.values()].sort()).toEqual([3, 3, 4]);
  });

  it('is deterministisch bij gelijke resten', () => {
    const weights = [
      { id: 'z', weight: 1 },
      { id: 'y', weight: 1 },
      { id: 'x', weight: 1 },
    ];
    const first = splitCents(100, weights);
    const second = splitCents(100, weights);
    expect([...first.entries()]).toEqual([...second.entries()]);
    // De extra cent gaat naar het alfabetisch eerste id.
    expect(first.get('x')).toBe(34);
  });

  it('geeft één deelnemer het volledige bedrag', () => {
    const shares = splitCents(4_299, weightsFor(HOUSEHOLDS, ['d'], 'per-person'));
    expect(shares.get('d')).toBe(4_299);
    expect(sum(shares)).toBe(4_299);
  });

  it('geeft een lege verdeling zonder deelnemers', () => {
    expect(splitCents(5_000, []).size).toBe(0);
  });
});
