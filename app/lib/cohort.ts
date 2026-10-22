import { TOPIC_PROGRESS, CURRENT_WEEK } from '../components/student/studentData'
import type { ClassStudent } from './demoData'
import { average } from './format'

// The SBS 201 class for the lecturer dashboards: the students who have signed up,
// plus a synthetic class so the dashboards have something to show while the pilot
// is small. The synthetic class comes from a fixed seed, so every load is identical.

export type Status = 'Critical' | 'At risk' | 'On track' | 'Excelling'

export interface CohortStudent {
  id: string
  live: boolean            // a real signed-up student, not synthetic
  daysAgo: number
  engagement: number       // % of expected study activity this fortnight
  sessions: number
  scores: Record<string, number>
  score: number            // average over topics taught so far
  weakTopic: string
  status: Status
  trend: '↑' | '→' | '↓'
}

export const TAUGHT_TOPICS = TOPIC_PROGRESS['SBS 201']
  .filter(t => (t.week ?? 99) <= CURRENT_WEEK)
  .map(t => t.topic)

// How hard each topic is for the class, as a typical score.
const TOPIC_BASE: Record<string, number> = {
  'Accounting equation': 84, 'Double-entry system': 77, 'Ledger accounts': 72, 'Trial balance': 60,
  'Depreciation': 41, 'Accruals & prepayments': 47, 'Income statement': 63, 'Balance sheet': 59,
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)))

function classify(score: number, engagement: number): Status {
  if (score < 40 || engagement < 25) return 'Critical'
  if (score < 52 || engagement < 40) return 'At risk'
  if (score >= 80) return 'Excelling'
  return 'On track'
}

function finish(s: Omit<CohortStudent, 'score' | 'weakTopic' | 'status'>): CohortStudent {
  const score = average(TAUGHT_TOPICS.map(t => s.scores[t]))
  const weakTopic = TAUGHT_TOPICS.reduce((w, t) => (s.scores[t] < s.scores[w] ? t : w), TAUGHT_TOPICS[0])
  return { ...s, score, weakTopic, status: classify(score, s.engagement) }
}

const SYNTHETIC: CohortStudent[] = (() => {
  const rand = mulberry32(201)
  const noise = () => rand() + rand() + rand() - 1.5   // roughly normal, -1.5..1.5
  return Array.from({ length: 30 }, (_, i) => {
    const ability = 0.25 + rand() * 0.7
    const engagement = clamp(ability * 85 + noise() * 25, 8, 98)
    const scores: Record<string, number> = {}
    for (const t of TAUGHT_TOPICS) scores[t] = clamp(TOPIC_BASE[t] + (ability - 0.6) * 70 + noise() * 14, 5, 98)
    const trendRoll = rand()
    return finish({
      id: `STR-2024-${1100 + ((i * 2731 + 517) % 8800)}`,
      live: false,
      daysAgo: engagement > 60 ? Math.floor(rand() * 3) : engagement > 35 ? 2 + Math.floor(rand() * 4) : 4 + Math.floor(rand() * 8),
      engagement,
      sessions: Math.max(1, Math.round(engagement / 6 + noise() * 2)),
      scores,
      trend: trendRoll < 0.3 ? '↓' : trendRoll < 0.55 ? '→' : '↑',
    })
  })
})()

export const SYNTHETIC_COUNT = SYNTHETIC.length

const DAY = 86_400_000

// Engagement for real students is a rough proxy until there's enough pilot data:
// it starts neutral, so a new student isn't flagged, and rises with practice questions answered.
export function buildCohort(students: ClassStudent[]): CohortStudent[] {
  const live = students.map(s => {
    const scores: Record<string, number> = {}
    for (const t of TAUGHT_TOPICS) scores[t] = 0
    for (const t of s.mastery) scores[t.topic] = t.score
    return finish({
      id: s.id,
      live: true,
      daysAgo: s.lastActive === null ? 99 : Math.floor((Date.now() - s.lastActive) / DAY),
      engagement: Math.min(95, 50 + s.practiceCount * 5),
      sessions: s.mastery.reduce((n, t) => n + t.sessions, 0),
      scores,
      trend: '→',
    })
  })
  return [...live, ...SYNTHETIC]
}

export interface TopicStat { topic: string; avg: number; confusion: number }

// Confusion rate: share of students below 50% mastery on the topic.
export function topicStats(cohort: CohortStudent[]): TopicStat[] {
  return TAUGHT_TOPICS.map(topic => {
    const scores = cohort.map(s => s.scores[topic])
    return {
      topic,
      avg: average(scores),
      confusion: Math.round((scores.filter(n => n < 50).length / scores.length) * 100),
    }
  }).sort((a, b) => b.confusion - a.confusion)
}

// Weeks 1-8 of the trend are demo history; the last point is computed live.
export const TREND_HISTORY = [55, 58, 61, 67, 72, 68, 65, 63]
