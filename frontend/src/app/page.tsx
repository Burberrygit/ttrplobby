// File: frontend/src/app/page.tsx (Landing)
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Game = {
  id: string
  title: string | null
  system: string | null
  poster_url: string | null
  length_min: number | null
  vibe: string | null
  seats: number | null
  status: string | null
  updated_at: string
  players_count?: number
  time_zone?: string | null // optional; filter skips if DB doesn't have it
}

const SYSTEMS = [
  'Any',
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
] as const

// Curated time zones (match schedule page)
const COMMON_TZS = [
  'UTC',
  'America/Toronto','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Sao_Paulo','America/Mexico_City','America/Bogota',
  'Europe/London','Europe/Dublin','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome',
  'Africa/Johannesburg',
  'Asia/Jerusalem','Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Bangkok',
  'Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo','Asia/Seoul','Asia/Shanghai',
  'Australia/Sydney','Pacific/Auckland','Pacific/Honolulu',
] as const

function getBrowserTz(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return z || 'UTC'
  } catch { return 'UTC' }
}

export default function HomePage() {
  // Quick-search filters (aligned with /schedule)
  const [keywords, setKeywords] = useState('')
  const [system, setSystem] = useState<string>('Any')
  const [sortBy, setSortBy] = useState<'Relevance' | 'Soonest' | 'Newest' | 'Popular'>('Relevance')
  const [onlySeats, setOnlySeats] = useState(false)
  const [welcomesNew, setWelcomesNew] = useState(false)
  const [mature, setMature] = useState(false)
  const [tz, setTz] = useState<string>('Any')
  const MY_TZ = useMemo(() => getBrowserTz(), [])

  // Live Now data (real games)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setErr(null)
        setLoading(true)
        // Fetch most recent open games with counts
        const { data, error } = await supabase
          .from('games')
          // IMPORTANT: don't select time_zone if your DB doesn't have it
          .select('id,title,system,poster_url,length_min,vibe,seats,status,updated_at, game_players(count)')
          .eq('status', 'open')
          .order('updated_at', { ascending: false })
          .limit(12)
        if (error) throw error

        const mapped: Game[] = (data as any[]).map((g) => ({
          ...g,
          players_count:
            Array.isArray(g.game_players) && g.game_players.length
              ? Number(g.game_players[0].count)
              : 0,
        }))

        if (mounted) setGames(mapped)
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Failed to load games')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const s = keywords.trim().toLowerCase()
    return games.filter((g: Game | (Game & Record<string, any>)) => {
      if (system !== 'Any' && (g.system || '') !== system) return false
      if (onlySeats) {
        const remain = (g.seats ?? 0) - (g.players_count ?? 0)
        if (!(g.status === 'open' && remain > 0)) return false
      }
      if (welcomesNew && !(g as any).welcomes_new) return false
      if (mature && !(g as any).is_mature) return false
      // Time zone filter only applies if the record actually has a time_zone field
      if (tz !== 'Any' && tz !== 'local') {
        if ('time_zone' in g && typeof (g as any).time_zone === 'string') {
          if (((g as any).time_zone || '').toLowerCase() !== tz.toLowerCase()) return false
        }
        // If no time_zone on the row, do not exclude it
      }
      if (!s) return true
      const hay = `${g.title || ''} ${g.system || ''} ${g.vibe || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [games, keywords, system, onlySeats, welcomesNew, mature, tz])

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (keywords) params.set('q', keywords)
    if (system && system !== 'Any') params.set('system', system)
    if (onlySeats) params.set('seats', 'open')
    if (welcomesNew) params.set('new', '1')
    if (mature) params.set('mature', '1')
    if (sortBy && sortBy !== 'Relevance') params.set('sort', sortBy)
    if (tz && tz !== 'Any') params.set('tz', tz === 'local' ? MY_TZ : tz)
    // Default to status=open on the schedule page
    if (!params.has('status')) params.set('status', 'open')

    const url = params.toString() ? `/schedule?${params.toString()}` : '/schedule?status=open'
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastSearchParams', params.toString())
      window.location.href = url
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between relative z-50">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ttrplobby logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-lg tracking-tight">ttrplobby</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
            <a href="/live/players" className="hover:text-white">Live Players</a>
            <a href="/schedule" className="hover:text-white">Scheduled Games</a>
            <a href="/about" className="hover:text-white">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/signup" className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm">Sign up</a>
            <a href="/login" className="px-3 py-1.5 rounded-md bg-brand hover:bg-brandHover text-sm">Log in</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-0">
        <div className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-start">
          {/* Left column */}
          <div className="grid grid-cols-[auto,1fr] items-start gap-3">
            <img
              src="/logo.png"
              alt="ttrplobby logo"
              className="h-10 w-10 lg:h-12 lg:w-12 rounded mt-1 col-start-1 row-start-1"
            />
            <h1 className="col-start-2 row-start-1 text-4xl lg:text-5xl font-extrabold leading-tight">
              Find a table <span className="text-brand">now</span> or schedule for later.
            </h1>
            <p className="col-start-2 row-start-2 mt-4 text-zinc-300 max-w-prose">
              ttrplobby lets you jump into a TTRPG in minutes or plan your next campaign. Create an account with email, Google, or Discord, build your profile, and join a lobby instantly.
              <span className="block mt-2 text-amber-300/90 text-sm">Under construction, and still barely functional.</span>
            </p>

            {/* CTAs */}
            <div className="col-start-2 row-start-3 mt-6 flex flex-wrap gap-3">
              <a href="/live/new" className="px-4 py-2 rounded-lg bg-brand hover:bg-brandHover font-medium">
                Start Live Game
              </a>
              <a href="/schedule/new" className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium">
                Create Scheduled Game
              </a>
            </div>
          </div>

          {/* Search card */}
          <div className="relative z-10 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-800 rounded-2xl p-4 lg:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Find Games to Join</h2>
              <a href="/schedule?status=open" className="text-sm text-brand hover:text-brandHover">Advanced Search Options »</a>
            </div>

            <form onSubmit={submitSearch} className="grid gap-3">
              {/* Keywords */}
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Matching Keywords:</div>
                <input
                  value={keywords}
                  onChange={(e)=>setKeywords(e.target.value)}
                  placeholder="e.g. evil, late night"
                  className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
                />
              </label>

              {/* System + Sort + Time Zone */}
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="text-sm">
                  <div className="mb-1 text-zinc-400">System</div>
                  <select value={system} onChange={(e)=>setSystem(e.target.value)} className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700">
                    {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-zinc-400">Sort</div>
                  <select value={sortBy} onChange={(e)=>setSortBy(e.target.value as any)} className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700">
                    <option>Relevance</option>
                    <option>Soonest</option>
                    <option>Newest</option>
                    <option>Popular</option>
                  </select>
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-zinc-400">Time Zone</div>
                  <select value={tz} onChange={(e)=>setTz(e.target.value)} className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700">
                    <option value="Any">Any</option>
                    <option value="local">Local (auto: {MY_TZ})</option>
                    {COMMON_TZS.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
              </div>

              {/* Toggles (no Free-to-Play) */}
              <div className="grid sm:grid-cols-3 gap-2">
                <Toggle label="Only show games with open seats" checked={onlySeats} onChange={setOnlySeats} />
                <Toggle label="Welcomes new players" checked={welcomesNew} onChange={setWelcomesNew} />
                <Toggle label="18+ content" checked={mature} onChange={setMature} />
              </div>

              <div className="flex items-center justify-end">
                <button type="submit" className="px-3 py-1.5 rounded-md bg-zinc-200 text-zinc-900 font-medium">Search</button>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-sm uppercase tracking-wide text-zinc-400 mt-1">Live Now</h3>
              {err && <div className="text-sm text-red-400 mt-2">{err}</div>}
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {(loading ? [] : filtered).slice(0, 6).map((g) => (
                  <LiveCard key={g.id} g={g} />
                ))}
                {!loading && filtered.length === 0 && (
                  <div className="text-sm text-zinc-400">No live lobbies yet. Be the first to <a className="text-brand hover:text-brandHover" href="/live/new">start one</a>.</div>
                )}
                {loading && [...Array(4)].map((_,i)=>(
                  <div key={i} className="h-28 rounded-lg border border-zinc-800 bg-zinc-900/60 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
          <Feature title="Instant Lobbies" desc="Start a live room and fill seats fast."/>
          <Feature title="Scheduled Games" desc="Post time slots, auto-accept compatible players."/>
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
            <a href="/schedule?status=open" className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium">Browse Lobbies</a>
          </div>
        </div>
      </section>

      {/* Footer */}
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
      <div className="text-brand font-semibold">{title}</div>
      <p className="text-zinc-300 text-sm mt-1">{desc}</p>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean)=>void }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="accent-brand" />
      <span className="text-zinc-300">{label}</span>
    </label>
  )
}

function LiveCard({ g }: { g: Game }) {
  const remain = Math.max(0, (g.seats ?? 0) - (g.players_count ?? 0))
  const full = remain <= 0 || g.status !== 'open'
  const lengthText = g.length_min
    ? (g.length_min >= 60 ? `${(g.length_min / 60).toFixed(g.length_min % 60 ? 1 : 0)} h` : `${g.length_min} min`)
    : '—'
  return (
    <a href={`/lobbies/${g.id}`} className="block rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 hover:border-brand transition">
      <div className="flex gap-3">
        <img
          src={g.poster_url || '/game-poster-fallback.jpg'}
          alt={g.title || 'Game poster'}
          className="h-20 w-28 rounded-md object-cover border border-zinc-800"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{g.title || 'Untitled game'}</div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {g.system || 'TTRPG'} • Length {lengthText} • {full ? 'Full' : `${remain} seats`}
          </div>
          {g.vibe && <div className="text-xs text-zinc-400 mt-0.5 truncate">{g.vibe}</div>}
        </div>
      </div>
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
    console.assert(typeof getBrowserTz() === 'string', 'getBrowserTz returns string')
    console.assert(typeof Logo === 'function', 'Logo is a function')
  } catch {/* no-op */}
})();


