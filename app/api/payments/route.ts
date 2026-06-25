import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('player_id');
    const gameId = searchParams.get('game_id');

    let query = 'SELECT * FROM payments';
    const params: any[] = [];
    const conditions: string[] = [];

    if (playerId) {
      conditions.push('(from_player_id = ? OR to_player_id = ?)');
      params.push(playerId, playerId);
    }

    if (gameId) {
      conditions.push('game_id = ?');
      params.push(gameId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const payments = db.prepare(query).all(...params);
    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from_player_id, to_player_id, amount, game_id } = body;

    const result = db.prepare(`
      INSERT INTO payments (from_player_id, to_player_id, amount, game_id)
      VALUES (?, ?, ?, ?)
    `).run(from_player_id, to_player_id, amount, game_id || null);

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, paid } = body;

    const updates: string[] = ['paid = ?'];
    const params: any[] = [paid ? 1 : 0];

    if (paid) {
      updates.push('paid_at = CURRENT_TIMESTAMP');
    } else {
      updates.push('paid_at = NULL');
    }

    params.push(id);

    db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }

    db.prepare('DELETE FROM payments WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
