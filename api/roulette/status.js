// api/roulette/status.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  // Get the latest roulette game, including provably fair info
  const { data: game, error } = await supabase
    .from('roulettedoublegame')
    .select('*, provablyfairseed:serverseedid(serverseedhash, revealedat, serverseed)')
    .order('starttime', { ascending: false })
    .limit(1)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ game });
}
