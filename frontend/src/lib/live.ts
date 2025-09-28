// File: frontend/src/lib/live.ts
import { supabase } from '@/lib/supabaseClient'

export type LiveRoom = {
  id: string
  host_id: string
  title: string
  system: string | null
  vibe: string | null
  poster_url: string | null
  discord_url: string | null
  game_url: string | null
  status: string
  created_at: string
}

async function requireUser() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  const user = session?.user
  if (!user) throw new Error('Not signed in')
  return user
}

function slugify(name: string) {
  return (name || 'poster')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

export async function startLiveGame(input: {
  title: string
  system: string | null
  vibe?: string | null
  discord_url?: string | null
  external_url?: string | null
  poster_file?: File | null
}): Promise<string> {
  const user = await requireUser()

  let poster_url: string | null = null
  if (input.poster_file) {
    const ext = (input.poster_file.name.split('.').pop() || 'jpg').toLowerCase()
    const base = slugify(input.title || input.poster_file.name)
    const path = `${user.id}/${Date.now()}-${base}.${ext}` // satisfy "own folder" policy

    const uploaded = await supabase.storage
      .from('posters')
      .upload(path, input.poster_file, { upsert: false, cacheControl: '3600', contentType: input.poster_file.type || 'image/*' })

    if (uploaded.error) {
      console.error('STORAGE upload failed', uploaded.error, { path, userId: user.id })
      throw new Error(`Poster upload failed: ${uploaded.error.message}`)
    }

    const { data: pub } = supabase.storage.from('posters').getPublicUrl(path)
    poster_url = pub.publicUrl
  }

  const insertPayload: any = {
    host_id: user.id,              // RLS: must equal auth.uid()
    title: input.title || 'Live Lobby',
    system: input.system,
    vibe: input.vibe ?? null,
    poster_url,
    discord_url: input.discord_url ?? null,
    game_url: input.external_url ?? null,
    status: 'active',              // column exists on live_rooms in your schema
  }

  const { data, error } = await supabase
    .from('live_rooms')
    .insert([insertPayload])
    .select('id')
    .single()

  if (error) {
    console.error('DB insert failed', error, insertPayload)
    throw new Error(`Create live room failed: ${error.message}`)
  }

  return String((data as any).id)
}

// ---- Presence / chat helpers (unchanged) ----

export type PresenceUser = {
  id: string
  name: string
  avatar_url: string | null
  role: 'host' | 'player' | string
}

export function presenceChannel(roomId: string) {
  return supabase.channel(`presence:lobby:${roomId}`, {
    config: { presence: { key: 'presence' } }
  })
}

export function messagesChannel(roomId: string) {
  return supabase.channel(`messages:lobby:${roomId}`, {
    config: { broadcast: { self: true }, presence: { key: 'presence' } }
  })
}

export async function getMyProfileLite() {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  const name = data?.display_name || data?.username || 'Player'
  return { id: user.id, name, avatar_url: data?.avatar_url || null }
}

export async function sendLobbyMessage(roomId: string, body: string) {
  const user = await requireUser()
  if (!body.trim()) return
  const { error } = await supabase
    .from('lobby_messages')
    .insert({ game_id: roomId, user_id: user.id, body })
  if (error) throw error
}

export async function fetchLobbyMessages(roomId: string, limit = 100) {
  const { data, error } = await supabase
    .from('lobby_messages')
    .select('id, user_id, body, created_at, user:profiles(id,display_name,username,avatar_url)')
    .eq('game_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    body: m.body,
    created_at: m.created_at,
    user: {
      id: m.user?.id,
      name: m.user?.display_name || m.user?.username || 'Player',
      avatar_url: m.user?.avatar_url || null,
    }
  }))
}


