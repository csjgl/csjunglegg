import { supabase } from '../src/supabaseClient';

export default async function handler(req, res) {
  try {
    // Add debugging logs to verify logout process
    console.log('Attempting to log out user...');

    // Log out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out from Supabase:', error);
    } else {
      console.log('Supabase session cleared successfully.');
    }

    // Clear the token cookie
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    console.log('Token cookie cleared. Redirecting to home page...');

    // Redirect to home page
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('Unexpected error during logout:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
