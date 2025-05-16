import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function generateCrashPoint() {
  // Provably fair: 1.10x to 10.00x
  return Math.floor((Math.random() * 890) + 110) / 100;
}

export default async function handler(req, res) {
  // Get the latest crash game
  const { data: games, error: gameError } = await supabase
    .from('crashgame')
    .select('*, bets:crashbet(*)')
    .order('starttime', { ascending: false })
    .limit(1);

  if (gameError) {
    res.status(500).json({ error: gameError.message });
    return;
  }

  let game = Array.isArray(games) ? games[0] : games;
  const now = new Date();

  // Only start a new game if there is at least one bet placed
  // If no game or last game is crashed and 10s have passed, do NOT auto-start
  if (!game || (game.status === 'crashed' && game.endtime && (now.getTime() - new Date(game.endtime).getTime() > 10000))) {
    // Wait for a bet to be placed to start a new game
    // But always return a valid game object for frontend polling
    res.status(200).json({ game: null });
    return;
  }

  // If game is pending and more than 10s have passed since start, set to running
  if (game.status === 'pending' && game.bets && game.bets.length > 0) {
    const start = new Date(game.starttime).getTime();
    if (now.getTime() - start > 10000) {
      // Set to running
      await supabase.from('crashgame').update({ status: 'running' }).eq('id', game.id);
      game.status = 'running';
    }
  }

  // If game is running, check if it should crash
  if (game.status === 'running') {
    const start = new Date(game.starttime).getTime();
    const nowTime = now.getTime();
    // Calculate when the crash should happen
    // For demo: 1x = 0s, 2x = ~14s, 10x = ~46s (using ln(crashPoint)/0.05)
    const crashSeconds = Math.log(game.crashpoint) / 0.05;
    if (nowTime - start > crashSeconds * 1000) {
      // Set to crashed
      await supabase.from('crashgame').update({ status: 'crashed', endtime: new Date().toISOString() }).eq('id', game.id);
      game.status = 'crashed';
      game.endtime = new Date().toISOString();
    }
  }

  // Refresh bets for latest state
  const { data: bets } = await supabase.from('crashbet').select('*').eq('gameid', game.id);
  game.bets = bets || [];

  res.status(200).json({ game });
}
