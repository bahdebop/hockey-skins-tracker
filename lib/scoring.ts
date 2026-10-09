import db from './db';

// Skins rules:
//   Forward goal   = 1 skin
//   Defense goal   = 2 skins
//   Goalie         = 3 skins base, -1 per goal against (hp.goals = goals against)
//   Win pick       = 2 skins if Wild wins
export function computeSkinsForPick(
  pick: { is_win_pick: number | boolean; hockey_player_id: number | null },
  hockeyPlayer: { position: string; goals: number } | null,
  game: { wild_score: number; opponent_score: number }
): number {
  if (pick.is_win_pick) {
    return game.wild_score > game.opponent_score ? 2 : 0;
  }
  if (!hockeyPlayer) return 0;
  if (hockeyPlayer.position === 'F') return hockeyPlayer.goals;
  if (hockeyPlayer.position === 'D') return hockeyPlayer.goals * 2;
  if (hockeyPlayer.position === 'G') return Math.max(0, 3 - hockeyPlayer.goals);
  return 0;
}

export function recomputePickSkins(gameId: number): void {
  const game: any = db.prepare('SELECT wild_score, opponent_score FROM games WHERE id = ?').get(gameId);
  if (!game) return;

  const picks: any[] = db.prepare(`
    SELECT p.id, p.is_win_pick, p.hockey_player_id,
           hp.position, hp.goals
    FROM picks p
    LEFT JOIN hockey_players hp ON p.hockey_player_id = hp.id
    WHERE p.game_id = ?
  `).all(gameId);

  const update = db.prepare('UPDATE picks SET skins = ? WHERE id = ?');
  for (const p of picks) {
    const skins = computeSkinsForPick(
      p,
      p.hockey_player_id ? { position: p.position, goals: p.goals } : null,
      game
    );
    update.run(skins, p.id);
  }
}

interface NetBalance {
  playerId: number;
  net: number; // cents; positive = receives, negative = owes
}

// Splits the pot (pickers * pot_amount) proportional to each player's
// share of total skins. Creates optimal payment rows in the payments
// table. Idempotent: deletes unpaid payments for the game first.
export function settleGame(gameId: number): { settled: boolean; totalPot: number; skinValue: number; payments: number } {
  recomputePickSkins(gameId);

  const game: any = db.prepare('SELECT pot_amount FROM games WHERE id = ?').get(gameId);
  if (!game) return { settled: false, totalPot: 0, skinValue: 0, payments: 0 };

  const picks: any[] = db.prepare(
    'SELECT player_id, skins FROM picks WHERE game_id = ?'
  ).all(gameId);

  db.prepare('DELETE FROM payments WHERE game_id = ? AND paid = 0').run(gameId);

  const totalSkins = picks.reduce((s, p) => s + p.skins, 0);
  const numPlayers = picks.length;
  if (totalSkins === 0 || numPlayers === 0) {
    return { settled: false, totalPot: numPlayers * game.pot_amount, skinValue: 0, payments: 0 };
  }

  const totalPot = numPlayers * game.pot_amount;
  const skinValue = totalPot / totalSkins;

  const nets: NetBalance[] = picks.map((p) => ({
    playerId: p.player_id,
    net: Math.round((p.skins * skinValue - game.pot_amount) * 100),
  }));

  // Fix rounding drift so debts and credits sum to 0
  const drift = nets.reduce((s, n) => s + n.net, 0);
  if (drift !== 0) {
    const top = nets.reduce((a, b) => (b.net > a.net ? b : a));
    top.net -= drift;
  }

  const debtors = nets.filter((n) => n.net < 0).sort((a, b) => a.net - b.net);
  const creditors = nets.filter((n) => n.net > 0).sort((a, b) => b.net - a.net);

  let created = 0;
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].net, creditors[j].net);
    if (amount > 0) {
      db.prepare(`
        INSERT INTO payments (from_player_id, to_player_id, amount, game_id, paid)
        VALUES (?, ?, ?, ?, 0)
      `).run(debtors[i].playerId, creditors[j].playerId, amount / 100, gameId);
      created++;
    }
    debtors[i].net += amount;
    creditors[j].net -= amount;
    if (debtors[i].net === 0) i++;
    if (creditors[j].net === 0) j++;
  }

  return { settled: true, totalPot, skinValue, payments: created };
}
