  'use client';

  import { useState, useCallback, useEffect } from 'react';
  import { createClient } from '@supabase/supabase-js';
  import { formatPick } from '@/utils/pick-parser';
  import { toPSTDate, getDateRange } from '@/utils/date-utils';

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
    team_score: string;
    other_score: string;
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

    console.log('Calculating winner:', {
      pick: pick.team,
      teamScore,
      otherScore,
      margin,
      spread: pick.spread,
      is_favorite: pick.is_favorite,
      is_over: pick.is_over,
      over_under: pick.over_under
    });

    if (pick.over_under > 0) { // Over/Under bet
      const isOver = total > pick.over_under;
      console.log('Over/Under calculation:', { total, line: pick.over_under, isOver, picked_over: pick.is_over });
      return isOver === pick.is_over;
    } else { // Spread bet
      if (pick.is_favorite) {
        // Favorite needs to win by more than the spread
        const covered = margin > pick.spread;
        console.log('Favorite calculation:', { margin, spread: pick.spread, covered });
        return covered;
      } else {
        // Underdog needs to lose by less than the spread (or win outright)
        const covered = margin + pick.spread > 0;
        console.log('Underdog calculation:', { margin, spread: pick.spread, adjusted_margin: margin + pick.spread, covered });
        return covered;
      }
    }
  };

  export default function ScoreEntry() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
    const [selectedDate, setSelectedDate] = useState(toPSTDate(new Date().toISOString().split('T')[0]));
    const [pendingGames, setPendingGames] = useState<Map<string, TeamGame>>(new Map());
    const [uniqueTeams, setUniqueTeams] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');
  
    const fetchPendingPicks = useCallback(async () => {
      const dateRange = getDateRange(selectedDate);
      
      const { data, error } = await supabase
        .from('picks')
        .select(`
          *,
          users (
            name
          )
        `)
        .in('game_date', dateRange)
        .order('game_date', { ascending: true })
        .order('team');
  
      if (error) {
        console.error('Error fetching picks:', error);
        return;
      }
  
      if (!data || data.length === 0) {
        setPendingGames(new Map());
        setUniqueTeams(new Set());
        return;
      }
  
      const gamesMap = new Map<string, TeamGame>();
      const teams = new Set<string>();
      
      data.forEach(pick => {
        teams.add(pick.team);
        
        if (!gamesMap.has(pick.team)) {
          gamesMap.set(pick.team, {
            team: pick.team,
            team_score: '',
            other_score: '',
            spread_picks: [],
            over_under_picks: [],
            game_date: pick.game_date
          });
        }
  
        const game = gamesMap.get(pick.team);
        if (game) {
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
        }
      });
  
      setPendingGames(gamesMap);
      setUniqueTeams(teams);
    }, [selectedDate, supabase]);
  
    useEffect(() => {
      fetchPendingPicks();
    }, [fetchPendingPicks]);
    
    const handleScoreChange = (team: string, scoreType: 'team' | 'other', value: string) => {
      console.log('Score change:', { team, scoreType, value });
      
      setPendingGames(prevGames => {
        const newGames = new Map(prevGames);
        const game = newGames.get(team);
        if (game) {
          const newGame = {
            ...game,
            [`${scoreType}_score`]: value
          };
          newGames.set(team, newGame);
          console.log('Updated game:', newGames.get(team));
        }
        return newGames;
      });
    };

    const handleSubmitScore = async (team: string) => {
      const game = pendingGames.get(team);
      if (!game) return;

      const teamScore = Number(game.team_score);
      const otherScore = Number(game.other_score);
      const allPicks = [...game.spread_picks, ...game.over_under_picks];
      
      try {
        const updatesToSend = allPicks.map(pick => {
          // Use the helper function to determine winner
          const isWinner = calculateWinner(pick, teamScore, otherScore);
    
          // Update user points if pick is a winner
          if (isWinner) {
            const updateUserPoints = async () => {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('points')
                .eq('id', pick.user_id)
                .single();
    
              if (!userError && userData) {
                await supabase
                  .from('users')
                  .update({ points: (userData.points || 0) + 1 })
                  .eq('id', pick.user_id);
              }
            };
            updateUserPoints();
          }
    
          // Only include database fields, remove display-only fields
          const dbUpdate = {
            id: pick.id,
            user_id: pick.user_id,
            team: pick.team,
            spread: pick.spread,
            over_under: pick.over_under,
            is_favorite: pick.is_favorite,
            is_over: pick.is_over,
            status: 'completed' as const,
            winner: isWinner,
            game_date: pick.game_date
          };
    
          return dbUpdate;
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
      <div className="max-w-4xl mx-auto p-4">
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
          <h3 className="text-lg font-semibold mb-4">
            Pending Games for {new Date(selectedDate).toLocaleDateString()} 
            <span className="text-sm font-normal text-gray-600 ml-2">
              (includes games from {new Date(selectedDate).toLocaleDateString()} ± 1 day)
            </span>
          </h3>
          {uniqueTeams.size === 0 ? (
            <div className="text-gray-500">No pending games for this date range.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from(pendingGames.entries()).map(([team, game]) => (
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