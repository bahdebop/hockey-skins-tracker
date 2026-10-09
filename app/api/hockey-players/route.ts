import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { eventManager } from '@/lib/eventManager';
import { recomputePickSkins, settleGame } from '@/lib/scoring';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || searchParams.get('game_id');

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to update scores' }, { status: 401 });
    }

    const body = await request.json();
    const { id, goals, goals_scored } = body;

    // Get old goals count for comparison
    const oldPlayer: any = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(id);
    if (!oldPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    const oldGoals = oldPlayer.goals || 0;
    const oldGoalsScored = oldPlayer.goals_scored || 0;

    const gameForAuth: any = db.prepare('SELECT status FROM games WHERE id = ?').get(oldPlayer.game_id);
    if (gameForAuth?.status !== 'in_progress' && !isAdmin(user.userId)) {
      return NextResponse.json({ error: 'Scoring is only open while the game is in progress' }, { status: 403 });
    }

    if (goals !== undefined) {
      db.prepare('UPDATE hockey_players SET goals = ? WHERE id = ?').run(goals, id);
    }
    if (goals_scored !== undefined) {
      db.prepare('UPDATE hockey_players SET goals_scored = ? WHERE id = ?').run(goals_scored, id);
    }
    const player: any = db.prepare('SELECT * FROM hockey_players WHERE id = ?').get(id);

    if (player) {
      recomputePickSkins(player.game_id);

      // Wild score = skater goals + goalie-scored goals. Opponent score
      // = goals allowed by Wild goalies.
      db.prepare(`
        UPDATE games SET
          wild_score = (SELECT COALESCE(SUM(CASE WHEN position = 'G' THEN goals_scored ELSE goals END), 0)
                        FROM hockey_players WHERE game_id = ?),
          opponent_score = (SELECT COALESCE(SUM(CASE WHEN position = 'G' THEN goals ELSE 0 END), 0)
                            FROM hockey_players WHERE game_id = ?),
          last_updated_by = ?,
          score_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(player.game_id, player.game_id, user.userId, player.game_id);

      if (gameForAuth?.status === 'final') {
        settleGame(player.game_id);
      }
    }

    // Broadcast goal/GA updates
    if (player && goals_scored !== undefined && goals_scored > oldGoalsScored) {
      const goalDiff = goals_scored - oldGoalsScored;
      eventManager.broadcast(player.game_id.toString(), 'goal_scored', {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        goals: player.goals_scored,
        goalDiff,
        skinsChange: goalDiff * 2,
        kind: 'goalie_goal',
        timestamp: Date.now(),
      });
    }
    if (player && goals !== undefined && goals > oldGoals) {
      const goalDiff = goals - oldGoals;
      const skinsPerGoal = player.position === 'F' ? 1 : player.position === 'D' ? 2 : -1;
      const skinsChange = player.position === 'G' ? -goalDiff : goalDiff * skinsPerGoal;

      eventManager.broadcast(player.game_id.toString(), 'goal_scored', {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        goals: player.goals,
        goalDiff,
        skinsChange,
        kind: player.position === 'G' ? 'goal_allowed' : 'scored',
        timestamp: Date.now(),
      });
    }
    
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
