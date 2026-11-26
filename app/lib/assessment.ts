import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { calibrationOf, type Band, type Calibration, type ChunkSize, type CognitiveProfile, type ReadingLevel } from './profile'

// The onboarding assessment: what it asks and how it is scored. Server only, because
// the answers are here; the browser gets publicAssessment() without them.
//
// Five short blocks, about 12 minutes:
//   1. Prior knowledge: 8 course questions, easy to hard, for the first course with a bank
//      (the lecturer's approved one in assessment_banks, else a built-in one below)
//   2. Working memory: remember a sequence of digits, 4 to 8 long, two tries per length
//   3. Reading: three short passages, two questions each, timed silently
//   4. Confidence: how sure they were, after each block 1 answer
//   5. Study context: time, device, preferences, accessibility, and familiarity with
//      any course that has no question bank yet
// Questions and passages are drawn from larger pools, avoiding the ones the learner saw in
// their last sitting, so a retake isn't a memory test of the first one.
// There is deliberately no "learning styles" block: that model has weak evidence.
//
// Every result is a starting point, not a measurement: practice moves the profile as the
// learner goes (adaptToPractice in profile.ts), and scripts/validate-profiles.mjs checks
// how well starting levels predicted practice.

export interface Choice { id: string; prompt: string; options: string[]; answer: number }
export interface KnowledgeItem extends Choice { level: 1 | 2 | 3 }

interface Bank { match: (course: { code: string; name: string }) => boolean; items: KnowledgeItem[] }

// Business Intelligence with Power BI (the pilot course).
const POWER_BI: Bank = {
  match: c => /power\s*bi/i.test(c.name) || /^BI[-_]/i.test(c.code),
  items: [
    { id: 'pbi-1', level: 1, prompt: 'Which part of Power BI do you use to clean and reshape data before it is loaded into the model?',
      options: ['Power Query Editor', 'DAX formulas', 'Report view', 'A slicer'], answer: 0 },
    { id: 'pbi-2', level: 1, prompt: 'What does a slicer on a report page let the viewer do?',
      options: ['Change where the data comes from', 'Filter the visuals on the page', 'Write a new measure', 'Schedule a data refresh'], answer: 1 },
    { id: 'pbi-3', level: 1, prompt: 'Which visual best shows how monthly sales changed over a year?',
      options: ['Pie chart', 'Card', 'Line chart', 'Slicer'], answer: 2 },
    { id: 'pbi-4', level: 2, prompt: 'What is the main difference between a measure and a calculated column?',
      options: [
        'A calculated column is only for text; a measure is only for numbers',
        'A measure is calculated when a visual asks for it, using that visual\'s filters; a calculated column is worked out row by row and stored when the data refreshes',
        'They are the same thing with different names',
        'A measure can only be used in tables, a calculated column only in charts',
      ], answer: 1 },
    { id: 'pbi-5', level: 2, prompt: 'In a star schema, what does the fact table usually hold?',
      options: ['Descriptions such as product names and categories', 'One row per event, such as each sales line, with its numbers', 'Report formatting settings', 'A copy of every dimension table'], answer: 1 },
    { id: 'pbi-6', level: 2, prompt: 'A Customers table has one row per customer. A Sales table has many rows per customer. What relationship should link them?',
      options: ['Many-to-many', 'One-to-one', 'One-to-many, from Customers to Sales', 'No relationship is needed'], answer: 2 },
    { id: 'pbi-7', level: 3, prompt: 'What does the DAX function CALCULATE do?',
      options: [
        'Adds up a column',
        'Evaluates an expression in a filter context that it modifies',
        'Creates a new table from a query',
        'Rounds a number to a set number of decimals',
      ], answer: 1 },
    { id: 'pbi-8', level: 3, prompt: 'A table visual shows Total Sales = SUM(Sales[Amount]) by Region, but every region shows the same grand total. What is the most likely cause?',
      options: [
        'The measure should use AVERAGE instead of SUM',
        'The Region table has no active relationship with Sales, so the region filter never reaches the Sales table',
        'The visual needs to be a chart instead of a table',
        'The data has not been refreshed today',
      ], answer: 1 },
    { id: 'pbi-9', level: 1, prompt: 'Where do you publish a report so that colleagues can open it in a web browser?',
      options: ['Power BI Service', 'Power Query Editor', 'Model view', 'A calculated column'], answer: 0 },
    { id: 'pbi-10', level: 1, prompt: 'Which visual shows a single headline number, such as total revenue?',
      options: ['Scatter chart', 'Matrix', 'Card', 'Map'], answer: 2 },
    { id: 'pbi-11', level: 2, prompt: 'What does the cross-filter direction on a relationship control?',
      options: ['The sort order of a column', 'Which table\'s filters pass through to the other table', 'How often the data refreshes', 'Who is allowed to see the report'], answer: 1 },
    { id: 'pbi-12', level: 2, prompt: 'Why would you build a separate Date table and mark it as a date table?',
      options: ['To make the report load faster on phones', 'Because Power BI cannot read dates stored in other tables', 'To hide dates from report viewers', 'So time-intelligence functions such as year-to-date work reliably'], answer: 3 },
    { id: 'pbi-13', level: 3, prompt: 'What is the difference between SUM and SUMX?',
      options: [
        'SUMX can only add up text columns',
        'They are the same function with different names',
        'SUM adds up one column; SUMX works out an expression row by row over a table and adds the results',
        'SUM only works in calculated columns',
      ], answer: 2 },
    { id: 'pbi-14', level: 3, prompt: 'To show each region\'s share of sales, a measure needs total sales for all regions, ignoring the Region slicer. Which function removes that filter?',
      options: ['FILTER', 'RELATED', 'VALUES', 'ALL'], answer: 3 },
  ],
}

const BUILT_IN: Bank[] = [POWER_BI]

export const PASSAGES: { id: string; text: string; questions: Choice[] }[] = [
  {
    id: 'shop',
    text: 'Amina runs a small hardware shop in Thika. For years she wrote each sale in a notebook and added up the totals at the end of the month. Last year she started typing the same sales into a spreadsheet every evening. The spreadsheet did the adding for her, but the bigger change was something else: because each day was already counted, she noticed within a week that sales of cement fell every time it rained. She now orders less cement when the forecast shows rain, and less of her money sits in stock that is not selling.',
    questions: [
      { id: 'shop-1', prompt: 'What is the main point of the passage?', answer: 2, options: [
        'Spreadsheets are faster than notebooks for adding up totals',
        'Rain is bad for business in Thika',
        'Recording sales daily let Amina see a pattern and act on it',
        'Amina should stop selling cement',
      ] },
      { id: 'shop-2', prompt: 'Why does less of Amina\'s money sit in unsold stock now?', answer: 1, options: [
        'She sells more cement when it rains',
        'She orders less cement when rain is expected',
        'The spreadsheet tells her customers what to buy',
        'She closes the shop on rainy days',
      ] },
    ],
  },
  {
    id: 'spacing',
    text: 'Many students revise by reading the same notes over and over the night before an exam. It feels productive because the material becomes familiar. Familiar is not the same as remembered, however. Studies of memory consistently find that people retain more when they spread practice over several days and test themselves, rather than rereading. Each time you pull an answer out of memory, especially after a gap, the memory becomes easier to reach the next time. The effort that makes self-testing feel harder is part of why it works.',
    questions: [
      { id: 'spacing-1', prompt: 'According to the passage, why does rereading feel productive?', answer: 0, options: [
        'The material starts to feel familiar',
        'It is what most studies recommend',
        'It takes less time than self-testing',
        'Exams usually repeat the notes word for word',
      ] },
      { id: 'spacing-2', prompt: 'In the passage, "retain" most nearly means:', answer: 3, options: ['Repeat', 'Understand', 'Enjoy', 'Keep in memory'] },
    ],
  },
  {
    id: 'mpesa',
    text: 'When mobile money first spread in Kenya, many people used it only to send money home to relatives. Over time, small businesses found another use. A kiosk owner who accepts payments by phone has a record of every sale without writing anything down. Some lenders now look at these records when deciding whether to give a small loan, because a steady history of payments shows that the business is active. For owners with no bank account and no formal accounts, this record can be the first proof of income they have ever had.',
    questions: [
      { id: 'mpesa-1', prompt: 'What is the main point of the passage?', answer: 1, options: [
        'Mobile money is mainly used to send money to relatives',
        'Mobile money records can serve as evidence of a small business\'s income',
        'Kiosks should stop accepting cash',
        'Banks no longer lend to small businesses',
      ] },
      { id: 'mpesa-2', prompt: 'Why do some lenders look at mobile money records?', answer: 2, options: [
        'The records list the owner\'s relatives',
        'The law requires them to',
        'A steady history of payments shows the business is active',
        'The records mean the owner no longer needs a loan',
      ] },
    ],
  },
  {
    id: 'average',
    text: 'An average can hide as much as it shows. Suppose five people in a small office earn 40,000, 45,000, 50,000, 55,000 and 400,000 shillings a month. The mean salary is 118,000 shillings, yet four of the five earn less than half of that. The median, the middle value once the salaries are sorted, is 50,000 shillings, which describes a typical worker far better. When a few values are much larger than the rest, analysts often report the median alongside the mean, or instead of it.',
    questions: [
      { id: 'average-1', prompt: 'What is the passage mainly about?', answer: 3, options: [
        'Office salaries are too low',
        'The mean is always the wrong figure to use',
        'How to work out a salary increase',
        'One very large value can make the mean misleading, so the median is often more typical',
      ] },
      { id: 'average-2', prompt: 'According to the passage, the median salary is:', answer: 1, options: ['40,000 shillings', '50,000 shillings', '118,000 shillings', '400,000 shillings'] },
    ],
  },
  {
    id: 'meeting',
    text: 'Before a project meeting, Wanjiru sends each person a one-page summary of the decision to be made, the options, and the figures behind each. People arrive having already read it, so the meeting starts with questions rather than a presentation. Her meetings are shorter than her colleagues\', and her decisions hold, because objections are raised in the room rather than by email a week later.',
    questions: [
      { id: 'meeting-1', prompt: 'According to the passage, why do Wanjiru\'s decisions hold?', answer: 0, options: [
        'Objections are raised during the meeting, not afterwards',
        'Her meetings are shorter',
        'She makes the decisions on her own',
        'She presents the figures in detail at the start',
      ] },
      { id: 'meeting-2', prompt: 'In "her decisions hold", "hold" most nearly means:', answer: 2, options: ['Are delayed', 'Are written down', 'Stay in place', 'Are kept secret'] },
    ],
  },
]

const strip = ({ answer, ...rest }: Choice) => rest

const KNOWLEDGE_PER_LEVEL: Record<1 | 2 | 3, number> = { 1: 3, 2: 3, 3: 2 }
const PASSAGES_PER_SITTING = 3

// Working memory: two tries at each length. The span is the longest length recalled
// exactly at least once; the browser stops once both tries at a length are missed.
export const SPAN_LENGTHS = [4, 5, 6, 7, 8]
export const TRIALS_PER_LENGTH = 2
const SITTING_TTL_MS = 3 * 60 * 60 * 1000

// A course's question pool: the lecturer's approved bank, else a built-in one, else none.
export function bankFor(course: { code: string; name: string }, approved: Map<string, KnowledgeItem[]>) {
  return approved.get(course.code) ?? BUILT_IN.find(b => b.match(course))?.items ?? null
}

// count items from pool, preferring ones not in avoid, in random order.
function draw<T extends { id: string }>(pool: T[], count: number, avoid: Set<string>) {
  const shuffled = pool.map(item => ({ item, key: (avoid.has(item.id) ? 1 : 0) + Math.random() })).sort((a, b) => a.key - b.key)
  return shuffled.slice(0, count).map(x => x.item)
}

function digitsOf(length: number) {
  let out = ''
  while (out.length < length) {
    const d = String(randomInt(10))
    if (d !== out.at(-1)) out += d
  }
  return out
}

// What one sitting showed the learner. It travels to the browser and back in a signed
// token, so the sitting is scored against what was shown, not what was sent back.
export interface Sitting {
  span: string[]
  knowledge: { course: string; ids: string[] } | null
  passages: string[]
}

const sign = (payload: string) =>
  createHmac('sha256', process.env.SUPABASE_SECRET_KEY ?? '').update(`sitting:${payload}`).digest('base64url')

function sittingToken(sitting: Sitting, studentId: string) {
  const payload = Buffer.from(JSON.stringify({ ...sitting, u: studentId, e: Date.now() + SITTING_TTL_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

// The sitting a token was issued for, or null if it is forged, expired or someone else's.
export function readSitting(token: string, studentId: string): Sitting | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = Buffer.from(sign(payload)), given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { span, knowledge, passages, u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (u !== studentId || !(Date.now() < e) || !Array.isArray(span) || !Array.isArray(passages)) return null
    return { span, knowledge: knowledge ?? null, passages }
  } catch {
    return null
  }
}

// What the browser needs to run a sitting, with no answers in it. approved: courses' approved
// banks by code. lastServed: what the learner's previous sitting showed, to avoid repeating it.
export function publicAssessment(
  courses: { code: string; name: string }[], studentId: string,
  approved: Map<string, KnowledgeItem[]>, lastServed: Partial<Sitting> = {},
) {
  const first = courses.map(course => ({ course, pool: bankFor(course, approved) })).find(x => x.pool?.length)
  const seenItems = new Set(lastServed.knowledge?.ids ?? [])
  const items = first
    ? ([1, 2, 3] as const).flatMap(level => draw(first.pool!.filter(i => i.level === level), KNOWLEDGE_PER_LEVEL[level], seenItems))
    : []
  const passages = draw(PASSAGES, PASSAGES_PER_SITTING, new Set(lastServed.passages ?? []))
  const sitting: Sitting = {
    span: SPAN_LENGTHS.flatMap(n => Array.from({ length: TRIALS_PER_LENGTH }, () => digitsOf(n))),
    knowledge: first ? { course: first.course.code, ids: items.map(i => i.id) } : null,
    passages: passages.map(p => p.id),
  }
  return {
    token: sittingToken(sitting, studentId),
    knowledge: first ? { course: first.course.code, courseName: first.course.name, items: items.map(strip) } : null,
    span: { sequences: sitting.span, trialsPerLength: TRIALS_PER_LENGTH },
    passages: passages.map(p => ({ id: p.id, text: p.text, questions: p.questions.map(strip) })),
    // Courses with no question bank: the learner rates their own familiarity instead.
    selfRated: courses.filter(c => c.code !== first?.course.code).slice(0, 4).map(c => ({ code: c.code, name: c.name })),
  }
}

export interface Submission {
  token: string
  knowledge?: { answers: { id: string; choice: number; confidence: number }[] }
  span: string[]
  reading: { id: string; choice: number }[]
  readingSeconds: number
  context: {
    minutesPerWeek: number
    sessionMinutes: number
    format: CognitiveProfile['preferences']['format']
    device: CognitiveProfile['preferences']['device']
    connectivity: CognitiveProfile['preferences']['connectivity']
    accessibility: ('largerText' | 'captions' | 'extraTime')[]
    familiarity: Record<string, 'new' | 'some' | 'confident'>
  }
}

const FAMILIARITY: Record<'new' | 'some' | 'confident', Band> = { new: 'foundation', some: 'developing', confident: 'proficient' }

// Turns one sitting into a profile, plus the evidence behind each band (kept with the
// profile for staff, never shown to the learner and never sent to Claude). sitting is the
// token's, already checked with readSitting().
export function scoreAssessment(
  s: Submission, courses: { code: string; name: string }[], sitting: Sitting, approved: Map<string, KnowledgeItem[]>,
) {
  const priorKnowledge: Record<string, Band> = {}
  const evidence: Record<string, unknown> = { source: 'assessment', served: sitting }

  // 1 and 4: prior knowledge and confidence calibration, over the questions this sitting showed.
  let calibration: Calibration = 'calibrated'
  const course = sitting.knowledge && courses.find(c => c.code === sitting.knowledge!.course)
  const pool = course ? bankFor(course, approved) : null
  if (course && pool) {
    const served = new Set(sitting.knowledge!.ids)
    const byId = new Map(pool.filter(i => served.has(i.id)).map(i => [i.id, i]))
    const answered = (s.knowledge?.answers ?? []).filter(a => byId.has(a.id))
    const total = Array.from(byId.values()).reduce((n, i) => n + i.level, 0)
    const earned = answered.reduce((n, a) => n + (byId.get(a.id)!.answer === a.choice ? byId.get(a.id)!.level : 0), 0)
    const share = total ? earned / total : 0
    priorKnowledge[course.code] = share >= 0.7 ? 'proficient' : share >= 0.4 ? 'developing' : 'foundation'
    const marked = answered.map(a => ({ correct: byId.get(a.id)!.answer === a.choice, confidence: a.confidence }))
    const c = marked.length ? calibrationOf(marked) : { calibration, confidence: 0, gap: 0 }
    if (answered.length >= 4) calibration = c.calibration
    evidence.knowledge = { course: course.code, weighted: Math.round(share * 100), correct: marked.filter(a => a.correct).length, of: answered.length, confidence: Math.round(c.confidence * 100), gap: Math.round(c.gap * 100) }
  }
  for (const c of courses) {
    const f = s.context.familiarity[c.code]
    if (!priorKnowledge[c.code] && f) priorKnowledge[c.code] = FAMILIARITY[f]
  }

  // 2: working memory. Adults typically recall 6 or 7 digits; the bands sit around that.
  const digits = (t: string) => t.replace(/\D/g, '')
  const recalled = sitting.span.map((seq, i) => digits(s.span[i] ?? '') === seq)
  const span = sitting.span.reduce((best, seq, i) => recalled[i] ? Math.max(best, seq.length) : best, 0)
  const chunkSize: ChunkSize = span >= 7 ? 'large' : span >= 5 ? 'medium' : 'small'
  evidence.span = { span, recalled: recalled.filter(Boolean).length, of: s.span.length }

  // 3: reading level, from accuracy, with very slow reading as a tiebreaker.
  const shown = new Set(sitting.passages)
  const questions = new Map(PASSAGES.filter(p => shown.has(p.id)).flatMap(p => p.questions).map(q => [q.id, q]))
  const readingCorrect = s.reading.filter(r => questions.get(r.id)?.answer === r.choice).length
  const readingShare = questions.size ? readingCorrect / questions.size : 0
  let readingLevel: ReadingLevel = readingShare >= 0.8 ? 'advanced' : readingShare >= 0.5 ? 'standard' : 'plain'
  if (readingLevel === 'advanced' && s.readingSeconds > 150 * shown.size) readingLevel = 'standard'
  evidence.reading = { correct: readingCorrect, of: questions.size, seconds: Math.round(s.readingSeconds) }

  const profile: CognitiveProfile = {
    version: 1,
    priorKnowledge,
    chunkSize,
    readingLevel,
    calibration,
    pace: { minutesPerWeek: s.context.minutesPerWeek, sessionMinutes: s.context.sessionMinutes },
    preferences: { format: s.context.format, device: s.context.device, connectivity: s.context.connectivity },
    accessibility: {
      largerText: s.context.accessibility.includes('largerText'),
      captions: s.context.accessibility.includes('captions'),
      extraTime: s.context.accessibility.includes('extraTime'),
    },
  }
  return { profile, evidence }
}
