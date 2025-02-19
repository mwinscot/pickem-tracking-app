'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { formatPick } from '@/utils/pick-parser';
import { toPSTDate } from '@/utils/date-utils';

interface Pick {
  id: string;
  user_id: string;
  team: string;
  spread: number;
  over_under: number;
  is_favorite: boolean;
  is_over: boolean;
  status: 'pending' | 'completed';
  game_date: string;
  bet_type: 'spread' | 'over_under';
  winner?: boolean;
  users?: {
    name: string;
  };
  formatted_pick?: string;
}

interface TeamGame {
  team: string;
  team_score: string;  // Changed to only string type
  other_score: string; // Changed to only string type
  spread_picks: Pick[];
  over_under_picks: Pick[];
  game_date: string;
}

// Helper function to determine if a pick is a winner
const calculateWinner = (
  pick: Pick, 
  teamScore: number, 
  otherScore: number
): boolean => {
  const total = teamScore + otherScore;
  const margin = teamScore - otherScore;

  if (pick.over_under > 0) { // Over/Under bet
    if (total === pick.over_under) {
      return false; // Push/loss on exact matches for over/under
    }
    const isOver = total > pick.over_under;
    return isOver === pick.is_over;
  } else { // Spread bet
    if (pick.is_favorite) {
      // Favorite needs to win by more than the spread
      const covered = margin >= Math.abs(pick.spread);  // Changed > to >= for push scenarios
      return covered;
    } else {
      // Underdog needs to lose by less than the spread (or win outright)
      const covered = margin + Math.abs(pick.spread) >= 0;  // Changed > to >= for push scenarios
      return covered;
    }
  }
};

export default function ScoreEntry() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [pendingGames, setPendingGames] = useState<Record<string, TeamGame>>({});
  const [uniqueTeams, setUniqueTeams] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [scores, setScores] = useState<Record<string, { team: string, other: string }>>({});

  const fetchPendingPicks = useCallback(async () => {
    const { data, error } = await supabase
      .from('picks')
      .select(`*, users(name)`)
      .neq('status', 'completed')
      .order('game_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching picks:', error);
      return;
    }

    if (!data || data.length === 0) {
      setPendingGames({});
      setUniqueTeams([]);
      return;
    }

    const gamesMap: Record<string, TeamGame> = {};
    const uniqueTeams = new Set<string>();
    
    data.forEach(pick => {
      uniqueTeams.add(pick.team);
      
      if (!gamesMap[pick.team]) {
        gamesMap[pick.team] = {
          team: pick.team,
          team_score: '',
          other_score: '',
          spread_picks: [],
          over_under_picks: [],
          game_date: pick.game_date
        };
      }

      const game = gamesMap[pick.team];
      const betType = pick.over_under > 0 ? 'over_under' : 'spread';
      const formattedPick = {
        ...pick,
        bet_type: betType,
        formatted_pick: formatPick({
          team: pick.team,
          spread: betType === 'spread' ? pick.spread : 0,
          over_under: betType === 'over_under' ? pick.over_under : 0,
          is_favorite: betType === 'spread' ? pick.is_favorite : false,
          is_over: betType === 'over_under' ? pick.is_over : false,
          pick_type: betType
        })
      };

      if (betType === 'spread') {
        game.spread_picks.push(formattedPick);
      } else {
        game.over_under_picks.push(formattedPick);
      }
    });
    
    setPendingGames(gamesMap);
    setUniqueTeams(Array.from(uniqueTeams));
  }, [supabase]);

  useEffect(() => {
    fetchPendingPicks();
  }, [fetchPendingPicks]);

  const handleScoreChange = (team: string, scoreType: 'team' | 'other', value: string) => {
    setScores(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        [scoreType]: value
      }
    }));
  };

  useEffect(() => {
    console.log('Pending games state updated:', pendingGames);
  }, [pendingGames]);
  
  const handleSubmitScore = async (team: string) => {
    const game = pendingGames[team];
    const teamScores = scores[team];
    
    if (!game || !teamScores) return;
  
    const teamScore = parseInt(teamScores.team, 10);
    const otherScore = parseInt(teamScores.other, 10);
  
    if (isNaN(teamScore) || isNaN(otherScore)) {
      setMessage('Please enter valid scores');
      return;
    }
  
    const allPicks = [...game.spread_picks, ...game.over_under_picks];
    
    try {
      // Start transaction
      const updates = [];
      const userPointsMap = new Map<string, { userId: string, currentPoints: number }>();

      // First get current points for all users involved
      for (const pick of allPicks) {
        if (!userPointsMap.has(pick.user_id)) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('points')
            .eq('id', pick.user_id)
            .single();

          if (!userError && userData) {
            userPointsMap.set(pick.user_id, {
              userId: pick.user_id,
              currentPoints: userData.points || 0
            });
          }
        }
      }

      // Prepare all updates
      for (const pick of allPicks) {
        const isWinner = calculateWinner(pick, teamScore, otherScore);
        
        updates.push({
          id: pick.id,
          user_id: pick.user_id,
          team: pick.team,
          spread: pick.spread,
          over_under: pick.over_under,
          is_favorite: pick.is_favorite,
          is_over: pick.is_over,
          status: 'completed',
          winner: isWinner,
          game_date: pick.game_date
        });

        // Log the update
        console.log('Pick update:', {
          team: pick.team,
          user: pick.users?.name,
          isWinner,
          currentPoints: userPointsMap.get(pick.user_id)?.currentPoints
        });
      }

      // Update picks first
      const { error: picksError } = await supabase
        .from('picks')
        .upsert(updates, { onConflict: 'id' });

      if (picksError) throw picksError;

      // Now update points for each user based on winners
      const pointPromises = Array.from(userPointsMap.values()).map(async ({ userId }) => {
        // Count total winners for this user
        const { data: winData, error: winError } = await supabase
          .from('picks')
          .select('winner')
          .eq('user_id', userId)
          .eq('winner', true);

        if (winError) throw winError;

        const totalWins = winData?.length || 0;

        // Update user's points to match their total winners
        return supabase
          .from('users')
          .update({ points: totalWins })
          .eq('id', userId);
      });

      await Promise.all(pointPromises);

      setMessage(`Scores updated successfully for ${team}!`);
      
      // Clear scores after successful submission
      setScores(prev => {
        const newScores = { ...prev };
        delete newScores[team];
        return newScores;
      });
      
      setPendingGames(prev => {
        const newGames = { ...prev };
        delete newGames[team];
        return newGames;
      });
  
      // Refresh picks to ensure sync
      await fetchPendingPicks();
  
    } catch (err: any) {
      console.error('Error updating scores:', err);
      setMessage(`Error updating scores: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Enter Game Scores</h2>

      {message && (
        <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
          {message}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">
          Pending Games
        </h3>
        
        {Object.keys(pendingGames).length === 0 ? (
          <div className="text-gray-500">No pending picks to score.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(pendingGames).map(([team, game]) => (
              <div key={team} className="bg-white shadow rounded-lg p-4">
                <h4 className="font-bold text-lg text-gray-900 mb-2">{team}</h4>
                <div className="text-sm text-gray-600 mb-4">
                  Game Date: {new Date(game.game_date).toLocaleDateString()}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {team} Score
                    </label>
                    <input
                      type="text"
                      value={scores[team]?.team || ''}
                      onChange={(e) => handleScoreChange(team, 'team', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Other Team Score
                    </label>
                    <input
                      type="text"
                      value={scores[team]?.other || ''}
                      onChange={(e) => handleScoreChange(team, 'other', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {game.spread_picks.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700 mb-2">Spread Picks:</h5>
                    <div className="space-y-1">
                      {game.spread_picks.map((pick) => (
                        <div key={pick.id} className="text-sm text-gray-600">
                          {pick.users?.name}: {pick.formatted_pick}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {game.over_under_picks.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-700 mb-2">Over/Under Picks:</h5>
                    <div className="space-y-1">
                      {game.over_under_picks.map((pick) => (
                        <div key={pick.id} className="text-sm text-gray-600">
                          {pick.users?.name}: {pick.formatted_pick}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleSubmitScore(team)}
                  disabled={!scores[team]?.team || !scores[team]?.other}
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