# Arthur — Learning Companion for Strathmore University

Arthur is an AI study companion with three views: student, lecturer and Head of Department. This repo is a proof of concept for a demo to Strathmore staff, with SBS 201 Financial Accounting as the pilot course

## Status

| Area | State |
|---|---|
| Student chat | Live. SBS 201 answers from the notes in `content/sbs201/` and cites them; the other courses use a syllabus description only |
| Mastery tracking | Live. Arthur records practice results with a tool call and the student's scores update |
| Ask lecturer → inbox → reply → save to course | Live, shared across browsers |
| Lecturer dashboards | Computed from a synthetic class of 30 students plus the live demo student |
| Material upload and approval | Live (.md and .txt) |
| Head of Department view | Illustrative data, labelled as such |
| Storage | Supabase, through the app's `/api/store` route (`app/lib/db.ts`). No sign-in yet; it comes with the trial |

The demo walkthrough is in [docs/demo-script.md](docs/demo-script.md).

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` (it is git-ignored) and fill in your Anthropic key and Supabase project URL and keys.
3. Create the tables: in the Supabase dashboard open **SQL Editor → New query**, paste `supabase/schema.sql` and run it. The app fills in the demo data on first load.
4. Start the dev server and open http://localhost:3000:
   ```bash
   npm run dev
   ```

## Deploy

Deploy from this repository through Vercel's GitHub integration, and add the same variables under **Settings → Environment Variables**.

Until sign-in is added, anyone with the URL can use the chat, and every message is billed to the Anthropic key. Keep the deployment URL private.

## Three modules

| Role | Features |
|---|---|
| Student | AI companion (S1–S13), topic progress, gap detection, study path, flag to lecturer |
| Lecturer | Class heatmap, session brief, per-student drill-down, content approval, Q&A inbox (L1–L12) |
| Head of Department | Cross-course overview, at-risk monitoring, CUE compliance, fairness and privacy audit (H1–H10) |
