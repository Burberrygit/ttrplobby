// Deno Deploy / Supabase Edge Function: delete-account
// Deletes the caller's account + data. Requires:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY
//
// Client must send: Authorization: Bearer <access_token>

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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // User client (to verify the caller's JWT)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }
    const uid = user.id

    // Admin client (service role) to perform deletes
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1) End any live rooms the user hosts (RPC will also delete poster file if you implemented it)
    const { data: rooms, error: roomsErr } = await supabaseAdmin
      .from('live_rooms')
      .select('id')
      .eq('host_id', uid)
    if (roomsErr) throw roomsErr
    if (rooms && rooms.length) {
      for (const r of rooms) {
        // Best effort: call your RPC if present, else hard delete
        const rpc = await supabaseAdmin.rpc('end_live_room', { p_room_id: r.id })
        if (rpc.error) {
          await supabaseAdmin.from('live_rooms').delete().eq('id', r.id)
        }
      }
    }

    // 2) Delete user-scoped storage folders (avatars/{uid}, posters/{uid})
    async function deleteFolder(bucket: string, prefix: string) {
      // Flat delete (top-level). If you use deeper nesting, add recursion here.
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 })
      if (files && files.length) {
        const paths = files.map((f) => `${prefix}/${f.name}`)
        await supabaseAdmin.storage.from(bucket).remove(paths)
      }
    }
    await deleteFolder('avatars', uid)
    await deleteFolder('posters', uid)

    // 3) Delete related rows
    await supabaseAdmin.from('live_presence').delete().eq('user_id', uid).throwOnError()
    // If you have other user-owned tables, delete them here.

    // 4) Delete profile row
    await supabaseAdmin.from('profiles').delete().eq('id', uid).throwOnError()

    // 5) Delete the auth user
    const del = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (del.error) {
      // If this fails, the profile is already gone but auth remains.
      // Report an error so the client can show a message.
      return new Response('Failed to delete auth user', { status: 500, headers: corsHeaders })
    }

    return new Response(null, { status: 204, headers: corsHeaders })
  } catch (e) {
    return new Response(String(e?.message ?? e), { status: 500, headers: corsHeaders })
  }
})
