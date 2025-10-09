// File: frontend/src/app/schedule/[id]/apply/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
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
  status?: string | null
  length_min?: number | null
  description?: string | null
  vibe?: string | null
}

export default function ApplyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // Auth gate state
  const [authReady, setAuthReady] = useState(false)

  // Form state
  const [timezone, setTimezone] = useState<string>('__auto__')
  const [autoAbbr, setAutoAbbr] = useState<string>('') // e.g., EDT
  const [experience, setExperience] = useState<string>('New to system')
  const [notes, setNotes] = useState<string>('')

  // ---------- AUTH GUARD WITH RETRIES (prevents /login <-> /apply loop) ----------
  useEffect(() => {
    let cancelled = false
    let tries = 0

    // If we just came from /login or /auth/callback, give the browser a beat to write the session
    const ref = typeof document !== 'undefined' ? document.referrer : ''
    const cameFromLogin = ref.includes('/login') || ref.includes('/auth/callback')
    const maxTries = cameFromLogin ? 15 : 10        // a little more patience if returning from login/callback
    const intervalMs = cameFromLogin ? 150 : 120

    async function probeAuth() {
      if (cancelled) return

      try {
        const [{ data: userData }, { data: sessionData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ])

        const user = userData?.user ?? sessionData?.session?.user ?? null
        if (user) {
          setAuthReady(true)
          return
        }
      } catch {
        // ignore and retry
      }

      tries += 1
      if (tries < maxTries) {
        setTimeout(probeAuth, intervalMs)
      } else {
        // truly not logged in → go to /login with next
        const nextPath = `/schedule/${id}/apply`
        const loginUrl = `/login?next=${encodeURIComponent(nextPath)}`
        // Prefer soft nav, but force a hard nav as a fallback
        try { router.replace(loginUrl) } catch {}
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            if (!location.pathname.startsWith('/login')) location.assign(loginUrl)
          }, 50)
        }
      }
    }

    probeAuth()
    return () => { cancelled = true }
  }, [id, router])

  // ---------- LOAD GAME (after auth is ready or in parallel is fine) ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select<Game>('id,title,system,poster_url,scheduled_at,seats,welcomes_new,is_mature,time_zone,status,length_min,description,vibe')
          .eq('id', id)
          .single()
        if (cancelled) return
        if (error) throw error
        setGame(data)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Game not found')
      } finally {
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // ---------- Time zone helpers ----------
  useEffect(() => {
    try {
      const ab = getAbbrForIana(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') || 'UTC'
      setAutoAbbr(ab)
    } catch {
      setAutoAbbr('UTC')
    }
  }, [])

  const ABBR_TO_OFFSET: Record<string, number> = {
    UTC: 0, GMT: 0,
    NST: -210, NDT: -150, AST: -240, ADT: -180, EST: -300, EDT: -240, CST: -360, CDT: -300,
    MST: -420, MDT: -360, PST: -480, PDT: -420, AKST: -540, AKDT: -480, HST: -600,
    WET: 0, WEST: 60, CET: 60, CEST: 120, EET: 120, EEST: 180, MSK: 180,
    SAST: 120, EAT: 180, IRST: 210, IRDT: 270, GST: 240,
    IST: 330, PKT: 300, BST: 360, ICT: 420, WIB: 420, MYT: 480, SGT: 480, HKT: 480, CSTCN: 480,
    JST: 540, KST: 540, AWST: 480, ACST: 570, ACDT: 630, AEST: 600, AEDT: 660, NZST: 720, NZDT: 780,
  }

  const TZ_GROUPS: { label: string; options: { value: string; label: string }[] }[] = useMemo(() => ([
    {
      label: 'Auto',
      options: [{ value: '__auto__', label: `Auto-detect${autoAbbr ? ` (${autoAbbr})` : ''}` }],
    },
    {
      label: 'UTC / GMT',
      options: [
        { value: 'UTC', label: 'UTC (±0)' },
        { value: 'GMT', label: 'GMT (±0)' },
        { value: 'UTC-12:00', label: 'UTC-12:00' },
        { value: 'UTC-11:00', label: 'UTC-11:00' },
        { value: 'UTC-10:00', label: 'UTC-10:00 (HST)' },
        { value: 'UTC-09:00', label: 'UTC-09:00 (AKST)' },
        { value: 'UTC-08:00', label: 'UTC-08:00 (PST)' },
        { value: 'UTC-07:00', label: 'UTC-07:00 (MST/PDT)' },
        { value: 'UTC-06:00', label: 'UTC-06:00 (CST/MDT)' },
        { value: 'UTC-05:00', label: 'UTC-05:00 (EST/CDT)' },
        { value: 'UTC-04:00', label: 'UTC-04:00 (AST/EDT)' },
        { value: 'UTC-03:00', label: 'UTC-03:00' },
        { value: 'UTC-02:00', label: 'UTC-02:00' },
        { value: 'UTC-01:00', label: 'UTC-01:00' },
        { value: 'UTC+00:00', label: 'UTC+00:00 (WET)' },
        { value: 'UTC+01:00', label: 'UTC+01:00 (CET/WEST)' },
        { value: 'UTC+02:00', label: 'UTC+02:00 (EET/CEST)' },
        { value: 'UTC+03:00', label: 'UTC+03:00 (MSK/EEST)' },
        { value: 'UTC+03:30', label: 'UTC+03:30 (IRST)' },
        { value: 'UTC+04:00', label: 'UTC+04:00 (GST)' },
        { value: 'UTC+05:00', label: 'UTC+05:00 (PKT)' },
        { value: 'UTC+05:30', label: 'UTC+05:30 (IST India)' },
        { value: 'UTC+06:00', label: 'UTC+06:00 (BST Bangladesh)' },
        { value: 'UTC+07:00', label: 'UTC+07:00 (ICT)' },
        { value: 'UTC+08:00', label: 'UTC+08:00 (SGT/HKT/China)' },
        { value: 'UTC+09:00', label: 'UTC+09:00 (JST/KST)' },
        { value: 'UTC+09:30', label: 'UTC+09:30 (ACST)' },
        { value: 'UTC+10:00', label: 'UTC+10:00 (AEST)' },
        { value: 'UTC+11:00', label: 'UTC+11:00 (AEDT)' },
        { value: 'UTC+12:00', label: 'UTC+12:00 (NZST)' },
        { value: 'UTC+13:00', label: 'UTC+13:00 (NZDT)' },
      ],
    },
    {
      label: 'North America (abbr)',
      options: [
        { value: 'EST', label: 'EST (UTC-5)' }, { value: 'EDT', label: 'EDT (UTC-4)' },
        { value: 'CST', label: 'CST (UTC-6)' }, { value: 'CDT', label: 'CDT (UTC-5)' },
        { value: 'MST', label: 'MST (UTC-7)' }, { value: 'MDT', label: 'MDT (UTC-6)' },
        { value: 'PST', label: 'PST (UTC-8)' }, { value: 'PDT', label: 'PDT (UTC-7)' },
        { value: 'AKST', label: 'AKST (UTC-9)' }, { value: 'AKDT', label: 'AKDT (UTC-8)' },
        { value: 'HST', label: 'HST (UTC-10)' }, { value: 'AST', label: 'AST (UTC-4)' },
        { value: 'ADT', label: 'ADT (UTC-3)' }, { value: 'NST', label: 'NST (UTC-3:30)' },
        { value: 'NDT', label: 'NDT (UTC-2:30)' },
      ],
    },
    {
      label: 'Europe (abbr)',
      options: [
        { value: 'WET', label: 'WET (UTC+0)' }, { value: 'WEST', label: 'WEST (UTC+1)' },
        { value: 'CET', label: 'CET (UTC+1)' }, { value: 'CEST', label: 'CEST (UTC+2)' },
        { value: 'EET', label: 'EET (UTC+2)' }, { value: 'EEST', label: 'EEST (UTC+3)' },
        { value: 'MSK', label: 'MSK (UTC+3)' },
      ],
    },
    {
      label: 'Asia / Pacific (abbr)',
      options: [
        { value: 'PKT', label: 'PKT (UTC+5)' }, { value: 'IST', label: 'IST — India (UTC+5:30)' },
        { value: 'BST', label: 'BST — Bangladesh (UTC+6)' }, { value: 'ICT', label: 'ICT (UTC+7)' },
        { value: 'SGT', label: 'SGT — Singapore (UTC+8)' }, { value: 'HKT', label: 'HKT — Hong Kong (UTC+8)' },
        { value: 'CSTCN', label: 'CST — China (UTC+8)' }, { value: 'JST', label: 'JST (UTC+9)' },
        { value: 'KST', label: 'KST (UTC+9)' }, { value: 'AWST', label: 'AWST (UTC+8)' },
        { value: 'ACST', label: 'ACST (UTC+9:30)' }, { value: 'ACDT', label: 'ACDT (UTC+10:30)' },
        { value: 'AEST', label: 'AEST (UTC+10)' }, { value: 'AEDT', label: 'AEDT (UTC+11)' },
        { value: 'NZST', label: 'NZST (UTC+12)' }, { value: 'NZDT', label: 'NZDT (UTC+13)' },
      ],
    },
  ]), [autoAbbr])

  function parseUtcOffsetLabel(val: string): number | null {
    const m = /^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(val)
    if (!m) return null
    const sign = m[1] === '-' ? -1 : 1
    const hh = parseInt(m[2], 10)
    const mm = m[3] ? parseInt(m[3], 10) : 0
    return sign * (hh * 60 + mm)
  }

  function offsetMinutesForIana(iana: string): number {
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' })
    const parts = fmt.formatToParts(now)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC'
    const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(tzName)
    if (m) {
      const sign = m[1] === '-' ? -1 : 1
      const hh = parseInt(m[2], 10)
      const mm = m[3] ? parseInt(m[3], 10) : 0
      return sign * (hh * 60 + mm)
    }
    const utc = now.getTime()
    const zoned = new Date(now.toLocaleString('en-US', { timeZone: iana }))
    return Math.round((zoned.getTime() - utc) / (60 * 1000))
  }

  function getAbbrForIana(iana: string): string | null {
    try {
      const s = new Date().toLocaleTimeString('en-US', { timeZone: iana, timeZoneName: 'short' })
      const parts = s.split(' ')
      return parts[parts.length - 1] || null
    } catch {
      return null
    }
  }

  function offsetFromSelection(sel: string): number {
    if (sel === '__auto__') {
      try {
        const iana = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        return offsetMinutesForIana(iana)
      } catch { return 0 }
    }
    const utcParsed = parseUtcOffsetLabel(sel)
    if (utcParsed !== null) return utcParsed
    if (sel in ABBR_TO_OFFSET) return ABBR_TO_OFFSET[sel]
    try { return offsetMinutesForIana(sel) } catch { return 0 }
  }

  function computeFit(g: Game, opts: { tzSel: string; experience: string }): number {
    let score = 0
    const exp = (opts.experience || '').toLowerCase()
    if (exp.includes('very')) score += 65
    else if (exp.includes('some')) score += 50
    else { score += g.welcomes_new ? 50 : 35 }
    const playerOffset = offsetFromSelection(opts.tzSel)
    let gameOffset = 0
    if (g.time_zone) {
      const maybeUtc = parseUtcOffsetLabel(g.time_zone.toUpperCase())
      if (maybeUtc !== null) gameOffset = maybeUtc
      else if (g.time_zone.toUpperCase() in ABBR_TO_OFFSET) gameOffset = ABBR_TO_OFFSET[g.time_zone.toUpperCase()]
      else { try { gameOffset = offsetMinutesForIana(g.time_zone) } catch { gameOffset = 0 } }
    }
    const diff = Math.abs(playerOffset - gameOffset)
    if (diff <= 0) score += 30
    else if (diff <= 60) score += 22
    else if (diff <= 120) score += 15
    else score += 10
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setErrorMsg(null); setOkMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const nextPath = `/schedule/${id}/apply`
        router.push(`/login?next=${encodeURIComponent(nextPath)}`)
        return
      }
      if (!game) throw new Error('Game not loaded')

      const fit_score = computeFit(game, { tzSel: timezone, experience })
      const payload = {
        listing_id: id,
        player_id: user.id,
        status: 'under_review',
        fit_score,
        answers: { timezone, autoAbbr, experience, notes },
      }

      const { error } = await supabase.from('applications').insert(payload)
      if (error) throw error

      setOkMsg('Application submitted! The GM will review it soon.')
      setTimeout(() => router.push('/schedule'), 1200)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- UI ----------
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center text-white/80">
        Checking sign-in…
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-white/70">Loading…</div>
  }
  if (!game) {
    return <div className="min-h-screen grid place-items-center text-red-300">{errorMsg || 'Game not found'}</div>
  }

  const lengthText = game.length_min
    ? (game.length_min >= 60 ? `${(game.length_min / 60).toFixed(game.length_min % 60 ? 1 : 0)} h` : `${game.length_min} min`)
    : '—'
  const timeZoneText: string = (game.time_zone ? String(game.time_zone) : '—')
  const description: string = ((game as any)?.description ?? (game as any)?.desc ?? '') as string

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      <div className="px-4 pt-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
            <LogoIcon /><span className="font-semibold">ttrplobby</span>
          </a>
          <a href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
            <span className="font-semibold">Profile</span>
          </a>
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="mt-2 rounded-2xl border border-white/10 overflow-hidden">
            <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${game.poster_url || '/game-poster-fallback.jpg'})` }} />
            <div className="p-5 bg-zinc-900/80">
              <h1 className="text-2xl font-bold">{game.title || 'Untitled game'}</h1>
              <div className="text-white/80">
                {(game.system || 'TTRPG')}{game.vibe ? ` • ${game.vibe}` : ''}
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <Info label="Status" value={titleCase(game.status || 'open')} />
                <Info label="Length" value={lengthText} />
                <Info label="New players" value={game.welcomes_new ? 'Yes' : 'No'} />
                <Info label="18+" value={game.is_mature ? 'Yes' : 'No'} />
                <Info label="Time zone" value={timeZoneText} />
              </div>

              <div className="mt-6">
                <h2 className="text-sm font-semibold">Description</h2>
                <p className="mt-2 text-white/80 whitespace-pre-wrap">
                  {description ? description : 'No description provided yet.'}
                </p>
              </div>

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-white/70">Your time zone</span>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                    required
                  >
                    {TZ_GROUPS.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="text-xs text-white/50 mt-1">
                    Pick an abbreviation (EST, GMT, CET, JST, etc), or use Auto.
                  </div>
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
                  />
                </label>

                {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}
                {okMsg && <div className="text-sm text-emerald-400">{okMsg}</div>}

                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60">
                      {submitting ? 'Submitting…' : 'Submit application'}
                    </button>
                    <a href="/schedule" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Cancel</a>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <p className="mt-6 text-sm text-white/60">
            By applying, you agree to follow our community rules and the GM’s table rules.
          </p>
        </div>
      </main>

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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

