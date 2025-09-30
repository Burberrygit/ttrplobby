'use client'

import Image from 'next/image'
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

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

const TIPS = [
  'Share your Discord or VTT link so players can hop in quickly.',
  'Your lobby stays open while you browse; we send a background heartbeat.',
  'If you step away too long, consider posting availability and system details.',
  'Mark your game New-Player-Friendly to attract more players.',
  'Keep the seat count accurate so Open seats is correct.',
  'Need to restart? Use “End game” and create a fresh lobby.',
]

/* Normalize user-provided external links */
function normalizeExternalUrl(u?: string | null): string | null {
  if (!u) return null
  const s = u.trim()
  if (!s) return null
  if (/^[a-z]+:\/\//i.test(s)) return s
  if (s.startsWith('//')) return 'https:' + s
  return 'https://' + s.replace(/^\/*/, '')
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

  // Tip rotator
  const [tipIx, setTipIx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTipIx(i => (i + 1) % TIPS.length), 6000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!isUuid(roomId)) return
    unmountedRef.current = false

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
          .select('system,length_minutes,max_players,new_player_friendly,is_18_plus,status,discord_url,game_url,poster_url')
          .eq('id', roomId)
          .maybeSingle()
      ])

      if (unmountedRef.current) return
      if (roomErr && !roomRow) setErrorMsg(roomErr.message)
      if (gameErr && !gameRow) setErrorMsg(gameErr.message)

      if (roomRow || gameRow) {
        const merged: RoomDetails = {
          ...(roomRow as any),
          system: gameRow?.system ?? (roomRow as any)?.system ?? null,
          length_min: gameRow?.length_minutes ?? (roomRow as any)?.length_min ?? null,
          seats: gameRow?.max_players ?? (roomRow as any)?.seats ?? null,
          welcomes_new: (gameRow as any)?.new_player_friendly ?? (roomRow as any)?.welcomes_new ?? null,
          is_mature: gameRow?.is_18_plus ?? (roomRow as any)?.is_mature ?? null,
          status: gameRow?.status ?? (roomRow as any)?.status ?? null,
          discord_url: (gameRow as any)?.discord_url ?? (roomRow as any)?.discord_url ?? null,
          game_url: (gameRow as any)?.game_url ?? (roomRow as any)?.game_url ?? null,
          poster_url: (gameRow as any)?.poster_url ?? (roomRow as any)?.poster_url ?? null,
        }
        setRoom(merged)
      }

      connectRealtime({ userId: user.id, name: myName, avatar: prof?.avatar_url ?? null })
    })()

    function connectRealtime(self: { userId: string; name: string; avatar: string | null }) {
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
    }

    function scheduleReconnect(self: { userId: string; name: string; avatar: string | null }) {
      if (unmountedRef.current) return

      if (document.visibilityState !== 'visible') {
        setRtInfo('Paused (background)')
        const once = () => {
          if (!unmountedRef.current && document.visibilityState === 'visible') {
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
      setRtInfo(`Retrying in ${Math.round(delay / 1000)}s…`)
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
    }
  }, [roomId, router])

  // Heartbeat to keep session "present" even if backgrounded / phone locks
  useEffect(() => {
    if (!me.id || !isUuid(roomId)) return
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null
    let paused = false

    async function heartbeat() {
      try {
        if (!mounted) return
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return
        await fetch('/api/live/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ room_id: roomId }),
          keepalive: true,
        })
      } catch { /* ignore */ }
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
        void heartbeat()
      }
    }

    document.addEventListener('visibilitychange', onVis)
    void heartbeat()
    timer = setInterval(() => { if (!paused && mounted) void heartbeat() }, 20000)

    return () => {
      mounted = false
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [me.id, roomId])

  async function endLobby() {
    if (!isUuid(roomId)) return
    const ok = confirm('End this lobby for everyone?')
    if (!ok) return
    try {
      await supabase.rpc('end_live_room', { p_room_id: roomId })
    } catch {
      try {
        await supabase.from('live_rooms').delete().eq('id', roomId)
      } catch { /* ignore */ }
    }
    router.push('/profile')
  }

  // Chat
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
    setChat(prev => [...prev, msg].slice(-200))
    setText('')
    ch.send({ type: 'broadcast', event: 'chat', payload: msg })
  }

  function copyLobbyLink() {
    try {
      const url = `${location.origin}/live/${roomId}`
      navigator.clipboard.writeText(url)
      alert('Lobby link copied to clipboard')
    } catch {}
  }

  // Seats info
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

  if (!isUuid(roomId)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="text-white/60 text-sm">Setting up lobby…</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col text-white bg-zinc-950">
      {/* Minimal top chrome, like /live/search */}
      <a
        href="/"
        className="absolute left-1/4 top-6 -translate-x-1/2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
      >
        ttrplobby
      </a>
      <div className="absolute left-3/4 top-6 -translate-x-1/2 flex items-center gap-2">
        <a
          href="/profile"
          className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
        >
          Profile
        </a>
        {isHost && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyLobbyLink}
              className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
            >
              Copy link
            </button>
            <button
              onClick={(e) => { e.preventDefault(); endLobby() }}
              className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur text-red-300"
            >
              End game
            </button>
          </div>
        )}
      </div>

      {/* Main content — centered logo/status block */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative w-28 h-28">
            <Image
              src="/logo.png"
              alt="TTRPLobby"
              fill
              className="animate-spin-slow object-contain"
              priority
            />
          </div>

          <h1 className="text-xl font-semibold">
            Searching for players…
          </h1>

          {/* Live lobby stats */}
          <p className="text-sm text-white/80 max-w-prose">
            {room?.system || 'TTRPG'}
            {room?.length_min ? ` • ${(room.length_min/60).toFixed(room.length_min % 60 ? 1 : 0)}h` : ''}
            {seatCap != null ? ` • Seats: ${seatCap}` : ''}
            {` • In lobby: ${peers.length}`}
            {openSeats != null ? ` • Open seats: ${openSeats}` : ''}
            {room?.vibe ? ` • ${room.vibe}` : ''}
          </p>

          {/* Realtime connection line */}
          <p className="text-xs text-white/60">
            {rtStatus === 'connected'
              ? 'Connected to lobby presence.'
              : rtStatus === 'connecting'
              ? 'Connecting…'
              : rtStatus === 'error'
              ? `Connection issue. ${rtInfo ?? ''}`
              : 'Connection closed.'}
          </p>

          {/* Tip */}
          <div className="mt-2 w-full max-w-md rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-white/50">Tip</div>
            <div key={tipIx} className="mt-1 text-sm transition-opacity duration-500 ease-in-out">
              {TIPS[tipIx]}
            </div>
          </div>

          {/* Quick external links (if provided) */}
          <div className="mt-3 flex items-center gap-3">
            {discordHref ? (
              <a
                href={discordHref}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
              >
                Discord
              </a>
            ) : null}
            {gameHref ? (
              <a
                href={gameHref}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
              >
                Game link
              </a>
            ) : null}
          </div>

          {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}
        </div>
      </main>

      {/* Pinned footer like /live/search */}
      <footer className="border-t border-white/10 px-4">
        <div className="max-w-4xl mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2025 ttrplobby</div>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/contact" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </footer>

      {/* Floating chat (kept) */}
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
