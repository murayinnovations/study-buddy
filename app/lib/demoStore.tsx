'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { type DemoState, type ChatMessage, type ChatEvent, type LecturerQuestion, type UploadedMaterial, type SavedBrief, type Member, initialState, nextScore, welcomeChat } from './demoData'

export type * from './demoData'

// The signed-in member's state: a student's own work, or the lecturer's course.
// It lives in Supabase behind /api/store: changes show here at once and are saved
// in the background, and the store re-reads every few seconds so the other side
// (a student's lecturer, or the student) sees them.

// saving: loaded from and saving to the database. offline: changes stay in this tab only.
export type StoreStatus = 'loading' | 'saving' | 'offline'

const POLL_MS = 4000

function useDemoState(member: Member) {
  // Start from the seed on both server and client so the first render matches
  // the server HTML, then load the saved state after mount.
  const [state, setState] = useState<DemoState>(initialState)
  const [status, setStatus] = useState<StoreStatus>('loading')
  const stateRef = useRef(state)
  stateRef.current = state

  // Writes go out one at a time, in order. A read that started before a write
  // is discarded, so it can't undo a change still in flight.
  const queue = useRef(Promise.resolve())
  const pending = useRef(0)
  const writes = useRef(0)
  const configured = useRef(true)

  const refresh = useCallback(async () => {
    const seen = writes.current
    try {
      const res = await fetch('/api/store', { cache: 'no-store' })
      if (res.status === 503) configured.current = false
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok) throw new Error(`load failed: ${res.status}`)
      const data: DemoState = await res.json()
      if (pending.current === 0 && seen === writes.current) setState(data)
      setStatus('saving')
    } catch (err) {
      console.warn('Curriculum AI demo store:', err)
      setStatus('offline')
    }
  }, [])

  useEffect(() => {
    refresh()
    const tick = () => { if (configured.current && document.visibilityState === 'visible') refresh() }
    const timer = setInterval(tick, POLL_MS)
    window.addEventListener('focus', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [refresh])

  const save = useCallback((action: { type: string } & Record<string, unknown>) => {
    if (!configured.current) return
    writes.current++
    pending.current++
    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch('/api/store', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action),
        })
        if (res.status === 401) { window.location.href = '/login'; return }
        if (!res.ok) throw new Error(`save ${action.type} failed: ${res.status}`)
      } catch (err) {
        console.warn('Curriculum AI demo store:', err)
        setStatus('offline')
      } finally {
        pending.current--
      }
    })
  }, [])

  // Applies a change here at once and saves it.
  const update = useCallback((fn: (s: DemoState) => DemoState, action: { type: string } & Record<string, unknown>) => {
    setState(fn)
    save(action)
  }, [save])

  const actions = useMemo(() => ({
    setChat: (course: string, messages: ChatMessage[]) =>
      update(s => ({ ...s, chats: { ...s.chats, [course]: messages } }), { type: 'setChat', course, messages }),

    clearChat: (course: string) =>
      update(s => ({ ...s, chats: { ...s.chats, [course]: welcomeChat(course, member) } }), { type: 'clearChat', course }),

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
      }, { type: 'recordPractice', course, topic, correct, countSession })
      return event
    },

    noteMisconception: (course: string, topic: string, note: string) => {
      const id = crypto.randomUUID()
      update(s => ({ ...s, misconceptions: [{ id, course, topic, note, at: Date.now() }, ...s.misconceptions].slice(0, 30) }),
        { type: 'noteMisconception', id, course, topic, note })
    },

    askLecturer: (q: Pick<LecturerQuestion, 'course' | 'topic' | 'urgency' | 'question' | 'context'>) => {
      const id = crypto.randomUUID()
      update(s => ({ ...s, questions: [{ ...q, id, studentId: member.studentId!, askedAt: Date.now() }, ...s.questions] }),
        { type: 'askLecturer', id, ...q })
    },

    replyToQuestion: (id: string, reply: string) =>
      update(s => ({ ...s, questions: s.questions.map(q => q.id === id ? { ...q, reply, repliedAt: Date.now(), seenByStudent: false } : q) }),
        { type: 'replyToQuestion', id, reply }),

    saveAnswerToCourse: (id: string) =>
      update(s => ({ ...s, questions: s.questions.map(q => q.id === id ? { ...q, savedToCourse: true } : q) }),
        { type: 'saveAnswerToCourse', id }),

    markRepliesSeen: () =>
      update(s => ({ ...s, questions: s.questions.map(q => q.studentId === member.studentId && q.reply ? { ...q, seenByStudent: true } : q) }),
        { type: 'markRepliesSeen' }),

    uploadMaterial: (m: Pick<UploadedMaterial, 'course' | 'title' | 'type' | 'topics' | 'body'>) => {
      const id = crypto.randomUUID()
      update(s => ({ ...s, uploads: [...s.uploads, { ...m, id, status: 'pending', uploadedAt: Date.now() }] }),
        { type: 'uploadMaterial', id, course: m.course, title: m.title, materialType: m.type, topics: m.topics, body: m.body })
    },

    approveMaterial: (id: string) =>
      update(s => ({ ...s, uploads: s.uploads.map(u => u.id === id ? { ...u, status: 'approved' } : u) }), { type: 'approveMaterial', id }),

    removeMaterial: (id: string) =>
      update(s => ({ ...s, uploads: s.uploads.filter(u => u.id !== id) }), { type: 'removeMaterial', id }),

    addGoal: (goal: string, week: string) => {
      const id = crypto.randomUUID()
      update(s => ({ ...s, goals: [...s.goals, { id, goal, week, mapped: false }] }), { type: 'addGoal', id, goal, week })
    },

    mapGoal: (id: string) =>
      update(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, mapped: true } : g) }), { type: 'mapGoal', id }),

    approvePractice: (id: number) =>
      update(s => ({ ...s, approvedPracticeIds: Array.from(new Set([...s.approvedPracticeIds, id])) }), { type: 'approvePractice', id }),

    saveBrief: (course: string, brief: SavedBrief) =>
      update(s => ({ ...s, briefs: { ...s.briefs, [course]: brief } }), { type: 'saveBrief', course, brief }),

    sendCheckIn: (studentId: string) =>
      update(s => ({ ...s, checkIns: Array.from(new Set([...s.checkIns, studentId])) }), { type: 'sendCheckIn', studentId }),
  }), [update, member])

  return { member, state, status, ...actions }
}

type Store = ReturnType<typeof useDemoState>

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ member, children }: { member: Member; children: React.ReactNode }) {
  const store = useDemoState(member)
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
