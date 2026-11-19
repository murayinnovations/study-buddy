import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { checkLaunch, launchCourse, launchMember, LtiError, page, STATE_COOKIE } from '../../lib/lti'
import { signInAs, VIEW_AS_COOKIE } from '../../lib/auth'

// Step 2 of a launch: the platform posts the signed launch here. If it checks out,
// the person is signed in (their account made if this is their first time) and
// lands in the app with the activity's course open.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const form = new URLSearchParams(await req.text())
  const idToken = form.get('id_token')
  const state = form.get('state')
  const jar = cookies()
  if (!idToken || !state) return page('Could not open Curriculum AI', 'The learning platform sent an incomplete launch.', 400)
  if (!jar.get(STATE_COOKIE + state)) {
    return page('Could not open Curriculum AI', 'This launch was started in a different browser or took too long. Please open Curriculum AI from the course again.', 400)
  }
  jar.delete({ name: STATE_COOKIE + state, path: '/lti/launch' })

  try {
    const launch = await checkLaunch(idToken)
    const course = await launchCourse(launch)
    const email = await launchMember(launch, course)
    await signInAs(email)
    jar.delete(VIEW_AS_COOKIE)
    return NextResponse.redirect(new URL(`/?course=${encodeURIComponent(course.code)}`, req.url), 303)
  } catch (err) {
    if (err instanceof LtiError) return page('Could not open Curriculum AI', err.message, 403)
    console.error('LTI launch failed:', err)
    return page('Could not open Curriculum AI', 'Something went wrong on our side. Please try again in a minute.', 500)
  }
}
