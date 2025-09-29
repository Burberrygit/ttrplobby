// supabase/functions/delete-account/index.ts
// Edge Function: hard-delete the caller's account + data.
// Uses function secrets: PROJECT_URL, ANON_KEY, SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // Read secrets (SUPABASE_* names are blocked in function secrets)
    const SUPABASE_URL = Deno.env.get('PROJECT_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('ANON_KEY')!
    const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

    // Verify caller (user client with the caller's JWT)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    const uid = user.id

    // Admin client (service role)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1) End any live rooms the user hosts
    const { data: rooms, error: roomsErr } = await supabaseAdmin
      .from('live_rooms')
      .select('id')
      .eq('host_id', uid)
    if (roomsErr) throw roomsErr
    if (rooms?.length) {
      for (const r of rooms) {
        const rpc = await supabaseAdmin.rpc('end_live_room', { p_room_id: r.id })
        if (rpc.error) {
          await supabaseAdmin.from('live_rooms').delete().eq('id', r.id)
        }
      }
    }

    // 2) Delete user-scoped storage
    async function deleteFolder(bucket: string, prefix: string) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 })
      if (files?.length) {
        const paths = files.map((f) => `${prefix}/${f.name}`)
        await supabaseAdmin.storage.from(bucket).remove(paths)
      }
    }
    await deleteFolder('avatars', uid)
    await deleteFolder('posters', uid)

    // 3) Delete related rows
    await supabaseAdmin.from('live_presence').delete().eq('user_id', uid).throwOnError()
    // TODO: delete from any other user-owned tables here.

    // 4) Delete profile row
    await supabaseAdmin.from('profiles').delete().eq('id', uid).throwOnError()

    // 5) Delete the auth user
    const del = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (del.error) return new Response('Failed to delete auth user', { status: 500, headers: corsHeaders })

    return new Response(null, { status: 204, headers: corsHeaders })
  } catch (e: any) {
    return new Response(e?.message || 'Internal error', { status: 500, headers: corsHeaders })
  }
})
