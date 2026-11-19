import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { MODEL, EFFORT, FALLBACK, getClient, logUsage } from '../../lib/claude'
import { getCourse, courseMaterials, type Material } from '../../lib/db'
import { requireMember } from '../../lib/auth'

const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 4000
const MAX_PROGRESS_CHARS = 2000

// Per-student limit. Instances don't share memory, so this is approximate.
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function rateLimited(key: string) {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > RATE_LIMIT
}

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status })
}

const PRACTICE_INPUT = z.object({ topic: z.string(), correct: z.boolean() })
const MISCONCEPTION_INPUT = z.object({ topic: z.string(), misconception: z.string().min(1).max(300) })

// Citation markers the client inserts into Study Buddy's replies; stripped before replay.
const CITATION_MARKER = /⟦\d+⟧/g

// Each user turn can carry the student's mastery at the moment it was sent.
// The client stores that snapshot with the message and sends it back
// unchanged, so replayed turns stay byte-identical and the cache keeps hitting.
function userContent(text: string, context?: string): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [{ type: 'text', text }]
  if (context) blocks.push({ type: 'text', text: `[Progress snapshot from Study Buddy, not written by the student] Topic mastery when this message was sent: ${context}` })
  return blocks
}

const TrackedInput = z.object({
  practice: z.array(PRACTICE_INPUT.extend({ topic: z.string().max(100) })).max(5).optional(),
  misconceptions: z.array(z.object({ topic: z.string().max(100), note: z.string().max(300) })).max(5).optional(),
})

// The tracking tools Study Buddy called in an earlier turn, rebuilt as tool calls and
// results ahead of that turn's text. Without them Study Buddy sees itself marking
// answers without recording them, and is more likely to skip the tools.
// Rebuilt the same way every time, so the conversation prefix stays cacheable.
function trackedTurn(index: number, raw: unknown): Anthropic.Beta.BetaMessageParam[] {
  const parsed = TrackedInput.safeParse(raw)
  if (!parsed.success) return []
  const calls = [
    ...(parsed.data.practice || []).map(p => ({ name: 'record_practice_result', input: p, result: 'Recorded.' })),
    ...(parsed.data.misconceptions || []).map(m => ({ name: 'note_misconception', input: { topic: m.topic, misconception: m.note }, result: 'Noted for the lecturer.' })),
  ]
  if (calls.length === 0) return []
  const id = (n: number) => `toolu_history_${index}_${n}`
  return [
    { role: 'assistant', content: calls.map((c, n) => ({ type: 'tool_use' as const, id: id(n), name: c.name, input: c.input })) },
    { role: 'user', content: calls.map((c, n) => ({ type: 'tool_result' as const, tool_use_id: id(n), content: c.result })) },
  ]
}

function parseMessages(raw: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null
  const messages: Anthropic.Beta.BetaMessageParam[] = []
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i]
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null
    if (typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS) return null
    if (m.context !== undefined && (typeof m.context !== 'string' || m.context.length > MAX_PROGRESS_CHARS)) return null
    if (m.role === 'user') {
      messages.push({ role: 'user', content: userContent(m.content, m.context) })
    } else {
      // Tool calls can't open the conversation, which must start with the student.
      if (messages.length > 0) messages.push(...trackedTurn(i, m))
      messages.push({ role: 'assistant', content: m.content.replace(CITATION_MARKER, '') })
    }
  }
  // The API requires the conversation to start with a user turn, so drop the
  // client-side welcome message (and anything else before the first question).
  const firstUser = messages.findIndex(m => m.role === 'user')
  if (firstUser === -1) return null
  const trimmed = messages.slice(firstUser)
  return trimmed[trimmed.length - 1].role === 'user' ? trimmed : null
}

// Cited passages are raw markdown from the notes; show them as plain text.
// Lines are joined with a space after punctuation, or a dash between headings and table rows.
function plainQuote(text: string) {
  const lines = text.split('\n')
    .filter(l => !/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l))   // table separator rows
    .map(l => l
      .replace(/^\s*(#{1,6}|[-*])\s+/, '')                // heading and bullet marks
      .replace(/\*\*|__|`/g, '')
      .replace(/^\s*\||\|\s*$/g, '')                     // table row edges
      .replace(/\s*\|\s*/g, ' · ')                        // table cells
      .trim())
    .filter(Boolean)
  return lines.reduce((out, l) => !out ? l : out + (/[.:;?!]$/.test(out) ? ' ' : ' — ') + l, '')
}

function toDocument(m: Material): Anthropic.Beta.BetaRequestDocumentBlock {
  return {
    type: 'document',
    source: { type: 'text', media_type: 'text/plain', data: m.body },
    title: m.title,
    context: `${m.type} · Topics: ${m.topics.join(', ')}`,
    citations: { enabled: true },
  }
}

// Tools Study Buddy uses to report learning signals. The client turns them into
// mastery changes and lecturer insights; the tool results just confirm receipt.
function trackingTools(topics: string[]): Anthropic.Beta.BetaTool[] {
  return [
    {
      name: 'record_practice_result',
      description: 'Record the result of the student\'s answer to a practice question that you set. Call it once for every answer, whether right, partly right or wrong, in the same turn as your feedback. Do not call it for questions the student asks you, or before the student has answered.',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: topics, description: 'The course topic the question tested' },
          correct: { type: 'boolean', description: 'True if the answer was fully correct, including workings' },
        },
        required: ['topic', 'correct'],
      },
    },
    {
      name: 'note_misconception',
      description: 'Note a specific misconception the student has shown, so their lecturer can address it in class. Use it when the student\'s reasoning reveals a wrong belief (not a slip), at most once per misconception.',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: topics },
          misconception: { type: 'string', description: 'One sentence describing the wrong belief, without the student\'s name' },
        },
        required: ['topic', 'misconception'],
      },
    },
  ]
}

// The parts of Study Buddy's instructions that are the same in every course.
// Each course's own instructions (who teaches it, what it covers, how to teach it)
// are in the courses table.

const MATERIALS_PROMPT = `

COURSE MATERIALS: The student's first message comes with the course's approved materials attached as documents (lecture notes, slides, practical workbooks, assignments, sample datasets, and answers the lecturer has saved). They are your source of truth.
- Base explanations, definitions, methods and course conventions on these documents, and cite them.
- Use the same terminology and conventions as the materials.
- If the materials do not cover something the student asks about, say so plainly, give only a brief general pointer, and suggest they use "Ask lecturer".`

const NO_MATERIALS_PROMPT = `

COURSE MATERIALS: No course materials have been approved for this course yet. Stay within the course syllabus above, and suggest "Ask lecturer" for anything course-specific such as assessment details.`

const FORMAT_PROMPT = `

FORMAT: Keep responses focused, under 200 words unless working through a detailed problem. Use **bold** for key terms and numbered steps for processes. Never use markdown tables or headings; the chat window can't display them. Lay out workings as numbered lines.`

const TRACKING_PROMPT = `

PROGRESS TRACKING: You have two tools that update the student's progress and inform their lecturer.
- Whenever the student answers a practice question you set, call record_practice_result before giving your feedback, with the topic and whether the answer was fully correct. Do this for every answer: right, partly right or wrong (partly right counts as not correct). This is how the student's mastery score changes, so never skip it.
- When the student's reasoning shows a genuine misconception, call note_misconception.
Never mention these tools to the student.

Student messages may end with a progress snapshot showing their topic mastery at that moment. Use the latest one to gently steer revision toward weak areas when natural. Don't quote it back unless asked.`

const MAX_TOOL_ROUNDS = 4

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set')
    return jsonError(500, 'Study Buddy is not configured yet.')
  }

  const member = await requireMember('student')
  if (member instanceof Response) return member
  if (rateLimited(member.email)) return jsonError(429, 'Too many messages. Please wait a minute.')

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid request.')
  }

  const messages = parseMessages(body?.messages)
  if (!messages) return jsonError(400, 'Invalid messages.')

  // The course, its instructions and its material all come from the database.
  let course: Awaited<ReturnType<typeof getCourse>> = null
  let materials: Awaited<ReturnType<typeof courseMaterials>> | undefined
  try {
    course = typeof body.courseCode === 'string' ? await getCourse(body.courseCode) : null
    if (course) materials = await courseMaterials(course.code)
  } catch (err) {
    console.error('Loading the course failed:', err)
    return jsonError(502, 'Study Buddy could not load this course. Try again in a moment.')
  }
  if (!course || !materials) return jsonError(400, 'Unknown course.')

  // Attach the course material to the first user turn. The imported course notes
  // come first and carry the cache breakpoint, so lecturer additions after them
  // don't invalidate the cached notes.
  const notes = materials.notes.map(toDocument)
  if (notes.length > 0) notes[notes.length - 1].cache_control = { type: 'ephemeral' }
  const docs = [...notes, ...materials.extra.map(toDocument)]
  if (docs.length > 0) {
    messages[0] = { role: 'user', content: [...docs, ...(messages[0].content as Anthropic.Beta.BetaContentBlockParam[])] }
  }

  const topics = course.topics.map(t => t.topic)
  const tools = trackingTools(topics)
  // Fixed per course, so the tools + system + notes prefix is cached across every turn.
  const system = course.prompt + (docs.length > 0 ? MATERIALS_PROMPT : NO_MATERIALS_PROMPT) + FORMAT_PROMPT + TRACKING_PROMPT
  const api = getClient()

  // Newline-delimited JSON events:
  //   {t:'text', v}                      reply text
  //   {t:'cite', sources}                after a cited passage, so the client can place a marker
  //   {t:'practice', topic, correct}     Study Buddy marked a practice answer
  //   {t:'misconception', topic, note}   Study Buddy noticed a misconception
  const encoder = new TextEncoder()
  let current: ReturnType<typeof api.beta.messages.stream> | null = null
  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      let lastText = ''
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = api.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            output_config: { effort: EFFORT },
            ...FALLBACK,
            // Caches the whole conversation so far; the notes keep their own breakpoint.
            cache_control: { type: 'ephemeral' },
            system,
            tools,
            messages,
          })
          current = stream

          const blockSources = new Map<number, { title: string; quote: string }[]>()
          // Separate text that resumes after a tool call from what came before.
          let needsBreak = round > 0 && lastText !== '' && !lastText.endsWith('\n')
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              if (needsBreak) { send({ t: 'text', v: '\n\n' }); needsBreak = false }
              send({ t: 'text', v: event.delta.text })
              lastText = event.delta.text
            } else if (event.type === 'content_block_delta' && event.delta.type === 'citations_delta') {
              const c = event.delta.citation
              if (c.type === 'char_location') {
                const list = blockSources.get(event.index) || []
                list.push({ title: c.document_title || 'Course material', quote: plainQuote(c.cited_text) })
                blockSources.set(event.index, list)
              }
            } else if (event.type === 'content_block_stop' && blockSources.has(event.index)) {
              send({ t: 'cite', sources: blockSources.get(event.index) })
              blockSources.delete(event.index)
            }
          }
          const final = await stream.finalMessage()
          logUsage('chat', EFFORT, final.usage, ` ${body.courseCode} round ${round + 1}`)

          if (final.stop_reason === 'refusal') {
            send({ t: 'text', v: "\n\nI can't help with that one. Let's get back to the course material." })
            break
          }
          const toolUses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
          if (final.stop_reason === 'max_tokens') {
            send({ t: 'text', v: '\n\n(My answer was cut short. Ask me to continue.)' })
            break
          }
          if (final.stop_reason !== 'tool_use' || toolUses.length === 0) break

          // Validate each input before acting on it: with eager input
          // streaming the API does not, and a bad topic must not reach the client.
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map(tool => {
            if (tool.name === 'record_practice_result') {
              const p = PRACTICE_INPUT.safeParse(tool.input)
              if (p.success && topics.includes(p.data.topic)) {
                send({ t: 'practice', topic: p.data.topic, correct: p.data.correct })
                return { type: 'tool_result', tool_use_id: tool.id, content: 'Recorded.' }
              }
            } else if (tool.name === 'note_misconception') {
              const p = MISCONCEPTION_INPUT.safeParse(tool.input)
              if (p.success && topics.includes(p.data.topic)) {
                send({ t: 'misconception', topic: p.data.topic, note: p.data.misconception })
                return { type: 'tool_result', tool_use_id: tool.id, content: 'Noted for the lecturer.' }
              }
            }
            return { type: 'tool_result', tool_use_id: tool.id, is_error: true, content: `Invalid input: ${JSON.stringify(tool.input)}` }
          })
          messages.push({ role: 'assistant', content: final.content })
          messages.push({ role: 'user', content: results })
        }
        controller.close()
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) console.error('Claude rate limit:', err.message)
        else if (err instanceof Anthropic.APIError) console.error(`Claude API error ${err.status}:`, err.message)
        else console.error('Chat stream failed:', err)
        controller.error(err)
      }
    },
    cancel() {
      current?.abort()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
