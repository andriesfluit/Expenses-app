import { describe, expect, it } from 'vitest';
import { computeBalances, settle } from '@/lib/settle';
import type { Expense, Household } from '@/types';

const HOUSEHOLDS: Household[] = [
  { id: 'a', name: 'Gezin van 5', size: 5 },
  { id: 'b', name: 'Koppel 1', size: 2 },
  { id: 'c', name: 'Koppel 2', size: 2 },
  { id: 'd', name: 'Alleen', size: 1 },
  { id: 'e', name: 'Gezin van 3', size: 3 },
];

const ALL = HOUSEHOLDS.map((h) => h.id);

function expense(partial: Partial<Expense> & Pick<Expense, 'id' | 'amountCents' | 'paidBy'>): Expense {
  return {
    date: '2026-08-01',
    description: 'Test',
    splitMode: 'per-person',
    participants: ALL,
    ...partial,
  };
}

describe('computeBalances', () => {
  it('rekent voorgeschoten en verschuldigd correct uit', () => {
    // 130,00 € boodschappen per persoon: 10,00 € per persoon.
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 13_000, paidBy: 'd' }),
    ]);
    const byId = new Map(balances.map((b) => [b.householdId, b]));

    expect(byId.get('d')!.paidCents).toBe(13_000);
    expect(byId.get('d')!.owedCents).toBe(1_000);
    expect(byId.get('d')!.netCents).toBe(12_000);
    expect(byId.get('a')!.netCents).toBe(-5_000);
    expect(byId.get('e')!.netCents).toBe(-3_000);
  });

  it('laat de saldi altijd tot nul optellen', () => {
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 10_000, paidBy: 'a' }),
      expense({ id: '2', amountCents: 4_733, paidBy: 'b', splitMode: 'per-household' }),
      expense({ id: '3', amountCents: 999, paidBy: 'e', participants: ['a', 'e'] }),
      expense({ id: '4', amountCents: 1, paidBy: 'd' }),
    ]);
    expect(balances.reduce((s, b) => s + b.netCents, 0)).toBe(0);
  });

  it('verdeelt alleen over de deelnemers van een uitgave', () => {
    // Kartbaan van 60 € voor twee huishoudens, betaald door een derde.
    const balances = computeBalances(HOUSEHOLDS, [
      expense({
        id: '1',
        amountCents: 6_000,
        paidBy: 'a',
        splitMode: 'per-household',
        participants: ['b', 'c'],
      }),
    ]);
    const byId = new Map(balances.map((b) => [b.householdId, b]));

    expect(byId.get('a')!.netCents).toBe(6_000);
    expect(byId.get('b')!.netCents).toBe(-3_000);
    expect(byId.get('c')!.netCents).toBe(-3_000);
    expect(byId.get('d')!.netCents).toBe(0);
    expect(byId.get('e')!.netCents).toBe(0);
  });

  it('negeert een uitgave van een verwijderd huishouden zonder te crashen', () => {
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 5_000, paidBy: 'weg', participants: ['a'] }),
    ]);
    expect(balances.find((b) => b.householdId === 'a')!.owedCents).toBe(5_000);
  });
});

describe('settle', () => {
  it('vereffent één schuldeiser met meerdere schuldenaars', () => {
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 13_000, paidBy: 'd' }),
    ]);
    const transfers = settle(balances);

    expect(transfers.every((t) => t.toId === 'd')).toBe(true);
    expect(transfers.reduce((s, t) => s + t.amountCents, 0)).toBe(12_000);
    expect(transfers).toHaveLength(4);
  });

  it('houdt het aantal overboekingen onder het aantal huishoudens', () => {
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 42_000, paidBy: 'a' }),
      expense({ id: '2', amountCents: 8_150, paidBy: 'b', splitMode: 'per-household' }),
      expense({ id: '3', amountCents: 3_333, paidBy: 'c', participants: ['c', 'd', 'e'] }),
      expense({ id: '4', amountCents: 12_750, paidBy: 'e' }),
      expense({ id: '5', amountCents: 675, paidBy: 'd', splitMode: 'per-household' }),
    ]);
    const transfers = settle(balances);

    expect(transfers.length).toBeLessThanOrEqual(HOUSEHOLDS.length - 1);
  });

  it('brengt iedereen precies op nul', () => {
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 42_000, paidBy: 'a' }),
      expense({ id: '2', amountCents: 8_150, paidBy: 'b', splitMode: 'per-household' }),
      expense({ id: '3', amountCents: 3_333, paidBy: 'c', participants: ['c', 'd', 'e'] }),
      expense({ id: '4', amountCents: 12_751, paidBy: 'e' }),
    ]);
    const transfers = settle(balances);

    const net = new Map(balances.map((b) => [b.householdId, b.netCents]));
    for (const t of transfers) {
      net.set(t.fromId, net.get(t.fromId)! + t.amountCents);
      net.set(t.toId, net.get(t.toId)! - t.amountCents);
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true);
  });

  it('vraagt geen overboekingen als niemand iets schuldig is', () => {
    expect(settle(computeBalances(HOUSEHOLDS, []))).toEqual([]);
  });

  it('slaat een uitgave over die het betalende huishouden alleen aangaat', () => {
    const balances = computeBalances(HOUSEHOLDS, [
      expense({ id: '1', amountCents: 2_500, paidBy: 'b', participants: ['b'] }),
    ]);
    expect(settle(balances)).toEqual([]);
  });
});
