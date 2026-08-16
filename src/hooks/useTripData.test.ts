import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from '@/hooks/useTripData';

describe('withTimeout', () => {
  it('geeft de waarde door als de belofte op tijd klaar is', async () => {
    await expect(withTimeout(Promise.resolve('klaar'), 1000)).resolves.toBe('klaar');
  });

  it('laat een echte fout ongemoeid doorkomen', async () => {
    await expect(withTimeout(Promise.reject(new Error('kapot')), 1000)).rejects.toThrow('kapot');
  });

  it('faalt met een leesbare melding als er niets terugkomt', async () => {
    vi.useFakeTimers();
    const nooit = new Promise(() => {});
    const race = withTimeout(nooit, 12_000);
    const verwachting = expect(race).rejects.toThrow(/12 seconden.*internetverbinding/s);
    await vi.advanceTimersByTimeAsync(12_000);
    await verwachting;
    vi.useRealTimers();
  });

  it('houdt de klok niet onnodig aan de gang na een snel antwoord', async () => {
    vi.useFakeTimers();
    const opgeruimd = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve(1), 12_000);
    expect(opgeruimd).toHaveBeenCalled();
    opgeruimd.mockRestore();
    vi.useRealTimers();
  });
});
