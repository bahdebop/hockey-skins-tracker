'use client';

import { useState, useEffect } from 'react';
import { Settings, Users, Plus, Trash2, Edit } from 'lucide-react';
import { Player } from '@/lib/types';

export default function AdminPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add player');
      }

      setNewPlayerName('');
      fetchPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
      alert(error instanceof Error ? error.message : 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const deletePlayer = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This will also delete all their picks and payments.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/players?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete player');
      }

      fetchPlayers();
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to delete player');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
            <Settings className="w-10 h-10 text-blue-400" />
            Admin Panel
          </h1>
          <p className="text-gray-400">Manage players and settings</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Manage Players
          </h2>

          <form onSubmit={addPlayer} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter player name"
                className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={loading || !newPlayerName.trim()}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Player
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {players.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No players yet. Add your first player above!
              </div>
            ) : (
              players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-lg">{player.name}</div>
                    <div className="text-sm text-gray-400">
                      Added {new Date(player.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deletePlayer(player.id, player.name)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Game Settings</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-lg">
              <h3 className="font-semibold mb-2">Default Pot Amount</h3>
              <p className="text-sm text-gray-400 mb-3">
                Default amount each player contributes per game
              </p>
              <input
                type="number"
                defaultValue="5"
                min="1"
                step="0.01"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
              />
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg">
              <h3 className="font-semibold mb-2">Scoring Rules</h3>
              <div className="text-sm text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Forward Goal:</span>
                  <span className="font-semibold text-white">1 skin</span>
                </div>
                <div className="flex justify-between">
                  <span>Defenseman Goal:</span>
                  <span className="font-semibold text-white">2 skins</span>
                </div>
                <div className="flex justify-between">
                  <span>Goalie (base):</span>
                  <span className="font-semibold text-white">2 skins (-1 per goal)</span>
                </div>
                <div className="flex justify-between">
                  <span>Win Pick:</span>
                  <span className="font-semibold text-white">2 skins</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h3 className="font-semibold mb-2 text-blue-400">Draft Order</h3>
              <p className="text-sm text-gray-400">
                Draft order rotates each game. Player who picks first in one game picks last in the next game.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
