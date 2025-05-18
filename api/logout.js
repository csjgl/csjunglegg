import { supabase } from '../src/supabaseClient';

export default async function handler(req, res) {
  try {
    // Clear the token cookie (for all paths)
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
