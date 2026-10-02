'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Target, DollarSign, Settings, User, Users, LogIn, Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/games', label: 'Games', icon: Target },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/balance', label: 'Balance', icon: DollarSign },
    { href: '/players', label: 'Players', icon: Users },
    { href: '/admin', label: 'Admin', icon: Settings },
  ];

  const authLink = user
    ? { href: '/profile', label: user.name, icon: User }
    : { href: '/login', label: 'Login', icon: LogIn };

  const linkClass = (href: string) =>
    `flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-colors ${
      pathname === href
        ? 'bg-green-600 text-white'
        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`;

  const mobileLinkClass = (href: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      pathname === href
        ? 'bg-green-600 text-white'
        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`;

  return (
    <nav className="bg-gray-900/80 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            🏒 Hockey Skins
          </Link>

          <div className="hidden md:flex gap-2 items-center">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={linkClass(href)}>
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
            <Link href={authLink.href} className={linkClass(authLink.href)}>
              <authLink.icon className="w-4 h-4" />
              <span>{authLink.label}</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="md:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={mobileLinkClass(href)}>
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            ))}
            <div className="border-t border-gray-800 my-1" />
            <Link href={authLink.href} className={mobileLinkClass(authLink.href)}>
              <authLink.icon className="w-5 h-5" />
              <span>{authLink.label}</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
