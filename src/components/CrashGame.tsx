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
  bettingwindowend?: string; // ensure correct field name
}

interface CrashBetData {
  id: string;
  userId: string;
  amount: number;
  cashoutAt?: number;
  createdAt: string;
  gameId?: string; // add this line
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
  const [showCrashEffect, setShowCrashEffect] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [displayedMultiplier, setDisplayedMultiplier] = useState(1.0);

  // Ably real-time integration
  useEffect(() => {
    if (!import.meta.env.VITE_ABLY_PUBLIC_KEY) return;
    // Force Ably to use WebSockets for lowest latency
    const ably = new Ably.Realtime({
      key: import.meta.env.VITE_ABLY_PUBLIC_KEY,
      transports: ['web_socket'],
    });
    ably.connection.on((stateChange) => {
      console.log('[DEBUG] Ably connection state:', stateChange.current);
    });
    const channel = ably.channels.get('crashgame');

    // Listen for multiplier updates
    channel.subscribe('multiplier', (msg) => {
      setMultiplier(msg.data.multiplier);
      setDisplayedMultiplier(msg.data.multiplier);
    });
    // Listen for crash event
    channel.subscribe('crash', (msg) => {
      setMultiplier(msg.data.crashpoint);
      setDisplayedMultiplier(msg.data.crashpoint);
      setShowCrashEffect(true);
      setTimeout(() => {
        setShowCrashEffect(false);
        setDisplayedMultiplier(1.0);
      }, 1200);
    });
    // Listen for paused event
    channel.subscribe('paused', () => {
      axios.get('/api/crash/status').then(res => setGame(res.data.game));
    });
    // Listen for pending/newgame event
    channel.subscribe('pending', () => {
      console.log('[DEBUG] Ably pending event received at', new Date().toISOString());
      axios.get('/api/crash/status').then(res => {
        setGame(res.data.game);
        console.log('[DEBUG] Game after pending event:', res.data.game);
      });
    });
    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, []);

  // Reset multiplier and bet state when a new game starts
  // Reset multiplier and bet state when a new game starts or after a crash
  useEffect(() => {
    if (!game) return;
    if (game.status === 'pending') {
      setMultiplier(1.0);
      setDisplayedMultiplier(1.0);
      setMyBet(null);
      setIsCashedOut(false);
      setBetAmount('');
    }
    // No need to reset displayedMultiplier in 'crashed' status here
  }, [game?.id, game?.status]);

  useEffect(() => {
    if (!game || game.status !== 'pending') {
      setCountdown(null);
      return;
    }
    // Use bettingwindowend if available, otherwise fallback to 15s
    let end: number | null = null;
    if (game.bettingwindowend) {
      end = new Date(game.bettingwindowend).getTime();
    } else if (game.status === 'pending') {
      // fallback: assume 15s from starttime
      end = new Date(game.starttime).getTime() + 15000;
    }
    if (!end) {
      setCountdown(null);
      return;
    }
    function getSecondsLeft() {
      const now = Date.now();
      let left = Math.ceil((end! - now) / 1000);
      return left > 0 ? left : 0;
    }
    // Debug: print bettingwindowend/starttime and now
    console.log('[DEBUG] bettingwindowend:', game.bettingwindowend, 'starttime:', game.starttime, 'local now:', new Date().toISOString(), 'diff:', ((end - Date.now()) / 1000), 's');
    setCountdown(getSecondsLeft());
    const interval = setInterval(() => {
      setCountdown(getSecondsLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, [game?.id, game?.status, game?.bettingwindowend, game?.starttime]);

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

  // Initial fetch of game state on mount
  useEffect(() => {
    axios.get('/api/crash/status').then(res => setGame(res.data.game));
  }, []);

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
      setMyBet({ ...res.data.bet, gameId: game?.id });
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

  // After a crash, poll for a new pending game every 2s until found
  useEffect(() => {
    if (game?.status === 'crashed') {
      const interval = setInterval(() => {
        axios.get('/api/crash/status').then(res => {
          if (res.data.game?.status === 'pending') {
            setGame(res.data.game);
          }
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [game?.status]);

  // Poll for game status if betting is closed but round hasn't started
  useEffect(() => {
    if (game?.status === 'pending' && countdown === 0) {
      const interval = setInterval(() => {
        axios.get('/api/crash/status').then(res => {
          if (res.data.game) setGame(res.data.game);
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [game?.status, countdown]);

  // Fallback polling: If not in pending, poll every second for a new pending game
  useEffect(() => {
    let stopped = false;
    if (!game || game.status !== 'pending') {
      const interval = setInterval(() => {
        if (stopped) return;
        axios.get('/api/crash/status').then(res => {
          if (res.data.game && res.data.game.status === 'pending') {
            setGame(res.data.game);
            stopped = true; // Stop polling if we get a pending game
            clearInterval(interval);
          }
        });
      }, 1000);
      return () => {
        stopped = true;
        clearInterval(interval);
      };
    }
  }, [game]);

  // Debug logs for troubleshooting
  useEffect(() => {
    console.log('[DEBUG] game:', game);
    console.log('[DEBUG] game.status:', game?.status);
    console.log('[DEBUG] game.id:', game?.id);
    console.log('[DEBUG] bets:', game?.bets?.length);
    console.log('[DEBUG] countdown:', countdown);
    console.log('[DEBUG] isBetting:', isBetting);
    console.log('[DEBUG] bet input disabled:', isBetting || !game || game.status !== 'pending');
    console.log('[DEBUG] bet button disabled:', isBetting || !betAmount || !game || game.status !== 'pending');
  }, [game, countdown, isBetting, betAmount]);

  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Crash Game</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <div className="mb-4 relative">
        <span className="text-4xl font-mono font-bold text-green-600">{displayedMultiplier.toFixed(2)}x</span>
        <span className="ml-2 text-gray-500">{game?.status === 'crashed' ? 'CRASHED' : game?.status?.toUpperCase()}</span>
        {showCrashEffect && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-extrabold text-red-600 animate-bounce z-10" style={{ pointerEvents: 'none' }}>
            💥 CRASHED!
          </span>
        )}
        {/* Show countdown during betting window or paused state */}
        {game?.status === 'pending' && countdown !== null && (
          <span className="absolute right-0 top-0 text-lg font-bold text-blue-600 bg-white bg-opacity-80 px-2 py-1 rounded shadow">
            Betting ends in: {countdown}s
          </span>
        )}
        {game?.status === 'paused' && (
          <span className="absolute right-0 top-0 text-lg font-bold text-gray-500 bg-white bg-opacity-80 px-2 py-1 rounded shadow">
            Next round in 2s...
          </span>
        )}
      </div>
      {game?.status === 'paused' && (
        <div className="mb-2 text-center text-gray-500 font-semibold text-lg animate-pulse">
          Paused... Next round starting soon!
        </div>
      )}
      {game?.status === 'pending' && countdown !== null && (
        <div className="mb-2 text-center text-blue-700 font-semibold text-lg animate-pulse">
          {countdown > 0 ? (
            <>Place your bets! Round starts in {countdown}s</>
          ) : (
            <>Betting closed. Waiting for round to start...</>
          )}
        </div>
      )}
      <div className="flex items-center space-x-2 mb-4">
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="border px-2 py-1 rounded"
          placeholder="Bet amount"
          value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          disabled={isBetting || !game || game.status !== 'pending' || countdown === 0}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => {
            if (!user) {
              setError('You must be logged in to place a bet.');
              return;
            }
            handleBet();
          }}
          disabled={isBetting || !betAmount || !game || game.status !== 'pending' || countdown === 0}
        >
          Place Bet
        </button>
      </div>
      {user && myBet && !isCashedOut && game?.status === 'running' && (
        <button
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mb-4 animate-pulse"
          onClick={handleCashout}
        >
          Cash Out
        </button>
      )}
      {/* Only show 'Your bet:' if the bet is for the current game and the game is not pending */}
      {myBet && game && game.status !== 'pending' && myBet.gameId === game.id && (
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
