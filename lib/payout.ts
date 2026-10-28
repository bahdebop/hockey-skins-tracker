import db from './db';
import { sendPushToPlayers } from './push';

// Batch settlement model:
//   - Final games accrue until an admin runs Calculate Payout.
//   - A batch captures every unsettled final game, computes each player's
//     net across ALL of them (minus settlement payments already made), and
//     emits the minimum debtor -> creditor transfer list.
//   - While a batch is open, new final games queue for the next batch.
//   - When every transfer in a batch is marked paid, the batch closes and
//     the slate is clean. Season stats are untouched — they're pure
//     queries over picks/games.

export function getOpenBatch(): any {
  return db.prepare(
    `SELECT b.*, p.name as created_by_name FROM payout_batches b
     JOIN players p ON b.created_by = p.id
     WHERE b.status = 'open' ORDER BY b.id DESC LIMIT 1`
  ).get();
}

export function getBatchTransfers(batchId: number): any[] {
  return db.prepare('SELECT * FROM payments WHERE batch_id = ? ORDER BY id').all(batchId);
}

export function countUnsettledFinalGames(): number {
  const row: any = db.prepare(
    `SELECT COUNT(*) c FROM games WHERE status = 'final' AND settled_batch_id IS NULL`
  ).get();
  return row?.c ?? 0;
}

// Net position per player in CENTS (positive = owed money), across all
// unsettled final games, minus settlement flows already recorded.
export function computePlayerNets(): Map<number, number> {
  const nets = new Map<number, number>();

  const games: any[] = db.prepare(
    `SELECT id, pot_amount FROM games WHERE status = 'final' AND settled_batch_id IS NULL`
  ).all();

  for (const game of games) {
    const picks: any[] = db.prepare(
      'SELECT player_id, skins FROM picks WHERE game_id = ?'
    ).all(game.id);
    const totalSkins = picks.reduce((s, p) => s + p.skins, 0);
    if (totalSkins === 0 || picks.length === 0) continue; // push — nobody wins or loses

    const skinValue = (game.pot_amount * picks.length) / totalSkins;
    for (const p of picks) {
      const net = Math.round((p.skins * skinValue - game.pot_amount) * 100);
      nets.set(p.player_id, (nets.get(p.player_id) || 0) + net);
    }
  }

  // Settlements already made (paid rows not belonging to any batch):
  // A paid B $5 => A discharged $5 of debt.
  const settlements: any[] = db.prepare(
    'SELECT from_player_id, to_player_id, amount FROM payments WHERE paid = 1 AND batch_id IS NULL'
  ).all();
  for (const s of settlements) {
    const cents = Math.round(s.amount * 100);
    nets.set(s.from_player_id, (nets.get(s.from_player_id) || 0) + cents);
    nets.set(s.to_player_id, (nets.get(s.to_player_id) || 0) - cents);
  }

  return nets;
}

export function calculatePayout(adminId: number):
  { ok: true; batchId: number; transfers: number } | { ok: false; error: string } {
  if (getOpenBatch()) {
    return { ok: false, error: 'A payout batch is already open — settle it first' };
  }

  const nets = computePlayerNets();
  const batch = db.prepare(
    `INSERT INTO payout_batches (created_by, status) VALUES (?, 'open')`
  ).run(adminId);
  const batchId = Number(batch.lastInsertRowid);

  // Stamp every unsettled final game with this batch so its money is
  // consumed — a game finishing later queues for the next batch.
  db.prepare(
    `UPDATE games SET settled_batch_id = ? WHERE status = 'final' AND settled_batch_id IS NULL`
  ).run(batchId);

  const debtors = [...nets.entries()]
    .filter(([, n]) => n < 0)
    .map(([playerId, net]) => ({ playerId, net }))
    .sort((a, b) => a.net - b.net);
  const creditors = [...nets.entries()]
    .filter(([, n]) => n > 0)
    .map(([playerId, net]) => ({ playerId, net }))
    .sort((a, b) => b.net - a.net);

  let created = 0;
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].net, creditors[j].net);
    if (amount > 0) {
      db.prepare(`
        INSERT INTO payments (from_player_id, to_player_id, amount, batch_id, paid)
        VALUES (?, ?, ?, ?, 0)
      `).run(debtors[i].playerId, creditors[j].playerId, amount / 100, batchId);
      created++;
    }
    debtors[i].net += amount;
    creditors[j].net -= amount;
    if (debtors[i].net === 0) i++;
    if (creditors[j].net === 0) j++;
  }

  if (created === 0) {
    db.prepare(`UPDATE payout_batches SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(batchId);
    return { ok: true, batchId, transfers: 0 };
  }

  const playerIds = (db.prepare('SELECT id FROM players').all() as { id: number }[]).map(r => r.id);
  sendPushToPlayers(playerIds, {
    title: 'Payout time!',
    body: 'Balances are calculated — check the Balance page to see who you owe.',
    url: '/balance',
    tag: `payout-${batchId}`,
  });

  return { ok: true, batchId, transfers: created };
}

// Called whenever a transfer's paid flag flips. Closes the batch when
// every transfer is settled — the slate is then clean.
export function syncBatchStatus(batchId: number) {
  const remaining: any = db.prepare(
    'SELECT COUNT(*) c FROM payments WHERE batch_id = ? AND paid = 0'
  ).get(batchId);
  if (remaining.c === 0) {
    db.prepare(
      `UPDATE payout_batches SET status = 'closed', closed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'open'`
    ).run(batchId);
  } else {
    db.prepare(
      `UPDATE payout_batches SET status = 'open', closed_at = NULL
       WHERE id = ? AND status = 'closed'`
    ).run(batchId);
  }
}
