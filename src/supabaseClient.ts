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

// Debugging: Log session refresh attempts
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Error fetching session:', error);
  } else {
    console.log('Current session fetched successfully:', data);
  }
});

// Enhanced session handling and debugging
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(`Auth state changed: ${event}`);

  if (event === 'INITIAL_SESSION') {
    if (session) {
      console.log('Session initialized successfully:', session);
    } else {
      console.warn('Session is missing after INITIAL_SESSION event.');
    }
  }

  if (session) {
    console.log('New session detected:', session);
  } else {
    console.warn('Session is missing after auth state change. Logging out user.');
    await supabase.auth.signOut(); // Ensure user is logged out if session is invalid
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
