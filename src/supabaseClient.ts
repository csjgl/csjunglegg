import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey);

// Create a Supabase client with session persistence enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Ensure sessions are persisted in local storage
    autoRefreshToken: true, // Automatically refresh tokens when they expire
  },
});

// Enhanced session fetching and logout handling
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Auth state changed: ${event}`);

  if (event === 'SIGNED_OUT') {
    console.log('User signed out. Stopping session-related operations.');
    return;
  }

  if (event === 'INITIAL_SESSION') {
    if (session) {
      console.log('Initial session received:', session);
    } else {
      console.warn('No session found during INITIAL_SESSION event. Skipping retries and stopping operations.');
    }
  }
});

// Helper function to include the API key in headers for all requests
export const fetchWithApiKey = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...(options.headers || {}),
    apikey: supabaseAnonKey,
  };

  return fetch(url, { ...options, headers });
};
