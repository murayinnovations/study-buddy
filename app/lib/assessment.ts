import type { Band, Calibration, ChunkSize, CognitiveProfile, ReadingLevel } from './profile'

// The onboarding assessment: what it asks and how it is scored. Server only, because
// the answers are here; the browser gets publicAssessment() without them.
//
// Five short blocks, about 12 minutes:
//   1. Prior knowledge: course questions, easy to hard (only for courses with a bank below)
//   2. Working memory: remember a sequence of digits, 3 to 7 long
//   3. Reading: two short passages, two questions each, timed silently
//   4. Confidence: how sure they were, after each block 1 answer
//   5. Study context: time, device, preferences, accessibility, and familiarity with
//      any course that has no question bank yet
// There is deliberately no "learning styles" block: that model has weak evidence.

export interface Choice { id: string; prompt: string; options: string[]; answer: number }
interface KnowledgeItem extends Choice { level: 1 | 2 | 3 }

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
  ],
}

const BANKS: Bank[] = [POWER_BI]

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
]

const strip = ({ answer, ...rest }: Choice) => rest

// What the browser needs to run the assessment, with no answers in it.
export function publicAssessment(courses: { code: string; name: string }[]) {
  const withBank = courses.map(c => ({ course: c, bank: BANKS.find(b => b.match(c)) })).filter(x => x.bank)
  const first = withBank[0]
  return {
    knowledge: first ? {
      course: first.course.code, courseName: first.course.name,
      items: first.bank!.items.map(i => strip(i)),
    } : null,
    passages: PASSAGES.map(p => ({ id: p.id, text: p.text, questions: p.questions.map(strip) })),
    // Courses with no question bank: the learner rates their own familiarity instead.
    selfRated: courses.filter(c => c.code !== first?.course.code).slice(0, 4).map(c => ({ code: c.code, name: c.name })),
  }
}

export interface Submission {
  knowledge?: { course: string; answers: { id: string; choice: number; confidence: number }[] }
  span: { sequence: string; answer: string }[]
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
// profile for staff, never shown to the learner and never sent to Claude).
export function scoreAssessment(s: Submission, courses: { code: string; name: string }[]) {
  const priorKnowledge: Record<string, Band> = {}
  const evidence: Record<string, unknown> = {}

  // 1 and 4: prior knowledge and confidence calibration.
  let calibration: Calibration = 'calibrated'
  const course = s.knowledge && courses.find(c => c.code === s.knowledge!.course)
  const bank = course && BANKS.find(b => b.match(course))
  if (course && bank) {
    const byId = new Map(bank.items.map(i => [i.id, i]))
    const answered = s.knowledge!.answers.filter(a => byId.has(a.id))
    const total = bank.items.reduce((n, i) => n + i.level, 0)
    const earned = answered.reduce((n, a) => n + (byId.get(a.id)!.answer === a.choice ? byId.get(a.id)!.level : 0), 0)
    const share = total ? earned / total : 0
    priorKnowledge[course.code] = share >= 0.7 ? 'proficient' : share >= 0.4 ? 'developing' : 'foundation'
    const correct = answered.filter(a => byId.get(a.id)!.answer === a.choice).length
    const accuracy = answered.length ? correct / answered.length : 0
    const confidence = answered.length ? answered.reduce((n, a) => n + (a.confidence - 1) / 4, 0) / answered.length : 0
    const gap = confidence - accuracy
    if (answered.length >= 4) calibration = gap > 0.2 ? 'over' : gap < -0.2 ? 'under' : 'calibrated'
    evidence.knowledge = { course: course.code, weighted: Math.round(share * 100), correct, of: answered.length, confidence: Math.round(confidence * 100), gap: Math.round(gap * 100) }
  }
  for (const c of courses) {
    const f = s.context.familiarity[c.code]
    if (!priorKnowledge[c.code] && f) priorKnowledge[c.code] = FAMILIARITY[f]
  }

  // 2: working memory, as the longest sequence recalled exactly.
  const digits = (t: string) => t.replace(/\D/g, '')
  const span = s.span.reduce((best, t) => digits(t.answer) === digits(t.sequence) ? Math.max(best, digits(t.sequence).length) : best, 0)
  const chunkSize: ChunkSize = span >= 6 ? 'large' : span === 5 ? 'medium' : 'small'
  evidence.span = span

  // 3: reading level, from accuracy, with very slow reading as a tiebreaker.
  const questions = new Map(PASSAGES.flatMap(p => p.questions).map(q => [q.id, q]))
  const readingCorrect = s.reading.filter(r => questions.get(r.id)?.answer === r.choice).length
  let readingLevel: ReadingLevel = readingCorrect >= 4 ? 'advanced' : readingCorrect >= 2 ? 'standard' : 'plain'
  if (readingLevel === 'advanced' && s.readingSeconds > 300) readingLevel = 'standard'
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
