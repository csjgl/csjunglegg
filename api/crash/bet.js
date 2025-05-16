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
    .from('User')
    .select('balance')
    .eq('id', userId) // Use id (UUID) for lookup
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
    .from('User')
    .update({ balance: Number(user.balance) - Number(amount) })
    .eq('id', userId); // Use id (UUID) for update
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Place bet
  // If there is no pending game, create one and place the bet
  let gameIdToUse = gameId;
  if (!gameId) {
    // Find or create a pending game
    let { data: pendingGames } = await supabase
      .from('CrashGame')
      .select('*')
      .eq('status', 'pending')
      .order('starttime', { ascending: false })
      .limit(1);
    let pendingGame = Array.isArray(pendingGames) ? pendingGames[0] : pendingGames;
    if (!pendingGame) {
      // Create a new pending game
      const crashPoint = Math.floor((Math.random() * 890) + 110) / 100;
      const seed = Math.random().toString(36).substring(2);
      const { data: newGame, error: createError } = await supabase
        .from('CrashGame')
        .insert([
          { crashpoint: crashPoint, seed, status: 'pending', starttime: new Date().toISOString() }
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
    .from('CrashBet')
    .insert([
      { userId, amount, gameId: gameIdToUse }
    ])
    .select()
    .single();
  if (betError) {
    res.status(500).json({ error: betError.message });
    return;
  }

  res.status(200).json({ bet });
}
