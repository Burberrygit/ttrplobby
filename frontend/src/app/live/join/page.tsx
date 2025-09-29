// File: frontend/src/app/live/join/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LiveRoom = {
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
  created_at?: string
}

const SYSTEMS = ['Any',
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
]

export default function LiveJoin() {
  const router = useRouter()

  const [system, setSystem] = useState('Any')
  const [welcomesNew, setWelcomesNew] = useState(false)
  const [mature, setMature] = useState(false)
  const [rooms, setRooms] = useState<LiveRoom[]>([])
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // join UX state
  const [joining, setJoining] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null)

  // 🔄 One-time cookie sync so server routes see the session (send access+refresh, refresh if needed)
  useEffect(() => {
    ;(async () => {
      let { data: { session } } = await supabase.auth.getSession()

      // Some environments don't surface refresh_token on first getSession; refresh once to obtain it
      if (session && !session.refresh_token) {
        const r = await supabase.auth.refreshSession()
        if (r.data?.session) session = r.data.session
      }

      if (session?.access_token && session?.refresh_token) {
        try {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          })
        } catch { /* non-fatal */ }
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    let list = rooms
    if (system !== 'Any') list = list.filter(r => (r.system || '') === system)
    if (welcomesNew) list = list.filter(r => !!r.welcomes_new)
    if (mature) list = list.filter(r => !!r.is_mature)
    return list
  }, [rooms, system, welcomesNew, mature])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        // Count (head: true)
        const { count: c } = await supabase
          .from('live_rooms')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open')
        setCount(c || 0)

        // List
        const { data, error } = await supabase
          .from('live_rooms')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(60)
        if (error) throw error
        setRooms((data || []) as LiveRoom[])
      } catch (e: any) {
        setErrorMsg(e?.message || 'Could not load live games. Make sure the "live_rooms" table exists and RLS allows read.')
        setRooms([])
        setCount(0)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function joinWithFilters(opts: {
    system: string | null
    newbie: boolean | null
    adult: boolean | null
    length: number | null
  }) {
    setErrorMsg(null)
    setJoining(true)
    try {
      const { data: { session} } = await supabase.auth.getSession()
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          system: opts.system,
          newbie: opts.newbie,
          adult: opts.adult,
          length: opts.length,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || 'Unable to join a live game')
      }
      router.push(`/live/${json.gameId}`)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to join a live game')
    } finally {
      setJoining(false)
      setJoiningRoomId(null)
    }
  }

  async function quickJoin() {
    await joinWithFilters({
      system: system === 'Any' ? null : system,
      newbie: welcomesNew ? true : null,
      adult: mature ? true : null,
      length: null, // no length filter from this page; matcher will use defaults
    })
  }

  async function joinSpecificRoom(r: LiveRoom) {
    setJoiningRoomId(r.id)
    await joinWithFilters({
      system: r.system ?? null,
      newbie: r.welcomes_new ?? null,
      adult: r.is_mature ?? null,
      length: r.length_min ?? null,
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-white">
      <TopBanner />

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold">Join a live game</h1>
        <div className="text-white/70">Total Live Games ({count})</div>
      </div>
      <p className="text-white/70 mt-1">Pick your preferences, then click <em>Find me a table</em> or join a specific lobby.</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-800 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="sr-only">System</span>
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-white"
            >
              {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" className="accent-[#29e0e3]" checked={welcomesNew} onChange={e => setWelcomesNew(e.target.checked)} />
            New player friendly
          </label>
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" className="accent-[#29e0e3]" checked={mature} onChange={e => setMature(e.target.checked)} />
            18+ content
          </label>
          <button
            onClick={() => { setSystem('Any'); setWelcomesNew(false); setMature(false) }}
            className="px-3 py-2 rounded-xl border border-white/20 hover:border-white/40 text-sm"
            type="button"
          >
            Reset
          </button>

          <div className="ml-auto" />

          <button
            type="button"
            onClick={quickJoin}
            disabled={joining}
            className="px-3 py-2 rounded-xl bg-[#29e0e3] hover:bg-[#22c8cb] text-black font-medium disabled:opacity-60"
          >
            {joining ? 'Finding a table…' : 'Find me a table'}
          </button>
        </div>
      </div>

      {errorMsg && <div className="mt-3 text-sm text-red-400">{errorMsg}</div>}

      {/* Rooms */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="text-white/70 text-sm">No live games match your filters.</div>
        ) : (
          filtered.map((r) => (
            <RoomCard
              key={r.id}
              r={r}
              onJoin={() => joinSpecificRoom(r)}
              joining={joining && joiningRoomId === r.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RoomCard({ r, onJoin, joining }: { r: LiveRoom, onJoin: () => void, joining: boolean }) {
  const remain = useMemo(() => {
    // We don’t have live counts here; treat seats as “capacity” for now.
    return r.seats ?? 0
  }, [r.seats])

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
      <a href={`/live/${r.id}`} className="block">
        <img src={r.poster_url || '/game-poster-fallback.jpg'} alt={r.title || 'Live game'} className="h-40 w-full object-cover" />
      </a>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <a href={`/live/${r.id}`} className="text-base font-semibold truncate hover:underline">
            {r.title || 'Untitled live game'}
          </a>
          <span className="text-xs px-2 py-0.5 rounded-lg border border-[#29e0e3] text-[#29e0e3]">
            {remain} seats
          </span>
        </div>
        <div className="text-sm text-white/70 mt-0.5">
          {r.system || 'TTRPG'} {r.vibe ? `• ${r.vibe}` : ''}
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="inline-block px-3 py-1.5 rounded-lg bg-[#29e0e3] hover:bg-[#22c8cb] text-sm text-black font-medium disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
