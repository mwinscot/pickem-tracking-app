'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parsePick, formatPick } from '@/utils/pick-parser';
import { toPSTDate, getDateRange, formatPSTDisplay } from '@/utils/date-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface User {
  id: string;
  name: string;
  picks_remaining: number;
}

interface Pick {
  id?: string;
  user_id: string;
  team: string;
  spread: number;
  over_under: number;
  is_favorite: boolean;
  is_over: boolean;
  game_date: string;
  status: 'pending' | 'completed';
  winner?: boolean;
  users?: {
    name: string;
  };
  formatted_pick?: string;
}

interface ParsedPick {
  team: string;
  spread?: number;
  over_under?: number;
  is_favorite?: boolean;
  is_over?: boolean;
  pick_type: 'spread' | 'over_under';
}

export default function PickEntry() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const defaultDate = new Date().toISOString().split('T')[0];
  const [gameDate, setGameDate] = useState(defaultDate); // Remove toPSTDate here
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [pickInput, setPickInput] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [groupedPicks, setGroupedPicks] = useState<{
    pending: Pick[];
    scoredByUser: Record<string, Pick[]>;
  }>({ pending: [], scoredByUser: {} });
  const [lastWeekPicks, setLastWeekPicks] = useState<{[key: string]: Pick[]}>({});
  const [allResults, setAllResults] = useState<{[key: string]: { picks: Pick[], wins: number, losses: number }}>({});

  const groupPicksByStatus = useCallback((picks: Pick[]) => {
    console.log('All picks:', picks);
    const pending = picks.filter(p => p.status === 'pending');
    const scored = picks.filter(p => p.status === 'completed');
    
    const scoredByUser = scored.reduce((acc, pick) => {
      const userName = pick.users?.name || 'Unknown User';
      if (!acc[userName]) {
        acc[userName] = [];
      }
      acc[userName].push(pick);
      return acc;
    }, {} as Record<string, Pick[]>);
  
    return { pending, scoredByUser };
  }, []);

  const fetchUsers = useCallback(async () => {
    // Get all users first
    console.log('Fetching users...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .order('name');
    
    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }

    // For each user, count their picks
    const usersWithPickCounts = await Promise.all(userData.map(async (user) => {
      // Get a count of all valid picks for this user
      const { count, error: pickError } = await supabase
        .from('picks')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .not('status', 'eq', 'deleted'); // Ensure we don't count deleted picks if any exist

      if (pickError) {
        console.error('Error counting picks for user:', pickError);
        return { ...user, picks_remaining: 50 };
      }

      const picksUsed = count || 0;
      const remaining = 50 - picksUsed;
      
      console.log(`User ${user.name}:`, {
        totalPicks: picksUsed,
        remaining: remaining,
        userId: user.id
      });
      
      return {
        ...user,
        picks_remaining: remaining
      };
    }));

    console.log('Users with calculated picks remaining:', 
      usersWithPickCounts?.map(u => ({ 
        name: u.name, 
        remaining: u.picks_remaining 
      }))
    );

    console.log('Final users with pick counts:', usersWithPickCounts);
    setUsers(usersWithPickCounts || []);
  }, [supabase]);
  

  const fetchPendingPicks = useCallback(async () => {
    try {
      const dateRange = getDateRange(gameDate); //  Use this instead of creating new dates
      console.log('Fetching with dates:', dateRange);
      
      const { data, error } = await supabase
        .from('picks')
        .select('*, users(name)')
        .in('game_date', dateRange)
        .order('game_date', { ascending: true })
        .order('team');
  
      if (error) throw error;
  
      const formattedPicks = (data || []).map((pick: Pick) => ({
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
  
      setGroupedPicks(groupPicksByStatus(formattedPicks));
    } catch (err) {
      console.error('Error details:', err);
    }
  }, [gameDate, supabase, groupPicksByStatus]);

  const fetchLastWeekPicks = useCallback(async () => {
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    const { data, error } = await supabase
      .from('picks')
      .select('*, users(name)')
      .eq('status', 'completed')
      .gte('game_date', oneWeekAgo.toISOString())
      .lt('game_date', today.toISOString())
      .order('game_date', { ascending: false });

    if (error) {
      console.error('Error fetching last week picks:', error);
      return;
    }

    const groupedByUser = (data || []).reduce((acc: {[key: string]: Pick[]}, pick) => {
      const userName = pick.users?.name || 'Unknown User';
      if (!acc[userName]) acc[userName] = [];
      acc[userName].push({
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
      return acc;
    }, {});

    setLastWeekPicks(groupedByUser);
  }, [supabase]);

  const fetchAllResults = useCallback(async () => {
    const { data, error } = await supabase
      .from('picks')
      .select('*, users(name)')
      .eq('status', 'completed')
      .order('game_date', { ascending: false });

    if (error) {
      console.error('Error fetching all results:', error);
      return;
    }

    const resultsByUser = (data || []).reduce((acc: {[key: string]: { picks: Pick[], wins: number, losses: number }}, pick) => {
      const userName = pick.users?.name || 'Unknown User';
      if (!acc[userName]) {
        acc[userName] = { picks: [], wins: 0, losses: 0 };
      }
      
      acc[userName].picks.push({
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

      if (pick.winner) {
        acc[userName].wins += 1;
      } else {
        acc[userName].losses += 1;
      }

      return acc;
    }, {});

    setAllResults(resultsByUser);
  }, [supabase]);

  useEffect(() => {
    fetchUsers();
    fetchPendingPicks();
    fetchLastWeekPicks();
    fetchAllResults();
  }, [fetchPendingPicks, fetchLastWeekPicks, fetchUsers, fetchAllResults]);

  const createPickData = (parsedPick: ParsedPick): Pick => {
    const pstGameDate = toPSTDate(gameDate);
    console.log('Date debug:', {
      inputGameDate: gameDate,
      convertedPSTDate: pstGameDate,
      rawNewDate: new Date().toISOString()
    });
    
    if (parsedPick.pick_type === 'over_under') {
      if (parsedPick.over_under === undefined || parsedPick.is_over === undefined) {
        throw new Error('Invalid over/under pick format');
      }
      return {
        user_id: selectedUser,
        team: parsedPick.team,
        over_under: parsedPick.over_under,
        is_over: parsedPick.is_over,
        spread: 0,
        is_favorite: false,
        game_date: pstGameDate,
        status: 'pending'
      };
    } else {
      if (parsedPick.spread === undefined || parsedPick.is_favorite === undefined) {
        throw new Error('Invalid spread pick format');
      }
      return {
        user_id: selectedUser,
        team: parsedPick.team,
        spread: parsedPick.spread,
        is_favorite: parsedPick.is_favorite,
        over_under: 0,
        is_over: false,
        game_date: pstGameDate,
        status: 'pending'
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    const selectedUserData = users.find(u => u.id === selectedUser);
    if (!selectedUserData) {
      setError('Invalid user selected');
      return;
    }

    console.log('Pre-submission picks status:', {
      user: selectedUserData.name,
      currentPicksRemaining: selectedUserData.picks_remaining
    });

    // Add check for remaining picks
    if (selectedUserData.picks_remaining <= 0) {
      setError('No picks remaining for this user');
      return;
    }

    const parsedPick = parsePick(pickInput);
    if (!parsedPick) {
      setError('Invalid pick format. Examples: "Arizona +4" or "Arizona O150"');
      return;
    }

    try {
      const pickData = createPickData(parsedPick);
      console.log('Submitting pick:', pickData);

      // Insert the pick
      const { error: pickError } = await supabase
        .from('picks')
        .insert(pickData);

      if (pickError) throw pickError;

      // Immediately verify the new pick count
      const { count: newCount } = await supabase
        .from('picks')
        .select('*', { count: 'exact' })
        .eq('user_id', selectedUser);

      console.log('Post-submission pick count:', {
        user: selectedUserData.name,
        totalPicks: newCount,
        remainingPicks: 50 - (newCount || 0)
      });

      // Force refresh users data to update picks remaining
      await fetchUsers();
      
      setMessage(`Pick recorded for ${selectedUserData.name}: ${
        parsedPick.pick_type === 'over_under' 
          ? `${parsedPick.team} ${parsedPick.is_over ? 'OVER' : 'UNDER'} ${parsedPick.over_under}` 
          : `${parsedPick.team} ${parsedPick.is_favorite ? '-' : '+'} ${parsedPick.spread}`
      }`);
      
      setPickInput('');
      await fetchPendingPicks();
    } catch (err) {
      console.error('Error submitting pick:', err);
      setError(err instanceof Error ? err.message : 'Error saving pick');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Enter Pick</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="user" className="block text-sm font-medium text-gray-700">
            Select Player
          </label>
          <select
            id="user"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          >
            <option value="">Choose a player</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.picks_remaining} picks remaining)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gameDate" className="block text-sm font-medium text-gray-700">
            Game Date
          </label>
          <input
            id="gameDate"
            type="date"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>

        <div>
          <label htmlFor="pick" className="block text-sm font-medium text-gray-700">
            Enter Pick
          </label>
          <input
            id="pick"
            type="text"
            value={pickInput}
            onChange={(e) => setPickInput(e.target.value)}
            placeholder="Example: &quot;Arizona +4&quot; or &quot;Arizona O150&quot;"
            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {message && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{message}</div>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Submit Pick
        </button>
      </form>

      <div className="mt-8 space-y-8">
        {/* Pending Picks Section */}
        <div>
        <h3 className="text-lg font-semibold mb-4">
  Pending Picks for {formatPSTDisplay(gameDate)}
  <span className="text-sm font-normal text-gray-600 ml-2">
    (includes picks from {formatPSTDisplay(gameDate)} ± 1 day)
  </span>
</h3>
          {groupedPicks.pending.length === 0 ? (
            <div className="text-gray-500">No pending picks.</div>
          ) : (
            <div className="space-y-2">
              {groupedPicks.pending.map((pick: Pick) => (
                <div key={pick.id} className="p-3 bg-yellow-50 rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{pick.users?.name}</span>: {pick.formatted_pick}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatPSTDisplay(pick.game_date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scored Picks Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Scored Picks</h3>
          {Object.keys(groupedPicks.scoredByUser).length === 0 ? (
            <div className="text-gray-500">No scored picks.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPicks.scoredByUser).map(([userName, picks]) => (
                <div key={userName} className="p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium mb-2">{userName}</h4>
                  <div className="space-y-2">
                    {picks.map((pick) => (
                      <div key={pick.id} className="flex justify-between items-center text-sm">
                        <div>
                          {pick.team}: {pick.formatted_pick}
                          <span className={`ml-2 ${pick.winner ? 'text-green-600' : 'text-red-600'}`}>
                            ({pick.winner ? 'Win' : 'Loss'})
                          </span>
                        </div>
                        <div className="text-gray-500">
                          {formatPSTDisplay(pick.game_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Week's Picks Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Last Week&apos;s Results</h3>
          {Object.keys(lastWeekPicks).length === 0 ? (
            <div className="text-gray-500">No picks from last week.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(lastWeekPicks).map(([userName, picks]) => (
                <div key={userName} className="p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium mb-2">{userName}</h4>
                  <div className="space-y-2">
                    {picks.map((pick) => (
                      <div key={pick.id} className="flex justify-between items-center text-sm">
                        <div className={pick.winner ? 'text-green-600' : 'text-red-600'}>
                          {pick.formatted_pick}
                          <span className="ml-2">
                            ({pick.winner ? 'Win' : 'Loss'})
                          </span>
                        </div>
                        <div className="text-gray-500">
                          {formatPSTDisplay(pick.game_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Results Section */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">All Results</h3>
          {Object.keys(allResults).length === 0 ? (
            <div className="text-gray-500">No results available.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(allResults)
                .sort(([aName], [bName]) => aName.localeCompare(bName))
                .map(([userName, data]) => (
                <div key={userName} className="p-4 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-lg">{userName}</h4>
                    <div className="text-sm">
                      <span className="text-green-600 font-medium">{data.wins} Wins</span>
                      <span className="mx-2">-</span>
                      <span className="text-red-600 font-medium">{data.losses} Losses</span>
                      <span className="ml-2 text-gray-600">
                        ({((data.wins / (data.wins + data.losses)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {data.picks.map((pick) => (
                      <div key={pick.id} className="flex justify-between items-center text-sm">
                        <div className={pick.winner ? 'text-green-600' : 'text-red-600'}>
                          {pick.formatted_pick}
                          <span className="ml-2">
                            ({pick.winner ? 'Win' : 'Loss'})
                          </span>
                        </div>
                        <div className="text-gray-500">
                          {formatPSTDisplay(pick.game_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}