# 🏆 World Cup 2026 Predictor League (MM '26 Veikkaus)

A premium, Football Manager-style web application built for friends to compete on predicting results for the **FIFA World Cup 2026** (hosted in the USA, Canada, and Mexico).

The app features a rich, dark-themed user interface, complete with localized Finnish translations, live-scoring synchronizations, and an odds-based scoring system featuring the **Money Making Matrix**.

---

## 🛠️ Tech Stack & Architecture

This project is built using a modern fullstack TypeScript and serverless architecture:

- **Framework:** [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19, Vite, TanStack Router for file-based routing and SSR, and Nitro server backend).
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL) with full Row Level Security (RLS) policies, PostgreSQL triggers, and secure server-side admin client access.
- **Styling:** Vanilla CSS, styled with custom dark-mode aesthetics, glassmorphic card sections, and tailored color scales utilizing Tailwind CSS.
- **Local Package Manager:** Bun or npm.
- **Hosting:** Deployed to Cloudflare Pages.

---

## ✨ Key Features

### 1. Interactive Dashboard (Koti)
- **Greeting Banner:** Greets the logged-in user with their profile avatar.
- **Stat Tracker:** Displays the user's current ranking (`#Rank`) and total accumulated points.
- **Mini-Leaderboard:** Live-updating standing showing the top competitors.
- **Next Match Hero Widget:** Highlighted upcoming match with a dynamic countdown, team flags, and a direct "Veikkaa nyt" (Predict Now) action.

### 2. Fast-Paced Predictions Flow (Veikkaa)
- **Sequential Prediction Queue:** Users are guided through upcoming unpredicted matches one-by-one.
- **Outcome Pick System:** Core predictor uses the **1X2 style** (1 = Home Win, X = Draw, 2 = Away Win). Optional predictions!
- **"Save & Next" Flow:** Allows fast entry using quick actions, saving the pick, and auto-jumping to the next unpredicted match. Matches lock automatically at kickoff time.

### 3. Tournament Fixtures & Group Standings
- **Ottelut (Fixtures):** Full tournament calendar grouped by dates, stadiums, and matches showing in-play (live) scores.
- **Lohkot (Groups):** Automatic, live-computed standings tables (O = Games played, V = Wins, T = Draws, H = Losses, ME = Goal Difference, P = Points).

### 4. Robust Admin Console (`/admin`) & Server Automation
- **Fixtures Syncing:** Pulls and seeds the official World Cup 2026 team lists, stadiums, kickoff times, and groups.
- **Live Score Updates:** Polls in-play live scores and final results via the **football-data.org** API.
- **Odds Snapshotting:** Syncs live match betting odds from **The Odds API** to serve as prediction point values.

---

## 📈 Point System & Game Rules

The predictor league uses an **odds-based scoring system** with a high-risk/high-reward multiplier mechanic.

### 1. Perusveikkaus (Safe Score)
- A correct prediction (1X2) awards points equal to the snapshotted odds of that outcome.
- *Example:* You predict a draw (`X`) on USA vs England. If the draw odds were locked at `3.40`, you receive **3.40 points**. An incorrect pick yields **0 points**.

### 2. Money Making Matrix (Matrix-tuotto)
- Every prediction automatically participates in the Matrix.
- **Correct Prediction:** You receive an extra **+50%** of the odds value added to your score.
- **Incorrect Prediction:** You receive a **-0.50 point** penalty subtracted from your score.

### 3. Knockout Stage Multipliers
As the tournament progresses, the stakes get higher. The total points for a match are multiplied:
- Round of 32: **1.25x**
- Round of 16: **1.50x**
- Quarter-Finals: **1.75x**
- Semi-Finals: **2.00x**
- 3rd Place / Final: **2.50x**

### 4. Odds Locking
Pre-match odds are fetched from the API and locked automatically **240 minutes (4 hours) prior to kickoff**. 
If a match's odds were never fetched or locked before kickoff, correct picks default to **0 points** to maintain fairness.

---

## 🤖 Cron Automation & APIs

The app is fully automated using a single background endpoint (`/api/cron`) that performs all the heavy lifting.

### `/api/cron` Endpoint
When triggered, this secure endpoint sequentially executes:
1. **`performRefreshOdds()`**: Hits **The Odds API** to fetch average H2H odds for the next 14 days of matches. It aggressively searches for any match kicking off within the next 240 minutes and locks its odds permanently into the database.
2. **`performPollLive()`**: Hits **football-data.org** to fetch live scores. It intelligently compares the fetched scores against the database and only updates and recalculates predictions if the score or status has genuinely changed.

### Triggering the Cron
The `/api/cron` endpoint is protected by a `CRON_SECRET`. In production (Cloudflare Pages), a **Cloudflare Worker Cron Trigger** is configured to run `0 */2 * * *` (every 2 hours), pinging `https://wc-26-game.pages.dev/api/cron?secret=YOUR_CRON_SECRET`.

### API Limits
- **The Odds API:** Free tier provides 500 requests per month. Running every 2 hours uses ~360 requests/month, keeping it safely within limits.
- **football-data.org:** Free tier provides 10 requests per minute. The cron job only makes 1 request every 2 hours, making it highly efficient.

---

## 🗄️ Database Schema & Triggers

Supabase handles user access control (RLS) and real-time point computing via database-level entities:

### Tables
1.  `profiles`: Extends Supabase auth. Users' public identifiers (`username`, `display_name`, `avatar_url`).
2.  `user_roles`: Manages access permissions (`admin` or `player`).
3.  `teams`: List of competing countries.
4.  `matches`: Match fixtures database.
5.  `match_odds`: Snapshotted market values (`odds_1`, `odds_x`, `odds_2`, `locked`, `source`).
6.  `predictions`: Individual predictions submitted by players (`pick`, `points`).

### RLS Policies & Triggers
- **Predictions Security:** Players can only insert or update predictions for matches that **have not started yet** (`kickoff_at > now()`). Other players' predictions are only visible after the match kickoff.
- **`on_match_score_update` Trigger:** Runs when a match score updates. It automatically executes a PostgreSQL function (`recompute_match_predictions()`) that calculates Safe Scores, Money Making Matrix penalties/bonuses, and Knockout Multipliers, updating the `points` column in the `predictions` table in real-time.

---

## ⚙️ Setup & Configuration

### 1. Environment Variables

Duplicate the provided `.env.example` file to `.env` and configure your keys:

```bash
cp .env.example .env
```

Required values in `.env`:
- `VITE_SUPABASE_URL` / `SUPABASE_URL`: Your Supabase Project API URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase public Anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role key (bypasses RLS for admin workflows).
- `VITE_FOOTBALL_DATA_API_KEY` / `FOOTBALL_DATA_API_KEY`: API token from [football-data.org](https://www.football-data.org/).
- `VITE_ODDS_API_KEY` / `ODDS_API_KEY`: API token from [The Odds API](https://the-odds-api.com/).
- `VITE_CRON_SECRET` / `CRON_SECRET`: A 32-character hex string securing the automation endpoint.

### 2. Local Setup

Install dependencies and launch the Vite dev server:

```bash
# Install packages
npm install

# Run the project in development mode
npm run dev
```

### 3. Authentication Flow

To simplify onboarding for small friend groups, this app uses a custom credentials pattern:
- Signups are managed by the admin.
- Users sign in using a **username** and **password**.
- Behind the scenes, the username is converted into a synthetic email address (`username@league.local`) for authentication against Supabase Auth.

---

## 🚀 Admin Seeding

On a fresh deployment, you must seed your first admin account.

1. Send a `POST` request to `https://your-domain.com/api/public/seed-admin` with the following JSON payload:
   ```json
   {
     "username": "AdminUser",
     "password": "YourSecurePassword123!",
     "display_name": "Admin"
   }
   ```
2. *Security Note:* This endpoint will return `403 Forbidden` if there is already one or more administrators registered in the `user_roles` table, preventing unauthorized overrides.
