'use client';

import { useState, useEffect } from 'react';
import { Settings, Users, Plus, Trash2, Edit, Lock, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { Player } from '@/lib/types';
import { useAuth } from '@/lib/AuthContext';

export default function AdminPage() {
  const { user, loading: authLoading, refreshUser, viewingAsUser, setViewingAsUser } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');

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

  const resetPassword = async (id: number, name: string) => {
    const password = prompt(`Enter a new password for ${name} (min 6 characters):`);
    if (!password) return;
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      const res = await fetch('/api/players/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: id, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset password');
      }
      alert(`Password reset for ${name}`);
      fetchPlayers();
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(error instanceof Error ? error.message : 'Failed to reset password');
    }
  };

  const claimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaiming(true);
    setClaimError('');
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to enable admin');
      }
      setAdminPassword('');
      await refreshUser();
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Failed to enable admin');
    } finally {
      setClaiming(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <Lock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-xl mb-4">Please log in to access the admin panel.</p>
          <Link href="/login" className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (viewingAsUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-8 max-w-md w-full text-center">
          <Lock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin view is off</h1>
          <p className="text-gray-400 mb-6">
            You're viewing the app as a regular user.
          </p>
          <button
            onClick={() => setViewingAsUser(false)}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
          >
            Resume Admin View
          </button>
        </div>
      </div>
    );
  }

  if (!user.is_admin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-8 max-w-md w-full">
          <Lock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-center mb-2">Admin Access Required</h1>
          <p className="text-gray-400 text-center mb-6">
            Enter the admin password to enable admin access on your account.
          </p>
          <form onSubmit={claimAdmin} className="space-y-4">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-white placeholder-gray-500"
            />
            {claimError && <p className="text-red-400 text-sm">{claimError}</p>}
            <button
              type="submit"
              disabled={claiming || !adminPassword}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {claiming ? 'Verifying...' : 'Enable Admin Access'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
              <Settings className="w-10 h-10 text-blue-400" />
              Admin Panel
            </h1>
            <p className="text-gray-400">Manage players and settings</p>
          </div>
          <button
            onClick={() => setViewingAsUser(true)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors"
          >
            View as regular user
          </button>
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
                    <div className="font-semibold text-lg">
                      {player.name}
                      {player.is_admin && (
                        <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">ADMIN</span>
                      )}
                      {!player.has_password && (
                        <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">NO PASSWORD</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      Added {new Date(player.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resetPassword(player.id, player.name)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                      <KeyRound className="w-4 h-4" />
                      Reset PW
                    </button>
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
