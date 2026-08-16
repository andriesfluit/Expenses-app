import { useState } from 'react';
import { ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCents, formatDate } from '@/lib/money';
import { SPLIT_MODE_LABELS, type Expense, type Household } from '@/types';

type SortField = 'date' | 'amount' | 'description' | 'payer';

type Props = {
  expenses: Expense[];
  households: Household[];
  onEdit: (expense: Expense) => void;
  onRemove: (id: string) => Promise<boolean>;
};

export const ExpenseList = ({ expenses, households, onEdit, onRemove }: Props) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const nameOf = (id: string) => households.find((h) => h.id === id)?.name ?? 'Onbekend';

  const compare = (a: Expense, b: Expense): number => {
    switch (sortField) {
      case 'amount':
        return a.amountCents - b.amountCents;
      case 'description':
        return a.description.localeCompare(b.description, 'nl');
      case 'payer':
        return nameOf(a.paidBy).localeCompare(nameOf(b.paidBy), 'nl');
      case 'date':
      default:
        // ISO-datums sorteren correct als tekst; bij gelijke datum houdt de
        // omschrijving de volgorde stabiel.
        return a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'nl');
    }
  };

  const sorted = [...expenses].sort((a, b) => (sortDirection === 'asc' ? compare(a, b) : -compare(a, b)));

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggleSort(field)}
      className="-ml-2 h-8 px-2 text-xs font-medium"
      aria-label={`Sorteren op ${children}`}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" aria-hidden="true" />
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Uitgaven</CardTitle>
        <CardDescription>
          {expenses.length === 0
            ? 'Nog geen uitgaven ingevoerd.'
            : `${expenses.length} ${expenses.length === 1 ? 'uitgave' : 'uitgaven'}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Voeg je eerste uitgave toe — de verdeling en de afrekening volgen vanzelf.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 border-b pb-2">
              <SortButton field="date">Datum</SortButton>
              <SortButton field="amount">Bedrag</SortButton>
              <SortButton field="description">Omschrijving</SortButton>
              <SortButton field="payer">Betaler</SortButton>
            </div>

            {/* Kaarten in plaats van een tabel: op een telefoon blijft zo elke
                kolom zichtbaar, ook de omschrijving. */}
            {/* Een vast raster in plaats van flex-wrap: zo schuift het bedrag
                nooit tussen de woorden van een lange omschrijving. */}
            <ul className="space-y-2">
              {sorted.map((expense) => (
                <li
                  key={expense.id}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
                  </div>

                  <span className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {formatCents(expense.amountCents)}
                  </span>

                  <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="font-normal">
                      {nameOf(expense.paidBy)} betaalde
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {SPLIT_MODE_LABELS[expense.splitMode]}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {expense.participants.length === households.length
                        ? 'iedereen'
                        : `${expense.participants.length} van ${households.length}`}
                    </Badge>

                    <div className="ml-auto flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(expense)}
                        aria-label={`${expense.description} bewerken`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void onRemove(expense.id)}
                        aria-label={`${expense.description} verwijderen`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
};
