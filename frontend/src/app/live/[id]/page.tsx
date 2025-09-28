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

      // Load the room fresh
      const { data: roomRow, error } = await supabase
        .from('live_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()

      if (unmountedRef.current) return

      if (error) {
        setErrorMsg(error.message)
      } else if (roomRow) {
        setRoom(roomRow as RoomDetails)
      }

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
      if (unmountedRef.current) return
      const tries = retryRef.current + 1
      retryRef.current = tries
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(tries - 1, 5))) // 1s,2s,4s,8s,16s,32s
      setRtInfo(`Retrying in ${Math.round(delay/1000)}s…`)
      setTimeout(() => {
        if (unmountedRef.current) return
        connectRealtime(self)
      }, delay)
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
  }, [roomId, router])

  // Presence heartbeat → populate /live_presence map (best-effort)
  useEffect(() => {
    if (!me.id || !isUuid(roomId)) return
    let mounted = true
    let timer: any

    async function pingOnce() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted || !isUuid(roomId)) return
        navigator.geolocation.getCurrentPosition(async (pos) => {
          if (!mounted) return
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          await supabase.from('live_presence').upsert(
            {
              user_id: user.id,
              room_id: roomId,
              lat, lon,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,room_id' }
          )
        }, () => {
          // silently ignore if permission denied
        }, { maximumAge: 60_000, timeout: 10_000 })
      } catch { /* ignore */ }
    }

    void pingOnce()
    timer = setInterval(pingOnce, 30_000)
    return () => { mounted = false; clearInterval(timer) }
  }, [me.id, roomId])

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

  // Best-effort automatic cleanup when the HOST leaves the page/tab
  useEffect(() => {
    if (!isHost || !isUuid(roomId)) return

    const handler = () => {
      // fire-and-forget; cron backstops if the browser cuts the request
      void supabase.rpc('end_live_room', { p_room_id: roomId })
    }

    window.addEventListener('beforeunload', handler)
    const vis = () => { if (document.hidden) handler() }
    document.addEventListener('visibilitychange', vis)

    // Also try on unmount (route change in SPA)
    return () => {
      window.removeEventListener('beforeunload', handler)
      document.removeEventListener('visibilitychange', vis)
      handler()
    }
  }, [isHost, roomId])

  function copyLobbyLink() {
    try {
      const url = `${location.origin}/live/${roomId}`
      navigator.clipboard.writeText(url)
      alert('Lobby link copied to clipboard')
    } catch { /* ignore */ }
  }

  const remainSeats = useMemo(() => {
    const cap = room?.seats ?? 0
    const used = peers.length
    return Math.max(0, cap - used)
  }, [room?.seats, peers.length])

  const discordHref = normalizeExternalUrl(room?.discord_url)
  const gameHref = normalizeExternalUrl(room?.game_url)

  if (!isUuid(roomId)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="text-white/60 text-sm">Setting up lobby…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <a href="/profile" className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">Back to profile</a>
            {isHost && (
              <Menu>
                <button onClick={copyLobbyLink} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10">Copy lobby link</button>
                <button onClick={(e) => { e.preventDefault(); endLobby() }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 text-red-300">End game</button>
              </Menu>
            )}
          </div>
        </div>
      </header>

      {/* Hero / Poster + quick links */}
      <section className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-[360px,1fr] gap-5">
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-zinc-900/60">
          <img
            src={room?.poster_url || '/game-poster-fallback.jpg'}
            alt={room?.title || 'Live game'}
            className="w-full h-56 object-cover"
          />
          <div className="p-3 text-sm text-white/70 border-t border-white/10 flex items-center gap-3 flex-wrap">
            {discordHref ? (
              <a href={discordHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">
                <span>Discord</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 cursor-not-allowed">Discord: not set</span>
            )}
            {gameHref ? (
              <a href={gameHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">
                <span>Game link</span>
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 cursor-not-allowed">Game link: not set</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <h1 className="text-2xl font-bold">{room?.title || 'Untitled live game'}</h1>
          <div className="text-white/70 mt-1">
            {room?.system || 'TTRPG'}
            {room?.vibe ? ` • ${room.vibe}` : ''}
            {room?.length_min ? ` • ${(room.length_min/60).toFixed(room.length_min % 60 ? 1:0)}h` : ''}
          </div>
          <div className="text-white/60 text-sm mt-2">
            Seats: {room?.seats ?? '—'} • In lobby: {peers.length} • Open seats: {remainSeats}
          </div>
          {errorMsg && <div className="mt-3 text-sm text-red-400">{errorMsg}</div>}
        </div>
      </section>

      {/* Participants & Notes */}
      <section className="max-w-6xl mx-auto px-4 pb-16 grid md:grid-cols-[260px,1fr] gap-5">
        {/* Participants list */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="text-sm font-semibold">Players</div>
          <div className="mt-2 space-y-2">
            {peers.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=0B0B0E&color=FFFFFF`} alt="" className="h-7 w-7 rounded-full object-cover" />
                  <div className="truncate">{p.name}</div>
                </div>
                <div className="relative">
                  <PlayerMenu player={p} />
                </div>
              </div>
            ))}
            {peers.length === 0 && <div className="text-white/50 text-sm">No one here yet.</div>}
          </div>
        </div>

        {/* Main area placeholder */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 min-h-[200px]">
          <div className="text-sm text-white/70">
            Share your Discord or VTT link above. Use chat to coordinate start time and seating. When you’re ready, click the link to move everyone over.
          </div>
        </div>
      </section>

      {/* Floating chat (bottom-right) */}
      <ChatDock
        me={me}
        messages={chat}
        onSend={send}
        value={text}
        onChange={setText}
      />
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

function PlayerMenu({ player }: { player: { id: string, name: string, avatar: string | null } }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 rounded-md border border-white/20 hover:border-white/40 text-xs"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white z-10">
          <a href="#" className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10">Send message</a>
          <a href="#" className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10">View profile</a>
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
