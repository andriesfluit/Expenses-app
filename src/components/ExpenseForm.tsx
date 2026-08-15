import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { centsToInput, parseAmountToCents, todayIso } from '@/lib/money';
import {
  SPLIT_MODE_HINTS,
  SPLIT_MODE_LABELS,
  type Expense,
  type Household,
  type SplitMode,
} from '@/types';

type Props = {
  households: Household[];
  /** Gevuld bij bewerken, leeg bij een nieuwe uitgave. */
  editing: Expense | null;
  onSubmit: (expense: Expense) => Promise<boolean>;
  onCancelEdit: () => void;
};

const SPLIT_MODES: SplitMode[] = ['per-person', 'per-household'];

export const ExpenseForm = ({ households, editing, onSubmit, onCancelEdit }: Props) => {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('per-person');
  const [participants, setParticipants] = useState<string[]>([]);

  const resetToNew = () => {
    setDate(todayIso());
    setAmount('');
    setDescription('');
    setPaidBy('');
    setSplitMode('per-person');
    setParticipants(households.map((h) => h.id));
  };

  // Bij bewerken de bestaande waarden overnemen; anders standaard iedereen
  // laten meedelen, want dat is veruit het vaakste geval.
  useEffect(() => {
    if (editing) {
      setDate(editing.date);
      setAmount(centsToInput(editing.amountCents));
      setDescription(editing.description);
      setPaidBy(editing.paidBy);
      setSplitMode(editing.splitMode);
      setParticipants(editing.participants);
    } else {
      setParticipants(households.map((h) => h.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, households.length]);

  const toggleParticipant = (id: string, checked: boolean) => {
    setParticipants((current) =>
      checked ? [...current, id] : current.filter((p) => p !== id),
    );
  };

  const allSelected = households.length > 0 && participants.length === households.length;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amountCents = parseAmountToCents(amount);
    const trimmedDescription = description.trim();

    if (amountCents === null) {
      toast.error('Vul een bedrag groter dan nul in, met hoogstens twee decimalen');
      return;
    }
    if (!trimmedDescription) {
      toast.error('Vul een omschrijving in');
      return;
    }
    if (!paidBy) {
      toast.error('Geef aan wie betaald heeft');
      return;
    }
    if (participants.length === 0) {
      toast.error('Selecteer minstens één huishouden dat meedeelt');
      return;
    }

    const expense: Expense = {
      id: editing?.id ?? crypto.randomUUID(),
      date,
      description: trimmedDescription,
      amountCents,
      paidBy,
      splitMode,
      participants,
    };

    if (await onSubmit(expense)) {
      toast.success(editing ? 'Uitgave bijgewerkt' : 'Uitgave toegevoegd');
      if (editing) {
        onCancelEdit();
      } else {
        resetToNew();
      }
    }
  };

  if (households.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uitgave toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Voeg eerst minstens één huishouden toe. Zonder deelnemers valt er niets te verdelen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {editing ? 'Uitgave bewerken' : 'Uitgave toevoegen'}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Datum</Label>
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Bedrag (€)</Label>
              <Input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Omschrijving</Label>
            <Input
              id="expense-description"
              placeholder="bv. Boodschappen dinsdag"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-payer">Betaald door</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id="expense-payer">
                  <SelectValue placeholder="Kies huishouden" />
                </SelectTrigger>
                <SelectContent>
                  {households.map((household) => (
                    <SelectItem key={household.id} value={household.id}>
                      {household.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-split">Verdelen</Label>
              <Select
                value={splitMode}
                onValueChange={(value) => setSplitMode(value as SplitMode)}
              >
                <SelectTrigger id="expense-split">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPLIT_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {SPLIT_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{SPLIT_MODE_HINTS[splitMode]}</p>

          <fieldset className="space-y-2">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium">Wie deelt mee</legend>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setParticipants(allSelected ? [] : households.map((h) => h.id))}
              >
                {allSelected ? 'Niemand' : 'Iedereen'}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {households.map((household) => (
                <label
                  key={household.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                >
                  <Checkbox
                    checked={participants.includes(household.id)}
                    onCheckedChange={(checked) =>
                      toggleParticipant(household.id, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{household.name}</span>
                  <span className="text-xs text-muted-foreground">{household.size}p</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {editing ? 'Wijziging opslaan' : 'Uitgave toevoegen'}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={onCancelEdit}>
                Annuleren
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
