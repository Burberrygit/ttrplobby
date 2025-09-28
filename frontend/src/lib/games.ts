// File: frontend/src/lib/games.ts
import { supabase } from '@/lib/supabaseClient'

export type Game = {
  id: string
  host_id: string
  title: string
  system: string | null
  poster_url: string | null
  scheduled_at: string | null
  status: 'draft' | 'open' | 'full' | 'completed' | 'cancelled'
  seats: number
  length_min: number | null
  vibe: string | null
  description: string | null           // <-- added
  welcomes_new: boolean
  is_mature: boolean
  created_at: string
  updated_at: string
  players_count?: number
}

export async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Not signed in')
  return user.id
}

export async function createGame(input: Partial<Game>): Promise<string> {
  const userId = await requireUserId()
  const payload = {
    host_id: userId,
    title: input.title ?? 'Untitled game',
    system: input.system ?? null,
    poster_url: input.poster_url ?? null,
    scheduled_at: input.scheduled_at ?? null,
    status: (input.status as Game['status']) ?? 'open',
    seats: input.seats ?? 5,
    length_min: input.length_min ?? null,
    vibe: input.vibe ?? null,
    description: input.description ?? null,   // <-- added
    welcomes_new: input.welcomes_new ?? true,
    is_mature: input.is_mature ?? false,
  }
  const { data, error } = await supabase
    .from('games')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error

  const { error: memErr } = await supabase
    .from('game_players')
    .insert({ game_id: data.id, user_id: userId, role: 'host' })
  if (memErr) throw memErr

  return data.id as string
}

export async function updateGame(gameId: string, patch: Partial<Game>): Promise<void> {
  await requireUserId()
  const { error } = await supabase
    .from('games')
    .update({
      title: patch.title,
      system: patch.system !== undefined ? patch.system : undefined,
      poster_url: patch.poster_url !== undefined ? patch.poster_url : undefined,
      scheduled_at: patch.scheduled_at !== undefined ? patch.scheduled_at : undefined,
      status: patch.status as Game['status'] | undefined,
      seats: patch.seats !== undefined ? patch.seats : undefined,
      length_min: patch.length_min !== undefined ? patch.length_min : undefined,
      vibe: patch.vibe !== undefined ? patch.vibe : undefined,
      description: patch.description !== undefined ? patch.description : undefined,   // <-- added
      welcomes_new: patch.welcomes_new !== undefined ? patch.welcomes_new : undefined,
      is_mature: patch.is_mature !== undefined ? patch.is_mature : undefined,
    })
    .eq('id', gameId)
  if (error) throw error
}

export async function fetchOpenGames(): Promise<Game[]> {
  await requireUserId()
  const { data, error } = await supabase
    .from('games')
    .select('id,host_id,title,system,poster_url,scheduled_at,status,seats,length_min,vibe,description,welcomes_new,is_mature,created_at,updated_at, game_players(count)') // <-- description added
    .eq('status', 'open')
    .order('scheduled_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data as any[]).map((g) => ({
    ...g,
    players_count: Array.isArray(g.game_players) && g.game_players.length
      ? Number(g.game_players[0].count)
      : 0,
  }))
}

export async function fetchGame(id: string): Promise<Game | null> {
  await requireUserId()
  const { data, error } = await supabase
    .from('games')
    .select('id,host_id,title,system,poster_url,scheduled_at,status,seats,length_min,vibe,description,welcomes_new,is_mature,created_at,updated_at, game_players(count)') // <-- description added
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const players_count =
    Array.isArray((data as any).game_players) && (data as any).game_players.length
      ? Number((data as any).game_players[0].count)
      : 0
  return { ...(data as any), players_count }
}

export async function amIMember(gameId: string): Promise<boolean> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('game_players')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return Boolean(data)
}

export async function joinGame(gameId: string) {
  const userId = await requireUserId()
  const g = await fetchGame(gameId)
  if (!g) throw new Error('Game not found')
  if (g.players_count !== undefined && g.seats !== undefined && g.players_count >= g.seats) {
    throw new Error('This game is full')
  }
  const isMember = await amIMember(gameId)
  if (isMember) return true
  const { error } = await supabase
    .from('game_players')
    .insert({ game_id: gameId, user_id: userId, role: 'player' })
  if (error) throw error
  return true
}

export async function leaveGame(gameId: string) {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('game_players')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId)
  if (error) throw error
  return true
}

export async function deleteGame(gameId: string) {
  await requireUserId()
  const { error } = await supabase.from('games').delete().eq('id', gameId)
  if (error) throw error
  return true
}

export async function endGame(gameId: string) {
  await requireUserId()
  const { error } = await supabase
    .from('games')
    .update({ status: 'completed' })
    .eq('id', gameId)
  if (error) throw error
  return true
}

/* Profile helpers */

export async function fetchMyHostedGames(): Promise<Game[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('games')
    .select('id,host_id,title,system,poster_url,status,seats,length_min,vibe,description,welcomes_new,is_mature,created_at,updated_at, game_players(count)') // <-- description added
    .eq('host_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as any[]).map((g) => ({
    ...g,
    players_count: Array.isArray(g.game_players) && g.game_players.length
      ? Number(g.game_players[0].count)
      : 0,
  }))
}

export async function fetchMyJoinedGames(): Promise<Game[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('game_players')
    .select('game:games(id,host_id,title,system,poster_url,status,seats,length_min,vibe,description,welcomes_new,is_mature,created_at,updated_at, game_players(count))') // <-- description added
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data as any[]) ?? []
  return rows.map((r) => {
    const g = r.game
    const players_count = Array.isArray(g.game_players) && g.game_players.length
      ? Number(g.game_players[0].count)
      : 0
    return { ...(g as any), players_count }
  })
}
