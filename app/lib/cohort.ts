import { TOPIC_PROGRESS, CURRENT_WEEK, STUDENT } from '../components/student/studentData'
import type { TopicMastery } from './demoData'
import { average } from './format'

// A synthetic SBS 201 class so the lecturer dashboards have something to show.
// Generated from a fixed seed, so every load (server and browser) is identical.

export type Status = 'Critical' | 'At risk' | 'On track' | 'Excelling'

export interface CohortStudent {
  id: string
  live: boolean            // the demo student, whose data changes during the demo
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

export function buildCohort(liveMastery: TopicMastery[], livePracticeCount: number): CohortStudent[] {
  const scores: Record<string, number> = {}
  for (const t of liveMastery) scores[t.topic] = t.score
  const live = finish({
    id: STUDENT.id,
    live: true,
    daysAgo: 0,
    engagement: Math.min(95, 62 + livePracticeCount * 3),
    sessions: liveMastery.reduce((s, t) => s + t.sessions, 0),
    scores,
    trend: '↑',
  })
  return [live, ...SYNTHETIC]
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
