'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parsePick } from '@/utils/pick-parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type User = {
  id: string;
  name: string;
  picks_remaining: number;
};

export default function PickEntry() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [pickInput, setPickInput] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    const selectedUserData = users.find(u => u.id === selectedUser);
    if (!selectedUserData) {
      setError('Invalid user selected');
      return;
    }

    const pick = parsePick(pickInput);
    if (!pick) {
      setError('Invalid pick format. Examples: "Duke -3.5" or "Stanford OVER 147.5"');
      return;
    }

    try {
      // Insert the pick with appropriate fields
      const pickData = pick.is_over_under ? {
        user_id: selectedUser,
        team: pick.team,
        over_under: pick.over_under,
        is_favorite: pick.is_favorite,
        spread: 0 // Set a default value for spread when it's an over/under bet
      } : {
        user_id: selectedUser,
        team: pick.team,
        spread: pick.spread,
        is_favorite: pick.is_favorite,
        over_under: 0 // Set a default value for over_under when it's a spread bet
      };

      const { error: pickError } = await supabase
        .from('picks')
        .insert(pickData);

      if (pickError) throw pickError;

      // Update picks remaining
      const { error: updateError } = await supabase
        .from('users')
        .update({ picks_remaining: selectedUserData.picks_remaining - 1 })
        .eq('id', selectedUser);

      if (updateError) throw updateError;

      setMessage(`Pick recorded for ${selectedUserData.name}: ${pick.team} ${pick.is_over_under ? 
        `${pick.is_favorite ? 'OVER' : 'UNDER'} ${pick.over_under}` : 
        `${pick.is_favorite ? '-' : '+'} ${pick.spread}`}`);
      setPickInput('');
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