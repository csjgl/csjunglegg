import { supabase } from '../src/supabaseClient';

export default async function handler(req, res) {
  try {
    // Clear the token cookie (for all paths, secure, and root domain if needed)
    let cookie = 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0;';
    if (process.env.NODE_ENV === 'production') cookie += ' Secure;';
    // Optionally set domain for cross-subdomain logout
    if (process.env.COOKIE_DOMAIN) cookie += ` Domain=${process.env.COOKIE_DOMAIN};`;
    res.setHeader('Set-Cookie', cookie);
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
