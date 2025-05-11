import { supabase } from '../src/supabaseClient';

export default async function handler(req, res) {
  try {
    // Log out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out from Supabase:', error);
    }

    // Clear the token cookie
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('Unexpected error during logout:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
