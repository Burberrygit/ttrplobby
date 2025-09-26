import { supabase } from '@/lib/supabaseClient'

export async function saveProfile({
  username,
  avatar_url,
  bio,
}: {
  username?: string
  avatar_url?: string
  bio?: string
}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw authErr || new Error('Not signed in')

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,                      // must equal auth.user.id
        username: username ?? null,
        avatar_url: avatar_url ?? null,
        bio: bio ?? null,
      },
      { onConflict: 'id' }
    )

  if (error) throw error
  return true
}
