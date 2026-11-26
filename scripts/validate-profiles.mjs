// Checks how well the onboarding assessment's starting profiles held up against real practice.
//
//   node --env-file=.env.local scripts/validate-profiles.mjs [--answers 20]
//
// For each student's first assessment, it takes their next answers (20 by default) in each
// course and reports:
//   1. Starting level against practice accuracy. Foundation < developing < proficient is what
//      a working assessment shows. Tested levels (course questions) and self-rated ones are
//      reported separately.
//   2. Confidence calibration against what their rated quiz answers later showed.
//   3. Retakes: how often a second sitting gave the same bands as the first.
// Read-only. Needs a few weeks of pilot practice before the numbers mean much; groups with
// fewer than 5 students are flagged.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (run with --env-file=.env.local).')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })
const args = process.argv.slice(2)
const WINDOW = Number(args[args.indexOf('--answers') + 1]) || 20
const MIN_ANSWERS = 5
const MIN_GROUP = 5

async function all(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order('created_at').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

// Same rule as calibrationOf in app/lib/profile.ts.
function calibration(answers) {
  const accuracy = answers.filter(a => a.correct).length / answers.length
  const confidence = answers.reduce((n, a) => n + (a.confidence - 1) / 4, 0) / answers.length
  const gap = confidence - accuracy
  return gap > 0.2 ? 'over' : gap < -0.2 ? 'under' : 'calibrated'
}

const pct = n => `${Math.round(n * 100)}%`
const small = n => n < MIN_GROUP ? '  (too few to judge)' : ''

const profiles = await all('cognitive_profiles', 'student_id, profile, evidence, created_at')
let practice
try {
  practice = await all('practice_log', 'student_id, course, correct, confidence, created_at')
} catch {
  practice = (await all('practice_log', 'student_id, course, correct, created_at')).map(p => ({ ...p, confidence: null }))
}

// Practice-made rows carry evidence.source 'practice'; everything else is a sitting.
const sittings = profiles.filter(p => p.evidence?.source !== 'practice')
const byStudent = new Map()
for (const s of sittings) byStudent.set(s.student_id, [...(byStudent.get(s.student_id) ?? []), s])
const practiceOf = new Map()
for (const p of practice) practiceOf.set(p.student_id, [...(practiceOf.get(p.student_id) ?? []), p])

console.log(`${byStudent.size} students with an assessment, ${practice.length} practice answers.\n`)

// 1. Starting level against practice accuracy.
const groups = {}
for (const [student, [first]] of byStudent) {
  const tested = first.evidence?.knowledge?.course
  for (const [course, band] of Object.entries(first.profile.priorKnowledge ?? {})) {
    const next = (practiceOf.get(student) ?? []).filter(p => p.course === course && p.created_at > first.created_at).slice(0, WINDOW)
    if (next.length < MIN_ANSWERS) continue
    const kind = course === tested ? 'tested' : 'self-rated'
    const g = (groups[kind] ??= {})[band] ??= { students: 0, accuracy: 0 }
    g.students++
    g.accuracy += next.filter(p => p.correct).length / next.length
  }
}
console.log(`1. Starting level against accuracy in the next ${WINDOW} practice answers`)
for (const kind of ['tested', 'self-rated']) {
  const g = groups[kind]
  if (!g) { console.log(`   ${kind}: no students with ${MIN_ANSWERS}+ answers yet`); continue }
  const order = ['foundation', 'developing', 'proficient'].filter(b => g[b])
  for (const band of order) console.log(`   ${kind.padEnd(10)} ${band.padEnd(11)} ${String(g[band].students).padStart(3)} students, ${pct(g[band].accuracy / g[band].students)} correct${small(g[band].students)}`)
  const means = order.map(b => g[b].accuracy / g[b].students)
  const ordered = means.every((m, i) => i === 0 || m > means[i - 1])
  console.log(`   ${kind}: ${order.length < 2 ? 'need students in at least two levels to judge' : ordered ? 'levels are in the right order' : 'levels are NOT in order: the starting level is not predicting practice'}\n`)
}

// 2. Calibration against later rated answers.
let compared = 0, agreed = 0
for (const [student, [first]] of byStudent) {
  const rated = (practiceOf.get(student) ?? []).filter(p => p.confidence != null && p.created_at > first.created_at).slice(0, WINDOW)
  if (rated.length < 10) continue
  compared++
  if (calibration(rated) === first.profile.calibration) agreed++
}
console.log('2. Confidence calibration against later rated quiz answers')
console.log(compared ? `   ${agreed} of ${compared} students matched (${pct(agreed / compared)})${small(compared)}\n` : '   no students with 10+ rated answers yet\n')

// 3. Retake consistency.
const retakes = [...byStudent.values()].filter(s => s.length >= 2)
console.log('3. Retakes: same result in the second sitting as the first')
if (!retakes.length) console.log('   nobody has retaken it yet')
for (const field of ['chunkSize', 'readingLevel', 'calibration']) {
  if (!retakes.length) break
  const same = retakes.filter(([a, b]) => a.profile[field] === b.profile[field]).length
  console.log(`   ${field.padEnd(13)} ${same} of ${retakes.length} (${pct(same / retakes.length)})${small(retakes.length)}`)
}
