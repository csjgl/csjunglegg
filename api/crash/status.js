// Get the current crash game and all bets
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Get the latest crash game
  const { data: game, error: gameError } = await supabase
    .from('CrashGame')
    .select('*, bets:CrashBet(*)')
    .order('startTime', { ascending: false })
    .limit(1)
    .single();

  if (gameError || !game) {
    res.status(404).json({ error: 'No active crash game found' });
    return;
  }

  res.status(200).json({ game });
}
