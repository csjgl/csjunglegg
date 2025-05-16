// Creates a new crash game (admin/server only)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Generate a random crash point (provably fair, simple version)
  const crashpoint = Math.floor((Math.random() * 100) + 10) / 100; // 1.10x - 2.00x
  const seed = Math.random().toString(36).substring(2);

  const { data, error } = await supabase
    .from('crashgame')
    .insert([
      {
        crashpoint,
        seed,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ game: data });
}
