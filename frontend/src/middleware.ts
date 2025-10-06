import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
      }
    }
  })

  // Touch the session so @supabase/ssr can refresh cookies if needed
  const { data: { user } } = await supabase.auth.getUser()

  // Gate apply pages behind auth
  const path = req.nextUrl.pathname
  const isApplyPage = /^\/schedule\/[^/]+\/apply$/.test(path)

  if (isApplyPage && !user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  // Only run where auth is required (faster, clearer)
  matcher: ['/schedule/:id/apply'],
}
