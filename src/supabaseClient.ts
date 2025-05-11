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

// Prevent session fetching when user is logged out
let isUserLoggedOut = false;

// Ensure session-related operations are fully stopped when logged out
async function fetchSessionWithRetry(retryCount = 3, delay = 1000) {
  if (isUserLoggedOut) {
    console.log('Skipping session fetch because user is logged out.');
    return null;
  }

  for (let i = 0; i < retryCount; i++) {
    if (isUserLoggedOut) {
      console.log('User logged out during session fetch. Aborting retries.');
      return null;
    }

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
supabase.auth.onAuthStateChange((event, session) => {
  console.log(`Auth state changed: ${event}`);

  if (event === 'SIGNED_OUT') {
    console.log('User signed out. Stopping session-related operations.');
    isUserLoggedOut = true;
    return;
  }

  if (event === 'INITIAL_SESSION') {
    if (session) {
      console.log('Initial session received:', session);
    } else {
      console.warn('No session found during INITIAL_SESSION event. Skipping retries and stopping operations.');
      isUserLoggedOut = true;
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
