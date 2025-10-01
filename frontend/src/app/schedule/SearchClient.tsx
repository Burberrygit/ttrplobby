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
  time_zone?: string | null // stored as code, e.g., EDT, PST, UTC+01:00
}

const SYSTEMS = [
  'Any',
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
] as const

const SORTS = ['Relevance','Soonest','Newest','Popular'] as const

// === New timezone system: codes like EST/EDT/PST as well as UTC±HH:MM ===
const TZ_CODE_OPTIONS = [
  'Any',
  '__auto__',       // auto-detect from browser; we’ll render a friendly label for it
  // UTC/GMT band
  'UTC','GMT',
  'UTC-12:00','UTC-11:00','UTC-10:00','UTC-09:00','UTC-08:00','UTC-07:00','UTC-06:00','UTC-05:00','UTC-04:00',
  'UTC-03:00','UTC-02:00','UTC-01:00',
  'UTC+00:00','UTC+01:00','UTC+02:00','UTC+03:00','UTC+03:30','UTC+04:00','UTC+05:00','UTC+05:30','UTC+06:00',
  'UTC+07:00','UTC+08:00','UTC+09:00','UTC+09:30','UTC+10:00','UTC+11:00','UTC+12:00','UTC+13:00',
  // North America (abbr)
  'EST','EDT','CST','CDT','MST','MDT','PST','PDT','AKST','AKDT','HST','AST','ADT','NST','NDT',
  // Europe (abbr)
  'WET','WEST','CET','CEST','EET','EEST','MSK',
  // APAC (abbr)
  'PKT','IST','BST','ICT','SGT','HKT','CSTCN','JST','KST','AWST','ACST','ACDT','AEST','AEDT','NZST','NZDT',
] as const

// Offsets in minutes relative to UTC (+east, -west)
const CODE_OFFSET: Record<string, number> = {
  UTC: 0, GMT: 0,
  'UTC-12:00': -720, 'UTC-11:00': -660, 'UTC-10:00': -600, 'UTC-09:00': -540, 'UTC-08:00': -480,
  'UTC-07:00': -420, 'UTC-06:00': -360, 'UTC-05:00': -300, 'UTC-04:00': -240, 'UTC-03:00': -180,
  'UTC-02:00': -120, 'UTC-01:00': -60, 'UTC+00:00': 0, 'UTC+01:00': 60, 'UTC+02:00': 120, 'UTC+03:00': 180,
  'UTC+03:30': 210, 'UTC+04:00': 240, 'UTC+05:00': 300, 'UTC+05:30': 330, 'UTC+06:00': 360,
  'UTC+07:00': 420, 'UTC+08:00': 480, 'UTC+09:00': 540, 'UTC+09:30': 570, 'UTC+10:00': 600,
  'UTC+11:00': 660, 'UTC+12:00': 720, 'UTC+13:00': 780,
  // NA
  EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360, PST: -480, PDT: -420,
  AKST: -540, AKDT: -480, HST: -600, AST: -240, ADT: -180, NST: -210, NDT: -150,
  // Europe
  WET: 0, WEST: 60, CET: 60, CEST: 120, EET: 120, EEST: 180, MSK: 180,
  // APAC
  PKT: 300, IST: 330, BST: 360, ICT: 420, SGT: 480, HKT: 480, CSTCN: 480, JST: 540, KST: 540,
  AWST: 480, ACST: 570, ACDT: 630, AEST: 600, AEDT: 660, NZST: 720, NZDT: 780,
}

function isIanaZone(s: string) {
  return /[A-Za-z]+\/[A-Za-z_]+/.test(s)
}
function parseUtcLabelToOffset(code: string): number | null {
  const m = /^UTC([+-])(\d{2}):(\d{2})$/.exec(code) || /^GMT([+-])(\d{2}):(\d{2})$/.exec(code)
  if (!m) return null
  const sign = m[1] === '+' ? 1 : -1
  const hh = parseInt(m[2], 10)
  const mm = parseInt(m[3], 10)
  return sign * (hh * 60 + mm)
}
function codeToOffsetMinutes(code: string): number | null {
  if (CODE_OFFSET[code] !== undefined) return CODE_OFFSET[code]
  const p = parseUtcLabelToOffset(code)
  return p == null ? null : p
}

export default function SearchClient() {
  const router = useRouter()
  const params = useSearchParams()

  // Browser local IANA + short code
  const MY_IANA = useMemo(() => getBrowserIana(), [])
  const AUTO_ABBR = useMemo(() => getAbbrForIana(MY_IANA) || 'UTC', [MY_IANA])
  const tzAutoLabel = `Auto-detect (${AUTO_ABBR})`

  // --- filters (seed from URL) ---
  const [q, setQ] = useState(decode(params.get('q') || ''))
  const [system, setSystem] = useState<string>(params.get('system') || 'Any')
  const [onlySeats, setOnlySeats] = useState(params.get('seats') === 'open')
  const [welcomesNew, setWelcomesNew] = useState(params.get('new') === '1')
  const [mature, setMature] = useState(params.get('mature') === '1')
  const [sortBy, setSortBy] = useState<string>(params.get('sort') || 'Relevance')

  // Use new tz code param; fall back to old ?tz if present; default to Auto
  const initialTzFromParams =
    params.get('tz_code') || params.get('tz') || (typeof window !== 'undefined' ? localStorage.getItem('ttrplobby:tz_code') || '' : '')
  const [tzCode, setTzCode] = useState<string>(initialTzFromParams || '__auto__') // '__auto__' | 'Any' | code

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
    set('tz_code', tzCode !== 'Any' ? tzCode : undefined)
    router.replace(u.pathname + (u.search ? `?${u.searchParams.toString()}` : ''), { scroll: false })
    try { localStorage.setItem('ttrplobby:tz_code', tzCode) } catch {}
  }

  useEffect(() => {
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
  }, [system, onlySeats, welcomesNew, mature, sortBy, tzCode])

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

      // Time zone filter against code stored on the game
      if (tzCode !== 'Any') {
        const code = tzCode === '__auto__' ? (AUTO_ABBR || 'UTC') : tzCode
        filtered = filtered.filter((g) => (g.time_zone || '').toUpperCase() === code.toUpperCase())
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
    setTzCode('__auto__')
  }

  // For display: if user picked a code, we’ll render times using that offset; otherwise use local IANA
  const displayZone = tzCode === 'Any' || tzCode === '__auto__' ? MY_IANA : tzCode

  return (
    <div className="min-h-screen flex flex-col text-white">
      <main className="flex-1">
        <div className="max-w-6xl mx-auto w-full px-4 py-8">
          <h1 className="text-2xl font-bold text-white">Search scheduled games</h1>
          <p className="text-white/70 mt-1">Apply to tables by title, system, vibe, time zone, or availability.</p>

          {/* Search + Filters Bar */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-800 p-4">
            <div className="grid gap-3">
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
                  value={tzCode}
                  onChange={setTzCode}
                  label="Time zone"
                  options={TZ_CODE_OPTIONS as unknown as string[]}
                  labels={{ '__auto__': tzAutoLabel }}
                />
              </div>

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
                {games.map((g) => <GameCard key={g.id} g={g} tz={displayZone} />)}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Pinned footer */}
      <footer className="border-t border-white/10 px-4">
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

  // NEW: Always send users to the Apply flow (scheduled games)
  const applyHref = `/schedule/${g.id}/apply`

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
      <a href={applyHref} className="block">
        <img src={g.poster_url || '/game-poster-fallback.jpg'} alt={g.title} className="h-40 w-full object-cover" />
      </a>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <a href={applyHref} className="text-base font-semibold truncate hover:underline">
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

        {/* NEW: Apply CTA */}
        <div className="mt-2">
          <a
            href={applyHref}
            className="inline-block px-3 py-1.5 rounded-lg bg-brand hover:bg-brandHover text-sm font-medium"
          >
            Apply
          </a>
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
function getBrowserIana(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return z || 'UTC'
  } catch {
    return 'UTC'
  }
}
function getAbbrForIana(iana: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short', hour: '2-digit' }).formatToParts(new Date())
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    const val = tzPart?.value?.trim() || ''
    if (/^[A-Za-z]{2,5}$/.test(val)) return val.toUpperCase()
    // Some browsers return "GMT+2"
    const m = /^GMT([+-]\d{1,2})/.exec(val)
    if (m) return `UTC${m[1].length === 2 ? m[1] + ':00' : m[1]}`
    return null
  } catch { return null }
}

function fmtDateInTz(iso: string, tz: string): string {
  try {
    const d = new Date(iso)
    if (isIanaZone(tz)) {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d)
    }
    // tz is a code like EDT / UTC+01:00
    const offset = codeToOffsetMinutes(tz)
    if (offset == null) {
      // Fallback: local
      return new Intl.DateTimeFormat(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(d)
    }
    // Convert to "clock time" in the target fixed offset: take UTC ms and add offset
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000
    const shifted = new Date(utcMs + offset * 60000)
    return new Intl.DateTimeFormat(undefined, {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(shifted)
  } catch {
    const d = new Date(iso)
    return d.toLocaleString()
  }
}
