'use client';

import Leaderboard from '@/components/picks/Leaderboard';
import PickEntry from '@/components/picks/PickEntry';
import ScoreEntry from '@/components/picks/ScoreEntry';
import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picks' | 'scores'>('picks');
  const [mounted, setMounted] = useState(false);

  useState(() => {
    setMounted(true);
  });

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="w-full max-w-7xl mx-auto px-4 mb-12">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
          College Basketball Pick&apos;em
        </h1>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <Leaderboard />
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-center space-x-4 border-b border-gray-200 mb-8">
          <button
            className={`py-2 px-4 ${
              activeTab === 'picks'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('picks')}
          >
            Enter Picks
          </button>
          <button
            className={`py-2 px-4 ${
              activeTab === 'scores'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('scores')}
          >
            Enter Scores
          </button>
        </div>

        <section className="bg-white rounded-lg shadow-lg p-6">
          {activeTab === 'picks' ? (
            <>
              <h2 className="text-2xl font-bold mb-6">Enter New Pick</h2>
              <PickEntry />
            </>
          ) : (
            <ScoreEntry />
          )}
        </section>
      </div>
    </div>
  );
}