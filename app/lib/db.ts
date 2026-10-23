import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { COURSES } from '../components/student/studentData'
import {
  type DemoState, type ChatMessage, type SavedBrief, type TopicMastery, type Member, type ClassStudent, type Role,
  PILOT_COURSE, SEED_QUESTIONS, SEED_MISCONCEPTIONS, SEED_GOALS, SEED_APPROVED_PRACTICE,
  initialState, startingMastery, welcomeChat, nextScore,
} from './demoData'
import type { Material } from './materials'

// Server-side database access. Uses the secret key, so import this from API
// routes and server components only, never from client components. Callers
// pass the signed-in member, and everything here is scoped to them.

let client: SupabaseClient | null = null

export function hasDatabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
}

function db() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next 14 caches fetch in route handlers by default; state must always be fresh.
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

const DEFAULT_SUBTITLE = { student: 'Student', lecturer: 'SBS 201 · Financial Accounting', hod: 'Head of Department' }

// Members are read on every request, so keep them for a minute per server instance.
const MEMBER_TTL_MS = 60_000
const members = new Map<string, { member: Member | null; at: number }>()

export async function getMember(email: string): Promise<Member | null> {
  const key = email.toLowerCase()
  const hit = members.get(key)
  if (hit && Date.now() - hit.at < MEMBER_TTL_MS) return hit.member
  const row = check(await db().from('members').select('*').eq('email', key).maybeSingle())
  const member: Member | null = row && {
    email: row.email, role: row.role, name: row.name, studentId: row.student_id,
    subtitle: row.subtitle || DEFAULT_SUBTITLE[row.role as Member['role']], sampleData: row.sample_data,
    demoGroup: row.demo_group,
  }
  members.set(key, { member, at: Date.now() })
  return member
}

// The other role's account in the same demo group, for the one-button view switcher.
// Not cached: it's only called right after a switch, never on every request.
export async function getMemberByGroup(group: string, role: Role): Promise<Member | null> {
  const row = check(await db().from('members').select('*').eq('demo_group', group).eq('role', role).maybeSingle())
  return row && {
    email: row.email, role: row.role, name: row.name, studentId: row.student_id,
    subtitle: row.subtitle || DEFAULT_SUBTITLE[row.role as Member['role']], sampleData: row.sample_data,
    demoGroup: row.demo_group,
  }
}

// The course's starting questions, misconceptions, goals and approvals.
// Upserts that ignore existing rows, so running it again is harmless.
let courseSeeded: Promise<unknown> | null = null

function seedCourse() {
  const opts = { ignoreDuplicates: true }
  courseSeeded ??= Promise.all([
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
  ]).catch(err => { courseSeeded = null; throw err })
  return courseSeeded
}

// A student's first visit: their topics and a welcome chat in every course.
async function seedStudent(member: Member) {
  const studentId = member.studentId!
  const masteryRows = Object.entries(startingMastery(member.sampleData)).flatMap(([course, topics]) =>
    topics.map((t, i) => ({
      student_id: studentId, course, topic: t.topic, position: i, score: t.score, sessions: t.sessions,
      week: t.week ?? null, practised_at: t.daysAgo === null ? null : ago(t.daysAgo * DAY),
    })))
  const opts = { ignoreDuplicates: true }
  await Promise.all([
    db().from('mastery').upsert(masteryRows, opts).then(check),
    db().from('chats').upsert(COURSES.map(c => ({ student_id: studentId, course: c.code, messages: welcomeChat(c.code, member) })), opts).then(check),
  ])
}

function toMastery(m: { topic: string; score: number; sessions: number; week: number | null; practised_at: string | null }): TopicMastery {
  return {
    topic: m.topic, score: m.score, sessions: m.sessions, week: m.week ?? undefined,
    daysAgo: m.practised_at ? Math.floor((Date.now() - ms(m.practised_at)!) / DAY) : null,
  }
}

function toQuestion(q: any) {
  return {
    id: q.id, course: q.course, studentId: q.student_id, topic: q.topic, urgency: q.urgency,
    question: q.question, context: q.context, askedAt: q.asked_label ?? ms(q.created_at)!,
    reply: q.reply ?? undefined, repliedAt: ms(q.replied_at), savedToCourse: q.saved_to_course, seenByStudent: q.seen_by_student,
  }
}

export async function loadState(member: Member): Promise<DemoState> {
  if (member.role === 'student') return loadStudent(member)
  if (member.role === 'lecturer') return loadLecturer()
  return initialState()   // The HoD view uses illustrative data only.
}

async function loadStudent(member: Member): Promise<DemoState> {
  const sid = member.studentId!
  const [mastery, practice, chats, questions] = await Promise.all([
    db().from('mastery').select('*').eq('student_id', sid).order('position').then(check),
    db().from('practice_log').select('course, topic, correct, created_at').eq('student_id', sid).order('created_at').then(check),
    db().from('chats').select('course, messages').eq('student_id', sid).then(check),
    db().from('questions').select('*').eq('student_id', sid).order('created_at', { ascending: false }).then(check),
  ])

  if (mastery.length === 0) {
    await seedStudent(member)
    return loadStudent(member)
  }

  const byCourse: Record<string, TopicMastery[]> = {}
  for (const m of mastery) (byCourse[m.course] ??= []).push(toMastery(m))

  return {
    ...initialState(),
    mastery: byCourse,
    practiceLog: practice.map(p => ({ course: p.course, topic: p.topic, correct: p.correct, at: ms(p.created_at)! })),
    chats: Object.fromEntries(chats.map(c => [c.course, c.messages as ChatMessage[]])),
    questions: questions.map(toQuestion),
  }
}

async function loadLecturer(): Promise<DemoState> {
  await seedCourse()
  const course = PILOT_COURSE
  const [questions, misconceptions, materials, goals, approvals, checkIns, briefs, students] = await Promise.all([
    db().from('questions').select('*').eq('course', course).order('created_at', { ascending: false }).then(check),
    db().from('misconceptions').select('*').eq('course', course).order('created_at', { ascending: false }).limit(30).then(check),
    db().from('materials').select('*').eq('course', course).order('created_at').then(check),
    db().from('goals').select('*').eq('course', course).order('created_at').then(check),
    db().from('practice_approvals').select('practice_id').eq('course', course).then(check),
    db().from('check_ins').select('student_id').eq('course', course).then(check),
    db().from('briefs').select('*').eq('course', course).then(check),
    classStudents(course),
  ])

  return {
    ...initialState(),
    questions: questions.map(toQuestion),
    misconceptions: misconceptions.map(m => ({ id: m.id, course: m.course, topic: m.topic, note: m.note, at: m.at_label ?? ms(m.created_at)! })),
    uploads: materials.map(u => ({
      id: u.id, course: u.course, title: u.title, type: u.type, topics: u.topics, body: u.body, status: u.status, uploadedAt: ms(u.created_at)!,
    })),
    goals: goals.map(g => ({ id: g.id, goal: g.goal, week: g.week, mapped: g.mapped })),
    approvedPracticeIds: approvals.map(a => a.practice_id),
    checkIns: checkIns.map(c => c.student_id),
    briefs: Object.fromEntries(briefs.map(b => [b.course, { items: b.items, generatedAt: ms(b.generated_at)!, signature: b.signature }])),
    students,
  }
}

// Signed-up students who have opened Curriculum AI, with their progress in the course.
async function classStudents(course: string): Promise<ClassStudent[]> {
  const ids = check(await db().from('members').select('student_id').eq('role', 'student')).map(m => m.student_id as string)
  if (ids.length === 0) return []
  const [mastery, practice] = await Promise.all([
    db().from('mastery').select('*').eq('course', course).in('student_id', ids).order('position').then(check),
    db().from('practice_log').select('student_id, created_at').eq('course', course).in('student_id', ids).then(check),
  ])
  const byStudent = new Map<string, ClassStudent>()
  for (const m of mastery) {
    const s = byStudent.get(m.student_id) ?? { id: m.student_id, mastery: [], practiceCount: 0, lastActive: null }
    s.mastery.push(toMastery(m))
    const at = ms(m.practised_at) ?? null
    if (at !== null && (s.lastActive === null || at > s.lastActive)) s.lastActive = at
    byStudent.set(m.student_id, s)
  }
  for (const p of practice) {
    const s = byStudent.get(p.student_id)
    if (s) s.practiceCount++
  }
  return Array.from(byStudent.values())
}

// One change from the browser. Shapes are validated by the route.
export type StoreAction =
  | { type: 'setChat'; course: string; messages: ChatMessage[] }
  | { type: 'clearChat'; course: string }
  | { type: 'recordPractice'; course: string; topic: string; correct: boolean; countSession: boolean }
  | { type: 'noteMisconception'; id: string; course: string; topic: string; note: string }
  | { type: 'askLecturer'; id: string; course: string; topic: string; urgency: 'High' | 'Medium' | 'Low'; question: string; context: string }
  | { type: 'markRepliesSeen' }
  | { type: 'replyToQuestion'; id: string; reply: string }
  | { type: 'saveAnswerToCourse'; id: string }
  | { type: 'uploadMaterial'; id: string; course: string; title: string; materialType: string; topics: string[]; body: string }
  | { type: 'approveMaterial'; id: string }
  | { type: 'removeMaterial'; id: string }
  | { type: 'addGoal'; id: string; goal: string; week: string }
  | { type: 'mapGoal'; id: string }
  | { type: 'approvePractice'; id: number }
  | { type: 'saveBrief'; course: string; brief: SavedBrief }
  | { type: 'sendCheckIn'; studentId: string }

const STUDENT_ACTIONS = new Set(['setChat', 'clearChat', 'recordPractice', 'noteMisconception', 'askLecturer', 'markRepliesSeen'])

export function mayApply(member: Member, a: StoreAction) {
  if (member.role === 'student') return STUDENT_ACTIONS.has(a.type)
  if (member.role === 'lecturer') return !STUDENT_ACTIONS.has(a.type) && (!('course' in a) || a.course === PILOT_COURSE)
  return false
}

// Applies a change the member is allowed to make (check mayApply first).
export async function applyAction(member: Member, a: StoreAction) {
  const now = new Date().toISOString()
  const sid = member.studentId!
  const course = PILOT_COURSE
  switch (a.type) {
    // Students: their own work only.
    case 'setChat':
      return check(await db().from('chats').upsert({ student_id: sid, course: a.course, messages: a.messages, updated_at: now }))
    case 'clearChat':
      return check(await db().from('chats').upsert({ student_id: sid, course: a.course, messages: welcomeChat(a.course, member), updated_at: now }))
    case 'recordPractice': {
      const row = check(await db().from('mastery').select('score, sessions')
        .match({ student_id: sid, course: a.course, topic: a.topic }).maybeSingle())
      if (!row) return
      await Promise.all([
        db().from('mastery').update({
          score: nextScore(row.score, a.correct), sessions: row.sessions + (a.countSession ? 1 : 0), practised_at: now,
        }).match({ student_id: sid, course: a.course, topic: a.topic }).then(check),
        db().from('practice_log').insert({ student_id: sid, course: a.course, topic: a.topic, correct: a.correct }).then(check),
      ])
      return
    }
    case 'noteMisconception':
      return check(await db().from('misconceptions').insert({ id: a.id, course: a.course, topic: a.topic, note: a.note }))
    case 'askLecturer':
      return check(await db().from('questions').insert({
        id: a.id, course: a.course, student_id: sid, topic: a.topic, urgency: a.urgency, question: a.question, context: a.context,
      }))
    case 'markRepliesSeen':
      return check(await db().from('questions').update({ seen_by_student: true }).eq('student_id', sid).not('reply', 'is', null))

    // Lecturers: their course only.
    case 'replyToQuestion':
      return check(await db().from('questions').update({ reply: a.reply, replied_at: now, seen_by_student: false }).match({ id: a.id, course }))
    case 'saveAnswerToCourse':
      return check(await db().from('questions').update({ saved_to_course: true }).match({ id: a.id, course }))
    case 'uploadMaterial':
      return check(await db().from('materials').insert({
        id: a.id, course, title: a.title, type: a.materialType, topics: a.topics, body: a.body,
      }))
    case 'approveMaterial':
      return check(await db().from('materials').update({ status: 'approved' }).match({ id: a.id, course }))
    case 'removeMaterial':
      return check(await db().from('materials').delete().match({ id: a.id, course }))
    case 'addGoal':
      return check(await db().from('goals').insert({ id: a.id, course, goal: a.goal, week: a.week }))
    case 'mapGoal':
      return check(await db().from('goals').update({ mapped: true }).match({ id: a.id, course }))
    case 'approvePractice':
      return check(await db().from('practice_approvals').upsert({ course, practice_id: a.id }, { ignoreDuplicates: true }))
    case 'saveBrief':
      return check(await db().from('briefs').upsert({
        course, items: a.brief.items, generated_at: new Date(a.brief.generatedAt).toISOString(), signature: a.brief.signature,
      }))
    case 'sendCheckIn':
      return check(await db().from('check_ins').upsert({ course, student_id: a.studentId }, { ignoreDuplicates: true }))
  }
}

// Materials the lecturer added that Curriculum AI should now use: approved uploads,
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
