import { NextRequest } from 'next/server'
import { fileLink } from '../../lib/db'
import { requireMember } from '../../lib/auth'

// Opens the original file behind a course material (/api/materials?id=…) with a
// short-lived link, for members who can see that course.
export async function GET(req: NextRequest) {
  const member = await requireMember()
  if (member instanceof Response) return member
  const id = req.nextUrl.searchParams.get('id') || ''
  try {
    const url = id && await fileLink(member, id)
    if (!url) return Response.json({ error: 'File not found.' }, { status: 404 })
    return Response.redirect(url, 302)
  } catch (err) {
    console.error('Opening a course file failed:', err)
    return Response.json({ error: 'Could not open the file.' }, { status: 502 })
  }
}
