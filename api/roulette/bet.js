// api/roulette/bet.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { gameId, color, amount, userId } = req.body;
  if (!gameId || !color || !amount || !userId) return res.status(400).json({ error: 'Missing fields' });
  const { data: bet, error } = await supabase
    .from('roulettebet')
    .insert({ gameid: gameId, color, amount, userid: userId })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ bet });
}
