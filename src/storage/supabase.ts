import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Expense, Household, SplitMode, TripData } from '@/types';
import type { TripRepository } from '@/storage/types';

type HouseholdRow = {
  id: string;
  trip_id: string;
  name: string;
  size: number;
};

type ExpenseRow = {
  id: string;
  trip_id: string;
  date: string;
  description: string;
  amount_cents: number;
  paid_by: string;
  split_mode: SplitMode;
  participants: string[];
};

const toHousehold = (row: HouseholdRow): Household => ({
  id: row.id,
  name: row.name,
  size: row.size,
});

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  date: row.date,
  description: row.description,
  amountCents: Number(row.amount_cents),
  paidBy: row.paid_by,
  splitMode: row.split_mode,
  participants: row.participants ?? [],
});

/** Gedeelde opslag: iedereen die de app opent, werkt in dezelfde reis. */
export function createSupabaseRepository(
  url: string,
  anonKey: string,
  tripId: string,
): TripRepository {
  const client: SupabaseClient = createClient(url, anonKey);

  const failOn = (error: { message: string } | null, wat: string) => {
    if (error) throw new Error(`${wat} mislukt: ${error.message}`);
  };

  return {
    kind: 'supabase',
    label: 'Gedeeld met iedereen',

    async load(): Promise<TripData> {
      const [households, expenses] = await Promise.all([
        client.from('households').select('*').eq('trip_id', tripId).order('name'),
        client.from('expenses').select('*').eq('trip_id', tripId).order('date'),
      ]);
      failOn(households.error, 'Huishoudens ophalen');
      failOn(expenses.error, 'Uitgaven ophalen');

      return {
        households: (households.data as HouseholdRow[]).map(toHousehold),
        expenses: (expenses.data as ExpenseRow[]).map(toExpense),
      };
    },

    async addHousehold(household: Household) {
      const { error } = await client
        .from('households')
        .insert({ ...household, trip_id: tripId });
      failOn(error, 'Huishouden toevoegen');
    },

    async updateHousehold(household: Household) {
      const { error } = await client
        .from('households')
        .update({ name: household.name, size: household.size })
        .eq('id', household.id);
      failOn(error, 'Huishouden bijwerken');
    },

    async removeHousehold(id: string) {
      const { error } = await client.from('households').delete().eq('id', id);
      failOn(error, 'Huishouden verwijderen');
    },

    async addExpense(expense: Expense) {
      const { error } = await client.from('expenses').insert({
        id: expense.id,
        trip_id: tripId,
        date: expense.date,
        description: expense.description,
        amount_cents: expense.amountCents,
        paid_by: expense.paidBy,
        split_mode: expense.splitMode,
        participants: expense.participants,
      });
      failOn(error, 'Uitgave toevoegen');
    },

    async updateExpense(expense: Expense) {
      const { error } = await client
        .from('expenses')
        .update({
          date: expense.date,
          description: expense.description,
          amount_cents: expense.amountCents,
          paid_by: expense.paidBy,
          split_mode: expense.splitMode,
          participants: expense.participants,
        })
        .eq('id', expense.id);
      failOn(error, 'Uitgave bijwerken');
    },

    async removeExpense(id: string) {
      const { error } = await client.from('expenses').delete().eq('id', id);
      failOn(error, 'Uitgave verwijderen');
    },

    subscribe(onRemoteChange: () => void) {
      const channel = client
        .channel(`trip-${tripId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'households' }, onRemoteChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, onRemoteChange)
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
