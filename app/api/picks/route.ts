import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const playerId = searchParams.get('playerId');

    let query = `
      SELECT p.*, pl.name as player_name, hp.name as hockey_player_name, hp.position
      FROM picks p
      JOIN players pl ON p.player_id = pl.id
      LEFT JOIN hockey_players hp ON p.hockey_player_id = hp.id
    `;
    const params: any[] = [];

    const conditions: string[] = [];
    if (gameId) {
      conditions.push('p.game_id = ?');
      params.push(gameId);
    }
    if (playerId) {
      conditions.push('p.player_id = ?');
      params.push(playerId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.picked_at ASC';

    const picks = db.prepare(query).all(...params);
    return NextResponse.json(picks);
  } catch (error) {
    console.error('Error fetching picks:', error);
    return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_id, game_id, hockey_player_id, is_win_pick } = body;

    // Check if player already has a pick for this game
    const existingPick = db.prepare('SELECT * FROM picks WHERE player_id = ? AND game_id = ?').get(player_id, game_id);
    if (existingPick) {
      return NextResponse.json({ error: 'You have already made a pick for this game' }, { status: 400 });
    }

    // Check if hockey player is already picked (unless it's a win pick)
    if (!is_win_pick && hockey_player_id) {
      const pickedPlayer = db.prepare('SELECT * FROM picks WHERE game_id = ? AND hockey_player_id = ?').get(game_id, hockey_player_id);
      if (pickedPlayer) {
        return NextResponse.json({ error: 'This player has already been picked' }, { status: 400 });
      }
    }

    // Check if Win is already picked
    if (is_win_pick) {
      const winPicked = db.prepare('SELECT * FROM picks WHERE game_id = ? AND is_win_pick = 1').get(game_id);
      if (winPicked) {
        return NextResponse.json({ error: 'Win has already been picked' }, { status: 400 });
      }
    }

    // Calculate initial skins for goalies
    let initialSkins = 0;
    if (!is_win_pick && hockey_player_id) {
      const hockeyPlayer = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(hockey_player_id) as any;
      if (hockeyPlayer && hockeyPlayer.position === 'G') {
        initialSkins = 2; // Goalies start with 2 skins
      }
    }

    const result = db.prepare(`
      INSERT INTO picks (player_id, game_id, hockey_player_id, is_win_pick, skins)
      VALUES (?, ?, ?, ?, ?)
    `).run(player_id, game_id, hockey_player_id || null, is_win_pick ? 1 : 0, initialSkins);

    // Advance draft order
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(game_id) as any;
    if (game && game.draft_order) {
      const draftOrder = JSON.parse(game.draft_order);
      const nextIndex = (game.current_pick_index + 1) % draftOrder.length;
      db.prepare('UPDATE games SET current_pick_index = ? WHERE id = ?').run(nextIndex, game_id);
    }

    const pick = db.prepare(`
      SELECT p.*, pl.name as player_name, hp.name as hockey_player_name
      FROM picks p
      JOIN players pl ON p.player_id = pl.id
      LEFT JOIN hockey_players hp ON p.hockey_player_id = hp.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json(pick);
  } catch (error) {
    console.error('Error creating pick:', error);
    return NextResponse.json({ error: 'Failed to create pick' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Pick ID required' }, { status: 400 });
    }

    db.prepare('DELETE FROM picks WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pick:', error);
    return NextResponse.json({ error: 'Failed to delete pick' }, { status: 500 });
  }
}
