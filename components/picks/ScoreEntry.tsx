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
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: 'pending' | 'completed';
  winner?: boolean;
  users?: {
    name: string;
  };
  formatted_pick?: string;
}

interface Game {
  home_team: string;
  away_team: string;
  home_score: string;
  away_score: string;
  picks: Pick[];
}

interface GameMap {
  [key: string]: Game;
}

export default function ScoreEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingGames, setPendingGames] = useState<Map<string, Game>>(new Map());
  const [message, setMessage] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  
  // Fetch pending picks and organize them by game
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

    // Group picks by game and update state
    const gameMap = new Map<string, Game>();
    data?.forEach((pick: Pick) => {
      const gameKey = `${pick.home_team}-${pick.away_team}`;
      if (!gameMap.has(gameKey)) {
        gameMap.set(gameKey, {
          home_team: pick.home_team,
          away_team: pick.away_team,
          home_score: '',
          away_score: '',
          picks: []
        });
      }
      const game = gameMap.get(gameKey);
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
    setPicks(data || []);
  }, [selectedDate]);

  useEffect(() => {
    fetchPendingPicks();
  }, [fetchPendingPicks]);

  const handleScoreChange = (gameKey: string, team: 'home' | 'away', value: string) => {
    setPendingGames(prevGames => {
      const newGames = new Map(prevGames);
      const game = newGames.get(gameKey);
      if (game) {
        game[`${team}_score`] = value;
        newGames.set(gameKey, { ...game });
      }
      return newGames;
    });
  };

  const handleSubmitScore = async (gameKey: string) => {
    const game = pendingGames.get(gameKey);
    if (!game) return;

    const total = Number(game.home_score) + Number(game.away_score);
    const gamePicks = game.picks;
    
    try {
      const updatesToSend = gamePicks.map((pick: Pick) => {
        const isWinner = pick.over_under > 0 
          ? (() => {
              const isOver = total > pick.over_under;
              return isOver === pick.is_over;
            })()
          : ((pick.team.toLowerCase() === game.home_team.toLowerCase() 
              ? Number(game.home_score) - Number(game.away_score)
              : Number(game.away_score) - Number(game.home_score)) > 
             (pick.is_favorite ? -pick.spread : pick.spread));
   
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
          id: pick.id,
          user_id: pick.user_id,
          team: pick.team,
          spread: pick.spread,
          over_under: pick.over_under,
          is_favorite: pick.is_favorite,
          is_over: pick.is_over,
          home_team: game.home_team,
          away_team: game.away_team,
          home_score: Number(game.home_score),
          away_score: Number(game.away_score),
          status: 'completed',
          winner: isWinner
        } as Pick;
      });
   
      const { error } = await supabase
        .from('picks')
        .upsert(updatesToSend);
   
      if (error) throw error;
   
      setMessage(`Scores updated successfully for ${game.home_team} vs ${game.away_team}!`);
      setPendingGames(prevGames => {
        const newGames = new Map(prevGames);
        newGames.delete(gameKey);
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
            {Array.from(pendingGames.entries()).map(([gameKey, game]) => (
              <div key={gameKey} className="bg-white shadow rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {game.home_team} (Home)
                    </label>
                    <input
                      type="number"
                      value={game.home_score}
                      onChange={(e) => handleScoreChange(gameKey, 'home', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Score"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {game.away_team} (Away)
                    </label>
                    <input
                      type="number"
                      value={game.away_score}
                      onChange={(e) => handleScoreChange(gameKey, 'away', e.target.value)}
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
                  onClick={() => handleSubmitScore(gameKey)}
                  disabled={!game.home_score || !game.away_score}
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