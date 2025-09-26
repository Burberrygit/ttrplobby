// File: frontend/src/app/lobbies/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchOpenGames, joinGame, leaveGame, Game } from '@/lib/games'

export default function LobbiesListPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState<Game[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // filters
  const [q, setQ] = useState('')
  const [welcomes, setWelcomes] = useState(false)
  const [mature, setMature] = useState(false)
  const [onlyWithSeats, setOnlyWithSeats] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent('/lobbies')}`)
        return
      }
      setAuthChecked(true)
      try {
        setLoading(true)
        const list = await fetchOpenGames()
        setGames(list)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load lobbies')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return games.filter(g => {
      if (welcomes && !g.welcomes_new) return false
      if (mature && !g.is_mature) return false
      if (onlyWithSeats) {
        const remain = (g.seats ?? 0) - (g.players_count ?? 0)
        if (remain <= 0) return false
      }
      if (!s) return true
      const hay = `${g.title} ${g.system ?? ''} ${g.vibe ?? ''}`.toLowerCase()
      return hay.includes(s)
    })
  }, [games, q, welcomes, mature, onlyWithSeats])

  if (!authChecked) {
    return <Shell><div className="text-white/70">Checking sign-in…</div></Shell>
  }

  return (
    <Shell>
      <TopBanner />

      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Open lobbies</h1>
            <p className="text-white/60 mt-1">Join a table that’s looking for players.</p>
          </div>
          <a href="/lobbies/new" className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium">Start a live game</a>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
            placeholder="Search by title, system, vibe…"
            value={q} onChange={e=>setQ(e.target.value)}
          />
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" className="accent-brand" checked={welcomes} onChange={e=>setWelcomes(e.target.checked)} />
            <span>New players welcome</span>
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" className="accent-brand" checked={mature} onChange={e=>setMature(e.target.checked)} />
            <span>18+ content</span>
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" className="accent-brand" checked={onlyWithSeats} onChange={e=>setOnlyWithSeats(e.target.checked)} />
            <span>Only show with seats</span>
          </label>
        </div>

        {errorMsg && <div className="text-sm text-red-400 mt-4">{errorMsg}</div>}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {[...Array(6)].map((_, i) => <div key={i} className="h-56 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-white/70 text-sm mt-6">No lobbies match your filters.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filtered.map((g) => (
              <GameCard key={g.id} g={g} onJoined={(updated) => {
                setGames(prev => prev.map(x => x.id === updated.id ? updated : x))
              }} onLeft={(updated) => {
                setGames(prev => prev.map(x => x.id === updated.id ? updated : x))
              }} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

function GameCard({ g, onJoined, onLeft }: {
  g: Game
  onJoined: (g: Game) => void
  onLeft: (g: Game) => void
}) {
  const [working, setWorking] = useState(false)
  const players = g.players_count ?? 0
  const remain = (g.seats ?? 0) - players
  const full = remain <= 0 || g.status !== 'open'

  async function doJoin() {
    try {
      setWorking(true)
      await joinGame(g.id)
      onJoined({ ...g, players_count: players + 1 })
    } catch (e: any) {
      alert(e?.message || 'Join failed')
    } finally {
      setWorking(false)
    }
  }
  async function doLeave() {
    try {
      setWorking(true)
      await leaveGame(g.id)
      onLeft({ ...g, players_count: Math.max(0, players - 1) })
    } catch (e: any) {
      alert(e?.message || 'Leave failed')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
      <a href={`/lobbies/${g.id}`} className="block">
        <img src={g.poster_url || '/game-poster-fallback.jpg'} alt={g.title} className="h-40 w-full object-cover" />
      </a>
      <div className="px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <a href={`/lobbies/${g.id}`} className="text-base font-semibold truncate hover:underline">{g.title}</a>
          <span className={`text-xs px-2 py-0.5 rounded-lg border ${full ? 'border-white/20 text-white/60' : 'border-brand text-brand'}`}>
            {full ? 'Full' : `${remain} seats`}
          </span>
        </div>
        <div className="text-sm text-white/70 mt-0.5">{g.system || 'TTRPG'} {g.vibe ? `• ${g.vibe}` : ''}</div>
        <div className="flex items-center gap-2 mt-3">
          <button
            disabled={working || full}
            onClick={doJoin}
            className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brandHover font-medium disabled:opacity-60"
          >
            {working ? 'Working…' : 'Join'}
          </button>
          <button
            disabled={working}
            onClick={doLeave}
            className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-6xl mx-auto px-4 py-8 text-white">{children}</div>
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
