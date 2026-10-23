# Curriculum AI — 5-minute demo script

For a live demo to Strathmore staff. One presenter, one laptop, the browser full screen.

## Before you start

1. Make three accounts in the same demo group (see Switching views with one click in the README): a student added with `--sample` so she starts from Sara's progress, a lecturer and a Head of Department. Use a new student number for each demo, so rehearsal activity doesn't carry over.
2. Sign in as any one of the three — the header now shows a **Student / Lecturer / Head of Department** switcher, so the whole demo runs in one window. Sign-in links are emailed, so do this before the audience arrives.
3. Check the chat works: send one message in SBS 201, then click **New chat**.
4. Have a short `.md` file ready to upload, for example a one-page note on "Disposals: common mistakes".
5. Check the venue Wi-Fi reaches Curriculum AI: the test message in step 3 should answer within about 20 seconds. Have a phone hotspot ready as a backup.
6. Know what is real and what isn't (see the last section), in case someone asks.

Curriculum AI's first answer in a chat takes 15–20 seconds while it reads the course notes, and later answers about 10. The tutorial brief takes 20–30 seconds. The screen says what Curriculum AI is doing; talk the audience through it rather than waiting in silence.

## 1. The student (2 minutes)

**Say:** "This is Sara, a second-year BCom student. Curriculum AI is her study companion for each course."

1. Point at the sidebar: courses with mastery rings, and **Curriculum AI suggests** pointing at her weakest topic, Depreciation (38%).
2. Click **Start a session →**. Curriculum AI checks what she knows before teaching.
3. Ask: *"Why do we subtract the residual value in straight-line depreciation?"*
   - **Point out the numbered sources** under the answer. "Curriculum AI answers only from the lecturer's approved notes, and shows where each point came from."
4. Click **Give me a practice question** and answer it, for example: *"(240,000 − 40,000) ÷ 4 = 50,000 a year"*.
   - **Point out the chip** under Curriculum AI's feedback ("Depreciation: 38% → 54%") and the progress panel updating.
5. Click **Ask lecturer**. Show that the question arrives with context: mastery, practice attempts, any misconception Curriculum AI noticed. Send it.

## 2. The lecturer (2 minutes)

Click **Lecturer** in the header switcher.

**Say:** "This is Prof. Mwangi's view of the whole class. Sara is a real signed-in student; the other 30 are a synthetic class for the demo."

1. **Class overview:** the heatmap shows which topics the class is struggling with. Click **Draft with Curriculum AI** to turn it into a plan for the next tutorial.
2. **Individual students:** Sara is marked **● Live**. Click her row to show her topic scores, which include the practice question she just answered.
3. **Student questions:** Sara's question is at the top with Curriculum AI's context. Type a short reply and send it, then click **Save answer to course material**.
   - "From now on Curriculum AI uses this answer for every SBS 201 student."
4. **Content & approval:** click **Upload material**, add the prepared note, and show it sitting as **Pending review**. Click **Approve**. "Nothing reaches students until the lecturer approves it."

## 3. Back to the student (1 minute)

Click **Student** in the header switcher. The sidebar shows **Lecturer replies · 1 new**. Open it to show Prof. Mwangi's answer.

Then click **New chat** and ask the same question again, for example *"Why is residual value subtracted in straight-line but not in reducing balance?"*. One of the sources under Curriculum AI's answer is now **Lecturer answer — Depreciation**. "One student asked, the lecturer answered once, and now Curriculum AI teaches it to every student."

## 4. Head of Department (30 seconds)

Click **Head of Department** in the header switcher.

**Say:** "This is what the department dashboard will report during the pilot: engagement and at-risk students across courses, and CUE compliance. It's illustrative today; the numbers become real once the pilot runs."

## What's real and what isn't

| Real in the demo | Illustrative or synthetic |
|---|---|
| Curriculum AI's answers, citations and practice marking (live Claude calls) | The 30 other students in SBS 201 |
| Mastery changes from practice questions | Weeks 1–8 of the comprehension trend |
| Ask lecturer → inbox → reply → saved to course material | The whole Head of Department view |
| Material upload and approval | Course notes are sample material written for the demo |
| The tutorial brief Curriculum AI drafts | Check-in messages are recorded but not delivered |

Everyone signs in, and everything is saved in Supabase, so the Lecturer view shows the student's activity within a few seconds.

## If something goes wrong

- **Curriculum AI doesn't answer:** click **↻ Try again** under the message. If it fails again, check the connection (switch to the hotspot) and the API key in `.env.local` or the Vercel settings, and carry on with the lecturer view, which works without Curriculum AI.
- **Leftover data from a rehearsal:** add a new student account with `--sample` and sign in as them. Replies and saved answers from rehearsals stay in the lecturer's inbox.
- **"No access yet" after signing in:** the email isn't on the members list; add it and sign in again.
