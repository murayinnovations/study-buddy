'use client'
import { useEffect, useRef, useState } from 'react'
import { profileSummary, type CognitiveProfile } from '../../lib/profile'
import { useStore } from '../../lib/demoStore'

// The onboarding assessment every student takes before studying, and can retake.
// Questions come from /api/assessment without their answers; the server scores the
// sitting and saves the profile. See app/lib/assessment.ts for what each block measures.

const NAVY = '#0D1B3D', YELLOW = '#E8D44D', INK = '#0F172A', QUIET = '#64748B', LINE = '#E2E8F0'

interface Item { id: string; prompt: string; options: string[] }
interface Loaded {
  knowledge: { course: string; courseName: string; items: Item[] } | null
  passages: { id: string; text: string; questions: Item[] }[]
  selfRated: { code: string; name: string }[]
}
type Step = 'intro' | 'knowledge' | 'span' | 'reading' | 'context' | 'saving' | 'done'

const SPAN_LENGTHS = [3, 4, 5, 6, 7]

function digitsOf(length: number) {
  let out = ''
  while (out.length < length) {
    const d = String(Math.floor(Math.random() * 10))
    if (d !== out.at(-1)) out += d
  }
  return out
}

export default function Assessment({ onDone, onCancel }: { onDone: () => Promise<void> | void; onCancel?: () => void }) {
  const { state } = useStore()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('intro')
  const [consent, setConsent] = useState(false)

  const [knowledge, setKnowledge] = useState<{ id: string; choice: number; confidence: number }[]>([])
  const [span, setSpan] = useState<{ sequence: string; answer: string }[]>([])
  const [reading, setReading] = useState<{ id: string; choice: number }[]>([])
  const [readingSeconds, setReadingSeconds] = useState(0)
  const [profile, setProfile] = useState<CognitiveProfile | null>(null)

  useEffect(() => {
    fetch('/api/assessment', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(setData)
      .catch(() => setError('The assessment could not load. Refresh the page to try again.'))
  }, [])

  const steps: { key: Step; label: string }[] = [
    { key: 'intro', label: 'Start' },
    ...(data?.knowledge ? [{ key: 'knowledge' as Step, label: 'Course questions' }] : []),
    { key: 'span', label: 'Memory' },
    { key: 'reading', label: 'Reading' },
    { key: 'context', label: 'About you' },
    { key: 'done', label: 'Your profile' },
  ]
  const next = (from: Step) => {
    const order = steps.map(s => s.key)
    setStep(order[order.indexOf(from) + 1] ?? 'done')
  }

  async function submit(context: ContextAnswers) {
    if (!data) return
    setStep('saving')
    setError('')
    try {
      const res = await fetch('/api/assessment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledge: data.knowledge ? { course: data.knowledge.course, answers: knowledge } : undefined,
          span, reading, readingSeconds, context,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not save your profile.')
      setProfile(body.profile)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
      setStep('context')
    }
  }

  const current = step === 'saving' ? 'context' : step
  const courseName = (code: string) => state.courses.find(c => c.code === code)?.name ?? code

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#F6F7FA', padding: '32px 16px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <ol style={{ display: 'flex', gap: '6px', listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
          {steps.map((s, i) => {
            const reached = steps.findIndex(x => x.key === current) >= i
            return (
              <li key={s.key} style={{ flex: 1 }}>
                <div style={{ height: '4px', borderRadius: '2px', background: reached ? YELLOW : LINE }} />
                <div style={{ fontSize: '11px', marginTop: '6px', color: reached ? NAVY : QUIET, fontWeight: s.key === current ? 600 : 400 }}>{s.label}</div>
              </li>
            )
          })}
        </ol>

        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: '14px', padding: '28px' }}>
          {error && <p role="alert" style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: '8px', background: '#FEF2F2', color: '#991B1B', fontSize: '13px' }}>{error}</p>}

          {step === 'intro' && (
            <>
              <h1 style={h1}>Let&apos;s set up how Study Buddy teaches you</h1>
              <p style={p}>This takes about 12 minutes. It is not a test you can fail, and your answers don&apos;t count towards any grade.</p>
              <ul style={{ ...p, paddingLeft: '18px' }}>
                {data?.knowledge && <li>A few questions on {data.knowledge.courseName}, to find your starting point</li>}
                <li>A short memory exercise, to decide how much to teach at once</li>
                <li>Two short reading passages, to set how explanations are worded</li>
                <li>A few questions about your time, device and preferences</li>
              </ul>
              <p style={p}>Study Buddy uses the result to set the level, length and wording of your practice. You see a plain summary at the end. Your lecturer sees the summary (your starting level and how Study Buddy pitches your practice), not your individual answers. You can retake it at any time, and ask for your answers to be deleted.</p>
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '14px', color: INK, margin: '8px 0 20px', cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: '3px' }} />
                I understand what is collected and why, and I agree to take part.
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Primary disabled={!consent || !data} onClick={() => next('intro')}>{data ? 'Begin' : 'Loading…'}</Primary>
                {onCancel && <Secondary onClick={onCancel}>Not now</Secondary>}
              </div>
            </>
          )}

          {step === 'knowledge' && data?.knowledge && (
            <KnowledgeBlock
              courseName={data.knowledge.courseName}
              items={data.knowledge.items}
              onDone={answers => { setKnowledge(answers); next('knowledge') }}
            />
          )}

          {step === 'span' && <SpanBlock onDone={trials => { setSpan(trials); next('span') }} />}

          {step === 'reading' && data && (
            <ReadingBlock
              passages={data.passages}
              onDone={(answers, seconds) => { setReading(answers); setReadingSeconds(seconds); next('reading') }}
            />
          )}

          {(step === 'context' || step === 'saving') && data && (
            <ContextBlock selfRated={data.selfRated} saving={step === 'saving'} onSubmit={submit} />
          )}

          {step === 'done' && profile && (
            <>
              <h1 style={h1}>Your learning profile</h1>
              <ul style={{ ...p, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {profileSummary(profile, courseName).map(line => <li key={line}>{line}</li>)}
              </ul>
              <p style={{ ...p, color: QUIET, fontSize: '13px' }}>Study Buddy adjusts as you practise. You can retake this from Your Progress.</p>
              <Primary onClick={() => onDone()}>Start learning</Primary>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Block 1 + 4: course questions, each followed by how sure they were ----

function KnowledgeBlock({ courseName, items, onDone }: {
  courseName: string; items: Item[]; onDone: (a: { id: string; choice: number; confidence: number }[]) => void
}) {
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [answers, setAnswers] = useState<{ id: string; choice: number; confidence: number }[]>([])
  const item = items[index]

  const rate = (confidence: number) => {
    const all = [...answers, { id: item.id, choice: choice!, confidence }]
    setAnswers(all)
    setChoice(null)
    if (index + 1 < items.length) setIndex(index + 1)
    else onDone(all)
  }

  return (
    <>
      <div style={eyebrow}>{courseName} · question {index + 1} of {items.length}</div>
      <h2 style={h2}>{item.prompt}</h2>
      <Options options={item.options} selected={choice} onSelect={setChoice} disabled={false} />
      {choice !== null && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '14px', color: INK, marginBottom: '8px' }}>How sure are you?</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['Guessing', 'Unsure', 'Fairly sure', 'Sure', 'Certain'].map((label, i) => (
              <button key={label} onClick={() => rate(i + 1)} style={chip(false)}>{label}</button>
            ))}
          </div>
        </div>
      )}
      <p style={{ ...p, color: QUIET, fontSize: '12px', marginTop: '20px' }}>If you don&apos;t know, choose your best guess and say you&apos;re guessing. That is useful too.</p>
    </>
  )
}

// ---- Block 2: digits shown one at a time, then typed back ----

function SpanBlock({ onDone }: { onDone: (trials: { sequence: string; answer: string }[]) => void }) {
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'showing' | 'recall'>('ready')
  const [sequence, setSequence] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [trials, setTrials] = useState<{ sequence: string; answer: string }[]>([])
  const input = useRef<HTMLInputElement>(null)

  const start = () => {
    const seq = digitsOf(SPAN_LENGTHS[round])
    setSequence(seq)
    setAnswer('')
    setPhase('showing')
  }

  useEffect(() => {
    if (phase !== 'showing') return
    const timers: ReturnType<typeof setTimeout>[] = []
    sequence.split('').forEach((d, i) => {
      timers.push(setTimeout(() => setShown(d), i * 1000))
      timers.push(setTimeout(() => setShown(null), i * 1000 + 750))
    })
    timers.push(setTimeout(() => { setPhase('recall'); setTimeout(() => input.current?.focus(), 0) }, sequence.length * 1000))
    return () => timers.forEach(clearTimeout)
  }, [phase, sequence])

  const submit = () => {
    const all = [...trials, { sequence, answer }]
    setTrials(all)
    const misses = all.filter(t => t.answer.replace(/\D/g, '') !== t.sequence).length
    if (round + 1 >= SPAN_LENGTHS.length || misses >= 2) return onDone(all)
    setRound(round + 1)
    setPhase('ready')
  }

  return (
    <>
      <div style={eyebrow}>Memory · round {round + 1} of {SPAN_LENGTHS.length}</div>
      <h2 style={h2}>Remember the digits in order</h2>
      <p style={p}>Digits appear one at a time. When they stop, type them in the same order. Each round adds one more digit. Don&apos;t write them down.</p>
      <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0', borderRadius: '12px', background: '#F6F7FA', border: `1px solid ${LINE}` }}>
        {phase === 'ready' && <Primary onClick={start}>Show {SPAN_LENGTHS[round]} digits</Primary>}
        {phase === 'showing' && <span aria-live="assertive" style={{ fontSize: '56px', fontWeight: 600, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{shown ?? ''}</span>}
        {phase === 'recall' && (
          <form onSubmit={e => { e.preventDefault(); submit() }} style={{ display: 'flex', gap: '10px' }}>
            <input
              ref={input} value={answer} onChange={e => setAnswer(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" autoComplete="off" aria-label="The digits, in order" maxLength={12}
              style={{ fontSize: '24px', letterSpacing: '6px', width: '220px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${LINE}`, fontFamily: 'inherit' }}
            />
            <Primary disabled={!answer} type="submit">Next</Primary>
          </form>
        )}
      </div>
    </>
  )
}

// ---- Block 3: two passages, two questions each, timed without showing a clock ----

function ReadingBlock({ passages, onDone }: {
  passages: Loaded['passages']; onDone: (a: { id: string; choice: number }[], seconds: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [choices, setChoices] = useState<Record<string, number>>({})
  const [seconds, setSeconds] = useState(0)
  const started = useRef(Date.now())
  const passage = passages[index]
  const complete = passage.questions.every(q => choices[q.id] !== undefined)

  const next = () => {
    const total = seconds + (Date.now() - started.current) / 1000
    if (index + 1 < passages.length) {
      setSeconds(total)
      setIndex(index + 1)
      started.current = Date.now()
      return
    }
    onDone(Object.entries(choices).map(([id, choice]) => ({ id, choice })), total)
  }

  return (
    <>
      <div style={eyebrow}>Reading · passage {index + 1} of {passages.length}</div>
      <p style={{ ...p, fontSize: '15px', lineHeight: 1.7, padding: '16px', background: '#F6F7FA', borderRadius: '10px', border: `1px solid ${LINE}` }}>{passage.text}</p>
      {passage.questions.map(q => (
        <div key={q.id} style={{ marginTop: '20px' }}>
          <h2 style={{ ...h2, fontSize: '15px' }}>{q.prompt}</h2>
          <Options options={q.options} selected={choices[q.id] ?? null} onSelect={c => setChoices({ ...choices, [q.id]: c })} disabled={false} />
        </div>
      ))}
      <div style={{ marginTop: '20px' }}><Primary disabled={!complete} onClick={next}>Next</Primary></div>
    </>
  )
}

// ---- Block 5: study context ----

interface ContextAnswers {
  minutesPerWeek: number; sessionMinutes: number
  format: 'worked_examples' | 'explain_then_practice' | 'questions_first'
  device: 'phone' | 'laptop' | 'both'; connectivity: 'reliable' | 'patchy'
  accessibility: ('largerText' | 'captions' | 'extraTime')[]
  familiarity: Record<string, 'new' | 'some' | 'confident'>
}

function ContextBlock({ selfRated, saving, onSubmit }: { selfRated: Loaded['selfRated']; saving: boolean; onSubmit: (c: ContextAnswers) => void }) {
  const [c, setC] = useState<Partial<ContextAnswers>>({ accessibility: [], familiarity: {} })
  const set = <K extends keyof ContextAnswers>(k: K, v: ContextAnswers[K]) => setC({ ...c, [k]: v })
  const complete = c.minutesPerWeek !== undefined && c.sessionMinutes !== undefined && c.format && c.device && c.connectivity
    && selfRated.every(r => c.familiarity?.[r.code])

  const pick = <K extends keyof ContextAnswers>(label: string, k: K, options: [ContextAnswers[K], string][]) => (
    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
      <legend style={{ fontSize: '14px', fontWeight: 600, color: INK, marginBottom: '8px' }}>{label}</legend>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" aria-pressed={c[k] === v} onClick={() => set(k, v)} style={chip(c[k] === v)}>{text}</button>
        ))}
      </div>
    </fieldset>
  )

  const access = c.accessibility ?? []
  const toggle = (v: 'largerText' | 'captions' | 'extraTime') =>
    set('accessibility', access.includes(v) ? access.filter(x => x !== v) : [...access, v])

  return (
    <>
      <div style={eyebrow}>About you</div>
      <h2 style={h2}>How you study</h2>
      {pick('How much time can you give this each week?', 'minutesPerWeek', [[60, 'About 1 hour'], [120, '2 hours'], [240, '4 hours'], [420, '7 hours or more']])}
      {pick('How long is a typical study session?', 'sessionMinutes', [[10, '10 minutes'], [20, '20 minutes'], [40, '40 minutes or more']])}
      {pick('What helps you learn best?', 'format', [['worked_examples', 'Seeing a worked example first'], ['explain_then_practice', 'A short explanation, then practice'], ['questions_first', 'Trying questions first']])}
      {pick('What do you usually study on?', 'device', [['phone', 'Phone'], ['laptop', 'Laptop or computer'], ['both', 'Both']])}
      {pick('How is your internet connection?', 'connectivity', [['reliable', 'Usually reliable'], ['patchy', 'Often patchy']])}
      {selfRated.map(r => (
        <fieldset key={r.code} style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
          <legend style={{ fontSize: '14px', fontWeight: 600, color: INK, marginBottom: '8px' }}>How familiar are you with {r.name}?</legend>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {([['new', 'New to it'], ['some', 'Know some of it'], ['confident', 'Confident']] as const).map(([v, text]) => (
              <button key={v} type="button" aria-pressed={c.familiarity?.[r.code] === v}
                onClick={() => set('familiarity', { ...c.familiarity, [r.code]: v })} style={chip(c.familiarity?.[r.code] === v)}>{text}</button>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 22px' }}>
        <legend style={{ fontSize: '14px', fontWeight: 600, color: INK, marginBottom: '8px' }}>Anything that would make studying easier? (optional)</legend>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {([['largerText', 'Larger text'], ['captions', 'Captions on video'], ['extraTime', 'Extra time, no time limits']] as const).map(([v, text]) => (
            <button key={v} type="button" aria-pressed={access.includes(v)} onClick={() => toggle(v)} style={chip(access.includes(v))}>{text}</button>
          ))}
        </div>
      </fieldset>
      <Primary disabled={!complete || saving} onClick={() => onSubmit(c as ContextAnswers)}>{saving ? 'Saving…' : 'See my profile'}</Primary>
    </>
  )
}

// ---- Shared pieces ----

function Options({ options, selected, onSelect, disabled }: { options: string[]; selected: number | null; onSelect: (i: number) => void; disabled: boolean }) {
  return (
    <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {options.map((o, i) => (
        <button key={i} role="radio" aria-checked={selected === i} disabled={disabled} onClick={() => onSelect(i)} style={{
          textAlign: 'left', padding: '12px 14px', borderRadius: '10px', fontSize: '14px', lineHeight: 1.5, cursor: 'pointer', fontFamily: 'inherit',
          border: `1px solid ${selected === i ? NAVY : LINE}`, background: selected === i ? '#EEF1F7' : '#fff', color: INK,
          boxShadow: selected === i ? `inset 3px 0 0 ${YELLOW}` : 'none',
        }}>{o}</button>
      ))}
    </div>
  )
}

function Primary({ children, disabled, onClick, type = 'button' }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{
      padding: '11px 20px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
      background: disabled ? '#CBD5E1' : NAVY, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  )
}

function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '11px 20px', borderRadius: '10px', border: `1px solid ${LINE}`, fontSize: '14px', fontFamily: 'inherit',
      background: '#fff', color: INK, cursor: 'pointer',
    }}>{children}</button>
  )
}

const chip = (on: boolean): React.CSSProperties => ({
  padding: '9px 14px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
  border: `1px solid ${on ? NAVY : LINE}`, background: on ? NAVY : '#fff', color: on ? '#fff' : INK,
})
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 600, color: NAVY, margin: '0 0 12px' }
const h2: React.CSSProperties = { fontSize: '17px', fontWeight: 600, color: INK, margin: '0 0 14px', lineHeight: 1.4 }
const p: React.CSSProperties = { fontSize: '14px', lineHeight: 1.6, color: '#334155', margin: '0 0 12px' }
const eyebrow: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: QUIET, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '10px' }
