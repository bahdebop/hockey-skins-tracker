'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Phone, DollarSign, Trophy, Target } from 'lucide-react';
import { Player } from '@/lib/types';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.id as string;
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        const foundPlayer = data.find((p: Player) => p.id === parseInt(playerId));
        setPlayer(foundPlayer || null);
      } catch (error) {
        console.error('Error fetching player:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayer();
  }, [playerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading player...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Player not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/players"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Players
        </Link>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 md:p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-3xl font-bold">
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{player.name}</h1>
              <p className="text-gray-400">Player Profile</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-green-400" />
                Contact Information
              </h2>
              <div className="space-y-3">
                {player.email ? (
                  <div>
                    <div className="text-sm text-gray-400">Email</div>
                    <a href={`mailto:${player.email}`} className="text-green-400 hover:text-green-300">
                      {player.email}
                    </a>
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No email provided</div>
                )}

                {player.phone ? (
                  <div>
                    <div className="text-sm text-gray-400">Phone</div>
                    <a href={`tel:${player.phone}`} className="text-green-400 hover:text-green-300">
                      {player.phone}
                    </a>
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No phone provided</div>
                )}
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Payment Information
              </h2>
              <div className="space-y-3">
                {player.venmo_username ? (
                  <div>
                    <div className="text-sm text-gray-400">Venmo</div>
                    <a
                      href={`https://venmo.com/${player.venmo_username.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300"
                    >
                      {player.venmo_username}
                    </a>
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No Venmo username</div>
                )}

                {player.paypal_email ? (
                  <div>
                    <div className="text-sm text-gray-400">PayPal</div>
                    <a
                      href={`https://paypal.me/${player.paypal_email}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300"
                    >
                      {player.paypal_email}
                    </a>
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No PayPal email</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-gray-400">
              <Trophy className="w-4 h-4 inline mr-2" />
              Player stats and game history coming soon!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
