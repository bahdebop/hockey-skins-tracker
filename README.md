# 🏒 Hockey Skins Tracker

Track your Minnesota Wild skins pool games with friends!

## Features

- **Game Creation**: Any player can create a game and invite others
- **Draft System**: Rotating draft order ensures fairness
- **Live Scoring**: Updates after each period (1st, 2nd, 3rd, OT, SO)
- **Skins Tracking**: 
  - Forward goal = 1 skin
  - Defenseman goal = 2 skins
  - Goalie starts with 2 skins, -1 per goal against
  - Win pick = 2 skins (if Wild wins)
- **Season Leaderboard**: Track total skins across all games
- **Payment Tracking**: Know who owes what with optimal settlement
- **NHL API Integration**: Automatic lineup pulls from NHL Stats API

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Railway) / SQLite (local)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Railway

## Getting Started

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create `.env.local`:

```env
# Optional: PostgreSQL connection string (uses SQLite if not provided)
DATABASE_URL=postgresql://...

# Admin password
ADMIN_PASSWORD=your_password_here
```

## Deployment

Deploy to Railway:

1. Push code to GitHub
2. Connect repository to Railway
3. Add PostgreSQL database
4. Set environment variables
5. Deploy!

## How to Play

1. **Create Game**: Select upcoming Wild game, set pot amount
2. **Draft**: Players take turns picking Wild players or "Win"
3. **Track**: Scores update after each period
4. **Win**: Most skins wins the pot!

## Scoring Rules

- Forward goal: **1 skin**
- Defenseman goal: **2 skins**
- Goalie: Starts with **2 skins**, loses 1 per goal against
- Win pick: **2 skins** if Wild wins
- Assists & empty net goals: **0 skins**
- OT/SO goals count normally

## License

MIT
