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
    why: 'The first reply in any chat takes 15–20 seconds because Curriculum AI is reading the full course notes for the first time in that conversation; later replies are faster because that reading is cached. If the first thing the audience sees is a slow, silent wait, it reads as broken rather than as thorough — so the warm-up message exists purely to move that latency before anyone is watching, and to confirm the deployment, the API key and the venue network are all actually working together before it matters.',
    do: 'Sign in as the student account. Send one test chat message and confirm it answers within about 20 seconds, then click New chat to clear it. Have a short .md note ready to upload later (e.g. "Disposals: common mistakes"), and a phone hotspot on standby in case the venue Wi-Fi is unreliable.',
  },
  {
    role: 'student', title: 'Meet the student',
    say: 'This is Sara, a second-year BCom student. Curriculum AI is her study companion for each course.',
    why: 'The mastery ring next to each course and the "Curriculum AI suggests" line are not decoration — they are both computed live from Sara\'s per-topic scores in the mastery table. The suggested topic is simply whichever one currently has the lowest score, so what the audience is seeing is a real, personalized recommendation driven by her actual practice history, not a hand-picked talking point.',
    do: 'Point at the sidebar: courses with mastery rings, and "Curriculum AI suggests" pointing at her weakest topic, Depreciation (38%).',
  },
  {
    role: 'student', title: 'Start a session',
    say: 'Curriculum AI checks what she knows before teaching.',
    why: 'This is the diagnostic-first behaviour built into the system prompt: before explaining anything, Curriculum AI is instructed to probe what the student already understands and adapt its depth accordingly — simpler if she is struggling, deeper if she is confident. It is the difference between a companion that teaches *to* her and one that lectures *at* her regardless of where she is starting from.',
    do: 'Click "Start a session →" on the Depreciation topic and let Curriculum AI\'s first question land before moving on.',
  },
  {
    role: 'student', title: 'Ask a question',
    say: 'Curriculum AI answers only from the lecturer\'s approved notes, and shows where each point came from.',
    why: 'Every answer in SBS 201 is grounded in the actual course documents, attached to the model as citable source material — Curriculum AI cannot invent an answer outside them, and every claim it makes carries a numbered citation back to the exact passage it came from. This is the single most important trust point for faculty: it is not a general-purpose chatbot freelancing on the subject, it is constrained to teach only what the lecturer has put in front of it.',
    do: 'Ask: "Why do we subtract the residual value in straight-line depreciation?" Point out the numbered sources under the answer and, if there\'s time, click one open to show the exact quoted passage.',
  },
  {
    role: 'student', title: 'Practice & mastery update',
    why: 'Marking isn\'t cosmetic — when Curriculum AI judges an answer, it calls a tool (record_practice_result) that records the attempt and recalculates the score: roughly a quarter of the remaining distance to 100 on a correct answer, a 15% drop on a wrong one. That score change is what the chip and the progress panel are reflecting in real time, and it\'s the same number that just fed the "Curriculum AI suggests" recommendation and will feed the lecturer\'s class heatmap a moment from now.',
    do: 'Click "Give me a practice question" and answer it, e.g. "(240,000 − 40,000) ÷ 4 = 50,000 a year". Point out the chip under the feedback ("Depreciation: 38% → 54%") and the progress panel updating live.',
  },
  {
    role: 'student', title: 'Escalate to the lecturer',
    say: 'The question arrives with context: mastery, practice attempts, any misconception Curriculum AI noticed.',
    why: 'When a student flags a question, the app automatically attaches a short brief — current mastery percentage, how many practice attempts, and any specific misconception Curriculum AI has detected in her reasoning (not just a wrong answer, but a *wrong belief*). That means the lecturer opens the inbox already knowing exactly where this student is stuck, instead of starting cold from a bare question.',
    do: 'Click "Ask lecturer" and send.',
  },
  {
    role: 'lecturer', title: 'Switch to the lecturer',
    say: 'This is Prof. Mwangi\'s view of the whole class. Sara is a real signed-in student; the other 30 are a synthetic class for the demo.',
    why: 'The header switcher only appears because this demo account is deliberately grouped with the lecturer and HoD accounts — clicking it genuinely signs you into that account\'s real data (own email, own permissions), it is not a cosmetic skin change. The class itself is one real signed-up student (Sara) plus 30 synthetic students seeded in, so the aggregate numbers look like a full pilot cohort even this early.',
    do: 'Click "Lecturer" in the header switcher, then come back here and click Next.',
  },
  {
    role: 'lecturer', title: 'Class overview',
    why: 'The heatmap aggregates every signed-up student\'s per-topic mastery into one cohort view, so a lecturer can see at a glance where the whole class is struggling rather than reading 31 individual dashboards. "Draft with Curriculum AI" takes that same aggregate data — the weakest topics, the logged misconceptions, outstanding questions — and makes a live call to Claude to turn it into a timed tutorial plan, in front of the audience, in about 20–30 seconds.',
    do: 'Point at the heatmap of weak topics. Click "Draft with Curriculum AI" to turn it into a tutorial plan, and talk through the first item while it drafts.',
  },
  {
    role: 'lecturer', title: 'Individual students',
    why: 'The ● Live tag is what distinguishes Sara, a real person who just used the app, from the synthetic students around her — and her row is populated from the same mastery table the student view and the heatmap both read from, not a separate mock. Clicking in shows her full per-topic breakdown, including the practice question she answered a few minutes ago, which is the clearest proof in the whole demo that the three views are reading one shared, live dataset.',
    do: 'Open "Individual students". Sara is marked ● Live — click her row to show her topic scores, including the practice question she just answered.',
  },
  {
    role: 'lecturer', title: 'Answer the question',
    say: 'From now on Curriculum AI uses this answer for every SBS 201 student.',
    why: 'This is the closed loop that makes the system improve itself over time: replying to Sara answers her specifically, but clicking "Save answer to course material" turns that same answer into a new, citable source document. The next student who asks something similar doesn\'t get a generic response — they get a citation reading "Lecturer answer — Depreciation", meaning one lecturer\'s five minutes just became permanent course content for the whole class, not just a private reply.',
    do: 'Open "Student questions". Sara\'s question is at the top with Curriculum AI\'s context attached. Type a short reply, send it, then click "Save answer to course material".',
  },
  {
    role: 'lecturer', title: 'Approve new material',
    say: 'Nothing reaches students until the lecturer approves it.',
    why: 'Every uploaded document sits in a Pending state until a lecturer explicitly approves it — Curriculum AI will never answer from material that hasn\'t cleared that gate. This matters to faculty specifically because it means they retain full editorial control over what the AI is allowed to teach from; nothing is auto-ingested, and nothing is invisible to them before it goes live.',
    do: 'Open "Content & approval", click "Upload material", add the prepared note, then click "Approve".',
  },
  {
    role: 'student', title: 'Back to the student',
    say: 'One student asked, the lecturer answered once, and now Curriculum AI teaches it to every student.',
    why: 'The "Lecturer replies · 1 new" badge is driven by the same question-and-reply record created a minute ago in the lecturer view — nothing here is pre-scripted. Asking a fresh, related question and watching a new source appear labelled "Lecturer answer — Depreciation" is the payoff of the whole loop: it shows the audience, concretely, that the content base compounds from real classroom interactions instead of staying fixed at whatever the lecturer originally uploaded.',
    do: 'Click "Student" in the header switcher. Open "Lecturer replies · 1 new" to show Prof. Mwangi\'s answer, then start a new chat and ask a related question — a source should now read "Lecturer answer — Depreciation".',
  },
  {
    role: 'hod', title: 'Head of Department',
    say: 'This is what the department dashboard will report during the pilot: engagement, at-risk students, and CUE compliance. It\'s illustrative today; the numbers become real once the pilot runs.',
    why: 'Unlike the student and lecturer views, nothing on this screen is backed by live data yet — it exists to show the shape of what cross-course reporting will look like once more than one course and one real cohort are running through the system. Saying this plainly, before anyone asks, is what keeps the credibility built up over the last two views intact: the audience should trust that "live" means live and "illustrative" means illustrative, nothing blurred together.',
    do: 'Click "Head of Department" in the header switcher.',
  },
  {
    role: 'wrap', title: 'If asked what\'s real',
    why: 'This is a quick-reference answer for Q&A, not a step to perform. The dividing line is simple: anything that involved an actual Claude call or a database write during this demo is real — the chat answers and citations, the practice marking and mastery changes, the lecturer inbox, the reply-and-save flow, and the material approval gate. Anything that depends on scale this pilot doesn\'t have yet is staged — the 30 synthetic classmates, the eight weeks of comprehension trend history, and the entire Head of Department view.',
    do: 'Real: Curriculum AI\'s answers, citations and practice marking (live Claude calls); mastery changes from practice; the full ask-lecturer → inbox → reply → saved-to-course flow; material upload and approval. Staged: the other 30 students in the class; weeks 1–8 of the comprehension trend; the entire Head of Department view.',
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
