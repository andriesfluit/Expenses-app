import { useEffect, useState } from 'react';
import { Check, ChevronDown, Users2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { centsToInput, formatDateShort, parseAmountToCents, todayIso } from '@/lib/money';
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

type VeldNaam = 'amount' | 'description' | 'paidBy' | 'participants';
type Fouten = Partial<Record<VeldNaam, string>>;

const VELD_LABELS: Record<VeldNaam, string> = {
  amount: 'bedrag',
  description: 'waarvoor',
  paidBy: 'betaald door',
  participants: 'wie deelt mee',
};

const VELD_IDS: Record<VeldNaam, string> = {
  amount: 'expense-amount',
  description: 'expense-description',
  paidBy: 'expense-payer',
  participants: 'expense-split',
};

/** "bedrag, waarvoor en betaald door" — leest prettiger dan een kale lijst. */
function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen[0] ?? '';
  return `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`;
}

/** Koppelt een veld aan de melding eronder, voor screenreaders. */
function foutProps(fout: string | undefined, id: string) {
  return fout ? { 'aria-invalid': true, 'aria-describedby': `${id}-fout` } : {};
}

const FOUT_RAND = 'border-destructive focus-visible:ring-destructive';

export const ExpenseForm = ({ households, editing, onSubmit, onCancelEdit }: Props) => {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('per-person');
  const [participants, setParticipants] = useState<string[]>([]);
  // De verdeling is bijna altijd "per persoon, iedereen". Ingeklapt houdt het
  // formulier kort genoeg om op een telefoon in beeld te passen.
  const [verdelingOpen, setVerdelingOpen] = useState(false);
  const [fouten, setFouten] = useState<Fouten>({});

  /** Een veld dat je aanpast, is geen klacht meer waard. */
  const wisFout = (veld: VeldNaam) =>
    setFouten((huidig) => {
      if (!huidig[veld]) return huidig;
      const rest = { ...huidig };
      delete rest[veld];
      return rest;
    });

  const alleIds = households.map((h) => h.id);

  const resetToNew = () => {
    setDate(todayIso());
    setAmount('');
    setDescription('');
    setPaidBy('');
    setSplitMode('per-person');
    setParticipants(alleIds);
    setVerdelingOpen(false);
    setFouten({});
  };

  useEffect(() => {
    if (editing) {
      setDate(editing.date);
      setAmount(centsToInput(editing.amountCents));
      setDescription(editing.description);
      setPaidBy(editing.paidBy);
      setSplitMode(editing.splitMode);
      setParticipants(editing.participants);
      // Wijkt de verdeling af van de standaard, dan hoort ze zichtbaar te zijn.
      setVerdelingOpen(
        editing.splitMode !== 'per-person' ||
          editing.participants.length !== households.length ||
          editing.date !== todayIso(),
      );
    } else {
      setParticipants(households.map((h) => h.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, households.length]);

  const toggleParticipant = (id: string, checked: boolean) => {
    setParticipants((current) => (checked ? [...current, id] : current.filter((p) => p !== id)));
  };

  const iedereenDoetMee = households.length > 0 && participants.length === households.length;

  // De uitklap verbergt datum, sleutel en deelnemers. Alles wat afwijkt van de
  // standaard hoort in deze regel te staan, anders verstop je een verrassing.
  // Een datum van vandaag is geen afwijking en kost alleen maar breedte.
  const samenvatting = [
    date === todayIso() ? null : formatDateShort(date),
    SPLIT_MODE_LABELS[splitMode].toLowerCase(),
    iedereenDoetMee ? 'iedereen' : `${participants.length} van ${households.length}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amountCents = parseAmountToCents(amount);
    const trimmedDescription = description.trim();

    // Alles in één keer nakijken. Fout voor fout melden laat je drie keer op
    // dezelfde knop drukken voordat je weet wat er nog mist.
    const nieuweFouten: Fouten = {};
    if (!amount.trim()) {
      nieuweFouten.amount = 'Vul een bedrag in';
    } else if (amountCents === null) {
      nieuweFouten.amount = 'Geen geldig bedrag — groter dan nul, hoogstens twee decimalen';
    }
    if (!trimmedDescription) nieuweFouten.description = 'Vul in waarvoor het was';
    if (!paidBy) nieuweFouten.paidBy = 'Kies wie betaald heeft';
    if (participants.length === 0) nieuweFouten.participants = 'Kies minstens één huishouden';

    setFouten(nieuweFouten);

    const ontbrekend = (Object.keys(nieuweFouten) as VeldNaam[]).filter(
      (veld) => veld !== 'participants',
    );
    if (Object.keys(nieuweFouten).length > 0) {
      if (nieuweFouten.participants) setVerdelingOpen(true);
      toast.error(
        ontbrekend.length > 0
          ? `Nog invullen: ${opsomming(ontbrekend.map((veld) => VELD_LABELS[veld]))}`
          : nieuweFouten.participants!,
      );
      // Naar het eerste probleem springen, zodat je niet hoeft te zoeken.
      const eerste = (Object.keys(nieuweFouten) as VeldNaam[])[0];
      document.getElementById(VELD_IDS[eerste])?.focus();
      return;
    }

    // Hierboven al afgevangen; deze regel maakt dat aan het type duidelijk in
    // plaats van de controle met een uitroepteken te omzeilen.
    if (amountCents === null) return;

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
      if (editing) onCancelEdit();
      else resetToNew();
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
            Voeg eerst de huishoudens toe die meereizen, onderaan deze pagina. Zonder deelnemers
            valt er niets te verdelen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {editing ? 'Uitgave bewerken' : 'Uitgave toevoegen'}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Het bedrag is waarvoor je de app opent, dus dat krijgt de volle
              breedte. De datum staat bijna altijd op vandaag en zit daarom in
              de uitklap hieronder. */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Bedrag</Label>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted-foreground"
                aria-hidden="true"
              >
                €
              </span>
              <Input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  wisFout('amount');
                }}
                className={cn('h-14 pl-9 text-xl font-medium tabular-nums', fouten.amount && FOUT_RAND)}
                autoComplete="off"
                {...foutProps(fouten.amount, 'expense-amount')}
              />
            </div>
            {fouten.amount && (
              <p id="expense-amount-fout" className="text-sm text-destructive">
                {fouten.amount}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Waarvoor</Label>
            <Input
              id="expense-description"
              placeholder="bv. Boodschappen Spar"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                wisFout('description');
              }}
              className={cn('h-11', fouten.description && FOUT_RAND)}
              autoComplete="off"
              {...foutProps(fouten.description, 'expense-description')}
            />
            {fouten.description && (
              <p id="expense-description-fout" className="text-sm text-destructive">
                {fouten.description}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-payer">Betaald door</Label>
            <Select
              value={paidBy}
              onValueChange={(waarde) => {
                setPaidBy(waarde);
                wisFout('paidBy');
              }}
            >
              <SelectTrigger
                id="expense-payer"
                className={cn('h-11', fouten.paidBy && FOUT_RAND)}
                {...foutProps(fouten.paidBy, 'expense-payer')}
              >
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
            {fouten.paidBy && (
              <p id="expense-payer-fout" className="text-sm text-destructive">
                {fouten.paidBy}
              </p>
            )}
          </div>

          {/* Ingeklapt tot een leesbare regel; openklappen alleen als het afwijkt. */}
          <div className={cn('rounded-lg border bg-muted/30', fouten.participants && FOUT_RAND)}>
            <button
              type="button"
              onClick={() => setVerdelingOpen((open) => !open)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
              aria-expanded={verdelingOpen}
            >
              <Users2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{samenvatting}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  verdelingOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {verdelingOpen && (
              <div className="space-y-3 border-t px-3 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="expense-date">Datum</Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expense-split">Sleutel</Label>
                  <Select
                    value={splitMode}
                    onValueChange={(value) => setSplitMode(value as SplitMode)}
                  >
                    <SelectTrigger id="expense-split" className="bg-background">
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
                  <p className="text-xs text-muted-foreground">{SPLIT_MODE_HINTS[splitMode]}</p>
                </div>

                <fieldset className="space-y-2">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-medium">Wie deelt mee</legend>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setParticipants(iedereenDoetMee ? [] : alleIds)}
                    >
                      {iedereenDoetMee ? 'Niemand' : 'Iedereen'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {households.map((household) => (
                      <label
                        key={household.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border bg-background p-2 text-sm"
                      >
                        <Checkbox
                          checked={participants.includes(household.id)}
                          onCheckedChange={(checked) => {
                            toggleParticipant(household.id, checked === true);
                            wisFout('participants');
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{household.name}</span>
                        <span className="text-xs text-muted-foreground">{household.size}p</span>
                      </label>
                    ))}
                  </div>
                  {fouten.participants && (
                    <p className="text-sm text-destructive">{fouten.participants}</p>
                  )}
                </fieldset>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="lg" className="flex-1">
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {editing ? 'Wijziging opslaan' : 'Toevoegen'}
            </Button>
            {editing && (
              <Button type="button" variant="outline" size="lg" onClick={onCancelEdit}>
                Annuleren
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
