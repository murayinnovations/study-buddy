// Manages who can sign in to Curriculum AI.
//
//   node --env-file=.env.local scripts/members.mjs list
//   node --env-file=.env.local scripts/members.mjs add <email> student "<name>" <student number> [--sample] [--subtitle "<text>"] [--group <name>]
//   node --env-file=.env.local scripts/members.mjs add <email> lecturer|hod "<name>" [--subtitle "<text>"] [--group <name>]
//   node --env-file=.env.local scripts/members.mjs remove <email>
//
// --sample starts a student from the demo's sample progress instead of zero (for demo accounts).
// --group puts an account in a demo group: members of the same group can switch between each
// other's views with one click in the app, instead of signing in separately as each role. Give
// the student, lecturer and HoD demo accounts the same --group value to enable that for them.
// Adding an existing email updates it. Changes reach a running app within a minute.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (run with --env-file=.env.local).')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const flag = name => {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const [, value] = args.splice(i, 2)
  return value
}
const sample = args.includes('--sample')
if (sample) args.splice(args.indexOf('--sample'), 1)
const subtitle = flag('--subtitle')
const group = flag('--group')
const [command, rawEmail, role, name, studentId] = args

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (command === 'list') {
  const { data, error } = await db.from('members').select('email, role, name, student_id, sample_data, demo_group').order('role').order('email')
  if (error) fail(error.message)
  console.table(data)
} else if (command === 'add') {
  const email = rawEmail?.toLowerCase()
  if (!email?.includes('@') || !['student', 'lecturer', 'hod'].includes(role) || !name) fail('Usage: add <email> <student|lecturer|hod> "<name>" [student number]')
  if (role === 'student' && !studentId) fail('Students need a student number, e.g. STR-2024-0117.')
  const { error } = await db.from('members').upsert({
    email, role, name, subtitle: subtitle ?? null,
    student_id: role === 'student' ? studentId : null,
    sample_data: role === 'student' && sample,
    demo_group: group ?? null,
  })
  if (error) fail(error.message)
  console.log(`${email} can now sign in as ${role}.${group ? ` In demo group "${group}".` : ''}`)
} else if (command === 'remove') {
  const { error } = await db.from('members').delete().eq('email', rawEmail?.toLowerCase())
  if (error) fail(error.message)
  console.log(`${rawEmail} removed. Their saved work stays in the database.`)
} else {
  fail('Commands: list, add, remove. See the top of this file.')
}
