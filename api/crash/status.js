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
  let { data: game, error: gameError } = await supabase
    .from('CrashGame')
    .select('*, bets:CrashBet(*)')
    .order('startTime', { ascending: false })
    .limit(1)
    .single();

  if (gameError) {
    res.status(500).json({ error: gameError.message });
    return;
  }

  const now = new Date();
  // If no game or last game is crashed and 10s have passed, start a new one
  if (!game || (game.status === 'crashed' && game.endTime && (now.getTime() - new Date(game.endTime).getTime() > 10000))) {
    const crashPoint = generateCrashPoint();
    const seed = Math.random().toString(36).substring(2);
    const { data: newGame, error: createError } = await supabase
      .from('CrashGame')
      .insert([
        { crashPoint, seed, status: 'pending', startTime: new Date().toISOString() }
      ])
      .select('*, bets:CrashBet(*)')
      .single();
    if (createError) {
      res.status(500).json({ error: createError.message });
      return;
    }
    game = newGame;
  }

  // If game is pending and more than 10s have passed since start, set to running
  if (game.status === 'pending') {
    const start = new Date(game.startTime).getTime();
    if (now.getTime() - start > 10000) {
      // Set to running
      await supabase.from('CrashGame').update({ status: 'running' }).eq('id', game.id);
      game.status = 'running';
    }
  }

  // If game is running, check if it should crash
  if (game.status === 'running') {
    const start = new Date(game.startTime).getTime();
    const nowTime = now.getTime();
    // Calculate when the crash should happen
    // For demo: 1x = 0s, 2x = ~14s, 10x = ~46s (using ln(crashPoint)/0.05)
    const crashSeconds = Math.log(game.crashPoint) / 0.05;
    if (nowTime - start > crashSeconds * 1000) {
      // Set to crashed
      await supabase.from('CrashGame').update({ status: 'crashed', endTime: new Date().toISOString() }).eq('id', game.id);
      game.status = 'crashed';
      game.endTime = new Date().toISOString();
    }
  }

  // Refresh bets for latest state
  const { data: bets } = await supabase.from('CrashBet').select('*').eq('gameId', game.id);
  game.bets = bets || [];

  res.status(200).json({ game });
}
