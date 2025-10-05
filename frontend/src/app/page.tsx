// frontend/src/app/page.tsx  (drop-in replacement)
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/* --------------  TYPES & CONSTANTS -------------- */
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
  time_zone?: string | null
}

const SYSTEMS = [
  'Any',
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
] as const

const COMMON_TZS = [
  'UTC','America/Toronto','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Sao_Paulo','America/Mexico_City','America/Bogota','Europe/London','Europe/Dublin','Europe/Paris',
  'Europe/Berlin','Europe/Madrid','Europe/Rome','Africa/Johannesburg','Asia/Jerusalem','Asia/Dubai',
  'Asia/Karachi','Asia/Kolkata','Asia/Bangkok','Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo',
  'Asia/Seoul','Asia/Shanghai','Australia/Sydney','Pacific/Auckland','Pacific/Honolulu'
] as const

function getBrowserTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

/* --------------  COMPONENT -------------- */
export default function HomePage() {
  /* ---------- state mirrors original ---------- */
  const [keywords, setKeywords] = useState('')
  const [system, setSystem] = useState<string>('Any')
  const [sortBy, setSortBy] = useState<'Relevance' | 'Soonest' | 'Newest' | 'Popular'>('Relevance')
  const [onlySeats, setOnlySeats] = useState(false)
  const [welcomesNew, setWelcomesNew] = useState(false)
  const [mature, setMature] = useState(false)
  const [tz, setTz] = useState<string>('Any')
  const MY_TZ = useMemo(() => getBrowserTz(), [])

  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  /* ---------- data fetch (unchanged) ---------- */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setErr(null); setLoading(true)
        const { data, error } = await supabase
          .from('games')
          .select('id,title,system,poster_url,length_min,vibe,seats,status,updated_at, game_players(count)')
          .eq('status', 'open')
          .order('updated_at', { ascending: false })
          .limit(12)
        if (error) throw error

        const mapped: Game[] = (data as any[]).map((g) => ({
          ...g,
          players_count: Array.isArray(g.game_players) && g.game_players.length
            ? Number(g.game_players[0].count)
            : 0,
        }))
        if (mounted) setGames(mapped)
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Failed to load games')
      } finally { if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  /* ---------- filters (unchanged) ---------- */
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
      if (tz !== 'Any' && tz !== 'local') {
        if ('time_zone' in g && typeof (g as any).time_zone === 'string') {
          if (((g as any).time_zone || '').toLowerCase() !== tz.toLowerCase()) return false
        }
      }
      if (!s) return true
      const hay = `${g.title || ''} ${g.system || ''} ${g.vibe || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [games, keywords, system, onlySeats, welcomesNew, mature, tz])

  /* ---------- search submit (unchanged) ---------- */
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
    if (!params.has('status')) params.set('status', 'open')

    const url = params.toString() ? `/schedule?${params.toString()}` : '/schedule?status=open'
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastSearchParams', params.toString())
      window.location.href = url
    }
  }

  /* --------------  RENDER -------------- */
  return (
    <main className="min-h-screen text-zinc-100 relative isolate">
      {/* ------ full-bleed background ------ */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: 'url(/image007.png)' }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      {/* ------ sticky header ------ */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ttrplobby logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-lg tracking-tight">ttrplobby</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
            <a href="/live/players" className="hover:text-white transition">Live Players</a>
            <a href="/schedule" className="hover:text-white transition">Scheduled Games</a>
            <a href="/about" className="hover:text-white transition">About</a>
          </nav>

          <div className="flex items-center gap-2">
            <a href="/signup" className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm transition">Sign up</a>
            <a href="/login" className="px-3 py-1.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-sm transition">Log in</a>
          </div>
        </div>
      </header>

      {/* ------ hero + search ------ */}
      <section className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-start">
        {/* left pitch */}
        <div>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
            Find a table <span className="text-indigo-400">now</span> or schedule for later.
          </h1>
          <p className="mt-4 text-zinc-300 max-w-prose">
            ttrplobby lets you find a TTRPG game online in minutes or plan your next campaign. Create an account with Google, or Discord, build your profile, and join a lobby instantly.
            <span className="block mt-2 text-amber-300/90 text-sm">Under construction, but functional.</span>
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/live/new" className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 font-medium transition shadow-lg shadow-indigo-500/20">Start Live Game</a>
            <a href="/schedule/new" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-medium transition">Create Scheduled Game</a>
          </div>
        </div>

        {/* glass search card */}
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 lg:p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Find Games to Join</h2>
            <a href="/schedule?status=open" className="text-sm text-indigo-400 hover:text-indigo-300 transition">Advanced Search Options »</a>
          </div>

          <form onSubmit={submitSearch} className="grid gap-3">
            {/* keywords */}
            <label className="text-sm">
              <div className="mb-1 text-zinc-400">Matching Keywords:</div>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. evil, late night"
                className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              />
            </label>

            {/* triple select */}
            <div className="grid sm:grid-cols-3 gap-2">
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">System</div>
                <select value={system} onChange={(e) => setSystem(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition">
                  {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Sort</div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition">
                  <option>Relevance</option>
                  <option>Soonest</option>
                  <option>Newest</option>
                  <option>Popular</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Time Zone</div>
                <select value={tz} onChange={(e) => setTz(e.target.value)} className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition">
                  <option value="Any">Any</option>
                  <option value="local">Local (auto: {MY_TZ})</option>
                  {COMMON_TZS.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
            </div>

            {/* toggles */}
            <div className="grid sm:grid-cols-3 gap-2">
              <Toggle label="Only show games with open seats" checked={onlySeats} onChange={setOnlySeats} />
              <Toggle label="Welcomes new players" checked={welcomesNew} onChange={setWelcomesNew} />
              <Toggle label="18+ content" checked={mature} onChange={setMature} />
            </div>

            <div className="flex items-center justify-end">
              <button type="submit" className="px-3 py-1.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition">Search</button>
            </div>
          </form>

          {/* live now */}
          <div className="mt-6">
            <h3 className="text-sm uppercase tracking-wide text-zinc-400">Live Now</h3>
            {err && <div className="text-sm text-red-400 mt-2">{err}</div>}
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              {(loading ? [] : filtered).slice(0, 6).map((g) => <LiveCard key={g.id} g={g} />)}
              {!loading && filtered.length === 0 && (
                <div className="text-sm text-zinc-400">No live lobbies yet. Be the first to <a className="text-indigo-400 hover:text-indigo-300" href="/live/new">start one</a>.</div>
              )}
              {loading && [...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-lg border border-white/10 bg-white/5 animate-pulse" />)}
            </div>
          </div>
        </div>
      </section>

      {/* ------ feature grid ------ */}
      <section className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        <Feature title="Instant Lobbies" desc="Start a live room and fill seats fast." />
        <Feature title="Scheduled Games" desc="Post time slots, auto-accept compatible players." />
        <Feature title="Profiles & Progress" desc="Avatar, username, games played — your reputation travels with you." />
      </section>

      {/* ------ bottom cta ------ */}
      <section className="max-w-6xl mx-auto px-4 py-14 text-center">
        <h2 className="text-2xl font-bold">Ready to roll?</h2>
        <p className="text-zinc-300 mt-2">Create an account and jump into a lobby, or schedule your next session.</p>
        <div className="mt-5 flex justify-center gap-3">
          <a href="/signup" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-medium transition">Get Started</a>
          <a href="/schedule?status=open" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-medium transition">Browse Lobbies</a>
        </div>
      </section>

      {/* ------ footer ------ */}
      <footer className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-400 flex flex-wrap items-center justify-between gap-3 border-t border-white/10">
        <div>© {new Date().getFullYear()} ttrplobby</div>
        <div className="flex gap-4">
          <a href="/terms" className="hover:text-white transition">Terms</a>
          <a href="/privacy" className="hover:text-white transition">Privacy</a>
          <a href="/contact" className="hover:text-white transition">Contact</a>
        </div>
      </footer>
    </main>
  )
}

/* --------------  HELPERS -------------- */
function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-white/20 transition">
      <div className="text-indigo-400 font-semibold">{title}</div>
      <p className="text-zinc-300 text-sm mt-1">{desc}</p>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="text-sm flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-500" />
      <span className="text-zinc-300">{label}</span>
    </label>
  )
}

function LiveCard({ g }: { g: Game }) {
  const remain = Math.max(0, (g.seats ?? 0) - (g.players_count ?? 0))
  const full = remain <= 0 || g.status !== 'open'
  const lengthText = g.length_min
    ? g.length_min >= 60
      ? `${(g.length_min / 60).toFixed(g.length_min % 60 ? 1 : 0)} h`
      : `${g.length_min} min`
    : '—'
  return (
    <a href={`/lobbies/${g.id}`} className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:border-indigo-400 transition shadow-md">
      <div className="flex gap-3">
        <img src={g.poster_url || '/game-poster-fallback.jpg'} alt={g.title || 'Game poster'} className="h-20 w-28 rounded-md object-cover border border-white/10" />
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
