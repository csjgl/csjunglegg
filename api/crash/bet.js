// Place a bet on the current crash game
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { userId, amount, gameId } = req.body;
  if (!userId || !amount) {
    res.status(400).json({ error: 'Missing userId or amount' });
    return;
  }

  // Check if user has enough balance
  const { data: user, error: userError } = await supabase
    .from('user')
    .select('balance')
    .eq('id', userId) // use id (UUID)
    .single();
  if (userError || !user) {
    res.status(400).json({ error: 'User not found' });
    return;
  }
  if (Number(user.balance) < Number(amount)) {
    res.status(400).json({ error: 'Insufficient balance' });
    return;
  }

  // Deduct balance
  const { error: updateError } = await supabase
    .from('user')
    .update({ balance: Number(user.balance) - Number(amount) })
    .eq('id', userId); // use id (UUID)
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Place bet
  let gameIdToUse = gameId;
  if (!gameId) {
    // Find the latest pending game
    let { data: pendingGames } = await supabase
      .from('crashgame')
      .select('*')
      .eq('status', 'pending')
      .order('starttime', { ascending: false })
      .limit(1);
    let pendingGame = Array.isArray(pendingGames) ? pendingGames[0] : pendingGames;
    if (!pendingGame) {
      // Create a new pending game if none exists
      const crashpoint = Math.floor((Math.random() * 100) + 10) / 100; // 1.10x - 2.00x
      const seed = Math.random().toString(36).substring(2);
      const { data: newGame, error: createError } = await supabase
        .from('crashgame')
        .insert([
          { crashpoint, seed, status: 'pending', starttime: new Date().toISOString() }
        ])
        .select()
        .single();
      if (createError) {
        res.status(500).json({ error: createError.message });
        return;
      }
      gameIdToUse = newGame.id;
    } else {
      gameIdToUse = pendingGame.id;
    }
  }

  const { data: bet, error: betError } = await supabase
    .from('crashbet')
    .insert([
      { userid: userId, amount, gameid: gameIdToUse }
    ])
    .select()
    .single();
  if (betError) {
    res.status(500).json({ error: betError.message });
    return;
  }

  res.status(200).json({ bet });
}
