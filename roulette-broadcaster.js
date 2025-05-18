// roulette-broadcaster.js
// Backend game loop for Double (roulette) mode
// Usage: node roulette-broadcaster.js

import 'dotenv/config';
import Ably from 'ably';
import { createClient } from '@supabase/supabase-js';

const ABLY_KEY = process.env.VITE_ABLY_PUBLIC_KEY || process.env.ABLY_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ably = new Ably.Realtime(ABLY_KEY);
const ablyChannel = ably.channels.get('roulette');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BETTING_WINDOW_MS = 15000;
const SPIN_PAUSE_MS = 3000;
const COLORS = ['red','black','red','black','red','black','red','black','red','black','green']; // 10 red/black, 1 green

function randomColor() {
  const idx = Math.floor(Math.random() * COLORS.length);
  return COLORS[idx];
}

async function createGame(starttime, bettingwindowend) {
  const { data, error } = await supabase
    .from('roulettedoublegame')
    .insert({ starttime, status: 'pending', bettingwindowend })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function endGame(gameId, color, number) {
  await supabase
    .from('roulettedoublegame')
    .update({ endtime: new Date().toISOString(), color, number, status: 'finished' })
    .eq('id', gameId);
}

async function setGameSpinning(gameId) {
  await supabase
    .from('roulettedoublegame')
    .update({ status: 'spinning' })
    .eq('id', gameId);
}

async function runRouletteLoop() {
  while (true) {
    await new Promise(r => setTimeout(r, SPIN_PAUSE_MS));
    const now = Date.now();
    const starttime = new Date(now).toISOString();
    const bettingwindowend = new Date(now + BETTING_WINDOW_MS).toISOString();
    let game = await createGame(starttime, bettingwindowend);
    ablyChannel.publish('pending', { gameId: game.id });
    await new Promise(r => setTimeout(r, BETTING_WINDOW_MS));
    await setGameSpinning(game.id);
    ablyChannel.publish('spinning', { gameId: game.id });
    await new Promise(r => setTimeout(r, 2000)); // spin animation
    const color = randomColor();
    const number = COLORS.indexOf(color);
    await endGame(game.id, color, number);
    ablyChannel.publish('result', { gameId: game.id, color, number });
  }
}

runRouletteLoop().catch(console.error);
