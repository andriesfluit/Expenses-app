/**
 * Waarden uit .env belanden in HTTP-headers. Die mogen alleen tekens uit het
 * latin1-bereik bevatten, en in de praktijk alleen ASCII. Kopieren en plakken
 * uit een chat of webpagina sleept er makkelijk een onzichtbaar teken in mee:
 * een non-breaking space, een zero-width space, een slim aanhalingsteken. De
 * fout die je dan krijgt ("Failed to execute 'set' on 'Headers'") wijst
 * nergens naar de oorzaak, dus vangen we het hier op.
 */

/**
 * Zero-width tekens vallen buiten \s en blijven dus staan na een gewone trim.
 * Bewust als codepunten opgesomd in plaats van in een tekenklasse: letterlijk
 * in de broncode zijn ze net zo onzichtbaar als in een .env-bestand, en dan
 * sneuvelen ze stilletjes bij de eerste de beste bewerking.
 */
const ZERO_WIDTH = new Set([
  0x180e, // mongolian vowel separator
  0x200b, // zero width space
  0x200c, // zero width non-joiner
  0x200d, // zero width joiner
  0x2060, // word joiner
  0xfeff, // byte order mark
]);

export type EnvWaarde =
  | { ok: true; waarde: string }
  | { ok: false; probleem: string };

/**
 * Maakt een omgevingsvariabele schoon en controleert of ze bruikbaar is.
 * Witruimte en onzichtbare tekens gaan eruit; blijft er iets over dat niet in
 * een header past, dan volgt een melding die zegt welk teken het is.
 */
export function leesEnvWaarde(naam: string, ruw: string | undefined): EnvWaarde {
  const opgeschoond = [...(ruw ?? '')]
    .filter((teken) => !ZERO_WIDTH.has(teken.codePointAt(0)!))
    .join('')
    // \s dekt de gewone spatie, tabs, regeleindes en ook U+00A0 en U+3000.
    .replace(/\s/g, '')
    // Aanhalingstekens die iemand meekopieerde uit een voorbeeld.
    .replace(/^['"]|['"]$/g, '');

  if (!opgeschoond) return { ok: false, probleem: `${naam} is leeg.` };

  // Bullets en sterretjes betekenen bijna altijd dat de waarde uit een
  // afgeschermd veld is gekopieerd voordat die onthuld was. Dat verdient een
  // ander advies dan "er zit een raar teken in".
  if (/[•∙▪●*]/.test(opgeschoond)) {
    return {
      ok: false,
      probleem:
        `${naam} bevat bulletjes of sterretjes, dus dit is de verborgen weergave ` +
        'van de sleutel en niet de sleutel zelf. Klik in Supabase eerst op Reveal ' +
        '(het oogje) bij de sleutel, kopieer hem dan pas, en herstart de dev-server.',
    };
  }

  const stout = [...opgeschoond].find((teken) => {
    const code = teken.codePointAt(0)!;
    return code < 0x20 || code > 0x7e;
  });

  if (stout) {
    const code = stout.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    return {
      ok: false,
      probleem:
        `${naam} bevat het teken U+${code}, dat niet in een HTTP-header past. ` +
        'Waarschijnlijk is er bij het kopieren iets onzichtbaars meegekomen. ' +
        'Schrijf de waarde opnieuw naar .env en herstart de dev-server.',
    };
  }

  return { ok: true, waarde: opgeschoond };
}
