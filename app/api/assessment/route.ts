import { z } from 'zod/v4'
import { approvedBanks, hasDatabase, lastServed, listCourses, optOutOfProfile, saveProfile } from '../../lib/db'
import { requireMember } from '../../lib/auth'
import { publicAssessment, readSitting, scoreAssessment, type Submission } from '../../lib/assessment'

// The onboarding assessment. GET: a sitting's questions (no answers). POST: one finished
// sitting, scored here and saved as the student's new current profile. DELETE: study
// without a profile; with ?answers=delete, every profile row is deleted too.

export const dynamic = 'force-dynamic'

const choice = z.number().int().min(0).max(9)
const id = z.string().min(1).max(64)

const SubmissionSchema = z.object({
  token: z.string().min(1).max(2_000),
  knowledge: z.object({
    answers: z.array(z.object({ id, choice, confidence: z.number().int().min(1).max(5) })).max(20),
  }).optional(),
  span: z.array(z.string().max(20)).max(20),
  reading: z.array(z.object({ id, choice })).max(20),
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
    const [courses, banks, served] = await Promise.all([listCourses(), approvedBanks(), lastServed(member.studentId!)])
    return Response.json(publicAssessment(courses, member.studentId!, banks, served), { headers: { 'Cache-Control': 'no-store' } })
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
  const sitting = readSitting(submission.token, member.studentId!)
  if (!sitting) return Response.json({ error: 'This sitting has expired. Please start the assessment again.' }, { status: 400 })
  try {
    const [courses, banks] = await Promise.all([listCourses(), approvedBanks()])
    const { profile, evidence } = scoreAssessment(submission, courses, sitting, banks)
    await saveProfile(member.studentId!, profile, evidence)
    return Response.json({ profile })
  } catch (err) {
    console.error('Saving the profile failed:', err)
    return Response.json({ error: 'Could not save your profile. Please try again.' }, { status: 502 })
  }
}

export async function DELETE(req: Request) {
  if (!hasDatabase()) return Response.json({ error: 'The database is not configured.' }, { status: 503 })
  const member = await requireMember('student')
  if (member instanceof Response) return member
  try {
    await optOutOfProfile(member.studentId!, new URL(req.url).searchParams.get('answers') === 'delete')
    return Response.json({ ok: true })
  } catch (err) {
    console.error('Opting out of the profile failed:', err)
    return Response.json({ error: 'Could not save that. Please try again.' }, { status: 502 })
  }
}
