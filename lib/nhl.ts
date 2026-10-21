import db from './db';
import { recomputePickSkins, settleGame } from './scoring';
import { sendPushToPlayers } from './push';
import { eventManager } from './eventManager';

const ROSTER_URL = 'https://api-web.nhle.com/v1/roster/MIN/current';
const NHL_API = 'https://api-web.nhle.com/v1';

// Opponent display name -> NHL abbrev (Wild excluded — they're always us)
export const TEAM_ABBREV: Record<string, string> = {
  'Anaheim Ducks': 'ANA', 'Boston Bruins': 'BOS', 'Buffalo Sabres': 'BUF',
  'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR', 'Chicago Blackhawks': 'CHI',
  'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ', 'Dallas Stars': 'DAL',
  'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM', 'Florida Panthers': 'FLA',
  'Los Angeles Kings': 'LAK', 'Montreal Canadiens': 'MTL', 'Nashville Predators': 'NSH',
  'New Jersey Devils': 'NJD', 'New York Islanders': 'NYI', 'New York Rangers': 'NYR',
  'Ottawa Senators': 'OTT', 'Philadelphia Flyers': 'PHI', 'Pittsburgh Penguins': 'PIT',
  'San Jose Sharks': 'SJS', 'Seattle Kraken': 'SEA', 'St. Louis Blues': 'STL',
  'Tampa Bay Lightning': 'TBL', 'Toronto Maple Leafs': 'TOR', 'Utah Mammoth': 'UTA',
  'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK', 'Washington Capitals': 'WSH',
  'Winnipeg Jets': 'WPG',
};

// Finds the NHL game matching our game by opponent + date (±1 day to
// absorb timezone differences between stored UTC and NHL local dates).
export async function resolveNhlGameId(game: { id: number; opponent: string; game_date: string; nhl_game_id?: string | null }): Promise<number | null> {
  if (game.nhl_game_id) return Number(game.nhl_game_id);
  const oppAbbrev = TEAM_ABBREV[game.opponent];
  if (!oppAbbrev) return null;

  const target = new Date(game.game_date).getTime();
  const isMatch = (g: any) =>
    (g.awayTeam?.abbrev === 'MIN' ? g.homeTeam?.abbrev : g.awayTeam?.abbrev) === oppAbbrev &&
    Math.abs(new Date(g.startTimeUTC).getTime() - target) < 24 * 3600 * 1000;

  // Check the stored date ±1 day to absorb local-vs-UTC date shifts
  for (const dayOffset of [0, -1, 1]) {
    const d = new Date(target + dayOffset * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await fetch(`${NHL_API}/score/${d}`, { cache: 'no-store' });
    if (!res.ok) continue;
    const data = await res.json();
    const match = (data.games || []).find(isMatch);
    if (match) return match.id;
  }
  return null;
}

// Reconciles our game with the NHL play-by-play feed: player goals,
// goalie GA + goalie-scored goals, score, period, and status
// transitions (ready -> in_progress at puck drop, -> final at OFF).
export async function syncGameFromNhl(gameId: number): Promise<{ synced: boolean; reason?: string }> {
  const game: any = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game || !['ready', 'in_progress'].includes(game.status)) {
    return { synced: false, reason: 'not syncable' };
  }

  // Throttle: skip if synced within the last 20 seconds
  if (game.score_updated_at) {
    const age = Date.now() - new Date(game.score_updated_at + 'Z').getTime();
    if (age < 20000) return { synced: false, reason: 'throttled' };
  }

  const nhlGameId = await resolveNhlGameId(game);
  if (!nhlGameId) return { synced: false, reason: 'no matching NHL game' };
  if (!game.nhl_game_id) {
    db.prepare('UPDATE games SET nhl_game_id = ? WHERE id = ?').run(String(nhlGameId), gameId);
  }

  const res = await fetch(`${NHL_API}/gamecenter/${nhlGameId}/play-by-play`, { cache: 'no-store' });
  if (!res.ok) return { synced: false, reason: `NHL API ${res.status}` };
  const data = await res.json();

  const isMinAway = data.awayTeam?.abbrev === 'MIN';
  const minTeamId = isMinAway ? data.awayTeam?.id : data.homeTeam?.id;
  const wildScore = isMinAway ? data.awayTeam?.score : data.homeTeam?.score;
  const oppScore = isMinAway ? data.homeTeam?.score : data.awayTeam?.score;
  const period = data.displayPeriod || data.periodDescriptor?.number || 0;

  // Tally goals per NHL player id; GA per goalie id
  const scorers = new Map<string, number>();
  const ga = new Map<string, number>();
  for (const play of data.plays || []) {
    if (play.typeDescKey !== 'goal') continue;
    const d = play.details || {};
    if (d.eventOwnerTeamId === minTeamId) {
      if (d.scoringPlayerId) scorers.set(String(d.scoringPlayerId), (scorers.get(String(d.scoringPlayerId)) || 0) + 1);
    } else if (d.goalieInNetId) {
      ga.set(String(d.goalieInNetId), (ga.get(String(d.goalieInNetId)) || 0) + 1);
    }
  }

  // Apply to roster rows, broadcasting diffs so open pages toast
  const roster: any[] = db.prepare('SELECT * FROM hockey_players WHERE game_id = ?').all(gameId);
  const broadcast = (hp: any, kind: string, diff: number, count: number, skinsChange: number) =>
    eventManager.broadcast(String(gameId), 'goal_scored', {
      playerId: hp.id, playerName: hp.name, position: hp.position,
      goals: count, goalDiff: diff, skinsChange, kind, timestamp: Date.now(),
    });

  for (const hp of roster) {
    const scored = scorers.get(String(hp.nhl_player_id)) || 0;
    const allowed = ga.get(String(hp.nhl_player_id)) || 0;
    const newGoals = hp.position === 'G' ? allowed : scored;
    const newScored = hp.position === 'G' ? scored : (hp.goals_scored || 0);

    if (hp.position === 'G') {
      if (newScored > (hp.goals_scored || 0)) broadcast(hp, 'goalie_goal', newScored - (hp.goals_scored || 0), newScored, 2);
      if (allowed > (hp.goals || 0)) broadcast(hp, 'goal_allowed', allowed - (hp.goals || 0), allowed, -(allowed - (hp.goals || 0)));
    } else if (scored > (hp.goals || 0)) {
      broadcast(hp, 'scored', scored - (hp.goals || 0), scored, (scored - (hp.goals || 0)) * (hp.position === 'D' ? 2 : 1));
    }

    if (newGoals !== hp.goals || newScored !== (hp.goals_scored || 0)) {
      db.prepare('UPDATE hockey_players SET goals = ?, goals_scored = ? WHERE id = ?')
        .run(newGoals, newScored, hp.id);
    }
  }

  let newStatus = game.status;
  if (data.gameState === 'OFF') newStatus = 'final';
  else if (game.status === 'ready' && ['LIVE', 'CRIT'].includes(data.gameState)) newStatus = 'in_progress';

  db.prepare(`
    UPDATE games SET wild_score = ?, opponent_score = ?, period = ?, status = ?,
      last_updated_by = NULL, score_updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(wildScore ?? 0, oppScore ?? 0, period, newStatus, gameId);

  recomputePickSkins(gameId);

  if (newStatus === 'final' && game.status !== 'final') {
    settleGame(gameId);
    const pickers = (db.prepare('SELECT DISTINCT player_id FROM picks WHERE game_id = ?').all(gameId) as { player_id: number }[])
      .map(r => r.player_id);
    sendPushToPlayers(pickers, {
      title: 'Game final — balances settled',
      body: `MIN ${wildScore} - ${oppScore} vs ${game.opponent}. Check what you're owed.`,
      url: '/balance',
      tag: `game-final-${gameId}`,
    });
  }

  eventManager.broadcast(String(gameId), 'score_sync', { wildScore, oppScore, period, status: newStatus });
  return { synced: true };
}

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
