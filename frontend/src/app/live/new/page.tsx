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
}

const SYSTEMS = [
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
]

export default function LiveHostSetup() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState<NewRoom>({
    title: '',
    system: 'D&D 5e (2014)',
    vibe: '',
    seats: 5,
    length_min: 120,
    welcomes_new: true,
    is_mature: false,
    discord_url: '',
    game_url: '',
    poster_url: ''
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

      // Preview immediately
      const reader = new FileReader()
      reader.onload = () => setLocalPosterPreview(reader.result as string)
      reader.readAsDataURL(file)

      // Ensure we have the current user (RLS requires auth.uid())
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw authErr || new Error('Sign in required to upload')

      // IMPORTANT: path must start with the user's UUID to satisfy "own folder" policy
      const safeName = file.name.replace(/\s+/g, '-')
      const ext = (safeName.split('.').pop() || 'jpg').toLowerCase()
      const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabase.storage
        .from('posters') // bucket must exist and be public
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '3600',
          contentType: file.type || 'application/octet-stream',
        })

      if (error) throw error

      const { data: pub } = supabase.storage.from('posters').getPublicUrl(data.path)
      onChange('poster_url', pub?.publicUrl || null)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to upload image (check Storage bucket "posters" and RLS policies)')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function startLobby() {
    if (!userId) return
    setSubmitting(true)
    setErrorMsg(null)
    const roomId = crypto.randomUUID()

    // Try to publish a discoverable room row (optional but recommended)
    // Requires a table public.live_rooms with RLS allowing the owner to insert/update.
    try {
      const { error } = await supabase.from('live_rooms').upsert({
        id: roomId,
        host_id: userId,
        title: form.title || 'Untitled live game',
        system: form.system,
        vibe: form.vibe || null,
        seats: form.seats,
        length_min: form.length_min,
        welcomes_new: form.welcomes_new,
        is_mature: form.is_mature,
        discord_url: form.discord_url || null,
        game_url: form.game_url || null,
        poster_url: form.poster_url || null,
        status: 'open'
      }, { onConflict: 'id' })
      if (error) {
        console.warn('live_rooms upsert error:', error.message)
      }
    } catch (e: any) {
      console.warn('live_rooms upsert failed:', e?.message)
    } finally {
      setSubmitting(false)
      // Navigate to the actual live room; pass host=1 to show host controls
      router.push(`/live/${roomId}?host=1`)
    }
  }

  // Helper for displaying/storing hours
  const lengthHours = Math.max(0.5, (form.length_min || 0) / 60)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-white">
      <TopBanner />
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
                onClick={() => { onChange('poster_url', ''); setLocalPosterPreview(null) }}
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
              <input
                type="number" min={0.5} step={0.5}
                value={lengthHours}
                onChange={(e) => {
                  const hours = Math.max(0.5, Number(e.target.value || 0))
                  onChange('length_min', Math.round(hours * 60))
                }}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
              />
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
                placeholder="https://discord.gg/…"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="mb-1 text-white/70">VTT / Game link (optional)</div>
              <input
                value={form.game_url || ''}
                onChange={(e) => onChange('game_url', e.target.value)}
                placeholder="Roll20/Foundry/Alchemy link…"
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

