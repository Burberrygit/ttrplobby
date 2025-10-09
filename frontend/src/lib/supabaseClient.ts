// File: frontend/src/lib/supabaseClient.ts
'use client'

import { createClient } from '@supabase/supabase-js'

/**
 * IMPORTANT:
 * Do NOT fall back to a different Supabase project on the client.
 * If these env vars are missing at runtime, throw so you catch misconfig fast.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Ensure these are set in your hosting environment and exposed to the client.'
  )
}

// Optional: keep a single client during HMR / across imports
const globalForSupabase = globalThis as unknown as { _sb?: ReturnType<typeof createClient> }

export const supabase =
  globalForSupabase._sb ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Parse OAuth (?code=) and magic-link (#access_token) callbacks in-browser
      detectSessionInUrl: true,
    },
  })

if (!globalForSupabase._sb) globalForSupabase._sb = supabase

