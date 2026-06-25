'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { SeasonStats } from '@/lib/types';

export default function LeaderboardPage() {
  const [stats, setStats] = useState<SeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'skins' | 'balance'>('skins');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedStats = [...stats].sort((a, b) => {
    if (sortBy === 'skins') {
      return b.total_skins - a.total_skins;
    } else {
      return b.net_balance - a.net_balance;
    }
  });

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 2: return 'bg-gray-400/20 border-gray-400/50 text-gray-300';
      case 3: return 'bg-orange-700/20 border-orange-700/50 text-orange-400';
      default: return 'bg-gray-800/50 border-gray-700';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return rank;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            Leaderboard
          </h1>
          <p className="text-gray-400">Season standings and player statistics</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('skins')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                sortBy === 'skins'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              By Skins
            </button>
            <button
              onClick={() => setSortBy('balance')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                sortBy === 'balance'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              By Balance
            </button>
          </div>
        </div>

        {stats.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Stats Yet</h2>
            <p className="text-gray-400">
              Play some games to see the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedStats.map((player, index) => {
              const rank = index + 1;
              return (
                <div
                  key={player.player_id}
                  className={`border rounded-lg p-6 transition-all hover:scale-[1.02] ${getRankColor(rank)}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold w-12 text-center">
                      {getRankIcon(rank)}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1">{player.player_name}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400">Total Skins</div>
                          <div className="text-lg font-bold text-green-400">
                            {player.total_skins}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Games Played</div>
                          <div className="text-lg font-bold">{player.games_played}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Avg Skins/Game</div>
                          <div className="text-lg font-bold">
                            {player.games_played > 0
                              ? (player.total_skins / player.games_played).toFixed(1)
                              : '0.0'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Net Balance</div>
                          <div
                            className={`text-lg font-bold flex items-center gap-1 ${
                              player.net_balance > 0
                                ? 'text-green-400'
                                : player.net_balance < 0
                                ? 'text-red-400'
                                : 'text-gray-400'
                            }`}
                          >
                            {player.net_balance > 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : player.net_balance < 0 ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : null}
                            ${Math.abs(player.net_balance).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 bg-gray-800/50 backdrop-blur rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Scoring System</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Forward Goal:</span>
                <span className="font-semibold">1 skin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Defenseman Goal:</span>
                <span className="font-semibold">2 skins</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Goalie (base):</span>
                <span className="font-semibold">2 skins (-1 per goal)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Win Pick:</span>
                <span className="font-semibold">2 skins</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
