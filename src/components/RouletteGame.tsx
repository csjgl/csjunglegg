import React, { useEffect, useState } from 'react';
import axios from 'axios';

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
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<RouletteGameData[]>([]);

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
      setResult(null);
    } else if (game?.status === 'finished') {
      setRolling(false);
      setResult(game.color || null);
    }
  }, [game?.status, game?.color]);

  // Wheel animation state
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);

  // Animate the wheel when spinning
  useEffect(() => {
    if (game?.status === 'spinning' && game.color) {
      setSpinning(true);
      // Pick a random angle for the result color
      const colorIndex = ['red','black','red','black','red','black','red','black','red','black','green'].indexOf(game.color);
      const angle = 360 * 5 + (colorIndex * (360 / 11)); // 5 full spins + result
      setTimeout(() => {
        setWheelAngle(angle);
        setTimeout(() => {
          setSpinning(false);
          setSpinResult(game.color!);
        }, 2000);
      }, 200); // slight delay for effect
    } else if (game?.status === 'pending') {
      setWheelAngle(0);
      setSpinResult(null);
      setSpinning(false);
    }
  }, [game?.status, game?.color]);

  const handleBet = async () => {
    if (!betAmount) return;
    await axios.post('/api/roulette/bet', { gameId: game?.id, color: betColor, amount: Number(betAmount) });
  };

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
      {/* Wheel animation */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-32 h-32 mb-2">
          <div
            className="absolute w-full h-full rounded-full border-4 border-gray-300"
            style={{
              transition: spinning ? 'transform 2s cubic-bezier(0.23, 1, 0.32, 1)' : 'none',
              transform: `rotate(${wheelAngle}deg)`
            }}
          >
            {/* Render 11 segments for the wheel */}
            {['red','black','red','black','red','black','red','black','red','black','green'].map((color, i) => (
              <div
                key={i}
                className={`absolute left-1/2 top-1/2 w-1/2 h-1/2 origin-bottom rotate-${i * (360/11)}`}
                style={{
                  background: color,
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
                  transform: `rotate(${i * (360/11)}deg) translate(-50%, -100%)`
                }}
              />
            ))}
          </div>
          {/* Pointer */}
          <div className="absolute left-1/2 top-0 w-0 h-0 border-l-8 border-r-8 border-b-12 border-l-transparent border-r-transparent border-b-yellow-400" style={{transform: 'translateX(-50%)'}} />
        </div>
        {spinning && <div className="text-lg font-bold animate-pulse">Spinning...</div>}
        {spinResult && <div className="text-lg font-bold">Result: <span className={spinResult === 'green' ? 'text-green-600' : spinResult === 'red' ? 'text-red-600' : 'text-black'}>{spinResult}</span></div>}
      </div>
      {/* TODO: Add bet history, etc. */}
    </div>
  );
};

export default RouletteGame;
