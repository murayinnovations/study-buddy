import { z } from 'zod/v4'
import { hasDatabase, listCourses, saveProfile } from '../../lib/db'
import { requireMember } from '../../lib/auth'
import { publicAssessment, scoreAssessment, type Submission } from '../../lib/assessment'

// The onboarding assessment. GET: the questions (no answers). POST: one finished
// sitting, scored here and saved as the student's new current profile.

export const dynamic = 'force-dynamic'

const choice = z.number().int().min(0).max(9)
const id = z.string().min(1).max(64)

const SubmissionSchema = z.object({
  knowledge: z.object({
    course: z.string().min(1).max(100),
    answers: z.array(z.object({ id, choice, confidence: z.number().int().min(1).max(5) })).max(20),
  }).optional(),
  span: z.array(z.object({ sequence: z.string().max(12), answer: z.string().max(20) })).max(10),
  reading: z.array(z.object({ id, choice })).max(10),
  readingSeconds: z.number().min(0).max(36_000),
  context: z.object({
    minutesPerWeek: z.number().int().min(0).max(3_000),
    sessionMinutes: z.number().int().min(5).max(240),
    format: z.enum(['worked_examples', 'explain_then_practice', 'questions_first']),
    device: z.enum(['phone', 'laptop', 'both']),
    connectivity: z.enum(['reliable', 'patchy']),
    accessibility: z.array(z.enum(['largerText', 'captions', 'extraTime'])).max(3),
    familiarity: z.record(z.string().max(100), z.enum(['new', 'some', 'confident'])),
  }),
})

export async function GET() {
  const member = await requireMember('student')
  if (member instanceof Response) return member
  try {
    const courses = await listCourses()
    return Response.json(publicAssessment(courses), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Loading the assessment failed:', err)
    return Response.json({ error: 'Could not load the assessment.' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  if (!hasDatabase()) return Response.json({ error: 'The database is not configured.' }, { status: 503 })
  const member = await requireMember('student')
  if (member instanceof Response) return member
  let submission: Submission
  try {
    submission = SubmissionSchema.parse(await req.json()) as Submission
  } catch {
    return Response.json({ error: 'Invalid answers.' }, { status: 400 })
  }
  try {
    const courses = await listCourses()
    const { profile, evidence } = scoreAssessment(submission, courses)
    await saveProfile(member.studentId!, profile, evidence)
    return Response.json({ profile })
  } catch (err) {
    console.error('Saving the profile failed:', err)
    return Response.json({ error: 'Could not save your profile. Please try again.' }, { status: 502 })
  }
}
