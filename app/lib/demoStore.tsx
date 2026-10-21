'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { TOPIC_PROGRESS, WELCOME_MESSAGES, STUDENT, COURSES } from '../components/student/studentData'

// Demo state shared by the student, lecturer and HoD views, saved in this
// browser's localStorage. Supabase replaces this store after the POC steps;
// the components only talk to the actions below.

export interface TopicMastery { topic: string; score: number; sessions: number; daysAgo: number | null; week?: number }

export interface Source { title: string; quote: string }
export interface ChatEvent { kind: 'practice'; topic: string; correct: boolean; before: number; after: number }
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  events?: ChatEvent[]
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

export interface Misconception { course: string; topic: string; note: string; at: number | string }

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

interface DemoState {
  version: number
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
}

const STORAGE_KEY = 'arthur-demo-state'
const STATE_VERSION = 2

function initialState(): DemoState {
  return {
    version: STATE_VERSION,
    mastery: JSON.parse(JSON.stringify(TOPIC_PROGRESS)),
    practiceLog: [],
    chats: Object.fromEntries(COURSES.map(c => [c.code, [{ role: 'assistant', content: WELCOME_MESSAGES[c.code] }]])),
    questions: [
      {
        id: 'seed-1', course: 'SBS 201', studentId: 'STR-2024-4348', topic: 'Depreciation', urgency: 'High', askedAt: '2 hours ago',
        question: "I've read the notes on straight-line depreciation twice but I still don't understand why we subtract the residual value before dividing. Why can't we just divide the full cost by the useful life?",
        context: 'Mastery: 38% · Practice attempts: 1 (0 correct) · Misconception Arthur noticed: treats the full cost as the amount used up · Tried: worked through the formula in the Week 6 notes',
      },
      {
        id: 'seed-2', course: 'SBS 201', studentId: 'STR-2024-3741', topic: 'Accruals & prepayments', urgency: 'Medium', askedAt: '5 hours ago',
        question: "I'm confused about the difference between an accrual and a prepayment. Arthur explained it but I'm still not sure which one I should use when rent is paid in advance.",
        context: 'Mastery: 42% · Practice attempts: 3 (1 correct) · Misconception Arthur noticed: mixes up paying in advance with being paid in advance',
      },
      {
        id: 'seed-3', course: 'SBS 201', studentId: 'STR-2024-7079', topic: 'Cash flow statements', urgency: 'Low', askedAt: 'Yesterday',
        question: "For the cash flow statement, is depreciation added back because it's a non-cash expense? Or is there another reason?",
        context: 'Mastery: 74% · Practice attempts: 4 (3 correct)',
        reply: "Yes, exactly right. Depreciation is added back to profit in the indirect method because it was deducted to arrive at profit, but no cash left the business when it was charged. The cash left when the asset was bought, and that is shown under investing activities. Good instinct.",
        seenByStudent: true,
      },
    ],
    misconceptions: [
      { course: 'SBS 201', topic: 'Depreciation', note: 'Subtracts the residual value before applying the reducing balance rate', at: 'This week' },
      { course: 'SBS 201', topic: 'Accruals & prepayments', note: 'Treats cash paid in the year as the expense for the year', at: 'This week' },
      { course: 'SBS 201', topic: 'Trial balance', note: 'Believes an agreed trial balance proves there are no errors', at: 'This week' },
    ],
    uploads: [],
    goals: [
      { id: 'g1', goal: 'Prepare financial statements in accordance with IFRS', week: 'By Week 10', mapped: true },
      { id: 'g2', goal: 'Apply the matching concept to accruals and prepayments', week: 'By Week 8', mapped: true },
      { id: 'g3', goal: 'Calculate depreciation using both methods and explain the choice', week: 'By Week 7', mapped: false },
    ],
    approvedPracticeIds: [1, 2],
    checkIns: [],
    briefs: {},
  }
}

// Mastery moves a quarter of the way to 100 on a correct answer, and drops 15% on a wrong one.
export function nextScore(score: number, correct: boolean) {
  return correct ? Math.round(score + (100 - score) * 0.25) : Math.round(score * 0.85)
}

const newId = () => Math.random().toString(36).slice(2, 10)

function useDemoState() {
  // Start from the seed on both server and client, then load saved state after
  // mount, so the first render matches the server HTML.
  const [state, setState] = useState<DemoState>(initialState)
  const loaded = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved?.version === STATE_VERSION) setState(saved)
    } catch {}
    loaded.current = true
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
  }, [state])

  const update = useCallback((fn: (s: DemoState) => DemoState) => setState(fn), [])

  const actions = useMemo(() => ({
    reset: () => {
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      setState(initialState())
    },

    setChat: (course: string, messages: ChatMessage[]) =>
      update(s => ({ ...s, chats: { ...s.chats, [course]: messages } })),

    clearChat: (course: string) =>
      update(s => ({ ...s, chats: { ...s.chats, [course]: [{ role: 'assistant', content: WELCOME_MESSAGES[course] }] } })),

    // Returns the before/after score so the chat can show the change.
    recordPractice: (course: string, topic: string, correct: boolean, countSession: boolean): ChatEvent => {
      const before = stateRef.current.mastery[course]?.find(t => t.topic === topic)?.score ?? 0
      const event: ChatEvent = { kind: 'practice', topic, correct, before, after: nextScore(before, correct) }
      update(s => {
        const mastery = (s.mastery[course] || []).map(t => t.topic !== topic ? t : {
          ...t, score: nextScore(t.score, correct), daysAgo: 0, sessions: t.sessions + (countSession ? 1 : 0),
        })
        return {
          ...s,
          mastery: { ...s.mastery, [course]: mastery },
          practiceLog: [...s.practiceLog, { course, topic, correct, at: Date.now() }],
        }
      })
      return event
    },

    noteMisconception: (course: string, topic: string, note: string) =>
      update(s => ({ ...s, misconceptions: [{ course, topic, note, at: Date.now() }, ...s.misconceptions].slice(0, 30) })),

    askLecturer: (q: Pick<LecturerQuestion, 'course' | 'topic' | 'urgency' | 'question' | 'context'>) =>
      update(s => ({ ...s, questions: [{ ...q, id: newId(), studentId: STUDENT.id, askedAt: Date.now() }, ...s.questions] })),

    replyToQuestion: (id: string, reply: string) =>
      update(s => ({ ...s, questions: s.questions.map(q => q.id === id ? { ...q, reply, repliedAt: Date.now(), seenByStudent: false } : q) })),

    saveAnswerToCourse: (id: string) =>
      update(s => ({ ...s, questions: s.questions.map(q => q.id === id ? { ...q, savedToCourse: true } : q) })),

    markRepliesSeen: () =>
      update(s => ({ ...s, questions: s.questions.map(q => q.studentId === STUDENT.id && q.reply ? { ...q, seenByStudent: true } : q) })),

    uploadMaterial: (m: Pick<UploadedMaterial, 'course' | 'title' | 'type' | 'topics' | 'body'>) =>
      update(s => ({ ...s, uploads: [...s.uploads, { ...m, id: newId(), status: 'pending', uploadedAt: Date.now() }] })),

    approveMaterial: (id: string) =>
      update(s => ({ ...s, uploads: s.uploads.map(u => u.id === id ? { ...u, status: 'approved' } : u) })),

    removeMaterial: (id: string) =>
      update(s => ({ ...s, uploads: s.uploads.filter(u => u.id !== id) })),

    addGoal: (goal: string, week: string) =>
      update(s => ({ ...s, goals: [...s.goals, { id: newId(), goal, week, mapped: false }] })),

    mapGoal: (id: string) =>
      update(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, mapped: true } : g) })),

    approvePractice: (id: number) =>
      update(s => ({ ...s, approvedPracticeIds: Array.from(new Set([...s.approvedPracticeIds, id])) })),

    saveBrief: (course: string, brief: SavedBrief) =>
      update(s => ({ ...s, briefs: { ...s.briefs, [course]: brief } })),

    sendCheckIn: (studentId: string) =>
      update(s => ({ ...s, checkIns: Array.from(new Set([...s.checkIns, studentId])) })),
  }), [update])

  return { state, ...actions }
}

type Store = ReturnType<typeof useDemoState>

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useDemoState()
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}

// Materials a lecturer added during the demo that Arthur should now use:
// approved uploads plus replies saved to the course.
export function extraMaterialsFor(state: DemoState, course: string) {
  const uploads = state.uploads
    .filter(u => u.course === course && u.status === 'approved')
    .map(u => ({ title: u.title, type: u.type, topics: u.topics, body: u.body }))
  const answers = state.questions
    .filter(q => q.course === course && q.savedToCourse && q.reply)
    .map(q => ({
      title: `Lecturer answer — ${q.topic}`,
      type: 'Lecturer answer',
      topics: [q.topic],
      body: `Student question: ${q.question}\n\nLecturer's answer: ${q.reply}`,
    }))
  return [...uploads, ...answers]
}
