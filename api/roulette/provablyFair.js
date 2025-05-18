import crypto from 'crypto';

// Deterministic provably fair result for roulette
// Returns { color, number }
export function getProvablyFairRouletteResult({ serverSeed, clientSeed, nonce }) {
  // HMAC-SHA256(serverSeed, clientSeed:nonce)
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');
  // Use first 8 hex digits as a number
  const roll = parseInt(hash.slice(0, 8), 16);
  // 0-10 (11 segments)
  const result = roll % 11;
  const COLORS = ['red','black','red','black','red','black','red','black','red','black','green'];
  return { color: COLORS[result], number: result };
}
