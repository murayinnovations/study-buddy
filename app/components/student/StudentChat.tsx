'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { QUICK_STARTERS, CURRENT_WEEK, courseTopics, type Course } from './studentData'
import { useStore, type ChatMessage, type ChatEvent, type Source } from '../../lib/demoStore'

// Courses whose answers are grounded in uploaded materials (see app/lib/materials.ts).
const GROUNDED_COURSES = ['SBS 201']

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMd(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^(\d+\.) /gm, '<br/>$1 ')
    .replace(/\n\n/g, '</p><p style="margin-top:.45rem">')
    .replace(/\n/g, '<br/>')
    .replace(/⟦(\d+)⟧/g, '<sup class="cite">$1</sup>')
}

export default function StudentChat({ selectedCourse, showProgress, setShowProgress, pendingPrompt, clearPendingPrompt }: {
  selectedCourse: Course
  showProgress: boolean
  setShowProgress: (v: boolean) => void
  pendingPrompt: string | null
  clearPendingPrompt: () => void
}) {
  const store = useStore()
  const { state, setChat, clearChat, recordPractice, noteMisconception, askLecturer } = store
  const course = selectedCourse.code
  const messages = state.chats[course] || []

  // The reply being streamed; committed to the store when it finishes.
  const [live, setLive] = useState<ChatMessage | null>(null)
  const [input, setInput] = useState('')
  const [flagModal, setFlagModal] = useState(false)
  const [flagText, setFlagText] = useState('')
  const [flagTopic, setFlagTopic] = useState('')
  const [notice, setNotice] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const sentPending = useRef<string | null>(null)
  // Topics practised in this chat, so a session is counted once per topic.
  const practised = useRef(new Set<string>())
  // The latest misconception Arthur noted in this chat, for "Ask lecturer".
  const lastMisconception = useRef<{ topic: string; note: string } | null>(null)
  // The topic most recently practised in this chat, for "Ask lecturer".
  const lastPractised = useRef<string | null>(null)
  const streaming = live !== null

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages.length, live?.content])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const topics = state.mastery[course] || []

  // Streams Arthur's reply to `history`, which must end with a user turn.
  const reply = useCallback(async (history: ChatMessage[]) => {
    setChat(course, history)
    let acc = ''
    const sources: Source[] = []
    const events: ChatEvent[] = []
    const show = () => setLive({ role:'assistant', content:acc, sources:[...sources], events:[...events] })
    show()
    // Each cited passage gets a marker per source, numbered in order of first use.
    const addCitations = (cited: Source[]) => {
      const nums = new Set<number>()
      for (const c of cited) {
        let i = sources.findIndex(x => x.title===c.title && x.quote===c.quote)
        if (i === -1) i = sources.push(c) - 1
        nums.add(i+1)
      }
      acc += Array.from(nums).map(n => `⟦${n}⟧`).join('')
    }

    let serverError = ''
    try {
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          // Failed replies are dropped so the error text never reaches Arthur.
          messages: history.filter(m => !m.failed).map(m => ({ role: m.role, content: m.content, context: m.context })),
          courseCode: course,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: '' }))
        serverError = error || ''
        throw new Error(`chat request failed: ${res.status}`)
      }
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream:true })
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const line of lines) {
          if (!line) continue
          const ev = JSON.parse(line)
          if (ev.t === 'text') acc += ev.v
          else if (ev.t === 'cite') addCitations(ev.sources)
          else if (ev.t === 'practice') {
            events.push(recordPractice(course, ev.topic, ev.correct, !practised.current.has(ev.topic)))
            practised.current.add(ev.topic)
            lastPractised.current = ev.topic
          } else if (ev.t === 'misconception') {
            noteMisconception(course, ev.topic, ev.note)
            lastMisconception.current = { topic: ev.topic, note: ev.note }
          }
        }
        show()
      }
    } catch {
      if (!acc) {
        setChat(course, [...history, { role:'assistant', content: serverError || "I'm having trouble connecting right now. Try again in a moment.", failed:true }])
        setLive(null)
        return
      }
      acc += '\n\n*(The connection dropped before I finished. Use Regenerate to try again.)*'
    }
    setChat(course, [...history, { role:'assistant', content:acc, sources, events }])
    setLive(null)
  }, [course, setChat, recordPractice, noteMisconception])

  const send = useCallback((text?: string) => {
    const content = text || input.trim()
    if (!content || streaming) return
    setInput('')
    // The mastery snapshot is stored with the message so later requests replay it byte for byte.
    const context = JSON.stringify(Object.fromEntries(topics.map(t => [t.topic, `${t.score}%`])))
    reply([...messages, { role:'user', content, context }])
  }, [input, streaming, topics, messages, reply])

  // Re-asks Arthur for the last answer. Not offered once that answer recorded a
  // practice result, since asking again would count the attempt twice.
  const last = messages[messages.length - 1]
  const canRegenerate = !streaming && last?.role === 'assistant' && messages.length >= 2
    && messages[messages.length - 2].role === 'user' && !(last.events && last.events.length > 0)
  const regenerate = () => { if (canRegenerate) reply(messages.slice(0, -1)) }

  // "Start a session" from the sidebar.
  useEffect(() => {
    if (!pendingPrompt || streaming || sentPending.current === pendingPrompt) return
    sentPending.current = pendingPrompt
    clearPendingPrompt()
    send(pendingPrompt)
  }, [pendingPrompt, streaming, send, clearPendingPrompt])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const weakestStarted = [...topics].filter(t => t.sessions > 0 && (t.week ?? 0) <= CURRENT_WEEK).sort((a, b) => a.score - b.score)[0]

  const openFlagModal = () => {
    const lastUser = [...messages].reverse().find(m => m.role==='user')
    setFlagText(lastUser?.content || '')
    setFlagTopic(lastMisconception.current?.topic || lastPractised.current || weakestStarted?.topic || topics[0]?.topic || '')
    setFlagModal(true)
  }

  const flagTopicData = topics.find(t => t.topic === flagTopic)
  const attempts = state.practiceLog.filter(p => p.course === course && p.topic === flagTopic)
  const flagContext = [
    `Mastery: ${flagTopicData?.score ?? 0}%`,
    `Practice attempts: ${attempts.length} (${attempts.filter(a => a.correct).length} correct)`,
    lastMisconception.current?.topic === flagTopic ? `Misconception Arthur noticed: ${lastMisconception.current.note}` : null,
    `Messages with Arthur in this chat: ${messages.filter(m => m.role === 'user').length}`,
  ].filter(Boolean).join(' · ')

  const sendFlag = () => {
    const score = flagTopicData?.score ?? 0
    askLecturer({
      course, topic: flagTopic, question: flagText.trim(), context: flagContext,
      urgency: score < 40 ? 'High' : score < 60 ? 'Medium' : 'Low',
    })
    setFlagModal(false)
    setNotice(`Sent to ${selectedCourse.lecturer}. Their reply will appear in your sidebar.`)
  }

  const shown = live ? [...messages, live] : messages
  const hasUserMessages = messages.some(m => m.role === 'user')

  const headerButton = (active = false): React.CSSProperties => ({
    fontSize:'12px', fontWeight:500, padding:'6px 12px', borderRadius:'8px',
    border:'1.5px solid #E2E8F0', background: active ? '#EFF6FF' : '#fff', color: active ? '#2563EB' : '#475569',
    cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontFamily:'inherit',
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#F8FAFC', minWidth:0 }}>

      {/* Chat header */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'12px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:'12px',
      }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>
            {selectedCourse.name} — {selectedCourse.code}
          </div>
          <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'2px' }}>
            {selectedCourse.lecturer} · {GROUNDED_COURSES.includes(course) ? 'Answers from approved course materials' : 'Course materials not yet uploaded'}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
          {hasUserMessages && (
            <button onClick={() => { clearChat(course); practised.current.clear(); lastMisconception.current = null; lastPractised.current = null }} disabled={streaming} style={headerButton()} title="Start a new conversation">
              New chat
            </button>
          )}
          <button onClick={openFlagModal} style={headerButton()} title="Send a question to your lecturer (S10)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Ask lecturer
          </button>
          <button onClick={() => setShowProgress(!showProgress)} style={headerButton(showProgress)}>
            {showProgress ? 'Hide' : 'Show'} progress
          </button>
        </div>
      </div>

      {notice && (
        <div className="fade-up" style={{ margin:'12px 24px 0', padding:'10px 14px', borderRadius:'9px', background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#065F46', fontSize:'12px', fontWeight:500 }}>
          ✓ {notice}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {shown.map((msg, i) => (
          <div key={i} className="fade-up" style={{ display:'flex', gap:'10px', flexDirection: msg.role==='user' ? 'row-reverse' : 'row', alignItems:'flex-start' }}>
            <div style={{
              width:'32px', height:'32px', borderRadius:'50%', flexShrink:0,
              background: msg.role==='assistant' ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : '#0F172A',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'11px', fontWeight:700,
            }}>
              {msg.role==='assistant' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4C9 4 7 6 7 9c0 1.8.8 3.4 2 4.4V15h6v-1.6c1.2-1 2-2.6 2-4.4 0-3-2-5-5-5z" fill="white" opacity=".9"/>
                  <rect x="9" y="15" width="6" height="1.5" rx=".75" fill="white" opacity=".7"/>
                </svg>
              ) : 'SK'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems: msg.role==='user' ? 'flex-end' : 'flex-start', maxWidth:'72%' }}>
              <span style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', marginBottom:'4px', letterSpacing:'.3px' }}>
                {msg.role==='assistant' ? 'ARTHUR' : 'YOU'}
              </span>
              <div
                className="chat-prose"
                style={{
                  padding:'12px 16px', borderRadius: msg.role==='assistant' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                  background: msg.role==='assistant' ? '#fff' : '#1E3A5F',
                  border: msg.role==='assistant' ? '1px solid #E2E8F0' : 'none',
                  color: msg.role==='assistant' ? '#1E293B' : '#fff',
                  fontSize:'13px', lineHeight:'1.7',
                  boxShadow: msg.role==='assistant' ? '0 1px 3px rgba(0,0,0,.04)' : 'none',
                }}
              >
                {msg.failed ? (
                  <span style={{ color:'#B91C1C' }}>{msg.content}</span>
                ) : msg.role==='assistant' && msg.content==='' && msg === live ? (
                  <span style={{ display:'flex', gap:'5px', alignItems:'center', padding:'2px 0' }}>
                    <span className="thinking-dot"/><span className="thinking-dot"/><span className="thinking-dot"/>
                  </span>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html:`<p style="margin:0">${renderMd(msg.content)}</p>` }}/>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop:'10px', paddingTop:'8px', borderTop:'1px solid #F1F5F9', display:'flex', flexDirection:'column', gap:'4px' }}>
                    <div style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px' }}>Sources</div>
                    {msg.sources.map((src, n) => (
                      <div key={n} title={src.quote} style={{ fontSize:'11px', color:'#64748B', lineHeight:1.4, display:'flex', gap:'6px' }}>
                        <span style={{ fontWeight:700, color:'#2563EB', flexShrink:0 }}>{n+1}</span>
                        <span><strong style={{ color:'#334155', fontWeight:600 }}>{src.title}</strong> — “{src.quote.length > 110 ? src.quote.slice(0,110).trimEnd() + '…' : src.quote}”</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {i === messages.length - 1 && canRegenerate && (
                <button onClick={regenerate} title="Ask Arthur to answer this again"
                  style={{ marginTop:'6px', fontSize:'11px', color: msg.failed ? '#2563EB' : '#94A3B8', fontWeight: msg.failed ? 600 : 400, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                  ↻ {msg.failed ? 'Try again' : 'Regenerate'}
                </button>
              )}
              {msg.events && msg.events.length > 0 && (
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'6px' }}>
                  {msg.events.map((ev, n) => (
                    <span key={n} className={`badge ${ev.correct ? 'badge-green' : 'badge-amber'}`} style={{ fontSize:'11px' }}>
                      {ev.correct ? '✓' : '↺'} {ev.topic}: {ev.before}% → {ev.after}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>

      {/* Quick starters — only when no user messages yet */}
      {!hasUserMessages && !streaming && (
        <div style={{ padding:'0 24px 12px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {(QUICK_STARTERS[course] || []).map(q => (
            <button
              key={q.label}
              onClick={() => send(q.prompt)}
              style={{
                fontSize:'12px', padding:'6px 12px', borderRadius:'8px',
                border:'1.5px solid #E2E8F0', background:'#fff', color:'#475569',
                cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='#93C5FD'; (e.currentTarget as HTMLElement).style.color='#2563EB' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='#E2E8F0'; (e.currentTarget as HTMLElement).style.color='#475569' }}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Contextual suggestions mid-chat */}
      {hasUserMessages && !streaming && (
        <div style={{ padding:'0 24px 10px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {['Give me a practice question', 'Use a Kenyan example', 'Summarise key points', 'Quiz me on this'].map(s => (
            <button key={s} onClick={() => send(s)}
              style={{ fontSize:'11px', padding:'5px 10px', borderRadius:'7px', border:'1.5px solid #E2E8F0', background:'#fff', color:'#64748B', cursor:'pointer', fontFamily:'inherit' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'12px 24px 16px', background:'#fff', borderTop:'1px solid #E2E8F0', flexShrink:0 }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder={`Ask anything in ${selectedCourse.name}...`}
            style={{
              flex:1, resize:'none', padding:'10px 14px', borderRadius:'10px', fontSize:'13px',
              border:'1.5px solid #E2E8F0', background:'#F8FAFC', color:'#0F172A',
              fontFamily:'inherit', maxHeight:'100px', outline:'none', transition:'border-color .15s, background .15s',
            }}
            onFocus={e => { e.target.style.borderColor='#93C5FD'; e.target.style.background='#fff' }}
            onBlur={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC' }}
          />
          <button
            onClick={() => send()}
            disabled={streaming || !input.trim()}
            style={{
              width:'40px', height:'40px', borderRadius:'10px', border:'none',
              background: streaming||!input.trim() ? '#E2E8F0' : '#2563EB',
              color:'#fff', cursor: streaming||!input.trim() ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .15s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div style={{ marginTop:'7px', fontSize:'11px', color:'#94A3B8', textAlign:'center' }}>
          {GROUNDED_COURSES.includes(course)
            ? <>Arthur answers from {course} course materials and cites the notes it used (S3)</>
            : <>Arthur sticks to the {course} syllabus · Course materials not yet uploaded</>}
        </div>
      </div>

      {/* Ask your lecturer (S10) */}
      {flagModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px',
        }} onClick={() => setFlagModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'16px', padding:'24px', width:'460px', maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.15)' }}
            className="fade-up"
          >
            <div style={{ fontWeight:700, fontSize:'16px', color:'#0F172A', marginBottom:'6px' }}>Ask {selectedCourse.lecturer}</div>
            <p style={{ fontSize:'13px', color:'#64748B', marginBottom:'16px', lineHeight:1.5 }}>
              Arthur sends your question with context about what you&apos;ve been studying, so your lecturer can see where you&apos;re stuck.
            </p>
            <label style={{ fontSize:'11px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px' }}>Topic</label>
            <select value={flagTopic} onChange={e => setFlagTopic(e.target.value)}
              style={{ width:'100%', margin:'5px 0 12px', fontSize:'13px', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontFamily:'inherit', background:'#F8FAFC', color:'#0F172A' }}>
              {courseTopics(course).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ fontSize:'11px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.5px' }}>Your question</label>
            <textarea value={flagText} onChange={e => setFlagText(e.target.value)} rows={4} placeholder="What are you stuck on?"
              style={{ width:'100%', margin:'5px 0 12px', fontSize:'13px', padding:'10px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontFamily:'inherit', resize:'vertical', background:'#F8FAFC', color:'#0F172A', lineHeight:1.5 }}/>
            <div style={{ background:'#EFF6FF', borderRadius:'8px', padding:'12px', marginBottom:'20px', border:'1px solid #BFDBFE' }}>
              <div style={{ fontSize:'11px', fontWeight:600, color:'#1D4ED8', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.5px' }}>Context Arthur will include</div>
              <div style={{ fontSize:'12px', color:'#1E40AF', lineHeight:1.5 }}>{flagContext}</div>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => setFlagModal(false)} className="btn-ghost" style={{ flex:1 }}>Cancel</button>
              <button onClick={sendFlag} disabled={!flagText.trim() || !flagTopic} className="btn-primary" style={{ flex:2 }}>
                Send to {selectedCourse.lecturer} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
