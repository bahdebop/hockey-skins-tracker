'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, DollarSign, Users, Plus, Trophy } from 'lucide-react';
import { Game } from '@/lib/types';

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/games');
      const data = await res.json();
      setGames(data);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/20 text-blue-400';
      case 'drafting': return 'bg-yellow-500/20 text-yellow-400';
      case 'in_progress': return 'bg-green-500/20 text-green-400';
      case 'final': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'upcoming': return 'Upcoming';
      case 'drafting': return 'Drafting';
      case 'in_progress': return 'Live';
      case 'final': return 'Final';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Games</h1>
          <Link
            href="/games/create"
            className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Game
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Games Yet</h2>
            <p className="text-gray-400 mb-6">
              Be the first to create a skins game!
            </p>
            <Link
              href="/games/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create First Game
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map(game => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-800/70 transition-all hover:scale-105"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">vs {game.opponent}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(game.status)}`}>
                    {getStatusLabel(game.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {new Date(game.game_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>

                  <div className="flex items-center gap-2 text-gray-400">
                    <DollarSign className="w-4 h-4" />
                    ${game.pot_amount} pot
                  </div>

                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    Created by {(game as any).creator_name || 'Unknown'}
                  </div>
                </div>

                {game.status === 'in_progress' && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-center gap-4 text-lg font-bold">
                      <span className="text-green-400">MIN {game.wild_score}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-gray-300">{game.opponent_score}</span>
                    </div>
                    <div className="text-center text-xs text-gray-500 mt-1">
                      Period {game.period}
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
