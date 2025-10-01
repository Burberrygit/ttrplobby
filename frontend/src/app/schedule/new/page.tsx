'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { createGame, Game } from '@/lib/games'

export default function NewSchedulePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // form state
  const [title, setTitle] = useState('')
  const [system, setSystem] = useState('D&D 5e (2014)')
  const [seats, setSeats] = useState(5)
  const [lengthHours, setLengthHours] = useState<number>(2) // hours
  const [vibe, setVibe] = useState('Casual one-shot')
  const [welcomesNew, setWelcomesNew] = useState(true)
  const [isMature, setIsMature] = useState(false)
  const [description, setDescription] = useState('') // long description

  // time zone (abbr/UTC) selection
  const [timeZoneSel, setTimeZoneSel] = useState<string>('__auto__')
  const [autoAbbr, setAutoAbbr] = useState<string>('')

  // image upload state
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string>('')

  // control state
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const next = encodeURIComponent('/schedule/new')
        router.replace(`/login?next=${next}`)
        return
      }
      setUserId(user.id)
      setAuthChecked(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detect user’s current zone abbreviation for the Auto option
  useEffect(() => {
    try {
      const iana = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const abbr = getAbbrForIana(iana) || 'UTC'
      setAutoAbbr(abbr)
    } catch {
      setAutoAbbr('UTC')
    }
  }, [])

  function onPickPoster(file?: File | null) {
    if (!file) {
      setPosterFile(null)
      setPosterPreview('')
      return
    }
    const MAX_MB = 5
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMsg(`Image must be under ${MAX_MB} MB.`)
      return
    }
    setErrorMsg(null)
    setPosterFile(file)
    setPosterPreview(URL.createObjectURL(file))
  }

  async function uploadPosterIfNeeded(): Promise<string | null> {
    if (!posterFile || !userId) return null
    const ext = (() => {
      const n = posterFile.name.toLowerCase()
      const maybe = n.includes('.') ? n.split('.').pop()! : ''
      return maybe || 'jpg'
    })()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase
      .storage
      .from('posters')               
      .upload(path, posterFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: posterFile.type || 'image/*',
      })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('posters').getPublicUrl(path)
    return data.publicUrl || null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErrorMsg(null)
    try {
      const poster_url = await uploadPosterIfNeeded()
      const minutes = Math.round((Number.isFinite(lengthHours) ? lengthHours : 2) * 60) // hours → minutes

      // Normalize the zone to save (abbr or UTC±HH:MM). For Auto, store detected abbr (or UTC).
      const time_zone = timeZoneSel === '__auto__' ? (autoAbbr || 'UTC') : timeZoneSel

      // Use an intermediate variable with an extended type to avoid excess property checks
      const payload: Partial<Game> & { time_zone?: string } = {
        title: title || 'Untitled game',
        system,
        poster_url: poster_url ?? null,
        seats,
        length_min: minutes,
        vibe,
        welcomes_new: welcomesNew,
        is_mature: isMature,
        description,               
        status: 'open',
        time_zone,
      }

      const id = await createGame(payload)
      router.push(`/lobbies/${id}`)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to create game')
    } finally {
      setSaving(false)
    }
  }

  if (!authChecked) {
    return (
      <PageShell>
        <div className="text-white/70">Checking sign-in…</div>
      </PageShell>
    )
  }

  return (
    <div className="min-h-screen flex flex-col text-white">
      <PageShell className="flex-1">
        {/* Wrapper positions the buttons OUTSIDE the card; padding-top creates a small gap */}
        <div className="relative w-full max-w-[1200px] mx-auto pt-12">
          {/* Corner buttons (outside, just above the card corners) */}
          <a
            href="/"
            aria-label="Go to ttrplobby"
            className="absolute top-0 left-3 z-20 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 backdrop-blur px-4 py-2 text-sm hover:border-white/30 transition"
          >
            <LogoIcon /><span className="font-semibold">ttrplobby</span>
          </a>
          <a
            href="/profile"
            aria-label="Go to profile"
            className="absolute top-0 right-3 z-20 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 backdrop-blur px-4 py-2 text-sm hover:border-white/30 transition"
          >
            Profile
          </a>

          {/* Card sits below due to wrapper padding, leaving a small gap */}
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8">
            <h1 className="text-2xl font-bold">Post a new game</h1>
            <p className="text-white/60 mt-1">Fill in the details—players can discover and join.</p>

            <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-6 mt-6">
              {/* Poster upload */}
              <div className="md:col-span-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-white/70">Poster image</span>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-28 w-64 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                        {posterPreview ? (
                          <img src={posterPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-white/50 text-xs">No image selected</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => onPickPoster(e.target.files?.[0] || null)}
                          />
                          Choose image…
                        </label>
                        {posterPreview && (
                          <button
                            type="button"
                            className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40"
                            onClick={() => onPickPoster(null)}
                          >
                            Remove
                          </button>
                        )}
                        <div className="text-white/50 text-xs">PNG/JPG/WebP, up to 5MB.</div>
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              <Field label="Title">
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={title}
                  onChange={e=>setTitle(e.target.value)}
                  placeholder="Beginner-friendly one-shot"
                  required
                />
              </Field>

              <Field label="System">
                <select
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={system}
                  onChange={e=>setSystem(e.target.value)}
                >
                  {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Seats">
                <input
                  type="number" min={1} max={10}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={seats}
                  onChange={e=>setSeats(parseInt(e.target.value || '1', 10))}
                />
              </Field>

              {/* Length (Hours) → dropdown 1–8 */}
              <Field label="Length (Hours)">
                <select
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={lengthHours}
                  onChange={e=>setLengthHours(parseInt(e.target.value, 10))}
                >
                  {[1,2,3,4,5,6,7,8].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </Field>

              <Field label="Vibe (short description)">
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={vibe}
                  onChange={e=>setVibe(e.target.value)}
                  placeholder="Casual, rules-light, beginner friendly"
                />
              </Field>

              {/* Time zone — placed parallel to Vibe */}
              <Field label="Time zone">
                <select
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={timeZoneSel}
                  onChange={e=>setTimeZoneSel(e.target.value)}
                >
                  {TZ_GROUPS(autoAbbr).map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="text-xs text-white/50 mt-1">Pick EST, GMT, CET, JST, etc — or use Auto.</span>
              </Field>

              {/* New players + 18+ directly beside each other on one line */}
              <div className="md:col-span-2 flex items-center gap-10">
                <label className="inline-flex items-center gap-2 text-sm">
                  <span className="text-white/70">New players welcome?</span>
                  <input
                    type="checkbox"
                    className="accent-brand"
                    checked={welcomesNew}
                    onChange={e=>setWelcomesNew(e.target.checked)}
                  />
                  <span>Yes</span>
                </label>

                <label className="inline-flex items-center gap-2 text-sm">
                  <span className="text-white/70">18+ content?</span>
                  <input
                    type="checkbox"
                    className="accent-brand"
                    checked={isMature}
                    onChange={e=>setIsMature(e.target.checked)}
                  />
                  <span>Yes</span>
                </label>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-white/70">Description</span>
                  <textarea
                    rows={10}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 min-h-[220px]"
                    value={description}
                    onChange={e=>setDescription(e.target.value)}
                    placeholder="Share a few paragraphs about your game: party level, tone, safety tools, expectations, what players should bring, etc."
                  />
                </label>
              </div>

              {errorMsg && <div className="md:col-span-2 text-sm text-red-400">{errorMsg}</div>}

              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60"
                >
                  {saving ? 'Creating…' : 'Create listing'}
                </button>
                <a href="/schedule" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Cancel</a>
              </div>
            </form>
          </div>
        </div>
      </PageShell>

      {/* Pinned footer */}
      <footer className="border-t border-white/10 px-6">
        <div className="max-w-[1200px] mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
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

/* ------------------------------ layout helpers ----------------------------- */

function PageShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  // Full-bleed shell; let inner wrapper control width
  return <div className={`w-full px-8 py-10 ${className}`}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-white/70">{label}</span>
      {children}
    </label>
  )
}

const SYSTEMS = [
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
]

// Build the dropdown groups (Auto + common abbreviations and UTC offsets)
function TZ_GROUPS(autoAbbr: string) {
  return [
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
        { value: 'EST', label: 'EST (UTC-5)' },
        { value: 'EDT', label: 'EDT (UTC-4)' },
        { value: 'CST', label: 'CST (UTC-6)' },
        { value: 'CDT', label: 'CDT (UTC-5)' },
        { value: 'MST', label: 'MST (UTC-7)' },
        { value: 'MDT', label: 'MDT (UTC-6)' },
        { value: 'PST', label: 'PST (UTC-8)' },
        { value: 'PDT', label: 'PDT (UTC-7)' },
        { value: 'AKST', label: 'AKST (UTC-9)' },
        { value: 'AKDT', label: 'AKDT (UTC-8)' },
        { value: 'HST', label: 'HST (UTC-10)' },
        { value: 'AST', label: 'AST (UTC-4)' },
        { value: 'ADT', label: 'ADT (UTC-3)' },
        { value: 'NST', label: 'NST (UTC-3:30)' },
        { value: 'NDT', label: 'NDT (UTC-2:30)' },
      ],
    },
    {
      label: 'Europe (abbr)',
      options: [
        { value: 'WET', label: 'WET (UTC+0)' },
        { value: 'WEST', label: 'WEST (UTC+1)' },
        { value: 'CET', label: 'CET (UTC+1)' },
        { value: 'CEST', label: 'CEST (UTC+2)' },
        { value: 'EET', label: 'EET (UTC+2)' },
        { value: 'EEST', label: 'EEST (UTC+3)' },
        { value: 'MSK', label: 'MSK (UTC+3)' },
      ],
    },
    {
      label: 'Asia / Pacific (abbr)',
      options: [
        { value: 'PKT', label: 'PKT (UTC+5)' },
        { value: 'IST', label: 'IST — India (UTC+5:30)' },
        { value: 'BST', label: 'BST — Bangladesh (UTC+6)' },
        { value: 'ICT', label: 'ICT (UTC+7)' },
        { value: 'SGT', label: 'SGT — Singapore (UTC+8)' },
        { value: 'HKT', label: 'HKT — Hong Kong (UTC+8)' },
        { value: 'CSTCN', label: 'CST — China (UTC+8)' },
        { value: 'JST', label: 'JST (UTC+9)' },
        { value: 'KST', label: 'KST (UTC+9)' },
        { value: 'AWST', label: 'AWST (UTC+8)' },
        { value: 'ACST', label: 'ACST (UTC+9:30)' },
        { value: 'ACDT', label: 'ACDT (UTC+10:30)' },
        { value: 'AEST', label: 'AEST (UTC+10)' },
        { value: 'AEDT', label: 'AEDT (UTC+11)' },
        { value: 'NZST', label: 'NZST (UTC+12)' },
        { value: 'NZDT', label: 'NZDT (UTC+13)' },
      ],
    },
  ]
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

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

