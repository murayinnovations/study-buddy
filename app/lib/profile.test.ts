import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADAPT_WINDOW, adaptToPractice, calibrationOf, learnerContext, profileSummary, type CognitiveProfile } from './profile'

const base: CognitiveProfile = {
  version: 1,
  priorKnowledge: { BI: 'developing' },
  chunkSize: 'medium',
  readingLevel: 'standard',
  calibration: 'calibrated',
  pace: { minutesPerWeek: 120, sessionMinutes: 25 },
  preferences: { format: 'worked_examples', device: 'laptop', connectivity: 'reliable' },
  accessibility: { largerText: false, captions: false, extraTime: false },
}

const answers = (right: number, of = ADAPT_WINDOW) => Array.from({ length: of }, (_, i) => ({ correct: i < right }))
const rated = (right: number, confidence: number, of = ADAPT_WINDOW) => answers(right, of).map(a => ({ ...a, confidence }))

test('calibration compares confidence with accuracy', () => {
  assert.equal(calibrationOf(rated(2, 5)).calibration, 'over')
  assert.equal(calibrationOf(rated(9, 1)).calibration, 'under')
  assert.equal(calibrationOf(rated(5, 3)).calibration, 'calibrated')
})

test('8 or more right out of 10 moves level and set size up one step', () => {
  const moved = adaptToPractice(base, 'BI', answers(8), [])!
  assert.equal(moved.profile.priorKnowledge.BI, 'proficient')
  assert.equal(moved.profile.chunkSize, 'large')
})

test('4 or fewer right moves both down one step', () => {
  const moved = adaptToPractice(base, 'BI', answers(4), [])!
  assert.equal(moved.profile.priorKnowledge.BI, 'foundation')
  assert.equal(moved.profile.chunkSize, 'small')
})

test('in between, or fewer than 10 answers, changes nothing', () => {
  assert.equal(adaptToPractice(base, 'BI', answers(6), []), null)
  assert.equal(adaptToPractice(base, 'BI', answers(5, 5), []), null)
})

test('it stops at the ends of each scale', () => {
  const top: CognitiveProfile = { ...base, priorKnowledge: { BI: 'proficient' }, chunkSize: 'large' }
  assert.equal(adaptToPractice(top, 'BI', answers(10), []), null)
})

test('only the practised course\'s level moves', () => {
  const two: CognitiveProfile = { ...base, priorKnowledge: { BI: 'developing', ACC: 'foundation' } }
  assert.equal(adaptToPractice(two, 'BI', answers(9), [])!.profile.priorKnowledge.ACC, 'foundation')
})

test('10 rated answers re-check calibration', () => {
  const over: CognitiveProfile = { ...base, calibration: 'over' }
  const moved = adaptToPractice(over, 'BI', answers(6), rated(6, 3))!
  assert.equal(moved.profile.calibration, 'calibrated')
  assert.equal(adaptToPractice(over, 'BI', answers(6), rated(6, 3, 9)), null)
})

test('the chat block and the student summary never quote scores', () => {
  const text = learnerContext(base, 'BI') + profileSummary(base, c => c).join(' ')
  assert.ok(!/\d+%/.test(text))
})
