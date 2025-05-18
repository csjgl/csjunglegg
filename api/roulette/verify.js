// api/roulette/verify.js
import { getProvablyFairRouletteResult } from './provablyFair.js';

export default async function handler(req, res) {
  const { serverSeed, clientSeed, nonce } = req.query;
  if (!serverSeed || !clientSeed || !nonce) {
    return res.status(400).json({ error: 'Missing serverSeed, clientSeed, or nonce' });
  }
  try {
    const result = getProvablyFairRouletteResult({ serverSeed, clientSeed, nonce: Number(nonce) });
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
