'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import components with no SSR and loading states
const Leaderboard = dynamic(
  () => import('@/components/picks/Leaderboard'),
  { 
    ssr: false,
    loading: () => <div>Loading scoreboard...</div>
  }
);

const PickEntry = dynamic(
  () => import('@/components/picks/PickEntry'),
  { 
    ssr: false,
    loading: () => <div>Loading pick entry...</div>
  }
);

const ScoreEntry = dynamic(
  () => import('@/components/picks/ScoreEntry'),
  { 
    ssr: false,
    loading: () => <div>Loading score entry...</div>
  }
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picks' | 'scores'>('picks');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="w-full max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
            Loading...
          </h1>
        </div>
      </div>
    );
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