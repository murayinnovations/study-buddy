# Arthur — Learning Companion for Strathmore University

Arthur is an AI study companion with three views: student, lecturer and Head of Department. This repo is a proof of concept for a demo to Strathmore staff, with SBS 201 Financial Accounting as the pilot course

## Status

| Area | State |
|---|---|
| Student chat | Live. SBS 201 answers from the notes in `content/sbs201/` and cites them; the other courses use a syllabus description only |
| Mastery tracking | Live. Arthur records practice results with a tool call and the student's scores update |
| Ask lecturer → inbox → reply → save to course | Live, shared across browsers |
| Lecturer dashboards | Computed from the signed-up students plus a synthetic class of 30 |
| Material upload and approval | Live (.md and .txt) |
| Head of Department view | Illustrative data, labelled as such |
| Sign-in | Emailed sign-in link (Supabase Auth) for people on the members list. Each person sees only their role's view, and each student their own work |
| Storage | Supabase, through the app's `/api/store` route (`app/lib/db.ts`), which checks the member's role |

The demo walkthrough is in [docs/demo-script.md](docs/demo-script.md).

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` (it is git-ignored) and fill in your Anthropic key and Supabase project URL and keys.
3. Create the tables: in the Supabase dashboard open **SQL Editor → New query**, paste `supabase/schema.sql` and run it. It's safe to run again after it changes. The app fills in the course's starting data on first load.
4. Set up sign-in in the Supabase dashboard (see [Sign-in](#sign-in) below).
5. Add yourself (see [Members](#members)).
6. Start the dev server and open http://localhost:3000:
   ```bash
   npm run dev
   ```

## Deploy

Deploy from this repository through Vercel's GitHub integration, and add the same variables under **Settings → Environment Variables**.

Add the deployment's address to Supabase's redirect URLs (see below), or sign-in links won't work there.

## Sign-in

People sign in with a link emailed by Supabase Auth; there are no passwords. Only emails on the members list get a link, and the page gives everyone the same reply so it can't be used to find out who has access.

In the Supabase dashboard:

1. **Authentication → URL Configuration:** set **Site URL** to the deployment address, and add `http://localhost:3000/**` and `https://<your-vercel-domain>/**` to **Redirect URLs**.
2. **Authentication → Emails → Magic Link** (recommended): change the link in the template to
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
   ```
   With the default template, the link only works in the browser that asked for it; with this one it works from any device, for example a link opened on a phone.
3. **Authentication → Emails → SMTP Settings:** Supabase's own mailer sends only a few emails an hour and is meant for testing. Before the trial, add your own SMTP provider (for example Resend or Postmark).

## Members

The `members` table says who can sign in and as what. Manage it with the script (it reads `.env.local`):

```bash
node --env-file=.env.local scripts/members.mjs add sara@example.com student "Sara Kamau" STR-2024-0117 --sample
node --env-file=.env.local scripts/members.mjs add mwangi@example.com lecturer "Prof. P. Mwangi"
node --env-file=.env.local scripts/members.mjs add njoroge@example.com hod "Dr. N. Njoroge" --subtitle "Head, Strathmore Business School"
node --env-file=.env.local scripts/members.mjs list
node --env-file=.env.local scripts/members.mjs remove sara@example.com
```

Students start with every topic not yet started; `--sample` starts them from the demo's sample progress instead, for demo accounts. Lecturers see SBS 201, the pilot course. A Gmail address with `+` (`you+lecturer@gmail.com`) arrives in the same inbox, which is handy for having one account per role.

## Three modules

| Role | Features |
|---|---|
| Student | AI companion (S1–S13), topic progress, gap detection, study path, flag to lecturer |
| Lecturer | Class heatmap, session brief, per-student drill-down, content approval, Q&A inbox (L1–L12) |
| Head of Department | Cross-course overview, at-risk monitoring, CUE compliance, fairness and privacy audit (H1–H10) |
