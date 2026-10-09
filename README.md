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
- **Database**: SQLite (file-based, works locally and on Railway via a mounted volume)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Railway

## Getting Started

### Prerequisites

- Node.js 20.9.0 or higher
- npm or yarn

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
# JWT secret for auth sessions (generate a random string)
JWT_SECRET=your-super-secret-jwt-key

# Admin password
ADMIN_PASSWORD=your_password_here

# Web Push notifications - generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

## Push Notifications

The app is a PWA — users can enable push alerts for new games, their draft
turn (including skips), and final scores via **Profile → Notifications**.

On iPhone, web push only works for installed PWAs: Share → **Add to Home
Screen**, open the app from the home icon, then enable notifications.

## Deployment

Deploy to Railway:

1. Push code to GitHub
2. Connect repository to Railway
3. Add a Railway **Volume** mounted at `/data` (persists the SQLite DB across deploys)
4. Set environment variables:
   - `JWT_SECRET` (generate a strong random string)
   - `RAILWAY_VOLUME_MOUNT_PATH=/data`
   - `ADMIN_PASSWORD` (optional)
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (optional — push notifications)
5. Deploy!

> Note: `DATABASE_URL` / PostgreSQL is not currently supported — do not set it.

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
