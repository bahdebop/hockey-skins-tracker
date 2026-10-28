import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { syncBatchStatus } from '@/lib/payout';

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
    }
    const body = await request.json();
    const { from_player_id, to_player_id, amount, game_id } = body;

    // Manual entries are settlement records (money that moved outside a
    // batch) — they land already paid and net into the next calculation.
    const result = db.prepare(`
      INSERT INTO payments (from_player_id, to_player_id, amount, game_id, paid, paid_at, marked_by)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
    `).run(from_player_id, to_player_id, amount, game_id || null, user.userId);

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
    }
    const body = await request.json();
    const { id, paid } = body;

    const updates: string[] = ['paid = ?', 'marked_by = ?'];
    const params: any[] = [paid ? 1 : 0, user.userId];

    if (paid) {
      updates.push('paid_at = CURRENT_TIMESTAMP');
    } else {
      updates.push('paid_at = NULL');
    }

    params.push(id);

    db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const payment: any = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);

    if (payment?.batch_id) syncBatchStatus(payment.batch_id);

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.userId)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
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
