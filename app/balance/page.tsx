'use client';

import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Payment, Player } from '@/lib/types';

interface PairBalance {
  debtorId: number;     // who owes
  creditorId: number;   // who is owed
  net: number;          // unpaid net (debtor -> creditor)
  payments: Payment[];  // all rows between the pair, both directions
  unpaidIds: number[];  // unpaid rows making up the net
}

export default function BalancePage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'owed' | 'paid'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, playersRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/players'),
      ]);

      setPayments(await paymentsRes.json());
      setPlayers(await playersRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const markPaid = async (paymentId: number) => {
    await fetch('/api/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: paymentId, paid: true }),
    });
  };

  const settlePair = async (pair: PairBalance) => {
    setSettling(pair.debtorId * 100000 + pair.creditorId);
    try {
      await Promise.all(pair.unpaidIds.map(markPaid));
      fetchData();
    } catch (error) {
      console.error('Error settling payments:', error);
    } finally {
      setSettling(null);
    }
  };

  const markSinglePaid = async (paymentId: number) => {
    setSettling(paymentId);
    try {
      await markPaid(paymentId);
      fetchData();
    } finally {
      setSettling(null);
    }
  };

  const getPlayerName = (playerId: number) =>
    players.find(p => p.id === playerId)?.name || 'Unknown';

  // Group every payment into an unordered pair, then net the unpaid
  // amounts both directions so nobody pays money that comes right back.
  const pairMap = new Map<string, { a: number; b: number; rows: Payment[] }>();
  for (const p of payments) {
    if (p.from_player_id === p.to_player_id) continue;
    const a = Math.min(p.from_player_id, p.to_player_id);
    const b = Math.max(p.from_player_id, p.to_player_id);
    const key = `${a}-${b}`;
    const pair = pairMap.get(key) || { a, b, rows: [] };
    pair.rows.push(p);
    pairMap.set(key, pair);
  }

  const pairs: PairBalance[] = [];
  for (const { a, b, rows } of pairMap.values()) {
    let net = 0;
    for (const p of rows) {
      if (p.paid) continue;
      // positive = a owes b
      net += p.from_player_id === a ? p.amount : -p.amount;
    }
    if (net === 0) continue;
    const debtorId = net > 0 ? a : b;
    const creditorId = net > 0 ? b : a;
    pairs.push({
      debtorId,
      creditorId,
      net: Math.abs(net),
      payments: rows.slice().sort((x, y) =>
        new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
      ),
      unpaidIds: rows.filter(r => !r.paid).map(r => r.id),
    });
  }
  pairs.sort((x, y) => y.net - x.net);

  const paidPayments = payments
    .filter(p => p.paid)
    .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());

  const totalOwed = pairs.reduce((sum, p) => sum + p.net, 0);
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const pairKey = (pair: PairBalance) => `${pair.debtorId}-${pair.creditorId}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading payments...</div>
      </div>
    );
  }

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
          <p className="text-gray-400">Track who owes what — payments between the same two people are combined</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-red-400" />
              <div className="text-sm text-gray-400">Total Owed</div>
            </div>
            <div className="text-3xl font-bold text-red-400">
              ${totalOwed.toFixed(2)}
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

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              <div className="text-sm text-gray-400">Total Volume</div>
            </div>
            <div className="text-3xl font-bold text-blue-400">
              ${(totalOwed + totalPaid).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('owed')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                filter === 'owed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Owed
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                filter === 'paid'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Paid History
            </button>
          </div>
        </div>

        {showOwed && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-3">Outstanding Balances</h2>
            {pairs.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center text-gray-400">
                All settled up — nobody owes anything
              </div>
            ) : (
              <div className="space-y-3">
                {pairs.map((pair) => {
                  const key = pairKey(pair);
                  const isOpen = expanded.has(key);
                  return (
                    <div key={key} className="border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden">
                      <button
                        onClick={() => toggleExpanded(key)}
                        className="w-full flex items-center justify-between p-5 hover:bg-gray-800/70 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                          <div className="text-lg font-semibold">
                            {getPlayerName(pair.debtorId)}
                          </div>
                          <ArrowRight className="w-5 h-5 text-gray-500" />
                          <div className="text-lg font-semibold">
                            {getPlayerName(pair.creditorId)}
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-700/60 rounded-full px-2 py-1 ml-2">
                            {pair.unpaidIds.length} unpaid
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-green-400">
                            ${pair.net.toFixed(2)}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); settlePair(pair); }}
                            disabled={settling !== null}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
                          >
                            Mark all paid
                          </button>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-gray-700 px-5 py-3 bg-gray-900/40">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Ledger</div>
                          <div className="space-y-2">
                            {pair.payments.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={p.paid ? 'text-gray-500 line-through' : 'text-gray-200'}>
                                    {getPlayerName(p.from_player_id)} → {getPlayerName(p.to_player_id)}
                                  </span>
                                  <span className="text-gray-500">
                                    {p.game_id ? `Game #${p.game_id}` : 'Manual'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={p.paid ? 'text-gray-500 line-through' : 'text-gray-200'}>
                                    ${p.amount.toFixed(2)}
                                  </span>
                                  {p.paid ? (
                                    <span className="text-xs text-green-400 w-16 text-right">paid</span>
                                  ) : (
                                    <button
                                      onClick={() => markSinglePaid(p.id)}
                                      disabled={settling !== null}
                                      className="text-xs text-yellow-400 hover:text-yellow-300 w-16 text-right disabled:opacity-50"
                                    >
                                      mark paid
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700 text-sm">
                            <span className="text-gray-400">Net unpaid</span>
                            <span className="font-semibold text-green-400">
                              {getPlayerName(pair.debtorId)} owes {getPlayerName(pair.creditorId)} ${pair.net.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showPaid && (
          <div>
            <h2 className="text-xl font-bold mb-3">Paid History</h2>
            {paidPayments.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center text-gray-400">
                No paid payments yet
              </div>
            ) : (
              <div className="space-y-3">
                {paidPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border rounded-lg p-5 bg-green-500/5 border-green-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold">
                          {getPlayerName(payment.from_player_id)}
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-500" />
                        <div className="text-lg font-semibold">
                          {getPlayerName(payment.to_player_id)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-400">
                        ${payment.amount.toFixed(2)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400 flex items-center gap-4">
                      {payment.game_id && <span>Game #{payment.game_id}</span>}
                      {payment.paid_at && (
                        <span>Paid {new Date(payment.paid_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
