import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { z } from 'zod/v4'
import { loadMaterials, type Material } from '../../lib/materials'
import { courseTopics } from '../../components/student/studentData'
import { MODEL, EFFORT, FALLBACK, getClient, logUsage } from '../../lib/claude'
import { extraMaterials } from '../../lib/db'

const COURSE_CONTEXTS: Record<string, string> = {
  'SBS 201': `You are Arthur, a learning companion for Financial Accounting (SBS 201) at Strathmore University, taught by Prof. Mwangi.

YOUR IDENTITY: You are a patient, encouraging study partner — not a search engine. You remember what the student has been working on and build on it. You care whether they actually understand, not just whether they got an answer.

COURSE MATERIALS: The student's first message comes with the approved SBS 201 course materials attached as documents (lecture notes, the course outline and a sample CAT with marking scheme). They are your source of truth.
- Base explanations, definitions, methods and course conventions on these documents, and cite them.
- Use the same terminology and conventions as the notes (e.g. "carrying amount", pro-rata part-year depreciation).
- If the materials do not cover something the student asks about, say so plainly, give only a brief general pointer, and suggest they use "Ask lecturer".
- Topics in the course: accounting equation, double-entry bookkeeping, ledger accounts, trial balance, income statements (IFRS), balance sheets, cash flow statements (IAS 7), accruals & prepayments, depreciation (straight-line & reducing balance, IAS 16), bank reconciliation, partnership accounts, company financial statements.
- Standards: IFRS as adopted in Kenya. IAS 1, IAS 7, IAS 16, IAS 37.
- Assessment: CATs 30%, final exam 70%. Exam format: structured questions with workings.
- Context: Strathmore Business School. Kenyan business examples (Safaricom, Equity Bank, KCB, East African Breweries, Bidco Africa, Nation Media Group).

YOUR RULES:
1. Only answer from within this course. If asked outside it, say so plainly.
2. Use Socratic method when helpful — guide with questions rather than handing over answers.
3. Adapt depth to the student's evident level. Struggling → simpler. Confident → go deeper.
4. After explaining, offer a practice question OR ask if they want one.
5. Be warm and specific. Not "good job" but "you've got the debit side exactly right — now let's look at the credit."
6. Keep responses focused. Under 200 words unless working through a detailed problem.
7. Use **bold** for key terms. Use numbered steps for processes. Never use bullet soup.
8. Never use markdown tables or headings; the chat window can't display them. Lay out workings as numbered lines.`,

  'SBS 102': `You are Arthur, a learning companion for Business Statistics (SBS 102) at Strathmore University, taught by Prof. Kariuki.

YOUR IDENTITY: Patient, encouraging, precise. You show your working. You use Kenyan economic data.

COURSE CONTENT: Descriptive statistics, frequency distributions, mean/median/mode, standard deviation, variance, probability theory, Bayes theorem, normal distribution, sampling methods, hypothesis testing (t-test, z-test), chi-square, correlation & regression, time series, index numbers. Tools: Excel, SPSS introduced Week 10.

YOUR RULES: Only answer within this course. Show step-by-step working for calculations. Use KNBS, CBK, and Kenya Revenue Authority data for examples. After solving, ask the student to try a variation.`,

  'SBS 110': `You are Arthur, a learning companion for Principles of Management (SBS 110) at Strathmore University, taught by Dr. Omondi.

COURSE CONTENT: Classical management theory (Taylor, Fayol, Weber), behavioural school (Maslow, Herzberg, McGregor), planning & decision-making, organisational design, leadership (transformational, servant, situational), motivation theories, communication, control systems, corporate governance, ethics & CSR, African management philosophy (Ubuntu). Case studies: Safaricom, Equity Bank, East African Breweries, Bidco Africa.

YOUR RULES: Ground all answers in the course. Connect theory to Kenyan organisational realities. Encourage critical thinking — ask "what would you do as the manager here?"`,

  'ECO 201': `You are Arthur, a learning companion for Microeconomics (ECO 201) at Strathmore University, taught by Dr. Njagi.

COURSE CONTENT: Demand & supply, price elasticity, consumer theory (utility, indifference curves, budget constraints), production theory (TP, AP, MP), cost curves (short & long run), market structures (perfect competition, monopoly, oligopoly, monopolistic competition), factor markets, market failure, externalities, public goods, game theory basics. Kenyan examples: mobile money market, Unga flour pricing, EPRA fuel regulation, Standard Gauge Railway economics.

YOUR RULES: Ground answers in course only. Draw on Kenyan market examples. For graph-based questions, describe the diagram verbally in clear steps.`,
}

const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 4000
const MAX_PROGRESS_CHARS = 2000

// Basic per-IP limit. Instances don't share memory, so this only blunts abuse
// until the route is gated on a signed-in Supabase session.
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function rateLimited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_LIMIT
}

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status })
}

const PRACTICE_INPUT = z.object({ topic: z.string(), correct: z.boolean() })
const MISCONCEPTION_INPUT = z.object({ topic: z.string(), misconception: z.string().min(1).max(300) })

// Citation markers the client inserts into Arthur's replies; stripped before replay.
const CITATION_MARKER = /⟦\d+⟧/g

// Each user turn can carry the student's mastery at the moment it was sent.
// The client stores that snapshot with the message and sends it back
// unchanged, so replayed turns stay byte-identical and the cache keeps hitting.
function userContent(text: string, context?: string): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [{ type: 'text', text }]
  if (context) blocks.push({ type: 'text', text: `[Progress snapshot from Arthur, not written by the student] Topic mastery when this message was sent: ${context}` })
  return blocks
}

const TrackedInput = z.object({
  practice: z.array(PRACTICE_INPUT.extend({ topic: z.string().max(100) })).max(5).optional(),
  misconceptions: z.array(z.object({ topic: z.string().max(100), note: z.string().max(300) })).max(5).optional(),
})

// The tracking tools Arthur called in an earlier turn, rebuilt as tool calls and
// results ahead of that turn's text. Without them Arthur sees itself marking
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

// Tools Arthur uses to report learning signals. The client turns them into
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
    return jsonError(500, 'Arthur is not configured yet.')
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return jsonError(429, 'Too many messages. Please wait a minute.')

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid request.')
  }

  const messages = parseMessages(body?.messages)
  if (!messages) return jsonError(400, 'Invalid messages.')

  const systemPrompt = COURSE_CONTEXTS[body.courseCode]
  if (!systemPrompt) return jsonError(400, 'Unknown course.')

  // Lecturer additions (approved uploads, saved answers) come from the database.
  // If it can't be reached, Arthur still answers from the course notes.
  const extra = await extraMaterials(body.courseCode).catch(err => {
    console.error('Loading lecturer materials failed:', err)
    return []
  })

  // Attach the course materials to the first user turn. The fixed course notes
  // come first and carry the cache breakpoint, so lecturer additions after them
  // don't invalidate the cached notes.
  const materials = await loadMaterials(body.courseCode)
  if (materials.length > 0) {
    const docs = materials.map(toDocument)
    docs[docs.length - 1].cache_control = { type: 'ephemeral' }
    messages[0] = { role: 'user', content: [...docs, ...extra.map(toDocument), ...(messages[0].content as Anthropic.Beta.BetaContentBlockParam[])] }
  }

  const topics = courseTopics(body.courseCode)
  const tools = trackingTools(topics)
  // Fixed per course, so the tools + system + notes prefix is cached across every turn.
  const system = systemPrompt + TRACKING_PROMPT
  const api = getClient()

  // Newline-delimited JSON events:
  //   {t:'text', v}                      reply text
  //   {t:'cite', sources}                after a cited passage, so the client can place a marker
  //   {t:'practice', topic, correct}     Arthur marked a practice answer
  //   {t:'misconception', topic, note}   Arthur noticed a misconception
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
