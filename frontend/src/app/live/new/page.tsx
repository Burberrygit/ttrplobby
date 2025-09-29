// File: frontend/src/app/live/new/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type NewRoom = {
  title: string
  system: string
  vibe: string
  seats: number
  length_min: number
  welcomes_new: boolean
  is_mature: boolean
  discord_url?: string | null
  game_url?: string | null
  poster_url?: string | null
  poster_storage_path?: string | null
}

const SYSTEMS = [
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
]

/* Normalize user-provided external links */
function normalizeExternalUrl(u?: string | null): string | null {
  if (!u) return null
  const s = u.trim()
  if (!s) return null
  if (/^[a-z]+:\/\//i.test(s)) return s
  if (s.startsWith('//')) return 'https:' + s
  return 'https://' + s.replace(/^\/*/, '')
}

export default function LiveHostSetup() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState<NewRoom>({
    title: '',
    system: 'D&D 5e (2014)',
    vibe: '',
    seats: 6,            // aligns with live_games.max_players default we use below
    length_min: 120,     // exact minutes used by quick-join
    welcomes_new: true,
    is_mature: false,
    discord_url: '',
    game_url: '',
    poster_url: '',
    poster_storage_path: ''
  })

  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // File upload
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [localPosterPreview, setLocalPosterPreview] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent('/live/new')}`)
      } else {
        setUserId(data.user.id)
      }
    })
  }, [router])

  function onChange<K extends keyof NewRoom>(k: K, v: NewRoom[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      setErrorMsg(null)

      // Preview
      const reader = new FileReader()
      reader.onload = () => setLocalPosterPreview(reader.result as string)
      reader.readAsDataURL(file)

      // Ensure we have a user id (RLS requires owner/auth.uid())
      let uid = userId
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser()
        uid = user?.id ?? null
        setUserId(uid)
      }
      if (!uid) throw new Error('Not signed in')

      // 🔐 Upload to user-scoped path to satisfy Storage RLS
      const safeName = file.name.replace(/\s+/g, '-')
      const fn = `${uid}/live/${Date.now()}-${safeName}`

      const { data, error } = await supabase.storage
        .from('posters')
        .upload(fn, file, {
          upsert: false,
          cacheControl: '3600',
          contentType: file.type || 'image/*',
        })
      if (error) throw error

      // Get public URL + remember storage key (for later deletion)
      const storagePath = data.path ?? fn
      const { data: pub } = supabase.storage.from('posters').getPublicUrl(storagePath)
      onChange('poster_url', pub.publicUrl)
      onChange('poster_storage_path', storagePath)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to upload image (check Storage bucket "posters").')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function startLobby() {
    if (!userId) return
    setSubmitting(true)
    setErrorMsg(null)

    // Normalize links before saving (not stored in live_games, but kept for future)
    const discordUrl = normalizeExternalUrl(form.discord_url || undefined)
    const gameUrl = normalizeExternalUrl(form.game_url || undefined)
    void discordUrl; void gameUrl;

    try {
      // 👉 Write to live_games so quick-join can find it (tight, exact values)
      const { data, error } = await supabase
        .from('live_games')
        .insert({
          host_id: userId,
          status: 'open',
          system: form.system,
          new_player_friendly: form.welcomes_new,
          is_18_plus: form.is_mature,
          length_minutes: form.length_min,
          max_players: Math.max(1, Math.min(10, form.seats)),
          is_private: false, // quick-join only matches public games
        })
        .select('id')
        .single()

      if (error) {
        console.warn('live_games insert error:', error.message)
        setErrorMsg(error.message || 'Could not start lobby.')
        return
      }

      // Navigate to the live game page
      const gameId = data?.id as string | undefined
      if (gameId) {
        router.push(`/live/${gameId}?host=1`)
      } else {
        setErrorMsg('Lobby created but no id returned.')
      }
    } catch (e: any) {
      console.warn('live_games insert failed:', e?.message)
      setErrorMsg(e?.message || 'Failed to create lobby.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col text-white">
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <HeaderBar />

          <h1 className="text-2xl font-bold">Start a live game</h1>
          <p className="text-white/70 mt-1">Spin up a lobby right now. Players can find and join instantly.</p>

          <div className="mt-6 grid md:grid-cols-[280px,1fr] gap-4">
            {/* Poster picker */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <div className="text-sm font-medium mb-2">Poster image</div>
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {localPosterPreview || form.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={localPosterPreview || form.poster_url!} alt="Poster" className="w-full h-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-white/50 text-sm">
                    No image selected
                  </div>
                )}
              </div>
              <div className="mt-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" id="posterInput" />
                <label
                  htmlFor="posterInput"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 cursor-pointer"
                >
                  {uploading ? 'Uploading…' : 'Choose image'}
                </label>
                {form.poster_url && (
                  <button
                    className="ml-2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
                    onClick={() => { onChange('poster_url', ''); onChange('poster_storage_path', ''); setLocalPosterPreview(null) }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="mb-1 text-white/70">Title</div>
                  <input
                    value={form.title}
                    onChange={(e) => onChange('title', e.target.value)}
                    placeholder="e.g., Beginner one-shot"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-white/70">System</div>
                  <select
                    value={form.system}
                    onChange={(e) => onChange('system', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  >
                    {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                <label className="text-sm md:col-span-2">
                  <div className="mb-1 text-white/70">Vibe (optional)</div>
                  <input
                    value={form.vibe}
                    onChange={(e) => onChange('vibe', e.target.value)}
                    placeholder="Casual, spooky one-shot, rules-light…"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 text-white/70">Seats</div>
                  <input
                    type="number" min={1} max={10}
                    value={form.seats}
                    onChange={(e) => onChange('seats', Math.max(1, Math.min(10, Number(e.target.value || 0))))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1 text-white/70">Length (Hours)</div>
                  <select
                    value={(form.length_min).toString()}
                    onChange={(e) => onChange('length_min', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  >
                    {/* enforce canonical lengths */}
                    <option value={60}>1.0</option>
                    <option value={90}>1.5</option>
                    <option value={120}>2.0</option>
                    <option value={180}>3.0</option>
                  </select>
                </label>

                <div className="text-sm flex items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.welcomes_new}
                      onChange={(e) => onChange('welcomes_new', e.target.checked)}
                      className="accent-[#29e0e3]"
                    />
                    Welcomes new players
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.is_mature}
                      onChange={(e) => onChange('is_mature', e.target.checked)}
                      className="accent-[#29e0e3]"
                    />
                    18+ content
                  </label>
                </div>

                <label className="text-sm md:col-span-2">
                  <div className="mb-1 text-white/70">Discord link (optional)</div>
                  <input
                    value={form.discord_url || ''}
                    onChange={(e) => onChange('discord_url', e.target.value)}
                    placeholder="discord.gg/your-invite or https://discord.gg/…"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <div className="mb-1 text-white/70">VTT / Game link (optional)</div>
                  <input
                    value={form.game_url || ''}
                    onChange={(e) => onChange('game_url', e.target.value)}
                    placeholder="fvtt.life or https://your-vtt.example.com/…"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                  />
                </label>
              </div>

              {errorMsg && <div className="text-sm text-red-400 mt-3">{errorMsg}</div>}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={startLobby}
                  disabled={submitting || !userId}
                  className="px-4 py-2 rounded-lg bg-[#29e0e3] hover:bg-[#22c8cb] font-medium disabled:opacity-60"
                >
                  {submitting ? 'Starting…' : 'Start lobby'}
                </button>
                <a href="/profile" className="px-4 py-2 rounded-lg border border-white/20 hover:border-white/40">Cancel</a>
              </div>
            </div>
          </div>
        </div>
      </main>

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

function HeaderBar() {
  return (
    <div className="mb-4 flex items-center justify-between">
      <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
        <LogoIcon /><span className="font-semibold">ttrplobby</span>
      </a>
      <a href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
        Profile
      </a>
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
