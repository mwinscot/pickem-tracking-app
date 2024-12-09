'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parsePick } from '@/utils/pick-parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface User {
  id: string;
  name: string;
  picks_remaining: number;
}

interface Pick {
  user_id: string;
  team: string;
  spread: number;
  over_under: number;
  is_favorite: boolean;
  is_over: boolean;
  home_team: string;
  away_team: string;
  game_date: string;
  status: 'pending';
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
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [pickInput, setPickInput] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, picks_remaining')
      .order('name');
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const createPickData = (parsedPick: ParsedPick): Pick => {
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
        home_team: homeTeam,
        away_team: awayTeam,
        game_date: gameDate,
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
        home_team: homeTeam,
        away_team: awayTeam,
        game_date: gameDate,
        status: 'pending'
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate required fields
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    if (!homeTeam || !awayTeam) {
      setError('Please enter both home and away teams');
      return;
    }

    const selectedUserData = users.find(u => u.id === selectedUser);
    if (!selectedUserData) {
      setError('Invalid user selected');
      return;
    }

    const parsedPick = parsePick(pickInput);
    if (!parsedPick) {
      setError('Invalid pick format. Examples: "Duke -3.5" or "Stanford OVER 147.5"');
      return;
    }

    try {
      const pickData = createPickData(parsedPick);

      const { data, error: pickError } = await supabase
        .from('picks')
        .insert(pickData)
        .select()
        .single();

      if (pickError) {
        console.error('Supabase error details:', {
          code: pickError.code,
          message: pickError.message,
          details: pickError.details,
          data: pickData
        });
        throw pickError;
      }

      // Update picks remaining
      const { error: updateError } = await supabase
        .from('users')
        .update({ picks_remaining: selectedUserData.picks_remaining - 1 })
        .eq('id', selectedUser);

      if (updateError) throw updateError;

      setMessage(`Pick recorded for ${selectedUserData.name}: ${
        parsedPick.pick_type === 'over_under' 
          ? `${parsedPick.team} ${parsedPick.is_over ? 'OVER' : 'UNDER'} ${parsedPick.over_under}` 
          : `${parsedPick.team} ${parsedPick.is_favorite ? '-' : '+'} ${parsedPick.spread}`
      }`);
      
      // Reset form
      setPickInput('');
      setHomeTeam('');
      setAwayTeam('');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving pick');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="homeTeam" className="block text-sm font-medium text-gray-700">
              Home Team
            </label>
            <input
              id="homeTeam"
              type="text"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="Enter home team"
            />
          </div>

          <div>
            <label htmlFor="awayTeam" className="block text-sm font-medium text-gray-700">
              Away Team
            </label>
            <input
              id="awayTeam"
              type="text"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="Enter away team"
            />
          </div>
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
            placeholder='Example: "Duke -3.5" or "Stanford OVER 147.5"'
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
    </div>
  );
}