// frontend/src/lib/supabaseClient.ts
'use client'

import { createClient } from '@supabase/supabase-js'

// Safe: anon key + project URL (protected by RLS)
export const SUPABASE_URL = "https://xruuiswdyeozpfiwjjnu.supabase.co"
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydXVpc3dkeWVvenBmaXdqam51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5Mzg3ODMsImV4cCI6MjA3MzUxNDc4M30.pxWvCOnbIIjMYNZzfDhy_TpSmMGxzP0SJXauaHYflwM"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
