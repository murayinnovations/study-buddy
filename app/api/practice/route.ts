import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod/v4'
import { MODEL, EFFORT, FALLBACK, getClient, logUsage } from '../../lib/claude'
import { getCourse, courseMaterials, currentProfile, type Material } from '../../lib/db'
import { requireMember } from '../../lib/auth'
import { learnerContext, SET_SIZE, CARDS_PER_SESSION } from '../../lib/profile'

// Writes a quiz or a flashcard deck for one topic, from the course's approved material,
// sized and pitched by the student's cognitive profile. The quiz answers go to the
// browser: this is practice, and the student's answers are recorded as practice results.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60_000
const hits = new Map<string, number[]>()
function rateLimited(key: string) {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > RATE_LIMIT
}

const PracticeRequest = z.object({ course: z.string().min(1).max(100), topic: z.string().min(1).max(100), kind: z.enum(['quiz', 'cards']) })

const Quiz = z.object({
  questions: z.array(z.object({
    question: z.string().min(1).max(800),
    options: z.array(z.string().min(1).max(300)).length(4),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().min(1).max(800),
  })).min(1).max(10),
})
const Cards = z.object({
  cards: z.array(z.object({ front: z.string().min(1).max(300), back: z.string().min(1).max(600) })).min(1).max(20),
})

const QUIZ_TOOL: Anthropic.Beta.BetaTool = {
  name: 'submit_quiz',
  description: 'Submit the practice quiz.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
            answer: { type: 'integer', description: 'Index (0 to 3) of the correct option' },
            explanation: { type: 'string', description: 'Why the answer is right, in 1 to 3 sentences' },
          },
          required: ['question', 'options', 'answer', 'explanation'],
        },
      },
    },
    required: ['questions'],
  },
}
const CARDS_TOOL: Anthropic.Beta.BetaTool = {
  name: 'submit_cards',
  description: 'Submit the flashcard deck.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            front: { type: 'string', description: 'A term, question or prompt' },
            back: { type: 'string', description: 'The answer, in 1 to 3 sentences' },
          },
          required: ['front', 'back'],
        },
      },
    },
    required: ['cards'],
  },
}

const SYSTEM = `You write practice material for Study Buddy, a university study companion. The course's approved materials are attached as documents: base every question, answer and explanation on them, using their terminology and conventions. Never invent facts the materials don't support. Follow the learner profile for difficulty, wording and length. Write in plain text: no markdown, no emoji.`

const toDocument = (m: Material): Anthropic.Beta.BetaRequestDocumentBlock => ({
  type: 'document',
  source: { type: 'text', media_type: 'text/plain', data: m.body },
  title: m.title,
  context: `${m.type} · Topics: ${m.topics.join(', ')}`,
})

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'Study Buddy is not configured yet.' }, { status: 500 })
  const member = await requireMember('student')
  if (member instanceof Response) return member
  if (rateLimited(member.email)) return Response.json({ error: 'You have made a lot of practice sets. Please wait a few minutes.' }, { status: 429 })

  let body: z.infer<typeof PracticeRequest>
  try {
    body = PracticeRequest.parse(await req.json())
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const course = await getCourse(body.course)
    if (!course || !course.topics.some(t => t.topic === body.topic)) return Response.json({ error: 'Unknown course or topic.' }, { status: 400 })
    const [materials, { profile }] = await Promise.all([courseMaterials(course.code), currentProfile(member.studentId!)])

    // The notes carry the cache breakpoint, as in the chat, so repeated sets are quick.
    const notes = materials.notes.map(toDocument)
    if (notes.length > 0) notes[notes.length - 1].cache_control = { type: 'ephemeral' }
    const docs = [...notes, ...materials.extra.map(toDocument)]

    const tool = body.kind === 'quiz' ? QUIZ_TOOL : CARDS_TOOL
    const count = body.kind === 'quiz'
      ? Number(profile ? SET_SIZE[profile.chunkSize] : 5)
      : profile ? CARDS_PER_SESSION[profile.chunkSize] : 10
    const ask = body.kind === 'quiz'
      ? `Write a practice quiz of exactly ${count} multiple-choice questions on the topic "${body.topic}" in ${course.name}. Each has four options with exactly one correct, plausible wrong options that reflect common mistakes, and a short explanation of the right answer. Order them from easier to harder. Vary which option is correct.`
      : `Write a deck of exactly ${count} flashcards on the topic "${body.topic}" in ${course.name}. Each front is a key term, idea or short question; each back is the answer in one to three sentences. Cover the ideas a student most needs to remember, without repeats.`

    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...docs,
      ...(profile ? [{ type: 'text' as const, text: learnerContext(profile, course.code) }] : []),
      { type: 'text', text: (docs.length ? ask : `${ask}\n\nNo course materials are approved yet: stay within the course syllabus.\n\n${course.prompt}`) + `\n\nSubmit it with the ${tool.name} tool.` },
    ]

    const res = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: EFFORT },
      ...FALLBACK,
      system: SYSTEM,
      tools: [tool],
      // Not a forced tool choice: that can't be combined with the thinking the effort setting may use.
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content }],
    })
    logUsage('practice', EFFORT, res.usage, ` ${course.code} ${body.kind}`)

    const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (!call) throw new Error(`no ${tool.name} call (stop: ${res.stop_reason})`)
    const parsed = (body.kind === 'quiz' ? Quiz : Cards).safeParse(call.input)
    if (!parsed.success) throw new Error(`invalid ${tool.name} input: ${parsed.error.message}`)
    return Response.json({ topic: body.topic, ...parsed.data })
  } catch (err) {
    console.error('Writing practice failed:', err)
    return Response.json({ error: 'Study Buddy could not write this set. Try again in a moment.' }, { status: 502 })
  }
}
