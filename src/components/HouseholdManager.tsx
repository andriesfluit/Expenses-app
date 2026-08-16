import { useState } from 'react';
import { Minus, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Expense, Household } from '@/types';

type Props = {
  households: Household[];
  expenses: Expense[];
  onAdd: (household: Household) => Promise<boolean>;
  onUpdate: (household: Household) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
};

export const HouseholdManager = ({ households, expenses, onAdd, onUpdate, onRemove }: Props) => {
  const [name, setName] = useState('');
  const [size, setSize] = useState('2');

  const totalPeople = households.reduce((sum, h) => sum + h.size, 0);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const parsedSize = Number(size);

    if (!trimmed) {
      toast.error('Geef het huishouden een naam');
      return;
    }
    if (!Number.isInteger(parsedSize) || parsedSize < 1) {
      toast.error('Een huishouden telt minstens één persoon');
      return;
    }
    if (households.some((h) => h.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" bestaat al`);
      return;
    }

    if (await onAdd({ id: crypto.randomUUID(), name: trimmed, size: parsedSize })) {
      setName('');
      setSize('2');
      toast.success(`${trimmed} toegevoegd`);
    }
  };

  const handleResize = (household: Household, delta: number) => {
    const next = household.size + delta;
    if (next < 1) return;
    void onUpdate({ ...household, size: next });
  };

  const handleRemove = async (household: Household) => {
    // Een huishouden uit de reis halen terwijl er nog uitgaven aan hangen zou
    // de afrekening stilzwijgend laten kloppen op verkeerde bedragen.
    const involved = expenses.filter(
      (e) => e.paidBy === household.id || e.participants.includes(household.id),
    ).length;

    if (involved > 0) {
      toast.error(
        `${household.name} zit nog in ${involved} ${involved === 1 ? 'uitgave' : 'uitgaven'}. Verwijder of pas die eerst aan.`,
      );
      return;
    }
    if (await onRemove(household.id)) {
      toast.success(`${household.name} verwijderd`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" aria-hidden="true" />
          Wie reist mee
        </CardTitle>
        <CardDescription>
          {households.length === 0
            ? 'Voeg eerst de huishoudens toe die de kosten delen.'
            : `${households.length} ${households.length === 1 ? 'huishouden' : 'huishoudens'}, ${totalPeople} ${totalPeople === 1 ? 'persoon' : 'personen'}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* De naam krijgt op smalle schermen een eigen regel, anders knijpen de
            stepper en de prullenbak hem tot "Ge…". */}
        {households.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {households.map((household) => (
              <li key={household.id} className="flex flex-wrap items-center gap-2 p-3 sm:gap-3">
                <span
                  className="w-full min-w-0 truncate font-medium sm:w-auto sm:flex-1"
                  title={household.name}
                >
                  {household.name}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleResize(household, -1)}
                    disabled={household.size <= 1}
                    aria-label={`Eén persoon minder bij ${household.name}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-14 text-center text-sm tabular-nums text-muted-foreground">
                    {household.size} {household.size === 1 ? 'pers.' : 'pers.'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleResize(household, 1)}
                    aria-label={`Eén persoon meer bij ${household.name}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive sm:ml-0"
                  onClick={() => void handleRemove(household)}
                  aria-label={`${household.name} verwijderen`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1 space-y-1.5">
            <Label htmlFor="household-name">Naam</Label>
            <Input
              id="household-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="bv. Familie Janssens"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="household-size">Personen</Label>
            <Input
              id="household-size"
              type="number"
              min={1}
              step={1}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            <Plus className="mr-1 h-4 w-4" />
            Toevoegen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
