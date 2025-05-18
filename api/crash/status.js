import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Get the latest crash game (never create a new one here)
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

  // Always expire all but the latest pending game (by starttime)
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

  // Only return a pending game if it was created in the last 2 seconds
  const now = Date.now();
  let { data: latestPending } = await supabase
    .from('crashgame')
    .select('*, bets:crashbet(*)')
    .eq('status', 'pending')
    .order('starttime', { ascending: false })
    .limit(1);
  if (
    Array.isArray(latestPending) &&
    latestPending[0] &&
    now - new Date(latestPending[0].starttime).getTime() < 2000
  ) {
    game = latestPending[0];
  } else {
    let { data: latestGames } = await supabase
      .from('crashgame')
      .select('*, bets:crashbet(*)')
      .order('starttime', { ascending: false })
      .limit(1);
    if (Array.isArray(latestGames) && latestGames[0]) game = latestGames[0];
  }

  // Refresh bets for latest state
  if (game) {
    const { data: bets } = await supabase.from('crashbet').select('*').eq('gameid', game.id);
    game.bets = bets || [];
  }

  res.status(200).json({ game });
}
