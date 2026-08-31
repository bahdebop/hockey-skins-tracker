'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Mail, Phone, DollarSign, ExternalLink } from 'lucide-react';
import { Player } from '@/lib/types';

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        setPlayers(data);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading players...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center gap-3">
            <Users className="w-10 h-10 text-green-400" />
            Players Directory
          </h1>
          <p className="text-gray-400">View player contact and payment information</p>
        </div>

        {players.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur rounded-lg p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Players Yet</h2>
            <p className="text-gray-400">Add players in the admin panel to get started</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {players.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-800/70 transition-all hover:scale-105"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-xl font-bold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{player.name}</h3>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {player.email && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{player.email}</span>
                    </div>
                  )}

                  {player.phone && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Phone className="w-4 h-4" />
                      <span>{player.phone}</span>
                    </div>
                  )}

                  {(player.venmo_username || player.paypal_email) && (
                    <div className="pt-2 border-t border-gray-700">
                      <div className="flex items-center gap-2 text-green-400 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold">Payment Info</span>
                      </div>
                      {player.venmo_username && (
                        <div className="text-gray-400 ml-6">
                          Venmo: {player.venmo_username}
                        </div>
                      )}
                      {player.paypal_email && (
                        <div className="text-gray-400 ml-6 truncate">
                          PayPal: {player.paypal_email}
                        </div>
                      )}
                    </div>
                  )}

                  {!player.email && !player.phone && !player.venmo_username && !player.paypal_email && (
                    <div className="text-gray-500 italic">No contact info available</div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
                  View Profile
                  <ExternalLink className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
