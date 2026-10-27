import db from './db';

// Rotating draft order: whoever picked first last game goes last
// this game; everyone else moves up one spot. First game ever
// falls back to a random order. New players join at the end.
export function computeDraftOrder(gameId: number): number[] {
  const prev: any = db.prepare(`
    SELECT draft_order FROM games
    WHERE id != ? AND draft_order IS NOT NULL AND draft_order != ''
    ORDER BY id DESC LIMIT 1
  `).get(gameId);
  const currentIds = (db.prepare('SELECT id FROM players').all() as { id: number }[]).map(r => r.id);

  if (!prev) return [...currentIds].sort(() => Math.random() - 0.5);

  const prevOrder: number[] = JSON.parse(prev.draft_order);
  const order = [...prevOrder.slice(1), prevOrder[0]].filter(pid => currentIds.includes(pid));
  for (const pid of currentIds) {
    if (!order.includes(pid)) order.push(pid);
  }
  return order;
}
