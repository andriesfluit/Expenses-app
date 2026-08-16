import type { Expense, Household } from '@/types';
import { sharesForExpense } from '@/lib/split';

export type Balance = {
  householdId: string;
  name: string;
  /** Wat dit huishouden heeft voorgeschoten, in centen. */
  paidCents: number;
  /** Wat dit huishouden volgens de verdeelsleutels verschuldigd is. */
  owedCents: number;
  /** Positief = krijgt nog geld terug, negatief = moet nog betalen. */
  netCents: number;
};

export type Transfer = {
  fromId: string;
  toId: string;
  amountCents: number;
};

export function computeBalances(households: Household[], expenses: Expense[]): Balance[] {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const h of households) {
    paid.set(h.id, 0);
    owed.set(h.id, 0);
  }

  for (const expense of expenses) {
    if (paid.has(expense.paidBy)) {
      paid.set(expense.paidBy, paid.get(expense.paidBy)! + expense.amountCents);
    }
    for (const [id, share] of sharesForExpense(expense, households)) {
      owed.set(id, (owed.get(id) ?? 0) + share);
    }
  }

  return households.map((h) => {
    const paidCents = paid.get(h.id) ?? 0;
    const owedCents = owed.get(h.id) ?? 0;
    return {
      householdId: h.id,
      name: h.name,
      paidCents,
      owedCents,
      netCents: paidCents - owedCents,
    };
  });
}

/**
 * Zet de saldi om in een zo kort mogelijke reeks overschrijvingen.
 *
 * Greedy: de grootste schuldenaar betaalt telkens aan de grootste
 * schuldeiser. Dat levert hoogstens n-1 overboekingen in plaats van de n²
 * betalingen die je krijgt als iedereen met iedereen afrekent.
 */
export function settle(balances: Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.householdId, amount: -b.netCents }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.householdId, amount: b.netCents }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) {
      transfers.push({ fromId: debtors[d].id, toId: creditors[c].id, amountCents: amount });
      debtors[d].amount -= amount;
      creditors[c].amount -= amount;
    }
    if (debtors[d].amount === 0) d++;
    if (creditors[c].amount === 0) c++;
  }

  return transfers;
}
