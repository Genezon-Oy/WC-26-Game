# 🏆 World Cup 2026 Predictor League (MM '26 Veikkaus)

A premium, Football Manager-style web application built for friends to compete on predicting results for the **FIFA World Cup 2026** (hosted in the USA, Canada, and Mexico).

The app features a rich, dark-themed user interface, complete with localized Finnish translations, live-scoring synchronizations, and an odds-based scoring system.

---

## 🛠️ Tech Stack & Architecture

This project is built using a modern fullstack TypeScript and serverless architecture:

- **Framework:** [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19, Vite, TanStack Router for file-based routing and SSR, and Nitro server backend).
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL) with full Row Level Security (RLS) policies, PostgreSQL triggers, and secure server-side admin client access.
- **Styling:** Vanilla CSS, styled with custom dark-mode aesthetics, glassmorphic card sections, and tailored color scales utilizing Tailwind CSS.
- **Local Package Manager:** Bun (uses `bun.lock` and `bunfig.toml` settings).

---

## ✨ Key Features

### 1. Interactive Dashboard (Koti)

- **Greeting Banner:** Greets the logged-in user with their profile avatar.
- **Stat Tracker:** Displays the user's current ranking (`#Rank`) and total accumulated points.
- **Mini-Leaderboard:** Live-updating standing showing the top competitors.
- **Next Match Hero Widget:** Highlighted upcoming match with a dynamic countdown, team flags, and a direct "Veikkaa nyt" (Predict Now) action.
- **Today's Unpredicted Matches:** Active nudges alerting the user if they have upcoming matches today that they haven't predicted yet.

### 2. Fast-Paced Predictions Flow (Veikkaa)

- **Sequential Prediction Queue:** Users are guided through upcoming unpredicted matches one-by-one.
- **Outcome Pick System:** Core predictor uses the **1X2 style** (1 = Home Win, X = Draw, 2 = Away Win).
- **"Save & Next" Flow:** Allows fast entry using quick actions, saving the pick, and auto-jumping to the next unpredicted match. Matches lock automatically at kickoff time.

### 3. Tournament Fixtures & Group Standings

- **Ottelut (Fixtures):** Full tournament calendar grouped by dates, stadiums, and matches showing in-play (live) scores, half-time/full-time goals, and goal scorers.
- **Lohkot (Groups):** Automatic, live-computed standings tables (O = Games played, V = Wins, T = Draws, H = Losses, ME = Goal Difference, P = Points) according to registered match results.
- **Joukkueet (Teams):** Profiles for all 2026 World Cup nations including custom flag icons and their full match schedules.

### 4. Leaderboard (Tulostaulu)

- Competitive scoreboard tracking:
  1. Total points earned (odds-based).
  2. Count of correct outcome predictions (1X2).
  3. Total settled matches.

### 5. Robust Admin Console (`/admin`)

- **Fixtures Syncing:** Pulls and seeds the official World Cup 2026 team lists, stadiums, kickoff times, and groups directly from the `openfootball` repository.
- **Live Score Updates:** Polls in-play live scores and final results via the `football-data.org` API.
- **Odds Snapshotting:** Syncs live match betting odds from `api-football` to serve as prediction point values.
- **Manual Override & Scoring:** Lets admins type in custom match scores manually. Saving a score triggers a PostgreSQL function that automatically recalculates points for all user predictions.
- **User Management:** Creates new player accounts (admin/player) and manages password resets.

---

## 📈 Point System & Scoring Rules

The predictor league uses an **odds-based scoring system**:

- A correct prediction (1X2) awards points equal to the snapshotted odds of that outcome.
  - _Example:_ You predict a draw (`X`) on USA vs England. The match ends `1-1`. If the draw odds were locked at `3.40`, you receive **3.40 points**. An incorrect pick yields **0 points**.
- **Odds Locking:** Pre-match odds are fetched from the API and locked automatically **30 minutes prior to kickoff** (or manually by an admin).
- **Unconfigured Odds:** If a match's odds were never fetched or locked before kickoff, correct picks default to **0 points** to maintain fairness.

---

## 🗄️ Database Schema & Triggers

Supabase handles user access control (RLS) and real-time point computing via database-level entities:

### Tables

1.  `profiles`: Extends Supabase auth. Users' public identifiers (`username`, `display_name`, `avatar_url`).
2.  `user_roles`: Manages access permissions (`admin` or `player`).
3.  `teams`: List of competing countries (`name`, `group_code`, `flag_emoji`).
4.  `matches`: Match fixtures database (`match_key`, `stage`, `home_team`, `away_team`, `home_score`, `away_score`, `status`, `kickoff_at`).
5.  `match_odds`: Snapshotted market values (`odds_1`, `odds_x`, `odds_2`, `locked`, `source`).
6.  `predictions`: Individual predictions submitted by players (`pick`, `points`).

### RLS Policies & Triggers

- **Predictions Security:** Players can only insert or update predictions for matches that **have not started yet** (`kickoff_at > now()`). Other players' predictions are only visible after the match kickoff.
- **`on_match_score_update` Trigger:** Runs when a match score updates (either via admin poll or manual input). It executes `recompute_match_predictions()`, recalculating and updating the `points` column in the `predictions` table in real-time.

---

## ⚙️ Setup & Configuration

### 1. Environment Variables

Duplicate the provided `.env.example` file to `.env` and configure your keys:

```bash
cp .env.example .env
```

Review the values in `.env`:

- `VITE_SUPABASE_URL` / `SUPABASE_URL`: Your Supabase Project API URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase public Anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role key (only read by the server backend to bypass RLS for admin workflows).
- `FOOTBALL_DATA_API_KEY`: API token from [football-data.org](https://www.football-data.org/) (for live scores).
- `API_FOOTBALL_KEY`: API token from [api-football (api-sports.io)](https://www.api-sports.io/) (for match odds).

### 2. Local Setup

Install dependencies and launch the Vite dev server:

```bash
# Install packages
bun install

# Run the project in development mode
bun dev
```

The server runs by default at `http://localhost:3000`.

### 3. Authentication Flow

To simplify onboarding for small friend groups, this app uses a custom credentials pattern:

- Signups are managed by the admin.
- Users sign in using a **username** and **password**.
- Behind the scenes, the username is converted into a synthetic email address (`username@league.local`) for authentication against Supabase Auth.

---

## 🚀 Admin Seeding

On a fresh deployment, you must seed your first admin account.

1. Start your local server (`bun dev`).
2. Send a `POST` request to `http://localhost:3000/api/public/seed-admin` with the following JSON payload:
   ```json
   {
     "username": "Jaikki",
     "password": "YourSecurePassword123!",
     "display_name": "Jaikki Admin"
   }
   ```
3. _Security Note:_ This endpoint will return `403 Forbidden` if there is already one or more administrators registered in the `user_roles` table, preventing unauthorized overrides.

---

## ⚠️ Known Limitations & API Details

- **api-football Free Tier:** The free tier of the `api-football` API restricts queries to the current day and the next 2 days, and doesn't permit fetching the entire tournament schedule in advance. Matches outside of this window will not retrieve odds automatically, requiring manual override entry or an account upgrade.
- **Name Normalization:** Names of countries can vary across databases (e.g. `Ivory Coast` vs. `Cote d'Ivoire`). `src/lib/odds.functions.ts` implements a name-alias mapper (`NAME_ALIASES`) to ensure matches are mapped properly during sync. Add new aliases to this list if sync issues occur.
