# 10hr Day - Personal Deep Work Tracker

A simple, single-user productivity tracker for logging and analyzing your deep work sessions. No authentication needed - perfect for personal use across all your devices.

## Quick Start

Follow the **DEPLOYMENT_GUIDE.md** for step-by-step instructions to:
1. Set up your Supabase database (free)
2. Upload to GitHub
3. Deploy to Vercel (free)
4. Access your app from any device

## Features

- **Track Tab**: Log work sessions with timer or manual entry
- **Focus Tab**: Set monthly major goals and daily minor tasks
- **Statistics Tab**: View productivity analytics, streaks, and trends
- **Visual Calendar**: See hours worked each day at a glance
- **Undo/Redo**: Quickly fix mistakes
- **Streak Tracking**: Automatic tracking of consecutive 8+ hour days

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase (Database)
- Vercel (Hosting)

## Local Development

1. Create a `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

2. Install and run:
```bash
npm install
npm run dev
```

3. Open `http://localhost:5173`

## Important Notes

- This is a **single-user app** with no authentication
- Anyone with your URL can access it (keep the link private)
- All data is stored securely in your Supabase database
- Works on desktop, tablet, and mobile devices

## Deployment

See **DEPLOYMENT_GUIDE.md** for complete instructions.
