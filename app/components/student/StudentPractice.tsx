'use client'
import { useMemo, useState } from 'react'
import { useStore, type Course } from '../../lib/demoStore'
import { taughtTopics } from '../../lib/demoData'
import { SET_SIZE, CARDS_PER_SESSION } from '../../lib/profile'

// Quiz and flashcards for one topic, written from the course material by /api/practice
// and sized by the student's profile. Quiz answers are recorded as practice results,
// so mastery and the lecturer's dashboards move the same way as practice in the chat.

const NAVY = '#0D1B3D', YELLOW = '#E8D44D', INK = '#0F172A', QUIET = '#64748B', LINE = '#E2E8F0'

interface Question { question: string; options: string[]; answer: number; explanation: string }
interface Card { front: string; back: string }

export default function StudentPractice({ course, kind }: { course: Course; kind: 'quiz' | 'cards' }) {
  const { state } = useStore()
  const topics = state.mastery[course.code] || []
  const taught = taughtTopics(course)
  const options = topics.filter(t => taught.includes(t.topic))
  // Default to the weakest topic taught so far, as the sidebar's suggestion does.
  const weakest = useMemo(() => [...options].sort((a, b) => a.score - b.score)[0]?.topic ?? taught[0] ?? '', [course.code]) // eslint-disable-line react-hooks/exhaustive-deps
  const [topic, setTopic] = useState(weakest)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quiz, setQuiz] = useState<Question[] | null>(null)
  const [cards, setCards] = useState<Card[] | null>(null)

  const size = state.profile ? (kind === 'quiz' ? SET_SIZE[state.profile.chunkSize] : String(CARDS_PER_SESSION[state.profile.chunkSize])) : kind === 'quiz' ? '5' : '10'

  async function start() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/practice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: course.code, topic, kind }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Study Buddy could not write this set.')
      if (kind === 'quiz') setQuiz(body.questions)
      else setCards(body.cards)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Study Buddy could not write this set.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setQuiz(null); setCards(null) }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC', padding: '24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {quiz ? (
          <QuizRunner course={course} topic={topic} questions={quiz} onAgain={reset} />
        ) : cards ? (
          <CardRunner topic={topic} cards={cards} onAgain={reset} />
        ) : (
          <div style={panel}>
            <h2 style={h2}>{kind === 'quiz' ? 'Quiz' : 'Flashcards'}</h2>
            <p style={p}>
              {kind === 'quiz'
                ? `${size} questions on one topic, written from your course material. Your answers update your progress.`
                : `${size} cards on one topic, written from your course material. Mark the ones you need to see again.`}
            </p>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: INK, marginBottom: '6px' }} htmlFor="practice-topic">Topic</label>
            <select id="practice-topic" value={topic} onChange={e => setTopic(e.target.value)} disabled={loading}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${LINE}`, fontSize: '14px', fontFamily: 'inherit', background: '#fff', color: INK, marginBottom: '16px' }}>
              {options.map(t => <option key={t.topic} value={t.topic}>{t.topic} · {t.score}%</option>)}
            </select>
            {error && <p role="alert" style={{ ...p, color: '#991B1B' }}>{error}</p>}
            <Primary onClick={start} disabled={loading || !topic}>{loading ? 'Writing from your course notes…' : kind === 'quiz' ? 'Start quiz' : 'Start flashcards'}</Primary>
            {loading && <p style={{ ...p, color: QUIET, fontSize: '12px', marginTop: '10px' }}>This takes about 20 seconds the first time, and is quicker after that.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function QuizRunner({ course, topic, questions, onAgain }: { course: Course; topic: string; questions: Question[]; onAgain: () => void }) {
  const { state, recordPractice } = useStore()
  // Every learner rates how sure they are before the answer shows: it keeps their confidence
  // calibration up to date (adaptToPractice), and helps the over-confident spot gaps.
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [scores, setScores] = useState<{ before: number; after: number } | null>(null)
  const [done, setDone] = useState(false)
  const q = questions[index]

  const reveal = () => {
    const correct = choice === q.answer
    const ev = recordPractice(course.code, topic, correct, index === 0, confidence ?? undefined)
    setScores(s => ({ before: s?.before ?? ev.before, after: ev.after }))
    if (correct) setCorrectCount(n => n + 1)
    setRevealed(true)
  }
  const next = () => {
    if (index + 1 >= questions.length) return setDone(true)
    setIndex(index + 1); setChoice(null); setConfidence(null); setRevealed(false)
  }

  if (done) {
    return (
      <div style={panel}>
        <h2 style={h2}>{correctCount} of {questions.length} correct</h2>
        {scores && <p style={p}>{topic}: {scores.before}% to {scores.after}%.</p>}
        <div style={{ display: 'flex', gap: '10px' }}><Primary onClick={onAgain}>Another set</Primary></div>
      </div>
    )
  }

  const ready = choice !== null && confidence !== null
  return (
    <div style={panel}>
      <div style={eyebrow}>{topic} · question {index + 1} of {questions.length}</div>
      <h2 style={{ ...h2, fontSize: '16px' }}>{q.question}</h2>
      <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {q.options.map((o, i) => {
          const isRight = revealed && i === q.answer, isWrong = revealed && i === choice && i !== q.answer
          return (
            <button key={i} role="radio" aria-checked={choice === i} disabled={revealed} onClick={() => setChoice(i)} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: '10px', fontSize: '14px', lineHeight: 1.5, fontFamily: 'inherit',
              cursor: revealed ? 'default' : 'pointer', color: INK,
              border: `1px solid ${isRight ? '#059669' : isWrong ? '#DC2626' : choice === i ? NAVY : LINE}`,
              background: isRight ? '#ECFDF5' : isWrong ? '#FEF2F2' : choice === i ? '#EEF1F7' : '#fff',
              boxShadow: !revealed && choice === i ? `inset 3px 0 0 ${YELLOW}` : 'none',
            }}>{o}</button>
          )
        })}
      </div>

      {choice !== null && !revealed && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '14px', color: INK, marginBottom: '8px' }}>How sure are you?</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['Guessing', 'Unsure', 'Fairly sure', 'Sure', 'Certain'].map((label, i) => (
              <button key={label} onClick={() => setConfidence(i + 1)} aria-pressed={confidence === i + 1} style={chip(confidence === i + 1)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {revealed && (
        <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px', background: '#F6F7FA', border: `1px solid ${LINE}` }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: choice === q.answer ? '#047857' : '#B91C1C', marginBottom: '4px' }}>
            {choice === q.answer ? 'Correct.' : 'Not quite.'}
            {confidence !== null && confidence >= 4 && choice !== q.answer ? ' You were sure about this one, so it is worth another look.' : ''}
            {state.profile?.calibration === 'under' && choice === q.answer ? ' Your reasoning was sound.' : ''}
          </div>
          <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>{q.explanation}</div>
        </div>
      )}

      <div style={{ marginTop: '18px' }}>
        {revealed
          ? <Primary onClick={next}>{index + 1 >= questions.length ? 'See results' : 'Next question'}</Primary>
          : <Primary onClick={reveal} disabled={!ready}>Check answer</Primary>}
      </div>
    </div>
  )
}

function CardRunner({ topic, cards, onAgain }: { topic: string; cards: Card[]; onAgain: () => void }) {
  // Cards marked "Again" go to the back of the queue, at most twice each.
  const [queue, setQueue] = useState(cards.map((c, i) => ({ ...c, id: i, repeats: 0 })))
  const [flipped, setFlipped] = useState(false)
  const [again, setAgain] = useState(new Set<number>())
  const card = queue[0]

  const answer = (knew: boolean) => {
    const [head, ...rest] = queue
    if (!knew) setAgain(a => new Set(a).add(head.id))
    setQueue(!knew && head.repeats < 2 ? [...rest, { ...head, repeats: head.repeats + 1 }] : rest)
    setFlipped(false)
  }

  if (!card) {
    return (
      <div style={panel}>
        <h2 style={h2}>{cards.length} cards reviewed</h2>
        <p style={p}>{again.size === 0 ? 'You knew every card.' : `${again.size} card${again.size === 1 ? '' : 's'} needed another look. Try a quiz on ${topic} to check them.`}</p>
        <Primary onClick={onAgain}>Another deck</Primary>
      </div>
    )
  }

  return (
    <div style={panel}>
      <div style={eyebrow}>{topic} · {queue.length} card{queue.length === 1 ? '' : 's'} left</div>
      <button onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Show the front' : 'Show the answer'} style={{
        width: '100%', minHeight: '180px', padding: '24px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${flipped ? NAVY : LINE}`, background: flipped ? '#EEF1F7' : '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: QUIET, textTransform: 'uppercase', letterSpacing: '.4px' }}>{flipped ? 'Answer' : 'Card'}</span>
        <span style={{ fontSize: flipped ? '15px' : '18px', fontWeight: flipped ? 400 : 600, color: INK, lineHeight: 1.5 }}>{flipped ? card.back : card.front}</span>
      </button>
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        {flipped ? (
          <>
            <Secondary onClick={() => answer(false)}>Again</Secondary>
            <Primary onClick={() => answer(true)}>Got it</Primary>
          </>
        ) : <Primary onClick={() => setFlipped(true)}>Show answer</Primary>}
      </div>
    </div>
  )
}

function Primary({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      padding: '11px 20px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
      background: disabled ? '#CBD5E1' : NAVY, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  )
}
function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '11px 20px', borderRadius: '10px', border: `1px solid ${LINE}`, fontSize: '14px', fontFamily: 'inherit', background: '#fff', color: INK, cursor: 'pointer',
    }}>{children}</button>
  )
}

const chip = (on: boolean): React.CSSProperties => ({
  padding: '9px 14px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
  border: `1px solid ${on ? NAVY : LINE}`, background: on ? NAVY : '#fff', color: on ? '#fff' : INK,
})
const panel: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: '14px', padding: '24px' }
const h2: React.CSSProperties = { fontSize: '18px', fontWeight: 600, color: NAVY, margin: '0 0 10px', lineHeight: 1.4 }
const p: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#334155', margin: '0 0 12px' }
const eyebrow: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: QUIET, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '10px' }
