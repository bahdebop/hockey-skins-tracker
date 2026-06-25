'use client';

import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import { Payment, Player } from '@/lib/types';

export default function BalancePage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, playersRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/players'),
      ]);

      const paymentsData = await paymentsRes.json();
      const playersData = await playersRes.json();

      setPayments(paymentsData);
      setPlayers(playersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePayment = async (paymentId: number, currentStatus: boolean) => {
    try {
      await fetch('/api/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paymentId,
          paid: !currentStatus,
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };

  const getPlayerName = (playerId: number) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  const filteredPayments = payments.filter(payment => {
    if (filter === 'paid') return payment.paid;
    if (filter === 'unpaid') return !payment.paid;
    return true;
  });

  const totalOwed = payments
    .filter(p => !p.paid)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = payments
    .filter(p => p.paid)
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
            <DollarSign className="w-10 h-10 text-green-400" />
            Balance & Payments
          </h1>
          <p className="text-gray-400">Track who owes what</p>
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
              All Payments
            </button>
            <button
              onClick={() => setFilter('unpaid')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                filter === 'unpaid'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Unpaid
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors ${
                filter === 'paid'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Paid
            </button>
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Payments</h2>
            <p className="text-gray-400">
              {filter === 'all'
                ? 'No payments recorded yet'
                : filter === 'paid'
                ? 'No paid payments'
                : 'No unpaid payments'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className={`border rounded-lg p-6 transition-all ${
                  payment.paid
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-lg font-semibold">
                        {getPlayerName(payment.from_player_id)}
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-500" />
                      <div className="text-lg font-semibold">
                        {getPlayerName(payment.to_player_id)}
                      </div>
                    </div>

                    <div className="text-2xl font-bold text-green-400">
                      ${payment.amount.toFixed(2)}
                    </div>
                  </div>

                  <button
                    onClick={() => togglePayment(payment.id, payment.paid)}
                    className={`ml-4 px-6 py-3 rounded-lg font-semibold transition-colors ${
                      payment.paid
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {payment.paid ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Paid
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Mark Paid
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-3 text-sm text-gray-400">
                  {payment.paid && payment.paid_at && (
                    <div>Paid on {new Date(payment.paid_at).toLocaleDateString()}</div>
                  )}
                  {payment.game_id && <div>Game #{payment.game_id}</div>}
                  <div>Created {new Date(payment.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
