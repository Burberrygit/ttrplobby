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
  welcomes_new: boolean
  is_mature: boolean
  created_at: string
  updated_at: string
  players_count?: number
}

/** Ensure user is signed in; return user.id (throws if not) */
export async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Not signed in')
  return user.id
}

/** Create a new game for the current user (host). Returns the game id. */
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
    welcomes_new: input.welcomes_new ?? true,
    is_mature: input.is_mature ?? false,
  }
  const { data, error } = await supabase
    .from('games')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error

  // add host membership
  const { error: memErr } = await supabase
    .from('game_players')
    .insert({ game_id: data.id, user_id: userId, role: 'host' })
  if (memErr) throw memErr

  return data.id as string
}

/** Return open games (optionally filter client-side after). Includes players_count aggregate. */
export async function fetchOpenGames(): Promise<Game[]> {
  await requireUserId() // enforce auth for RLS
  const { data, error } = await supabase
    .from('games')
    .select('id,host_id,title,system,poster_url,scheduled_at,status,seats,length_min,vibe,welcomes_new,is_mature,created_at,updated_at, game_players(count)')
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

/** Fetch one game by id, with players_count. */
export async function fetchGame(id: string): Promise<Game | null> {
  await requireUserId()
  const { data, error } = await supabase
    .from('games')
    .select('id,host_id,title,system,poster_url,scheduled_at,status,seats,length_min,vibe,welcomes_new,is_mature,created_at,updated_at, game_players(count)')
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

/** Is current user a member of the game? */
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

/** Join a game (if not full). */
export async function joinGame(gameId: string) {
  const userId = await requireUserId()
  const g = await fetchGame(gameId)
  if (!g) throw new Error('Game not found')
  if (g.players_count !== undefined && g.seats !== undefined && g.players_count >= g.seats) {
    throw new Error('This game is full')
  }
  // ignore if already member
  const isMember = await amIMember(gameId)
  if (isMember) return true

  const { error } = await supabase
    .from('game_players')
    .insert({ game_id: gameId, user_id: userId, role: 'player' })
  if (error) throw error
  return true
}

/** Leave a game (removes your membership). */
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

/** Delete game (host only). */
export async function deleteGame(gameId: string) {
  await requireUserId()
  const { error } = await supabase.from('games').delete().eq('id', gameId)
  if (error) throw error
  return true
}

/** End game (host only) — mark completed. */
export async function endGame(gameId: string) {
  await requireUserId()
  const { error } = await supabase
    .from('games')
    .update({ status: 'completed' })
    .eq('id', gameId)
  if (error) throw error
  return true
}
