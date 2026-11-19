// Fills the Power BI course (BI-Apr-26) with demo data, so the student, lecturer and HoD
// views have something to show before real students arrive.
//
//   node --env-file=.env.local scripts/seed-demo.mjs
//
// It links the three demo accounts in one demo group (one-click view switching), switches on
// the course's synthetic class, and gives the demo student a few weeks of progress, a chat,
// and questions for the lecturer. Running it again resets the demo data to this starting
// point: the demo student's progress in the course is replaced, and rows this script created
// (ids starting "demo-") are rewritten. Real students' work is never touched.
import { createClient } from '@supabase/supabase-js'

const COURSE = 'BI-Apr-26'
const GROUP = 'demo1'
const CURRENT_WEEK = 6
const STUDENT = { email: 'emuriithi42@gmail.com', subtitle: 'Part-time · BI with Power BI · April 2026' }
const LECTURER = { email: 'murayinnovations@gmail.com', subtitle: 'Lecturer · Data Science Centre' }
const HOD = { email: 'murayinnovations+hod@gmail.com', subtitle: 'Head, Data Science Centre' }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (run with --env-file=.env.local).')
const db = createClient(url, key, { auth: { persistSession: false } })

function fail(message) {
  console.error(message)
  process.exit(1)
}

const check = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

const DAY = 86_400_000
const HOUR = 3_600_000
const ago = ms => new Date(Date.now() - ms).toISOString()

// The same ids the lecturer dashboards give the synthetic class (app/lib/cohort.ts).
const syntheticId = i => `STR-2024-${1100 + ((i * 2731 + 517) % 8800)}`

// ---- Accounts and course ----

const course = check(await db.from('courses').select('code, topics').eq('code', COURSE).maybeSingle())
if (!course) fail(`Course ${COURSE} not found. Import it first with scripts/import-course.mjs.`)

const accounts = check(await db.from('members').select('email, role, student_id').in('email', [STUDENT.email, LECTURER.email, HOD.email]))
const byEmail = Object.fromEntries(accounts.map(a => [a.email, a]))
for (const [who, { email }, role] of [['student', STUDENT, 'student'], ['lecturer', LECTURER, 'lecturer'], ['HoD', HOD, 'hod']]) {
  if (byEmail[email]?.role !== role) fail(`The demo ${who} ${email} isn't a ${role}. Add them with scripts/members.mjs first.`)
}
const sid = byEmail[STUDENT.email].student_id

// One member per role in the group, or the view switcher can't tell which account to open.
check(await db.from('members').update({ demo_group: null }).eq('demo_group', GROUP).not('email', 'in', `(${[STUDENT.email, LECTURER.email, HOD.email].map(e => `"${e}"`).join(',')})`))
for (const m of [STUDENT, LECTURER, HOD]) {
  check(await db.from('members').update({ demo_group: GROUP, subtitle: m.subtitle }).eq('email', m.email))
}
check(await db.from('members').update({ course: COURSE }).eq('email', LECTURER.email))
check(await db.from('courses').update({ synthetic_class: true, current_week: CURRENT_WEEK }).eq('code', COURSE))

// ---- The demo student's progress ----

// Strong on Excel basics, shaky on lookups, DAX and data modelling: the story the demo tells.
// [score, sessions, days since last practice]
const PROGRESS = {
  'Excel foundations & data types': [84, 6, 21],
  'Sorting, filtering & dynamic arrays': [77, 5, 18],
  'Data cleaning & text functions': [69, 4, 15],
  'Lookup functions': [46, 5, 2],
  'Charts & graphing': [72, 3, 12],
  'PivotTables, Power Pivot & DAX': [38, 4, 1],
  'Excel dashboards': [58, 2, 9],
  'VBA & macros': [31, 1, 10],
  'Storytelling with data': [64, 2, 8],
  'Introduction to BI': [75, 3, 6],
  'BI requirements & documentation': [61, 2, 5],
  'Data modeling & relationships': [49, 3, 3],
  'Power BI reports & dashboards': [55, 2, 4],
}

const mastery = course.topics.map((t, i) => {
  const [score, sessions, days] = PROGRESS[t.topic] ?? [0, 0, null]
  return {
    student_id: sid, course: COURSE, topic: t.topic, position: i, score, sessions,
    week: t.week ?? null, practised_at: days === null ? null : ago(days * DAY + 3 * HOUR),
  }
})
check(await db.from('mastery').delete().match({ student_id: sid, course: COURSE }))
check(await db.from('mastery').insert(mastery))

// Practice answers spread over each topic's sessions, ending on the last practice date.
const practice = []
for (const [topic, [score, sessions, days]] of Object.entries(PROGRESS)) {
  const answers = sessions * 2
  for (let n = 0; n < answers; n++) {
    const correct = (n * 37 + topic.length * 11) % 100 < score
    practice.push({ student_id: sid, course: COURSE, topic, correct, created_at: ago((days + (answers - n) * 1.5) * DAY) })
  }
}
check(await db.from('practice_log').delete().match({ student_id: sid, course: COURSE }))
check(await db.from('practice_log').insert(practice))

// ---- The demo student's chat ----

const firstName = 'Eric'
const messages = [
  { role: 'assistant', content: `Hi ${firstName} 👋 I'm Study Buddy, your study companion for **Business Intelligence with Power BI**.\n\nI answer from your lecturer's approved course material and show you where each answer comes from. I can also set you practice questions, and I'll keep track of how you're doing on each topic.\n\nWhat would you like to work on first?` },
  { role: 'user', content: 'When should I use XLOOKUP instead of VLOOKUP?' },
  {
    role: 'assistant',
    content: `Use **XLOOKUP** whenever you have it. It does everything VLOOKUP does, with fewer traps:\n\n- **It looks left as well as right.** VLOOKUP can only return columns to the right of the lookup column.\n- **Exact match is the default.** VLOOKUP defaults to an approximate match, which quietly returns wrong values on unsorted data.\n- **It doesn't break when columns move.** You point at the return column itself, not a column number.\n- **It has a built-in "not found" value**, so you don't need IFERROR.\n\nThe Lookup Functions notes list the match modes:`,
    sources: [{ title: 'Lookup Functions', quote: 'match_mode: 0=exact · -1=next smaller · 1=next larger · 2=wildcard' }],
  },
  { role: 'user', content: 'Give me a practice question on writing a DAX measure.' },
  {
    role: 'assistant',
    content: `Here's one from the AdventureWorks model in your notes:\n\nYou have a measure **[Revenue]** and a Calendar table related to **Fact_Orders[Order Date]**. Write a measure that returns **year-to-date revenue**.`,
    sources: [{ title: 'Data Model, Power Pivot, PivotTables & DAX Measures', quote: 'YTD Revenue := CALCULATE([Revenue],DATESYTD(Fact_Orders[Order Date]))' }],
  },
  { role: 'user', content: 'YTD Revenue := SUM([Revenue]) + DATESYTD(Fact_Orders[Order Date])' },
  {
    role: 'assistant',
    content: `Not quite. **DATESYTD** returns a *table of dates*, so you can't add it to a number. It's meant to be a filter, and **CALCULATE** is what applies a filter to a measure:\n\n\`YTD Revenue := CALCULATE([Revenue], DATESYTD(Fact_Orders[Order Date]))\`\n\nRead it as: "work out [Revenue], but only for dates from the start of the year up to now." Want to try a year-on-year growth measure next?`,
    events: [{ kind: 'practice', topic: 'PivotTables, Power Pivot & DAX', correct: false, before: 45, after: 38 }],
    misconceptions: [{ topic: 'PivotTables, Power Pivot & DAX', note: 'Treats time-intelligence functions like DATESYTD as values to add, instead of filters inside CALCULATE.' }],
  },
]
check(await db.from('chats').upsert({ student_id: sid, course: COURSE, messages, updated_at: ago(1 * DAY) }))

// ---- Lecturer inbox, misconceptions, goals, materials ----

const demoIds = table => db.from(table).delete().eq('course', COURSE).like('id', 'demo-%')
await Promise.all(['questions', 'misconceptions', 'goals', 'materials'].map(t => demoIds(t).then(check)))

// A bulk insert sends every column for every row, so give the unanswered ones explicit values.
check(await db.from('questions').insert([
  {
    id: 'demo-q1', course: COURSE, student_id: sid, topic: 'PivotTables, Power Pivot & DAX', urgency: 'High',
    question: 'When do I need CALCULATE in a measure? My YTD revenue measure keeps showing the same number for every month.',
    context: 'Mastery 38% on PivotTables, Power Pivot & DAX. Got a DATESYTD practice question wrong yesterday.',
    created_at: ago(5 * HOUR),
  },
  {
    id: 'demo-q2', course: COURSE, student_id: sid, topic: 'Data modeling & relationships', urgency: 'Medium',
    question: 'Should the relationship go from the fact table to the dimension table, or the other way round?',
    context: 'Mastery 49% on Data modeling & relationships.',
    created_at: ago(3 * DAY),
    reply: 'Dimension to fact: one row in the dimension (one customer) relates to many rows in the fact table (their orders). In Power BI that is one-to-many, with the filter flowing from the dimension into the fact table. Have another look at the Relationships slides from week 5.',
    replied_at: ago(2 * DAY), seen_by_student: false,
  },
  {
    id: 'demo-q3', course: COURSE, student_id: syntheticId(4), topic: 'Lookup functions', urgency: 'Medium',
    question: 'My VLOOKUP returns the wrong price for some products, but no error. What am I doing wrong?',
    context: 'Mastery 41% on Lookup functions.',
    created_at: ago(9 * HOUR),
  },
  {
    id: 'demo-q4', course: COURSE, student_id: syntheticId(11), topic: 'Power BI reports & dashboards', urgency: 'Low',
    question: 'Can I use the same slicer to filter two report pages?',
    context: 'Mastery 62% on Power BI reports & dashboards.',
    created_at: ago(1 * DAY + 4 * HOUR),
  },
  {
    id: 'demo-q5', course: COURSE, student_id: syntheticId(19), topic: 'PivotTables, Power Pivot & DAX', urgency: 'High',
    question: 'What is the difference between SUM and SUMX? The notes use both.',
    context: 'Mastery 35% on PivotTables, Power Pivot & DAX.',
    created_at: ago(2 * DAY),
  },
].map(q => ({ reply: null, replied_at: null, seen_by_student: false, ...q }))))

check(await db.from('misconceptions').insert([
  ['demo-m1', 'PivotTables, Power Pivot & DAX', 'Treats time-intelligence functions like DATESYTD as values to add, instead of filters inside CALCULATE.', 1 * DAY],
  ['demo-m2', 'Lookup functions', 'Leaves VLOOKUP on its default approximate match, so unsorted data returns wrong values without an error.', 1 * DAY + 6 * HOUR],
  ['demo-m3', 'PivotTables, Power Pivot & DAX', 'Uses SUM where a row-by-row SUMX is needed, e.g. quantity × price.', 2 * DAY],
  ['demo-m4', 'Data modeling & relationships', 'Puts descriptive text columns in the fact table instead of a dimension table.', 3 * DAY],
  ['demo-m5', 'Data modeling & relationships', 'Expects the relationship filter to flow from the fact table to the dimension.', 3 * DAY + 5 * HOUR],
  ['demo-m6', 'Data cleaning & text functions', 'Uses TRIM to remove non-breaking spaces from pasted web data; TRIM only removes normal spaces.', 5 * DAY],
  ['demo-m7', 'Lookup functions', 'Locks the wrong part of the lookup range, so it shifts when the formula is copied down.', 6 * DAY],
].map(([id, topic, note, when]) => ({ id, course: COURSE, topic, note, created_at: ago(when) }))))

check(await db.from('goals').insert([
  ['demo-g1', 'Clean and prepare raw business data in Excel', 'Weeks 1–2', true],
  ['demo-g2', 'Build lookups and PivotTables to answer business questions', 'Weeks 2–3', true],
  ['demo-g3', 'Write DAX measures for common business metrics', 'Week 3', true],
  ['demo-g4', 'Design a star-schema data model in Power BI', 'Week 5', true],
  ['demo-g5', 'Present a data story to non-technical stakeholders', 'Week 7', false],
].map(([id, goal, week, mapped], i) => ({ id, course: COURSE, goal, week, mapped, created_at: ago((10 - i) * DAY) }))))

check(await db.from('materials').insert({
  id: 'demo-u1', course: COURSE, title: 'Week 6 revision sheet: CALCULATE and filter context', type: 'Revision sheet',
  topics: ['PivotTables, Power Pivot & DAX'], status: 'pending', source: 'lecturer', position: 0, created_at: ago(4 * HOUR),
  body: `CALCULATE changes the filter context a measure is evaluated in.\n\n1. CALCULATE([Revenue], Product[Category] = "Bikes") returns revenue for bikes only, whatever else is filtered.\n2. Time intelligence works the same way: CALCULATE([Revenue], DATESYTD(Calendar[Date])) returns year-to-date revenue.\n3. Without CALCULATE, a filter function such as DATESYTD returns a table, not a number.\n\nPractice: write a measure for last year's revenue using SAMEPERIODLASTYEAR.`,
}))

// A brief drafted before this data would show as out of date; start without one.
check(await db.from('briefs').delete().eq('course', COURSE))
check(await db.from('check_ins').delete().eq('course', COURSE))

console.log(`Demo data ready for ${COURSE}:`)
console.log(`  ${STUDENT.email}: ${mastery.filter(m => m.sessions).length} topics practised, ${practice.length} practice answers, a chat, 2 questions (1 answered)`)
console.log(`  ${LECTURER.email}: 30 synthetic students + the demo student, 4 open questions, 7 misconceptions, 5 goals, 1 upload to approve`)
console.log(`  ${HOD.email}: sees ${COURSE} as a live course`)
console.log(`  All three are in demo group "${GROUP}" for one-click switching. Changes reach a running app within a minute.`)
