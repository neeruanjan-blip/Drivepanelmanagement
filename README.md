# Drive & Panel Management Application

A fully **web-based** recruitment coordination platform. No local installation required — everything runs in the browser or on cloud services.

## Features

- **Domain Management** — Organize hiring by domain (Engineering, Design, etc.)
- **Panel Management** — Track interviewers, levels, availability with weekly email reminders
- **Drive Sheets** — Group candidates by hiring event/date
- **Candidate Pipeline** — Full candidate tracking with 12 status stages
- **Email Automation** — Confirmation emails, availability reminders via Brevo
- **Dashboard & Reports** — Real-time metrics + CSV export
- **Roles** — Admin, Recruiter, Panel Member

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5 + Tailwind CSS CDN + Vanilla JS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Backend | Supabase Edge Functions (Deno) |
| Email | Brevo REST API |
| Scheduler | Supabase pg_cron |
| Hosting | Vercel / Netlify |

## Quick Start

### 1. Configure your Supabase credentials

Open `index.html` and `confirm.html` — find these two lines near the top and replace with your values:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

### 2. Run the database schema

In **Supabase → SQL Editor**, paste and run:
```
supabase/migrations/001_initial_schema.sql
```

### 3. Deploy Edge Functions

In **Supabase → Edge Functions**, create two functions:
- `send-email` → paste `supabase/functions/send-email/index.ts`
- `handle-response` → paste `supabase/functions/handle-response/index.ts`

Add secrets: `BREVO_API_KEY` and `APP_URL`

### 4. Deploy to Vercel / Netlify

Push this repo to GitHub, then connect to Vercel or Netlify. No build command needed — just point to the root directory.

## Full Deployment Guide

See `DEPLOYMENT.md` for complete step-by-step instructions.

## HLD Document

See `docs/HLD_Drive_Panel_Management.docx` for the full High-Level Design document.

## Project Structure

```
drive-panel-app/
├── index.html                          # Main SPA (all pages)
├── confirm.html                        # Candidate/panel token response page
├── vercel.json                         # Vercel deployment config
├── netlify.toml                        # Netlify deployment config
├── DEPLOYMENT.md                       # Step-by-step deployment guide
├── src/
│   └── lib/
│       └── supabase.js                 # Supabase API helpers (reference)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Full DB schema — run in SQL Editor
│   └── functions/
│       ├── send-email/index.ts         # Email Edge Function
│       └── handle-response/index.ts   # Token response Edge Function
└── docs/
    └── HLD_Drive_Panel_Management.docx # High-Level Design document
```
