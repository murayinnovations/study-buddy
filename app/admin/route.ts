import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { realMember, VIEW_AS_COOKIE } from '../lib/auth'

// The admin page's own address, used by the approval email's button. Admins land on the
// admin page even if they'd switched to another view; anyone else is told it's for admins.

export const dynamic = 'force-dynamic'

const escape = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

export async function GET(req: NextRequest) {
  const real = await realMember()
  if (!real) return NextResponse.redirect(new URL('/login', req.url))
  if (real.role === 'admin') {
    cookies().delete(VIEW_AS_COOKIE)
    return NextResponse.redirect(new URL('/', req.url))
  }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admins only · Study Buddy</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#F8FAFC;font-family:system-ui,sans-serif}
div{max-width:420px;background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:28px}
h1{font-size:17px;color:#0F172A;margin:0}p{font-size:13px;color:#64748B;line-height:1.6;margin:8px 0 18px}
button{font:inherit;font-size:13px;font-weight:600;padding:9px 16px;border:0;border-radius:8px;background:#2563EB;color:#fff;cursor:pointer}
a{display:inline-block;margin-left:12px;font-size:13px;color:#64748B}</style></head>
<body><div><h1>This page is for Study Buddy admins</h1>
<p>You're signed in as ${escape(real.email)}, which isn't an admin account. Sign out, then sign in with your admin account to review learning platforms.</p>
<form action="/auth/signout" method="post"><button type="submit">Sign out</button><a href="/">Back to Study Buddy</a></form></div></body></html>`
  return new Response(html, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}
