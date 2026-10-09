import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { populateRosterForGame } from '@/lib/nhl';
import { recomputePickSkins, settleGame } from '@/lib/scoring';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { sendPushToPlayers } from '@/lib/push';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    if (id) {
      const game = db.prepare(`
        SELECT g.*, p.name as creator_name, u.name as last_updated_by_name
        FROM games g
        JOIN players p ON g.created_by = p.id
        LEFT JOIN players u ON g.last_updated_by = u.id
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

    const gameId = Number(result.lastInsertRowid);
    try {
      await populateRosterForGame(gameId);
    } catch (e) {
      console.error('Failed to auto-populate Wild roster:', e);
    }

    const others = (db.prepare('SELECT DISTINCT player_id FROM push_subscriptions').all() as { player_id: number }[])
      .map(r => r.player_id)
      .filter(pid => pid !== Number(created_by));
    sendPushToPlayers(others, {
      title: 'New game posted!',
      body: `Wild vs ${opponent} — ${new Date(game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Draft coming soon.`,
      url: `/games/${gameId}`,
      tag: `new-game-${gameId}`,
    });

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    return NextResponse.json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, draft_order, current_pick_index, period, wild_score, opponent_score } = body;

    const existingGame: any = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const editingScore = wild_score !== undefined || opponent_score !== undefined || period !== undefined;
    if (editingScore && existingGame.status !== 'in_progress' && !isAdmin(user.userId)) {
      return NextResponse.json({ error: 'Scores can only be updated while the game is in progress' }, { status: 403 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (draft_order !== undefined) {
      updates.push('draft_order = ?');
      params.push(draft_order);
    } else if (status === 'drafting' && existingGame.status !== 'drafting') {
      // Rotating draft order: whoever picked first last game goes last
      // this game; everyone else moves up one spot. First game ever
      // falls back to a random order. New players join at the end.
      const prev: any = db.prepare(`
        SELECT draft_order FROM games
        WHERE id != ? AND draft_order IS NOT NULL AND draft_order != ''
        ORDER BY id DESC LIMIT 1
      `).get(id);
      const currentIds = (db.prepare('SELECT id FROM players').all() as { id: number }[]).map(r => r.id);

      let order: number[];
      if (prev) {
        const prevOrder: number[] = JSON.parse(prev.draft_order);
        order = [...prevOrder.slice(1), prevOrder[0]].filter(pid => currentIds.includes(pid));
        for (const pid of currentIds) {
          if (!order.includes(pid)) order.push(pid);
        }
      } else {
        order = [...currentIds].sort(() => Math.random() - 0.5);
      }

      updates.push('draft_order = ?');
      params.push(JSON.stringify(order));
      if (current_pick_index === undefined) {
        updates.push('current_pick_index = ?');
        params.push(0);
      }
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

    if (editingScore) {
      updates.push('last_updated_by = ?');
      params.push(user.userId);
      updates.push('score_updated_at = CURRENT_TIMESTAMP');
    }

    params.push(id);

    db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (status === 'final') {
      settleGame(id);
      const pickers = (db.prepare('SELECT DISTINCT player_id FROM picks WHERE game_id = ?').all(id) as { player_id: number }[])
        .map(r => r.player_id);
      sendPushToPlayers(pickers, {
        title: 'Game final — balances settled',
        body: `MIN ${wild_score ?? existingGame.wild_score} - ${opponent_score ?? existingGame.opponent_score} vs ${existingGame.opponent}. Check what you're owed.`,
        url: '/balance',
        tag: `game-final-${id}`,
      });
    } else if (status === 'drafting' && existingGame.status !== 'drafting') {
      const updated: any = db.prepare('SELECT draft_order FROM games WHERE id = ?').get(id);
      const order: number[] = JSON.parse(updated?.draft_order || '[]');
      if (order.length > 0) {
        sendPushToPlayers([order[0]], {
          title: 'Draft started — you pick first!',
          body: `vs ${existingGame.opponent} — tap to make your pick`,
          url: `/games/${id}`,
          tag: `draft-start-${id}`,
        });
      }
    } else if (wild_score !== undefined || opponent_score !== undefined) {
      recomputePickSkins(id);
    }

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
