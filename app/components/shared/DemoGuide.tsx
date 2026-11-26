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
  why: string
  do: string
}

const STEPS: Step[] = [
  {
    role: 'setup', title: 'Before the audience arrives',
    why: 'The first reply in a chat takes 15 to 20 seconds while Study Buddy reads the course notes; later replies are faster.',
    do: 'Open two browser windows (one private). Have two new email addresses ready for Learner A and Learner B. Send one test message on an existing account to warm up the course.',
  },
  {
    role: 'student', title: 'Learner A takes the assessment',
    say: 'Every learner starts with a 12-minute assessment, so Study Buddy knows how to teach them.',
    why: 'It measures only what changes the teaching: starting level, how much to teach at once, reading level, and whether confidence matches accuracy.',
    do: 'In window 1, sign up as Learner A. Answer as a beginner: miss the harder Power BI questions, recall 3 or 4 digits, choose 20-minute sessions. Show the profile card.',
  },
  {
    role: 'student', title: 'Learner A practises',
    say: 'Same course, but pitched for her: short sets, plain wording.',
    why: 'The profile is sent with the chat, so set size, difficulty and wording follow it.',
    do: 'Click "Start a session" on a topic. Point out the 3-question set and the plain explanations. Answer one question to show mastery moving.',
  },
  {
    role: 'student', title: 'Learner B takes the assessment',
    say: 'A learner with more experience gets a different profile.',
    why: 'The header switcher swaps roles, not students, so the second learner needs a second window.',
    do: 'In window 2, sign up as Learner B. Answer the Power BI questions well and rate yourself "Certain", recall 6 or 7 digits, choose 40-minute sessions.',
  },
  {
    role: 'student', title: 'Learner B practises the same topic',
    say: 'Same topic, different teaching.',
    why: 'Longer, harder sets; if B was more sure than accurate, Study Buddy asks how sure they were before revealing each answer.',
    do: 'Click "Start a session" on the same topic. Compare with window 1: set length, difficulty and wording.',
  },
  {
    role: 'lecturer', title: 'The lecturer sees both learners',
    say: 'Both learners show up in the class view as live students.',
    why: 'Mastery comes from the practice results Study Buddy records in the chat.',
    do: 'Sign in as the lecturer account (or switch to Lecturer if you started on a demo account). Open "Individual students" and show both learners\' topic scores.',
  },
  {
    role: 'wrap', title: 'Close',
    say: 'Every learner gets a profile on day one, and every practice set is pitched to it.',
    why: 'Next: quiz and flashcard screens and impact reports built on the same profile.',
    do: 'Take questions. "Retake" in Your Progress shows a learner can redo the assessment at any time.',
  },
]

const ROLE_COLOR: Record<string, string> = { student:'#2E4A86', lecturer:'#0D9488', hod:'#D97706', setup:'#64748B', wrap:'#64748B' }
const ROLE_LABEL: Record<string, string> = { student:'Student', lecturer:'Lecturer', hod:'Head of Department', setup:'Setup', wrap:'Wrap-up' }
const STORAGE_KEY = 'study-buddy-demo-guide-step'

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
          background:'#0D1B3D', color:'#fff', fontSize:'11px', fontWeight:600,
          boxShadow:'0 6px 20px rgba(0,0,0,.25)',
        }}
      >
        Guide
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
        <div style={{ fontSize:'12px', color:'#475569', lineHeight:1.5, marginBottom:'8px' }}>
          <span style={{ fontWeight:600, color:'#0F172A' }}>Why it matters: </span>{step.why}
        </div>
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
