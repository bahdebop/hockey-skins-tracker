import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const players: any[] = db.prepare('SELECT id, name FROM players ORDER BY name').all();

    const picks: any[] = db.prepare(`
      SELECT pk.player_id, pk.game_id, pk.skins, g.pot_amount
      FROM picks pk
      JOIN games g ON pk.game_id = g.id
    `).all();

    // Per-game skin value = pot total / total skins (pot splits by skins)
    const gameTotals = new Map<number, { skins: number; pot: number; players: number }>();
    for (const p of picks) {
      const t = gameTotals.get(p.game_id) || { skins: 0, pot: p.pot_amount, players: 0 };
      t.skins += p.skins;
      t.players += 1;
      gameTotals.set(p.game_id, t);
    }
    const skinValue = new Map<number, number>();
    for (const [gameId, t] of gameTotals) {
      skinValue.set(gameId, t.skins > 0 ? (t.pot * t.players) / t.skins : 0);
    }

    const stats = players.map((p) => {
      const mine = picks.filter((pk) => pk.player_id === p.id);
      const totalSkins = mine.reduce((s, pk) => s + pk.skins, 0);
      const gamesPlayed = new Set(mine.map((pk) => pk.game_id)).size;
      // Games with zero total skins settle as a push — nobody wins or
      // loses, so the ante isn't counted toward spend for those games.
      const totalSpent = mine.reduce((s, pk) => {
        const t = gameTotals.get(pk.game_id);
        return t && t.skins > 0 ? s + pk.pot_amount : s;
      }, 0);
      const totalWon = mine.reduce((s, pk) => s + pk.skins * (skinValue.get(pk.game_id) || 0), 0);

      return {
        player_id: p.id,
        player_name: p.name,
        total_skins: totalSkins,
        games_played: gamesPlayed,
        total_spent: Math.round(totalSpent * 100) / 100,
        total_won: Math.round(totalWon * 100) / 100,
        net_balance: Math.round((totalWon - totalSpent) * 100) / 100,
      };
    });

    stats.sort((a, b) => b.total_skins - a.total_skins);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
