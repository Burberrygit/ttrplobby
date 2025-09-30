'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Game = {
  id: string
  host_id: string
  title: string | null
  system: string | null
  poster_url: string | null
  scheduled_at: string | null
  status: string
  seats: number | null
}

type AppRow = {
  id: string
  listing_id: string
  player_id: string
  status: string
  fit_score?: number | null
  answers?: any
  created_at: string
}

const COLUMNS: { key: string; label: string }[] = [
  { key: 'under_review', label: 'Under Review' },
  { key: 'interview', label: 'Interview' },
  { key: 'offered', label: 'Offered' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'waitlisted', label: 'Waitlisted' },
  { key: 'declined', label: 'Declined' },
  { key: 'withdrawn', label: 'Withdrawn' },
]

export default function DMAppsPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [apps, setApps] = useState<AppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=' + encodeURIComponent(`/dm/games/${id}/apps`))
        return
      }
      setMe({ id: user.id })
    })()
  }, [id, router])

  useEffect(() => {
    if (!me) return
    ;(async () => {
      try {
        setLoading(true)
        const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', id).single()
        if (gErr) throw gErr
        if (g.host_id !== me.id) {
          setErrorMsg('You are not the host of this game.')
          setLoading(false)
          return
        }
        setGame(g as Game)

        const { data: rows, error } = await supabase
          .from('applications')
          .select('id, listing_id, player_id, status, fit_score, answers, created_at')
          .eq('listing_id', id)
          .order('created_at', { ascending: true })
        if (error) throw error
        setApps((rows || []) as AppRow[])
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load applications')
      } finally {
        setLoading(false)
      }
    })()
  }, [me, id])

  const grouped = useMemo(() => {
    const m: Record<string, AppRow[]> = {}
    COLUMNS.forEach(c => (m[c.key] = []))
    for (const a of apps) {
      (m[a.status] = m[a.status] || []).push(a)
    }
    return m
  }, [apps])

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <a href="/notifications" className="text-white/70 hover:text-white">&larr; Back to Inbox</a>
            <h1 className="text-2xl font-bold mt-2">Applications</h1>
            {game ? (
              <p className="text-white/70">{game.title || 'Untitled game'} • {game.system || 'TTRPG'}</p>
            ) : null}
          </div>
          <div className="hidden sm:block">
            {game?.poster_url ? <img src={game.poster_url} alt="Poster" className="h-16 w-28 object-cover rounded-lg border border-white/10" /> : null}
          </div>
        </div>

        {errorMsg && <div className="mt-4 text-sm text-red-400">{errorMsg}</div>}

        {loading ? (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {[...Array(8)].map((_, i) => <div key={i} className="h-40 rounded-xl border border-white/10 bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {COLUMNS.map(col => (
              <section key={col.key} className="rounded-2xl border border-white/10 bg-zinc-900/60">
                <header className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <span className="text-xs text-white/60">{grouped[col.key]?.length ?? 0}</span>
                </header>
                <div className="p-3 grid gap-3">
                  {(grouped[col.key] || []).map(a => <AppCard key={a.id} a={a} gameId={id} />)}
                  {(grouped[col.key] || []).length === 0 && (
                    <div className="text-xs text-white/50">No applications</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AppCard({ a, gameId }: { a: AppRow, gameId: string }) {
  // lightweight view; we don’t assume a profiles table join
  const created = new Date(a.created_at).toLocaleString()
  const fit = typeof a.fit_score === 'number' ? a.fit_score : undefined
  return (
    <a href={`/dm/games/${gameId}/apps/${a.id}`} className="block rounded-xl border border-white/10 bg-zinc-950 p-3 hover:border-white/30">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Applicant</div>
        {fit !== undefined ? <span className="text-xs rounded-md bg-white/10 px-2 py-0.5">Fit {fit}</span> : null}
      </div>
      <div className="text-xs text-white/60 mt-1">Submitted {created}</div>
      {a.answers?.experience ? (
        <div className="text-xs text-white/70 mt-1">Experience: {a.answers.experience}</div>
      ) : null}
      {a.answers?.timezone ? (
        <div className="text-xs text-white/70 mt-1">TZ: {a.answers.timezone}</div>
      ) : null}
    </a>
  )
}
