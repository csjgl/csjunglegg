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

function randomCrashPoint() {
  // Provably fair: 1/(1-X) where X is random [0,1)
  const X = Math.random();
  if (X < 0.01) return 0; // 1% chance of instant crash
  return Math.floor((1 / (1 - X)) * 100) / 100;
}

async function createGame(seed) {
  const { data, error } = await supabase
    .from('crashgame')
    .insert({
      starttime: new Date().toISOString(),
      seed,
      status: 'running',
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

async function runCrashLoop() {
  while (true) {
    const crashpoint = randomCrashPoint();
    const seed = Math.random().toString(36).slice(2);
    const game = await createGame(seed);
    let multiplier = 1.0;
    let crashed = false;
    const start = Date.now();
    console.log(`New game: id=${game.id}, crashpoint=${crashpoint}`);
    while (!crashed) {
      const elapsed = Date.now() - start;
      multiplier = Math.floor((Math.exp(GROWTH_RATE * elapsed) * 100)) / 100;
      if (multiplier >= crashpoint || crashpoint === 0) {
        crashed = true;
        multiplier = crashpoint;
        // Publish crash event
        ablyChannel.publish('crash', { crashpoint });
        await endGame(game.id, crashpoint);
        console.log(`Game crashed at ${crashpoint}x`);
      } else {
        // Publish multiplier event
        ablyChannel.publish('multiplier', { multiplier });
        await new Promise(r => setTimeout(r, TICK_MS));
      }
    }
    // Wait before next round
    await new Promise(r => setTimeout(r, ROUND_WAIT_MS));
  }
}

runCrashLoop().catch(console.error);
