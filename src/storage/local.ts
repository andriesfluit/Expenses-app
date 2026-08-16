import type { Expense, Household, TripData } from '@/types';
import type { TripRepository } from '@/storage/types';

const STORAGE_KEY = 'vakantie-uitgaven-v1';

const EMPTY: TripData = { households: [], expenses: [] };

function read(): TripData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<TripData>;
    return {
      households: Array.isArray(parsed.households) ? parsed.households : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    // Onleesbare opslag mag de app niet blokkeren; we beginnen dan leeg.
    return EMPTY;
  }
}

function write(data: TripData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Opslag in de browser van één toestel. Werkt zonder configuratie, maar de
 * anderen zien er niets van — daarvoor is de Supabase-variant.
 */
export function createLocalRepository(): TripRepository {
  const mutate = (fn: (data: TripData) => TripData) => {
    write(fn(read()));
    return Promise.resolve();
  };

  return {
    kind: 'local',
    label: 'Alleen op dit toestel',

    load: () => Promise.resolve(read()),

    addHousehold: (household: Household) =>
      mutate((d) => ({ ...d, households: [...d.households, household] })),

    updateHousehold: (household: Household) =>
      mutate((d) => ({
        ...d,
        households: d.households.map((h) => (h.id === household.id ? household : h)),
      })),

    removeHousehold: (id: string) =>
      mutate((d) => ({ ...d, households: d.households.filter((h) => h.id !== id) })),

    addExpense: (expense: Expense) =>
      mutate((d) => ({ ...d, expenses: [...d.expenses, expense] })),

    updateExpense: (expense: Expense) =>
      mutate((d) => ({
        ...d,
        expenses: d.expenses.map((e) => (e.id === expense.id ? expense : e)),
      })),

    removeExpense: (id: string) =>
      mutate((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) })),

    subscribe: () => () => {},
  };
}
