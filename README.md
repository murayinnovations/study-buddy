# Curriculum AI — Learning Companion for Strathmore University

Curriculum AI is an AI study companion with three views: student, lecturer and Head of Department. The pilot course is Business Intelligence with Power BI (BI-Apr-26), with materials imported from Strathmore's data science learning platform. Courses, their topics, Curriculum AI's instructions for each course and all course material live in the database, not in the code

## Status

| Area | State |
|---|---|
| Student chat | Live. Answers from the course's approved materials in the database and cites them; students can also open the original files |
| Mastery tracking | Live. Curriculum AI records practice results with a tool call and the student's scores update |
| Ask lecturer → inbox → reply → save to course | Live, shared across browsers |
| Lecturer dashboards | Computed from the signed-up students in the lecturer's course (plus a synthetic class of 30 for courses with `synthetic_class` set) |
| Material upload and approval | Live (.md and .txt). Imported platform material is approved on import |
| Head of Department view | Illustrative data, labelled as such |
| Sign-in | Email and password (Supabase Auth). Anyone can create an account. New people join as students; lecturer and HoD access is granted from the members list. Each person sees only their role's view, and each student their own work |
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
5. Import the course (see [Courses](#courses)).
6. Add yourself (see [Members](#members)).
7. Start the dev server and open http://localhost:3000:
   ```bash
   npm run dev
   ```

## Deploy

Deploy from this repository through Vercel's GitHub integration, and add the same variables under **Settings → Environment Variables**.

Add the deployment's address to Supabase's redirect URLs (see below), or sign-in links won't work there.

## Sign-in

People sign in with an email and password (Supabase Auth). Anyone can create an account from the sign-in page: someone new is added to the members list as a student the first time they open the app, starting with every topic not yet started. Lecturer and HoD access still has to be granted (see [Members](#members)), since those views show other students' work.

In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Email:** make sure **Email** is enabled.
   - **Confirm email** decides whether new accounts must open an emailed link before they can sign in. Leave it on so people can't sign up with an address that isn't theirs; turn it off for a demo where people should be in straight away. The app handles both.
   - Optionally raise **Minimum password length** to 8 to match the app.
2. **Authentication → URL Configuration:** set **Site URL** to the deployment address, and add `http://localhost:3000/**` and `https://<your-vercel-domain>/**` to **Redirect URLs**.
3. **Authentication → Emails** (recommended): change the link in the **Confirm signup** template to
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
   ```
   and in the **Reset Password** template to
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery
   ```
   With the default templates, the links only work in the browser that asked for them; with these they work from any device, for example a link opened on a phone.
4. **Authentication → Emails → SMTP Settings:** Supabase's own mailer sends only a few emails an hour and is meant for testing. With confirmation on, every new account needs one, so before the trial add your own SMTP provider (for example Resend or Postmark).

People who signed in with an emailed link before passwords were added have no password yet. They click **Forgot password?** on the sign-in page to set one.

## Courses

A course is a row in the `courses` table: its name, lecturer, topics (in teaching order, with the week each is taught), the starter prompts shown on an empty chat, and Curriculum AI's instructions for teaching it. Its materials are rows in `materials`; the original files are in the private `course-files` storage bucket, and students open them through the app.

Load a course with the import script (it reads `.env.local`):

```bash
node --env-file=.env.local scripts/import-course.mjs imports/raw/pbi88 --dry-run   # list what would be imported
node --env-file=.env.local scripts/import-course.mjs imports/raw/pbi88             # import
```

The folder holds the files downloaded from the learning platform, a `course.json` describing the course and its materials, and `text/` with the text extracted from each file. Scanned PDFs marked `"transcribe": true` need a `text/<file>.transcribed.md`; if one is missing, the script has Claude write it (this needs `ANTHROPIC_API_KEY`). `imports/raw/` is git-ignored: the platform's files stay out of the repository, and the database is the source of truth. Running the import again updates the course in place.

To hide a course, set `active` to false in the `courses` table.

## Members

The `members` table says what role each person has. Students who sign in on their own are added automatically with a `SELF-…` student number; use the script to add lecturers and HoDs, to give a student a real student number, or to change someone's role. Manage it with the script (it reads `.env.local`):

```bash
node --env-file=.env.local scripts/members.mjs add sara@example.com student "Sara Kamau" STR-2024-0117
node --env-file=.env.local scripts/members.mjs add teddy@example.com lecturer "Teddy Andambi" --course BI-Apr-26
node --env-file=.env.local scripts/members.mjs add njoroge@example.com hod "Dr. N. Njoroge" --subtitle "Head, Strathmore Business School"
node --env-file=.env.local scripts/members.mjs list
node --env-file=.env.local scripts/members.mjs remove sara@example.com
```

Students see every active course and start with every topic not yet started; courses and topics added later appear for them automatically. Lecturers see the course given with `--course`, or the first active course if none is set. A Gmail address with `+` (`you+lecturer@gmail.com`) arrives in the same inbox, which is handy for having one account per role.

### Switching views with one click

Give the student, lecturer and HoD demo accounts the same `--group` value and a role switcher appears in the header, so a presenter can flip between all three views in one window instead of signing in separately as each one:

```bash
node --env-file=.env.local scripts/members.mjs add sara@example.com student "Sara Kamau" STR-2024-0117 --group demo1
node --env-file=.env.local scripts/members.mjs add teddy@example.com lecturer "Teddy Andambi" --course BI-Apr-26 --group demo1
node --env-file=.env.local scripts/members.mjs add njoroge@example.com hod "Dr. N. Njoroge" --group demo1
```

Sign in as any one of them and the header shows all three roles; clicking one switches the whole view, including which account's real data you're looking at. Accounts without a shared `--group` don't get the switcher — the pilot's real student, lecturer and HoD accounts should stay ungrouped so this stays a demo-only convenience.

### Demo data

To give the demo accounts something to show, seed the Power BI course:

```bash
node --env-file=.env.local scripts/seed-demo.mjs
```

It puts the demo student, lecturer and HoD (the accounts named at the top of the script) in demo group `demo1`, switches on the course's synthetic class and sets it to week 6. It then gives the demo student a few weeks of progress, a chat and two questions (one answered), and gives the lecturer open questions, noted misconceptions, course goals and an upload to approve. The HoD view shows the course as a live row beside illustrative ones. Run it again to reset the demo to that starting point; real students' work is never touched.

## Three modules

| Role | Features |
|---|---|
| Student | AI companion (S1–S13), topic progress, gap detection, study path, flag to lecturer |
| Lecturer | Class heatmap, session brief, per-student drill-down, content approval, Q&A inbox (L1–L12) |
| Head of Department | Cross-course overview, at-risk monitoring, CUE compliance, fairness and privacy audit (H1–H10) |
