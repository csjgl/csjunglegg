// Place a bet on the current crash game
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { userId, amount, gameId } = req.body;
  if (!userId || !amount || !gameId) {
    res.status(400).json({ error: 'Missing userId, amount, or gameId' });
    return;
  }

  // Check if user has enough balance
  const { data: user, error: userError } = await supabase
    .from('User')
    .select('balance')
    .eq('id', userId)
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
    .eq('id', userId);
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Place bet
  const { data: bet, error: betError } = await supabase
    .from('CrashBet')
    .insert([
      { userId, amount, gameId }
    ])
    .select()
    .single();
  if (betError) {
    res.status(500).json({ error: betError.message });
    return;
  }

  res.status(200).json({ bet });
}
