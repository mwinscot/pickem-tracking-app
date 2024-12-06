'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Pick = {
  id: string;
  user_id: string;
  team: string;
  spread: number;
  is_favorite: boolean;
  status: string;
  created_at: string;
  game_date: string;
  users: {
    name: string;
  };
};

export default function ScoreEntry() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [message, setMessage] = useState('');

  const fetchPendingPicks = useCallback(async () => {
    const { data, error } = await supabase
      .from('picks')
      .select(`
        *,
        users (
          name
        )
      `)
      .eq('status', 'pending')
      .eq('game_date', selectedDate);

    if (error) {
      console.error('Error fetching picks:', error);
      return;
    }

    setPicks(data || []);
  }, [selectedDate]);

  useEffect(() => {
    fetchPendingPicks();
  }, [fetchPendingPicks]);

  const gradePick = (
    pick: Pick,
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number
  ): 'win' | 'loss' | 'tie' => {
    const actualMargin = homeScore - awayScore;
    const isHomeTeam = pick.team.toLowerCase() === homeTeam.toLowerCase();
    const effectiveMargin = isHomeTeam ? actualMargin : -actualMargin;
    const spreadTocover = pick.is_favorite ? -pick.spread : pick.spread;
    
    if (effectiveMargin === spreadTocover) {
      return 'tie';
    }
    
    return effectiveMargin > spreadTocover ? 'win' : 'loss';
  };

  const handleSubmitScore = async () => {
    if (!homeTeam || !awayTeam || !homeScore || !awayScore) {
      setMessage('Please fill in all fields');
      return;
    }

    const hScore = parseInt(homeScore);
    const aScore = parseInt(awayScore);

    for (const pick of picks) {
      if (
        pick.team.toLowerCase() === homeTeam.toLowerCase() ||
        pick.team.toLowerCase() === awayTeam.toLowerCase()
      ) {
        const result = gradePick(pick, homeTeam, awayTeam, hScore, aScore);
        
        const { error: pickError } = await supabase
          .from('picks')
          .update({ status: result })
          .eq('id', pick.id);

        if (pickError) {
          console.error('Error updating pick:', pickError);
          continue;
        }

        if (result === 'win') {
          const { error: userError } = await supabase
            .from('users')
            .update({ points: supabase.rpc('increment', { inc: 1 }) })
            .eq('id', pick.user_id);

          if (userError) {
            console.error('Error updating user points:', userError);
          }
        }

        if (result === 'tie') {
          const { error: tieError } = await supabase
            .from('users')
            .update({ picks_remaining: supabase.rpc('increment', { inc: 1 }) })
            .eq('id', pick.user_id);

          if (tieError) {
            console.error('Error returning pick for tie:', tieError);
          }
        }
      }
    }

    setMessage('Scores updated successfully');
    setHomeTeam('');
    setAwayTeam('');
    setHomeScore('');
    setAwayScore('');
    fetchPendingPicks();
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Enter Game Scores</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">
          Game Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Home Team
          </label>
          <input
            type="text"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Home Team"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Home Score
          </label>
          <input
            type="number"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Score"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Away Team
          </label>
          <input
            type="text"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Away Team"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Away Score
          </label>
          <input
            type="number"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Score"
          />
        </div>
      </div>

      <button
        onClick={handleSubmitScore}
        className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
      >
        Update Scores
      </button>

      {message && (
        <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
          {message}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Pending Picks for {selectedDate}</h3>
        <div className="space-y-2">
          {picks.map((pick) => (
            <div key={pick.id} className="p-3 bg-gray-50 rounded-md">
              <span className="font-medium">{pick.users?.name}</span>: {pick.team}{' '}
              {pick.is_favorite ? 'minus' : 'plus'} {pick.spread}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}