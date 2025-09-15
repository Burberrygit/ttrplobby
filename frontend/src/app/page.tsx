// File: frontend/src/app/page.tsx (Landing)
'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ============================
// Safe client-side env handling
// ============================
function resolveApiBase(): string {
  try {
    if (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_API_URL) {
      return (process as any).env.NEXT_PUBLIC_API_URL as string
    }
  } catch {}
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="ttrplobby-api"]') as HTMLMetaElement | null
    if (meta?.content) return meta.content
  }
  return ''
}

function resolveWsUrl(httpBase: string): string {
  if (!httpBase) return ''
  return httpBase.startsWith('https') ? httpBase.replace(/^https/, 'wss') : httpBase.replace(/^http/, 'ws')
}

const API = resolveApiBase()
const WS = resolveWsUrl(API)

// ----------------------------
// Types
// ----------------------------
export type Lobby = {
  id: number
  system: string
  tier: string
  length_min: number
  vibe: string
  seats: number
  status: string
}

// Demo lobbies shown if no API is configured
const DEMO_LOBBIES: Lobby[] = [
  { id: 101, system: 'D&D 5e (2014)', tier: '1-4', length_min: 120, vibe: 'Casual one-shot', seats: 5, status: 'open' },
  { id: 102, system: 'Pathfinder 2e', tier: '1-3', length_min: 90, vibe: 'Beginner friendly', seats: 5, status: 'open' },
  { id: 103, system: 'Dungeon World', tier: '—', length_min: 60, vibe: 'Rules-light story', seats: 4, status: 'open' },
]

export default function HomePage() {
  const [lobbies, setLobbies] = useState<Lobby[]>(API ? [] : DEMO_LOBBIES)
  const [online, setOnline] = useState<boolean>(Boolean(API))
  const [authed, setAuthed] = useState<boolean>(false)

  // --- Roll20 "Join Game"-style search filter state ---
  const [games, setGames] = useState('') // single-select (matches "Sort By" style)
  const [groups, setGroups] = useState('') // single-select (matches "Sort By" style)
  const [keywords, setKeywords] = useState('')
  const [sortBy, setSortBy] = useState<'Relevance'>('Relevance')
  const [newPlayers, setNewPlayers] = useState(false)
  const [mature, setMature] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)

  // --- auth status watcher (for search gating) ---
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session?.user))
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let live: WebSocket | null = null
    let mounted = true

    if (!API) {
      // Demo mode: no network requests
      setOnline(false)
      return () => {}
    }

    // Initial fetch of open lobbies
    fetch(`${API}/lobbies`)
      .then(r => r.json())
      .then((data) => {
        if (!mounted) return
        setLobbies(Array.isArray(data) ? data : [])
        setOnline(true)
      })
      .catch(() => {
        if (!mounted) return
        setOnline(false)
      })

    // Live updates for "Now Playing"
    try {
      const wsUrl = `${WS}/ws/now-playing`
      live = wsUrl ? new WebSocket(wsUrl) : null
      if (live) {
        live.onopen = () => setOnline(true)
        live.onclose = () => setOnline(false)
        live.onerror = () => setOnline(false)
        live.onmessage = async () => {
          try {
            const res = await fetch(`${API}/lobbies`).then(r => r.json())
            if (mounted && Array.isArray(res)) setLobbies(res)
          } catch {/* ignore */}
        }
      }
    } catch {/* ignore */}

    return () => { mounted = false; if (live) live.close() }
  }, [])

  // For the "Live Now" preview, we use keywords-only filtering
  const filtered = useMemo(() => {
    if (!keywords) return lobbies
    const s = keywords.toLowerCase()
    return lobbies.filter((l) => (
      `${l.system} ${l.tier} ${l.vibe}`.toLowerCase().includes(s)
    ))
  }, [keywords, lobbies])

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (keywords) params.set('q', keywords)
    if (games && games !== 'Any') params.set('games', games)
    if (groups && groups !== 'Any') params.set('groups', groups)
    if (sortBy) params.set('sort', sortBy)
    if (newPlayers) params.set('new_players', 'true')
    if (mature) params.set('mature', 'true')
    if (freeOnly) params.set('free', 'true')

    const url = params.toString() ? `/schedule?${params.toString()}` : '/schedule'

    // Remember the search and gate behind login if needed
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastSearchParams', params.toString())
      sessionStorage.setItem('nextAfterLogin', url)
    }

    if (authed) {
      if (typeof window !== 'undefined') window.location.href = url
    } else {
      if (typeof window !== 'undefined') window.location.href = `/login?next=${encodeURIComponent(url)}`
    }
  }

  // Options for the single-select dropdowns
  const gameOptions = ['Any','D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder','Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG','Delta Green','Blades in the Dark','Powered by the Apocalypse','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other']
  const groupOptions = ['Any','Beginner Friendly','West Marches','Organized Play','Homebrew','One-Shots','Campaigns']

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* High z-index header to prevent overlap issues */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between relative z-50">
          <a href="/" className="flex items-center gap-2">
            {/* Replaced/augmented icon with your logo image */}
            <img src="/logo.png" alt="ttrplobby logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-lg tracking-tight">ttrplobby</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
            <a href="/lobbies" className="hover:text-white">Now Playing</a>
            <a href="/schedule" className="hover:text-white">Scheduled Games</a>
            <a href="/about" className="hover:text-white">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/signup" className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm">Sign up</a>
            <a href="/login" className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm">Log in</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-0">
        <div className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            {/* Added logo next to the main headline */}
            <div className="flex items-start gap-3">
              <img src="/logo.png" alt="ttrplobby logo" className="h-10 w-10 lg:h-12 lg:w-12 rounded mt-1" />
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
                Find a table <span className="text-emerald-400">now</span> or schedule for later.
              </h1>
            </div>

            <p className="mt-4 text-zinc-300 max-w-prose">
              ttrplobby lets you jump into a TTRPG in minutes or plan your next campaign. Create an account with email, Google, or Discord, build your profile, and join a lobby instantly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/lobbies/new" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium">Create Lobby (start within an hour)</a>
              <a href="/schedule/new" className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium">Create Scheduled Game</a>
            </div>
            <p className="mt-3 text-xs text-zinc-400">Supports systems across the TTRPG spectrum—aiming for Roll20-level breadth.</p>
          </div>

          {/* Search card kept at a lower layer than header */}
          <div className="relative z-10 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-800 rounded-2xl p-4 lg:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Find Games to Join</h2>
              <a href="/schedule" className="text-sm text-emerald-300 hover:text-emerald-200">Advanced Search Options »</a>
            </div>

            {/* Roll20 "Join Game" search panel */}
            <form onSubmit={submitSearch} className="grid gap-3">
              {/* Playing Any of These Games (single-select like Sort By) */}
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Playing Any of These Games</div>
                <select value={games} onChange={(e)=>setGames(e.target.value)} className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700">
                  {gameOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              {/* Sort By */}
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Sort By:</div>
                <select value={sortBy} onChange={(e)=>setSortBy(e.target.value as 'Relevance')} className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700">
                  <option>Relevance</option>
                </select>
              </label>

              {/* Matching Keywords */}
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Matching Keywords:</div>
                <input
                  value={keywords}
                  onChange={(e)=>setKeywords(e.target.value)}
                  placeholder="e.g. evil, late night"
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
                />
              </label>

              {/* Toggles (removed Roll20Con2025 per request) */}
              <div className="grid sm:grid-cols-2 gap-2">
                <Toggle label="Only find games that welcome new players" checked={newPlayers} onChange={setNewPlayers} />
                <Toggle label="Show games with Mature Content(18+)" checked={mature} onChange={setMature} />
                <Toggle label="Only find games that are Free to Play" checked={freeOnly} onChange={setFreeOnly} />
              </div>

              {/* Gaming Groups (single-select like Sort By) */}
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Gaming Groups</div>
                <select value={groups} onChange={(e)=>setGroups(e.target.value)} className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700">
                  {groupOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                  <span>{online ? 'Live API connected' : 'Demo mode (no API detected)'}</span>
                </div>
                <button type="submit" className="px-3 py-1.5 rounded-md bg-zinc-200 text-zinc-900 font-medium">Search</button>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-sm uppercase tracking-wide text-zinc-400 mt-1">Live Now</h3>
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {filtered.slice(0, 6).map((l) => (
                  <LobbyCard key={l.id} lobby={l} />
                ))}
                {filtered.length === 0 && (
                  <div className="text-sm text-zinc-400">No live lobbies yet. Be the first to <a className="text-emerald-400" href="/lobbies/new">create one</a>.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
          <Feature title="Instant Lobbies" desc="Join a table in minutes with real-time seating and chat."/>
          <Feature title="Scheduled Games" desc="Post time slots, auto-accept compatible players, send calendar invites."/>
          <Feature title="Profiles & Progress" desc="Avatar, username, games played — your reputation travels with you."/>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-14 text-center">
          <h2 className="text-2xl font-bold">Ready to roll?</h2>
          <p className="text-zinc-300 mt-2">Create an account and jump into a lobby, or schedule your next session.</p>
          <div className="mt-5 flex justify-center gap-3">
            <a href="/signup" className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium">Get Started</a>
            <a href="/lobbies" className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium">Browse Lobbies</a>
          </div>
        </div>
      </section>

      {/* Footer kept above background content */}
      <footer className="border-t border-zinc-900 relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-400 flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} ttrplobby</div>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/contact" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
      <div className="text-emerald-400 font-semibold">{title}</div>
      <p className="text-zinc-300 text-sm mt-1">{desc}</p>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean)=>void }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="accent-emerald-600" />
      <span className="text-zinc-300">{label}</span>
    </label>
  )
}

function LobbyCard({ lobby }: { lobby: Lobby }) {
  return (
    <a href={`/lobbies/${lobby.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 hover:border-emerald-600 transition">
      <div className="text-xs text-zinc-400">{lobby.system} • {lobby.tier} • {lobby.length_min}m</div>
      <div className="mt-1 text-sm font-medium">{lobby.vibe}</div>
      <div className="text-xs text-zinc-400 mt-1">Seats: {lobby.seats} • {lobby.status}</div>
    </a>
  )
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

// ----------------------------
// Lightweight runtime tests
// ----------------------------
;(function selfTests(){
  try {
    console.assert(resolveWsUrl('http://api.local') === 'ws://api.local', 'ws from http')
    console.assert(resolveWsUrl('https://api.local') === 'wss://api.local', 'wss from https')
    console.assert(typeof resolveApiBase() === 'string', 'resolveApiBase returns string')
    console.assert(typeof Logo === 'function', 'Logo is a function')
  } catch {/* no-op */}
})();
