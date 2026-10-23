'use client'
import { useEffect, useState } from 'react'
import type { Role } from '../../lib/demoData'

// A presenter's cue card for the live walkthrough, embedded in the app itself
// so there's no separate script to juggle. Mirrors docs/demo-script.md.
// Only shown to accounts in a demo_group (the same ones that get the view switcher).

interface Step {
  role: Role | 'setup' | 'wrap'
  title: string
  say?: string
  do: string
}

const STEPS: Step[] = [
  {
    role: 'setup', title: 'Before the audience arrives',
    do: 'Sign in as the student account. Send one test chat message and confirm it answers within ~20 seconds. Have a short .md note ready to upload later (e.g. "Disposals: common mistakes").',
  },
  {
    role: 'student', title: 'Meet the student',
    say: 'This is Sara, a second-year BCom student. Curriculum AI is her study companion for each course.',
    do: 'Point at the sidebar: courses with mastery rings, and "Curriculum AI suggests" pointing at her weakest topic, Depreciation (38%).',
  },
  {
    role: 'student', title: 'Start a session',
    say: 'Curriculum AI checks what she knows before teaching.',
    do: 'Click "Start a session →" on the Depreciation topic.',
  },
  {
    role: 'student', title: 'Ask a question',
    say: 'Curriculum AI answers only from the lecturer\'s approved notes, and shows where each point came from.',
    do: 'Ask: "Why do we subtract the residual value in straight-line depreciation?" Point out the numbered sources under the answer.',
  },
  {
    role: 'student', title: 'Practice & mastery update',
    do: 'Click "Give me a practice question" and answer it, e.g. "(240,000 − 40,000) ÷ 4 = 50,000 a year". Point out the chip under the feedback and the progress panel updating.',
  },
  {
    role: 'student', title: 'Escalate to the lecturer',
    say: 'The question arrives with context: mastery, practice attempts, any misconception Curriculum AI noticed.',
    do: 'Click "Ask lecturer" and send.',
  },
  {
    role: 'lecturer', title: 'Switch to the lecturer',
    say: 'This is Prof. Mwangi\'s view of the whole class. Sara is a real signed-in student; the other 30 are a synthetic class for the demo.',
    do: 'Click "Lecturer" in the header switcher, then come back here and click Next.',
  },
  {
    role: 'lecturer', title: 'Class overview',
    do: 'Point at the heatmap of weak topics. Click "Draft with Curriculum AI" to turn it into a tutorial plan.',
  },
  {
    role: 'lecturer', title: 'Individual students',
    do: 'Open "Individual students". Sara is marked ● Live — click her row to show her topic scores, including the practice question she just answered.',
  },
  {
    role: 'lecturer', title: 'Answer the question',
    say: 'From now on Curriculum AI uses this answer for every SBS 201 student.',
    do: 'Open "Student questions". Sara\'s question is at the top with Curriculum AI\'s context. Type a short reply, send it, then click "Save answer to course material".',
  },
  {
    role: 'lecturer', title: 'Approve new material',
    say: 'Nothing reaches students until the lecturer approves it.',
    do: 'Open "Content & approval", click "Upload material", add the prepared note, then click "Approve".',
  },
  {
    role: 'student', title: 'Back to the student',
    say: 'One student asked, the lecturer answered once, and now Curriculum AI teaches it to every student.',
    do: 'Click "Student" in the header switcher. Open "Lecturer replies · 1 new", then start a new chat and ask a related question — a source now reads "Lecturer answer — Depreciation".',
  },
  {
    role: 'hod', title: 'Head of Department',
    say: 'This is what the department dashboard will report during the pilot: engagement, at-risk students, and CUE compliance. It\'s illustrative today; the numbers become real once the pilot runs.',
    do: 'Click "Head of Department" in the header switcher.',
  },
  {
    role: 'wrap', title: 'If asked what\'s real',
    do: 'Real: Curriculum AI\'s answers, citations, practice marking, mastery changes, the lecturer inbox and approval flow. Staged: the other 30 students, weeks 1–8 of the trend, and the whole HoD view.',
  },
]

const ROLE_COLOR: Record<string, string> = { student:'#3B82F6', lecturer:'#0D9488', hod:'#D97706', setup:'#64748B', wrap:'#64748B' }
const ROLE_LABEL: Record<string, string> = { student:'Student', lecturer:'Lecturer', hod:'Head of Department', setup:'Setup', wrap:'Wrap-up' }
const STORAGE_KEY = 'curriculum-ai-demo-guide-step'

export default function DemoGuide() {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY))
      if (Number.isInteger(saved) && saved >= 0 && saved < STEPS.length) setI(saved)
    } catch {}
  }, [])

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next))
    setI(clamped)
    try { localStorage.setItem(STORAGE_KEY, String(clamped)) } catch {}
  }

  const step = STEPS[i]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open the demo walkthrough"
        style={{
          position:'fixed', right:'20px', bottom:'20px', zIndex:50,
          width:'44px', height:'44px', borderRadius:'50%', border:'none', cursor:'pointer',
          background:'#1E3A5F', color:'#fff', fontSize:'18px',
          boxShadow:'0 6px 20px rgba(0,0,0,.25)',
        }}
      >
        🧭
      </button>
    )
  }

  return (
    <div style={{
      position:'fixed', right:'20px', bottom:'20px', zIndex:50, width:'340px',
      background:'#fff', borderRadius:'14px', boxShadow:'0 12px 40px rgba(0,0,0,.25)', border:'1px solid #E2E8F0',
      display:'flex', flexDirection:'column', maxHeight:'min(520px, 80vh)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid #F1F5F9' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{
            fontSize:'10px', fontWeight:700, padding:'3px 8px', borderRadius:'999px', color:'#fff',
            background:ROLE_COLOR[step.role],
          }}>
            {ROLE_LABEL[step.role]}
          </span>
          <span style={{ fontSize:'11px', color:'#94A3B8' }}>Step {i + 1} of {STEPS.length}</span>
        </div>
        <button onClick={() => setOpen(false)} style={{ border:'none', background:'none', cursor:'pointer', color:'#94A3B8', fontSize:'16px', padding:'2px 4px' }}>×</button>
      </div>

      <div style={{ padding:'14px', overflow:'auto' }}>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', marginBottom:'8px' }}>{step.title}</div>
        {step.say && (
          <div style={{ fontSize:'12px', color:'#475569', lineHeight:1.5, marginBottom:'8px' }}>
            <span style={{ fontWeight:600, color:'#0F172A' }}>Say: </span>"{step.say}"
          </div>
        )}
        <div style={{ fontSize:'12px', color:'#475569', lineHeight:1.5 }}>
          <span style={{ fontWeight:600, color:'#0F172A' }}>Do: </span>{step.do}
        </div>
      </div>

      <div style={{ display:'flex', gap:'8px', padding:'12px 14px', borderTop:'1px solid #F1F5F9' }}>
        <button onClick={() => go(i - 1)} disabled={i === 0} className="btn-ghost" style={{ flex:1, fontSize:'12px', padding:'7px', opacity: i === 0 ? 0.4 : 1 }}>
          ← Back
        </button>
        {i < STEPS.length - 1 ? (
          <button onClick={() => go(i + 1)} className="btn-primary" style={{ flex:1, fontSize:'12px', padding:'7px' }}>
            Next →
          </button>
        ) : (
          <button onClick={() => go(0)} className="btn-primary" style={{ flex:1, fontSize:'12px', padding:'7px' }}>
            Restart
          </button>
        )}
      </div>
    </div>
  )
}
