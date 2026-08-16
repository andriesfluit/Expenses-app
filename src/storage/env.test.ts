import { describe, expect, it } from 'vitest';
import { leesEnvWaarde } from '@/storage/env';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.tHwf-9FrK2L_odVaGUXgg';

// Alle stoorzenders uit hun codepunt opgebouwd: letterlijk ingetypt zou deze
// test zelf onleesbaar zijn en bij het bewerken stilletjes kunnen sneuvelen.
const teken = (codepunt: number) => String.fromCodePoint(codepunt);
const NBSP = teken(0x00a0);
const ZERO_WIDTH_SPACE = teken(0x200b);
const ZERO_WIDTH_JOINER = teken(0x200d);
const IDEOGRAPHIC_SPACE = teken(0x3000);
const WORD_JOINER = teken(0x2060);
const BOM = teken(0xfeff);
const EM_DASH = teken(0x2014);
const SLIM_AANHALINGSTEKEN = teken(0x201d);

describe('leesEnvWaarde', () => {
  it('laat een schone sleutel ongemoeid', () => {
    expect(leesEnvWaarde('VITE_SUPABASE_ANON_KEY', JWT)).toEqual({ ok: true, waarde: JWT });
  });

  it('haalt gewone witruimte en regeleindes weg', () => {
    expect(leesEnvWaarde('X', `  ${JWT}\n`)).toEqual({ ok: true, waarde: JWT });
  });

  it('haalt een non-breaking space weg die bij het plakken meekwam', () => {
    const vervuild = JWT.slice(0, 20) + NBSP + JWT.slice(20);
    expect(leesEnvWaarde('X', vervuild)).toEqual({ ok: true, waarde: JWT });
  });

  it('haalt zero-width tekens weg', () => {
    const vervuild =
      ZERO_WIDTH_SPACE + JWT.slice(0, 30) + ZERO_WIDTH_JOINER + JWT.slice(30) + BOM;
    expect(leesEnvWaarde('X', vervuild)).toEqual({ ok: true, waarde: JWT });
  });

  it('haalt een word joiner en een ideografische spatie weg', () => {
    const vervuild = IDEOGRAPHIC_SPACE + JWT.slice(0, 5) + WORD_JOINER + JWT.slice(5);
    expect(leesEnvWaarde('X', vervuild)).toEqual({ ok: true, waarde: JWT });
  });

  it('haalt meegekopieerde aanhalingstekens weg', () => {
    expect(leesEnvWaarde('X', `"${JWT}"`)).toEqual({ ok: true, waarde: JWT });
  });

  it('meldt een leeg veld', () => {
    const uitkomst = leesEnvWaarde('VITE_SUPABASE_URL', '   ');
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.ok === false && uitkomst.probleem).toContain('leeg');
  });

  it('meldt een teken dat niet in een header past, met codepunt en veldnaam', () => {
    const uitkomst = leesEnvWaarde('VITE_SUPABASE_ANON_KEY', `${JWT}${EM_DASH}x`);
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.ok === false && uitkomst.probleem).toContain('U+2014');
    expect(uitkomst.ok === false && uitkomst.probleem).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('meldt een slim aanhalingsteken midden in de waarde', () => {
    const uitkomst = leesEnvWaarde('X', `${JWT}${SLIM_AANHALINGSTEKEN}`);
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.ok === false && uitkomst.probleem).toContain('U+201D');
  });

  it('meldt undefined als leeg in plaats van te crashen', () => {
    expect(leesEnvWaarde('X', undefined).ok).toBe(false);
  });

  it('herkent een gemaskeerde sleutel aan de bulletjes', () => {
    const gemaskeerd = JWT.slice(0, 12) + teken(0x2022).repeat(8);
    const uitkomst = leesEnvWaarde('VITE_SUPABASE_ANON_KEY', gemaskeerd);
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.ok === false && uitkomst.probleem).toContain('Reveal');
    // Niet de generieke codepunt-melding, maar het bruikbare advies.
    expect(uitkomst.ok === false && uitkomst.probleem).not.toContain('U+2022');
  });

  it('herkent ook sterretjes als maskering', () => {
    const uitkomst = leesEnvWaarde('X', `${JWT.slice(0, 12)}********`);
    expect(uitkomst.ok).toBe(false);
    expect(uitkomst.ok === false && uitkomst.probleem).toContain('Reveal');
  });

  it('accepteert een echte Supabase-URL', () => {
    const url = 'https://bnfpunivfhucwmuuvvsw.supabase.co';
    expect(leesEnvWaarde('VITE_SUPABASE_URL', url)).toEqual({ ok: true, waarde: url });
  });
});
