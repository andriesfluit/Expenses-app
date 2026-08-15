import { useMemo, useRef, useState } from 'react';
import { AlertCircle, Cloud, Loader2, Smartphone } from 'lucide-react';
import { HouseholdManager } from '@/components/HouseholdManager';
import { ExpenseForm } from '@/components/ExpenseForm';
import { ExpenseList } from '@/components/ExpenseList';
import { BalanceSummary } from '@/components/BalanceSummary';
import { useTripData } from '@/hooks/useTripData';
import { computeBalances, settle } from '@/lib/settle';
import { formatCents } from '@/lib/money';
import type { Expense } from '@/types';

const Index = () => {
  const {
    households,
    expenses,
    loading,
    error,
    storageLabel,
    storageKind,
    addHousehold,
    updateHousehold,
    removeHousehold,
    addExpense,
    updateExpense,
    removeExpense,
  } = useTripData();

  const [editing, setEditing] = useState<Expense | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const balances = useMemo(() => computeBalances(households, expenses), [households, expenses]);
  const transfers = useMemo(() => settle(balances), [balances]);
  const totalCents = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amountCents, 0),
    [expenses],
  );

  const startEditing = (expense: Expense) => {
    setEditing(expense);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRemoveExpense = async (id: string) => {
    // Voorkomt dat het formulier een uitgave blijft bewerken die niet meer bestaat.
    if (editing?.id === id) setEditing(null);
    return removeExpense(id);
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6 md:py-10">
      <div className="container mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Vakantiekas</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {storageKind === 'supabase' ? (
                <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {storageLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Wie schoot wat voor, wie deelt mee, en wie moet aan het eind wie betalen.
            {totalCents > 0 && (
              <>
                {' '}
                Tot nu toe{' '}
                <strong className="font-semibold text-foreground">{formatCents(totalCents)}</strong>{' '}
                aan gedeelde kosten.
              </>
            )}
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>
              De gedeelde opslag is niet bereikbaar: {error}. Wat je nu invoert komt mogelijk niet
              bij de anderen terecht.
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Gegevens laden…
          </div>
        ) : (
          <>
            <BalanceSummary
              balances={balances}
              transfers={transfers}
              households={households}
              totalCents={totalCents}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div ref={formRef} className="space-y-6">
                <ExpenseForm
                  households={households}
                  editing={editing}
                  onSubmit={editing ? updateExpense : addExpense}
                  onCancelEdit={() => setEditing(null)}
                />
                <HouseholdManager
                  households={households}
                  expenses={expenses}
                  onAdd={addHousehold}
                  onUpdate={updateHousehold}
                  onRemove={removeHousehold}
                />
              </div>

              <ExpenseList
                expenses={expenses}
                households={households}
                onEdit={startEditing}
                onRemove={handleRemoveExpense}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
