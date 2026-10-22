import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { STUDENT, TOPIC_PROGRESS, COURSES } from '../components/student/studentData'
import {
  type DemoState, type ChatMessage, type SavedBrief, type TopicMastery,
  PILOT_COURSE, SEED_QUESTIONS, SEED_MISCONCEPTIONS, SEED_GOALS, SEED_APPROVED_PRACTICE,
  welcomeChat, nextScore,
} from './demoData'
import type { Material } from './materials'

// Server-side access to the demo database. Uses the secret key, so import this
// from API routes only, never from components.

let client: SupabaseClient | null = null

export function hasDatabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
}

function db() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next 14 caches fetch in route handlers by default; demo state must always be fresh.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })
  return client
}

// Supabase returns errors instead of throwing; turn them into exceptions.
function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data
}

const ms = (t: string | null) => (t ? new Date(t).getTime() : undefined)
const ago = (ageMs: number) => new Date(Date.now() - ageMs).toISOString()
const HOUR = 3_600_000
const DAY = 24 * HOUR

// Writes the seed rows. Upserts that ignore existing rows, so running it twice is harmless.
async function seed() {
  const masteryRows = Object.entries(TOPIC_PROGRESS).flatMap(([course, topics]) =>
    topics.map((t, i) => ({
      student_id: STUDENT.id, course, topic: t.topic, position: i, score: t.score, sessions: t.sessions,
      week: t.week ?? null, practised_at: t.daysAgo === null ? null : ago(t.daysAgo * DAY),
    })))
  const opts = { ignoreDuplicates: true }
  await Promise.all([
    db().from('mastery').upsert(masteryRows, opts).then(check),
    db().from('chats').upsert(COURSES.map(c => ({ student_id: STUDENT.id, course: c.code, messages: welcomeChat(c.code) })), opts).then(check),
    db().from('questions').upsert(SEED_QUESTIONS.map(q => ({
      id: q.id, course: q.course, student_id: q.studentId, topic: q.topic, urgency: q.urgency, question: q.question,
      context: q.context, asked_label: q.askedAt as string, created_at: ago(q.ageMs),
      reply: q.reply ?? null, replied_at: q.reply ? ago(q.ageMs / 2) : null, seen_by_student: q.seenByStudent ?? false,
    })), opts).then(check),
    db().from('misconceptions').upsert(SEED_MISCONCEPTIONS.map(m => ({
      id: m.id, course: m.course, topic: m.topic, note: m.note, at_label: m.at as string, created_at: ago(m.ageMs),
    })), opts).then(check),
    db().from('goals').upsert(SEED_GOALS.map((g, i) => ({ ...g, course: PILOT_COURSE, created_at: ago((10 - i) * HOUR) })), opts).then(check),
    db().from('practice_approvals').upsert(SEED_APPROVED_PRACTICE.map(id => ({ course: PILOT_COURSE, practice_id: id })), opts).then(check),
  ])
}

export async function resetDemo() {
  check(await db().rpc('reset_demo_data'))
  await seed()
}

export async function loadState(): Promise<DemoState> {
  const [mastery, practice, chats, questions, misconceptions, materials, goals, approvals, checkIns, briefs] = await Promise.all([
    db().from('mastery').select('*').eq('student_id', STUDENT.id).order('position').then(check),
    db().from('practice_log').select('course, topic, correct, created_at').eq('student_id', STUDENT.id).order('created_at').then(check),
    db().from('chats').select('course, messages').eq('student_id', STUDENT.id).then(check),
    db().from('questions').select('*').order('created_at', { ascending: false }).then(check),
    db().from('misconceptions').select('*').order('created_at', { ascending: false }).limit(30).then(check),
    db().from('materials').select('*').order('created_at').then(check),
    db().from('goals').select('*').order('created_at').then(check),
    db().from('practice_approvals').select('practice_id').then(check),
    db().from('check_ins').select('student_id').then(check),
    db().from('briefs').select('*').then(check),
  ])

  // First visit to a fresh database: seed it, then read again.
  if (mastery.length === 0) {
    await seed()
    return loadState()
  }

  const byCourse: Record<string, TopicMastery[]> = {}
  for (const m of mastery) {
    (byCourse[m.course] ??= []).push({
      topic: m.topic, score: m.score, sessions: m.sessions, week: m.week ?? undefined,
      daysAgo: m.practised_at ? Math.floor((Date.now() - ms(m.practised_at)!) / DAY) : null,
    })
  }

  return {
    mastery: byCourse,
    practiceLog: practice.map(p => ({ course: p.course, topic: p.topic, correct: p.correct, at: ms(p.created_at)! })),
    chats: Object.fromEntries(chats.map(c => [c.course, c.messages as ChatMessage[]])),
    questions: questions.map(q => ({
      id: q.id, course: q.course, studentId: q.student_id, topic: q.topic, urgency: q.urgency,
      question: q.question, context: q.context, askedAt: q.asked_label ?? ms(q.created_at)!,
      reply: q.reply ?? undefined, repliedAt: ms(q.replied_at), savedToCourse: q.saved_to_course, seenByStudent: q.seen_by_student,
    })),
    misconceptions: misconceptions.map(m => ({ id: m.id, course: m.course, topic: m.topic, note: m.note, at: m.at_label ?? ms(m.created_at)! })),
    uploads: materials.map(u => ({
      id: u.id, course: u.course, title: u.title, type: u.type, topics: u.topics, body: u.body, status: u.status, uploadedAt: ms(u.created_at)!,
    })),
    goals: goals.map(g => ({ id: g.id, goal: g.goal, week: g.week, mapped: g.mapped })),
    approvedPracticeIds: approvals.map(a => a.practice_id),
    checkIns: checkIns.map(c => c.student_id),
    briefs: Object.fromEntries(briefs.map(b => [b.course, { items: b.items, generatedAt: ms(b.generated_at)!, signature: b.signature }])),
  }
}

// One change from the browser. Shapes are validated by the route.
export type StoreAction =
  | { type: 'reset' }
  | { type: 'setChat'; course: string; messages: ChatMessage[] }
  | { type: 'clearChat'; course: string }
  | { type: 'recordPractice'; course: string; topic: string; correct: boolean; countSession: boolean }
  | { type: 'noteMisconception'; id: string; course: string; topic: string; note: string }
  | { type: 'askLecturer'; id: string; course: string; topic: string; urgency: 'High' | 'Medium' | 'Low'; question: string; context: string }
  | { type: 'replyToQuestion'; id: string; reply: string }
  | { type: 'saveAnswerToCourse'; id: string }
  | { type: 'markRepliesSeen' }
  | { type: 'uploadMaterial'; id: string; course: string; title: string; materialType: string; topics: string[]; body: string }
  | { type: 'approveMaterial'; id: string }
  | { type: 'removeMaterial'; id: string }
  | { type: 'addGoal'; id: string; goal: string; week: string }
  | { type: 'mapGoal'; id: string }
  | { type: 'approvePractice'; id: number }
  | { type: 'saveBrief'; course: string; brief: SavedBrief }
  | { type: 'sendCheckIn'; studentId: string }

export async function applyAction(a: StoreAction) {
  const now = new Date().toISOString()
  switch (a.type) {
    case 'reset':
      return resetDemo()
    case 'setChat':
      return check(await db().from('chats').upsert({ student_id: STUDENT.id, course: a.course, messages: a.messages, updated_at: now }))
    case 'clearChat':
      return check(await db().from('chats').upsert({ student_id: STUDENT.id, course: a.course, messages: welcomeChat(a.course), updated_at: now }))
    case 'recordPractice': {
      const row = check(await db().from('mastery').select('score, sessions')
        .match({ student_id: STUDENT.id, course: a.course, topic: a.topic }).maybeSingle())
      if (!row) return
      await Promise.all([
        db().from('mastery').update({
          score: nextScore(row.score, a.correct), sessions: row.sessions + (a.countSession ? 1 : 0), practised_at: now,
        }).match({ student_id: STUDENT.id, course: a.course, topic: a.topic }).then(check),
        db().from('practice_log').insert({ student_id: STUDENT.id, course: a.course, topic: a.topic, correct: a.correct }).then(check),
      ])
      return
    }
    case 'noteMisconception':
      return check(await db().from('misconceptions').insert({ id: a.id, course: a.course, topic: a.topic, note: a.note }))
    case 'askLecturer':
      return check(await db().from('questions').insert({
        id: a.id, course: a.course, student_id: STUDENT.id, topic: a.topic, urgency: a.urgency, question: a.question, context: a.context,
      }))
    case 'replyToQuestion':
      return check(await db().from('questions').update({ reply: a.reply, replied_at: now, seen_by_student: false }).eq('id', a.id))
    case 'saveAnswerToCourse':
      return check(await db().from('questions').update({ saved_to_course: true }).eq('id', a.id))
    case 'markRepliesSeen':
      return check(await db().from('questions').update({ seen_by_student: true }).eq('student_id', STUDENT.id).not('reply', 'is', null))
    case 'uploadMaterial':
      return check(await db().from('materials').insert({
        id: a.id, course: a.course, title: a.title, type: a.materialType, topics: a.topics, body: a.body,
      }))
    case 'approveMaterial':
      return check(await db().from('materials').update({ status: 'approved' }).eq('id', a.id))
    case 'removeMaterial':
      return check(await db().from('materials').delete().eq('id', a.id))
    case 'addGoal':
      return check(await db().from('goals').insert({ id: a.id, course: PILOT_COURSE, goal: a.goal, week: a.week }))
    case 'mapGoal':
      return check(await db().from('goals').update({ mapped: true }).eq('id', a.id))
    case 'approvePractice':
      return check(await db().from('practice_approvals').upsert({ course: PILOT_COURSE, practice_id: a.id }, { ignoreDuplicates: true }))
    case 'saveBrief':
      return check(await db().from('briefs').upsert({
        course: a.course, items: a.brief.items, generated_at: new Date(a.brief.generatedAt).toISOString(), signature: a.brief.signature,
      }))
    case 'sendCheckIn':
      return check(await db().from('check_ins').upsert({ course: PILOT_COURSE, student_id: a.studentId }, { ignoreDuplicates: true }))
  }
}

// Materials the lecturer added that Arthur should now use: approved uploads,
// then replies saved to the course. Capped so a large upload can't blow up every request.
const MAX_EXTRA_MATERIALS = 10
const MAX_EXTRA_CHARS = 80_000

export async function extraMaterials(course: string): Promise<Material[]> {
  if (!hasDatabase()) return []
  const [uploads, answers] = await Promise.all([
    db().from('materials').select('title, type, topics, body').match({ course, status: 'approved' }).order('created_at').then(check),
    db().from('questions').select('topic, question, reply').match({ course, saved_to_course: true }).not('reply', 'is', null).order('replied_at').then(check),
  ])
  const all: Material[] = [
    ...uploads.map(u => ({ title: u.title, type: u.type, topics: u.topics, body: u.body })),
    ...answers.map(q => ({
      title: `Lecturer answer — ${q.topic}`,
      type: 'Lecturer answer',
      topics: [q.topic],
      body: `Student question: ${q.question}\n\nLecturer's answer: ${q.reply}`,
    })),
  ]
  let total = 0
  return all.slice(0, MAX_EXTRA_MATERIALS).filter(m => (total += m.body.length) <= MAX_EXTRA_CHARS)
}
