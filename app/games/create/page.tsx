'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Player } from '@/lib/types';

export default function CreateGamePage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    opponent: '',
    gameDate: '',
    gameTime: '19:00',
    potAmount: '5',
    createdBy: '',
  });

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        setPlayers(data);
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };
    fetchPlayers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const gameDateTime = new Date(`${formData.gameDate}T${formData.gameTime}`);
      
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opponent: formData.opponent,
          game_date: gameDateTime.toISOString(),
          pot_amount: parseFloat(formData.potAmount),
          created_by: parseInt(formData.createdBy),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create game');
      }

      const game = await res.json();
      router.push(`/games/${game.id}`);
    } catch (error) {
      console.error('Error creating game:', error);
      alert(error instanceof Error ? error.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/games"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Link>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-6">Create New Game</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Opponent
                </div>
              </label>
              <input
                type="text"
                required
                value={formData.opponent}
                onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                placeholder="e.g., Colorado Avalanche"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white placeholder-gray-500"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4" />
                    Game Date
                  </div>
                </label>
                <input
                  type="date"
                  required
                  min={getTodayDate()}
                  value={formData.gameDate}
                  onChange={(e) => setFormData({ ...formData, gameDate: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Game Time
                </label>
                <input
                  type="time"
                  required
                  value={formData.gameTime}
                  onChange={(e) => setFormData({ ...formData, gameTime: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4" />
                  Pot Amount
                </div>
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={formData.potAmount}
                onChange={(e) => setFormData({ ...formData, potAmount: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
              />
              <p className="text-sm text-gray-400 mt-1">
                Amount each player contributes to the pot
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Created By
                </div>
              </label>
              <select
                required
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
              >
                <option value="">Select a player</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Game Rules Reminder</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Forward goal = 1 skin</li>
                <li>• Defenseman goal = 2 skins</li>
                <li>• Goalie starts at 2 skins (-1 per goal allowed)</li>
                <li>• Win pick = 2 skins</li>
                <li>• Draft order rotates (pick 1 → last next game)</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
              <Link
                href="/games"
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
