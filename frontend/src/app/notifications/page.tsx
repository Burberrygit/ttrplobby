// frontend/src/app/notifications/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  data: any
  read: boolean
  created_at: string
}

type Game = {
  id: string
  host_id: string
  title: string | null
  system: string | null
  poster_url: string | null
  scheduled_at: string | null
  status: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [tab, setTab] = useState<'notifications' | 'hosted'>('notifications')
  const [loading, setLoading] = useState(true)

  // Notifications
  const [notes, setNotes] = useState<Notification[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Hosted games
  const [games, setGames] = useState<Game[]>([])
  const [appCounts, setAppCounts] = useState<Record<string, number>>({})
  const [loadingGames, setLoadingGames] = useState(false)

  // Delete confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmForId, setConfirmForId] = useState<string | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=' + encodeURIComponent('/notifications'))
        return
      }
      setMe({ id: user.id })
      setLoading(false)
    })()
  }, [router])

  useEffect(() => {
    if (!me) return
    void loadNotifications()
    void loadHostedGames()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  async function loadNotifications() {
    setLoadingNotes(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', me!.id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setNotes((data || []) as Notification[])
    } finally {
      setLoadingNotes(false)
    }
  }

  async function loadHostedGames() {
    setLoadingGames(true)
    try {
      const { data: gameRows, error } = await supabase
        .from('games')
        .select('id, host_id, title, system, poster_url, scheduled_at, status')
        .eq('host_id', me!.id)
        .order('scheduled_at', { ascending: true })
        .limit(200)
      if (error) throw error
      const gs = (gameRows || []) as Game[]
      setGames(gs)

      if (gs.length === 0) {
        setAppCounts({})
        return
      }

      const ids = gs.map(g => g.id)
      const { data: apps, error: appErr } = await supabase
        .from('applications')
        .select('id, listing_id, status')
        .in('listing_id', ids)
      if (appErr) throw appErr

      const counts: Record<string, number> = {}
      ;(apps || []).forEach(a => {
        counts[a.listing_id] = (counts[a.listing_id] ?? 0) + 1
      })
      setAppCounts(counts)
    } finally {
      setLoadingGames(false)
    }
  }

  const markAllRead = async () => {
    if (!me || notes.length === 0) return
    const ids = notes.filter(n => !n.read).map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    await loadNotifications()
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Handle delete icon click
  const handleDeleteClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const skip = typeof window !== 'undefined' && window.localStorage.getItem('notifSkipDeleteConfirm') === '1'
    if (skip) {
      await deleteNotification(id)
      return
    }
    setConfirmForId(id)
    setDontAskAgain(false)
    setConfirmOpen(true)
  }

  // Perform deletion
  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification', err)
    } finally {
      setConfirmOpen(false)
      setConfirmForId(null)
    }
  }

  // Confirm dialog actions
  const confirmDelete = async () => {
    if (!confirmForId) return
    if (dontAskAgain && typeof window !== 'undefined') {
      window.localStorage.setItem('notifSkipDeleteConfirm', '1')
    }
    await deleteNotification(confirmForId)
  }

  const cancelDelete = () => {
    setConfirmOpen(false)
    setConfirmForId(null)
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <div className="flex gap-2">
            <a href="/profile" className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">Back to Profile</a>
          </div>
        </div>

        <div className="mt-4 border-b border-white/10 flex gap-6 text-white/70">
          <button
            onClick={() => setTab('notifications')}
            className={`pb-3 -mb-px ${tab === 'notifications' ? 'text-white border-b-2 border-white' : 'hover:text-white'}`}
          >
            Notifications
          </button>
          <button
            onClick={() => setTab('hosted')}
            className={`pb-3 -mb-px ${tab === 'hosted' ? 'text-white border-b-2 border-white' : 'hover:text-white'}`}
          >
            My Hosted Games
          </button>
        </div>

        {tab === 'notifications' ? (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-white/60 text-sm">
                {loadingNotes ? 'Loading…' : `${notes.length} notification${notes.length === 1 ? '' : 's'}`}
              </div>
              <button onClick={markAllRead} className="text-sm text-white/70 hover:text-white">Mark all as read</button>
            </div>

            <div className="mt-4 grid gap-3">
              {loading || loadingNotes ? (
                [...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl border border-white/10 bg-white/5 animate-pulse" />)
              ) : notes.length === 0 ? (
                <div className="text-white/60 text-sm">No notifications yet.</div>
              ) : (
                notes.map(n => (
                  <article
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(n.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand(n.id)}
                    className={`rounded-xl border ${n.read ? 'border-white/10' : 'border-brand'} bg-zinc-900/60 p-4 cursor-pointer`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{n.title}</h3>
                        <time className="text-xs text-white/50 block">{new Date(n.created_at).toLocaleString()}</time>
                      </div>

                      {/* Delete "X" button */}
                      <button
                        aria-label="Delete notification"
                        title="Delete notification"
                        onClick={(e) => handleDeleteClick(e, n.id)}
                        className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/15 hover:border-white/30 hover:bg-white/5 text-white/70 hover:text-white transition"
                      >
                        ×
                      </button>
                    </div>

                    {n.body ? <p className="text-sm text-white/70 mt-2">{n.body}</p> : null}

                    {/* Quick action link */}
                    {n.data?.game_id ? (
                      <div className="mt-2">
                        <a
                          href={`/lobbies/${n.data.game_id}`}
                          className="text-sm text-brand hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open game
                        </a>
                      </div>
                    ) : null}

                    {/* Details panel toggled by clicking the notification */}
                    {expanded.has(n.id) && (
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
                        <div>
                          <span className="text-white/60">Discord: </span>
                          {n.data?.discord_link ? (
                            <a
                              href={n.data.discord_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:opacity-80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Join Discord
                            </a>
                          ) : (
                            <span className="text-white/40">Not provided</span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className="text-white/60">VTT: </span>
                          {n.data?.vtt_link ? (
                            <a
                              href={n.data.vtt_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:opacity-80 break-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open VTT
                            </a>
                          ) : (
                            <span className="text-white/40">Not provided</span>
                          )}
                        </div>

                        {n.data?.game_id && (
                          <div className="mt-3">
                            <a
                              href={`/lobbies/${n.data.game_id}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand hover:bg-brandHover"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open game
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="mt-6">
            <div className="text-white/60 text-sm">
              {loadingGames ? 'Loading…' : `${games.length} game${games.length === 1 ? '' : 's'}`}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {loading || loadingGames ? (
                [...Array(6)].map((_, i) => <div key={i} className="h-52 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />)
              ) : games.length === 0 ? (
                <div className="text-white/60 text-sm">You’re not hosting any games yet.</div>
              ) : (
                games.map(g => (
                  <div key={g.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
                    <a href={`/dm/games/${g.id}/apps`} className="block">
                      <img src={g.poster_url || '/game-poster-fallback.jpg'} alt={g.title || 'Game'} className="h-40 w-full object-cover" />
                    </a>
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <a href={`/dm/games/${g.id}/apps`} className="text-base font-semibold truncate hover:underline">
                          {g.title || 'Untitled game'}
                        </a>
                        <span className="text-xs px-2 py-0.5 rounded-lg border border-white/20 text-white/70">
                          {g.status}
                        </span>
                      </div>
                      <div className="text-sm text-white/70 mt-0.5">
                        {g.system || 'TTRPG'} {g.scheduled_at ? `• ${new Date(g.scheduled_at).toLocaleString()}` : ''}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs rounded-lg bg-brand/20 text-brand px-2 py-0.5">
                          {appCounts[g.id] ?? 0} application{(appCounts[g.id] ?? 0) === 1 ? '' : 's'}
                        </span>
                        <a href={`/dm/games/${g.id}/apps`} className="text-sm px-3 py-1.5 rounded-lg bg-brand hover:bg-brandHover">
                          Review apps
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-black/60" onClick={cancelDelete} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/15 bg-zinc-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">Delete notification?</h2>
            <p className="text-sm text-white/70 mt-1">
              Are you sure you want to delete your notification?
            </p>

            <label className="mt-4 flex items-center gap-2 text-sm select-none">
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="accent-blue-500"
              />
              <span>Don’t show again</span>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="px-3 py-1.5 rounded-lg border border-white/15 hover:border-white/30"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
