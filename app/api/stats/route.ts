import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const stats = db.prepare(`
      SELECT 
        p.id as player_id,
        p.name as player_name,
        COALESCE(SUM(pk.skins), 0) as total_skins,
        COUNT(DISTINCT pk.game_id) as games_played,
        COALESCE(SUM(g.pot_amount), 0) as total_spent,
        0 as total_won,
        0 as net_balance
      FROM players p
      LEFT JOIN picks pk ON p.id = pk.player_id
      LEFT JOIN games g ON pk.game_id = g.id
      GROUP BY p.id, p.name
      ORDER BY total_skins DESC
    `).all();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
