// crash-broadcaster.js
// Crash game backend broadcaster for Ably + Supabase
// Usage: node crash-broadcaster.js

import 'dotenv/config';
import Ably from 'ably';
import { createClient } from '@supabase/supabase-js';

// ENV VARS: VITE_ABLY_PUBLIC_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
const ABLY_KEY = process.env.VITE_ABLY_PUBLIC_KEY || process.env.ABLY_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!ABLY_KEY) throw new Error('Missing Ably API key');
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase env vars');

const ably = new Ably.Realtime(ABLY_KEY);
const ablyChannel = ably.channels.get('crashgame');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Crash game parameters
const TICK_MS = 100; // Multiplier update interval
const ROUND_WAIT_MS = 5000; // Wait before new round
const GROWTH_RATE = 0.00006; // Controls multiplier curve
const BETTING_WINDOW_MS = 15000; // 15 seconds betting window

function randomCrashPoint() {
  // Provably fair: 1/(1-X) where X is random [0,1)
  const X = Math.random();
  if (X < 0.01) return 0; // 1% chance of instant crash
  return Math.floor((1 / (1 - X)) * 100) / 100;
}

async function createGame(seed, crashpoint, starttime) {
  const { data, error } = await supabase
    .from('crashgame')
    .insert({
      starttime: starttime || new Date().toISOString(),
      seed,
      status: 'pending',
      crashpoint
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function endGame(gameId, crashpoint) {
  await supabase
    .from('crashgame')
    .update({
      endtime: new Date().toISOString(),
      crashpoint,
      status: 'crashed',
    })
    .eq('id', gameId);
}

async function setGameRunning(gameId) {
  await supabase
    .from('crashgame')
    .update({ status: 'running' })
    .eq('id', gameId);
}

async function runCrashLoop() {
  while (true) {
    // After crash, set to paused for 2 seconds before next round (or on first run, just pause)
    await new Promise(r => setTimeout(r, 2000)); // 2s pause
    // Now create a new pending game for the next round (starttime will be correct)
    const crashpoint = randomCrashPoint();
    const seed = Math.random().toString(36).slice(2);
    // Set starttime slightly in the future to ensure frontend always gets a full 15s countdown
    const starttime = new Date(Date.now() + 1000).toISOString(); // 1s in the future
    let game = await createGame(seed, crashpoint, starttime); // pass starttime explicitly
    ablyChannel.publish('pending', { gameId: game.id });
    await new Promise(r => setTimeout(r, BETTING_WINDOW_MS));
    await setGameRunning(game.id);
    ablyChannel.publish('running', { gameId: game.id });
    let { data: runningGame } = await supabase
      .from('crashgame')
      .select('*')
      .eq('id', game.id)
      .single();
    if (runningGame) game = runningGame;
    let multiplier = 1.0;
    let crashed = false;
    const start = Date.now();
    console.log(`New game: id=${game.id}, crashpoint=${game.crashpoint}`);
    while (!crashed) {
      const elapsed = Date.now() - start;
      multiplier = Math.floor((Math.exp(GROWTH_RATE * elapsed) * 100)) / 100;
      if (multiplier >= game.crashpoint || game.crashpoint === 0) {
        crashed = true;
        multiplier = game.crashpoint;
        await endGame(game.id, game.crashpoint);
        ablyChannel.publish('crash', { crashpoint: game.crashpoint });
        console.log(`Game crashed at ${game.crashpoint}x`);
      } else {
        ablyChannel.publish('multiplier', { multiplier });
        await new Promise(r => setTimeout(r, TICK_MS));
      }
    }
    // After crash, set to paused for 2 seconds before next round
    // Only update to paused if the game is still running, not if it's already crashed
    const { data: latestGame } = await supabase
      .from('crashgame')
      .select('status')
      .eq('id', game.id)
      .single();
    if (latestGame && latestGame.status !== 'crashed') {
      await supabase
        .from('crashgame')
        .update({ status: 'paused' })
        .eq('id', game.id);
    }
    ablyChannel.publish('paused', { gameId: game.id });
    // Loop will pause again at the top
  }
}

runCrashLoop().catch(console.error);
