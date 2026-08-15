#!/usr/bin/env bash
#
# Zet de gedeelde opslag van de Vakantiekas op via de Supabase Management API:
# kiest of maakt een project, voert supabase/schema.sql uit en schrijft .env.
#
# Gebruik:
#   ./scripts/setup-supabase.sh
#
# Je hebt een Supabase access token nodig (eenmalig aan te maken op
# https://supabase.com/dashboard/account/tokens). Het script vraagt erom, of
# leest het uit de omgevingsvariabele SUPABASE_ACCESS_TOKEN. Het token wordt
# nergens weggeschreven of getoond.
#
# Het script verwijdert of overschrijft nooit iets in een bestaand project,
# behalve de twee tabellen van deze app als die er al staan (create if not
# exists laat bestaande data met rust).

set -euo pipefail

# SUPABASE_API is er om het script tegen een nagebootste API te kunnen draaien.
API="${SUPABASE_API:-https://api.supabase.com/v1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="$ROOT/supabase/schema.sql"
ENV_FILE="$ROOT/.env"

kleur() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
info() { kleur '0;36' "→ $1"; }
goed() { kleur '0;32' "✓ $1"; }
fout() {
  kleur '0;31' "✗ $1" >&2
  exit 1
}

for tool in curl jq; do
  command -v "$tool" >/dev/null 2>&1 || fout "$tool is niet geïnstalleerd."
done
[ -f "$SCHEMA" ] || fout "supabase/schema.sql niet gevonden op $SCHEMA"

# ---------------------------------------------------------------- token ----

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "Maak een access token op https://supabase.com/dashboard/account/tokens"
  read -rsp "Supabase access token: " TOKEN
  echo
fi
[ -n "$TOKEN" ] || fout "Geen token opgegeven."

# Roept de API aan en faalt met de foutmelding van Supabase zelf.
api() {
  local method="$1" path="$2" body="${3:-}"
  local response status
  if [ -n "$body" ]; then
    response=$(curl -sS -w '\n%{http_code}' -X "$method" "$API$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body" 2>&1) || fout "Kan ${API} niet bereiken: $response"
  else
    response=$(curl -sS -w '\n%{http_code}' -X "$method" "$API$path" \
      -H "Authorization: Bearer $TOKEN" 2>&1) || fout "Kan ${API} niet bereiken: $response"
  fi
  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  # Bij een netwerkfout schrijft curl tekst in plaats van een statuscode.
  case "$status" in
  [0-9][0-9][0-9]) ;;
  *) fout "Onverwacht antwoord van ${API}: $(printf '%s' "$response" | head -c 200)" ;;
  esac

  if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
    fout "API $method $path gaf $status: $(printf '%s' "$body" | head -c 400)"
  fi
  printf '%s' "$body"
}

info "Token controleren…"
ORGS=$(api GET /organizations)
[ "$(printf '%s' "$ORGS" | jq 'length')" -gt 0 ] ||
  fout "Geen organisaties op dit account gevonden."
goed "Verbonden met Supabase."

# -------------------------------------------------------------- project ----

PROJECTS=$(api GET /projects)

echo
echo "Bestaande projecten:"
printf '%s' "$PROJECTS" | jq -r 'to_entries[] | "  [\(.key + 1)] \(.value.name)  (\(.value.id), \(.value.region))"'
echo "  [n] Nieuw project aanmaken"
echo
read -rp "Keuze: " KEUZE

if [ "$KEUZE" = "n" ] || [ "$KEUZE" = "N" ]; then
  read -rp "Projectnaam [vakantiekas]: " NAAM
  NAAM="${NAAM:-vakantiekas}"

  echo
  echo "Organisaties:"
  printf '%s' "$ORGS" | jq -r 'to_entries[] | "  [\(.key + 1)] \(.value.name)"'
  read -rp "Keuze [1]: " ORG_KEUZE
  ORG_KEUZE="${ORG_KEUZE:-1}"
  ORG_ID=$(printf '%s' "$ORGS" | jq -r ".[$((ORG_KEUZE - 1))].id")
  [ "$ORG_ID" != "null" ] || fout "Ongeldige keuze."

  read -rp "Regio [eu-central-1]: " REGIO
  REGIO="${REGIO:-eu-central-1}"

  # Een sterk databasewachtwoord dat je zelf niet hoeft te verzinnen. Je hebt
  # het alleen nodig voor directe databaseverbindingen; de app gebruikt het niet.
  # De bron is bewust eindig: 'tr </dev/urandom | head' krijgt een SIGPIPE zodra
  # head genoeg heeft, en dat sloopt met pipefail het hele script.
  DB_PASS=$(head -c 4096 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-32)
  [ ${#DB_PASS} -eq 32 ] || fout "Kon geen databasewachtwoord genereren."

  info "Project '$NAAM' aanmaken in $REGIO…"
  CREATED=$(api POST /projects "$(jq -n \
    --arg name "$NAAM" --arg org "$ORG_ID" --arg region "$REGIO" --arg pass "$DB_PASS" \
    '{name: $name, organization_id: $org, region: $region, db_pass: $pass}')")
  REF=$(printf '%s' "$CREATED" | jq -r '.id')
  [ "$REF" != "null" ] || fout "Kon geen project-id uit het antwoord halen."

  echo
  kleur '1;33' "Databasewachtwoord (bewaar dit, het is nergens anders op te vragen):"
  echo "  $DB_PASS"
  echo

  info "Wachten tot het project draait, dit duurt meestal een minuut of twee…"
  for _ in $(seq 1 60); do
    STATUS=$(api GET "/projects/$REF" | jq -r '.status')
    [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
    printf '  status: %s\r' "$STATUS"
    sleep 10
  done
  [ "$STATUS" = "ACTIVE_HEALTHY" ] ||
    fout "Project is na tien minuten nog niet actief (status: $STATUS). Probeer het script straks opnieuw en kies dit project uit de lijst."
  goed "Project draait."
else
  REF=$(printf '%s' "$PROJECTS" | jq -r ".[$((KEUZE - 1))].id")
  [ "$REF" != "null" ] && [ -n "$REF" ] || fout "Ongeldige keuze."
  goed "Project $REF gekozen."
fi

# ---------------------------------------------------------------- schema ----

info "Schema uitvoeren…"
api POST "/projects/$REF/database/query" \
  "$(jq -n --rawfile q "$SCHEMA" '{query: $q}')" >/dev/null
goed "Tabellen, policies en realtime staan klaar."

# ------------------------------------------------------------------ keys ----

info "Anon-sleutel ophalen…"
KEYS=$(api GET "/projects/$REF/api-keys?reveal=true")
ANON=$(printf '%s' "$KEYS" | jq -r '[.[] | select(.name == "anon")][0].api_key // empty')
[ -n "$ANON" ] || fout "Geen anon-sleutel gevonden in het antwoord."

# Een echte sleutel is een JWT (eyJ…) of het nieuwere sb_publishable_-formaat.
# Krijgt de API-versie het niet onthuld, dan komt er iets gemaskeerds terug en
# is een .env met die waarde erger dan geen .env.
case "$ANON" in
eyJ* | sb_*) ;;
*)
  fout "De opgehaalde sleutel ziet er gemaskeerd uit ('$(printf '%.12s' "$ANON")…').
  Haal de anon-sleutel op via Project Settings → API Keys en zet hem zelf in .env:
    VITE_SUPABASE_URL=https://$REF.supabase.co
    VITE_SUPABASE_ANON_KEY=<sleutel>
    VITE_TRIP_ID=vakantie"
  ;;
esac

URL="https://$REF.supabase.co"

# ------------------------------------------------------------------- env ----

if [ -f "$ENV_FILE" ]; then
  BACKUP="$ENV_FILE.backup-$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "$BACKUP"
  info "Bestaande .env bewaard als $(basename "$BACKUP")"
fi

cat >"$ENV_FILE" <<EOF
VITE_SUPABASE_URL=$URL
VITE_SUPABASE_ANON_KEY=$ANON
VITE_TRIP_ID=vakantie
EOF

goed ".env geschreven."
echo
kleur '1;32' "Klaar. Start de app met: npm run dev"
echo
echo "De statusregel rechtsboven hoort nu 'Gedeeld met iedereen' te tonen."
echo "Publiceer de gebouwde site en deel de link met de anderen; iedereen die"
echo "de link heeft, kan uitgaven invoeren en aanpassen."
