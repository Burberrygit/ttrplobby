// File: frontend/src/app/lobbies/live/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { startLiveGame } from '@/lib/live'

const SYSTEMS = [
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
]

const TIMEZONES = [
  'America/Toronto','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome',
  'Asia/Tokyo','Asia/Seoul','Asia/Shanghai','Asia/Singapore','Asia/Kolkata',
  'Australia/Sydney','UTC'
]

export default function NewLiveLobby() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [title, setTitle] = useState('Pick-up one-shot')
  const [system, setSystem] = useState(SYSTEMS[0])
  const [seats, setSeats] = useState(5)
  const [vibe, setVibe] = useState('Beginner friendly')
  const [tz, setTz] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
  })
  const [discord, setDiscord] = useState('')
  const [external, setExternal] = useState('')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent('/lobbies/live/new')}`)
        return
      }
      setAuthChecked(true)
    })()
  }, [router])

  useEffect(() => {
    return () => {
      if (posterPreview) URL.revokeObjectURL(posterPreview)
    }
  }, [posterPreview])

  function onPickPoster(file?: File | null) {
    if (posterPreview) URL.revokeObjectURL(posterPreview)
    if (!file) { setPosterFile(null); setPosterPreview(''); return }
    const MAX_MB = 5
    if (!file.type.startsWith('image/')) { setErrorMsg('Please select an image file.'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setErrorMsg(`Image must be under ${MAX_MB} MB.`); return }
    setErrorMsg(null); setPosterFile(file); setPosterPreview(URL.createObjectURL(file))
  }

  async function onStart(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true); setErrorMsg(null)
      const id = await startLiveGame({
        title,
        system,
        seats,
        vibe,
        time_zone: tz,
        discord_url: discord || null,
        external_url: external || null,
        poster_file: posterFile || undefined,
      })
      router.push(`/lobbies/${id}/live`)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to start lobby')
    } finally {
      setSaving(false)
    }
  }

  if (!authChecked) {
    return <Shell><TopBanner /><div className="rounded-3xl border border-white/10 bg-white/5 h-48 animate-pulse" /></Shell>
  }

  return (
    <Shell>
      <TopBanner />
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8 text-white">
        <h1 className="text-2xl font-bold">Start live game</h1>
        <p className="text-white/70 mt-1">Create a lobby that others can join right now. You’ll land in a pre-game lobby with chat and presence.</p>

        {errorMsg && <div className="mt-4 text-sm text-red-400">{errorMsg}</div>}

        <form onSubmit={onStart} className="grid md:grid-cols-2 gap-4 mt-6">
          {/* Poster */}
          <div className="md:col-span-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Poster image</span>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-4">
                  <div className="h-28 w-48 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                    {posterPreview ? <img src={posterPreview} alt="Preview" className="h-full w-full object-cover" /> : <span className="text-white/50 text-xs">No image</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickPoster(e.target.files?.[0] || null)} />
                      Choose image…
                    </label>
                    {posterPreview && (
                      <button type="button" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40" onClick={() => onPickPoster(null)}>
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
            <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={title} onChange={e=>setTitle(e.target.value)} required />
          </Field>

          <Field label="System">
            <select className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={system} onChange={e=>setSystem(e.target.value)}>
              {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Seats">
            <input type="number" min={1} max={10} className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={seats} onChange={e=>setSeats(parseInt(e.target.value || '1', 10))} />
          </Field>

          <Field label="Vibe (short line)">
            <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={vibe} onChange={e=>setVibe(e.target.value)} placeholder="Casual, rules-light, beginner friendly" />
          </Field>

          <Field label="Time zone">
            <select className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={tz} onChange={e=>setTz(e.target.value)}>
              {[...new Set([tz, ...TIMEZONES])].map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>

          <Field label="Discord link (optional)">
            <input type="url" placeholder="https://discord.gg/..." className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={discord} onChange={e=>setDiscord(e.target.value)} />
          </Field>

          <Field label="Game link (VTT) (optional)">
            <input type="url" placeholder="e.g. Roll20/Foundry link" className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={external} onChange={e=>setExternal(e.target.value)} />
          </Field>

          <div className="md:col-span-2 flex items-center gap-2">
            <button disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60">
              {saving ? 'Starting…' : 'Start lobby'}
            </button>
            <a href="/profile" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Cancel</a>
          </div>
        </form>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-4xl mx-auto px-4 py-8 text-white">{children}</div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="text-white/70">{label}</span>{children}</label>
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

