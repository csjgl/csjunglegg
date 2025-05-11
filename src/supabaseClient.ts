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

// Debugging: Log the current session
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Error fetching session:', error);
  } else {
    console.log('Current session:', data);
  }
});

// Add an auth state change listener to track session changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Auth state changed: ${event}`);
  if (session) {
    console.log('New session:', session);
  } else {
    console.warn('Session is missing after auth state change.');
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
