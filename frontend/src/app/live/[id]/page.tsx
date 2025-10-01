// File: frontend/src/app/live/[id]/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type RoomDetails = {
  id: string
  host_id: string
  title: string | null
  system: string | null
  vibe: string | null
  seats: number | null
  length_min: number | null
  welcomes_new: boolean | null
  is_mature: boolean | null
  discord_url: string | null
  game_url: string | null
  poster_url: string | null
  status: string | null
}

type ChatMsg = {
  id: string
  userId: string
  name: string
  avatar: string | null
  text: string
  ts: number
}

/* Normalize user-provided external links (e.g. "fvtt.life" -> "https://fvtt.life") */
function normalizeExternalUrl(u?: string | null): string | null {
  if (!u) return null
  const s = u.trim()
  if (!s) return null
  if (/^[a-z]+:\/\//i.test(s)) return s        // http://, https://, etc
  if (s.startsWith('//')) return 'https:' + s   // protocol-relative
  return 'https://' + s.replace(/^\/*/, '')     // default to https
}

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

const TIPS = [
  'Share your Discord or VTT link in the card to the left.',
  'Your lobby pauses if you background the app—return to resume.',
  'Inactive lobbies auto-close after ~3 minutes. Rejoin to keep it alive.',
  'Use chat to coordinate seating and start time.',
  'Hosts can end the lobby from the Menu.',
]

/* -------------------------------- Geo presence (writes lat/lon to live_presence) -------------------------------- */
function useGeoPresence(roomId: string) {
  useEffect(() => {
    if (!isUuid(roomId)) return
    let watchId: number | null = null
    let lastSent = 0
    let cancelled = false

    async function start() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        if (!('geolocation' in navigator)) return

        async function upsert(lat: number, lon: number) {
          // Requires UNIQUE index on (user_id, room_id) for stable upserts
          await supabase
            .from('live_presence')
            .upsert(
              {
                user_id: user.id,
                room_id: roomId,
                lat,
                lon,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,room_id' }
            )
        }

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now()
            if (now - lastSent < 15000) return // throttle to ~4/min
            lastSent = now
            const { latitude, longitude } = pos.coords
            void upsert(latitude, longitude)
          },
          (_err) => {
            // silent; user may deny permission
          },
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
        )
      } catch {
        /* ignore */
      }
    }

    void start()
    return () => {
      cancelled = true
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId) } catch {}
      }
    }
  }, [roomId])
}

export default function LiveRoomPage() {
  const router = useRouter()
  const params = useSearchParams()
  const route = useParams()
  const roomId = typeof route?.id === 'string' ? route.id : Array.isArray(route?.id) ? route?.id?.[0] ?? '' : ''

  const isHost = params.get('host') === '1'

  const [me, setMe] = useState<{ id: string, name: string, avatar: string | null }>({ id: '', name: 'Player', avatar: null })
  const [room, setRoom] = useState<RoomDetails | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Presence & chat
  const [peers, setPeers] = useState<Array<{ id: string; name: string; avatar: string | null }>>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')

  // Realtime connection state
  const [rtStatus, setRtStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting')
  const [rtInfo, setRtInfo] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const retryRef = useRef(0)
  const unmountedRef = useRef(false)
  const redirectingRef = useRef(false)

  // Tip rotator (UI only)
  const [tipIndex, setTipIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4500)
    return () => clearInterval(id)
  }, [])

  // ✅ Start geo presence writer for this room (players page reads from live_presence)
  useGeoPresence(roomId)

  useEffect(() => {
    // Do nothing until we have a valid UUID route param
    if (!isUuid(roomId)) return
    unmountedRef.current = false

    let chCleanup: (() => void) | null = null

    ;(async () => {
      // Auth + profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        return
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      const myName = prof?.display_name || prof?.username || 'Player'
      setMe({ id: user.id, name: myName, avatar: prof?.avatar_url ?? null })

      // Load both live_rooms (UI/meta) and live_games (capacity, length, etc) and merge
      const [
        { data: roomRow, error: roomErr },
        { data: gameRow, error: gameErr }
      ] = await Promise.all([
        supabase.from('live_rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('live_games')
          .select('host_id,system,length_minutes,max_players,new_player_friendly,is_18_plus,status')
          .eq('id', roomId)
          .maybeSingle()
      ])

      if (unmountedRef.current) return

      if (roomErr && !roomRow) {
        setErrorMsg(roomErr.message)
      } else if (gameErr && !gameRow) {
        setErrorMsg(gameErr.message)
      }

      if (roomRow || gameRow) {
        const merged: RoomDetails = {
          ...(roomRow as any),
          host_id: (gameRow as any)?.host_id ?? (roomRow as any)?.host_id ?? null,
          system: gameRow?.system ?? (roomRow as any)?.system ?? null,
          length_min: gameRow?.length_minutes ?? (roomRow as any)?.length_min ?? null,
          seats: gameRow?.max_players ?? (roomRow as any)?.seats ?? null,
          welcomes_new: (gameRow as any)?.new_player_friendly ?? (roomRow as any)?.welcomes_new ?? null,
          is_mature: gameRow?.is_18_plus ?? (roomRow as any)?.is_mature ?? null,
          status: gameRow?.status ?? (roomRow as any)?.status ?? null,
          title: (roomRow as any)?.title ?? null,
          discord_url: (roomRow as any)?.discord_url ?? null,
          game_url: (roomRow as any)?.game_url ?? null,
          poster_url: (roomRow as any)?.poster_url ?? null,
          id: roomId,
          vibe: (roomRow as any)?.vibe ?? null,
        }
        setRoom(merged)
      }

      // Before connecting realtime, sanity-check that I am still seated (if not host)
      await ensureStillSeatedOrRedirect(user.id)

      // Connect to realtime
      connectRealtime({ userId: user.id, name: myName, avatar: prof?.avatar_url ?? null })
    })()

    function connectRealtime(self: { userId: string; name: string; avatar: string | null }) {
      // Clean any existing channel
      if (channelRef.current) {
        try { channelRef.current.unsubscribe() } catch {}
        try { supabase.removeChannel(channelRef.current) } catch {}
        channelRef.current = null
      }

      setRtStatus('connecting')
      setRtInfo(retryRef.current > 0 ? `retry #${retryRef.current}` : null)

      const ch = supabase.channel(`live:room:${roomId}`, {
        config: { presence: { key: self.userId } }
      })
      channelRef.current = ch

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState()
        const list: Array<{ id: string; name: string; avatar: string | null }> = []
        for (const [uid, arr] of Object.entries(state)) {
          const latest = (arr as any[])[(arr as any[]).length - 1]
          list.push({ id: uid, name: latest?.name || 'Player', avatar: latest?.avatar || null })
        }
        setPeers(list.sort((a, b) => a.name.localeCompare(b.name)))
      })

      ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
        const msg = payload as ChatMsg
        setChat(prev => [...prev, msg].slice(-200))
      })

      // If this client gets kicked, unsubscribe and redirect away
      ch.on('broadcast', { event: 'kicked' }, ({ payload }) => {
        const { userId, gameId } = (payload || {}) as { userId?: string; gameId?: string }
        if (userId && userId === self.userId) {
          handleKicked(gameId || roomId)
        }
      })

      ch.subscribe(async (status) => {
        if (unmountedRef.current) return
        if (status === 'SUBSCRIBED') {
          retryRef.current = 0
          setRtStatus('connected')
          setRtInfo(null)
          await ch.track({ name: self.name, avatar: self.avatar })
          const hello: ChatMsg = {
            id: crypto.randomUUID(),
            userId: 'system',
            name: 'System',
            avatar: null,
            text: `${self.name} joined the lobby`,
            ts: Date.now()
          }
          ch.send({ type: 'broadcast', event: 'chat', payload: hello })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRtStatus('error')
          setRtInfo(status === 'TIMED_OUT' ? 'Timed out' : 'Channel error')
          scheduleReconnect(self)
        } else if (status === 'CLOSED') {
          setRtStatus('closed')
          setRtInfo('Closed')
          scheduleReconnect(self)
        }
      })

      // cleanup helper
      chCleanup = () => { try { ch.unsubscribe() } catch {} }
    }

    function scheduleReconnect(self: { userId: string; name: string; avatar: string | null }) {
      if (unmountedRef.current || redirectingRef.current) return

      // Defer reconnect until tab/app is visible to avoid thrash on mobile lock/background
      if (document.visibilityState !== 'visible') {
        setRtInfo('Paused (background)')
        const once = () => {
          if (!unmountedRef.current && document.visibilityState === 'visible' && !redirectingRef.current) {
            document.removeEventListener('visibilitychange', once)
            connectRealtime(self)
          }
        }
        document.addEventListener('visibilitychange', once)
        return
      }

      const tries = retryRef.current + 1
      retryRef.current = tries
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(tries - 1, 5))) // 1s..30s
      setRtInfo(`Retrying in ${Math.round(delay/1000)}s…`)
      setTimeout(() => {
        if (unmountedRef.current || redirectingRef.current) return
        connectRealtime(self)
      }, delay)
    }

    async function ensureStillSeatedOrRedirect(userId: string) {
      if (isHost) return
      // Am I still seated in this game? If not -> redirect to search (exclude this lobby)
      const { count } = await supabase
        .from('live_game_players')
        .select('game_id', { head: true, count: 'exact' })
        .eq('game_id', roomId)
        .eq('user_id', userId)
      if (!count || count < 1) {
        handleKicked(roomId)
      }
    }

    return () => {
      unmountedRef.current = true
      if (channelRef.current) {
        try { channelRef.current.unsubscribe() } catch {}
        try { supabase.removeChannel(channelRef.current) } catch {}
        channelRef.current = null
      }
      if (chCleanup) chCleanup()
    }
  }, [roomId, router, isHost])

  // ✅ Server-backed heartbeat + membership check (keeps connection alive & redirects if removed)
  useEffect(() => {
    if (!me.id || !isUuid(roomId)) return
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null
    let paused = false

    async function heartbeatAndCheck() {
      try {
        if (!mounted || redirectingRef.current) return
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        // fire-and-forget heartbeat
        if (token) {
          fetch('/api/live/heartbeat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ room_id: roomId }),
            keepalive: true,
          }).catch(() => {})
        }

        // membership check (only for non-hosts)
        if (!isHost) {
          const { count } = await supabase
            .from('live_game_players')
            .select('game_id', { head: true, count: 'exact' })
            .eq('game_id', roomId)
            .eq('user_id', me.id)
          if (!count || count < 1) {
            handleKicked(roomId)
          }
        }
      } catch {
        /* ignore noisy errors */
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        paused = true
        try {
          const blob = new Blob([JSON.stringify({ room_id: roomId })], { type: 'application/json' })
          navigator.sendBeacon('/api/live/heartbeat', blob)
        } catch {}
      } else {
        paused = false
        void heartbeatAndCheck()
      }
    }

    document.addEventListener('visibilitychange', onVis)
    void heartbeatAndCheck()
    timer = setInterval(() => { if (!paused && mounted) void heartbeatAndCheck() }, 20000)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [me.id, roomId, isHost])

  async function endLobby() {
    if (!isUuid(roomId)) return
    const ok = confirm('End this lobby for everyone?')
    if (!ok) return
    try {
      // Prefer RPC (deletes DB row + storage + related presence)
      await supabase.rpc('end_live_room', { p_room_id: roomId })
    } catch {
      // Fallback: at least remove/close room
      try {
        await supabase.from('live_rooms').delete().eq('id', roomId)
      } catch { /* ignore */ }
    }
    router.push('/profile')
  }

  // ➕ handle being kicked — unsubscribe channel and redirect to Search with filters + exclude
  function handleKicked(gameId: string) {
    if (redirectingRef.current) return
    redirectingRef.current = true
    try {
      if (channelRef.current) {
        try { channelRef.current.unsubscribe() } catch {}
        try { supabase.removeChannel(channelRef.current) } catch {}
        channelRef.current = null
      }
    } catch {}
    try {
      const filters = JSON.parse(localStorage.getItem('live:lastFilters') || 'null') || {}
      const q = new URLSearchParams()
      if (filters.system || room?.system) q.set('system', (filters.system || room?.system))
      if (filters.npf != null || room?.welcomes_new != null) q.set('npf', String(filters.npf ?? !!room?.welcomes_new))
      if (filters.adult != null || room?.is_mature != null) q.set('adult', String(filters.adult ?? !!room?.is_mature))
      if (filters.length || room?.length_min) q.set('length', String(filters.length ?? Number(room?.length_min || 0)))
      q.set('exclude', gameId)
      router.replace(`/live/search?${q.toString()}`)
    } catch {
      router.replace('/live/search')
    }
  }

  // 🔨 Kick a player (host-only)
  async function kickPlayer(playerId: string, playerName: string) {
    if (!room?.host_id || !isHost || playerId === room.host_id) return
    const ok = confirm(`Kick ${playerName} from this lobby?`)
    if (!ok) return
    try {
      const { error } = await supabase.rpc('kick_live_player', {
        p_game_id: room.id,
        p_user_id: playerId,
      })
      if (error) {
        // If they're already gone, show a friendly note instead of surfacing the DB error
        if (String(error.message || '').toLowerCase().includes('user_not_in_game')) {
          setErrorMsg(`${playerName} is already removed.`)
          // prune from UI if still visible
          setPeers(prev => prev.filter(p => p.id !== playerId))
          return
        }
        setErrorMsg(error.message)
        return
      }
      // Optimistic UI: remove from local presence list
      setPeers(prev => prev.filter(p => p.id !== playerId))
      // Broadcast: system message + kicked signal so the target tab redirects
      const ch = channelRef.current
      if (ch) {
        const msg: ChatMsg = {
          id: crypto.randomUUID(),
          userId: 'system',
          name: 'System',
          avatar: null,
          text: `${playerName} was removed by the host`,
          ts: Date.now()
        }
        ch.send({ type: 'broadcast', event: 'chat', payload: msg })
        ch.send({ type: 'broadcast', event: 'kicked', payload: { userId: playerId, gameId: room.id } })
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to kick player')
    }
  }

  // Send chat message
  function send() {
    const msgText = text.trim()
    if (!msgText) return
    const ch = channelRef.current
    if (!ch) return
    const msg: ChatMsg = {
      id: crypto.randomUUID(),
      userId: me.id,
      name: me.name,
      avatar: me.avatar,
      text: msgText,
      ts: Date.now()
    }
    // optimistic local append
    setChat(prev => [...prev, msg].slice(-200))
    setText('')
    // fire onto the channel
    ch.send({ type: 'broadcast', event: 'chat', payload: msg })
  }

  function copyLobbyLink() {
    try {
      const url = `${location.origin}/live/${roomId}`
      navigator.clipboard.writeText(url)
      alert('Lobby link copied to clipboard')
    } catch { /* ignore */ }
  }

  // 🧮 Seats display
  const seatCap = useMemo<number | null>(() => {
    const anyRoom = room as any
    if (room?.seats != null) return Number(room.seats)
    if (anyRoom?.max_players != null) return Number(anyRoom.max_players)
    return null
  }, [room])

  const openSeats = useMemo<number | null>(() => {
    return seatCap == null ? null : Math.max(0, seatCap - peers.length)
  }, [seatCap, peers.length])

  const discordHref = normalizeExternalUrl(room?.discord_url)
  const gameHref = normalizeExternalUrl(room?.game_url)

  // Poster: ONLY uploaded poster_url or fallback to logo.png
  const isFallbackPoster = !room?.poster_url
  const posterSrc = room?.poster_url || '/logo.png'

  if (!isUuid(roomId)) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <div className="text-white/60 text-sm">Setting up lobby…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-white/30">
            <LogoIcon /><span className="font-semibold">ttrplobby</span>
          </a>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-md text-xs border ${
              rtStatus === 'connected' ? 'border-emerald-400 text-emerald-300' :
              rtStatus === 'connecting' ? 'border-white/20 text-white/60' :
              'border-red-400 text-red-300'
            }`}>
              {rtStatus === 'connected' ? 'Connected' : rtStatus === 'connecting' ? 'Connecting…' : 'Connection issue'}
            </span>
            {rtInfo && <span className="text-xs text-white/40">{rtInfo}</span>}

            {/* Profile button */}
            <a
              href="/profile"
              className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 text-sm"
            >
              Profile
            </a>

            {isHost && (
              <Menu>
                <button onClick={copyLobbyLink} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg:white/10">Copy lobby link</button>
                <button onClick={(e) => { e.preventDefault(); endLobby() }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 text-red-300">End game</button>
              </Menu>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex-1 flex">
        {/* FULL-WIDTH CENTERED OVERLAYED LOGO + STATUS/TIPS */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center justify-center translate-y-[-6%] text-center px-4">
            <img
              src="/logo.png"
              alt="TTRPLobby"
              className="w-64 h-64 md:w-80 md:h-80 opacity-90 animate-spin-slow"
            />
            <div className="mt-4 text-white/80 text-lg font-medium">Searching for active players…</div>
            <div className="mt-1 text-white/60 text-sm">{TIPS[tipIndex]}</div>
          </div>
        </div>

        {/* LEFT: Single consolidated card (on top of overlay) */}
        <aside className="relative z-10 w-full max-w-[380px] p-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur p-4 space-y-4">
            {/* Poster image above title */}
            {isFallbackPoster ? (
              <div className="flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Game image"
                  className="w-[60%] aspect-square object-contain rounded-xl border border-white/10"
                />
              </div>
            ) : (
              <img
                src={posterSrc}
                alt="Game image"
                className="w-full aspect-video object-cover rounded-xl border border-white/10"
              />
            )}

            {/* Title + meta */}
            <div>
              <div className="text-xs uppercase tracking-wide text-white/50">Live game</div>
              <h1 className="text-xl font-bold mt-1">{room?.title || 'Untitled live game'}</h1>
              <div className="text-white/70 mt-1">
                {room?.system || 'TTRPG'}
                {room?.vibe ? ` • ${room.vibe}` : ''}
                {room?.length_min ? ` • ${(room.length_min/60).toFixed(room.length_min % 60 ? 1 : 0)}h` : ''}
              </div>
              <div className="text-white/60 text-sm mt-2">
                Seats: {seatCap ?? '—'} • In lobby: {peers.length} • Open seats: {openSeats ?? '—'}
              </div>

              {/* Link buttons under seats line */}
              <div className="flex items-center gap-2 flex-wrap mt-3">
                {normalizeExternalUrl(room?.discord_url) ? (
                  <a href={normalizeExternalUrl(room?.discord_url)!} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 text-sm">
                    Discord
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-sm">Discord: not set</span>
                )}
                {normalizeExternalUrl(room?.game_url) ? (
                  <a href={normalizeExternalUrl(room?.game_url)!} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 text-sm">
                    Game link
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-sm">Game link: not set</span>
                )}
              </div>

              {errorMsg && <div className="mt-2 text-sm text-red-400">{errorMsg}</div>}
            </div>

            <hr className="border-white/10" />

            {/* Players */}
            <div>
              <div className="text-sm font-semibold mb-2">Players</div>
              <div className="space-y-2">
                {peers.map(p => {
                  const canKick = Boolean(isHost && room?.host_id && p.id !== room.host_id)
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=0B0B0E&color=FFFFFF`}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                        <div className="truncate">{p.name}</div>
                      </div>
                      <div className="relative">
                        {canKick && (
                          <PlayerMenu
                            onKick={() => kickPlayer(p.id, p.name)}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
                {peers.length === 0 && <div className="text-white/50 text-sm">No one here yet.</div>}
              </div>
            </div>

            <hr className="border-white/10" />

            {/* Note */}
            <div className="text-sm text-white/70">
              Share your Discord or VTT link above. Use chat to coordinate start time and seating. When you’re ready, click the link to move everyone over.
            </div>
          </div>
        </aside>

        {/* Spacer to keep left card pinned and allow overlay to center across full width */}
        <div className="flex-1" />
      </div>

      {/* Floating chat (bottom-right) */}
      <ChatDock
        me={me}
        messages={chat}
        onSend={send}
        value={text}
        onChange={setText}
      />

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 2.5s linear infinite; }
      `}</style>
    </div>
  )
}

/* ---------------------------- Chat Dock ---------------------------- */

function ChatDock({
  me, messages, value, onChange, onSend
}: {
  me: { id: string, name: string, avatar: string | null }
  messages: ChatMsg[]
  value: string
  onChange: (v: string) => void
  onSend: () => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="fixed right-4 bottom-4 z-40 w-full max-w-md">
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/90 backdrop-blur shadow-2xl">
        <div className="px-3 py-2 border-b border-white/10 text-sm font-semibold">Lobby chat</div>
        <div ref={scrollerRef} className="max-h-64 overflow-y-auto px-3 py-2 space-y-2">
          {messages.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <img src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=0B0B0E&color=FFFFFF`} alt="" className="h-6 w-6 rounded-full object-cover mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs text-white/60">{m.name} <span className="opacity-50">• {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="text-sm break-words">{m.text}</div>
              </div>
            </div>
          ))}
          {messages.length === 0 && <div className="text-white/50 text-sm">Say hi 👋</div>}
        </div>
        <div className="p-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
              placeholder="Type a message…"
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
            />
            <button onClick={onSend} className="px-3 py-2 rounded-lg bg-[#29e0e3] hover:bg-[#22c8cb] font-medium">Send</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------- Small UI bits ---------------------------- */

function Menu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
      >
        Menu ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white z-10">
          <div onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerMenu({ onKick }: { onKick: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 rounded-md border border-white/20 hover:border-white/40 text-xs"
        aria-label="Player actions"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white z-10">
          <button
            onClick={() => { setOpen(false); onKick() }}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg:white/10 text-red-300"
          >
            Kick
          </button>
        </div>
      )}
    </div>
  )
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

