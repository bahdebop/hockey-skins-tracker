import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const players = db.prepare(`
      SELECT * FROM hockey_players 
      WHERE game_id = ? 
      ORDER BY 
        CASE position 
          WHEN 'F' THEN 1 
          WHEN 'D' THEN 2 
          WHEN 'G' THEN 3 
        END,
        jersey_number
    `).all(gameId);
    
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching hockey players:', error);
    return NextResponse.json({ error: 'Failed to fetch hockey players' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { game_id, name, position, jersey_number, nhl_player_id } = body;

    const result = db.prepare(`
      INSERT INTO hockey_players (game_id, name, position, jersey_number, nhl_player_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(game_id, name, position, jersey_number || null, nhl_player_id || null);

    const player = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(player);
  } catch (error) {
    console.error('Error creating hockey player:', error);
    return NextResponse.json({ error: 'Failed to create hockey player' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, goals } = body;

    db.prepare('UPDATE hockey_players SET goals = ? WHERE id = ?').run(goals, id);
    const player = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(id);
    
    return NextResponse.json(player);
  } catch (error) {
    console.error('Error updating hockey player:', error);
    return NextResponse.json({ error: 'Failed to update hockey player' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Hockey player ID required' }, { status: 400 });
    }

    db.prepare('DELETE FROM hockey_players WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting hockey player:', error);
    return NextResponse.json({ error: 'Failed to delete hockey player' }, { status: 500 });
  }
}
