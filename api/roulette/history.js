// api/roulette/history.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const { data: games, error } = await supabase
    .from('roulettedoublegame')
    .select('*')
    .order('starttime', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ games });
}
