import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { gsap } from 'gsap';
import Ably from 'ably';

interface RouletteGameData {
  id: string;
  starttime: string;
  endtime?: string;
  status: string;
  bettingwindowend?: string;
  color?: string;
  number?: number;
}

const RouletteGame: React.FC = () => {
  const [game, setGame] = useState<RouletteGameData | null>(null);
  const [betColor, setBetColor] = useState<string>('red');
  const [betAmount, setBetAmount] = useState('');
  const [countdown, setCountdown] = useState<number>(0);
  const [history, setHistory] = useState<RouletteGameData[]>([]);
  // Remove ablyChannel state, not needed

  useEffect(() => {
    axios.get('/api/roulette/status').then(res => setGame(res.data.game));
  }, []);

  useEffect(() => {
    if (!game || !game.bettingwindowend) return;
    const end = new Date(game.bettingwindowend).getTime();
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCountdown(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [game?.id, game?.bettingwindowend]);

  useEffect(() => {
    axios.get('/api/roulette/history').then(res => {
      // Only show games that are finished and in the past
      const now = Date.now();
      setHistory(
        res.data.games.filter((g: RouletteGameData) => g.status === 'finished' && new Date(g.starttime).getTime() < now)
      );
    });
  }, [game?.id]);

  // Show a simple rolling animation when spinning
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (game?.status === 'spinning') {
      setRolling(true);
    } else if (game?.status === 'finished') {
      setRolling(false);
    }
  }, [game?.status]);

  // Tape animation state for classic roulette
  const [tapeAnimating, setTapeAnimating] = useState(false);
  const [tapeResult, setTapeResult] = useState<string | null>(null);
  const tapeRef = React.useRef<HTMLDivElement>(null);
  const colorOrder = ['red','black','red','black','red','black','red','black','red','black','green'];
  const TAPE_REPEAT = 8; // How many times to repeat the color sequence for a long tape
  const SEGMENT_WIDTH = 40; // px, width of each color segment
  const TAPE_LENGTH = colorOrder.length * TAPE_REPEAT;

  // Animate the tape when spinning using GSAP
  useEffect(() => {
    if (game?.status === 'spinning' && game.color) {
      setTapeAnimating(true);
      // Find the index of the result in the last repeat (so it lands under the pointer)
      const resultIndex = (colorOrder.length * (TAPE_REPEAT - 2)) + colorOrder.lastIndexOf(game.color);
      const targetOffset = -(resultIndex * SEGMENT_WIDTH) + (Math.floor(TAPE_LENGTH / 2) * SEGMENT_WIDTH);
      if (tapeRef.current) {
        // Reset tape to start position instantly
        gsap.set(tapeRef.current, { x: 0 });
        // Animate tape to target offset
        gsap.to(tapeRef.current, {
          x: targetOffset,
          duration: 2.5,
          ease: 'power4.out',
          onComplete: () => {
            setTapeAnimating(false);
            setTapeResult(game.color!);
          }
        });
      }
    } else if (game?.status === 'pending') {
      if (tapeRef.current) {
        gsap.set(tapeRef.current, { x: 0 });
      }
      setTapeResult(null);
      setTapeAnimating(false);
    }
  }, [game?.status, game?.color]);

  const handleBet = async () => {
    if (!betAmount) return;
    await axios.post('/api/roulette/bet', { gameId: game?.id, color: betColor, amount: Number(betAmount) });
  };

  // Ably real-time integration for roulette
  useEffect(() => {
    if (!import.meta.env.VITE_ABLY_PUBLIC_KEY) return;
    const ably = new Ably.Realtime({
      key: import.meta.env.VITE_ABLY_PUBLIC_KEY,
      transports: ['web_socket'],
    });
    const channel = ably.channels.get('roulette');
    channel.subscribe('pending', () => {
      axios.get('/api/roulette/status').then(res => setGame(res.data.game));
      axios.get('/api/roulette/history').then(res => {
        const now = Date.now();
        setHistory(res.data.games.filter((g: RouletteGameData) => g.status === 'finished' && new Date(g.starttime).getTime() < now));
      });
    });
    channel.subscribe('spinning', () => {
      axios.get('/api/roulette/status').then(res => setGame(res.data.game));
    });
    channel.subscribe('result', () => {
      axios.get('/api/roulette/status').then(res => setGame(res.data.game));
      axios.get('/api/roulette/history').then(res => {
        const now = Date.now();
        setHistory(res.data.games.filter((g: RouletteGameData) => g.status === 'finished' && new Date(g.starttime).getTime() < now));
      });
    });
    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, []);

  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Roulette (Double)</h2>
      <div className="mb-4">
        <span className="text-lg">
          {game?.status === 'pending' && `Betting ends in: ${countdown}s`}
          {rolling && <span className="animate-spin inline-block ml-2">🎯 Rolling...</span>}
          {game?.status === 'finished' && !rolling && `Result: ${game.color}`}
        </span>
      </div>
      <div className="flex items-center space-x-2 mb-4">
        <select value={betColor} onChange={e => setBetColor(e.target.value)} className="border px-2 py-1 rounded">
          <option value="red">Red</option>
          <option value="black">Black</option>
          <option value="green">Green</option>
        </select>
        <input type="number" min="0.01" step="0.01" className="border px-2 py-1 rounded" placeholder="Bet amount" value={betAmount} onChange={e => setBetAmount(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={handleBet} disabled={game?.status !== 'pending' || countdown <= 0}>Place Bet</button>
      </div>
      {game?.status === 'finished' && (
        <div className="mb-2 text-center text-lg font-bold">Winning color: <span className={game.color === 'green' ? 'text-green-600' : game.color === 'red' ? 'text-red-600' : 'text-black'}>{game.color}</span></div>
      )}
      {/* Show last 15 finished colors */}
      <div className="flex items-center justify-center space-x-1 mt-4">
        {history.slice(0, 15).map((g, i) => (
          <span key={g.id || i} className={`w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold ${g.color === 'green' ? 'bg-green-500 text-white' : g.color === 'red' ? 'bg-red-500 text-white' : 'bg-black text-white'}`}>{g.color?.charAt(0).toUpperCase()}</span>
        ))}
      </div>
      {/* Classic roulette tape animation */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-[440px] h-16 mb-2 overflow-hidden">
          <div
            ref={tapeRef}
            className="absolute top-0 left-0 flex h-16"
            style={{ width: `${TAPE_LENGTH * SEGMENT_WIDTH}px` }}
          >
            {Array.from({ length: TAPE_REPEAT }).flatMap((_, rep) =>
              colorOrder.map((color, i) => (
                <div
                  key={`${rep}-${i}`}
                  className={`flex items-center justify-center h-16`}
                  style={{
                    width: `${SEGMENT_WIDTH}px`,
                    background: color,
                    borderTopLeftRadius: i === 0 ? 8 : 0,
                    borderBottomLeftRadius: i === 0 ? 8 : 0,
                    borderTopRightRadius: i === colorOrder.length - 1 ? 8 : 0,
                    borderBottomRightRadius: i === colorOrder.length - 1 ? 8 : 0,
                    border: '2px solid #ccc',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 20,
                    textShadow: '0 1px 2px #0008',
                  }}
                >
                  {color === 'green' ? '0' : ''}
                </div>
              ))
            }
          </div>
          {/* Center pointer */}
          <div className="absolute top-0 left-1/2 h-16 w-0.5 bg-yellow-400" style={{ transform: 'translateX(-50%)' }} />
          <div className="absolute top-0 left-1/2 w-0 h-0 border-l-8 border-r-8 border-b-12 border-l-transparent border-r-transparent border-b-yellow-400" style={{ transform: 'translate(-50%, -60%)' }} />
        </div>
        {tapeAnimating && <div className="text-lg font-bold animate-pulse">Spinning...</div>}
        {tapeResult && <div className="text-lg font-bold">Result: <span className={tapeResult === 'green' ? 'text-green-600' : tapeResult === 'red' ? 'text-red-600' : 'text-black'}>{tapeResult}</span></div>}
      </div>
      {/* TODO: Add bet history, etc. */}
    </div>
  );
};

export default RouletteGame;
