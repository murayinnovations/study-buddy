import { TOPIC_PROGRESS, WELCOME_MESSAGES, FIRST_WELCOME, COURSES } from '../components/student/studentData'

// Shapes of the state shared by the student, lecturer and HoD views, and the
// seed data the course starts from. Used by the browser store and the database layer.

export type Role = 'student' | 'lecturer' | 'hod'

// A signed-in person, from the members table.
export interface Member {
  email: string
  role: Role
  name: string
  studentId: string | null   // students only
  subtitle: string
  sampleData: boolean        // students only: started from sample mastery
  demoGroup: string | null   // members sharing a group can switch between each other's views
}

export interface TopicMastery { topic: string; score: number; sessions: number; daysAgo: number | null; week?: number }

export interface Source { title: string; quote: string }
export interface ChatEvent { kind: 'practice'; topic: string; correct: boolean; before: number; after: number }
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  events?: ChatEvent[]
  misconceptions?: { topic: string; note: string }[]   // assistant turns: what Curriculum AI noted for the lecturer
  context?: string    // user turns: mastery snapshot sent with the message, replayed unchanged
  failed?: boolean    // assistant turns: an error placeholder, not a real reply
}

export interface LecturerQuestion {
  id: string
  course: string
  studentId: string
  topic: string
  urgency: 'High' | 'Medium' | 'Low'
  question: string
  context: string
  askedAt: number | string   // timestamp, or a fixed label for seeded questions
  reply?: string
  repliedAt?: number
  savedToCourse?: boolean
  seenByStudent?: boolean
}

export interface Misconception { id: string; course: string; topic: string; note: string; at: number | string }

export interface UploadedMaterial {
  id: string
  course: string
  title: string
  type: string
  topics: string[]
  body: string
  status: 'pending' | 'approved'
  uploadedAt: number
}

export interface Goal { id: string; goal: string; week: string; mapped: boolean }

export interface BriefItem { topic: string; focus: string; minutes: number }
// signature: the class data the brief was drafted from, to tell when it's out of date.
export interface SavedBrief { items: BriefItem[]; generatedAt: number; signature: string }

// A signed-up student in the pilot course, as their lecturer sees them.
export interface ClassStudent {
  id: string
  mastery: TopicMastery[]
  practiceCount: number
  lastActive: number | null
}

// What one member can see: a student's own work, or the lecturer's course.
export interface DemoState {
  mastery: Record<string, TopicMastery[]>
  practiceLog: { course: string; topic: string; correct: boolean; at: number }[]
  chats: Record<string, ChatMessage[]>
  questions: LecturerQuestion[]
  misconceptions: Misconception[]
  uploads: UploadedMaterial[]
  goals: Goal[]
  approvedPracticeIds: number[]
  checkIns: string[]
  briefs: Record<string, SavedBrief>
  students: ClassStudent[]   // lecturers only
}

// The lecturer pages cover the pilot course only.
export const PILOT_COURSE = 'SBS 201'

// Curriculum AI's opening message, addressed to the student by first name.
export function welcomeChat(course: string, student: Pick<Member, 'name' | 'sampleData'>): ChatMessage[] {
  const name = student.name.split(/\s+/)[0]
  const courseName = COURSES.find(c => c.code === course)?.name ?? course
  const text = student.sampleData ? WELCOME_MESSAGES[course] : FIRST_WELCOME.replace('{course}', courseName)
  return [{ role: 'assistant', content: text.replace('{name}', name) }]
}

// Seeded rows carry an age so the database can store real timestamps for them.
const HOUR = 3_600_000

export const SEED_QUESTIONS: (LecturerQuestion & { ageMs: number })[] = [
  {
    id: 'seed-1', course: 'SBS 201', studentId: 'STR-2024-4348', topic: 'Depreciation', urgency: 'High', askedAt: '2 hours ago', ageMs: 2 * HOUR,
    question: "I've read the notes on straight-line depreciation twice but I still don't understand why we subtract the residual value before dividing. Why can't we just divide the full cost by the useful life?",
    context: 'Mastery: 38% · Practice attempts: 1 (0 correct) · Misconception Curriculum AI noticed: treats the full cost as the amount used up · Tried: worked through the formula in the Week 6 notes',
  },
  {
    id: 'seed-2', course: 'SBS 201', studentId: 'STR-2024-3741', topic: 'Accruals & prepayments', urgency: 'Medium', askedAt: '5 hours ago', ageMs: 5 * HOUR,
    question: "I'm confused about the difference between an accrual and a prepayment. Curriculum AI explained it but I'm still not sure which one I should use when rent is paid in advance.",
    context: 'Mastery: 42% · Practice attempts: 3 (1 correct) · Misconception Curriculum AI noticed: mixes up paying in advance with being paid in advance',
  },
  {
    id: 'seed-3', course: 'SBS 201', studentId: 'STR-2024-7079', topic: 'Cash flow statements', urgency: 'Low', askedAt: 'Yesterday', ageMs: 26 * HOUR,
    question: "For the cash flow statement, is depreciation added back because it's a non-cash expense? Or is there another reason?",
    context: 'Mastery: 74% · Practice attempts: 4 (3 correct)',
    reply: "Yes, exactly right. Depreciation is added back to profit in the indirect method because it was deducted to arrive at profit, but no cash left the business when it was charged. The cash left when the asset was bought, and that is shown under investing activities. Good instinct.",
    seenByStudent: true,
  },
]

export const SEED_MISCONCEPTIONS: (Misconception & { ageMs: number })[] = [
  { id: 'seed-m1', course: 'SBS 201', topic: 'Depreciation', note: 'Subtracts the residual value before applying the reducing balance rate', at: 'This week', ageMs: 30 * HOUR },
  { id: 'seed-m2', course: 'SBS 201', topic: 'Accruals & prepayments', note: 'Treats cash paid in the year as the expense for the year', at: 'This week', ageMs: 31 * HOUR },
  { id: 'seed-m3', course: 'SBS 201', topic: 'Trial balance', note: 'Believes an agreed trial balance proves there are no errors', at: 'This week', ageMs: 32 * HOUR },
]

export const SEED_GOALS: Goal[] = [
  { id: 'g1', goal: 'Prepare financial statements in accordance with IFRS', week: 'By Week 10', mapped: true },
  { id: 'g2', goal: 'Apply the matching concept to accruals and prepayments', week: 'By Week 8', mapped: true },
  { id: 'g3', goal: 'Calculate depreciation using both methods and explain the choice', week: 'By Week 7', mapped: false },
]

export const SEED_APPROVED_PRACTICE = [1, 2]

// Before the member's data has loaded.
export function initialState(): DemoState {
  return {
    mastery: {},
    practiceLog: [],
    chats: {},
    questions: [],
    misconceptions: [],
    uploads: [],
    goals: [],
    approvedPracticeIds: [],
    checkIns: [],
    briefs: {},
    students: [],
  }
}

// Where a new student starts: every topic not yet started, or the sample
// student's progress for demo accounts.
export function startingMastery(sample: boolean): Record<string, TopicMastery[]> {
  return Object.fromEntries(Object.entries(TOPIC_PROGRESS).map(([course, topics]) => [course,
    topics.map(t => sample ? { ...t } : { ...t, score: 0, sessions: 0, daysAgo: null })]))
}

// Mastery moves a quarter of the way to 100 on a correct answer, and drops 15% on a wrong one.
export function nextScore(score: number, correct: boolean) {
  return correct ? Math.round(score + (100 - score) * 0.25) : Math.round(score * 0.85)
}
