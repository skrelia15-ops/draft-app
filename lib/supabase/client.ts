import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl as string;
const supabaseKey = extra.supabasePublishableKey as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars. Check .env and app.config.ts.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-refresh only while the app is foregrounded (per Supabase RN guide).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
