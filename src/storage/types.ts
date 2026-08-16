import type { Expense, Household, TripData } from '@/types';

/**
 * Alle opslag loopt via deze interface, zodat de app niet weet of de data in
 * de browser of in Supabase staat.
 */
export interface TripRepository {
  readonly kind: 'local' | 'supabase';
  /** Menselijke omschrijving van waar de data staat, voor de statusregel. */
  readonly label: string;

  load(): Promise<TripData>;

  addHousehold(household: Household): Promise<void>;
  updateHousehold(household: Household): Promise<void>;
  removeHousehold(id: string): Promise<void>;

  addExpense(expense: Expense): Promise<void>;
  updateExpense(expense: Expense): Promise<void>;
  removeExpense(id: string): Promise<void>;

  /**
   * Meldt wijzigingen van buitenaf (een ander toestel). Geeft een functie
   * terug om te stoppen met luisteren. Lokale opslag luistert nergens naar en
   * geeft een lege opzegfunctie.
   */
  subscribe(onRemoteChange: () => void): () => void;
}
