// File: frontend/src/app/live/[id]/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function LiveRoomPage() {
  const router = useRouter()
  const params = useSearchParams()
  const roomId = useMemo(() => {
    // path pattern /live/[id] — Next provides the segment as param via URL; since we’re client-only, parse from location
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/')
      return parts[parts.length - 1]
    }
    return ''
  }, [])

  const isHost = params.get('host') === '1'

  const [me, setMe] = useState<{ id: string, name: string, avatar: string | null }>({ id: '', name: 'Player', avatar: null })
  const [room, setRoom] = useState<RoomDetails | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Presence & chat
  const [peers, setPeers] = useState<Array<{ id: string; name: string; avatar: string | null }>>([])
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    ;(async () => {
      // Auth + profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        return
      }
      // Pull profile fields if present
      const { data: prof } = await supabase.from('profiles').select('display_name, username, avatar_url').eq('id', user.id).maybeSingle()
      const name = prof?.display_name || prof?.username || 'Player'
      setMe({ id: user.id, name, avatar: prof?.avatar_url ?? null })

      // Load room (if discoverable)
      const { data: roomRow, error } = await supabase.from('live_rooms').select('*').eq('id', roomId).maybeSingle()
      if (!error && roomRow) setRoom(roomRow as RoomDetails)

      // Join realtime channel
      const ch = supabase.channel(`live:room:${roomId}`, {
        config: { presence: { key: user.id } }
      })
      channelRef.current = ch

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState()
        // state is { [key: userId]: [{ ...presence }]}
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

      await ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ name, avatar: prof?.avatar_url ?? null })
          // announce join
          const hello: ChatMsg = {
            id: crypto.randomUUID(),
            userId: 'system',
            name: 'System',
            avatar: null,
            text: `${name} joined the lobby`,
            ts: Date.now()
          }
          ch.send({ type: 'broadcast', event: 'chat', payload: hello })
        }
      })
    })()

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  async function send() {
    const t = text.trim()
    if (!t || !channelRef.current) return
    const msg: ChatMsg = {
      id: crypto.randomUUID(),
      userId: me.id,
      name: me.name,
      avatar: me.avatar,
      text: t,
      ts: Date.now()
    }
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg })
    setText('')
  }

  async function endLobby() {
    if (!roomId) return
    const ok = confirm('End this lobby for everyone?')
    if (!ok) return
    try {
      await supabase.from('live_rooms').update({ status: 'closed' }).eq('id', roomId)
    } catch { /* ignore */ }
    router.push('/profile')
  }

  const remainSeats = useMemo(() => {
    // Presence size approximates active players; host counts as 1 participant
    const cap = room?.seats ?? 0
    const used = peers.length
    return Math.max(0, cap - used)
  }, [room?.seats, peers.length])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-white/30">
            <LogoIcon /><span className="font-semibold">ttrplobby</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/profile" className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">Back to profile</a>
            {isHost && (
              <Menu>
                <a href="#" onClick={(e) => { e.preventDefault(); endLobby() }} className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10 text-red-300">End game</a>
                <a href={`/live/${roomId}`} className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10">Copy lobby link</a>
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
          <div className="p-3 text-sm text-white/70 border-t border-white/10">
            {room?.discord_url && (
              <a href={room.discord_url} target="_blank" rel="noreferrer" className="inline-block mr-2 underline hover:opacity-90">Discord</a>
            )}
            {room?.game_url && (
              <a href={room.game_url} target="_blank" rel="noreferrer" className="inline-block underline hover:opacity-90">Game link</a>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          <h1 className="text-2xl font-bold">{room?.title || 'Untitled live game'}</h1>
          <div className="text-white/70 mt-1">
            {room?.system || 'TTRPG'} {room?.vibe ? `• ${room.vibe}` : ''} {room?.length_min ? `• ${(room.length_min/60).toFixed(room.length_min % 60 ? 1:0)}h` : ''}
          </div>
          <div className="text-white/60 text-sm mt-2">
            Seats: {room?.seats ?? '—'} • In lobby: {peers.length} • Open seats: {remainSeats}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {isHost ? (
              <span className="px-3 py-1.5 rounded-lg border border-[#29e0e3] text-[#29e0e3] text-sm">Host controls enabled</span>
            ) : (
              <span className="px-3 py-1.5 rounded-lg border border-white/20 text-sm">You’re connected</span>
            )}
          </div>
        </div>
      </section>

      {/* Participants & Chat */}
      <section className="max-w-6xl mx-auto px-4 pb-16 grid md:grid-cols-[260px,1fr] gap-5">
        {/* Participants list (bottom-left feel on wide screens) */}
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
          </div>
        </div>

        {/* Main area could hold later: ready checks / notes / etc. For now, just some tips */}
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
                <div className="text-sm">{m.text}</div>
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
