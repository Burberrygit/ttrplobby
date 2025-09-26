// File: frontend/src/lib/live.ts
import { supabase } from '@/lib/supabaseClient'

export type LiveGame = {
  id: string
  host_id: string
  title: string
  system: string | null
  status: 'live' | 'open' | 'completed' | 'cancelled' | string
  seats: number
  vibe: string | null
  poster_url: string | null
  time_zone: string | null
  discord_url: string | null
  external_url: string | null
  created_at: string
  updated_at: string
}

export async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Not signed in')
  return user
}

export async function startLiveGame(input: {
  title: string
  system: string | null
  seats: number
  vibe: string | null
  time_zone: string | null
  discord_url: string | null
  external_url: string | null
  poster_file?: File | null
}): Promise<string> {
  const user = await requireUser()

  let poster_url: string | null = null
  if (input.poster_file) {
    const ext = (input.poster_file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('posters')
      .upload(path, input.poster_file, { cacheControl: '3600', upsert: true, contentType: input.poster_file.type || 'image/*' })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('posters').getPublicUrl(path)
    poster_url = data.publicUrl || null
  }

  const payload = {
    host_id: user.id,
    title: input.title || 'Live Lobby',
    system: input.system,
    status: 'live' as const,
    seats: input.seats || 5,
    vibe: input.vibe,
    poster_url,
    time_zone: input.time_zone,
    discord_url: input.discord_url,
    external_url: input.external_url,
  }

  const { data, error } = await supabase
    .from('games')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error

  // ensure the host is also in members table
  await supabase.from('game_players').insert({ game_id: data.id, user_id: user.id, role: 'host' }).then(() => {}, () => {})

  return data.id as string
}

export type PresenceUser = {
  id: string
  name: string
  avatar_url: string | null
  role: 'host' | 'player' | string
}

export function presenceChannel(gameId: string) {
  // Presence channel name may be any string; keep it namespaced.
  return supabase.channel(`presence:lobby:${gameId}`, {
    config: { presence: { key: 'presence' } }
  })
}

export function messagesChannel(gameId: string) {
  // Postgres changes channel for chat messages table
  return supabase.channel(`messages:lobby:${gameId}`, {
    config: {
      broadcast: { self: true },
      presence: { key: 'presence' }
    }
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

export async function sendLobbyMessage(gameId: string, body: string) {
  const user = await requireUser()
  if (!body.trim()) return
  const { error } = await supabase
    .from('lobby_messages')
    .insert({ game_id: gameId, user_id: user.id, body })
  if (error) throw error
}

export async function fetchLobbyMessages(gameId: string, limit = 100) {
  const { data, error } = await supabase
    .from('lobby_messages')
    .select('id, user_id, body, created_at, user:profiles(id,display_name,username,avatar_url)')
    .eq('game_id', gameId)
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
