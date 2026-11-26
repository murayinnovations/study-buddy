import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSAGES, SPAN_LENGTHS, TRIALS_PER_LENGTH, bankFor, publicAssessment, readSitting, scoreAssessment,
  type KnowledgeItem, type Submission,
} from './assessment'

// Tokens are signed with this key; it's read when a token is made, not at import.
process.env.SUPABASE_SECRET_KEY ??= 'test-secret'

const POWER_BI = { code: 'BI-101', name: 'Business Intelligence with Power BI' }
const OTHER = { code: 'ACC-201', name: 'Financial Accounting' }
const none = new Map<string, KnowledgeItem[]>()
const BUILT_IN = bankFor(POWER_BI, none)!

const context: Submission['context'] = {
  minutesPerWeek: 120, sessionMinutes: 25, format: 'worked_examples', device: 'laptop',
  connectivity: 'reliable', accessibility: [], familiarity: {},
}

// The answers a real sitting would need, read from the bank and passages, so tests can
// answer everything right (or wrong) without hard-coding ids.
function sittingFor(courses = [POWER_BI, OTHER], banks = none, served = {}) {
  const pub = publicAssessment(courses, 'stu-1', banks, served)
  const sitting = readSitting(pub.token, 'stu-1')!
  return { pub, sitting }
}

function submission(pub: ReturnType<typeof publicAssessment>, opts: { knowledgeRight?: boolean; confidence?: number; span?: string[]; readingRight?: number; readingSeconds?: number; bank?: KnowledgeItem[] } = {}): Submission {
  const answerOf = (id: string, pool: { id: string; answer: number }[]) => pool.find(q => q.id === id)!.answer
  const allQuestions = PASSAGES.flatMap(p => p.questions)
  const bankItems = opts.bank ?? BUILT_IN
  return {
    token: pub.token,
    knowledge: pub.knowledge ? {
      answers: pub.knowledge.items.map(i => {
        const right = answerOf(i.id, bankItems)
        return { id: i.id, choice: opts.knowledgeRight === false ? (right + 1) % 4 : right, confidence: opts.confidence ?? 3 }
      }),
    } : undefined,
    span: opts.span ?? [],
    reading: pub.passages.flatMap(p => p.questions).map((q, i) => {
      const right = answerOf(q.id, allQuestions)
      return { id: q.id, choice: i < (opts.readingRight ?? 99) ? right : (right + 1) % 4 }
    }),
    readingSeconds: opts.readingSeconds ?? 120,
    context,
  }
}

test('a sitting serves 8 knowledge questions, 3 passages and two tries per span length', () => {
  const { pub, sitting } = sittingFor()
  assert.equal(pub.knowledge?.items.length, 8)
  assert.deepEqual(pub.knowledge!.items.map(i => (BUILT_IN.find(b => b.id === i.id)!.level)), [1, 1, 1, 2, 2, 2, 3, 3])
  assert.equal(pub.passages.length, 3)
  assert.equal(sitting.span.length, SPAN_LENGTHS.length * TRIALS_PER_LENGTH)
  assert.deepEqual(sitting.span.map(s => s.length), SPAN_LENGTHS.flatMap(n => [n, n]))
})

test('the browser never gets the answers', () => {
  const { pub } = sittingFor()
  const json = JSON.stringify({ ...pub, token: undefined })
  assert.ok(!json.includes('"answer"'))
})

test('a retake avoids the questions and passages of the last sitting where the pool allows', () => {
  const first = sittingFor()
  const second = sittingFor(undefined, none, first.sitting)
  const seenItems = new Set(first.sitting.knowledge!.ids)
  const repeats = second.sitting.knowledge!.ids.filter(id => seenItems.has(id)).length
  // The built-in pool has 5, 5 and 4 items per level for 3, 3 and 2 slots: at most 1+1+0 must repeat.
  assert.ok(repeats <= 2, `${repeats} repeated questions`)
  const repeatedPassages = second.sitting.passages.filter(p => first.sitting.passages.includes(p)).length
  assert.ok(repeatedPassages <= 1, `${repeatedPassages} repeated passages`)
})

test('tokens are tied to the student, signed and checked', () => {
  const { pub } = sittingFor()
  assert.equal(readSitting(pub.token, 'someone-else'), null)
  const [payload, sig] = pub.token.split('.')
  const forged = Buffer.from(JSON.stringify({ span: ['12345678'], knowledge: null, passages: [], u: 'stu-1', e: Date.now() + 1e6 })).toString('base64url')
  assert.equal(readSitting(`${forged}.${sig}`, 'stu-1'), null)
  assert.equal(readSitting(`${payload}.x${sig.slice(1)}`, 'stu-1'), null)
  assert.equal(readSitting('nonsense', 'stu-1'), null)
})

test('all right gives proficient, technical wording and a large chunk size', () => {
  const { pub, sitting } = sittingFor()
  const { profile } = scoreAssessment(submission(pub, { span: sitting.span }), [POWER_BI, OTHER], sitting, none)
  assert.equal(profile.priorKnowledge[POWER_BI.code], 'proficient')
  assert.equal(profile.readingLevel, 'advanced')
  assert.equal(profile.chunkSize, 'large')
})

test('all wrong gives foundation, plain wording and a small chunk size', () => {
  const { pub, sitting } = sittingFor()
  const { profile } = scoreAssessment(submission(pub, { knowledgeRight: false, span: ['0', '0'], readingRight: 0 }), [POWER_BI, OTHER], sitting, none)
  assert.equal(profile.priorKnowledge[POWER_BI.code], 'foundation')
  assert.equal(profile.readingLevel, 'plain')
  assert.equal(profile.chunkSize, 'small')
})

test('span is the longest length recalled at least once out of its two tries', () => {
  const { pub, sitting } = sittingFor()
  // Right on the first try at 4 and the second try at 5 and 6, then both tries at 7 missed.
  const span = [sitting.span[0], 'x', 'x', sitting.span[3], 'x', sitting.span[5], 'x', 'x']
  const { profile, evidence } = scoreAssessment(submission(pub, { span }), [POWER_BI], sitting, none)
  assert.equal((evidence.span as { span: number }).span, 6)
  assert.equal(profile.chunkSize, 'medium')
})

test('answers for questions the sitting did not show are ignored', () => {
  const { pub, sitting } = sittingFor()
  const sub = submission(pub, { knowledgeRight: false })
  const unserved = BUILT_IN.filter(i => !sitting.knowledge!.ids.includes(i.id))
  sub.knowledge!.answers.push(...unserved.map(i => ({ id: i.id, choice: i.answer, confidence: 3 })))
  const { profile } = scoreAssessment(sub, [POWER_BI], sitting, none)
  assert.equal(profile.priorKnowledge[POWER_BI.code], 'foundation')
})

test('sure but wrong is over-confident; unsure but right is under-confident', () => {
  const { pub, sitting } = sittingFor()
  const over = scoreAssessment(submission(pub, { knowledgeRight: false, confidence: 5 }), [POWER_BI], sitting, none)
  assert.equal(over.profile.calibration, 'over')
  const under = scoreAssessment(submission(pub, { confidence: 1 }), [POWER_BI], sitting, none)
  assert.equal(under.profile.calibration, 'under')
})

test('very slow reading caps the level at standard', () => {
  const { pub, sitting } = sittingFor()
  const { profile } = scoreAssessment(submission(pub, { readingSeconds: 3_000 }), [POWER_BI], sitting, none)
  assert.equal(profile.readingLevel, 'standard')
})

test('a course without a bank uses the learner\'s own familiarity rating', () => {
  const { pub, sitting } = sittingFor([OTHER])
  assert.equal(pub.knowledge, null)
  assert.deepEqual(pub.selfRated.map(c => c.code), [OTHER.code])
  const sub = submission(pub)
  sub.context = { ...context, familiarity: { [OTHER.code]: 'some' } }
  assert.equal(scoreAssessment(sub, [OTHER], sitting, none).profile.priorKnowledge[OTHER.code], 'developing')
})

test('a lecturer\'s approved bank is used instead of self-rating', () => {
  const items: KnowledgeItem[] = [1, 2, 3].flatMap(level => Array.from({ length: 4 }, (_, i) => ({
    id: `acc-${level}-${i}`, level: level as 1 | 2 | 3, prompt: `Q${level}.${i}`, options: ['a', 'b', 'c', 'd'], answer: i % 4,
  })))
  const banks = new Map([[OTHER.code, items]])
  const { pub, sitting } = sittingFor([OTHER], banks)
  assert.equal(pub.knowledge?.course, OTHER.code)
  assert.equal(pub.knowledge?.items.length, 8)
  const sub = submission(pub, { bank: items, confidence: 4 })
  assert.equal(scoreAssessment(sub, [OTHER], sitting, banks).profile.priorKnowledge[OTHER.code], 'proficient')
})
