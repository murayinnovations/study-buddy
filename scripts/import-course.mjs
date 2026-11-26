// Loads a course and its approved materials into Study Buddy's database.
//
//   node --env-file=.env.local scripts/import-course.mjs <folder> [--dry-run | --prepare]
//
// --dry-run lists what would be imported. --prepare also transcribes any scanned PDFs, then stops
// before writing to the database.
//
// <folder> holds the files downloaded from the university's learning platform, plus:
//   course.json   the course (a row for the courses table) and its materials, in teaching order:
//                 { "course": { "code", "name", "lecturer", "prompt", "topics", ... },
//                   "materials": [{ "file" | "manifestText", "title", "type", "topics", "transcribe"? }] }
//   text/<file>.md  the text of each file, extracted beforehand (Study Buddy reads this text)
//   manifest.json   optional: page text captured from the platform, for "manifestText" materials
//
// Each original file is uploaded to the private course-files bucket, and its text is saved as an
// approved material. Materials marked "transcribe" are scanned or image-heavy PDFs: the first run
// has Claude read the PDF and write out its text to text/<file>.transcribed.md, and later runs
// reuse that file. Running again updates everything in place, and removes platform materials for
// the course that are no longer listed. Lecturer uploads and saved answers are never touched.
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const BUCKET = 'course-files'
const TRANSCRIBE_MODEL = 'claude-opus-5-5'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const prepareOnly = args.includes('--prepare')
const dir = args.find(a => !a.startsWith('--'))
if (!dir) fail('Usage: node --env-file=.env.local scripts/import-course.mjs <folder> [--dry-run | --prepare]')

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

const exists = p => access(p).then(() => true, () => false)

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// Storage keys allow a limited character set; keep names readable but safe.
const slug = s => s.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-(?=\.)|-$/g, '').toLowerCase()

// The file name students see when they download it, without the download-order prefix.
const displayName = file => file.replace(/^\d+__+/, '')

// Has Claude write out the text of a scanned or image-heavy PDF, once.
async function transcribe(pdfPath, title) {
  if (!process.env.ANTHROPIC_API_KEY) fail(`ANTHROPIC_API_KEY is needed to transcribe "${title}".`)
  const client = new Anthropic()
  const data = (await readFile(pdfPath)).toString('base64')
  const stream = client.beta.messages.stream({
    model: TRANSCRIBE_MODEL,
    max_tokens: 64000,
    output_config: { effort: 'medium' },
    // If a safety classifier declines, the API retries on its recommended model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
        {
          type: 'text',
          text: `These are slides from a university course ("${title}"). Many are images, so their text can't be extracted directly. Write out the full content of every page as plain markdown, so a tutor can teach from it without seeing the slides.

- Start each page with "## Page N".
- Transcribe all text faithfully, in reading order, including text inside images, diagrams and tables. Text printed sideways or mirrored should be written normally.
- Write tables as markdown tables.
- Where a page relies on a diagram, chart or screenshot, describe what it shows in one or two sentences, in square brackets, e.g. [Diagram: …].
- Don't add commentary, summaries or anything that isn't on the page.
Return only the transcription.`,
        },
      ],
    }],
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') fail(`Claude declined to transcribe "${title}".`)
  if (message.stop_reason === 'max_tokens') fail(`The transcription of "${title}" was cut short.`)
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
  if (!text) fail(`Claude returned no text for "${title}".`)
  return text
}

const spec = JSON.parse(await readFile(path.join(dir, 'course.json'), 'utf8'))
const manifest = await exists(path.join(dir, 'manifest.json'))
  ? JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'))
  : { activities: [] }
const course = spec.course
for (const field of ['code', 'name', 'lecturer', 'prompt']) if (!course?.[field]) fail(`course.json: course.${field} is required.`)
const topicNames = new Set((course.topics || []).map(t => t.topic))

// Gather every material's text first, so nothing is written if one is missing.
const materials = []
for (const [i, m] of spec.materials.entries()) {
  for (const t of m.topics || []) if (!topicNames.has(t)) fail(`"${m.title}": topic "${t}" is not one of the course's topics.`)
  let body
  if (m.manifestText) {
    body = manifest.activities.find(a => a.name === m.manifestText)?.text?.trim()
    if (!body) fail(`"${m.title}": no text for "${m.manifestText}" in manifest.json.`)
    // Drop the platform's attachment line ("file.pdf  10 June 2026, 3:43 PM"); the file is its own material.
    body = body.replace(/\n[^\n]*\.(pdf|docx|pptx|xlsx)\s+\d{1,2} \w+ \d{4}, \d{1,2}:\d{2} [AP]M\s*$/i, '').trim()
  } else {
    const stem = m.file.replace(/\.[^.]+$/, '')
    const extracted = path.join(dir, 'text', `${stem}.md`)
    const transcribed = path.join(dir, 'text', `${stem}.transcribed.md`)
    if (m.transcribe) {
      if (!(await exists(transcribed))) {
        if (dryRun) { console.log(`Would transcribe: ${m.title}`); body = '(to be transcribed)' }
        else {
          console.log(`Transcribing ${m.title} with Claude…`)
          await writeFile(transcribed, await transcribe(path.join(dir, m.file), m.title), 'utf8')
        }
      }
      body ??= await readFile(transcribed, 'utf8')
    } else {
      if (!(await exists(extracted))) fail(`"${m.title}": missing ${extracted}. Extract the text first.`)
      body = await readFile(extracted, 'utf8')
    }
  }
  if (!body.trim()) fail(`"${m.title}" has no text. Mark it "transcribe": true if it's a scanned PDF.`)
  const id = `${course.code}:${slug(m.file ? displayName(m.file).replace(/\.[^.]+$/, '') : m.title)}`
  materials.push({
    row: {
      id, course: course.code, title: m.title, type: m.type, topics: m.topics || [], body: body.trim(),
      status: 'approved', source: 'platform', position: i,
      file_path: m.file ? `${slug(course.code)}/${slug(displayName(m.file))}` : null,
      file_name: m.file ? displayName(m.file) : null,
    },
    file: m.file ? path.join(dir, m.file) : null,
  })
}

const chars = materials.reduce((n, m) => n + m.row.body.length, 0)
console.log(`${course.code}: ${materials.length} materials, ${materials.filter(m => m.file).length} files, ${chars.toLocaleString()} characters of text.`)
if (dryRun) {
  for (const m of materials) console.log(`  ${String(m.row.position).padStart(2)}  ${m.row.type.padEnd(18)} ${m.row.title}  (${m.row.body.length.toLocaleString()} chars)`)
  console.log('Dry run: nothing written.')
  process.exit(0)
}
if (prepareOnly) {
  console.log('Prepared: every material has its text. Nothing written to the database.')
  process.exit(0)
}

// The course itself.
check(await db.from('courses').upsert({
  code: course.code, name: course.name, lecturer: course.lecturer, credits: course.credits ?? 3,
  color: course.color ?? '#0D1B3D', prompt: course.prompt, topics: course.topics ?? [],
  current_week: course.current_week ?? null, total_weeks: course.total_weeks ?? null,
  starters: course.starters ?? [], synthetic_class: course.synthetic_class ?? false,
  position: course.position ?? 0, active: course.active ?? true,
}))
console.log(`Course ${course.code} saved.`)

// The private bucket for original files (schema.sql also creates it).
const { data: bucket } = await db.storage.getBucket(BUCKET)
if (!bucket) check(await db.storage.createBucket(BUCKET, { public: false }))

for (const m of materials) {
  if (m.file) {
    const ext = path.extname(m.file).toLowerCase()
    check(await db.storage.from(BUCKET).upload(m.row.file_path, await readFile(m.file), {
      upsert: true, contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
    }))
  }
  check(await db.from('materials').upsert(m.row))
  console.log(`  ✓ ${m.row.title}`)
}

// Platform materials for this course that are no longer listed.
const keep = new Set(materials.map(m => m.row.id))
const old = check(await db.from('materials').select('id, title, file_path').match({ course: course.code, source: 'platform' }))
  .filter(m => !keep.has(m.id))
for (const m of old) {
  if (m.file_path) await db.storage.from(BUCKET).remove([m.file_path])
  check(await db.from('materials').delete().eq('id', m.id))
  console.log(`  − removed ${m.title}`)
}

console.log(`Done. ${course.code} is live for students within a minute.`)
