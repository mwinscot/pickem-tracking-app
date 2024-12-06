'use client';

import { useState, useEffect, CSSProperties } from 'react';

type Player = {
  id: string;
  name: string;
  picks_remaining: number;
  points: number;
};

const tableStyles: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '80px 20px',
  textAlign: 'center',
};

const cellStyles: CSSProperties = {
  textAlign: 'center',
  width: '33.33%',
};

const playerNameStyles: CSSProperties = {
  fontSize: '48px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  padding: '20px 0',
  textAlign: 'center',
};

const scoreStyles: CSSProperties = {
  fontSize: '120px',
  fontWeight: 900,
  fontFamily: 'monospace',
  padding: '20px 0',
  textAlign: 'center',
};

const leaderStyles: CSSProperties = {
  color: '#16a34a',
};

const notLeaderStyles: CSSProperties = {
  color: '#1f2937',
};

const picksLeftStyles: CSSProperties = {
  fontSize: '18px',
  color: '#6b7280',
  fontWeight: 500,
  padding: '10px 0',
  textAlign: 'center',
};

// Initial data structure matching the expected format
const initialPlayers: Player[] = [
  { id: '1', name: 'Todd', picks_remaining: 50, points: 0 },
  { id: '2', name: 'Mike', picks_remaining: 50, points: 0 },
  { id: '3', name: 'Jeff', picks_remaining: 50, points: 0 }
];

export default function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/players');
        if (!response.ok) return;
        const data = await response.json();
        
        if (data) {
          const playerMap = new Map(data.map((p: Player) => [p.name, p]));
          const orderedPlayers = ['Todd', 'Mike', 'Jeff']
            .map(name => playerMap.get(name))
            .filter((p): p is Player => p !== undefined);
          if (orderedPlayers.length > 0) {
            setPlayers(orderedPlayers);
          }
        }
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };

    fetchPlayers();
    const intervalId = setInterval(fetchPlayers, 5000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  // Find the highest score
  const highestScore = Math.max(...players.map(p => p.points));

  return (
    <table style={tableStyles}>
      <thead>
        <tr>
          {players.map(player => (
            <th key={player.id} style={cellStyles}>
              <div style={{
                ...playerNameStyles,
                ...(player.points === highestScore ? leaderStyles : notLeaderStyles)
              }}>
                {player.name}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {players.map(player => (
            <td key={player.id} style={cellStyles}>
              <div style={{
                ...scoreStyles,
                ...(player.points === highestScore ? leaderStyles : notLeaderStyles)
              }}>
                {player.points}
              </div>
            </td>
          ))}
        </tr>
        <tr>
          {players.map(player => (
            <td key={player.id} style={cellStyles}>
              <div style={picksLeftStyles}>
                {player.picks_remaining} picks left
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}