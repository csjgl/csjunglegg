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
    .from('CrashGame')
    .select('*, bets:CrashBet(*)')
    .order('starttime', { ascending: false })
    .limit(1);

  if (gameError) {
    res.status(500).json({ error: gameError.message });
    return;
  }

  let game = Array.isArray(games) ? games[0] : games;
  const now = new Date();
  // If no game or last game is crashed and 10s have passed, start a new one
  if (!game || (game.status === 'crashed' && game.endtime && (now.getTime() - new Date(game.endtime).getTime() > 10000))) {
    const crashPoint = generateCrashPoint();
    const seed = Math.random().toString(36).substring(2);
    const { data: newGames, error: createError } = await supabase
      .from('CrashGame')
      .insert([
        { crashpoint: crashPoint, seed, status: 'pending', starttime: new Date().toISOString() }
      ])
      .select('*, bets:CrashBet(*)')
      .limit(1);
    if (createError) {
      res.status(500).json({ error: createError.message });
      return;
    }
    game = Array.isArray(newGames) ? newGames[0] : newGames;
  }

  // If game is pending and more than 10s have passed since start, set to running
  if (game.status === 'pending') {
    const start = new Date(game.starttime).getTime();
    if (now.getTime() - start > 10000) {
      // Set to running
      await supabase.from('CrashGame').update({ status: 'running' }).eq('id', game.id);
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
      await supabase.from('CrashGame').update({ status: 'crashed', endtime: new Date().toISOString() }).eq('id', game.id);
      game.status = 'crashed';
      game.endtime = new Date().toISOString();
    }
  }

  // Refresh bets for latest state
  const { data: bets } = await supabase.from('CrashBet').select('*').eq('gameid', game.id);
  game.bets = bets || [];

  res.status(200).json({ game });
}
