import type { Expense, Household, SplitMode } from '@/types';

export type Weight = { id: string; weight: number };

/**
 * Bepaalt het gewicht van elke deelnemer aan een uitgave.
 * Bij 'per-person' weegt een huishouden naar het aantal personen, bij
 * 'per-household' telt elk deelnemend huishouden voor één deel.
 * Onbekende of niet-deelnemende huishoudens vallen weg.
 */
export function weightsFor(
  households: Household[],
  participants: string[],
  mode: SplitMode,
): Weight[] {
  const deelnemers = new Set(participants);
  return households
    .filter((h) => deelnemers.has(h.id))
    .map((h) => ({
      id: h.id,
      weight: mode === 'per-person' ? h.size : 1,
    }))
    .filter((w) => w.weight > 0);
}

/**
 * Verdeelt een bedrag in centen over gewogen deelnemers zonder centen te
 * verliezen of bij te maken: de som van de delen is exact het bedrag.
 *
 * Elke deelnemer krijgt eerst zijn afgeronde-naar-beneden deel; de centen die
 * daarna overblijven gaan naar de grootste resten (largest remainder). Bij
 * gelijke resten beslist het id, zodat dezelfde invoer altijd dezelfde
 * verdeling geeft.
 */
export function splitCents(amountCents: number, weights: Weight[]): Map<string, number> {
  const result = new Map<string, number>();
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (weights.length === 0 || totalWeight <= 0) return result;

  const parts = weights.map((w) => {
    const exact = (amountCents * w.weight) / totalWeight;
    const floor = Math.floor(exact);
    return { id: w.id, cents: floor, remainder: exact - floor };
  });

  const assigned = parts.reduce((sum, p) => sum + p.cents, 0);
  const leftover = amountCents - assigned;

  const byRemainder = [...parts].sort(
    (a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id),
  );
  for (let i = 0; i < leftover; i++) {
    byRemainder[i % byRemainder.length].cents += 1;
  }

  for (const part of parts) result.set(part.id, part.cents);
  return result;
}

/** Wat elk huishouden aan deze ene uitgave bijdraagt. */
export function sharesForExpense(
  expense: Expense,
  households: Household[],
): Map<string, number> {
  return splitCents(
    expense.amountCents,
    weightsFor(households, expense.participants, expense.splitMode),
  );
}
