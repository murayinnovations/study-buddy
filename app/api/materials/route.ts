import { NextRequest } from 'next/server'
import { loadMaterials } from '../../lib/materials'

// Lists the course notes Arthur answers from (titles only, not the text).
export async function GET(req: NextRequest) {
  const course = req.nextUrl.searchParams.get('course') || ''
  const materials = await loadMaterials(course)
  // The notes only change on deploy, so let the browser reuse this list for 5 minutes.
  return Response.json(materials.map(m => ({ title: m.title, type: m.type, topics: m.topics })), {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
