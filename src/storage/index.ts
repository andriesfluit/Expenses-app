import type { TripRepository } from '@/storage/types';
import { createLocalRepository } from '@/storage/local';
import { createSupabaseRepository } from '@/storage/supabase';
import { leesEnvWaarde } from '@/storage/env';

/**
 * Een opslag die niets kan, maar wél uitlegt waarom. Nodig omdat de fout pas
 * zichtbaar mag worden als de app hem kan tonen: gooien tijdens het opbouwen
 * van de repository zou het scherm wit laten.
 */
function createBrokenRepository(probleem: string): TripRepository {
  const falen = () => Promise.reject(new Error(probleem));
  return {
    kind: 'supabase',
    label: 'Configuratie klopt niet',
    load: falen,
    addHousehold: falen,
    updateHousehold: falen,
    removeHousehold: falen,
    addExpense: falen,
    updateExpense: falen,
    removeExpense: falen,
    subscribe: () => () => {},
  };
}

/**
 * Kiest de opslag op basis van de omgeving. Zonder Supabase-configuratie
 * draait de app gewoon lokaal, zodat ze bruikbaar is voordat er een
 * Supabase-project bestaat.
 */
export function createRepository(): TripRepository {
  const ruweUrl = import.meta.env.VITE_SUPABASE_URL;
  const ruweSleutel = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Niets ingevuld is een geldige keuze: dan draait de app lokaal.
  if (!ruweUrl?.trim() && !ruweSleutel?.trim()) {
    return createLocalRepository();
  }

  const url = leesEnvWaarde('VITE_SUPABASE_URL', ruweUrl);
  const sleutel = leesEnvWaarde('VITE_SUPABASE_ANON_KEY', ruweSleutel);

  if (!url.ok) return createBrokenRepository(url.probleem);
  if (!sleutel.ok) return createBrokenRepository(sleutel.probleem);

  const tripId = leesEnvWaarde('VITE_TRIP_ID', import.meta.env.VITE_TRIP_ID);

  return createSupabaseRepository(
    url.waarde,
    sleutel.waarde,
    tripId.ok ? tripId.waarde : 'vakantie',
  );
}

export type { TripRepository };
