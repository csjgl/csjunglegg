import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUser } from '../App';
import { createClient } from '@supabase/supabase-js';
import Ably from 'ably';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface CrashGameData {
  id: string;
  starttime: string;
  endtime?: string;
  crashpoint?: number;
  seed: string;
  status: string;
  bets: CrashBetData[];
}

interface CrashBetData {
  id: string;
  userId: string;
  amount: number;
  cashoutAt?: number;
  createdAt: string;
}

const CrashGame: React.FC = () => {
  const user = useUser();
  const [game, setGame] = useState<CrashGameData | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [betAmount, setBetAmount] = useState('');
  const [myBet, setMyBet] = useState<CrashBetData | null>(null);
  const [isBetting, setIsBetting] = useState(false);
  const [isCashedOut, setIsCashedOut] = useState(false);
  const [error, setError] = useState('');
  const [bettingCountdown, setBettingCountdown] = useState<number | null>(null);
  const [showCrashEffect, setShowCrashEffect] = useState(false);

  // Ably real-time integration
  useEffect(() => {
    if (!import.meta.env.VITE_ABLY_PUBLIC_KEY) return;
    const ably = new Ably.Realtime(import.meta.env.VITE_ABLY_PUBLIC_KEY);
    const channel = ably.channels.get('crashgame');

    // Listen for multiplier updates
    channel.subscribe('multiplier', (msg: any) => {
      setMultiplier(msg.data.multiplier);
    });
    // Listen for crash event
    channel.subscribe('crash', (msg: any) => {
      setMultiplier(msg.data.crashpoint);
      setShowCrashEffect(true);
      setTimeout(() => setShowCrashEffect(false), 1200);
    });
    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, []);

  // Real-time sync for crash game
  useEffect(() => {
    if (!game) return;
    const channel = supabase
      .channel('crashgame-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crashgame', filter: `id=eq.${game.id}` },
        () => {
          // Refetch game status on any change
          axios.get('/api/crash/status').then(res => setGame(res.data.game));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  // Place a bet
  const handleBet = async () => {
    if (!user || !betAmount) {
      setError('Missing user or bet amount');
      return;
    }
    setIsBetting(true);
    setError('');
    try {
      // Try to find a pending game or let backend create one
      const res = await axios.post('/api/crash/bet', {
        userId: user.id, // Use id (UUID) everywhere
        amount: Number(betAmount),
        gameId: game?.id,
      });
      if (!res.data.bet) {
        setError('Bet failed: missing userId or amount');
        setIsBetting(false);
        return;
      }
      setMyBet(res.data.bet);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to place bet');
    }
    setIsBetting(false);
  };

  // Cash out
  const handleCashout = async () => {
    if (!myBet) return;
    setIsCashedOut(true);
    setError('');
    try {
      await axios.post('/api/crash/cashout', {
        betId: myBet.id,
        cashoutAt: multiplier,
      });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to cash out');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Crash Game</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <div className="mb-4 relative">
        <span className="text-4xl font-mono font-bold text-green-600">{multiplier.toFixed(2)}x</span>
        <span className="ml-2 text-gray-500">{game?.status === 'crashed' ? 'CRASHED' : game?.status?.toUpperCase()}</span>
        {showCrashEffect && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-extrabold text-red-600 animate-bounce z-10" style={{ pointerEvents: 'none' }}>
            💥 CRASHED!
          </span>
        )}
      </div>
      {/* Show bet input if no game or game is pending, and user is logged in */}
      {user && (!game || game.status === 'pending') && !myBet && (
        <div className="flex items-center space-x-2 mb-4">
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="border px-2 py-1 rounded"
            placeholder="Bet amount"
            value={betAmount}
            onChange={e => setBetAmount(e.target.value)}
            disabled={isBetting}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={handleBet}
            disabled={isBetting || !betAmount}
          >
            Place Bet
          </button>
        </div>
      )}
      {user && myBet && !isCashedOut && game?.status === 'running' && (
        <button
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mb-4 animate-pulse"
          onClick={handleCashout}
        >
          Cash Out
        </button>
      )}
      {myBet && (
        <div className="mb-2">Your bet: <b>{myBet.amount}</b> {isCashedOut && <span className="text-green-600">(Cashed out!)</span>}</div>
      )}
      <div className="mt-6">
        <h3 className="font-bold mb-2">Bets</h3>
        <ul className="max-h-40 overflow-y-auto">
          {game?.bets?.map(bet => (
            <li key={bet.id} className="flex justify-between border-b py-1 text-sm">
              <span>User: {bet.userId}</span>
              <span>Bet: {bet.amount}</span>
              <span>{bet.cashoutAt ? `Cashed out @ ${bet.cashoutAt.toFixed(2)}x` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <h3 className="font-bold mb-2">Game History</h3>
        <CrashHistory />
      </div>
    </div>
  );
};

const CrashHistory: React.FC = () => {
  const [games, setGames] = useState<CrashGameData[]>([]);
  useEffect(() => {
    axios.get('/api/crash/history').then(res => setGames(res.data.games));
  }, []);
  return (
    <ul className="max-h-32 overflow-y-auto text-sm">
      {games.map(game => (
        <li key={game.id} className="flex justify-between border-b py-1">
          <span>{new Date(game.starttime).toLocaleTimeString()}</span>
          <span>{game.crashpoint ? `${game.crashpoint.toFixed(2)}x` : '-'}</span>
          <span>{game.status}</span>
        </li>
      ))}
    </ul>
  );
};

export default CrashGame;
