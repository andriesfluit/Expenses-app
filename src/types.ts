/** Hoe de kosten van één uitgave over de deelnemers worden verdeeld. */
export type SplitMode = 'per-person' | 'per-household';

/** Eén partij die meereist. Grootte telt elk gezinslid even zwaar. */
export type Household = {
  id: string;
  name: string;
  /** Aantal personen, kinderen inbegrepen en even zwaar meegeteld. */
  size: number;
};

export type Expense = {
  id: string;
  /** ISO-datum, YYYY-MM-DD. */
  date: string;
  description: string;
  /** Bedrag in eurocent, altijd een positief geheel getal. */
  amountCents: number;
  /** Id van het huishouden dat voorschoot. */
  paidBy: string;
  splitMode: SplitMode;
  /** Ids van de huishoudens die meedelen. Mag de betaler uitsluiten. */
  participants: string[];
};

export type TripData = {
  households: Household[];
  expenses: Expense[];
};

export const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  'per-person': 'Per persoon',
  'per-household': 'Per huishouden',
};

export const SPLIT_MODE_HINTS: Record<SplitMode, string> = {
  'per-person': 'Naar aantal personen — een gezin van 5 betaalt vijf keer zoveel als wie alleen komt.',
  'per-household': 'Gelijk per huishouden, ongeacht gezinsgrootte.',
};
