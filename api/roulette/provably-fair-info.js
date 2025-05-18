// api/roulette/provably-fair-info.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  // Get all seeds, most recent first
  const { data: seeds, error } = await supabase
    .from('provablyfairseed')
    .select('*')
    .order('createdat', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ seeds });
}
