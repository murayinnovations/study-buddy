// Shapes of the state shared by the student, lecturer and HoD views.
// Used by the browser store and the database layer.

import type { CognitiveProfile } from './profile'

export type Role = 'student' | 'lecturer' | 'hod' | 'admin'

// A signed-in person, from the members table.
export interface Member {
  email: string
  role: Role
  name: string
  studentId: string | null   // students only
  subtitle: string
  course: string | null      // lecturers only: the course they teach
  demoGroup: string | null   // members sharing a group can switch between each other's views
}

// A course as the browser sees it, from the courses table. Study Buddy's
// instructions for the course stay on the server.
export interface Course {
  code: string
  name: string
  lecturer: string
  credits: number
  color: string
  topics: { topic: string; week?: number }[]
  currentWeek: number | null   // taught up to this week; null means every topic
  totalWeeks: number | null
  starters: { label: string; prompt: string }[]
  syntheticClass: boolean      // lecturer dashboards add 30 synthetic students
  hasMaterials: boolean        // Study Buddy has approved course material to answer from
}

// A file a member can open, e.g. the original slides behind a material.
export interface CourseFile { id: string; course: string; title: string; type: string; fileName: string }

export interface TopicMastery { topic: string; score: number; sessions: number; daysAgo: number | null; week?: number }

export interface Source { title: string; quote: string }
export interface ChatEvent { kind: 'practice'; topic: string; correct: boolean; before: number; after: number }
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  events?: ChatEvent[]
  misconceptions?: { topic: string; note: string }[]   // assistant turns: what Study Buddy noted for the lecturer
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
  status: 'pending' | 'approved'
  source: 'lecturer' | 'platform'   // platform: imported from the university's learning platform
  fileName: string | null           // set when the original file can be opened
  uploadedAt: number
}

export interface Goal { id: string; goal: string; week: string; mapped: boolean }

export interface BriefItem { topic: string; focus: string; minutes: number }
// signature: the class data the brief was drafted from, to tell when it's out of date.
export interface SavedBrief { items: BriefItem[]; generatedAt: number; signature: string }

// A signed-up student in the lecturer's course, as their lecturer sees them.
export interface ClassStudent {
  id: string
  mastery: TopicMastery[]
  practiceCount: number
  lastActive: number | null
}

// A live course as the HoD sees it, worked out from the same class the lecturer sees.
export interface CourseSummary {
  code: string
  name: string
  lecturer: string
  students: number
  active: number       // active in the last 7 days
  avg: number          // class average mastery over topics taught so far
  atRisk: number
  questions: number    // unanswered student questions
  trend: number[]      // weekly class average, oldest first
}

// What one member can see: a student's own work, or the lecturer's course.
export interface DemoState {
  courses: Course[]          // students: every active course; lecturers: the one they teach
  files: CourseFile[]        // original files behind the approved course material
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
  summaries: CourseSummary[] // HoD only: every active course
  profile: CognitiveProfile | null  // students only: the current cognitive profile, if they have one
  profileReady: boolean      // the profile table could be read; false sends nobody to the assessment
}

const FIRST_WELCOME = `Hi {name}, I'm Study Buddy, your study companion for **{course}**.\n\nI answer from your lecturer's approved course material and show you where each answer comes from. I can also set you practice questions, and I'll keep track of how you're doing on each topic.\n\nWhat would you like to work on first?`

// Study Buddy's opening message, addressed to the student by first name.
export function welcomeChat(courseName: string, student: Pick<Member, 'name'>): ChatMessage[] {
  const name = student.name.split(/\s+/)[0]
  return [{ role: 'assistant', content: FIRST_WELCOME.replace('{course}', courseName).replace('{name}', name) }]
}

// Topics the class has been taught so far.
export function taughtTopics(course: Course) {
  return course.topics.filter(t => course.currentWeek === null || (t.week ?? 0) <= course.currentWeek).map(t => t.topic)
}

// Before the member's data has loaded.
export function initialState(): DemoState {
  return {
    courses: [],
    files: [],
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
    summaries: [],
    profile: null,
    profileReady: false,
  }
}

// Mastery moves a quarter of the way to 100 on a correct answer, and drops 15% on a wrong one.
export function nextScore(score: number, correct: boolean) {
  return correct ? Math.round(score + (100 - score) * 0.25) : Math.round(score * 0.85)
}
