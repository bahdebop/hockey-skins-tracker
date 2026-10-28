'use client';

import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, Clock, ArrowRight, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import { Payment, Player, PayoutBatch } from '@/lib/types';

interface PayoutData {
  openBatch: (PayoutBatch & { transfers: Payment[] }) | null;
  batches: (PayoutBatch & { transfers: Payment[] })[];
  accruingGames: number;
}

export default function BalancePage() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'owed' | 'paid'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [payoutRes, paymentsRes, playersRes, meRes] = await Promise.all([
        fetch('/api/payout'),
        fetch('/api/payments'),
        fetch('/api/players'),
        fetch('/api/auth/me'),
      ]);

      setData(await payoutRes.json());
      setPayments(await paymentsRes.json());
      setPlayers(await playersRes.json());
      setMe(meRes.ok ? await meRes.json() : null);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (playerId: number) =>
    players.find(p => p.id === playerId)?.name || 'Unknown';

  const setPaid = async (paymentId: number, paid: boolean) => {
    const res = await fetch('/api/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: paymentId, paid }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Could not update payment');
    }
  };

  const togglePaid = async (paymentId: number, paid: boolean) => {
    setBusy(true);
    try {
      await setPaid(paymentId, paid);
      fetchData();
    } finally {
      setBusy(false);
    }
  };

  const calculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch('/api/payout', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Could not calculate payout');
        return;
      }
      fetchData();
    } finally {
      setCalculating(false);
    }
  };

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading payments...</div>
      </div>
    );
  }

  const openBatch = data?.openBatch || null;
  const transfers = openBatch?.transfers || [];
  const paidCount = transfers.filter(t => t.paid).length;
  const openTotal = transfers.filter(t => !t.paid).reduce((s, t) => s + t.amount, 0);

  const closedBatches = (data?.batches || []).filter(b => b.status === 'closed');
  // Settlement records: paid payments not belonging to any batch
  const settlements = payments
    .filter(p => p.paid && !p.batch_id)
    .sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime());
  const totalPaid = payments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0);

  const showOwed = filter === 'all' || filter === 'owed';
  const showPaid = filter === 'all' || filter === 'paid';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
            <DollarSign className="w-10 h-10 text-green-400" />
            Balance & Payments
          </h1>
          <p className="text-gray-400">
            Money accrues all season — an admin calculates one efficient payout when it's time to settle up
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-red-400" />
              <div className="text-sm text-gray-400">Outstanding</div>
            </div>
            <div className="text-3xl font-bold text-red-400">
              ${openTotal.toFixed(2)}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calculator className="w-5 h-5 text-blue-400" />
              <div className="text-sm text-gray-400">Games Accruing</div>
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {data?.accruingGames ?? 0}
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div className="text-sm text-gray-400">Total Paid</div>
            </div>
            <div className="text-3xl font-bold text-green-400">
              ${totalPaid.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            {(['all', 'owed', 'paid'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                  filter === f
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'owed' ? 'Owed' : 'Paid History'}
              </button>
            ))}
          </div>
        </div>

        {showOwed && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Current Payout</h2>
            {openBatch ? (
              <div className="border border-yellow-500/40 bg-yellow-500/5 rounded-lg overflow-hidden">
                <div className="p-5 flex items-center justify-between border-b border-gray-700">
                  <div>
                    <div className="font-semibold">
                      Payout batch #{openBatch.id}
                    </div>
                    <div className="text-sm text-gray-400">
                      Calculated {new Date(openBatch.created_at).toLocaleDateString()} by {openBatch.created_by_name}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-yellow-400">
                    {paidCount} of {transfers.length} paid
                  </div>
                </div>
                <div className="divide-y divide-gray-800">
                  {transfers.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-semibold ${t.paid ? 'text-gray-500 line-through' : ''}`}>
                          {getPlayerName(t.from_player_id)}
                        </span>
                        <ArrowRight className="w-5 h-5 text-gray-500" />
                        <span className={`text-lg font-semibold ${t.paid ? 'text-gray-500 line-through' : ''}`}>
                          {getPlayerName(t.to_player_id)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xl font-bold ${t.paid ? 'text-gray-500 line-through' : 'text-green-400'}`}>
                          ${t.amount.toFixed(2)}
                        </span>
                        {me && (
                          <button
                            onClick={() => togglePaid(t.id, !t.paid)}
                            disabled={busy}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                              t.paid
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {t.paid ? 'Undo' : 'Mark paid'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
                  When every transfer is paid this batch closes automatically and the slate wipes clean.
                  {(data?.accruingGames ?? 0) > 0 &&
                    ` ${data!.accruingGames} finished game${data!.accruingGames > 1 ? 's' : ''} already accruing toward the next payout.`}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center">
                <div className="text-gray-400 mb-1">All settled up — no open payout.</div>
                {(data?.accruingGames ?? 0) > 0 && (
                  <div className="text-sm text-gray-500 mb-4">
                    {data!.accruingGames} finished game{data!.accruingGames > 1 ? 's' : ''} accruing toward the next payout
                  </div>
                )}
                {me?.is_admin && (data?.accruingGames ?? 0) > 0 && (
                  <button
                    onClick={calculate}
                    disabled={calculating}
                    className="mt-3 inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
                  >
                    <Calculator className="w-5 h-5" />
                    {calculating ? 'Calculating…' : 'Calculate Payout'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {showPaid && (
          <div>
            <h2 className="text-xl font-bold mb-3">Paid History</h2>
            {closedBatches.length === 0 && settlements.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center text-gray-400">
                No paid payments yet
              </div>
            ) : (
              <div className="space-y-3">
                {closedBatches.map(batch => {
                  const key = `batch-${batch.id}`;
                  const isOpen = expanded.has(key);
                  const batchTotal = (batch.transfers || []).reduce((s, t) => s + t.amount, 0);
                  return (
                    <div key={key} className="border border-green-500/20 bg-green-500/5 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleExpanded(key)}
                        className="w-full flex items-center justify-between p-5 hover:bg-green-500/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                          <div className="font-semibold">Payout batch #{batch.id}</div>
                          <span className="text-sm text-gray-400">
                            {new Date(batch.created_at).toLocaleDateString()}
                            {batch.closed_at && ` — settled ${new Date(batch.closed_at).toLocaleDateString()}`}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-green-400">${batchTotal.toFixed(2)}</div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-700 px-5 py-3 space-y-2">
                          {(batch.transfers || []).map(t => (
                            <div key={t.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300">
                                  {getPlayerName(t.from_player_id)} → {getPlayerName(t.to_player_id)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-300">${t.amount.toFixed(2)}</span>
                                {t.paid_at && (
                                  <span className="text-xs text-gray-500">
                                    {new Date(t.paid_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {settlements.length > 0 && (
                  <div className="border border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpanded('settlements')}
                      className="w-full flex items-center justify-between p-5 hover:bg-gray-800/70 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {expanded.has('settlements') ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        <div className="font-semibold">Other settlements</div>
                        <span className="text-sm text-gray-400">{settlements.length} payments</span>
                      </div>
                      <div className="text-lg font-bold text-green-400">
                        ${settlements.reduce((s, p) => s + p.amount, 0).toFixed(2)}
                      </div>
                    </button>
                    {expanded.has('settlements') && (
                      <div className="border-t border-gray-700 px-5 py-3 space-y-2">
                        {settlements.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300">
                                {getPlayerName(p.from_player_id)} → {getPlayerName(p.to_player_id)}
                              </span>
                              {p.game_id && <span className="text-gray-500">Game #{p.game_id}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-300">${p.amount.toFixed(2)}</span>
                              {p.paid_at && (
                                <span className="text-xs text-gray-500">
                                  {new Date(p.paid_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
