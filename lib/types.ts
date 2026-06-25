export interface Player {
  id: number;
  name: string;
  created_at: string;
}

export interface Game {
  id: number;
  nhl_game_id?: string;
  opponent: string;
  game_date: string;
  pot_amount: number;
  status: 'upcoming' | 'drafting' | 'in_progress' | 'final';
  created_by: number;
  draft_order?: string; // JSON array of player IDs
  current_pick_index: number;
  period: number; // 0=not started, 1-3=regulation, 4=OT, 5=SO
  wild_score: number;
  opponent_score: number;
  created_at: string;
}

export interface HockeyPlayer {
  id: number;
  game_id: number;
  nhl_player_id?: string;
  name: string;
  position: 'F' | 'D' | 'G'; // Forward, Defense, Goalie
  jersey_number?: number;
  goals: number;
  created_at: string;
}

export interface Pick {
  id: number;
  player_id: number;
  game_id: number;
  hockey_player_id?: number; // null if picking "Win"
  is_win_pick: boolean;
  skins: number;
  picked_at: string;
  player_name?: string;
  hockey_player_name?: string;
}

export interface Payment {
  id: number;
  from_player_id: number;
  to_player_id: number;
  amount: number;
  game_id?: number;
  paid: boolean;
  paid_at?: string;
  created_at: string;
}

export interface SeasonStats {
  player_id: number;
  player_name: string;
  total_skins: number;
  games_played: number;
  total_spent: number;
  total_won: number;
  net_balance: number;
}
