import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUser } from '../App';
import { createClient } from '@supabase/supabase-js';

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

  // Poll for game status every second
  useEffect(() => {
    let animationFrame: number;
    let lastStart: number | null = null;
    let crashedAt: number | null = null;

    const fetchStatus = async () => {
      try {
        const res = await axios.get('/api/crash/status');
        if (!res.data.game) {
          setGame(null);
          setError('Waiting for first bet to start a new crash game...');
          return;
        }
        setGame(res.data.game);
        setError('');
        // If the game is running, update multiplier
        if (res.data.game.status === 'running' && res.data.game.starttime) {
          lastStart = new Date(res.data.game.starttime).getTime();
          crashedAt = null;
        } else if (res.data.game.status === 'crashed' && res.data.game.crashpoint && res.data.game.starttime) {
          setMultiplier(res.data.game.crashpoint);
          lastStart = null;
          crashedAt = new Date(res.data.game.endtime || Date.now()).getTime();
        } else {
          setMultiplier(1.0);
          lastStart = null;
          crashedAt = null;
        }
        // Find my bet
        if (user && res.data.game.bets) {
          const found = res.data.game.bets.find((b: CrashBetData) => b.userId === user.id);
          setMyBet(found || null);
        }
        // Betting countdown logic (set to 1 second)
        if (res.data.game.status === 'pending' && res.data.game.starttime) {
          const start = new Date(res.data.game.starttime).getTime();
          const now = Date.now();
          const secondsLeft = 1 - Math.floor((now - start) / 1000);
          setBettingCountdown(secondsLeft > 0 ? secondsLeft : 0);
        } else {
          setBettingCountdown(null);
        }
      } catch (e: any) {
        setError('Failed to fetch game status');
      }
    };

    // Animation loop for real-time multiplier
    const animate = () => {
      if (game && game.status === 'running' && game.starttime && !crashedAt) {
        const start = lastStart || new Date(game.starttime).getTime();
        const now = Date.now();
        const seconds = (now - start) / 1000;
        const crashSeconds = game.crashpoint ? Math.log(game.crashpoint) / 0.05 : 0;
        if (seconds >= crashSeconds) {
          // Instantly set to crash value
          setMultiplier(game.crashpoint || 1.0);
          return;
        }
        setMultiplier(Math.max(1, Math.floor((100 * Math.exp(0.05 * seconds))) / 100));
        animationFrame = requestAnimationFrame(animate);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);

    // Start animation if running
    if (game && game.status === 'running' && game.starttime) {
      lastStart = new Date(game.starttime).getTime();
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      clearInterval(interval);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [user, game?.status, game?.starttime, game?.crashpoint, game?.endtime]);

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
      <div className="mb-4">
        <span className="text-4xl font-mono font-bold text-green-600">{multiplier.toFixed(2)}x</span>
        <span className="ml-2 text-gray-500">{game?.status === 'crashed' ? 'CRASHED' : game?.status?.toUpperCase()}</span>
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
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mb-4"
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
