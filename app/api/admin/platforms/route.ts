import { z } from 'zod/v4'
import { requireMember } from '../../../lib/auth'
import { listPlatforms, reviewPlatform } from '../../../lib/lti'

// The learning platforms registered to open Curriculum AI, for admins to approve.

export const dynamic = 'force-dynamic'

export async function GET() {
  const member = await requireMember('admin')
  if (member instanceof Response) return member
  const platforms = await listPlatforms()
  return Response.json({
    platforms: platforms.map(p => ({
      id: p.id, issuer: p.issuer, name: p.name, status: p.status, deployments: p.deployment_ids.length,
      registeredAt: p.created_at, reviewedBy: p.reviewed_by, reviewedAt: p.reviewed_at,
    })),
  })
}

const Body = z.object({ id: z.number().int(), status: z.enum(['approved', 'rejected']) })

export async function POST(req: Request) {
  const member = await requireMember('admin')
  if (member instanceof Response) return member
  let body
  try { body = Body.parse(await req.json()) } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  await reviewPlatform(body.id, body.status, member.email)
  return Response.json({ ok: true })
}
