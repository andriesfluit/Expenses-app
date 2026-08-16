import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Expense, Household, TripData } from '@/types';
import { createRepository } from '@/storage';

const EMPTY: TripData = { households: [], expenses: [] };

/** Ruim genoeg voor een trage verbinding, kort genoeg om niet te blijven hangen. */
const LAAD_TIMEOUT_MS = 12_000;

export function withTimeout<T>(belofte: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const klok = setTimeout(
      () =>
        reject(
          new Error(
            `geen antwoord binnen ${Math.round(ms / 1000)} seconden. Controleer je internetverbinding.`,
          ),
        ),
      ms,
    );
    belofte.then(
      (waarde) => {
        clearTimeout(klok);
        resolve(waarde);
      },
      (fout) => {
        clearTimeout(klok);
        reject(fout);
      },
    );
  });
}

/**
 * Houdt de reisgegevens bij en schrijft elke wijziging weg via de gekozen
 * opslag. Bij gedeelde opslag wordt ook op wijzigingen van andere toestellen
 * geluisterd, zodat iedereen hetzelfde saldo ziet.
 */
export function useTripData() {
  const repository = useMemo(() => createRepository(), []);
  const [data, setData] = useState<TripData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Voorkomt dat een trage load de state van een al ontkoppeld component zet.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      // Zonder deadline blijft de app op "laden" staan zolang het verzoek
      // hangt. Op een camping met half bereik is dat het verschil tussen een
      // duidelijke melding en een scherm dat nooit iets doet.
      const fresh = await withTimeout(repository.load(), LAAD_TIMEOUT_MS);
      if (mounted.current) {
        setData(fresh);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
    return repository.subscribe(() => {
      void reload();
    });
  }, [repository, reload]);

  /**
   * Voert een schrijfactie uit en haalt daarna de waarheid opnieuw op, zodat
   * de weergave nooit uit de pas loopt met de opslag.
   */
  const run = useCallback(
    async (action: () => Promise<void>, mislukt: string) => {
      try {
        await action();
        await reload();
        return true;
      } catch (err) {
        toast.error(`${mislukt}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [reload],
  );

  const addHousehold = useCallback(
    (household: Household) =>
      run(() => repository.addHousehold(household), 'Huishouden toevoegen mislukt'),
    [repository, run],
  );

  const updateHousehold = useCallback(
    (household: Household) =>
      run(() => repository.updateHousehold(household), 'Huishouden bijwerken mislukt'),
    [repository, run],
  );

  const removeHousehold = useCallback(
    (id: string) => run(() => repository.removeHousehold(id), 'Huishouden verwijderen mislukt'),
    [repository, run],
  );

  const addExpense = useCallback(
    (expense: Expense) => run(() => repository.addExpense(expense), 'Uitgave toevoegen mislukt'),
    [repository, run],
  );

  const updateExpense = useCallback(
    (expense: Expense) => run(() => repository.updateExpense(expense), 'Uitgave bijwerken mislukt'),
    [repository, run],
  );

  const removeExpense = useCallback(
    (id: string) => run(() => repository.removeExpense(id), 'Uitgave verwijderen mislukt'),
    [repository, run],
  );

  return {
    households: data.households,
    expenses: data.expenses,
    loading,
    error,
    storageLabel: repository.label,
    storageKind: repository.kind,
    addHousehold,
    updateHousehold,
    removeHousehold,
    addExpense,
    updateExpense,
    removeExpense,
  };
}
