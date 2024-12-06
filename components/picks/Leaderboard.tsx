'use client';

import { useState, useEffect, CSSProperties } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export default function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const fetchPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*');
        
        if (error) throw error;
        
        if (data) {
          const playerMap = new Map(data.map(p => [p.name, p]));
          const orderedPlayers = ['Todd', 'Mike', 'Jeff']
            .map(name => playerMap.get(name))
            .filter((p): p is Player => p !== undefined);
          setPlayers(orderedPlayers);
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