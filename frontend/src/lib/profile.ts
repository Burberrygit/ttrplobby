import { supabase } from '@/lib/supabaseClient'

export async function saveProfile({
  username,
  display_name,          // ← add this
  avatar_url,
  bio,
}: {
  username?: string
  display_name?: string  // ← add this
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
        display_name: (display_name ?? username) ?? null, // ← your new field
        avatar_url: avatar_url ?? null,
        bio: bio ?? null,
      },
      { onConflict: 'id' }
    )

  if (error) throw error
  return true
}
