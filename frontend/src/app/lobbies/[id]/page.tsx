'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { deleteGame, endGame, fetchGame, joinGame, leaveGame, Game } from '@/lib/games'

type ProfileLite = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
type Player = { user_id: string; role: 'host' | 'player' | string; user?: ProfileLite | null }

export default function LobbyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const ownerMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ownerMenuRef.current) return
      if (!ownerMenuRef.current.contains(e.target as Node)) setOwnerMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/lobbies/${id}`)}`)
        return
      }
      setMe(user.id)
      setAuthChecked(true)
      try {
        setLoading(true)
        await loadAll()
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load game')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadAll() {
    const g = await fetchGame(id)
    setGame(g)
    await loadPlayers()
  }
  async function loadPlayers() {
    const { data: memberships, error } = await supabase
      .from('game_players')
      .select('user_id, role')
      .eq('game_id', id)
      .order('created_at', { ascending: true })
    if (error) throw error

    const ids = Array.from(new Set((memberships ?? []).map((m: any) => m.user_id).filter(Boolean)))
    let index: Record<string, ProfileLite> = {}
    if (ids.length) {
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ids)
      if (pErr) throw pErr
      index = Object.fromEntries((profs ?? []).map(p => [p.id, p as ProfileLite]))
    }
    const merged: Player[] = (memberships ?? []).map((m: any) => ({
      user_id: m.user_id, role: m.role, user: index[m.user_id] ?? null,
    }))
    setPlayers(merged)
  }

  const playersCount = players.length
  const remain = Math.max(0, (game?.seats ?? 0) - playersCount)
  const full = remain <= 0 || game?.status !== 'open'
  const isOwner = useMemo(() => Boolean(game && me && game.host_id === me), [game, me])

  async function doJoin() { if (!game) return; try { setWorking(true); await joinGame(game.id); await loadAll() } catch (e: any) { alert(e?.message || 'Join failed') } finally { setWorking(false) } }
  async function doLeave() { if (!game) return; try { setWorking(true); await leaveGame(game.id); await loadAll() } catch (e: any) { alert(e?.message || 'Leave failed') } finally { setWorking(false) } }
  async function doDelete() { if (!game) return; const ok = confirm('Delete this game?'); if (!ok) return; try { setWorking(true); await deleteGame(game.id); router.push('/lobbies') } catch (e: any) { alert(e?.message || 'Delete failed') } finally { setWorking(false) } }
  async function doEnd() { if (!game) return; const ok = confirm('Mark this game as completed?'); if (!ok) return; try { setWorking(true); await endGame(game.id); setGame({ ...game, status: 'completed' }) } catch (e: any) { alert(e?.message || 'End failed') } finally { setWorking(false) } }

  if (!authChecked) return <Shell><div className="text-white/70">Checking sign-in…</div></Shell>
  if (loading) return <Shell><TopBanner /><div className="rounded-3xl border border-white/10 bg-white/5 h-56 animate-pulse" /></Shell>
  if (!game) return <Shell><TopBanner /><div className="text-white/80">Game not found.</div></Shell>

  const lengthText = game.length_min
    ? (game.length_min >= 60 ? `${(game.length_min / 60).toFixed(game.length_min % 60 ? 1 : 0)} h` : `${game.length_min} min`)
    : '—'
  const description: string = ((game as any)?.description ?? (game as any)?.desc ?? '') as string

  return (
    <Shell>
      <TopBanner />

      <div className="overflow-hidden rounded-3xl border border-zinc-800">
        <div className="relative">
          <img src={game.poster_url || '/game-poster-fallback.jpg'} alt={game.title} className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Owner dropdown incl. Edit */}
          {isOwner && (
            <div className="absolute top-3 right-3" ref={ownerMenuRef}>
              <button
                onClick={() => setOwnerMenuOpen(v => !v)}
                className="rounded-lg bg-black/55 hover:bg-black/70 text-white px-3 py-1.5 text-sm border border-white/20"
              >
                Actions ▾
              </button>
              {ownerMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white z-10">
                  <a
                    href={`/lobbies/${game.id}/edit`}
                    className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10"
                    onClick={() => setOwnerMenuOpen(false)}
                  >
                    Edit details
                  </a>
                  <button disabled={working} onClick={() => { setOwnerMenuOpen(false); void doEnd() }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10">
                    {game.status === 'completed' ? 'Reopen (coming soon)' : 'End game'}
                  </button>
                  <button disabled={working} onClick={() => { setOwnerMenuOpen(false); void doDelete() }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 text-red-300">
                    Delete game
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">{game.title}</h1>
              <div className="text-white/80">{game.system || 'TTRPG'} {game.vibe ? `• ${game.vibe}` : ''}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-lg border ${full ? 'border-white/20 text-white/70' : 'border-brand text-brand'}`}>
              {full ? 'Full' : `${remain} seats`}
            </span>
          </div>
        </div>

        <div className="p-6 md:p-8 bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
          <div className="grid sm:grid-cols-2 gap-4">
            <Info label="Status" value={titleCase(game.status)} />
            <Info label="Length" value={lengthText} />
            <Info label="New players" value={game.welcomes_new ? 'Yes' : 'No'} />
            <Info label="18+" value={game.is_mature ? 'Yes' : 'No'} />
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-2 text-white/80 whitespace-pre-wrap">
              {description ? description : 'No description provided yet.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-6">
            {!isOwner && (
              <>
                <button disabled={working || full} onClick={doJoin} className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60">
                  {working ? 'Working…' : 'Join game'}
                </button>
                <button disabled={working} onClick={doLeave} className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">
                  Leave
                </button>
              </>
            )}
          </div>

          {/* Players */}
          <PlayersBlock players={players} hostId={game.host_id} />

          {errorMsg && <div className="text-sm text-red-400 mt-6">{errorMsg}</div>}
        </div>
      </div>
    </Shell>
  )
}

function PlayersBlock({ players, hostId }: { players: Player[]; hostId: string }) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Players</h2>
        <div className="text-sm text-white/60">{players.length} joined</div>
      </div>
      {players.length === 0 ? (
        <div className="text-white/70 text-sm mt-3">No one has joined yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {players.map((p) => (
            <PlayerCard key={p.user_id} p={p} isHost={p.user_id === hostId} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerCard({ p, isHost }: { p: Player; isHost: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current) return; if (!ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const name = p.user?.display_name || p.user?.username || 'Player'
  const avatar = p.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B0B0E&color=FFFFFF`
  return (
    <div className="relative rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-3">
        <img src={avatar} alt={name} className="h-12 w-12 rounded-xl object-cover ring-2 ring-white/10" />
        <div className="min-w-0">
          <div className="font-semibold truncate">{name}</div>
          <div className="text-sm text-white/70">{isHost ? 'DM' : 'Player'}</div>
        </div>
      </div>
      <div className="absolute top-3 right-3" ref={ref}>
        <button onClick={() => setOpen(v => !v)} className="rounded-md bg-black/50 hover:bg-black/70 text-white px-2 py-1 text-xs border border-white/20">⋯</button>
        {open && (
          <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white">
            <button className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10" onClick={() => alert('Messaging coming soon')}>Send message</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* UI helpers */
function titleCase(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}
function Shell({ children }: { children: React.ReactNode }) { return <div className="max-w-5xl mx-auto px-4 py-8 text-white">{children}</div> }
function TopBanner() {
  return (
    <div className="mb-4 flex items-center justify-between">
      <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
        <LogoIcon /><span className="font-semibold">ttrplobby</span>
      </a>
      <a href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
        <span className="font-semibold">Profile</span>
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
