import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { recomputePickSkins, settleGame } from '@/lib/scoring';
import { sendPushToPlayers } from '@/lib/push';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || searchParams.get('game_id');
    const playerId = searchParams.get('playerId') || searchParams.get('player_id');

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
    const { player_id, game_id, hockey_player_id, is_win_pick, skip } = body;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to make a pick' }, { status: 401 });
    }

    const gameForAuth: any = db.prepare('SELECT * FROM games WHERE id = ?').get(game_id);
    if (!gameForAuth) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (gameForAuth.status !== 'drafting') {
      return NextResponse.json({ error: 'The draft is not active for this game' }, { status: 400 });
    }

    const turnOrder: number[] = JSON.parse(gameForAuth.draft_order || '[]');
    const currentPickerId = turnOrder[gameForAuth.current_pick_index];

    const advanceDraft = () => {
      const nextIndex = (gameForAuth.current_pick_index + 1) % turnOrder.length;
      db.prepare('UPDATE games SET current_pick_index = ? WHERE id = ?').run(nextIndex, game_id);
      const nextPickerId = turnOrder[nextIndex];
      if (nextPickerId) {
        sendPushToPlayers([nextPickerId], {
          title: 'Your turn to draft!',
          body: `vs ${gameForAuth.opponent} — tap to make your pick`,
          url: `/games/${game_id}`,
          tag: `draft-turn-${game_id}-${nextIndex}`,
        });
      }
    };

    const draftComplete = (): boolean => {
      const { c }: any = db.prepare('SELECT COUNT(*) as c FROM picks WHERE game_id = ?').get(game_id);
      if (turnOrder.length > 0 && c >= turnOrder.length) {
        db.prepare("UPDATE games SET status = 'ready' WHERE id = ?").run(game_id);
        sendPushToPlayers(turnOrder, {
          title: 'Draft complete',
          body: `vs ${gameForAuth.opponent} — waiting for puck drop`,
          url: `/games/${game_id}`,
          tag: `draft-done-${game_id}`,
        });
        return true;
      }
      return false;
    };

    const pickWithNames = (id: any) => db.prepare(`
      SELECT p.*, pl.name as player_name, hp.name as hockey_player_name
      FROM picks p
      JOIN players pl ON p.player_id = pl.id
      LEFT JOIN hockey_players hp ON p.hockey_player_id = hp.id
      WHERE p.id = ?
    `).get(id);

    const initialSkinsFor = (hpId: number | null, isWin: boolean) => {
      if (isWin || !hpId) return 0;
      const hp: any = db.prepare('SELECT position FROM hockey_players WHERE id = ?').get(hpId);
      return hp?.position === 'G' ? 2 : 0;
    };

    const validateTarget = (): NextResponse | null => {
      if (is_win_pick) {
        const taken = db.prepare('SELECT id FROM picks WHERE game_id = ? AND is_win_pick = 1').get(game_id);
        if (taken) return NextResponse.json({ error: 'Win has already been picked' }, { status: 400 });
        return null;
      }
      if (!hockey_player_id) {
        return NextResponse.json({ error: 'hockey_player_id or is_win_pick required' }, { status: 400 });
      }
      const hp: any = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(hockey_player_id);
      if (!hp || hp.game_id !== Number(game_id)) {
        return NextResponse.json({ error: 'Invalid player for this game' }, { status: 400 });
      }
      const taken = db.prepare('SELECT id FROM picks WHERE game_id = ? AND hockey_player_id = ?').get(game_id, hockey_player_id);
      if (taken) {
        return NextResponse.json({ error: 'This player has already been picked' }, { status: 400 });
      }
      return null;
    };

    // --- Skip: admin passes the current picker, leaving a placeholder pick
    // that can be filled later by the player or an admin ---
    if (skip) {
      if (!isAdmin(user.userId)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
      if (!currentPickerId) {
        return NextResponse.json({ error: 'No current picker to skip' }, { status: 400 });
      }
      const existing = db.prepare('SELECT id FROM picks WHERE player_id = ? AND game_id = ?').get(currentPickerId, game_id);
      if (existing) {
        return NextResponse.json({ error: 'This player already has a pick' }, { status: 400 });
      }

      const result = db.prepare(`
        INSERT INTO picks (player_id, game_id, hockey_player_id, is_win_pick, skins)
        VALUES (?, ?, NULL, 0, 0)
      `).run(currentPickerId, game_id);

      sendPushToPlayers([currentPickerId], {
        title: 'Your draft turn was skipped',
        body: `vs ${gameForAuth.opponent} — you can still make your pick anytime`,
        url: `/games/${game_id}`,
        tag: `draft-skipped-${game_id}`,
      });

      if (!draftComplete()) advanceDraft();
      return NextResponse.json(pickWithNames(result.lastInsertRowid));
    }

    // --- Fill a skipped (placeholder) pick: the player or an admin, any time ---
    const existingPick: any = db.prepare('SELECT * FROM picks WHERE player_id = ? AND game_id = ?').get(player_id, game_id);
    if (existingPick && !existingPick.is_win_pick && existingPick.hockey_player_id == null) {
      if (user.userId !== Number(player_id) && !isAdmin(user.userId)) {
        return NextResponse.json({ error: 'You can only fill your own skipped pick' }, { status: 403 });
      }
      const err = validateTarget();
      if (err) return err;

      db.prepare('UPDATE picks SET hockey_player_id = ?, is_win_pick = ?, skins = ? WHERE id = ?')
        .run(is_win_pick ? null : hockey_player_id, is_win_pick ? 1 : 0, initialSkinsFor(hockey_player_id, is_win_pick), existingPick.id);

      draftComplete();
      return NextResponse.json(pickWithNames(existingPick.id));
    }

    if (existingPick) {
      return NextResponse.json({ error: 'You have already made a pick for this game' }, { status: 400 });
    }

    // --- Normal turn pick ---
    if (Number(player_id) !== currentPickerId) {
      return NextResponse.json({ error: 'It is not this player\'s turn to pick' }, { status: 403 });
    }
    if (user.userId !== currentPickerId && !isAdmin(user.userId)) {
      return NextResponse.json({ error: 'You can only pick on your own turn' }, { status: 403 });
    }

    const err = validateTarget();
    if (err) return err;

    const result = db.prepare(`
      INSERT INTO picks (player_id, game_id, hockey_player_id, is_win_pick, skins)
      VALUES (?, ?, ?, ?, ?)
    `).run(player_id, game_id, is_win_pick ? null : hockey_player_id, is_win_pick ? 1 : 0, initialSkinsFor(hockey_player_id, is_win_pick));

    if (!draftComplete()) advanceDraft();
    return NextResponse.json(pickWithNames(result.lastInsertRowid));
  } catch (error) {
    console.error('Error creating pick:', error);
    return NextResponse.json({ error: 'Failed to create pick' }, { status: 500 });
  }
}

// Admin-only: swap a made pick to a different available player (e.g. injury scratch)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.userId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, hockey_player_id, is_win_pick } = body;

    const pick: any = db.prepare('SELECT * FROM picks WHERE id = ?').get(id);
    if (!pick) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    }

    if (is_win_pick) {
      const taken = db.prepare(
        'SELECT id FROM picks WHERE game_id = ? AND is_win_pick = 1 AND id != ?'
      ).get(pick.game_id, id);
      if (taken) {
        return NextResponse.json({ error: 'Win has already been picked' }, { status: 400 });
      }
    } else if (hockey_player_id) {
      const hp: any = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(hockey_player_id);
      if (!hp || hp.game_id !== pick.game_id) {
        return NextResponse.json({ error: 'Invalid player for this game' }, { status: 400 });
      }
      const taken = db.prepare(
        'SELECT id FROM picks WHERE game_id = ? AND hockey_player_id = ? AND id != ?'
      ).get(pick.game_id, hockey_player_id, id);
      if (taken) {
        return NextResponse.json({ error: 'That player has already been picked' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'hockey_player_id or is_win_pick required' }, { status: 400 });
    }

    db.prepare('UPDATE picks SET hockey_player_id = ?, is_win_pick = ? WHERE id = ?')
      .run(is_win_pick ? null : hockey_player_id, is_win_pick ? 1 : 0, id);

    recomputePickSkins(pick.game_id);

    const game: any = db.prepare('SELECT status FROM games WHERE id = ?').get(pick.game_id);
    if (game?.status === 'final') {
      settleGame(pick.game_id);
    }

    const updated = db.prepare(`
      SELECT p.*, pl.name as player_name, hp.name as hockey_player_name
      FROM picks p
      JOIN players pl ON p.player_id = pl.id
      LEFT JOIN hockey_players hp ON p.hockey_player_id = hp.id
      WHERE p.id = ?
    `).get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating pick:', error);
    return NextResponse.json({ error: 'Failed to update pick' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.userId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

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
