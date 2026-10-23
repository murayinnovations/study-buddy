export const COURSES = [
  { code:'SBS 201', name:'Financial Accounting', lecturer:'Prof. Mwangi', credits:3, color:'#2563EB' },
  { code:'SBS 102', name:'Business Statistics',  lecturer:'Prof. Kariuki', credits:3, color:'#0D9488' },
  { code:'SBS 110', name:'Principles of Management', lecturer:'Dr. Omondi', credits:3, color:'#7C3AED' },
  { code:'ECO 201', name:'Microeconomics',       lecturer:'Dr. Njagi',   credits:3, color:'#D97706' },
]

export type Course = typeof COURSES[number]

// SBS 201 is taught to this week (see content/sbs201/00-course-outline.md).
export const CURRENT_WEEK = 9

export interface TopicProgress { topic:string; score:number; sessions:number; daysAgo:number|null; week?:number }

// Sample progress (the demo student's), used for accounts added with --sample.
// daysAgo: null means not started.
export const TOPIC_PROGRESS: Record<string, TopicProgress[]> = {
  'SBS 201': [
    { topic:'Accounting equation',    score:92, sessions:4, daysAgo:2,  week:1 },
    { topic:'Double-entry system',    score:85, sessions:5, daysAgo:3,  week:2 },
    { topic:'Ledger accounts',        score:78, sessions:3, daysAgo:4,  week:3 },
    { topic:'Trial balance',          score:65, sessions:4, daysAgo:1,  week:5 },
    { topic:'Depreciation',           score:38, sessions:1, daysAgo:7,  week:6 },
    { topic:'Accruals & prepayments', score:42, sessions:2, daysAgo:7,  week:8 },
    { topic:'Income statement',       score:70, sessions:3, daysAgo:0,  week:9 },
    { topic:'Balance sheet',          score:60, sessions:2, daysAgo:5,  week:9 },
    { topic:'Bank reconciliation',    score:0,  sessions:0, daysAgo:null, week:10 },
    { topic:'Cash flow statements',   score:25, sessions:1, daysAgo:14, week:11 },
  ],
  'SBS 102': [
    { topic:'Descriptive statistics', score:78, sessions:4, daysAgo:3 },
    { topic:'Probability theory',     score:55, sessions:3, daysAgo:4 },
    { topic:'Normal distribution',    score:45, sessions:2, daysAgo:7 },
    { topic:'Hypothesis testing',     score:30, sessions:1, daysAgo:7 },
    { topic:'Regression & correlation',score:0, sessions:0, daysAgo:null },
  ],
  'SBS 110': [
    { topic:'Classical management',   score:82, sessions:5, daysAgo:2 },
    { topic:'Motivation theories',    score:70, sessions:4, daysAgo:3 },
    { topic:'Leadership styles',      score:65, sessions:3, daysAgo:4 },
    { topic:'Organisational design',  score:50, sessions:2, daysAgo:7 },
    { topic:'Corporate governance',   score:35, sessions:1, daysAgo:7 },
  ],
  'ECO 201': [
    { topic:'Supply & demand',        score:72, sessions:4, daysAgo:1 },
    { topic:'Price elasticity',       score:55, sessions:2, daysAgo:3 },
    { topic:'Consumer theory',        score:40, sessions:1, daysAgo:7 },
    { topic:'Market structures',      score:25, sessions:1, daysAgo:7 },
    { topic:'Market failure',         score:0,  sessions:0, daysAgo:null },
  ],
}

export function courseTopics(code: string) {
  return (TOPIC_PROGRESS[code] || []).map(t => t.topic)
}

export const QUICK_STARTERS: Record<string, {label:string; prompt:string}[]> = {
  'SBS 201': [
    { label:'Explain depreciation',          prompt:'Can you explain depreciation methods — straight-line vs reducing balance? I have an exam question on this.' },
    { label:'Trial balance practice',        prompt:'Give me a practice trial balance question at the level of a Strathmore CAT.' },
    { label:'Accruals — I\'m confused',      prompt:'I don\'t understand the difference between accruals and prepayments. Can you walk me through it?' },
    { label:'Income statement walkthrough',  prompt:'Walk me through how to prepare an income statement step by step.' },
    { label:'Past paper style question',     prompt:'Give me a past-paper style question on double-entry bookkeeping.' },
  ],
  'SBS 102': [
    { label:'Standard deviation explained', prompt:'Explain standard deviation in plain language with a Kenyan example.' },
    { label:'Hypothesis testing steps',     prompt:'Walk me through the steps of a hypothesis test.' },
    { label:'Practice: normal distribution',prompt:'Give me a practice question on the normal distribution.' },
    { label:'Regression vs correlation',    prompt:'What\'s the difference between regression and correlation?' },
  ],
  'SBS 110': [
    { label:'Maslow vs Herzberg',           prompt:'Compare Maslow\'s hierarchy of needs with Herzberg\'s two-factor theory.' },
    { label:'Leadership styles quiz',       prompt:'Quiz me on the different leadership styles.' },
    { label:'Safaricom case study',         prompt:'Use Safaricom as an example to explain transformational leadership.' },
  ],
  'ECO 201': [
    { label:'Elasticity explained',         prompt:'Explain price elasticity of demand with a Kenyan market example.' },
    { label:'Market structures quiz',       prompt:'Quiz me on the four market structures.' },
    { label:'Consumer theory walkthrough',  prompt:'Walk me through indifference curves and budget constraints.' },
  ],
}

// Curriculum AI's first message in each course. {name} is the student's first name.
// For accounts with the sample progress: it refers to that progress.
export const WELCOME_MESSAGES: Record<string, string> = {
  'SBS 201': `Hi {name} 👋 Good to see you again.\n\nI've been keeping track of your progress in **Financial Accounting**. You're doing well on the fundamentals — your accounting equation and double-entry scores are strong.\n\nI notice you haven't spent much time on **Depreciation** yet, and your Accruals score has room to grow. Those two topics come up every semester in the final exam.\n\nWhat would you like to work on today?`,
  'SBS 102': `Welcome back to **Business Statistics**, {name}.\n\nYou're making solid progress on descriptive statistics. Hypothesis testing is your next frontier — it builds on the probability work you've been doing.\n\nWhat shall we tackle?`,
  'SBS 110': `Hi {name}! **Principles of Management** — let's go.\n\nYour classical management theory is looking good. Leadership styles and corporate governance are worth revisiting before the next CAT.\n\nWhat are you working on today?`,
  'ECO 201': `Good to see you, {name}. **Microeconomics** is where we are.\n\nSupply and demand is your strongest area so far. Market structures and consumer theory need more sessions — let's build on those.\n\nWhat would you like to explore?`,
}

// For students starting from scratch.
export const FIRST_WELCOME = `Hi {name} 👋 I'm Curriculum AI, your study companion for **{course}**.\n\nI answer from your lecturer's approved course material and show you where each answer comes from. I can also set you practice questions, and I'll keep track of how you're doing on each topic.\n\nWhat would you like to work on first?`
