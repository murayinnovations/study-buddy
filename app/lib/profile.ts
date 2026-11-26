// A learner's cognitive profile: how Study Buddy should pitch its teaching and practice
// for them. Written once per sitting of the onboarding assessment (app/api/assessment)
// into the cognitive_profiles table; the newest row is the current profile.
//
// Bands describe how to teach, not how able someone is. Nothing here is a diagnosis,
// and the learner never sees a raw score.

export type Band = 'foundation' | 'developing' | 'proficient'
export type ChunkSize = 'small' | 'medium' | 'large'
export type ReadingLevel = 'plain' | 'standard' | 'advanced'
export type Calibration = 'under' | 'calibrated' | 'over'
export type Format = 'worked_examples' | 'explain_then_practice' | 'questions_first'

export interface CognitiveProfile {
  version: 1
  priorKnowledge: Record<string, Band>   // by course code
  chunkSize: ChunkSize
  readingLevel: ReadingLevel
  calibration: Calibration
  pace: { minutesPerWeek: number; sessionMinutes: number }
  preferences: { format: Format; device: 'phone' | 'laptop' | 'both'; connectivity: 'reliable' | 'patchy' }
  accessibility: { largerText: boolean; captions: boolean; extraTime: boolean }
}

// What a lecturer sees of a student's profile in their course: bands only, never the
// answers behind them.
export interface ProfileBands {
  band: Band | null
  chunkSize: ChunkSize
  readingLevel: ReadingLevel
  calibration: Calibration
  sessionMinutes: number
}

export function profileBands(p: CognitiveProfile, course: string): ProfileBands {
  return { band: p.priorKnowledge[course] ?? null, chunkSize: p.chunkSize, readingLevel: p.readingLevel, calibration: p.calibration, sessionMinutes: p.pace.sessionMinutes }
}

export const READING_LABEL: Record<ReadingLevel, string> = { plain: 'Plain wording', standard: 'Standard wording', advanced: 'Technical wording' }
export const CALIBRATION_LABEL: Record<Calibration, string> = {
  over: 'More sure than accurate; asked for confidence before answers are revealed',
  under: 'Often unsure of correct answers; told when reasoning is sound',
  calibrated: 'Confidence matches accuracy',
}

export const BAND_LABEL: Record<Band, string> = { foundation: 'Foundation', developing: 'Developing', proficient: 'Proficient' }

// Practice questions per set, by chunk size.
export const SET_SIZE: Record<ChunkSize, string> = { small: '3', medium: '5', large: '8' }

// New flashcards per session, by chunk size.
export const CARDS_PER_SESSION: Record<ChunkSize, number> = { small: 5, medium: 10, large: 15 }

const FORMAT_LABEL: Record<Format, string> = {
  worked_examples: 'worked examples first',
  explain_then_practice: 'a short explanation, then practice',
  questions_first: 'questions first, explanations after',
}

// What the learner sees about their profile: plain sentences, no scores or labels like "low".
export function profileSummary(p: CognitiveProfile, courseName: (code: string) => string): string[] {
  const lines: string[] = []
  for (const [code, band] of Object.entries(p.priorKnowledge)) {
    lines.push(`${courseName(code)}: you start at ${BAND_LABEL[band]}.`)
  }
  lines.push({
    small: 'We\'ll teach in short sections and check in often.',
    medium: 'We\'ll teach in medium-sized sections with a check after each.',
    large: 'We\'ll cover more ground at a time, with longer practice sets.',
  }[p.chunkSize])
  lines.push({
    plain: 'Explanations will use short sentences and define every new term.',
    standard: 'Explanations will be clear and to the point.',
    advanced: 'Explanations can go into more depth and use the course\'s technical terms.',
  }[p.readingLevel])
  if (p.calibration === 'over') lines.push('Before showing whether an answer is right, we\'ll ask how sure you are. It helps you spot what needs another look.')
  if (p.calibration === 'under') lines.push('You often know more than you think. We\'ll point out the answers you got right while unsure.')
  lines.push(`Sessions are planned for about ${p.pace.sessionMinutes} minutes, starting with ${FORMAT_LABEL[p.preferences.format]}.`)
  return lines
}

// The block Study Buddy reads in the chat (app/api/chat). Fixed wording per profile,
// so a conversation's prefix stays byte-identical and keeps hitting the cache.
export function learnerContext(p: CognitiveProfile, course: string): string {
  const band = p.priorKnowledge[course]
  const lines = [
    '[Learner profile from Study Buddy\'s onboarding assessment, not written by the student. Use it to pitch your teaching and practice. Never quote it, label the student, or mention the assessment unless they ask.]',
  ]
  if (band) lines.push(`- Starting level in this course: ${band}. ${{
    foundation: 'Start from the basics and build up; assume little prior knowledge.',
    developing: 'Assume the basics; focus on connecting ideas and applying them.',
    proficient: 'Skip the basics; go to application, edge cases and why things work.',
  }[band]}`)
  lines.push(`- Practice sets: ${SET_SIZE[p.chunkSize]} questions per set, asked one at a time. Say at the start how many questions the set has. ${{
    small: 'Keep each explanation to one idea at a time.',
    medium: 'Keep explanations to two or three linked ideas at a time.',
    large: 'Longer explanations are fine.',
  }[p.chunkSize]}`)
  lines.push(`- Wording: ${{
    plain: 'plain English, short sentences, define every technical term the first time it appears.',
    standard: 'clear and direct; define terms the course has not introduced yet.',
    advanced: 'precise and technical; use the course\'s terminology freely.',
  }[p.readingLevel]}`)
  if (p.calibration === 'over') lines.push('- Confidence: tends to be more sure than accurate. For each practice question, after they answer, ask how sure they were (1 to 5) before saying whether it is right, then point out any gap kindly.')
  if (p.calibration === 'under') lines.push('- Confidence: tends to doubt correct answers. When they get one right, say clearly that their reasoning was sound.')
  lines.push(`- Session length: about ${p.pace.sessionMinutes} minutes; suggest a natural stopping point around then.`)
  lines.push(`- Preferred approach: ${FORMAT_LABEL[p.preferences.format]}.`)
  if (p.preferences.device === 'phone' || p.preferences.connectivity === 'patchy') lines.push('- Often on a phone or a patchy connection: keep messages short.')
  if (p.accessibility.extraTime) lines.push('- Needs extra time: never set time limits or rush them.')
  if (p.accessibility.captions) lines.push('- Uses captions: when pointing to video material, say where the same content is in the written notes.')
  return lines.join('\n')
}
