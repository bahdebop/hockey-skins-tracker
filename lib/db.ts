import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

const usePostgres = !!process.env.DATABASE_URL;
let sqlite: Database.Database | null = null;
let postgres: Pool | null = null;
let initialized = false;

function initializeDatabase() {
  if (initialized) return;
  initialized = true;

  if (usePostgres) {
    console.log('🐘 Using PostgreSQL');
    postgres = new Pool({ connectionString: process.env.DATABASE_URL });
    
    postgres.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        nhl_game_id TEXT,
        opponent TEXT NOT NULL,
        game_date TIMESTAMP NOT NULL,
        pot_amount DECIMAL NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'upcoming',
        created_by INTEGER NOT NULL,
        draft_order TEXT,
        current_pick_index INTEGER DEFAULT 0,
        period INTEGER DEFAULT 0,
        wild_score INTEGER DEFAULT 0,
        opponent_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS hockey_players (
        id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL,
        nhl_player_id TEXT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        jersey_number INTEGER,
        goals INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS picks (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        hockey_player_id INTEGER,
        is_win_pick BOOLEAN DEFAULT FALSE,
        skins INTEGER DEFAULT 0,
        picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (hockey_player_id) REFERENCES hockey_players(id) ON DELETE CASCADE,
        UNIQUE(player_id, game_id)
      );
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        from_player_id INTEGER NOT NULL,
        to_player_id INTEGER NOT NULL,
        amount DECIMAL NOT NULL,
        game_id INTEGER,
        paid BOOLEAN DEFAULT FALSE,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (to_player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `).then(() => console.log('✅ PostgreSQL initialized')).catch(console.error);
  } else {
    const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
    const dbPath = path.join(dataDir, 'hockey-skins.db');
    console.log('📁 Using SQLite database at:', dbPath);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    sqlite = new Database(dbPath);
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nhl_game_id TEXT,
        opponent TEXT NOT NULL,
        game_date DATETIME NOT NULL,
        pot_amount REAL NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'upcoming',
        created_by INTEGER NOT NULL,
        draft_order TEXT,
        current_pick_index INTEGER DEFAULT 0,
        period INTEGER DEFAULT 0,
        wild_score INTEGER DEFAULT 0,
        opponent_score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS hockey_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        nhl_player_id TEXT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        jersey_number INTEGER,
        goals INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        hockey_player_id INTEGER,
        is_win_pick INTEGER DEFAULT 0,
        skins INTEGER DEFAULT 0,
        picked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (hockey_player_id) REFERENCES hockey_players(id) ON DELETE CASCADE,
        UNIQUE(player_id, game_id)
      );
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_player_id INTEGER NOT NULL,
        to_player_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        game_id INTEGER,
        paid INTEGER DEFAULT 0,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (to_player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }
}

const db = {
  prepare: (sql: string) => {
    initializeDatabase();
    
    if (usePostgres) {
      return {
        get: async (...params: any[]) => {
          const result = await postgres!.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params);
          return result.rows[0] || null;
        },
        all: async (...params: any[]) => {
          const result = await postgres!.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params);
          return result.rows;
        },
        run: async (...params: any[]) => {
          const result = await postgres!.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params);
          return { lastInsertRowid: result.rows[0]?.id || 0, changes: result.rowCount || 0 };
        },
      };
    } else {
      const stmt = sqlite!.prepare(sql);
      return stmt;
    }
  },
};

export default db;
