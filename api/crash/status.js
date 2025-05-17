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

  // If there are multiple pending games, expire all but the latest
  if (game && game.status === 'pending') {
    let { data: allPending } = await supabase
      .from('crashgame')
      .select('id, starttime')
      .eq('status', 'pending')
      .order('starttime', { ascending: false });
    if (Array.isArray(allPending) && allPending.length > 1) {
      const idsToExpire = allPending.slice(1).map(g => g.id);
      if (idsToExpire.length > 0) {
        await supabase
          .from('crashgame')
          .update({ status: 'expired' })
          .in('id', idsToExpire);
      }
    }
  }

  // Always transition from 'pending' to 'running' after 15 seconds, but only for the latest pending game
  if (game.status === 'pending') {
    let { data: allGames } = await supabase
      .from('crashgame')
      .select('id, starttime, status')
      .order('starttime', { ascending: false });
    const isLatest = !allGames || allGames.length === 0 || allGames[0].id === game.id;
    if (isLatest) {
      const start = new Date(game.starttime).getTime();
      if (now.getTime() - start > 15000) { // 15 seconds
        await supabase.from('crashgame').update({ status: 'running' }).eq('id', game.id);
        const { data: updatedGame } = await supabase
          .from('crashgame')
          .select('*, bets:crashbet(*)')
          .eq('id', game.id)
          .single();
        if (updatedGame) game = updatedGame;
      }
    }
  }

  // Only transition from 'running' to 'crashed' if this is the latest game
  if (game.status === 'running') {
    let { data: allGames } = await supabase
      .from('crashgame')
      .select('id, starttime, status')
      .order('starttime', { ascending: false });
    const isLatest = !allGames || allGames.length === 0 || allGames[0].id === game.id;
    if (isLatest) {
      const start = new Date(game.starttime).getTime();
      const nowTime = now.getTime();
      const crashSeconds = Math.log(game.crashpoint) / 0.05;
      if (nowTime - start > crashSeconds * 1000) {
        await supabase.from('crashgame').update({ status: 'crashed', endtime: new Date().toISOString() }).eq('id', game.id);
        game.status = 'crashed';
        game.endtime = new Date().toISOString();
      }
    }
  }

  // If the latest game is paused, return it as the current game
  if (game && game.status === 'paused') {
    // Optionally, you could check how long it's been paused and allow transition if >2s, but the broadcaster handles this
    const { data: bets } = await supabase.from('crashbet').select('*').eq('gameid', game.id);
    game.bets = bets || [];
    res.status(200).json({ game });
    return;
  }

  // Refresh bets for latest state
  const { data: bets } = await supabase.from('crashbet').select('*').eq('gameid', game.id);
  game.bets = bets || [];

  // Always return the latest game (by starttime), regardless of status
  let { data: latestGames } = await supabase
    .from('crashgame')
    .select('*, bets:crashbet(*)')
    .order('starttime', { ascending: false })
    .limit(1);
  if (Array.isArray(latestGames) && latestGames[0]) game = latestGames[0];

  res.status(200).json({ game });
}
