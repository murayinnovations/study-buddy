# Study Buddy — demo script: the learner profile

About 8 minutes. Shows that every learner gets a cognitive profile at onboarding, and that Study Buddy's practice follows it. The same steps are in the in-app guide (the **Guide** button, shown to demo-group accounts).

## Before you start

1. Run `supabase/schema.sql` in the Supabase SQL Editor, so the `cognitive_profiles` table exists. Until it does, nobody is sent to the assessment.
2. Open two browser windows, one of them private. Have two new email addresses ready, for Learner A and Learner B. With **Confirm email** on in Supabase, each needs its confirmation link opened first; for a demo it is quicker to turn it off.
3. Send one test chat message from an existing student account so the course notes are cached. The first reply takes 15 to 20 seconds; later ones are faster.
4. Have the lecturer account's sign-in ready.

## 1. Learner A takes the assessment (2 minutes)

**Say:** "Every learner starts with a 12-minute assessment, so Study Buddy knows how to teach them."

1. In window 1, sign up as Learner A.
2. Accept the consent screen.
3. Course questions: get the easy ones right and the harder ones wrong, and rate yourself "Unsure" or "Guessing".
4. Memory: recall 3 or 4 digits, then miss two rounds.
5. Reading: answer normally.
6. About you: 20-minute sessions, "Seeing a worked example first".
7. Show the profile card: Foundation start, short sections.

## 2. Learner A practises (1 minute)

**Say:** "Same course, pitched for her."

Click **Start a session** on a topic. Point out the 3-question set, asked one at a time, in plain wording. Answer one question to show the mastery score move.

## 3. Learner B (2 minutes)

**Say:** "A learner with more experience gets a different profile."

1. In window 2 (the header switcher swaps roles, not students), sign up as Learner B.
2. Answer the course questions well, rating yourself "Certain" even on one you get wrong. Recall 6 or 7 digits. Choose 40-minute sessions.
3. Show the profile card, then **Start a session** on the same topic.

Compare with window 1: a longer, harder set, and if B came out over-confident, Study Buddy asks how sure they were before saying whether an answer is right.

## 4. The lecturer (1 minute)

Sign in as the lecturer. Open **Individual students**: both learners appear as live students with their topic scores.

## 5. Close

**Say:** "Every learner gets a profile on day one, and every practice set is pitched to it. Next: quiz and flashcard screens and impact reports on the same profile."

**Retake** in a learner's Your Progress panel runs the assessment again.

## What is real

- The assessment, its scoring and the profile are live and saved in Supabase (`cognitive_profiles`, newest row per student).
- The profile is sent to Study Buddy with each chat, after the course notes. It sets the starting level, practice set size, wording, pacing and the confidence check.
- Course questions exist for the Power BI course only. Other courses use the learner's own rating of how familiar they are.
- Lecturer dashboards can include 30 synthetic students for a course with `synthetic_class` set. Turn it off on the demo course to show only real learners.
