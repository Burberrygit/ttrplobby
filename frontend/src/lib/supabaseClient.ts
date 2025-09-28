// frontend/src/lib/supabaseClient.ts
'use client'

import { createClient } from '@supabase/supabase-js'

// Prefer env (Netlify) but fall back to current values so local/preview keeps working.
const URL_FROM_ENV = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) as string | undefined
const KEY_FROM_ENV = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined

export const SUPABASE_URL = URL_FROM_ENV ?? 'https://xruuiswdyeozpfiwjjnu.supabase.co'
export const SUPABASE_ANON = KEY_FROM_ENV ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydXVpc3dkeWVvenBmaXdqam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg3ODMsImV4cCI6MjA3MzUxNDc4M30.pxWvCOnbIIjMYNZzfDhy_TpSmMGxzP0SJXauaHYflwM'

// Persist session on the client and auto-refresh tokens
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})

