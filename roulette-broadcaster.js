// roulette-broadcaster.js
// Backend game loop for Double (roulette) mode
// Usage: node roulette-broadcaster.js

import 'dotenv/config';
import Ably from 'ably';
import { createClient } from '@supabase/supabase-js';
import { getProvablyFairRouletteResult } from './api/roulette/provablyFair.js';
import crypto from 'crypto';

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

// Helper: get or create active provably fair seed
async function getOrCreateActiveSeed() {
  let { data: seed } = await supabase
    .from('provablyfairseed')
    .select('*')
    .eq('active', true)
    .single();
  if (!seed) {
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const { data: newSeed } = await supabase
      .from('provablyfairseed')
      .insert({ serverseed: serverSeed, serverseedhash: serverSeedHash, active: true })
      .select()
      .single();
    seed = newSeed;
  }
  return seed;
}

// Helper: rotate seed (reveal old, create new)
async function rotateSeed(oldSeedId) {
  await supabase.from('provablyfairseed').update({ active: false, revealedat: new Date().toISOString() }).eq('id', oldSeedId);
  return getOrCreateActiveSeed();
}

async function createGame(starttime, bettingwindowend) {
  const seed = await getOrCreateActiveSeed();
  // For demo: use a random client seed per round (in production, use user seed or allow user to set)
  const clientSeed = crypto.randomBytes(16).toString('hex');
  // Nonce: count of games for this seed
  const { data: countData } = await supabase
    .from('roulettedoublegame')
    .select('id', { count: 'exact' })
    .eq('serverseedid', seed.id);
  const nonce = (countData?.length || 0) + 1;
  const { data, error } = await supabase
    .from('roulettedoublegame')
    .insert({ starttime, status: 'pending', bettingwindowend, serverseedid: seed.id, clientseed: clientSeed, nonce })
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
  let roundsPerSeed = 20; // Rotate/reveal every 20 rounds
  let rounds = 0;
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
    // Provably fair result
    const { color, number } = getProvablyFairRouletteResult({
      serverSeed: (await supabase.from('provablyfairseed').select('serverseed').eq('id', game.serverseedid).single()).data.serverseed,
      clientSeed: game.clientseed,
      nonce: game.nonce
    });
    await endGame(game.id, color, number);
    ablyChannel.publish('result', { gameId: game.id, color, number });
    rounds++;
    if (rounds % roundsPerSeed === 0) {
      // Reveal and rotate seed
      await rotateSeed(game.serverseedid);
    }
  }
}

runRouletteLoop().catch(console.error);
