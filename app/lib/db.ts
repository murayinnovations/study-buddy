import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  type DemoState, type ChatMessage, type SavedBrief, type TopicMastery, type Member, type ClassStudent, type Role,
  type Course, type CourseFile, type CourseSummary, initialState, welcomeChat, nextScore,
} from './demoData'
import { buildCohort, syntheticCount, TREND_HISTORY } from './cohort'
import { average } from './format'

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
const DAY = 86_400_000

export const FILE_BUCKET = 'course-files'

const DEFAULT_SUBTITLE = { student: 'Student', lecturer: 'Lecturer', hod: 'Head of Department' }

function toMember(row: any): Member {
  return {
    email: row.email, role: row.role, name: row.name, studentId: row.student_id,
    subtitle: row.subtitle || DEFAULT_SUBTITLE[row.role as Role], course: row.course ?? null,
    demoGroup: row.demo_group,
  }
}

// Members are read on every request, so keep them for a minute per server instance.
const MEMBER_TTL_MS = 60_000
const members = new Map<string, { member: Member | null; at: number }>()

export async function getMember(email: string): Promise<Member | null> {
  const key = email.toLowerCase()
  const hit = members.get(key)
  if (hit && Date.now() - hit.at < MEMBER_TTL_MS) return hit.member
  const row = check(await db().from('members').select('*').eq('email', key).maybeSingle())
  const member = row ? toMember(row) : null
  members.set(key, { member, at: Date.now() })
  return member
}

// The other role's account in the same demo group, for the one-button view switcher.
// Not cached: it's only called right after a switch, never on every request.
export async function getMemberByGroup(group: string, role: Role): Promise<Member | null> {
  const row = check(await db().from('members').select('*').eq('demo_group', group).eq('role', role).maybeSingle())
  return row ? toMember(row) : null
}

// ---- Courses ----

// A course with Curriculum AI's instructions, for the server only.
export interface CourseConfig extends Course { prompt: string }

// Courses change rarely (an import or an edit in Supabase), so keep them for a minute.
const COURSES_TTL_MS = 60_000
let coursesCache: { courses: CourseConfig[]; at: number } | null = null

export async function listCourses(): Promise<CourseConfig[]> {
  if (coursesCache && Date.now() - coursesCache.at < COURSES_TTL_MS) return coursesCache.courses
  const [rows, approved] = await Promise.all([
    db().from('courses').select('*').eq('active', true).order('position').order('code').then(check),
    db().from('materials').select('course').eq('status', 'approved').then(check),
  ])
  const withMaterials = new Set(approved.map(m => m.course as string))
  const courses: CourseConfig[] = rows.map(r => ({
    code: r.code, name: r.name, lecturer: r.lecturer, credits: r.credits, color: r.color,
    topics: Array.isArray(r.topics) ? r.topics : [],
    currentWeek: r.current_week, totalWeeks: r.total_weeks,
    starters: Array.isArray(r.starters) ? r.starters : [],
    syntheticClass: r.synthetic_class, hasMaterials: withMaterials.has(r.code),
    prompt: r.prompt,
  }))
  coursesCache = { courses, at: Date.now() }
  return courses
}

export async function getCourse(code: string): Promise<CourseConfig | null> {
  return (await listCourses()).find(c => c.code === code) ?? null
}

const toPublic = ({ prompt, ...course }: CourseConfig): Course => course

// The course a lecturer teaches. One without a course set gets the first active
// course, so a single-course pilot needs no extra setup.
export async function lecturerCourse(member: Member): Promise<CourseConfig | null> {
  const courses = await listCourses()
  return (member.course ? courses.find(c => c.code === member.course) : courses[0]) ?? null
}

// The courses a member can see.
async function visibleCourses(member: Member): Promise<CourseConfig[]> {
  if (member.role === 'lecturer') {
    const course = await lecturerCourse(member)
    return course ? [course] : []
  }
  return listCourses()
}

// ---- Loading state ----

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

// Original files behind the approved material in these courses.
async function courseFiles(codes: string[]): Promise<CourseFile[]> {
  if (codes.length === 0) return []
  const rows = check(await db().from('materials').select('id, course, title, type, file_name')
    .in('course', codes).eq('status', 'approved').not('file_path', 'is', null).order('position'))
  return rows.map(r => ({ id: r.id, course: r.course, title: r.title, type: r.type, fileName: r.file_name }))
}

export async function loadState(member: Member): Promise<DemoState> {
  if (member.role === 'student') return loadStudent(member)
  if (member.role === 'lecturer') return loadLecturer(member)
  return loadHod()
}

// Every active course, summarised from the same class the lecturer dashboards show.
// The rest of the HoD view is still illustrative.
async function loadHod(): Promise<DemoState> {
  const courses = await listCourses()
  const summaries = await Promise.all(courses.map(async (c): Promise<CourseSummary> => {
    const [students, open] = await Promise.all([
      classStudents(c),
      db().from('questions').select('id', { count: 'exact', head: true }).eq('course', c.code).is('reply', null),
    ])
    if (open.error) throw new Error(open.error.message)
    const cohort = buildCohort(students, c)
    const avg = average(cohort.map(s => s.score))
    // Matches the lecturer overview: demo history before this week for courses with a synthetic class.
    const week = c.currentWeek ?? c.totalWeeks ?? 1
    const history = syntheticCount(c) > 0 && week > 1 ? TREND_HISTORY.slice(-(week - 1)) : []
    return {
      code: c.code, name: c.name, lecturer: c.lecturer, students: cohort.length,
      active: cohort.filter(s => s.daysAgo <= 7).length, avg,
      atRisk: cohort.filter(s => s.status === 'Critical' || s.status === 'At risk').length,
      questions: open.count ?? 0, trend: [...history, avg],
    }
  }))
  return { ...initialState(), courses: courses.map(toPublic), summaries }
}

// Gives the student a mastery row for every topic and a welcome chat in every
// course they don't have yet, so courses and topics added later just appear.
async function syncStudent(member: Member, courses: CourseConfig[], mastery: any[], chats: any[]) {
  const sid = member.studentId!
  const have = new Set(mastery.map(m => `${m.course}\n${m.topic}`))
  const newTopics = courses.flatMap(c => c.topics
    .map((t, i) => ({ student_id: sid, course: c.code, topic: t.topic, position: i, score: 0, sessions: 0, week: t.week ?? null, practised_at: null }))
    .filter(t => !have.has(`${t.course}\n${t.topic}`)))
  const chatCourses = new Set(chats.map(c => c.course))
  const newChats = courses.filter(c => !chatCourses.has(c.code))
    .map(c => ({ student_id: sid, course: c.code, messages: welcomeChat(c.name, member) }))
  const opts = { ignoreDuplicates: true }
  await Promise.all([
    newTopics.length && db().from('mastery').upsert(newTopics, opts).then(check),
    newChats.length && db().from('chats').upsert(newChats, opts).then(check),
  ])
  return newTopics.length > 0 || newChats.length > 0
}

async function loadStudent(member: Member, synced = false): Promise<DemoState> {
  const sid = member.studentId!
  const courses = await listCourses()
  const codes = courses.map(c => c.code)
  const [mastery, practice, chats, questions, files] = await Promise.all([
    db().from('mastery').select('*').eq('student_id', sid).in('course', codes).then(check),
    db().from('practice_log').select('course, topic, correct, created_at').eq('student_id', sid).in('course', codes).order('created_at').then(check),
    db().from('chats').select('course, messages').eq('student_id', sid).in('course', codes).then(check),
    db().from('questions').select('*').eq('student_id', sid).in('course', codes).order('created_at', { ascending: false }).then(check),
    courseFiles(codes),
  ])

  if (!synced && await syncStudent(member, courses, mastery, chats)) return loadStudent(member, true)

  // In the course's current topic order; topics since removed from the course are left out.
  const byCourse: Record<string, TopicMastery[]> = {}
  for (const c of courses) {
    const rows = new Map(mastery.filter(m => m.course === c.code).map(m => [m.topic, m]))
    byCourse[c.code] = c.topics.flatMap(t => {
      const row = rows.get(t.topic)
      return row ? [{ ...toMastery(row), week: t.week }] : []
    })
  }

  return {
    ...initialState(),
    courses: courses.map(toPublic),
    files,
    mastery: byCourse,
    practiceLog: practice.map(p => ({ course: p.course, topic: p.topic, correct: p.correct, at: ms(p.created_at)! })),
    chats: Object.fromEntries(chats.map(c => [c.course, c.messages as ChatMessage[]])),
    questions: questions.map(toQuestion),
  }
}

async function loadLecturer(member: Member): Promise<DemoState> {
  const config = await lecturerCourse(member)
  if (!config) return initialState()
  const course = config.code
  const [questions, misconceptions, materials, goals, approvals, checkIns, briefs, students, files] = await Promise.all([
    db().from('questions').select('*').eq('course', course).order('created_at', { ascending: false }).then(check),
    db().from('misconceptions').select('*').eq('course', course).order('created_at', { ascending: false }).limit(30).then(check),
    // Not the text: it can run to hundreds of thousands of characters and the page never shows it.
    db().from('materials').select('id, course, title, type, topics, status, source, file_name, created_at')
      // Lecturer uploads (which may need approving) before the imported platform material.
      .eq('course', course).order('source').order('position').order('created_at').then(check),
    db().from('goals').select('*').eq('course', course).order('created_at').then(check),
    db().from('practice_approvals').select('practice_id').eq('course', course).then(check),
    db().from('check_ins').select('student_id').eq('course', course).then(check),
    db().from('briefs').select('*').eq('course', course).then(check),
    classStudents(config),
    courseFiles([course]),
  ])

  return {
    ...initialState(),
    courses: [toPublic(config)],
    files,
    questions: questions.map(toQuestion),
    misconceptions: misconceptions.map(m => ({ id: m.id, course: m.course, topic: m.topic, note: m.note, at: m.at_label ?? ms(m.created_at)! })),
    uploads: materials.map(u => ({
      id: u.id, course: u.course, title: u.title, type: u.type, topics: u.topics, status: u.status,
      source: u.source, fileName: u.file_name, uploadedAt: ms(u.created_at)!,
    })),
    goals: goals.map(g => ({ id: g.id, goal: g.goal, week: g.week, mapped: g.mapped })),
    approvedPracticeIds: approvals.map(a => a.practice_id),
    checkIns: checkIns.map(c => c.student_id),
    briefs: Object.fromEntries(briefs.map(b => [b.course, { items: b.items, generatedAt: ms(b.generated_at)!, signature: b.signature }])),
    students,
  }
}

// Signed-up students who have opened Curriculum AI, with their progress in the course.
async function classStudents(course: Course): Promise<ClassStudent[]> {
  const ids = check(await db().from('members').select('student_id').eq('role', 'student')).map(m => m.student_id as string)
  if (ids.length === 0) return []
  const [mastery, practice] = await Promise.all([
    db().from('mastery').select('*').eq('course', course.code).in('student_id', ids).order('position').then(check),
    db().from('practice_log').select('student_id, created_at').eq('course', course.code).in('student_id', ids).then(check),
  ])
  const topics = new Set(course.topics.map(t => t.topic))
  const byStudent = new Map<string, ClassStudent>()
  for (const m of mastery) {
    if (!topics.has(m.topic)) continue
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

// ---- Changes from the browser ----

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

// The course a change applies to, if the member may make it: students in any
// active course, lecturers in the course they teach. null means not allowed.
export async function allowedCourse(member: Member, a: StoreAction): Promise<CourseConfig | 'none' | null> {
  if (member.role === 'student') {
    if (!STUDENT_ACTIONS.has(a.type)) return null
    if (!('course' in a)) return 'none'
    return (await getCourse(a.course)) ?? null
  }
  if (member.role === 'lecturer') {
    if (STUDENT_ACTIONS.has(a.type)) return null
    const course = await lecturerCourse(member)
    if (!course) return null
    return !('course' in a) || a.course === course.code ? course : null
  }
  return null
}

// Applies a change the member is allowed to make, in the course allowedCourse returned.
export async function applyAction(member: Member, a: StoreAction, config: CourseConfig | 'none') {
  const now = new Date().toISOString()
  const sid = member.studentId!
  const course = config === 'none' ? '' : config.code
  switch (a.type) {
    // Students: their own work only.
    case 'setChat':
      return check(await db().from('chats').upsert({ student_id: sid, course, messages: a.messages, updated_at: now }))
    case 'clearChat':
      return check(await db().from('chats').upsert({ student_id: sid, course, messages: welcomeChat((config as CourseConfig).name, member), updated_at: now }))
    case 'recordPractice': {
      const row = check(await db().from('mastery').select('score, sessions')
        .match({ student_id: sid, course, topic: a.topic }).maybeSingle())
      if (!row) return
      await Promise.all([
        db().from('mastery').update({
          score: nextScore(row.score, a.correct), sessions: row.sessions + (a.countSession ? 1 : 0), practised_at: now,
        }).match({ student_id: sid, course, topic: a.topic }).then(check),
        db().from('practice_log').insert({ student_id: sid, course, topic: a.topic, correct: a.correct }).then(check),
      ])
      return
    }
    case 'noteMisconception':
      return check(await db().from('misconceptions').insert({ id: a.id, course, topic: a.topic, note: a.note }))
    case 'askLecturer':
      return check(await db().from('questions').insert({
        id: a.id, course, student_id: sid, topic: a.topic, urgency: a.urgency, question: a.question, context: a.context,
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
      // Imported platform material is managed by scripts/import-course.mjs, not from the page.
      return check(await db().from('materials').delete().match({ id: a.id, course, source: 'lecturer' }))
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

// ---- Material for Curriculum AI ----

export interface Material { title: string; type: string; topics: string[]; body: string }

// Lecturer additions are capped so a large upload can't blow up every request.
const MAX_EXTRA_MATERIALS = 10
const MAX_EXTRA_CHARS = 80_000

// What Curriculum AI answers from. notes: the approved course material from the
// university's platform, in course order, which rarely changes and is cached as
// one block. extra: approved lecturer uploads, then replies saved to the course.
export async function courseMaterials(course: string): Promise<{ notes: Material[]; extra: Material[] }> {
  const [materials, answers] = await Promise.all([
    db().from('materials').select('title, type, topics, body, source').match({ course, status: 'approved' })
      .order('position').order('created_at').order('id').then(check),
    db().from('questions').select('topic, question, reply').match({ course, saved_to_course: true }).not('reply', 'is', null).order('replied_at').then(check),
  ])
  const toMaterial = (m: any): Material => ({ title: m.title, type: m.type, topics: m.topics, body: m.body })
  const extra: Material[] = [
    ...materials.filter(m => m.source === 'lecturer').map(toMaterial),
    ...answers.map(q => ({
      title: `Lecturer answer — ${q.topic}`,
      type: 'Lecturer answer',
      topics: [q.topic],
      body: `Student question: ${q.question}\n\nLecturer's answer: ${q.reply}`,
    })),
  ]
  let total = 0
  return {
    notes: materials.filter(m => m.source === 'platform' && m.body.trim()).map(toMaterial),
    extra: extra.slice(0, MAX_EXTRA_MATERIALS).filter(m => (total += m.body.length) <= MAX_EXTRA_CHARS),
  }
}

// ---- Original files ----

// A short-lived download link for a material's original file, if the member can see its course.
export async function fileLink(member: Member, id: string): Promise<string | null> {
  const row = check(await db().from('materials').select('course, file_path, file_name, status').eq('id', id).maybeSingle())
  if (!row?.file_path || row.status !== 'approved') return null
  if (!(await visibleCourses(member)).some(c => c.code === row.course)) return null
  const { data, error } = await db().storage.from(FILE_BUCKET).createSignedUrl(row.file_path, 300, { download: row.file_name || true })
  if (error) throw new Error(error.message)
  return data.signedUrl
}
