'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parsePick, formatPick } from '@/utils/pick-parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ScoreEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [message, setMessage] = useState('');
  const [picks, setPicks] = useState<any[]>([]);

  const handleSubmitScore = async () => {
    const total = Number(homeScore) + Number(awayScore);
    
    try {
      const updatesToSend = picks.map(pick => ({
        id: pick.id,
        user_id: pick.user_id,
        team: pick.team,
        spread: pick.spread,
        over_under: pick.over_under,
        is_favorite: pick.is_favorite,
        is_over: pick.is_over,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: Number(homeScore),
        away_score: Number(awayScore),
        status: 'completed',
        winner: pick.over_under > 0 
          ? (total > pick.over_under) === pick.is_over
          : ((pick.team.toLowerCase() === homeTeam.toLowerCase() 
              ? Number(homeScore) - Number(awayScore)
              : Number(awayScore) - Number(homeScore)) > 
             (pick.is_favorite ? -pick.spread : pick.spread))
      }));

      console.log('Updates:', updatesToSend);
      const { error } = await supabase
        .from('picks')
        .upsert(updatesToSend);

      if (error) {
        console.error('Full error:', JSON.stringify(error, null, 2));
        throw error;
      }

      setMessage('Scores updated successfully!');
      setHomeTeam('');
      setAwayTeam('');
      setHomeScore('');
      setAwayScore('');
      await fetchPendingPicks();
    } catch (err: any) {
      console.error('Catch error:', JSON.stringify(err, null, 2));
      setMessage(`Error updating scores: ${err.message}`);
    }
  };

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

    const formattedData = data?.map(pick => ({
      ...pick,
      formatted_pick: formatPick({
        team: pick.team,
        spread: pick.spread,
        over_under: pick.over_under,
        is_favorite: pick.is_favorite,
        is_over: pick.is_over,
        pick_type: pick.over_under > 0 ? 'over_under' : 'spread'
      })
    }));

    setPicks(formattedData || []);
  }, [selectedDate]);

  useEffect(() => {
    fetchPendingPicks();
  }, [fetchPendingPicks]);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Enter Game Scores</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">Game Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Home Team</label>
          <input
            type="text"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Home Team"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Home Score</label>
          <input
            type="number"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Score"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Away Team</label>
          <input
            type="text"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
            placeholder="Away Team"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Away Score</label>
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
              <span className="font-medium">{pick.users?.name}</span>: {pick.formatted_pick}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}