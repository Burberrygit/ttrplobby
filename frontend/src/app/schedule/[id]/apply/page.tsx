'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Game = {
  id: string
  title: string | null
  system: string | null
  poster_url: string | null
  scheduled_at: string | null
  seats: number | null
  welcomes_new: boolean | null
  is_mature: boolean | null
  time_zone?: string | null
}

export default function ApplyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // Quick-apply form state (core pack)
  const [timezone, setTimezone] = useState<string>('')
  const [experience, setExperience] = useState<string>('New to system')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    (async () => {
      try {
        // pull a couple extra fields to help scoring
        const { data, error } = await supabase
          .from('games')
          .select('id,title,system,poster_url,scheduled_at,seats,welcomes_new,is_mature,time_zone')
          .eq('id', id)
          .single()
        if (error) throw error
        setGame(data as Game)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Game not found')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function computeFit(g: Game, opts: { timezone: string; experience: string }): number {
    let score = 0

    // ---- Experience (0–70)
    const exp = (opts.experience || '').toLowerCase()
    if (exp.includes('very')) score += 65
    else if (exp.includes('some')) score += 50
    else {
      score += g.welcomes_new ? 45 : 35
      if (g.welcomes_new) score += 5
    }

    // ---- Time zone (0–30)
    const gtz = (g.time_zone || '').trim().toLowerCase()
    const ptz = (opts.timezone || '').trim().toLowerCase()
    if (gtz && ptz) {
      score += gtz === ptz ? 30 : 15
    } else if (ptz) {
      score += 12
    } else {
      score += 8
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setErrorMsg(null); setOkMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/schedule/${id}/apply`)}`)
        return
      }
      if (!game) throw new Error('Game not loaded')

      const fit_score = computeFit(game, { timezone, experience })

      const payload = {
        listing_id: id,
        player_id: user.id,
        status: 'under_review',
        fit_score,
        answers: {
          timezone,
          experience,
          notes,
        },
      }

      const { error } = await supabase.from('applications').insert(payload)
      if (error) throw error

      setOkMsg('Application submitted! The GM will review it soon.')
      setTimeout(() => router.push('/schedule'), 1200)
    } catch (e: any) {
      setErrorMsg(
        e?.message?.includes('relation "applications" does not exist')
          ? 'Applications table not found. Create it in Supabase and try again.'
          : (e?.message || 'Failed to submit application')
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-white/70">
        Loading…
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen grid place-items-center text-red-300">
        {errorMsg || 'Game not found'}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      {/* Top bar: ttrplobby button (left) and Back to search (right) */}
      <div className="px-4 pt-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
          >
            <LogoIcon />
            <span className="font-semibold">ttrplobby</span>
          </a>
          <a href="/schedule" className="text-white/70 hover:text-white">&larr; Back to search</a>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="mt-2 rounded-2xl border border-white/10 overflow-hidden">
            <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${game.poster_url || '/game-poster-fallback.jpg'})` }} />
            <div className="p-5 bg-zinc-900/80">
              <h1 className="text-2xl font-bold">{game.title || 'Untitled game'}</h1>
              <div className="text-white/60">{game.system || 'TTRPG'}</div>

              <form onSubmit={onSubmit} className="mt-5 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-white/70">Your time zone</span>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g., America/Toronto"
                    className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                    required
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-white/70">Experience with this system</span>
                  <select
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  >
                    <option>New to system</option>
                    <option>Some experience</option>
                    <option>Very experienced</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-white/70">Notes (character concept, availability, safety prefs)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={10}
                    className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                    placeholder="Tell the GM what you’re hoping for from this table…"
                  />
                </label>

                {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}
                {okMsg && <div className="text-sm text-emerald-400">{okMsg}</div>}

                <div className="flex items-center gap-3">
                  <button
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit application'}
                  </button>
                  <a href="/schedule" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Cancel</a>
                </div>
              </form>
            </div>
          </div>

          <p className="mt-6 text-sm text-white/60">
            By applying, you agree to follow our community rules and the GM’s table rules.
          </p>
        </div>
      </main>

      {/* Pinned footer */}
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

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

