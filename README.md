# Arthur — Learning Companion for Strathmore University

Arthur is an AI study companion with three views: student, lecturer and Head of Department. This repo is a proof of concept for a demo to Strathmore staff, with SBS 201 Financial Accounting as the pilot course.

## Status

| Area | State |
|---|---|
| Student chat | Live. SBS 201 answers from the notes in `content/sbs201/` and cites them; the other courses use a syllabus description only |
| Mastery tracking | Live. Arthur records practice results with a tool call and the student's scores update |
| Ask lecturer → inbox → reply → save to course | Live within one browser |
| Lecturer dashboards | Computed from a synthetic class of 30 students plus the live demo student |
| Material upload and approval | Live within one browser (.md and .txt) |
| Head of Department view | Illustrative data, labelled as such |
| Storage | The browser's localStorage (`app/lib/demoStore.tsx`); Supabase replaces it next |

The demo walkthrough is in [docs/demo-script.md](docs/demo-script.md).

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` in the project root (it is git-ignored):
   ```
   ANTHROPIC_API_KEY=your_key_from_console.anthropic.com
   ```
3. Start the dev server and open http://localhost:3000:
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
