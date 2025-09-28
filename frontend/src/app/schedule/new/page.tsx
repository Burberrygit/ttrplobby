// File: frontend/src/app/schedule/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { createGame } from '@/lib/games'

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
      const id = await createGame({
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
      })
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
        {/* Wrapper positions the buttons OUTSIDE the card but visually over the corners */}
        <div className="relative w-full max-w-[1200px] mx-auto">
          {/* Corner buttons (outside the card) */}
          <a
            href="/"
            aria-label="Go to ttrplobby"
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 backdrop-blur px-4 py-2 text-sm hover:border-white/30 transition"
          >
            <LogoIcon /><span className="font-semibold">ttrplobby</span>
          </a>
          <a
            href="/profile"
            aria-label="Go to profile"
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 backdrop-blur px-4 py-2 text-sm hover:border-white/30 transition"
          >
            Profile
          </a>

          {/* Wide, centered card */}
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8">
            <h1 className="text-2xl font-bold pt-14">Post a new game</h1>
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

              {/* Length in HOURS */}
              <Field label="Length (Hours)">
                <input
                  type="number" min={0.5} max={8} step={0.5}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={lengthHours}
                  onChange={e=>setLengthHours(parseFloat(e.target.value || '2'))}
                />
              </Field>

              <Field label="Vibe (short description)">
                <input
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                  value={vibe}
                  onChange={e=>setVibe(e.target.value)}
                  placeholder="Casual, rules-light, beginner friendly"
                />
              </Field>

              <Field label="New players welcome?">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand" checked={welcomesNew} onChange={e=>setWelcomesNew(e.target.checked)} />
                  <span>Yes</span>
                </label>
              </Field>

              <Field label="18+ content?">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand" checked={isMature} onChange={e=>setIsMature(e.target.checked)} />
                  <span>Yes</span>
                </label>
              </Field>

              {/* Description: between 18+ and the buttons */}
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

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

