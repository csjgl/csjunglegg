import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { cookie } = req.headers;
  if (!cookie) return res.json(null);

  const token = cookie.split(';').find(c => c.trim().startsWith('token='));
  if (!token) return res.json(null);

  try {
    const userFromToken = jwt.verify(token.split('=')[1], process.env.JWT_SECRET);
    if (!userFromToken || typeof userFromToken.steamid !== 'string' || !userFromToken.steamid) {
      res.status(401).json({ error: 'Invalid token or missing steamid', details: userFromToken });
      return;
    }

    const steamid = userFromToken.steamid;
    const name = userFromToken.displayName || userFromToken.personaname || 'Unknown';
    const avatar = (userFromToken._json && userFromToken._json.avatarmedium) || userFromToken.avatar || '';

    // Find or create user in Supabase
    let { data: user, error } = await supabase
      .from('user')
      .select('*')
      .eq('steamid', steamid)
      .single();

    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('user')
        .insert([{ steamid, name, avatar, balance: 0 }])
        .select()
        .single();
      if (createError) {
        res.status(500).json({ error: 'Supabase error', details: createError.message });
        return;
      }
      user = newUser;
    }

    res.json({
      ...userFromToken,
      id: user.id,
      balance: user.balance,
    });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', details: e.message });
  }
}
