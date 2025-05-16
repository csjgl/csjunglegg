// Cash out a bet in the crash game
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { betId, cashoutAt } = req.body;
  if (!betId || !cashoutAt) {
    res.status(400).json({ error: 'Missing betId or cashoutAt' });
    return;
  }

  // Update bet with cashoutAt
  const { data: bet, error: betError } = await supabase
    .from('crashbet')
    .update({ cashoutAt })
    .eq('id', betId)
    .select()
    .single();
  if (betError || !bet) {
    res.status(400).json({ error: betError ? betError.message : 'Bet not found' });
    return;
  }

  // Calculate winnings
  const winnings = bet.amount * cashoutAt;

  // Update user balance
  const { data: user, error: userError } = await supabase
    .from('user')
    .select('balance')
    .eq('id', bet.userId)
    .single();
  if (userError || !user) {
    res.status(400).json({ error: 'User not found' });
    return;
  }
  const { error: updateError } = await supabase
    .from('user')
    .update({ balance: Number(user.balance) + Number(winnings) })
    .eq('id', bet.userId);
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  res.status(200).json({ bet, winnings });
}
