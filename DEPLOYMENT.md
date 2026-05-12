# Drive & Panel Management App
## Complete Deployment Guide (Zero Local Install)

---

## What You're Deploying

| File | Purpose |
|------|---------|
| `index.html` | Main application (all pages in one file) |
| `confirm.html` | Handles candidate confirm/decline email links |
| `supabase/migrations/001_initial_schema.sql` | Run once in Supabase SQL Editor |
| `supabase/functions/send-email/index.ts` | Edge Function for all email sending |
| `supabase/functions/handle-response/index.ts` | Edge Function for token-link responses |
| `src/lib/supabase.js` | Reference: Supabase API helpers |
| `docs/HLD_Drive_Panel_Management.docx` | Full High-Level Design document |

---

## STEP 1: Set Up Supabase (your database + backend)

1. Go to **https://supabase.com** → Sign up / Log in
2. Click **New project** → enter a name (e.g. `drive-panel-app`) → choose a region close to India (Singapore) → set a database password → **Create project**
3. Wait ~1 minute for provisioning

### Run the database schema
4. In Supabase: go to **SQL Editor** (left sidebar) → **New query**
5. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
6. Paste into the SQL editor → click **Run**
7. You should see "Success. No rows returned"

### Get your credentials
8. Go to **Project Settings** → **API**
9. Copy:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon public** key → a long JWT string

### Create your admin user
10. Go to **Authentication** → **Users** → **Invite a user** → enter your email
11. Accept the invitation email and set your password
12. In SQL Editor, run:
    ```sql
    UPDATE profiles SET role = 'admin', full_name = 'Your Name' WHERE email = 'your@email.com';
    ```

---

## STEP 2: Deploy Edge Functions

### send-email function
1. In Supabase: go to **Edge Functions** → **New Function**
2. Name: `send-email`
3. Paste contents of `supabase/functions/send-email/index.ts`
4. Click **Deploy**

### handle-response function
1. Click **New Function** again
2. Name: `handle-response`  
3. Paste contents of `supabase/functions/handle-response/index.ts`
4. Click **Deploy**

### Set environment secrets
5. In **Edge Functions** → **Secrets** → add:
   - `BREVO_API_KEY` → your Brevo API key (see Step 3 below)
   - `APP_URL` → your Netlify URL (fill this in after Step 5)

---

## STEP 3: Set Up Brevo (email service)

1. Go to **https://brevo.com** → Sign up (free, 300 emails/day)
2. Go to **Settings** → **API Keys** → **Create a new API key**
3. Copy the key and add it as `BREVO_API_KEY` in Supabase Edge Function secrets
4. In Brevo: go to **Senders & Domains** → add your sending email address
5. Verify the email address via the verification email Brevo sends

---

## STEP 4: Push Code to GitHub

1. Go to **https://github.com** → Sign in → **New repository**
2. Name: `drive-panel-app` → Public or Private → **Create repository**
3. Go to **https://stackblitz.com** → Sign in with GitHub
4. Click **Open from GitHub** → select `drive-panel-app`
5. Upload all project files by dragging them into the StackBlitz file tree
6. **Update credentials** in `index.html` (find and replace):
   - `YOUR_PROJECT_ID` → your Supabase project ID
   - `YOUR_ANON_KEY` → your Supabase anon key
7. Same in `confirm.html`
8. In StackBlitz: open the **Source Control** panel (git icon) → write "Initial commit" → **Commit & Push**

---

## STEP 5: Deploy to Netlify

1. Go to **https://netlify.com** → Sign in with GitHub
2. Click **Add new site** → **Import an existing project**
3. Choose **GitHub** → authorize → select `drive-panel-app`
4. Build settings:
   - **Build command**: (leave blank)
   - **Publish directory**: `/` (or leave blank)
5. Click **Deploy site**
6. Netlify gives you a URL like `https://drive-panel-app.netlify.app`
7. Copy this URL → go to Supabase → **Edge Functions** → **Secrets** → update `APP_URL`

---

## STEP 6: Set Up Scheduled Emails (pg_cron)

1. In Supabase → **Database** → **Extensions** → search `pg_cron` → enable it
2. Also enable `pg_net` extension (needed for HTTP calls from cron)
3. In SQL Editor, run (replace URL with your actual Edge Function URL):

```sql
-- Get your Edge Function URL from: Edge Functions → send-email → Details
-- It looks like: https://abcdefgh.supabase.co/functions/v1/send-email

-- Friday 12:00 PM IST (06:30 UTC) - candidate confirmation emails
SELECT cron.schedule(
  'friday-candidate-confirm',
  '30 6 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-email',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"type": "candidate_confirmation_batch"}'::jsonb
  );
  $$
);

-- Saturday 9:00 AM IST (03:30 UTC) - reminder for non-confirmed
SELECT cron.schedule(
  'saturday-reminder',
  '30 3 * * 6',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-email',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"type": "candidate_reminder"}'::jsonb
  );
  $$
);

-- Thursday 9:00 AM IST (03:30 UTC) - panel availability update
SELECT cron.schedule(
  'thursday-panel-availability',
  '30 3 * * 4',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-email',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"type": "panel_availability"}'::jsonb
  );
  $$
);
```

---

## STEP 7: Test Everything

- [ ] Open your Netlify URL → login page appears
- [ ] Sign in with your admin email → dashboard loads
- [ ] Create a domain → appears in list
- [ ] Add a panel member → appears with correct domain
- [ ] Create a drive sheet → appears in grid
- [ ] Add a candidate → appears in table
- [ ] Click "Email" next to a candidate → check email inbox for confirmation link
- [ ] Click the confirmation link → confirm.html shows confirmation message
- [ ] Status updates to "Confirmed" in the app

---

## Ongoing Maintenance (all web-based)

| Task | Where |
|------|-------|
| Edit code | StackBlitz → commit → auto-deploys to Netlify |
| View database | Supabase → Table Editor |
| Monitor emails | Brevo → Logs |
| Check Edge Function logs | Supabase → Edge Functions → Logs |
| Add new users | Supabase → Authentication → Users |
| Change user roles | Supabase → SQL Editor → UPDATE profiles SET role = '...' |
| View cron job history | Supabase → SQL Editor → SELECT * FROM cron.job_run_details; |

---

## Cost Summary

All services used are **free tier** and sufficient for teams up to ~50 users:

| Service | Free Limit |
|---------|-----------|
| Supabase | 500MB DB, 50MB storage, 500K Edge Function invocations/month |
| Netlify | 100GB bandwidth, unlimited deploys |
| Brevo | 300 emails/day |
| GitHub | Unlimited public/private repos |
| StackBlitz | Free browser IDE |
