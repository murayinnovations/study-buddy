# Arthur — 5-minute demo script

For a live demo to Strathmore staff. One presenter, one laptop, the browser full screen.

## Before you start

1. Open the app and click **Reset demo** twice (top right). This clears anything from rehearsals.
2. Check the chat works: send one message in SBS 201, then **New chat** and **Reset demo** again.
3. Have a short `.md` file ready to upload, for example a one-page note on "Disposals: common mistakes".
4. Know what is real and what isn't (see the last section), in case someone asks.

## 1. The student (2 minutes)

**Say:** "This is Sara, a second-year BCom student. Arthur is her study companion for each course."

1. Point at the sidebar: courses with mastery rings, and **Arthur suggests** pointing at her weakest topic, Depreciation (38%).
2. Click **Start a session →**. Arthur checks what she knows before teaching.
3. Ask: *"Why do we subtract the residual value in straight-line depreciation?"*
   - **Point out the numbered sources** under the answer. "Arthur answers only from the lecturer's approved notes, and shows where each point came from."
4. Click **Give me a practice question** and answer it, for example: *"(240,000 − 40,000) ÷ 4 = 50,000 a year"*.
   - **Point out the chip** under Arthur's feedback ("Depreciation: 38% → 54%") and the progress panel updating.
5. Click **Ask lecturer**. Show that the question arrives with context: mastery, practice attempts, any misconception Arthur noticed. Send it.

## 2. The lecturer (2 minutes)

Click **Lecturer** in the top bar.

**Say:** "This is Prof. Mwangi's view of the whole class. Sara is one of 31 students; the other 30 are a synthetic class for the demo."

1. **Class overview:** the heatmap shows which topics the class is struggling with. Click **Draft with Arthur** to turn it into a plan for the next tutorial.
2. **Individual students:** Sara is marked **● Live**. Click her row to show her topic scores, which include the practice question she just answered.
3. **Student questions:** Sara's question is at the top with Arthur's context. Type a short reply and send it, then click **Save answer to course material**.
   - "From now on Arthur uses this answer for every SBS 201 student."
4. **Content & approval:** click **Upload material**, add the prepared note, and show it sitting as **Pending review**. Click **Approve**. "Nothing reaches students until the lecturer approves it."

## 3. Back to the student (30 seconds)

Click **Student**. The sidebar shows **Lecturer replies · 1 new**. Open it to show Prof. Mwangi's answer.

## 4. Head of Department (30 seconds)

Click **Head of Department**.

**Say:** "This is what the department dashboard will report during the pilot: engagement and at-risk students across courses, and CUE compliance. It's illustrative today; the numbers become real once the pilot runs."

## What's real and what isn't

| Real in the demo | Illustrative or synthetic |
|---|---|
| Arthur's answers, citations and practice marking (live Claude calls) | The 30 other students in SBS 201 |
| Mastery changes from practice questions | Weeks 1–8 of the comprehension trend |
| Ask lecturer → inbox → reply → saved to course material | The whole Head of Department view |
| Material upload and approval | Course notes are sample material written for the demo |
| The tutorial brief Arthur drafts | Check-in messages are recorded but not delivered |

Everything is saved in a shared Supabase database, so a second browser window (for example the lecturer view) shows changes within a few seconds. Sign-in comes with the trial.

## If something goes wrong

- **Arthur doesn't answer:** check the API key in `.env.local` (or Vercel settings) and try again. Switch to the pre-loaded answers in the progress panel and keep talking.
- **Leftover data from a rehearsal:** click **Reset demo** twice.
