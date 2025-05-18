import { supabase } from '../src/supabaseClient';

export default async function handler(req, res) {
  try {
    // Clear the token cookie for all possible domain/path combos
    res.setHeader('Set-Cookie', [
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;',
      'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=localhost;',
      process.env.COOKIE_DOMAIN ? `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=${process.env.COOKIE_DOMAIN};` : '',
      process.env.COOKIE_DOMAIN ? `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=.${process.env.COOKIE_DOMAIN};` : ''
    ].filter(Boolean));
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
