import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    if (id) {
      const game = db.prepare(`
        SELECT g.*, p.name as creator_name
        FROM games g
        JOIN players p ON g.created_by = p.id
        WHERE g.id = ?
      `).get(id);
      return NextResponse.json(game);
    }

    let query = `
      SELECT g.*, p.name as creator_name
      FROM games g
      JOIN players p ON g.created_by = p.id
    `;
    const params: any[] = [];

    if (status) {
      query += ' WHERE g.status = ?';
      params.push(status);
    }

    query += ' ORDER BY g.game_date ASC';

    const games = db.prepare(query).all(...params);
    return NextResponse.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { opponent, game_date, pot_amount, created_by, nhl_game_id } = body;

    const result = db.prepare(`
      INSERT INTO games (opponent, game_date, pot_amount, created_by, nhl_game_id, status)
      VALUES (?, ?, ?, ?, ?, 'upcoming')
    `).run(opponent, game_date, pot_amount, created_by, nhl_game_id || null);

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, draft_order, current_pick_index, period, wild_score, opponent_score } = body;

    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (draft_order !== undefined) {
      updates.push('draft_order = ?');
      params.push(draft_order);
    }
    if (current_pick_index !== undefined) {
      updates.push('current_pick_index = ?');
      params.push(current_pick_index);
    }
    if (period !== undefined) {
      updates.push('period = ?');
      params.push(period);
    }
    if (wild_score !== undefined) {
      updates.push('wild_score = ?');
      params.push(wild_score);
    }
    if (opponent_score !== undefined) {
      updates.push('opponent_score = ?');
      params.push(opponent_score);
    }

    params.push(id);

    db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    
    return NextResponse.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
  }
}
