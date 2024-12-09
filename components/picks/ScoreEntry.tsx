'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { formatPick } from '@/utils/pick-parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Pick {
  id: string;
  user_id: string;
  team: string;
  spread: number;
  over_under: number;
  is_favorite: boolean;
  is_over: boolean;
  status: 'pending' | 'completed';
  winner?: boolean;
  users?: {
    name: string;
  };
  formatted_pick?: string;
}

interface PendingGame {
  team: string;
  team_score: string;
  other_score: string;
  picks: Pick[];
}

export default function ScoreEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingGames, setPendingGames] = useState<Map<string, PendingGame>>(new Map());
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

    // Group picks by team
    const gameMap = new Map<string, PendingGame>();
    data?.forEach(pick => {
      if (!gameMap.has(pick.team)) {
        gameMap.set(pick.team, {
          team: pick.team,
          team_score: '',
          other_score: '',
          picks: []
        });
      }
      const game = gameMap.get(pick.team);
      if (game) {
        game.picks.push({
          ...pick,
          formatted_pick: formatPick({
            team: pick.team,
            spread: pick.spread,
            over_under: pick.over_under,
            is_favorite: pick.is_favorite,
            is_over: pick.is_over,
            pick_type: pick.over_under > 0 ? 'over_under' : 'spread'
          })
        });
      }
    });

    setPendingGames(gameMap);
  }, [selectedDate]);

  useEffect(() => {
    fetchPendingPicks();
  }, [fetchPendingPicks]);

  const handleScoreChange = (team: string, scoreType: 'team' | 'other', value: string) => {
    setPendingGames(prevGames => {
      const newGames = new Map(prevGames);
      const game = newGames.get(team);
      if (game) {
        game[`${scoreType}_score`] = value;
        newGames.set(team, { ...game });
      }
      return newGames;
    });
  };

  const handleSubmitScore = async (team: string) => {
    const game = pendingGames.get(team);
    if (!game) return;

    const total = Number(game.team_score) + Number(game.other_score);
    const gamePicks = game.picks;
    
    try {
      const updatesToSend = gamePicks.map(pick => {
        const isWinner = pick.over_under > 0 
          ? (() => {
              const isOver = total > pick.over_under;
              return isOver === pick.is_over;
            })()
          : (() => {
              const margin = Number(game.team_score) - Number(game.other_score);
              return margin > (pick.is_favorite ? -pick.spread : pick.spread);
            })();
   
        // Update user points if pick is a winner
        if (isWinner) {
          const updateUserPoints = async () => {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('points')
              .eq('id', pick.user_id)
              .single();
   
            if (!userError) {
              await supabase
                .from('users')
                .update({ points: (userData.points || 0) + 1 })
                .eq('id', pick.user_id);
            }
          };
          updateUserPoints();
        }
   
        return {
          ...pick,
          status: 'completed',
          winner: isWinner
        };
      });
   
      const { error } = await supabase
        .from('picks')
        .upsert(updatesToSend);
   
      if (error) throw error;
   
      setMessage(`Scores updated successfully for ${team}!`);
      setPendingGames(prevGames => {
        const newGames = new Map(prevGames);
        newGames.delete(team);
        return newGames;
      });
      await fetchPendingPicks();
    } catch (err: any) {
      console.error('Error updating scores:', err);
      setMessage(`Error updating scores: ${err.message}`);
    }
  };

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

      {message && (
        <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
          {message}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Pending Games for {selectedDate}</h3>
        {pendingGames.size === 0 ? (
          <div className="text-gray-500">No pending games for this date.</div>
        ) : (
          <div className="space-y-6">
            {Array.from(pendingGames.entries()).map(([team, game]) => (
              <div key={team} className="bg-white shadow rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {game.team} Score
                    </label>
                    <input
                      type="number"
                      value={game.team_score}
                      onChange={(e) => handleScoreChange(team, 'team', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Score"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Other Team Score
                    </label>
                    <input
                      type="number"
                      value={game.other_score}
                      onChange={(e) => handleScoreChange(team, 'other', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Score"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Picks for this game:</h4>
                  <div className="space-y-2">
                    {game.picks.map((pick) => (
                      <div key={pick.id} className="text-sm text-gray-600">
                        {pick.users?.name}: {pick.formatted_pick}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSubmitScore(team)}
                  disabled={!game.team_score || !game.other_score}
                  className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Update Score
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}