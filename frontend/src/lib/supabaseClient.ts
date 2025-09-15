// frontend/src/lib/supabaseClient.ts
'use client'

import { createClient } from '@supabase/supabase-js'

// Safe: anon key + project URL (protected by RLS)
export const SUPABASE_URL = "https://YOUR-REF.supabase.co"
export const SUPABASE_ANON = "YOUR-ANON-KEY"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
