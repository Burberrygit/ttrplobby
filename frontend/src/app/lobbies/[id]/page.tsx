// File: frontend/src/app/lobbies/[id]/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchGame, joinGame, leaveGame, deleteGame, endGame, Game } from '@/lib/games'

export default function LobbyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [me, setMe] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/lobbies/${id}`)}`)
        return
      }
      setMe(user.id)
      setAuthChecked(true)
      try {
        setLoading(true)
        const g = await fetchGame(id)
        setGame(g)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load game')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const players = game?.players_count ?? 0
  const remain = Math.max(0, (game?.seats ?? 0) - players)
  const full = remain <= 0 || game?.status !== 'open'
  const isOwner = useMemo(() => Boolean(game && me && game.host_id === me), [game, me])

  async function doJoin() {
    if (!game) return
    try {
      setWorking(true)
      await joinGame(game.id)
      setGame({ ...game, players_count: (game.players_count ?? 0) + 1 })
    } catch (e: any) {
      alert(e?.message || 'Join failed')
    } finally {
      setWorking(false)
    }
  }
  async function doLeave() {
    if (!game) return
    try {
      setWorking(true)
      await leaveGame(game.id)
      setGame({ ...game, players_count: Math.max(0, (game.players_count ?? 0) - 1) })
    } catch (e: any) {
      alert(e?.message || 'Leave failed')
    } finally {
      setWorking(false)
    }
  }
  async function doDelete() {
    if (!game) return
    const ok = confirm('Delete this game? This cannot be undone.')
    if (!ok) return
    try {
      setWorking(true)
      await deleteGame(game.id)
      router.push('/lobbies')
    } catch (e: any) {
      alert(e?.message || 'Delete failed')
    } finally {
      setWorking(false)
    }
  }
  async function doEnd() {
    if (!game) return
    const ok = confirm('Mark this game as completed?')
    if (!ok) return
    try {
      setWorking(true)
      await endGame(game.id)
      setGame({ ...game, status: 'completed' })
    } catch (e: any) {
      alert(e?.message || 'End failed')
    } finally {
      setWorking(false)
    }
  }

  if (!authChecked) {
    return <Shell><div className="text-white/70">Checking sign-in…</div></Shell>
  }

  if (loading) {
    return (
      <Shell>
        <TopBanner />
        <div className="rounded-3xl border border-white/10 bg-white/5 h-56 animate-pulse" />
      </Shell>
    )
  }

  if (!game) {
    return (
      <Shell>
        <TopBanner />
        <div className="text-white/80">Game not found.</div>
      </Shell>
    )
  }

  return (
    <Shell>
      <TopBanner />

      {/* Poster header */}
      <div className="overflow-hidden rounded-3xl border border-zinc-800">
        <div className="relative">
          <img
            src={game.poster_url || '/game-poster-fallback.jpg'}
            alt={game.title}
            className="h-56 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
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

        {/* Body */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
          <div className="grid sm:grid-cols-2 gap-4">
            <Info label="Status" value={titleCase(game.status)} />
            <Info label="Length" value={game.length_min ? `${game.length_min} min` : '—'} />
            <Info label="New players" value={game.welcomes_new ? 'Yes' : 'No'} />
            <Info label="18+" value={game.is_mature ? 'Yes' : 'No'} />
          </div>

          <div className="flex items-center gap-2 mt-6">
            {!isOwner && (
              <>
                <button
                  disabled={working || full}
                  onClick={doJoin}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60"
                >
                  {working ? 'Working…' : 'Join game'}
                </button>
                <button
                  disabled={working}
                  onClick={doLeave}
                  className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40"
                >
                  Leave
                </button>
              </>
            )}
            {isOwner && (
              <>
                <button
                  disabled={working}
                  onClick={doEnd}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20"
                >
                  {game.status === 'completed' ? 'Reopen (coming soon)' : 'End game'}
                </button>
                <button
                  disabled={working}
                  onClick={doDelete}
                  className="px-4 py-2 rounded-xl border border-red-400/50 text-red-300 hover:border-red-400"
                >
                  Delete
                </button>
              </>
            )}
            <a href="/lobbies" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Back to lobbies</a>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-5xl mx-auto px-4 py-8 text-white">{children}</div>
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
