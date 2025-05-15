// Get recent crash games (history)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Get the last 20 crash games
  const { data, error } = await supabase
    .from('CrashGame')
    .select('*')
    .order('startTime', { ascending: false })
    .limit(20);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ games: data });
}
