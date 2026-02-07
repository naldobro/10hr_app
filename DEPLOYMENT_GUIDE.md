# 10hr Day - Simple Deployment Guide

This is a **single-user personal productivity tracker** with no authentication. Anyone with the link can access and use the app. Perfect for personal use across your devices (phone, laptop, etc.).

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works great)
- A [Vercel](https://vercel.com) account (free tier is perfect)
- A [GitHub](https://github.com) account
- Git installed on your computer

## Step 1: Set Up Supabase Database

### 1.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in the project details:
   - **Project name**: `10hr-day` (or any name you like)
   - **Database password**: Create a strong password (save this somewhere safe)
   - **Region**: Choose the closest region to you for better performance
4. Click "Create new project" and wait 1-2 minutes for setup

### 1.2 Run the Database Setup

1. Once your project is ready, click **SQL Editor** in the left sidebar
2. Click "New query"
3. Copy the ENTIRE contents from `supabase/migrations/single_user_schema.sql` file
4. Paste it into the SQL editor
5. Click "Run" at the bottom right

You should see "Success. No rows returned" - that means your database is ready!

### 1.3 Get Your Supabase API Keys

1. Go to **Project Settings** (gear icon in the left sidebar)
2. Click on **API** in the settings menu
3. You'll need two values here - copy them somewhere safe:
   - **Project URL**: Copy this (looks like `https://xxxxx.supabase.co`)
   - **anon public** key: Copy this long string

Keep these handy - you'll need them in a few minutes!

## Step 2: Upload to GitHub

### 2.1 Open the Project in VS Code

1. Download/extract this project folder
2. Open VS Code
3. Go to **File** → **Open Folder** and select the project folder

### 2.2 Create a GitHub Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Create a new repository:
   - **Repository name**: `10hr-day` (or any name you like)
   - **Visibility**: Private is recommended (keeps it personal)
   - **DO NOT** check any boxes (no README, .gitignore, or license)
3. Click "Create repository"

### 2.3 Push Your Code to GitHub

1. In VS Code, open the Terminal (View → Terminal)
2. Run these commands one by one (replace YOUR_USERNAME with your GitHub username):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/10hr-day.git
git push -u origin main
```

If it asks for credentials, enter your GitHub username and password (or use a personal access token).

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in (use GitHub to sign in for easier setup)
2. Click "Add New..." → "Project"
3. Find your `10hr-day` repository and click "Import"
4. Vercel will automatically detect it as a Vite project

### 3.2 Add Your Supabase Keys

This is the most important step - don't skip it!

1. Before clicking Deploy, scroll down to **Environment Variables**
2. Add these two variables (use the values you saved from Step 1.3):

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: Paste your Supabase Project URL

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: Paste your Supabase anon public key

3. Click "Deploy"

### 3.3 Wait for Deployment

1. Vercel will build your app (takes about 1-2 minutes)
2. Once you see "Congratulations!" your app is live!
3. Click "Visit" or copy the URL (looks like `https://your-app.vercel.app`)

**Save this URL** - this is how you'll access your app from any device!

## Step 4: Test Your App

1. Click on your Vercel URL to open the app
2. Try adding a work session:
   - Click "Add Manual Session"
   - Pick a time and duration
   - Add a label and click "Add Session"
3. Check that it appears in the month calendar
4. Try the Focus tab to add goals
5. Check the Statistics tab

If everything works - you're done! Bookmark this URL and access it from your phone, laptop, anywhere!

## Using Your App

- **On Desktop**: Bookmark the Vercel URL
- **On Phone**:
  - Open the URL in your browser
  - Add to Home Screen (iPhone: Share → Add to Home Screen)
  - It will work like a native app!
- **Privacy**: Only people with your URL can access it. Don't share the link if you want it private.

## Optional: Run Locally for Development

If you want to test changes before deploying:

### Create a .env file

In VS Code, create a new file called `.env` in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run the app

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Making Changes Later

If you want to modify the app:

1. Make changes in VS Code
2. Test locally with `npm run dev`
3. Push to GitHub:
```bash
git add .
git commit -m "Made some improvements"
git push
```
4. Vercel automatically rebuilds and deploys your changes!

## Troubleshooting

### App Shows Errors

**Problem**: You see database errors or the app doesn't work

**Solution**:
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Make sure both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are there
3. Verify they match your Supabase keys exactly (no extra spaces)
4. If you fix them, go to Deployments → Click the three dots → Redeploy

### Database Not Saving Data

**Problem**: You add sessions but they disappear

**Solution**:
1. Go to Supabase → SQL Editor
2. Make sure you ran the migration script from Step 1.2
3. Try running it again if needed

### Build Failed on Vercel

**Problem**: Deployment fails

**Solution**:
1. Check the error logs on Vercel
2. Make sure you pushed all files to GitHub
3. Test locally first: `npm run build`

## What You Can Do

Your app has these features:

- **Track Tab**: Log work sessions with a timer or manually
- **Focus Tab**: Set monthly major goals and daily minor tasks
- **Statistics Tab**: See your productivity stats, streaks, and best days
- **Undo/Redo**: Quickly fix mistakes with undo/redo buttons
- **Month View**: Visual calendar showing hours worked each day
- **Streak Counter**: Tracks consecutive days with 8+ hours

## Important Notes

- This is a **single-user app** - no login needed
- Anyone with your URL can access it (keep it private if needed)
- All data is stored in your Supabase database
- Works perfectly on phones, tablets, and computers
- Add to your phone's home screen for a native app experience

## Need Help?

- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **Vercel Docs**: [https://vercel.com/docs](https://vercel.com/docs)

Happy tracking your deep work sessions!
