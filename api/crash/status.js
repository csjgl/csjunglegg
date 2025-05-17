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
  let { data: games, error: gameError } = await supabase
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

  // If no game or last game is crashed and 10s have passed, create a new pending game
  if (!game || (game.status === 'crashed' && game.endtime && (now.getTime() - new Date(game.endtime).getTime() > 10000))) {
    // Create a new pending game
    const crashpoint = generateCrashPoint();
    const seed = Math.random().toString(36).slice(2);
    const { data: newGame, error: createError } = await supabase
      .from('crashgame')
      .insert({
        starttime: new Date().toISOString(),
        seed,
        status: 'pending',
        crashpoint
      })
      .select('*, bets:crashbet(*)')
      .single();
    if (createError) {
      res.status(500).json({ error: createError.message });
      return;
    }
    game = newGame;
  }

  // If game is pending and more than 10s have passed since start, set to running
  if (game.status === 'pending' && game.bets && game.bets.length > 0) {
    const start = new Date(game.starttime).getTime();
    if (now.getTime() - start > 10000) {
      await supabase.from('crashgame').update({ status: 'running' }).eq('id', game.id);
      game.status = 'running';
    }
  }

  // Always transition from 'pending' to 'running' after 15 seconds
  if (game.status === 'pending') {
    const start = new Date(game.starttime).getTime();
    if (now.getTime() - start > 15000) { // 15 seconds
      await supabase.from('crashgame').update({ status: 'running' }).eq('id', game.id);
      game.status = 'running';
    }
  }

  // If game is running, check if it should crash
  if (game.status === 'running') {
    const start = new Date(game.starttime).getTime();
    const nowTime = now.getTime();
    const crashSeconds = Math.log(game.crashpoint) / 0.05;
    if (nowTime - start > crashSeconds * 1000) {
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
