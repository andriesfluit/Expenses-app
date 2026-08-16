#!/usr/bin/env node
/**
 * Controleert .env voordat je de app start. "Invalid API key" van Supabase
 * zegt niet wát er mis is; dit script wel. Toont nooit de sleutel zelf.
 *
 * Gebruik: npm run check-env
 */
import { readFileSync, existsSync } from 'fs';

const ROOT = new URL('..', import.meta.url).pathname;
const ENV = `${ROOT}.env`;

const rood = (s) => `\x1b[0;31m✗ ${s}\x1b[0m`;
const groen = (s) => `\x1b[0;32m✓ ${s}\x1b[0m`;
const grijs = (s) => `\x1b[0;90m  ${s}\x1b[0m`;

if (!existsSync(ENV)) {
  console.log(rood('Er is geen .env-bestand.'));
  console.log(grijs('Kopieer .env.example naar .env en vul de waarden in.'));
  process.exit(1);
}

const regels = readFileSync(ENV, 'utf8').split('\n');
const lees = (naam) => {
  const regel = regels.find((r) => r.trimStart().startsWith(`${naam}=`));
  return regel ? regel.slice(regel.indexOf('=') + 1).trim() : undefined;
};

const url = lees('VITE_SUPABASE_URL');
const sleutel = lees('VITE_SUPABASE_ANON_KEY');
let fouten = 0;
const faal = (bericht, hint) => {
  console.log(rood(bericht));
  if (hint) console.log(grijs(hint));
  fouten++;
};

// ---- URL ----------------------------------------------------------------

if (!url) {
  faal('VITE_SUPABASE_URL ontbreekt.');
} else if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  faal(
    `VITE_SUPABASE_URL ziet er niet uit als een Supabase-URL: ${url}`,
    'Verwacht: https://<projectref>.supabase.co, zonder schuine streep aan het eind.',
  );
} else {
  console.log(groen(`URL in orde: ${url}`));
}

// ---- Sleutel ------------------------------------------------------------

if (!sleutel) {
  faal('VITE_SUPABASE_ANON_KEY ontbreekt.');
} else if (/[•∙▪●*]/.test(sleutel)) {
  // Waar de bulletjes staan verraadt de oorzaak: aaneengesloten in het midden
  // wijst op een gemaskeerd veld, verspreid op een kopieerprobleem.
  const posities = [...sleutel]
    .map((t, i) => (/[•∙▪●*]/.test(t) ? i + 1 : null))
    .filter((i) => i !== null);
  const reeks =
    posities.length > 1 && posities[posities.length - 1] - posities[0] === posities.length - 1
      ? `${posities[0]} tot en met ${posities[posities.length - 1]}`
      : posities.join(', ');

  faal(
    `De sleutel bevat ${posities.length} bulletje(s) of sterretje(s), op positie ${reeks} van ${sleutel.length}.`,
    'Dit is de verborgen weergave, niet de sleutel zelf. Klik in Supabase op Reveal ' +
      'en kopieer dan pas. Lukt kopieren niet in een keer, plak de sleutel dan in ' +
      'korte stukken (zie README).',
  );
} else {
  const raar = [...sleutel].filter((t) => {
    const c = t.codePointAt(0);
    return c < 0x20 || c > 0x7e;
  });

  if (raar.length) {
    const codes = [...new Set(raar.map((t) => 'U+' + t.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')))];
    faal(
      `De sleutel bevat ${raar.length} teken(s) die niet in een HTTP-header passen: ${codes.join(', ')}`,
      'Kopieer de sleutel opnieuw uit Supabase.',
    );
  } else {
    const delen = sleutel.split('.');

    // Het nieuwere formaat is geen JWT en kent deze structuurcontroles niet.
    if (sleutel.startsWith('sb_publishable_')) {
      console.log(groen(`Sleutel in orde: publishable key, ${sleutel.length} tekens`));
    } else if (sleutel.startsWith('sb_secret_')) {
      faal(
        'Dit is een secret key, geen publishable key.',
        'Secret keys horen NOOIT in een frontend. Pak de publishable key.',
      );
    } else if (delen.length !== 3) {
      faal(
        `De sleutel heeft ${delen.length} deel(en) in plaats van 3.`,
        'Een JWT bestaat uit drie stukken gescheiden door punten. Waarschijnlijk is er iets afgekapt.',
      );
    } else if (delen[0] !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') {
      // Het eerste deel van een Supabase-JWT is altijd exact deze tekst; wijkt
      // hij af, dan is er tijdens het kopieren iets uitgevallen. Zonder deze
      // controle glipt een sleutel waar een paar tekens uit weg zijn er
      // doorheen als "geldig", en krijg je later alleen "Invalid API key".
      faal(
        'Het eerste deel van de sleutel klopt niet.',
        `Verwacht "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", gevonden "${delen[0].slice(0, 40)}". ` +
          'Er is bij het kopieren iets weggevallen; haal de sleutel opnieuw op.',
      );
    } else if (delen[2].length !== 43) {
      faal(
        `De handtekening is ${delen[2].length} tekens in plaats van 43.`,
        'De sleutel is onvolledig of beschadigd gekopieerd.',
      );
    } else {
      try {
        const payload = JSON.parse(Buffer.from(delen[1], 'base64').toString());
        if (payload.role !== 'anon') {
          faal(
            `Dit is een sleutel met rol "${payload.role}", niet "anon".`,
            payload.role === 'service_role'
              ? 'De service_role-sleutel hoort NOOIT in een frontend. Pak de anon/publishable key.'
              : 'Pak de anon/publishable key uit Project Settings.',
          );
        } else {
          console.log(groen(`Sleutel in orde: ${sleutel.length} tekens, rol "anon", project "${payload.ref}"`));
          if (url && !url.includes(payload.ref)) {
            faal(
              `De sleutel hoort bij project "${payload.ref}" maar de URL wijst naar een ander project.`,
              'Haal URL en sleutel uit hetzelfde project.',
            );
          }
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            faal('De sleutel is verlopen.', 'Maak een nieuwe aan in Supabase.');
          }
        }
      } catch {
        faal(
          'Het middenstuk van de sleutel is geen leesbare JWT-payload.',
          'De sleutel is beschadigd of onvolledig gekopieerd. Haal hem opnieuw op.',
        );
      }
    }
  }
}

console.log('');
if (fouten) {
  console.log(rood(`${fouten} probleem(en) gevonden.`));
  process.exit(1);
}
console.log(groen('Alles in orde. Start de app met: npm run dev'));
