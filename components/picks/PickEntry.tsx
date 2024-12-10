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
  game_date: string;
  winner?: boolean;
  users?: {
    name: string;
  };
  formatted_pick?: string;
}

interface TeamPicks {
  team: string;
  team_score: string;
  other_score: string;
  picks: Pick[];
}

export default function ScoreEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingTeams, setPendingTeams] = useState<Map<string, TeamPicks>>(new Map());
  const [uniqueTeams, setUniqueTeams] = useState<Set<string>>(new Set());
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
      .eq('game_date', selectedDate)
      .order('team');

    if (error) {
      console.error('Error fetching picks:', error);
      return;
    }

    // Create a Map of teams and their picks
    const teamsMap = new Map<string, TeamPicks>();
    const teams = new Set<string>();

    data?.forEach(pick => {
      teams.add(pick.team);
      
      if (!teamsMap.has(pick.team)) {
        teamsMap.set(pick.team, {
          team: pick.team,
          team_score: '',
          other_score: '',
          picks: []
        });
      }

      const teamPicks = teamsMap.get(pick.team);
      if (teamPicks) {
        teamPicks.picks.push({
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

    setPendingTeams(teamsMap);
    setUniqueTeams(teams);
  }, [selectedDate]);

  useEffect(() => {
    fetchPendingPicks();
  }, [fetchPendingPicks]);

  const handleScoreChange = (team: string, scoreType: 'team' | 'other', value: string) => {
    setPendingTeams(prevTeams => {
      const newTeams = new Map(prevTeams);
      const teamData = newTeams.get(team);
      if (teamData) {
        teamData[`${scoreType}_score`] = value;
        newTeams.set(team, { ...teamData });
      }
      return newTeams;
    });
  };

  const handleSubmitScore = async (team: string) => {
    const teamData = pendingTeams.get(team);
    if (!teamData) return;

    const total = Number(teamData.team_score) + Number(teamData.other_score);
    
    try {
      const updatesToSend = teamData.picks.map(pick => {
        const isWinner = pick.over_under > 0 
          ? (() => {
              const isOver = total > pick.over_under;
              return isOver === pick.is_over;
            })()
          : (() => {
              const margin = Number(teamData.team_score) - Number(teamData.other_score);
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
      setPendingTeams(prevTeams => {
        const newTeams = new Map(prevTeams);
        newTeams.delete(team);
        return newTeams;
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
        <h3 className="text-lg font-semibold mb-4">Pending Teams for {selectedDate}</h3>
        {uniqueTeams.size === 0 ? (
          <div className="text-gray-500">No pending games for this date.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from(pendingTeams.entries()).map(([team, teamData]) => (
              <div key={team} className="bg-white shadow rounded-lg p-4">
                <h4 className="font-bold text-lg text-gray-900 mb-4">{team}</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {team} Score
                    </label>
                    <input
                      type="number"
                      value={teamData.team_score}
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
                      value={teamData.other_score}
                      onChange={(e) => handleScoreChange(team, 'other', e.target.value)}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Score"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="font-medium text-gray-700 mb-2">Picks:</h5>
                  <div className="space-y-2">
                    {teamData.picks.map((pick) => (
                      <div key={pick.id} className="text-sm text-gray-600">
                        {pick.users?.name}: {pick.formatted_pick}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSubmitScore(team)}
                  disabled={!teamData.team_score || !teamData.other_score}
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