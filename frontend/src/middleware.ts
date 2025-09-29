import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return req.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
      }
    }
  })

  // Touch the session so @supabase/ssr can refresh cookies if needed
  await supabase.auth.getUser()
  return res
}

export const config = {
  // Run for all pages and API routes. If you prefer, narrow this to just pages that need auth.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
