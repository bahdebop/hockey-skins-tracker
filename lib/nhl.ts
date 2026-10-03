import db from './db';

const ROSTER_URL = 'https://api-web.nhle.com/v1/roster/MIN/current';

export interface RosterPlayer {
  nhl_player_id: string;
  name: string;
  position: 'F' | 'D' | 'G';
  jersey_number: number | null;
}

interface NhlRosterEntry {
  id: number;
  firstName?: { default?: string };
  lastName?: { default?: string };
  sweaterNumber?: number;
}

export async function fetchWildRoster(): Promise<RosterPlayer[]> {
  const res = await fetch(ROSTER_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`NHL API returned ${res.status}`);
  }
  const data = await res.json();

  const mapGroup = (group: NhlRosterEntry[] | undefined, position: 'F' | 'D' | 'G'): RosterPlayer[] =>
    (group || []).map((p) => ({
      nhl_player_id: String(p.id),
      name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
      position,
      jersey_number: p.sweaterNumber ?? null,
    })).filter((p) => p.name.length > 0);

  return [
    ...mapGroup(data.forwards, 'F'),
    ...mapGroup(data.defensemen, 'D'),
    ...mapGroup(data.goalies, 'G'),
  ];
}

export async function populateRosterForGame(gameId: number): Promise<number> {
  const roster = await fetchWildRoster();
  let added = 0;

  for (const p of roster) {
    const existing = db.prepare(
      'SELECT id FROM hockey_players WHERE game_id = ? AND (nhl_player_id = ? OR name = ?)'
    ).get(gameId, p.nhl_player_id, p.name);
    if (existing) continue;

    db.prepare(`
      INSERT INTO hockey_players (game_id, nhl_player_id, name, position, jersey_number)
      VALUES (?, ?, ?, ?, ?)
    `).run(gameId, p.nhl_player_id, p.name, p.position, p.jersey_number);
    added++;
  }

  return added;
}
