import { ArrowRight, Scale, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/money';
import type { Balance, Transfer } from '@/lib/settle';
import type { Household } from '@/types';

type Props = {
  balances: Balance[];
  transfers: Transfer[];
  households: Household[];
  totalCents: number;
};

/**
 * Diverging paar uit de gevalideerde standaardpalet: blauw tegenover rood, met
 * grijs op nul. De richting van de balk draagt de betekenis, de kleur bevestigt
 * ze alleen — zo blijft de grafiek leesbaar zonder kleurwaarneming.
 */
const POSITIVE = '#2a78d6';
const NEGATIVE = '#e34948';
const NEUTRAL = '#a3a3a3';

/**
 * Naam en bedrag op één regel, de balk daaronder over de volle breedte. Zo
 * houdt de balk ook op een telefoonscherm genoeg ruimte om iets te zeggen.
 */
const BalanceBar = ({ balance, maxAbsCents }: { balance: Balance; maxAbsCents: number }) => {
  const share = maxAbsCents === 0 ? 0 : Math.abs(balance.netCents) / maxAbsCents;
  // Halve breedte per arm, zodat nul precies in het midden van de baan ligt.
  const width = `${share * 50}%`;
  const positive = balance.netCents > 0;
  const zero = balance.netCents === 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium" title={balance.name}>
          {balance.name}
        </span>
        <span
          className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums"
          style={{ color: zero ? NEUTRAL : positive ? POSITIVE : NEGATIVE }}
        >
          {positive ? '+' : ''}
          {formatCents(balance.netCents)}
        </span>
      </div>

      <div className="relative h-2.5">
        {/* Nullijn: het ijkpunt waar de balken vanaf groeien. */}
        <div
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
          aria-hidden="true"
        />
        {!zero && (
          <div
            className="absolute inset-y-0"
            style={{
              width,
              backgroundColor: positive ? POSITIVE : NEGATIVE,
              left: positive ? '50%' : undefined,
              right: positive ? undefined : '50%',
              // Alleen het data-eind is afgerond; de kant aan de nullijn blijft vlak.
              borderRadius: positive ? '0 4px 4px 0' : '4px 0 0 4px',
            }}
          />
        )}
      </div>
    </div>
  );
};

export const BalanceSummary = ({ balances, transfers, households, totalCents }: Props) => {
  const nameOf = (id: string) => households.find((h) => h.id === id)?.name ?? 'Onbekend huishouden';

  const hasData = balances.length > 0 && totalCents > 0;
  const maxAbsCents = Math.max(0, ...balances.map((b) => Math.abs(b.netCents)));
  const sorted = [...balances].sort((a, b) => b.netCents - a.netCents);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" aria-hidden="true" />
            Afrekenen
          </CardTitle>
          <CardDescription>
            {transfers.length === 0
              ? 'Iedereen staat gelijk.'
              : `${transfers.length} ${transfers.length === 1 ? 'overschrijving' : 'overschrijvingen'} en het is rond`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasData
                ? 'Alle huishoudens hebben precies hun aandeel betaald.'
                : 'Voeg uitgaven toe om te zien wie wie moet terugbetalen.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {transfers.map((transfer, index) => (
                <li
                  key={`${transfer.fromId}-${transfer.toId}-${index}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm"
                >
                  <span className="font-medium">{nameOf(transfer.fromId)}</span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-label="betaalt aan"
                  />
                  <span className="font-medium">{nameOf(transfer.toId)}</span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {formatCents(transfer.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5" aria-hidden="true" />
            Saldo per huishouden
          </CardTitle>
          <CardDescription>
            {hasData ? `${formatCents(totalCents)} aan uitgaven verdeeld` : 'Nog niets te verdelen.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!hasData ? (
            <p className="text-sm text-muted-foreground">
              Zodra er uitgaven zijn, zie je hier wie te veel en wie te weinig heeft betaald.
            </p>
          ) : (
            <div className="space-y-3">
              {/* De as vervangt een legende: richting is hier de betekenis. */}
              <div className="flex justify-between whitespace-nowrap text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>← moet betalen</span>
                <span>krijgt terug →</span>
              </div>

              {sorted.map((balance) => (
                <BalanceBar key={balance.householdId} balance={balance} maxAbsCents={maxAbsCents} />
              ))}

              <details className="pt-1">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Voorgeschoten en aandeel per huishouden
                </summary>
                <table className="mt-2 w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Huishouden</th>
                      <th className="py-1 text-right font-medium">Voorgeschoten</th>
                      <th className="py-1 text-right font-medium">Aandeel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((balance) => (
                      <tr key={balance.householdId} className="border-t">
                        <td className="py-1">{balance.name}</td>
                        <td className="py-1 text-right tabular-nums">{formatCents(balance.paidCents)}</td>
                        <td className="py-1 text-right tabular-nums">{formatCents(balance.owedCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
