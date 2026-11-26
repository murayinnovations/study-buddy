import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { z } from 'zod/v4'
import { MODEL, EFFORT, FALLBACK, getClient, logUsage } from '../../../lib/claude'
import { courseMaterials, deleteBank, getBank, hasDatabase, lecturerCourse, saveBank, setBankStatus, type Material } from '../../../lib/db'
import { requireMember } from '../../../lib/auth'
import type { KnowledgeItem } from '../../../lib/assessment'

// The lecturer's starting-level questions for the onboarding assessment. GET: their course's
// bank. POST { action }: 'generate' has Claude write a new draft from the course's approved
// material; 'approve' puts it in front of students; 'unapprove' takes it back to draft;
// 'discard' deletes it. Until a bank is approved, students rate their own familiarity
// (or get the built-in bank, for courses that have one).

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const PER_LEVEL = 4

const Items = z.object({
  questions: z.array(z.object({
    level: z.number().int().min(1).max(3),
    prompt: z.string().min(1).max(600),
    options: z.array(z.string().min(1).max(300)).length(4),
    answer: z.number().int().min(0).max(3),
  })).min(PER_LEVEL * 3).max(PER_LEVEL * 3 + 3),
})

const TOOL: Anthropic.Beta.BetaTool = {
  name: 'submit_questions',
  description: 'Submit the starting-level questions.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            level: { type: 'integer', description: '1 = basic recall, 2 = understanding and connecting ideas, 3 = applying them to a new situation' },
            prompt: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
            answer: { type: 'integer', description: 'Index (0 to 3) of the correct option' },
          },
          required: ['level', 'prompt', 'options', 'answer'],
        },
      },
    },
    required: ['questions'],
  },
}

const SYSTEM = `You write the starting-level questions for Study Buddy's onboarding assessment. A student answers 8 of them, drawn at random, before the course starts, so Study Buddy knows where to begin teaching them. The course's approved materials are attached as documents: base every question on them, using their terminology. Never invent facts the materials don't support. Each question has four options with exactly one correct, and wrong options that reflect real misunderstandings, not jokes. Each question stands on its own, and none gives away another's answer. Write in plain text: no markdown, no emoji.`

const toDocument = (m: Material): Anthropic.Beta.BetaRequestDocumentBlock => ({
  type: 'document',
  source: { type: 'text', media_type: 'text/plain', data: m.body },
  title: m.title,
  context: `${m.type} · Topics: ${m.topics.join(', ')}`,
})

async function lecturerAndCourse() {
  const member = await requireMember('lecturer')
  if (member instanceof Response) return member
  const course = await lecturerCourse(member)
  return course ?? Response.json({ error: 'You have no course on Study Buddy yet.' }, { status: 404 })
}

export async function GET() {
  if (!hasDatabase()) return Response.json({ error: 'The database is not configured.' }, { status: 503 })
  const course = await lecturerAndCourse()
  if (course instanceof Response) return course
  try {
    return Response.json({ bank: await getBank(course.code) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Reading the assessment bank failed:', err)
    return Response.json({ error: 'Could not load the questions. Has supabase/schema.sql been run?' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  if (!hasDatabase()) return Response.json({ error: 'The database is not configured.' }, { status: 503 })
  const course = await lecturerAndCourse()
  if (course instanceof Response) return course
  const action = (await req.json().catch(() => ({}))).action
  try {
    if (action === 'approve' || action === 'unapprove') {
      await setBankStatus(course.code, action === 'approve' ? 'approved' : 'draft')
      return Response.json({ bank: await getBank(course.code) })
    }
    if (action === 'discard') {
      await deleteBank(course.code)
      return Response.json({ bank: null })
    }
    if (action !== 'generate') return Response.json({ error: 'Unknown action.' }, { status: 400 })
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'Study Buddy is not configured yet.' }, { status: 500 })

    const materials = await courseMaterials(course.code)
    const docs = [...materials.notes, ...materials.extra].map(toDocument)
    if (docs.length === 0) return Response.json({ error: 'Approve some course material first: the questions are written from it.' }, { status: 400 })

    const topics = course.topics.map(t => t.topic).join('; ')
    const res = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: EFFORT },
      ...FALLBACK,
      system: SYSTEM,
      tools: [TOOL],
      // Not a forced tool choice: that can't be combined with the thinking the effort setting may use.
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: [
        ...docs,
        { type: 'text', text: `Write ${PER_LEVEL * 3} starting-level questions for ${course.name}: ${PER_LEVEL} at level 1, ${PER_LEVEL} at level 2 and ${PER_LEVEL} at level 3. Spread them across the course's topics (${topics}), weighted towards the early ones. Vary which option is correct. Submit them with the ${TOOL.name} tool.` },
      ] }],
    })
    logUsage('assessment-bank', EFFORT, res.usage, ` ${course.code}`)

    const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (!call) throw new Error(`no ${TOOL.name} call (stop: ${res.stop_reason})`)
    const parsed = Items.safeParse(call.input)
    if (!parsed.success) throw new Error(`invalid ${TOOL.name} input: ${parsed.error.message}`)
    const items: KnowledgeItem[] = parsed.data.questions.map(q => ({ ...q, level: q.level as 1 | 2 | 3, id: `${course.code}-${randomUUID().slice(0, 8)}` }))
    if ([1, 2, 3].some(level => items.filter(i => i.level === level).length < 3)) throw new Error('too few questions at some level')
    await saveBank(course.code, items)
    return Response.json({ bank: await getBank(course.code) })
  } catch (err) {
    console.error(`Assessment bank ${action} failed:`, err)
    return Response.json({ error: action === 'generate' ? 'Study Buddy could not write the questions. Try again in a moment.' : 'Could not save that. Please try again.' }, { status: 502 })
  }
}
