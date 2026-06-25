import Link from 'next/link';
import { Trophy, Target, DollarSign, PlusCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 mt-8">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            🏒 Hockey Skins Tracker
          </h1>
          <p className="text-xl text-gray-400">
            Track your Minnesota Wild skins pool games
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Link
            href="/games"
            className="bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-800/70 transition-all hover:scale-105"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Target className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Games</h2>
                <p className="text-gray-400 text-sm">View & join games</p>
              </div>
            </div>
            <p className="text-gray-300">
              Browse upcoming Wild games and make your picks
            </p>
          </Link>

          <Link
            href="/leaderboard"
            className="bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-800/70 transition-all hover:scale-105"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Trophy className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Leaderboard</h2>
                <p className="text-gray-400 text-sm">Season standings</p>
              </div>
            </div>
            <p className="text-gray-300">
              See who's leading in total skins this season
            </p>
          </Link>

          <Link
            href="/balance"
            className="bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-800/70 transition-all hover:scale-105"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <DollarSign className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Balance</h2>
                <p className="text-gray-400 text-sm">Track payments</p>
              </div>
            </div>
            <p className="text-gray-300">
              See who owes what and settle up
            </p>
          </Link>

          <Link
            href="/games/create"
            className="bg-gradient-to-br from-green-600 to-blue-600 rounded-lg p-6 hover:from-green-700 hover:to-blue-700 transition-all hover:scale-105"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <PlusCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Create Game</h2>
                <p className="text-white/80 text-sm">Start a new pool</p>
              </div>
            </div>
            <p className="text-white/90">
              Set up a new skins game and invite players
            </p>
          </Link>
        </div>

        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-8">
          <h3 className="text-2xl font-bold mb-4">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-4xl mb-2">1️⃣</div>
              <h4 className="font-bold mb-2">Create or Join Game</h4>
              <p className="text-gray-400 text-sm">
                Pick an upcoming Wild game and set the pot amount
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">2️⃣</div>
              <h4 className="font-bold mb-2">Draft Players</h4>
              <p className="text-gray-400 text-sm">
                Take turns picking Wild players or the "Win" option
              </p>
            </div>
            <div>
              <div className="text-4xl mb-2">3️⃣</div>
              <h4 className="font-bold mb-2">Earn Skins</h4>
              <p className="text-gray-400 text-sm">
                Goals = skins. Most skins wins the pot!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
