// File: frontend/src/app/lobbies/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { createGame } from '@/lib/games'

export default function NewLobbyPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)

  // form state
  const [title, setTitle] = useState('')
  const [system, setSystem] = useState('D&D 5e (2014)')
  const [poster, setPoster] = useState('')
  const [seats, setSeats] = useState(5)
  const [lengthMin, setLengthMin] = useState<number>(120)
  const [vibe, setVibe] = useState('Casual one-shot')
  const [welcomesNew, setWelcomesNew] = useState(true)
  const [isMature, setIsMature] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const next = encodeURIComponent('/lobbies/new')
        router.replace(`/login?next=${next}`)
        return
      }
      setAuthChecked(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErrorMsg(null)
    try {
      const id = await createGame({
        title: title || 'Untitled game',
        system,
        poster_url: poster || null,
        seats,
        length_min: lengthMin,
        vibe,
        welcomes_new: welcomesNew,
        is_mature: isMature,
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
    return <Shell><div className="text-white/70">Checking sign-in…</div></Shell>
  }

  return (
    <Shell>
      <TopBanner />
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8 text-white">
        <h1 className="text-2xl font-bold">Start a live game</h1>
        <p className="text-white/60 mt-1">Fill in the basics—players can join instantly.</p>

        <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-4 mt-6">
          <Field label="Title">
            <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                   value={title} onChange={e=>setTitle(e.target.value)} placeholder="Beginner-friendly one-shot" required />
          </Field>
          <Field label="System">
            <select className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                    value={system} onChange={e=>setSystem(e.target.value)}>
              {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Poster image URL (optional)">
            <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                   value={poster} onChange={e=>setPoster(e.target.value)} placeholder="https://…/poster.jpg" />
          </Field>
          <Field label="Seats">
            <input type="number" min={1} max={10}
                   className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                   value={seats} onChange={e=>setSeats(parseInt(e.target.value || '1', 10))} />
          </Field>
          <Field label="Length (minutes)">
            <input type="number" min={30} max={480} step={15}
                   className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                   value={lengthMin} onChange={e=>setLengthMin(parseInt(e.target.value || '60', 10))} />
          </Field>
          <Field label="Vibe (short description)">
            <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
                   value={vibe} onChange={e=>setVibe(e.target.value)} placeholder="Casual, rules-light, beginner friendly" />
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

          {errorMsg && <div className="md:col-span-2 text-sm text-red-400">{errorMsg}</div>}

          <div className="md:col-span-2 flex items-center gap-2">
            <button disabled={saving}
                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60">
              {saving ? 'Creating…' : 'Create lobby'}
            </button>
            <a href="/lobbies" className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Cancel</a>
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
