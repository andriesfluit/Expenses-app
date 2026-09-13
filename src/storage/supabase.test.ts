import { describe, expect, it } from 'vitest';
import { verklaar } from '@/storage/supabase';

describe('verklaar', () => {
  it('legt uit wat een mislukte fetch betekent', () => {
    // Dit is letterlijk wat de browser teruggeeft als het project pauzeert.
    const uitleg = verklaar('TypeError: Failed to fetch');
    expect(uitleg).toContain('niet bereikbaar');
    expect(uitleg).toContain('gepauzeerd');
    expect(uitleg).toContain('Restore project');
  });

  it('herkent de varianten van andere browsers', () => {
    for (const melding of ['NetworkError when attempting to fetch', 'Load failed']) {
      expect(verklaar(melding)).toContain('niet bereikbaar');
    }
  });

  it('wijst bij een geweigerde sleutel naar check-env', () => {
    expect(verklaar('Invalid API key')).toContain('check-env');
  });

  it('laat een melding die al duidelijk is ongemoeid', () => {
    const origineel = 'relation "public.expenses" does not exist';
    expect(verklaar(origineel)).toBe(origineel);
  });
});
