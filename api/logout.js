import { supabase } from '../src/supabaseClient';

export default async function handler(req, res) {
  try {
    // Clear the token cookie for all possible domain/path combos (including your production domain)
    res.setHeader('Set-Cookie', [
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;',
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=csjunglegg.vercel.app;',
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=.csjunglegg.vercel.app;',
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=localhost;',
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=127.0.0.1;'
    ]);
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
