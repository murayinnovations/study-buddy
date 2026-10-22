import { z } from 'zod/v4'
import { COURSES } from '../../components/student/studentData'
import { hasDatabase, loadState, applyAction, mayApply, type StoreAction } from '../../lib/db'
import { requireMember } from '../../lib/auth'

// The browser's only door to the database: GET reads what the signed-in member
// can see, POST applies one change they're allowed to make. Inputs are
// validated and sized here.

export const dynamic = 'force-dynamic'

const course = z.enum(COURSES.map(c => c.code) as [string, ...string[]])
const id = z.string().min(1).max(64)
const text = (max: number) => z.string().max(max)

const message = z.object({
  role: z.enum(['user', 'assistant']),
  content: text(20_000),
  sources: z.array(z.object({ title: text(300), quote: text(5_000) })).max(30).optional(),
  events: z.array(z.object({
    kind: z.literal('practice'), topic: text(100), correct: z.boolean(), before: z.number(), after: z.number(),
  })).max(10).optional(),
  misconceptions: z.array(z.object({ topic: text(100), note: text(300) })).max(10).optional(),
  context: text(2_000).optional(),
  failed: z.boolean().optional(),
})

const Action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setChat'), course, messages: z.array(message).max(200) }),
  z.object({ type: z.literal('clearChat'), course }),
  z.object({ type: z.literal('recordPractice'), course, topic: text(100), correct: z.boolean(), countSession: z.boolean() }),
  z.object({ type: z.literal('noteMisconception'), id, course, topic: text(100), note: text(300) }),
  z.object({
    type: z.literal('askLecturer'), id, course, topic: text(100), urgency: z.enum(['High', 'Medium', 'Low']),
    question: text(2_000).min(1), context: text(2_000),
  }),
  z.object({ type: z.literal('replyToQuestion'), id, reply: text(5_000).min(1) }),
  z.object({ type: z.literal('saveAnswerToCourse'), id }),
  z.object({ type: z.literal('markRepliesSeen') }),
  z.object({
    type: z.literal('uploadMaterial'), id, course, title: text(200).min(1), materialType: text(50),
    topics: z.array(text(100)).max(10), body: text(40_000).min(1),
  }),
  z.object({ type: z.literal('approveMaterial'), id }),
  z.object({ type: z.literal('removeMaterial'), id }),
  z.object({ type: z.literal('addGoal'), id, goal: text(300).min(1), week: text(50) }),
  z.object({ type: z.literal('mapGoal'), id }),
  z.object({ type: z.literal('approvePractice'), id: z.number().int() }),
  z.object({
    type: z.literal('saveBrief'), course,
    brief: z.object({
      items: z.array(z.object({ topic: text(200), focus: text(1_000), minutes: z.number().int() })).max(10),
      generatedAt: z.number(), signature: text(10_000),
    }),
  }),
  z.object({ type: z.literal('sendCheckIn'), studentId: id }),
])

const notConfigured = () => Response.json({ error: 'The database is not configured.' }, { status: 503 })

export async function GET() {
  if (!hasDatabase()) return notConfigured()
  try {
    const member = await requireMember()
    if (member instanceof Response) return member
    return Response.json(await loadState(member), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Loading state failed:', err)
    return Response.json({ error: 'Could not load your data.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  if (!hasDatabase()) return notConfigured()
  const member = await requireMember().catch(() => null)
  if (!member) return Response.json({ error: 'Could not check your sign-in.' }, { status: 502 })
  if (member instanceof Response) return member
  let action: StoreAction
  try {
    action = Action.parse(await req.json()) as StoreAction
  } catch {
    return Response.json({ error: 'Invalid change.' }, { status: 400 })
  }
  if (!mayApply(member, action)) return Response.json({ error: 'Not allowed.' }, { status: 403 })
  try {
    await applyAction(member, action)
    return Response.json({ ok: true })
  } catch (err) {
    console.error(`Saving ${action.type} failed:`, err)
    return Response.json({ error: 'Could not save the change.' }, { status: 502 })
  }
}
