'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile } from '@/lib/profile'

type Game = {
  id: number | string
  title: string | null
  system: string | null
  poster_url: string | null
  scheduled_at: string | null
  status: string | null
  host_id: string
  isOwner: boolean
}

export default function ProfileDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [timeZoneLabel, setTimeZoneLabel] = useState<string>('—')

  const [memberSince, setMemberSince] = useState<string>('—')
  const [hostedCount, setHostedCount] = useState<number>(0)
  const [joinedCount, setJoinedCount] = useState<number>(0)
  const [games, setGames] = useState<Game[]>([])
  const [gamesLoading, setGamesLoading] = useState(true)

  // NEW: notifications count
  const [noteCount, setNoteCount] = useState<number>(0)

  // Account menu
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Load profile + memberSince + games
  useEffect(() => {
    let mounted = true
    let timeout: ReturnType<typeof setTimeout> | null = null
    let unsub: { subscription: { unsubscribe(): void } } | null = null

    async function hydrateForUser(user: { id: string; created_at?: string }) {
      if (!mounted) return
      // memberSince from auth.users
      if (user.created_at) {
        const d = new Date(user.created_at)
        setMemberSince(d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))
      }

      // profile fields
      const p = await fetchMyProfile()
      if (!mounted) return
      if (p) {
        setDisplayName(p.display_name ?? '')
        setUsername(p.username ?? '')
        setBio(p.bio ?? '')
        setAvatarUrl(p.avatar_url ?? '')
        setTimeZoneLabel(p.time_zone ?? '—')
      }

      // NEW: unread notifications count
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)
        if (mounted) setNoteCount(count ?? 0)
      } catch {
        // ignore if table not present yet
      }

      // load games (hosted + joined)
      setGamesLoading(true)

      const created = await supabase
        .from('games')
        .select('id,title,system,poster_url,scheduled_at,status,host_id')
        .eq('host_id', user.id)
        .order('scheduled_at', { ascending: true })
        .limit(24)

      const joined = await supabase
        .from('game_players')
        .select('game:games(id,title,system,poster_url,scheduled_at,status,host_id)')
        .eq('user_id', user.id)
        .order('game(scheduled_at)', { ascending: true })
        .limit(24)

      if (!mounted) return
      if (created.error) { setErrorMsg(created.error.message); setLoading(false); setGamesLoading(false); return }
      if (joined.error)  { setErrorMsg(joined.error.message);  setLoading(false); setGamesLoading(false); return }

      const createdGames: Game[] = (created.data ?? []).map(g => ({
        ...g,
        isOwner: true,
      }))

      const joinedGames: Game[] = (joined.data ?? [])
        .map((row: any) => row.game)
        .filter(Boolean)
        .filter((g: any) => g.host_id !== user.id) // avoid dupes when you’re both host and member
        .map((g: any) => ({ ...g, isOwner: false }))

      const all = [...createdGames, ...joinedGames]
      setGames(all)
      setHostedCount(createdGames.length)
      setJoinedCount(joinedGames.length)

      setLoading(false)
      setGamesLoading(false)
    }

    ;(async () => {
      // 1) Try current session first
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session?.user) {
        await hydrateForUser(session.user)
        return
      }

      // 2) No session yet — wait briefly for auth to hydrate, then fall back to login
      timeout = setTimeout(() => {
        if (!mounted) return
        router.replace(`/login?next=${encodeURIComponent('/profile')}`)
      }, 2500)

      const { data } = supabase.auth.onAuthStateChange((_e, s) => {
        if (s?.user && mounted) {
          if (timeout) clearTimeout(timeout)
          hydrateForUser(s.user)
          data.subscription.unsubscribe()
        }
      })
      unsub = data
    })()

    return () => {
      mounted = false
      if (timeout) clearTimeout(timeout)
      if (unsub) unsub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imgSrc = (avatarUrl && avatarUrl.trim()) ? avatarUrl : '/logo.png'
  const isFallback = !(avatarUrl && avatarUrl.trim()) // NEW: detect fallback
  const avatarSizeClass = isFallback ? 'h-10 w-10 md:h-12 md:w-12' : 'h-20 w-20 md:h-24 md:w-24' // NEW: 50% size if fallback

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col text-white">
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8">
          <TopBanner noteCount={noteCount} />
          <SkeletonProfileCard />
        </main>
        <footer className="border-t border-white/10 px-6">
          <div className="max-w-6xl mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>© 2025 ttrplobby</div>
            <nav className="flex items-center gap-4">
              <a href="/terms" className="hover:text-white">Terms</a>
              <a href="/privacy" className="hover:text-white">Privacy</a>
              <a href="/contact" className="hover:text-white">Contact</a>
            </nav>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col text-white">
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8">
        {/* 1) Top banner → home + notifications */}
        <TopBanner noteCount={noteCount} />

        {/* Header / Profile Card */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800">
          {/* Decorative glows */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />

          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:gap-6">
              <div className="relative shrink-0">
                <img
                  src={imgSrc}
                  alt="Avatar"
                  className={`${avatarSizeClass} rounded-2xl object-cover ring-2 ring-white/10`}
                />
                {/* online dot */}
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 ring-2 ring-zinc-900" title="Online" />
              </div>

              <div className="mt-6 md:mt-0 flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
                  {displayName || 'Unnamed Adventurer'}
                </h1>
                {username && <div className="text-white/70 mt-0.5">@{username}</div>}
                {bio ? (
                  <p className="text-white/80 mt-3 max-w-3xl">{bio}</p>
                ) : (
                  <p className="text-white/60 mt-3">
                    You haven’t written a bio yet. Add one in{' '}
                    <a className="underline underline-offset-4" href="/profile/edit">Profile settings</a>.
                  </p>
                )}
              </div>

              {/* Account dropdown (Edit profile / Sign out) */}
              <div className="mt-4 md:mt-0 flex items-center gap-2 relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="px-3 py-2 rounded-xl border border-white/20 hover:border-white/40 text-white transition"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  Account ▾
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white z-10">
                    <a
                      href="/profile/edit"
                      className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10"
                      onClick={() => setMenuOpen(false)}
                    >
                      Edit profile
                    </a>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10"
                      onClick={async () => {
                        setMenuOpen(false)
                        await supabase.auth.signOut()
                        router.push('/')
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Time zone" value={timeZoneLabel} />
              <StatCard label="Games hosted" value={hostedCount.toString()} />
              <StatCard label="Reputation" value="—" />
              <StatCard label="Member since" value={memberSince} />
            </div>

            {errorMsg && <div className="mt-4 text-sm text-red-400">{errorMsg}</div>}
          </div>
        </div>

        {/* Primary actions */}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard href="/live/new" title="Start live game" desc="Spin up an instant lobby." icon={<PlayIcon />} />
          <ActionCard href="/live/quick-join" title="Join live game" desc="Jump into active tables." icon={<UsersIcon />} />
          <ActionCard href="/schedule" title="Search for games" desc="Find tables by system, vibe, time." icon={<SearchIcon />} />
          <ActionCard href="/schedule/new" title="Post a game" desc="Schedule a session for later." icon={<PlusCircleIcon />} />
        </div>

        {/* Your games */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your games</h2>
          </div>

        {gamesLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/5 h-52 animate-pulse" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="text-white/70 text-sm mt-3">
              You’re not in any games yet. <a className="underline underline-offset-4" href="/schedule">Find one now</a>.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {games.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  onLeave={async (id) => {
                    const ok = confirm('Leave this game?')
                    if (!ok) return
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) { router.push('/login'); return }
                    const { error } = await supabase.from('game_players').delete().eq('user_id', user.id).eq('game_id', id)
                    if (error) { alert(error.message); return }
                    setGames(prev => prev.filter(x => x.id !== id))
                    setJoinedCount(c => Math.max(0, c - 1))
                  }}
                  onDelete={async (id) => {
                    const ok = confirm('Delete this game? This cannot be undone.')
                    if (!ok) return
                    const { error } = await supabase.from('games').delete().eq('id', id)
                    if (error) { alert(error.message); return }
                    setGames(prev => prev.filter(x => x.id !== id))
                    setHostedCount(c => Math.max(0, c - 1))
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Pinned footer */}
      <footer className="border-t border-white/10 px-6">
        <div className="max-w-6xl mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2025 ttrplobby</div>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/contact" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

/* --------------------------------- UI bits -------------------------------- */

function TopBanner({ noteCount = 0 }: { noteCount?: number }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
      >
        <LogoIcon />
        <span className="font-semibold">ttrplobby</span>
      </a>

      <a
        href="/notifications"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
      >
        <BellIcon />
        <span className="font-semibold">Notifications</span>
        <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-brand/30 text-brand text-xs font-semibold">
          {noteCount}
        </span>
      </a>
    </div>
  )
}

function SkeletonProfileCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 rounded-2xl bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-6 w-64 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-40 bg-white/10 rounded mt-2 animate-pulse" />
            <div className="h-4 w-96 bg-white/10 rounded mt-4 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function ActionCard({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: JSX.Element }) {
  return (
    <a
      href={href}
      className="group block rounded-2xl border border-white/10 bg-zinc-900/60 p-4 hover:border-white/30 transition"
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        <div className="opacity-80 group-hover:opacity-100">{icon}</div>
      </div>
      <div className="text-sm text-white/70 mt-1">{desc}</div>
    </a>
  )
}

function GameCard({
  game,
  onLeave,
  onDelete,
}: {
  game: Game
  onLeave: (id: Game['id']) => Promise<void>
  onDelete: (id: Game['id']) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const when = game.scheduled_at
    ? new Date(game.scheduled_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const lobbyHref = `/lobbies/${game.id}`

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
      <div className="relative">
        {/* Make poster clickable to the lobby */}
        <a href={lobbyHref} className="block">
          <img
            src={game.poster_url || '/logo.png'}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png' }}
            alt={game.title || 'Game'}
            className="h-40 w-full object-cover"
          />
        </a>
        <div className="absolute top-2 right-2" ref={ref}>
          <button
            onClick={() => setOpen(v => !v)}
            className="rounded-lg bg-black/50 hover:bg-black/70 text-white px-2 py-1 text-xs border border-white/20"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            Settings ▾
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur shadow-xl p-1 text-white">
              {game.isOwner ? (
                <>
                  <a
                    href={`/lobbies/${game.id}/edit`}
                    className="block px-3 py-2 rounded-lg text-sm hover:bg-white/10"
                    onClick={() => setOpen(false)}
                  >
                    Edit details
                  </a>
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 text-red-300"
                    onClick={() => onDelete(game.id)}
                  >
                    Delete game
                  </button>
                </>
              ) : (
                <button
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10"
                  onClick={() => onLeave(game.id)}
                >
                  Leave game
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-3">
        {/* Make title clickable too */}
        <a href={lobbyHref} className="text-base font-semibold truncate hover:underline">
          {game.title || 'Untitled game'}
        </a>
        <div className="text-sm text-white/70 mt-0.5">
          {game.system || 'TTRPG'}{when ? ` • ${when}` : ''}{game.status ? ` • ${game.status}` : ''}
        </div>
        {game.isOwner && (
          <div className="mt-2 text-xs text-white/50">You are the host</div>
        )}
      </div>
    </div>
  )
}

/* --------------------------- Minimal inline icons --------------------------- */

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  )
}
function PlusCircleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 19c.3-2.1 1.9-3.7 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 17h5l-1.5-2V11a6.5 6.5 0 1 0-13 0v4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
