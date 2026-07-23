'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { TOPIC_PROGRESS, QUICK_STARTERS, WELCOME_MESSAGES } from './studentData'

interface Message { role: 'user'|'assistant'; content: string; flagged?: boolean }

function renderMd(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^(\d+\.) /gm, '<br/>$1 ')
    .replace(/\n\n/g, '</p><p style="margin-top:.45rem">')
    .replace(/\n/g, '<br/>')
}

export default function StudentChat({ selectedCourse, showProgress, setShowProgress }: any) {
  const [messages, setMessages] = useState<Message[]>([
    { role:'assistant', content: WELCOME_MESSAGES[selectedCourse.code] }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [flagModal, setFlagModal] = useState(false)
  const [flagText, setFlagText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevCode = useRef(selectedCourse.code)

  useEffect(() => {
    if (selectedCourse.code !== prevCode.current) {
      prevCode.current = selectedCourse.code
      setMessages([{ role:'assistant', content: WELCOME_MESSAGES[selectedCourse.code] }])
    }
  }, [selectedCourse.code])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const topics = TOPIC_PROGRESS[selectedCourse.code] || []
  const weakest = topics.reduce((w,t) => t.score < w.score ? t : w, topics[0])
  const studentProgress = { weakest: weakest?.topic, topics: topics.map(t => ({ [t.topic]: t.score })) }

  const send = useCallback(async (text?: string) => {
    const content = text || input.trim()
    if (!content || streaming) return
    setInput('')
    const newMsgs: Message[] = [...messages, { role:'user', content }]
    setMessages(newMsgs)
    setStreaming(true)
    setMessages(prev => [...prev, { role:'assistant', content:'' }])
    try {
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ messages: newMsgs, courseCode: selectedCourse.code, studentProgress }),
      })
      if (!res.ok) throw new Error()
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream:true })
        setMessages(prev => { const u=[...prev]; u[u.length-1]={role:'assistant',content:acc}; return u })
      }
    } catch {
      setMessages(prev => { const u=[...prev]; u[u.length-1]={role:'assistant',content:"I'm having trouble connecting. Please check that ANTHROPIC_API_KEY is set, then try again."}; return u })
    } finally { setStreaming(false) }
  }, [input, messages, streaming, selectedCourse.code, studentProgress])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const flagToLecturer = () => {
    const lastUser = [...messages].reverse().find(m => m.role==='user')
    setFlagText(lastUser?.content || '')
    setFlagModal(true)
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#F8FAFC', minWidth:0 }}>

      {/* Chat header */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'12px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
      }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'14px', color:'#0F172A' }}>
            {selectedCourse.name} — {selectedCourse.code}
          </div>
          <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'2px' }}>
            {selectedCourse.lecturer} · Grounded in suLMS course materials · S3 ✓
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button
            onClick={flagToLecturer}
            style={{
              fontSize:'12px', fontWeight:500, padding:'6px 12px', borderRadius:'8px',
              border:'1.5px solid #E2E8F0', background:'#fff', color:'#475569',
              cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontFamily:'inherit',
            }}
            title="Flag question to lecturer (S10)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Ask lecturer
          </button>
          <button
            onClick={() => setShowProgress(!showProgress)}
            style={{
              fontSize:'12px', fontWeight:500, padding:'6px 12px', borderRadius:'8px',
              border:'1.5px solid #E2E8F0', background: showProgress ? '#EFF6FF' : '#fff',
              color: showProgress ? '#2563EB' : '#475569',
              cursor:'pointer', fontFamily:'inherit',
            }}
          >
            {showProgress ? 'Hide' : 'Show'} progress
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:600, color:'#059669', background:'#ECFDF5', padding:'5px 10px', borderRadius:'7px' }}>
            <span className="ai-pulse" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#059669', display:'inline-block' }}/>
            Arthur active
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {messages.map((msg, i) => (
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
                {msg.role==='assistant' && msg.content==='' && streaming ? (
                  <span style={{ display:'flex', gap:'5px', alignItems:'center', padding:'2px 0' }}>
                    <span className="thinking-dot"/><span className="thinking-dot"/><span className="thinking-dot"/>
                  </span>
                ) : (
                  <p dangerouslySetInnerHTML={{ __html:`<p>${renderMd(msg.content)}</p>` }} style={{margin:0}}/>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>

      {/* Quick starters — only when no user messages yet */}
      {messages.filter(m => m.role==='user').length === 0 && (
        <div style={{ padding:'0 24px 12px', display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {(QUICK_STARTERS[selectedCourse.code] || []).map(q => (
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
      {messages.filter(m => m.role==='user').length > 0 && !streaming && (
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
            ref={inputRef}
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
          Arthur only uses {selectedCourse.code} course materials · Answers cite source topics (S3)
        </div>
      </div>

      {/* Flag to lecturer modal (S10) */}
      {flagModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:100,
        }} onClick={() => setFlagModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'16px', padding:'24px', width:'440px', boxShadow:'0 20px 60px rgba(0,0,0,.15)' }}
            className="fade-up"
          >
            <div style={{ fontWeight:700, fontSize:'16px', color:'#0F172A', marginBottom:'6px' }}>Ask your lecturer</div>
            <p style={{ fontSize:'13px', color:'#64748B', marginBottom:'16px', lineHeight:1.5 }}>
              Arthur will send your question to Prof. Mwangi with context about what you've been studying and where you're stuck. This is feature S10.
            </p>
            <div style={{ background:'#F8FAFC', borderRadius:'8px', padding:'12px', marginBottom:'16px', border:'1px solid #E2E8F0' }}>
              <div style={{ fontSize:'11px', fontWeight:600, color:'#94A3B8', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.5px' }}>Your question</div>
              <div style={{ fontSize:'13px', color:'#0F172A' }}>{flagText || 'Your current question'}</div>
            </div>
            <div style={{ background:'#EFF6FF', borderRadius:'8px', padding:'12px', marginBottom:'20px', border:'1px solid #BFDBFE' }}>
              <div style={{ fontSize:'11px', fontWeight:600, color:'#1D4ED8', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'.5px' }}>Context Arthur will include</div>
              <div style={{ fontSize:'12px', color:'#1E40AF' }}>
                Topic: Depreciation (SBS 201) · Your mastery: 38% · Sessions: 1 · Last active: 1 week ago · What you've tried: walking through straight-line method
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => setFlagModal(false)} className="btn-ghost" style={{ flex:1 }}>Cancel</button>
              <button
                onClick={() => { setFlagModal(false); alert('✓ Question sent to Prof. Mwangi. Arthur will notify you when he replies.') }}
                className="btn-primary" style={{ flex:2 }}
              >
                Send to Prof. Mwangi →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
