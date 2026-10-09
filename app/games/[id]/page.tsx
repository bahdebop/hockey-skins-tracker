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
  const [editingPickId, setEditingPickId] = useState<number | null>(null);
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
            kind: message.data.kind,
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
      const res = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(gameId),
          status: 'drafting',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Failed to start draft (${res.status})`);
        return;
      }

      fetchGameData();
    } catch (error) {
      console.error('Error starting draft:', error);
      alert('Failed to start draft');
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
    const skipped = user
      ? picks.find(p => p.player_id === user.id && !p.is_win_pick && p.hockey_player_id == null)
      : undefined;
    // Skipped players fill their own slot; otherwise the pick belongs to the current picker
    const targetPlayerId = skipped && !user?.is_admin ? user!.id : getCurrentPicker()?.id;
    if (!targetPlayerId || picking) return;

    setPicking(true);
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: targetPlayerId,
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

  const changePick = async (pickId: number, hockeyPlayerId: number | null, isWin: boolean) => {
    try {
      const res = await fetch('/api/picks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pickId, hockey_player_id: hockeyPlayerId, is_win_pick: isWin }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to change pick');
        return;
      }

      await fetchGameData();
    } catch (error) {
      console.error('Error changing pick:', error);
      alert('Failed to change pick');
    } finally {
      setEditingPickId(null);
    }
  };

  const endDraft = async () => {
    try {
      const res = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(gameId), status: 'ready' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Failed to end draft (${res.status})`);
        return;
      }
      fetchGameData();
    } catch (error) {
      console.error('Error ending draft:', error);
      alert('Failed to end draft');
    }
  };

  const startGame = async () => {
    try {
      const res = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(gameId), status: 'in_progress', period: 1 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Failed to start game (${res.status})`);
        return;
      }
      fetchGameData();
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game');
    }
  };

  const updateGoals = async (hockeyPlayerId: number, field: 'goals' | 'goals_scored', value: number) => {
    try {
      const res = await fetch('/api/hockey-players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hockeyPlayerId, [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to update goals');
        return;
      }
      fetchGameData();
    } catch (error) {
      console.error('Error updating goals:', error);
      alert('Failed to update goals');
    }
  };

  const adjustScore = async (field: 'opponent_score' | 'period', delta: number) => {
    if (!game) return;
    const newValue = Math.max(0, (game[field] || 0) + delta);
    try {
      const res = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(gameId), [field]: newValue }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to update score');
        return;
      }
      fetchGameData();
    } catch (error) {
      console.error('Error updating score:', error);
      alert('Failed to update score');
    }
  };

  const completeGame = async () => {
    if (!confirm('Mark this game complete? This calculates skins and creates the payment balances.')) return;
    try {
      const res = await fetch('/api/games', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(gameId), status: 'final' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to complete game');
        return;
      }
      fetchGameData();
    } catch (error) {
      console.error('Error completing game:', error);
      alert('Failed to complete game');
    }
  };

  const skipTurn = async () => {
    const picker = getCurrentPicker();
    if (!picker) return;
    if (!confirm(`Skip ${picker.name}? You can assign their pick later.`)) return;

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: Number(gameId), skip: true }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to skip');
        return;
      }

      await fetchGameData();
    } catch (error) {
      console.error('Error skipping pick:', error);
      alert('Failed to skip');
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
      case 'ready': return 'bg-cyan-500/20 text-cyan-400';
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
      return Math.max(0, 3 - hockeyPlayer.goals) + (hockeyPlayer.goals_scored || 0) * 2;
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
  const isSkippedPick = (p: Pick) => !p.is_win_pick && p.hockey_player_id == null;
  const mySkippedPick = user ? picks.find(p => p.player_id === user.id && isSkippedPick(p)) : undefined;
  const canPick = game.status === 'drafting' && !!user && (
    user.is_admin ? !!currentPicker : currentPicker?.id === user.id || !!mySkippedPick
  );
  const pickedHockeyPlayerIds = new Set(picks.map(p => p.hockey_player_id).filter(Boolean));
  const winTaken = picks.some(p => p.is_win_pick);
  const canEditScore = !!user && (
    game.status === 'in_progress' ||
    (user.is_admin && ['ready', 'in_progress', 'final'].includes(game.status))
  );

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
              <div className="text-center text-gray-400 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                {canEditScore ? (
                  <>
                    <button onClick={() => adjustScore('period', -1)} disabled={game.period <= 0} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded font-bold">−</button>
                    <span>Period {game.period}</span>
                    <button onClick={() => adjustScore('period', 1)} className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded font-bold">+</button>
                  </>
                ) : (
                  <span>Period {game.period}</span>
                )}
              </div>
              {game.last_updated_by_name && game.score_updated_at && (
                <div className="text-center text-xs text-gray-500 mt-2">
                  Last update: {game.last_updated_by_name} at {new Date(game.score_updated_at + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              )}

              {canEditScore && (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                  {user && (
                    <button
                      onClick={completeGame}
                      className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                    >
                      Complete Game — Calculate Skins &amp; Balances
                    </button>
                  )}
                </div>
              )}
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

          {game.status === 'ready' && (
            <div className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 text-center">
                <div className="text-lg font-semibold text-cyan-400">Draft Complete</div>
                <div className="text-sm text-gray-400">Waiting for puck drop</div>
              </div>
              {user && (
                <button
                  onClick={startGame}
                  className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-lg transition-colors"
                >
                  Start Game
                </button>
              )}
            </div>
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
                {user?.is_admin && (
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={skipTurn}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Skip {currentPicker.name.split(' ')[0]}
                    </button>
                    <button
                      onClick={endDraft}
                      className="px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-semibold transition-colors"
                    >
                      End Draft
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {game.status === 'drafting' && mySkippedPick && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mt-4 text-orange-300 text-sm">
              Your pick was skipped — tap a player below anytime to complete it.
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
                                {editingPickId === pick.id ? (
                                  <select
                                    autoFocus
                                    defaultValue=""
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (v === 'win') {
                                        changePick(pick.id, null, true);
                                      } else if (v) {
                                        changePick(pick.id, Number(v), false);
                                      } else {
                                        setEditingPickId(null);
                                      }
                                    }}
                                    onBlur={() => setEditingPickId(null)}
                                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                  >
                                    <option value="">Choose replacement...</option>
                                    {!picks.some(p => p.is_win_pick && p.id !== pick.id) && (
                                      <option value="win">WIN (team victory)</option>
                                    )}
                                    {hockeyPlayers
                                      .filter(hp => !pickedHockeyPlayerIds.has(hp.id) || hp.id === pick.hockey_player_id)
                                      .map(hp => (
                                        <option key={hp.id} value={hp.id}>
                                          {hp.name} ({hp.position === 'F' ? 'Fwd' : hp.position === 'D' ? 'Def' : 'G'})
                                        </option>
                                      ))}
                                  </select>
                                ) : isSkippedPick(pick) ? (
                                  <>
                                    <span className="text-orange-400">SKIPPED — awaiting pick</span>
                                    {user?.is_admin && game.status !== 'upcoming' && (
                                      <button
                                        onClick={() => setEditingPickId(pick.id)}
                                        className="ml-2 text-xs text-blue-400 hover:text-blue-300"
                                      >
                                        assign
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {pick.is_win_pick ? (
                                      <span className="text-green-400">WIN ({pick.skins} skins)</span>
                                    ) : (
                                      <span>{pick.hockey_player_name} ({pick.skins} skins)</span>
                                    )}
                                    {user?.is_admin && game.status !== 'upcoming' && (
                                      <button
                                        onClick={() => setEditingPickId(pick.id)}
                                        className="ml-2 text-xs text-blue-400 hover:text-blue-300"
                                      >
                                        change
                                      </button>
                                    )}
                                  </>
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
            <h2 className="text-2xl font-bold mb-4">{canEditScore ? 'Scoring' : 'Available Picks'}</h2>
            {canEditScore && (
              <p className="text-xs text-gray-500 -mt-3 mb-4">Tap + under G when a Wild player scores. For a goalie, + under GA is a goal allowed (feeds the opponent score); + under G means the goalie scored!</p>
            )}

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
                          {canEditScore ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateGoals(hp.id, hp.position === 'G' ? 'goals_scored' : 'goals', Math.max(0, (hp.position === 'G' ? hp.goals_scored : hp.goals) - 1)); }}
                                  disabled={(hp.position === 'G' ? hp.goals_scored : hp.goals) <= 0}
                                  className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded font-bold"
                                >−</button>
                                <span className="text-yellow-400 font-bold w-12 text-center">
                                  {hp.position === 'G' ? hp.goals_scored : hp.goals}<span className="text-xs font-normal"> G</span>
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateGoals(hp.id, hp.position === 'G' ? 'goals_scored' : 'goals', (hp.position === 'G' ? hp.goals_scored : hp.goals) + 1); }}
                                  className="w-8 h-8 bg-green-600 hover:bg-green-500 rounded font-bold"
                                >+</button>
                              </div>
                              {hp.position === 'G' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateGoals(hp.id, 'goals', Math.max(0, hp.goals - 1)); }}
                                    disabled={hp.goals <= 0}
                                    className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded font-bold"
                                  >−</button>
                                  <span className="text-red-400 font-bold w-12 text-center">
                                    {hp.goals}<span className="text-xs font-normal"> GA</span>
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateGoals(hp.id, 'goals', hp.goals + 1); }}
                                    className="w-8 h-8 bg-red-600 hover:bg-red-500 rounded font-bold"
                                  >+</button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="text-2xl font-bold">
                                {taken ? <span className="text-sm text-gray-500">TAKEN</span> : hp.position === 'F' ? '1' : hp.position === 'D' ? '2' : '3'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {hp.position === 'G'
                                  ? `${hp.goals > 0 ? `${hp.goals}GA` : ''}${hp.goals > 0 && hp.goals_scored > 0 ? ' ' : ''}${hp.goals_scored > 0 ? `${hp.goals_scored}G` : ''}`
                                  : hp.goals > 0 && `${hp.goals}G`}
                              </div>
                            </>
                          )}
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
