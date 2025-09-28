// File: frontend/src/app/schedule/SearchClient.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'

type Game = {
  id: string
  host_id: string
  title: string
  system: string | null
  poster_url: string | null
  scheduled_at: string | null
  status: string
  seats: number
  length_min: number | null
  vibe: string | null
  welcomes_new: boolean
  is_mature: boolean
  created_at: string
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

const SORTS = ['Relevance','Soonest','Newest','Popular'] as const

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

export default function SearchClient() {
  const router = useRouter()
  const params = useSearchParams()

  const MY_TZ = useMemo(() => getBrowserTz(), [])
  const tzLabelLocal = `Local (auto: ${MY_TZ})`

  // --- filters (seed from URL) ---
  const [q, setQ] = useState(decode(params.get('q') || ''))
  const [system, setSystem] = useState<string>(params.get('system') || 'Any')
  const [onlySeats, setOnlySeats] = useState(params.get('seats') === 'open')       // from old link format
  const [welcomesNew, setWelcomesNew] = useState(params.get('new') === '1')
  const [mature, setMature] = useState(params.get('mature') === '1')
  const [sortBy, setSortBy] = useState<string>(params.get('sort') || 'Relevance')
  const [tz, setTz] = useState<string>(params.get('tz') || 'Any') // 'Any' | 'local' | IANA

  // --- data ---
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<Game[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // debounce typing
  const qRef = useRef<NodeJS.Timeout | null>(null)
  function setQDebounced(v: string) {
    setQ(v)
    if (qRef.current) clearTimeout(qRef.current)
    qRef.current = setTimeout(() => {
      updateUrl()
      void load()
    }, 300)
  }

  // reflect filter changes in URL (without full reload)
  function updateUrl() {
    const u = new URL(window.location.href)
    const set = (k: string, v?: string | boolean) => {
      if (v === undefined || v === '' || v === false) u.searchParams.delete(k)
      else u.searchParams.set(k, String(v))
    }
    set('q', q)
    set('system', system !== 'Any' ? system : undefined)
    set('seats', onlySeats ? 'open' : undefined)
    set('new', welcomesNew ? '1' : undefined)
    set('mature', mature ? '1' : undefined)
    set('sort', sortBy !== 'Relevance' ? sortBy : undefined)
    set('tz', tz !== 'Any' ? tz : undefined)
    router.replace(u.pathname + (u.search ? `?${u.searchParams.toString()}` : ''), { scroll: false })
  }

  useEffect(() => {
    // initial load
    ;(async () => {
      try {
        setLoading(true)
        await load()
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // run fetch on non-text filter changes
  useEffect(() => {
    updateUrl()
    setLoading(true)
    void load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [system, onlySeats, welcomesNew, mature, sortBy, tz])

  async function load() {
    try {
      setErrorMsg(null)

      // default to OPEN games only (no UI control for status)
      let query = supabase
        .from('games')
        .select('*, game_players(count)')
        .eq('status', 'open')
        .limit(60)

      // text search across title/system/vibe
      const kw = q.trim()
      if (kw) {
        query = query.or(
          `title.ilike.%${escapeLike(kw)}%,system.ilike.%${escapeLike(kw)}%,vibe.ilike.%${escapeLike(kw)}%`
        )
      }

      if (system && system !== 'Any') query = query.eq('system', system)

      // Base order depending on sort
      if (sortBy === 'Soonest') {
        query = query.order('scheduled_at', { ascending: true, nullsFirst: false })
      } else if (sortBy === 'Newest') {
        query = query.order('created_at', { ascending: false })
      } else {
        // default order by updated_at so fresh items bubble while we compute relevance/popular client-side
        query = query.order('updated_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) throw error

      const mapped: Game[] = (data as any[]).map((g) => ({
        ...g,
        players_count:
          Array.isArray(g.game_players) && g.game_players.length
            ? Number(g.game_players[0].count)
            : 0,
      }))

      // client-side filters that need counts
      let filtered = mapped
      if (onlySeats) {
        filtered = filtered.filter((g) => (g.seats ?? 0) - (g.players_count ?? 0) > 0 && g.status === 'open')
      }
      if (welcomesNew) filtered = filtered.filter((g) => !!g.welcomes_new)
      if (mature) filtered = filtered.filter((g) => !!g.is_mature)

      // Time zone filter (if a game declares its time_zone)
      if (tz !== 'Any' && tz !== 'local') {
        filtered = filtered.filter((g) => (g.time_zone || '').toLowerCase() === tz.toLowerCase())
      }

      // client-side sorts
      if (sortBy === 'Popular') {
        filtered = [...filtered].sort((a, b) => (b.players_count ?? 0) - (a.players_count ?? 0))
      } else if (sortBy === 'Relevance' && kw) {
        const score = (g: Game) => {
          const hay = `${g.title || ''} ${g.system || ''} ${g.vibe || ''}`.toLowerCase()
          const idx = hay.indexOf(kw.toLowerCase())
          if (idx === -1) return 0
          let s = 100 - Math.min(idx, 90)
          if ((g.title || '').toLowerCase().includes(kw.toLowerCase())) s += 25
          return s
        }
        filtered = [...filtered].sort((a, b) => score(b) - score(a))
      }

      setGames(filtered)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to load games')
      setGames([])
    }
  }

  const resetFilters = () => {
    setQ('')
    setSystem('Any')
    setOnlySeats(false)
    setWelcomesNew(false)
    setMature(false)
    setSortBy('Relevance')
    setTz('Any')
  }

  const effectiveTz = tz === 'Any' || tz === 'local' ? MY_TZ : tz

  return (
    <>
      <h1 className="text-2xl font-bold text-white">Search games</h1>
      <p className="text-white/70 mt-1">Find a table by title, system, vibe, time zone, or availability.</p>

      {/* Search + Filters Bar (no dropdowns; everything inline) */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-800 p-4">
        <div className="grid gap-3">
          {/* Row 1: query + core selects */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1">
              <label className="sr-only">Search</label>
              <div className="flex items-center gap-2 rounded-xl bg-zinc-950 border border-white/10 px-3 py-2">
                <SearchIcon />
                <input
                  value={q}
                  onChange={(e) => setQDebounced(e.target.value)}
                  placeholder="Search titles, systems, vibes…"
                  className="bg-transparent outline-none text-white placeholder:text-white/40 flex-1"
                />
                {q && (
                  <button className="text-white/60 hover:text-white" onClick={() => { setQ(''); updateUrl(); void load() }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <Select value={system} onChange={setSystem} label="System" options={SYSTEMS as unknown as string[]} />
            <Select value={sortBy} onChange={setSortBy} label="Sort" options={SORTS as unknown as string[]} />
            <Select
              value={tz}
              onChange={setTz}
              label="Time zone"
              options={['Any', 'local', ...COMMON_TZS] as unknown as string[]}
              labels={{ local: tzLabelLocal }}
            />
          </div>

          {/* Row 2: inline toggles (formerly in Filters dropdown) */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-brand" checked={onlySeats} onChange={e => setOnlySeats(e.target.checked)} />
              <span>Only show games with open seats</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-brand" checked={welcomesNew} onChange={e => setWelcomesNew(e.target.checked)} />
              <span>Welcomes new players</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-brand" checked={mature} onChange={e => setMature(e.target.checked)} />
              <span>18+ content</span>
            </label>

            <button onClick={resetFilters} className="ml-auto px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">
              Reset all
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="text-white/70 text-sm">{loading ? 'Loading…' : `${games.length} result${games.length === 1 ? '' : 's'}`}</div>
        </div>

        {errorMsg && <div className="mt-3 text-sm text-red-400">{errorMsg}</div>}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />)}
          </div>
        ) : games.length === 0 ? (
          <div className="text-white/70 text-sm mt-3">No games match your filters.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {games.map((g) => <GameCard key={g.id} g={g} tz={effectiveTz} />)}
          </div>
        )}
      </div>
    </>
  )
}

/* --------------------------------- UI --------------------------------- */

function Select({ value, onChange, label, options, labels }: {
  value: string, onChange: (v: string) => void, label: string, options: string[], labels?: Record<string,string>
}) {
  return (
    <label className="text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-white"
      >
        {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </label>
  )
}

function GameCard({ g, tz }: { g: any, tz: string }) {
  const remain = Math.max(0, (g.seats ?? 0) - (g.players_count ?? 0))
  const full = remain <= 0 || g.status !== 'open'
  const lengthText = g.length_min
    ? (g.length_min >= 60 ? `${(g.length_min / 60).toFixed(g.length_min % 60 ? 1 : 0)} h` : `${g.length_min} min`)
    : '—'
  const when = g.scheduled_at ? fmtDateInTz(g.scheduled_at, tz) : null
  const tzBadge = g.time_zone ? g.time_zone : null

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
      <a href={`/lobbies/${g.id}`} className="block">
        <img src={g.poster_url || '/game-poster-fallback.jpg'} alt={g.title} className="h-40 w-full object-cover" />
      </a>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <a href={`/lobbies/${g.id}`} className="text-base font-semibold truncate hover:underline">
            {g.title || 'Untitled game'}
          </a>
          <span className={`text-xs px-2 py-0.5 rounded-lg border ${full ? 'border-white/20 text-white/60' : 'border-brand text-brand'}`}>
            {full ? 'Full' : `${remain} seats`}
          </span>
        </div>
        <div className="text-sm text-white/70 mt-0.5">
          {g.system || 'TTRPG'} {g.vibe ? `• ${g.vibe}` : ''} {when ? `• ${when}` : ''}
        </div>
        <div className="text-xs text-white/50 mt-1">
          Length {lengthText} • {g.welcomes_new ? 'New player friendly' : 'Experienced only'} • {g.is_mature ? '18+' : 'All ages'}
          {tzBadge ? <> • TZ: {tzBadge}</> : null}
        </div>
      </div>
    </div>
  )
}

/* --------------------------- Inline icons --------------------------- */

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/* --------------------------- helpers --------------------------- */
function decode(s: string) {
  try { return decodeURIComponent(s) } catch { return s }
}
function escapeLike(s: string) {
  return s.replace(/[%_]/g, (m) => '\\' + m)
}
function getBrowserTz(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return z || 'UTC'
  } catch {
    return 'UTC'
  }
}
function fmtDateInTz(iso: string, tz: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  } catch {
    const d = new Date(iso)
    return d.toLocaleString()
  }
}

