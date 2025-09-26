// File: frontend/src/app/lobbies/[id]/live/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getMyProfileLite, presenceChannel, messagesChannel, sendLobbyMessage, fetchLobbyMessages } from '@/lib/live'

type LiteUser = { id: string; name: string; avatar_url: string | null }
type Message = { id: string; user_id: string; body: string; created_at: string; user: LiteUser }

export default function LiveLobbyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [me, setMe] = useState<LiteUser | null>(null)
  const [game, setGame] = useState<any>(null)
  const [members, setMembers] = useState<LiteUser[]>([])
  const [chat, setChat] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // presence channels
  const presenceRef = useRef<ReturnType<typeof presenceChannel> | null>(null)
  const messagesRef = useRef<ReturnType<typeof messagesChannel> | null>(null)

  const isOwner = useMemo(() => !!(game && me && game.host_id === me.id), [game, me])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(`/login?next=${encodeURIComponent(`/lobbies/${id}/live`)}`); return }
      setAuthChecked(true)

      try {
        // fetch my lite profile
        const mine = await getMyProfileLite()
        setMe(mine)

        // fetch game details
        const { data: g, error: gErr } = await supabase
          .from('games')
          .select('id,host_id,title,system,vibe,poster_url,status,seats,discord_url,external_url,time_zone, created_at')
          .eq('id', id)
          .maybeSingle()
        if (gErr) throw gErr
        setGame(g)

        // seed chat
        const initial = await fetchLobbyMessages(id)
        setChat(initial)

        // subscribe presence
        const pch = presenceChannel(id)
        pch.on('presence', { event: 'join' }, syncPresence)
           .on('presence', { event: 'leave' }, syncPresence)
           .subscribe(async (status) => {
             if (status !== 'SUBSCRIBED') return
             await pch.track({ id: mine.id, name: mine.name, avatar_url: mine.avatar_url })
           })
        presenceRef.current = pch

        // subscribe messages
        const mch = messagesChannel(id)
        mch.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'lobby_messages',
          filter: `game_id=eq.${id}`
        }, async (payload: any) => {
          // hydrate with profile for display
          const row = payload.new
          const prof = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle()
          const msg: Message = {
            id: row.id,
            user_id: row.user_id,
            body: row.body,
            created_at: row.created_at,
            user: {
              id: row.user_id,
              name: prof.data?.display_name || prof.data?.username || 'Player',
              avatar_url: prof.data?.avatar_url || null
            }
          }
          setChat(prev => [...prev, msg])
        }).subscribe()

        messagesRef.current = mch
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to join lobby')
      }
    })()

    return () => {
      presenceRef.current?.unsubscribe()
      messagesRef.current?.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function syncPresence() {
    const state = presenceRef.current?.presenceState()
    if (!state) return
    // state looks like { presence: [{...}, {...}] } keyed by presence key — flatten it
    const list: LiteUser[] = []
    Object.values(state).forEach((arr: any) => {
      ;(arr as any[]).forEach((m: any) => {
        list.push({ id: m.id, name: m.name, avatar_url: m.avatar_url || null })
      })
    })
    // de-dup by id
    const uniq = Array.from(new Map(list.map(u => [u.id, u])).values())
    setMembers(uniq)
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      await sendLobbyMessage(id, body)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to send message')
    }
  }

  if (!authChecked) return <Shell><TopBanner /><div className="rounded-3xl border border-white/10 bg-white/5 h-48 animate-pulse" /></Shell>
  if (!game) {
    return (
      <Shell>
        <TopBanner />
        {errorMsg ? <div className="text-sm text-red-400">{errorMsg}</div> : <div className="text-white/70">Loading…</div>}
      </Shell>
    )
  }

  return (
    <Shell>
      <TopBanner />
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 relative">
        {/* Header / Poster */}
        <div className="relative">
          <img src={game.poster_url || '/game-poster-fallback.jpg'} alt={game.title} className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">{game.title}</h1>
              <div className="text-white/80">{game.system || 'TTRPG'} {game.vibe ? `• ${game.vibe}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/profile" className="px-3 py-1.5 rounded-lg border border-white/20 text-white/90 hover:border-white/40">Back to profile</a>
              <a href="/lobbies" className="px-3 py-1.5 rounded-lg border border-white/20 text-white/90 hover:border-white/40">Browse lobbies</a>
              {isOwner ? (
                <a href={`/lobbies/${game.id}/edit`} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/90">Edit</a>
              ) : (
                <a href={`/lobbies/${game.id}/join`} className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brandHover text-black font-medium">Join prefs</a>
              )}
            </div>
          </div>
        </div>

        {/* GM Links Bar */}
        {(game.discord_url || game.external_url) && (
          <div className="px-4 md:px-6 py-3 border-t border-white/10 bg-white/5 text-white flex flex-wrap items-center gap-3">
            {game.discord_url && (
              <a href={game.discord_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-[#5865F2] hover:opacity-90 text-white text-sm">Discord</a>
            )}
            {game.external_url && (
              <a href={game.external_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 text-sm">Game link</a>
            )}
            <div className="text-white/60 text-sm ml-auto">Live lobby • {members.length} in room</div>
          </div>
        )}

        {/* Main area (blank center like a staging bay) */}
        <div className="min-h-[48vh]"></div>

        {/* Participants dock (bottom-left) */}
        <div className="fixed left-4 bottom-4 z-40">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/85 backdrop-blur p-2 w-[280px]">
            <div className="text-xs uppercase tracking-wide text-white/60 px-2 pb-1">Players</div>
            <div className="max-h-[40vh] overflow-auto pr-1">
              {members.length === 0 ? (
                <div className="text-white/60 text-sm px-2 py-2">No one here yet.</div>
              ) : members.map((u) => (
                <div key={u.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5">
                  <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0B0B0E&color=FFFFFF`} alt={u.name} className="h-7 w-7 rounded-lg object-cover ring-1 ring-white/10" />
                  <div className="truncate">{u.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat dock (bottom-right) */}
        <div className="fixed right-4 bottom-4 z-40 max-w-[420px] w-[92vw] sm:w-[400px]">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/85 backdrop-blur flex flex-col h-[320px]">
            <div className="px-3 py-2 border-b border-white/10 text-white/80 text-sm">Lobby chat</div>
            <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
              {chat.length === 0 ? (
                <div className="text-white/60 text-sm">Say hi to everyone!</div>
              ) : chat.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <img src={m.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.user.name)}&background=0B0B0E&color=FFFFFF`} className="h-7 w-7 rounded-lg object-cover ring-1 ring-white/10" />
                  <div className="min-w-0">
                    <div className="text-xs text-white/60">
                      <span className="font-medium text-white/90">{m.user.name}</span>{' '}
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-sm text-white/90 break-words">{m.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={onSend} className="border-t border-white/10 p-2 flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-white/10 text-white"
              />
              <button className="px-3 py-2 rounded-lg bg-brand hover:bg-brandHover font-medium">Send</button>
            </form>
          </div>
        </div>

        {errorMsg && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm text-red-400">{errorMsg}</div>}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) { return <div className="max-w-6xl mx-auto px-4 py-8 text-white">{children}</div> }
function TopBanner() {
  return (
    <div className="mb-4">
      <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
        <LogoIcon /><span className="font-semibold">ttrplobby</span>
      </a>
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
