# Vakantiekas

Uitgaven van een groepsvakantie verdelen over meerdere huishoudens en aan het
eind afrekenen in zo min mogelijk overschrijvingen.

Gebouwd voor een reis met vijf huishoudens van uiteenlopende grootte, waar
"gewoon door vijf delen" niet klopt omdat een gezin van vijf nu eenmaal meer
boodschappen opmaakt dan wie alleen komt.

## Wat het doet

- **Huishoudens** met een naam en een aantal personen. Elk gezinslid telt even
  zwaar mee, kinderen inbegrepen.
- **Uitgaven** met een eigen verdeelsleutel:
  - *Per persoon* — naar hoofdtelling, dus een gezin van 5 draagt vijf keer
    zoveel als wie alleen komt. Voor boodschappen, huur, eten.
  - *Per huishouden* — gelijke delen, ongeacht gezinsgrootte.
- **Deelnemers per uitgave**: standaard doet iedereen mee, maar je kunt een
  uitgave beperken tot de huishoudens die er echt bij waren. Wie betaalde hoeft
  zelf niet mee te delen.
- **Saldo per huishouden**: voorgeschoten min het eigen aandeel.
- **Afrekening**: wie moet wie betalen, in zo weinig mogelijk overschrijvingen.
  Bij vijf huishoudens scheelt dat doorgaans vier betalingen in plaats van
  twintig.

Bedragen worden overal als geheel aantal eurocent bijgehouden en met de
largest-remainder-methode verdeeld, zodat de som van de delen exact het
uitgegeven bedrag is — er verdwijnt of ontstaat nooit een cent.

## Draaien

```sh
npm install
npm run dev
```

Zonder verdere configuratie bewaart de app alles in de browser van dat ene
toestel. Genoeg om te proberen, maar de anderen zien er niets van.

## Delen met de hele reis

Om iedereen op zijn eigen telefoon te laten invoeren, is een Supabase-project
nodig. Dat kan met één commando:

```sh
./scripts/setup-supabase.sh
```

Het script vraagt om een access token (eenmalig aan te maken op
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)),
laat je een bestaand project kiezen of een nieuw aanmaken, voert het schema uit
en schrijft `.env`. Het token wordt nergens bewaard.

Liever met de hand:

1. Maak een gratis project op [supabase.com](https://supabase.com).
2. Voer `supabase/schema.sql` uit in de SQL Editor van dat project. Het bestand
   is idempotent, je mag het opnieuw draaien.
3. Kopieer `.env.example` naar `.env` en vul de projecturl en de anon-sleutel in
   (Project Settings → API).
4. `npm run dev`, of publiceer de gebouwde site.

De app schakelt vanzelf over zodra die twee variabelen gezet zijn; de statusregel
rechtsboven laat zien welke opslag actief is. Wijzigingen van andere toestellen
komen live binnen.

**Over de beveiliging**: de anon-sleutel staat in de gebouwde JavaScript en is
dus niet geheim. Met de standaardpolicies uit `schema.sql` kan iedereen die de
URL van de app kent alle uitgaven lezen en aanpassen. Voor een familievakantie is
dat meestal de juiste afweging; wil je het strakker, zet dan Supabase Auth aan en
scherp de policies aan.

## Publiceren

De app hoort niet alleen op één laptop te draaien: de anderen kunnen pas
meedoen als er een adres is dat iedereen kan openen. `.github/workflows/deploy.yml`
bouwt bij elke push naar `main` en publiceert naar GitHub Pages.

Eenmalig instellen:

1. **Settings → Secrets and variables → Actions → New repository secret**, twee keer:
   - `VITE_SUPABASE_URL` → `https://<projectref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → de anon/publishable key
2. **Settings → Pages → Source: GitHub Actions**

De workflow weigert te publiceren als een van die secrets ontbreekt. Dat is
opzet: zonder die twee zou de app prima bouwen en op ieders telefoon werken,
maar zou iedereen zijn eigen uitgaven in zijn eigen browser bijhouden zonder
het te merken. Na de build controleert de workflow nog eens of de project-URL
echt in de bundle staat.

Een andere reis dan de standaard krijg je met een repository *variable*
`VITE_TRIP_ID` (Settings → Secrets and variables → Actions → Variables).

## Ontwikkelen

```sh
npm run check-env  # controleert .env voordat je de app start
npm run check      # typecheck + lint + tests
npm run typecheck
npm run lint
npm test
```

Gebruik na een `git pull` bij voorkeur `npm ci` in plaats van `npm install`:
`ci` installeert exact volgens `package-lock.json` en laat dat bestand met rust,
terwijl `install` het kan herschrijven en de volgende pull dan blokkeert met
"Your local changes would be overwritten". Is dat al gebeurd, dan haalt
`git checkout -- package-lock.json` de lokale wijziging weg; het bestand is
gegenereerd, dus daar gaat niets verloren.

Werkt de verbinding met Supabase niet, begin dan bij `npm run check-env`. Dat
noemt de oorzaak — een gemaskeerde sleutel, een afgekapte JWT, de verkeerde
rol, een ander project — in plaats van het kale "Invalid API key".

### Als de sleutel niet in één keer schoon te plakken is

Een anon key is ruim 200 tekens op één regel. Sommige terminals en chatvensters
verminken zoiets: er verdwijnen tekens, of er komen bulletjes voor in de plaats.
Plak hem dan in stukken en laat de shell hem samenstellen:

```sh
A=<eerste stuk>
B=<tweede stuk>
C=<derde stuk>
printf 'VITE_SUPABASE_URL=https://<ref>.supabase.co\nVITE_SUPABASE_ANON_KEY=%s\nVITE_TRIP_ID=vakantie\n' "$A$B$C" > .env
npm run check-env
```

`check-env` controleert daarna de lengte, de vaste JWT-header en de
handtekening, dus een verminkte sleutel valt meteen door de mand in plaats van
pas bij het eerste verzoek aan Supabase.

De rekenkern staat los van de UI en is getest:

- `src/lib/split.ts` — verdeling van één uitgave over de deelnemers
- `src/lib/settle.ts` — saldi en het afrekenplan
- `src/lib/money.ts` — parsen, afronden en tonen van bedragen

## Stack

Vite · React · TypeScript · Tailwind · shadcn/ui · Supabase (optioneel)
