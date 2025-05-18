import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

  // Always expire all but the latest pending game
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

  // Always operate on the latest *pending* or *running* or *paused* or *crashed* game by starttime
  // But prefer the latest 'pending' game if it exists
  let { data: latestPending } = await supabase
    .from('crashgame')
    .select('*, bets:crashbet(*)')
    .eq('status', 'pending')
    .order('starttime', { ascending: false })
    .limit(1);
  if (Array.isArray(latestPending) && latestPending[0]) {
    game = latestPending[0];
  } else {
    // fallback to latest game of any status
    let { data: latestGames } = await supabase
      .from('crashgame')
      .select('*, bets:crashbet(*)')
      .order('starttime', { ascending: false })
      .limit(1);
    if (Array.isArray(latestGames) && latestGames[0]) game = latestGames[0];
  }

  // If the latest game is paused, return it as the current game
  if (game && game.status === 'paused') {
    const { data: bets } = await supabase.from('crashbet').select('*').eq('gameid', game.id);
    game.bets = bets || [];
    res.status(200).json({ game });
    return;
  }

  // Refresh bets for latest state
  const { data: bets } = await supabase.from('crashbet').select('*').eq('gameid', game.id);
  game.bets = bets || [];

  res.status(200).json({ game });
}
