// File: frontend/src/lib/profile.ts
import { supabase } from '@/lib/supabaseClient'

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at?: string
  updated_at?: string
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveProfile({
  username,
  display_name,
  avatar_url,
  bio,
}: {
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw authErr || new Error('Not signed in')

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username: username ?? null,
        display_name: (display_name ?? username) ?? null,
        avatar_url: avatar_url ?? null,
        bio: bio ?? null,
      },
      { onConflict: 'id' }
    )

  if (error) throw error
  return true
}
