import db from './db';
import { populateRosterForGame, TEAM_ABBREV } from './nhl';
import { sendPushToPlayers } from './push';
import { computeDraftOrder } from './draft';

const NHL_API = 'https://api-web.nhle.com/v1';
const CT = 'America/Chicago';
const POT = 5;

const ABBREV_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_ABBREV).map(([name, abbrev]) => [abbrev, name])
);

function centralDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: CT }); // YYYY-MM-DD
}

function centralHour(): number {
  return Number(new Date().toLocaleString('en-US', { timeZone: CT, hour: 'numeric', hour12: false }));
}

function startDraft(gameId: number) {
  const game: any = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game || game.status !== 'upcoming') return;

  const order = computeDraftOrder(gameId);
  db.prepare(`UPDATE games SET status = 'drafting', draft_order = ?, current_pick_index = 0 WHERE id = ?`)
    .run(JSON.stringify(order), gameId);

  if (order.length > 0) {
    sendPushToPlayers([order[0]], {
      title: 'Draft started — you pick first!',
      body: `vs ${game.opponent} — tap to make your pick`,
      url: `/games/${gameId}`,
      tag: `draft-start-${gameId}`,
    });
  }
}

export async function ensureTodaysGame(): Promise<{ action: string; detail?: string }> {
  const res = await fetch(`${NHL_API}/score/${centralDate()}`, { cache: 'no-store' });
  if (!res.ok) return { action: 'error', detail: `NHL API ${res.status}` };
  const data = await res.json();

  const nhlGame = (data.games || []).find(
    (g: any) => g.awayTeam?.abbrev === 'MIN' || g.homeTeam?.abbrev === 'MIN'
  );
  if (!nhlGame) return { action: 'no_game' };

  const oppAbbrev = nhlGame.awayTeam.abbrev === 'MIN' ? nhlGame.homeTeam.abbrev : nhlGame.awayTeam.abbrev;
  const opponent = ABBREV_TO_NAME[oppAbbrev];
  if (!opponent) return { action: 'error', detail: `unknown team abbrev ${oppAbbrev}` };

  // Same opponent within 18h of puck drop = same game (absorbs manual entry's time variance)
  const existing: any = db.prepare(`
    SELECT * FROM games WHERE opponent = ?
    AND ABS(julianday(game_date) - julianday(?)) * 24 < 18
  `).get(opponent, nhlGame.startTimeUTC);

  if (existing) {
    if (!existing.nhl_game_id) {
      db.prepare('UPDATE games SET nhl_game_id = ? WHERE id = ?').run(String(nhlGame.id), existing.id);
    }
    if (existing.status === 'upcoming') {
      startDraft(existing.id);
      return { action: 'draft_started', detail: `game ${existing.id}` };
    }
    return { action: 'exists', detail: `game ${existing.id} (${existing.status})` };
  }

  const creator: any = db.prepare('SELECT id FROM players WHERE is_admin = 1 ORDER BY id LIMIT 1').get()
    || db.prepare('SELECT id FROM players ORDER BY id LIMIT 1').get();
  if (!creator) return { action: 'error', detail: 'no players to own the game' };

  const result = db.prepare(`
    INSERT INTO games (opponent, game_date, pot_amount, created_by, nhl_game_id, status)
    VALUES (?, ?, ?, ?, ?, 'upcoming')
  `).run(opponent, nhlGame.startTimeUTC, POT, creator.id, String(nhlGame.id));
  const gameId = Number(result.lastInsertRowid);

  try {
    await populateRosterForGame(gameId);
  } catch (e) {
    console.error('[autogame] roster populate failed:', e);
  }

  const others = (db.prepare('SELECT DISTINCT player_id FROM push_subscriptions').all() as { player_id: number }[])
    .map(r => r.player_id);
  sendPushToPlayers(others, {
    title: 'New game posted!',
    body: `Wild vs ${opponent} — ${new Date(nhlGame.startTimeUTC).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: CT })}. Draft is open now.`,
    url: `/games/${gameId}`,
    tag: `new-game-${gameId}`,
  });

  startDraft(gameId);
  return { action: 'created', detail: `game ${gameId} vs ${opponent}` };
}

let lastCheckedDay: string | null = null;
let started = false;

// Every 30 min, once it's 8 AM Central: create today's Wild game (if any)
// and open its draft. Safe to re-run — dedupes on opponent + puck-drop time.
export function startDailyScheduler() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      if (centralHour() < 8 || lastCheckedDay === centralDate()) return;
      const result = await ensureTodaysGame();
      if (result.action === 'error') {
        console.error('[autogame] check failed:', result.detail);
        return; // retry next tick
      }
      lastCheckedDay = centralDate();
      console.log(`[autogame] ${result.action}${result.detail ? `: ${result.detail}` : ''}`);
    } catch (e) {
      console.error('[autogame] tick error:', e);
    }
  };

  tick();
  setInterval(tick, 30 * 60 * 1000);
}
