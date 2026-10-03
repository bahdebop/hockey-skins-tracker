'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Calendar, DollarSign, Trophy, Clock } from 'lucide-react';
import Link from 'next/link';
import { Game, Player, HockeyPlayer, Pick } from '@/lib/types';
import ScoreNotification from '@/components/ScoreNotification';
import { useAuth } from '@/lib/AuthContext';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hockeyPlayers, setHockeyPlayers] = useState<HockeyPlayer[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [notification, setNotification] = useState<any>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [picking, setPicking] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!gameId) return;

    const eventSource = new EventSource(`/api/events/${gameId}`);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event === 'goal_scored') {
          // Show notification
          setNotification({
            id: `${message.data.playerId}-${message.data.timestamp}`,
            playerName: message.data.playerName,
            position: message.data.position,
            goals: message.data.goals,
            skinsChange: message.data.skinsChange,
          });

          // Refresh game data to show updated scores
          fetchGameData();
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      const [gameRes, playersRes, hockeyPlayersRes, picksRes] = await Promise.all([
        fetch(`/api/games?id=${gameId}`),
        fetch('/api/players'),
        fetch(`/api/hockey-players?game_id=${gameId}`),
        fetch(`/api/picks?game_id=${gameId}`),
      ]);

      const gameData = await gameRes.json();
      const playersData = await playersRes.json();
      const hockeyPlayersData = await hockeyPlayersRes.json();
      const picksData = await picksRes.json();

      setGame(Array.isArray(gameData) ? gameData[0] : gameData);
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setHockeyPlayers(Array.isArray(hockeyPlayersData) ? hockeyPlayersData : []);
      setPicks(Array.isArray(picksData) ? picksData : []);

      if (gameData.draft_order) {
        setDraftOrder(JSON.parse(gameData.draft_order));
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startDraft = async () => {
    try {
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const order = shuffledPlayers.map(p => p.id);

      await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gameId,
          status: 'drafting',
          draft_order: JSON.stringify(order),
          current_pick_index: 0,
        }),
      });

      fetchGameData();
    } catch (error) {
      console.error('Error starting draft:', error);
    }
  };

  const loadRoster = async () => {
    setLoadingRoster(true);
    try {
      const res = await fetch('/api/hockey-players/populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to load roster');
        return;
      }
      await fetchGameData();
    } catch (error) {
      console.error('Error loading roster:', error);
      alert('Failed to load roster');
    } finally {
      setLoadingRoster(false);
    }
  };

  const makePick = async (hockeyPlayerId: number | null, isWin: boolean) => {
    const picker = getCurrentPicker();
    if (!picker || picking) return;

    setPicking(true);
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: picker.id,
          game_id: Number(gameId),
          hockey_player_id: hockeyPlayerId,
          is_win_pick: isWin,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to make pick');
        return;
      }

      await fetchGameData();
    } catch (error) {
      console.error('Error making pick:', error);
      alert('Failed to make pick');
    } finally {
      setPicking(false);
    }
  };

  const getCurrentPicker = () => {
    if (!game || !draftOrder.length) return null;
    const playerId = draftOrder[game.current_pick_index];
    return players.find(p => p.id === playerId);
  };

  const getPlayerPick = (playerId: number) => {
    return picks.find(p => p.player_id === playerId);
  };

  const hasPlayerPicked = (playerId: number) => {
    return picks.some(p => p.player_id === playerId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/20 text-blue-400';
      case 'drafting': return 'bg-yellow-500/20 text-yellow-400';
      case 'in_progress': return 'bg-green-500/20 text-green-400';
      case 'final': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'F': return 'text-blue-400';
      case 'D': return 'text-purple-400';
      case 'G': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const calculateSkins = (hockeyPlayer: HockeyPlayer) => {
    if (hockeyPlayer.position === 'F') {
      return hockeyPlayer.goals;
    } else if (hockeyPlayer.position === 'D') {
      return hockeyPlayer.goals * 2;
    } else if (hockeyPlayer.position === 'G') {
      return Math.max(0, 2 - hockeyPlayer.goals);
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Game not found</div>
      </div>
    );
  }

  const currentPicker = getCurrentPicker();
  const canPick = game.status === 'drafting' && !!currentPicker && !!user &&
    (user.id === currentPicker.id || !!user.is_admin);
  const pickedHockeyPlayerIds = new Set(picks.map(p => p.hockey_player_id).filter(Boolean));
  const winTaken = picks.some(p => p.is_win_pick);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/games"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Link>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Minnesota Wild vs {game.opponent}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(game.game_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  ${game.pot_amount} pot
                </div>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(game.status)}`}>
              {game.status.toUpperCase()}
            </span>
          </div>

          {game.status === 'in_progress' && (
            <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-center gap-8 text-3xl font-bold mb-2">
                <span className="text-green-400">MIN {game.wild_score}</span>
                <span className="text-gray-500">-</span>
                <span className="text-gray-300">{game.opponent_score}</span>
              </div>
              <div className="text-center text-gray-400">
                <Clock className="w-4 h-4 inline mr-2" />
                Period {game.period}
              </div>
            </div>
          )}

          {game.status === 'upcoming' && (
            <button
              onClick={startDraft}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-lg transition-colors"
            >
              Start Draft
            </button>
          )}

          {game.status === 'drafting' && currentPicker && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="text-sm text-gray-400">Current Pick</div>
                  <div className="text-xl font-bold text-yellow-400">
                    {currentPicker.name}
                  </div>
                  {user?.id === currentPicker.id && (
                    <div className="text-sm text-green-400 font-semibold">
                      Your turn — tap a player below to pick
                    </div>
                  )}
                  {user?.is_admin && user.id !== currentPicker.id && (
                    <div className="text-sm text-gray-500">
                      Admin mode — you can pick for {currentPicker.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Draft Order
            </h2>

            {draftOrder.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                Draft hasn't started yet
              </div>
            ) : (
              <div className="space-y-3">
                {draftOrder.map((playerId, index) => {
                  const player = players.find(p => p.id === playerId);
                  const pick = getPlayerPick(playerId);
                  const isCurrent = game.status === 'drafting' && index === game.current_pick_index;

                  return (
                    <div
                      key={playerId}
                      className={`p-4 rounded-lg ${
                        isCurrent
                          ? 'bg-yellow-500/20 border border-yellow-500/50'
                          : 'bg-gray-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            isCurrent ? 'bg-yellow-500 text-black' : 'bg-gray-700'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold">{player?.name}</div>
                            {pick && (
                              <div className="text-sm text-gray-400">
                                {pick.is_win_pick ? (
                                  <span className="text-green-400">WIN ({pick.skins} skins)</span>
                                ) : (
                                  <span>
                                    {pick.hockey_player_name} ({pick.skins} skins)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {hasPlayerPicked(playerId) && (
                          <Trophy className="w-5 h-5 text-green-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Available Picks</h2>

            {hockeyPlayers.length === 0 && (game.status === 'upcoming' || game.status === 'drafting') ? (
              <button
                onClick={loadRoster}
                disabled={loadingRoster}
                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {loadingRoster ? 'Loading Wild roster...' : 'Load Wild Roster'}
              </button>
            ) : game.status === 'upcoming' ? (
              <div className="text-center text-gray-400 py-8">
                Roster loaded ({hockeyPlayers.length} players) — start the draft to pick
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={canPick && !winTaken && !picking ? () => makePick(null, true) : undefined}
                  className={`p-4 rounded-lg transition-colors ${
                    winTaken
                      ? 'bg-gray-900/30 border border-gray-700 opacity-50 cursor-not-allowed'
                      : `bg-green-500/10 border border-green-500/30 ${canPick ? 'hover:bg-green-500/20 cursor-pointer' : ''}`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-green-400">WIN</div>
                      <div className="text-sm text-gray-400">Team victory</div>
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {winTaken ? <span className="text-sm text-gray-500">TAKEN</span> : '2'}
                    </div>
                  </div>
                </div>

                {hockeyPlayers.map((hp) => {
                  const taken = pickedHockeyPlayerIds.has(hp.id);
                  return (
                    <div
                      key={hp.id}
                      onClick={canPick && !taken && !picking ? () => makePick(hp.id, false) : undefined}
                      className={`p-4 rounded-lg transition-colors ${
                        taken
                          ? 'bg-gray-900/30 opacity-50 cursor-not-allowed'
                          : `bg-gray-900/50 ${canPick ? 'hover:bg-gray-900/70 cursor-pointer ring-1 ring-transparent hover:ring-green-500/50' : ''}`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">
                            {hp.name}
                            {hp.jersey_number && (
                              <span className="text-gray-500 ml-2">#{hp.jersey_number}</span>
                            )}
                          </div>
                          <div className={`text-sm font-medium ${getPositionColor(hp.position)}`}>
                            {hp.position === 'F' ? 'Forward' : hp.position === 'D' ? 'Defense' : 'Goalie'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {taken ? <span className="text-sm text-gray-500">TAKEN</span> : hp.position === 'F' ? '1' : '2'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {hp.goals > 0 && `${hp.goals}G`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ScoreNotification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}
