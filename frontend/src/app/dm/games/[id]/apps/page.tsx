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
  status: 'under_review' | 'accepted' | 'declined' | string
  fit_score?: number | null
  answers?: any
  created_at: string
}

const COLUMNS: { key: 'under_review' | 'accepted' | 'declined'; label: string }[] = [
  { key: 'under_review', label: 'Under Review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
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
          .in('status', ['under_review', 'accepted', 'declined'])
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

  // Realtime: keep columns in sync when an application is accepted/declined
  useEffect(() => {
    if (!me) return
    const channel = supabase
      .channel(`apps-listing-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'applications', filter: `listing_id=eq.${id}` },
        (payload) => {
          const row = payload.new as AppRow
          if (!['under_review', 'accepted', 'declined'].includes(row.status)) return
          setApps(prev => {
            const idx = prev.findIndex(a => a.id === row.id)
            if (idx === -1) return [...prev, row]
            const copy = [...prev]
            copy[idx] = { ...copy[idx], ...row }
            return copy
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applications', filter: `listing_id=eq.${id}` },
        (payload) => {
          const row = payload.new as AppRow
          if (!['under_review', 'accepted', 'declined'].includes(row.status)) {
            // If it moved out of our three statuses, remove it from local state
            setApps(prev => prev.filter(a => a.id !== row.id))
            return
          }
          setApps(prev => {
            const idx = prev.findIndex(a => a.id === row.id)
            if (idx === -1) return [...prev, row]
            const copy = [...prev]
            copy[idx] = { ...copy[idx], ...row }
            return copy
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [me, id])

  const grouped = useMemo(() => {
    const m: Record<string, AppRow[]> = { under_review: [], accepted: [], declined: [] }
    for (const a of apps) {
      if (a.status === 'under_review' || a.status === 'accepted' || a.status === 'declined') {
        m[a.status].push(a)
      }
    }
    return m
  }, [apps])

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {/* Header: poster on the LEFT, title block on the RIGHT, bottoms aligned */}
        <div className="flex items-end gap-4">
          <div className="hidden sm:block">
            {game?.poster_url ? (
              <img
                src={game.poster_url}
                alt="Poster"
                className="h-16 w-28 object-cover rounded-lg border border-white/10"
              />
            ) : null}
          </div>
          <div className="flex-1">
            <a href="/notifications" className="text-white/70 hover:text-white">&larr; Back to Inbox</a>
            <h1 className="text-2xl font-bold mt-2">Applications</h1>
            {game ? (
              <p className="text-white/70">{game.title || 'Untitled game'} • {game.system || 'TTRPG'}</p>
            ) : null}
          </div>
        </div>

        {errorMsg && <div className="mt-4 text-sm text-red-400">{errorMsg}</div>}

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl border border-white/10 bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 mt-6">
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

