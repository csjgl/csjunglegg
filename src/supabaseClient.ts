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

// Improved session fetching with retry logic
async function fetchSessionWithRetry(retryCount = 3, delay = 1000) {
  for (let i = 0; i < retryCount; i++) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error);
    } else if (data.session) {
      console.log('Session fetched successfully:', data.session);
      return data.session;
    } else {
      console.warn('Session is null, retrying...');
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.error('Failed to fetch session after retries.');
  return null;
}

// Enhanced session fetching and logout handling
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(`Auth state changed: ${event}`);

  if (event === 'INITIAL_SESSION') {
    if (!session) {
      console.warn('Session is missing after INITIAL_SESSION event. Retrying fetch...');
      session = await fetchSessionWithRetry();
    }
    if (session) {
      console.log('Session initialized successfully:', session);
    } else {
      console.error('Session is still missing after retries.');
    }
  }

  if (event === 'SIGNED_OUT') {
    console.log('User signed out. Clearing local session state.');
    await supabase.auth.signOut(); // Ensure Supabase session is cleared
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
