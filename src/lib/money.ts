/**
 * Geld wordt overal als geheel aantal eurocent bijgehouden. Floats komen niet
 * voor in de berekeningen: 0.1 + 0.2 hoort niet thuis in een afrekening.
 */

const LOCALE = 'nl-BE';

/**
 * Zet invoer uit een tekstveld om naar centen. Accepteert zowel komma als punt.
 * Geeft null terug bij alles wat geen geldig positief bedrag is — inclusief
 * lege invoer, negatieve bedragen, meer dan twee decimalen en NaN.
 */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(LOCALE, {
    style: 'currency',
    currency: 'EUR',
  });
}

/** Toont centen als bewerkbare invoerwaarde, bv. "12.50". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Formatteert een ISO-datum in dezelfde locale als de bedragen.
 * De expliciete tijdcomponent voorkomt dat 'YYYY-MM-DD' als UTC wordt gelezen
 * en de datum in westelijke tijdzones een dag terugschuift.
 */
export function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function todayIso(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
