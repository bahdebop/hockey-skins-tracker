import db from './db';

// Skins rules:
//   Forward goal   = 1 skin
//   Defense goal   = 2 skins
//   Goalie         = 3 skins base, -1 per goal against (hp.goals = goals
//                    against), +2 per goal the goalie scores (goals_scored)
//   GWG            = +1 skin to whoever picked the scorer (stacks with the
//                    goal itself; shootout decider counts too)
//   Win pick       = 2 skins if Wild wins
export function computeSkinsForPick(
  pick: { is_win_pick: number | boolean; hockey_player_id: number | null },
  hockeyPlayer: { position: string; goals: number; goals_scored?: number; gwg?: number } | null,
  game: { wild_score: number; opponent_score: number }
): number {
  if (pick.is_win_pick) {
    return game.wild_score > game.opponent_score ? 2 : 0;
  }
  if (!hockeyPlayer) return 0;
  const gwgBonus = hockeyPlayer.gwg ? 1 : 0;
  if (hockeyPlayer.position === 'F') return hockeyPlayer.goals + gwgBonus;
  if (hockeyPlayer.position === 'D') return hockeyPlayer.goals * 2 + gwgBonus;
  if (hockeyPlayer.position === 'G') {
    return Math.max(0, 3 - hockeyPlayer.goals) + (hockeyPlayer.goals_scored || 0) * 2 + gwgBonus;
  }
  return 0;
}

export function recomputePickSkins(gameId: number): void {
  const game: any = db.prepare('SELECT wild_score, opponent_score FROM games WHERE id = ?').get(gameId);
  if (!game) return;

  const picks: any[] = db.prepare(`
    SELECT p.id, p.is_win_pick, p.hockey_player_id,
           hp.position, hp.goals, hp.goals_scored, hp.gwg
    FROM picks p
    LEFT JOIN hockey_players hp ON p.hockey_player_id = hp.id
    WHERE p.game_id = ?
  `).all(gameId);

  const update = db.prepare('UPDATE picks SET skins = ? WHERE id = ?');
  for (const p of picks) {
    const skins = computeSkinsForPick(
      p,
      p.hockey_player_id ? { position: p.position, goals: p.goals, goals_scored: p.goals_scored, gwg: p.gwg } : null,
      game
    );
    update.run(skins, p.id);
  }
}

// Recomputes pick skins at game end. Money itself only moves through
// payout batches (lib/payout.ts) — a final game just accrues toward the
// next Calculate Payout run.
export function settleGame(gameId: number): { settled: boolean; totalPot: number; skinValue: number } {
  recomputePickSkins(gameId);

  const game: any = db.prepare('SELECT pot_amount FROM games WHERE id = ?').get(gameId);
  if (!game) return { settled: false, totalPot: 0, skinValue: 0 };

  const totals: any = db.prepare(
    'SELECT COUNT(*) AS n, COALESCE(SUM(skins), 0) AS skins FROM picks WHERE game_id = ?'
  ).get(gameId);
  const totalPot = totals.n * game.pot_amount;
  const skinValue = totals.skins > 0 ? totalPot / totals.skins : 0;

  return { settled: totals.skins > 0, totalPot, skinValue };
}
