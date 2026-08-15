import type { TripRepository } from '@/storage/types';
import { createLocalRepository } from '@/storage/local';
import { createSupabaseRepository } from '@/storage/supabase';

/**
 * Kiest de opslag op basis van de omgeving. Zonder Supabase-configuratie
 * draait de app gewoon lokaal, zodat ze bruikbaar is voordat er een
 * Supabase-project bestaat.
 */
export function createRepository(): TripRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const tripId = import.meta.env.VITE_TRIP_ID || 'vakantie';

  if (url && anonKey) {
    return createSupabaseRepository(url, anonKey, tripId);
  }
  return createLocalRepository();
}

export type { TripRepository };
