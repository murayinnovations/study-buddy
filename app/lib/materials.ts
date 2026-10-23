import { promises as fs } from 'fs'
import path from 'path'

// Course materials Curriculum AI answers from. Until the Supabase materials table
// exists, these are the markdown files under content/<course dir>/.
const COURSE_DIRS: Record<string, string> = {
  'SBS 201': 'sbs201',
}

export interface Material {
  title: string
  type: string
  topics: string[]
  body: string
}

const cache = new Map<string, Material[]>()

function parseMaterial(raw: string, fallbackTitle: string): Material {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  const meta: Record<string, string> = {}
  if (match) {
    for (const line of match[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
  const topics = (meta.topics || '').replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean)
  return {
    title: meta.title || fallbackTitle,
    type: meta.type || 'Course material',
    topics,
    body: (match ? raw.slice(match[0].length) : raw).trim(),
  }
}

export function hasMaterials(courseCode: string) {
  return courseCode in COURSE_DIRS
}

export async function loadMaterials(courseCode: string): Promise<Material[]> {
  const dir = COURSE_DIRS[courseCode]
  if (!dir) return []
  const cached = cache.get(courseCode)
  if (cached) return cached

  const fullDir = path.join(process.cwd(), 'content', dir)
  // Sorted so the documents (and therefore the prompt cache prefix) are byte-stable.
  const files = (await fs.readdir(fullDir)).filter(f => f.endsWith('.md')).sort()
  const materials = await Promise.all(
    files.map(async f => parseMaterial(await fs.readFile(path.join(fullDir, f), 'utf8'), f.replace(/\.md$/, ''))),
  )
  cache.set(courseCode, materials)
  return materials
}
