// File: frontend/src/app/lobbies/[id]/edit/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchGame, updateGame, Game } from '@/lib/games'

export default function EditLobbyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [me, setMe] = useState<string | null>(null)
  const [game, setGame] = useState<Game | null>(null)

  // form state
  const [title, setTitle] = useState('')
  const [system, setSystem] = useState('D&D 5e (2014)')
  const [seats, setSeats] = useState(5)
  const [lengthHours, setLengthHours] = useState<number>(2)
  const [vibe, setVibe] = useState('')
  const [welcomesNew, setWelcomesNew] = useState(true)
  const [isMature, setIsMature] = useState(false)

  // poster upload
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/lobbies/${id}/edit`)}`)
        return
      }
      setMe(user.id)
      setAuthChecked(true)
      const g = await fetchGame(id)
      if (!g) { setErrorMsg('Game not found'); return }
      if (g.host_id !== user.id) { setErrorMsg('Only the host can edit this game'); return }
      setGame(g)
      setTitle(g.title)
      setSystem(g.system || 'D&D 5e (2014)')
      setSeats(g.seats ?? 5)
      setLengthHours(g.length_min ? Math.max(0.5, Math.round((g.length_min / 60) * 2) / 2) : 2)
      setVibe(g.vibe ?? '')
      setWelcomesNew(!!g.welcomes_new)
      setIsMature(!!g.is_mature)
      setPosterPreview(g.poster_url || '')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function onPickPoster(file?: File | null) {
    if (!file) { setPosterFile(null); setPosterPreview(game?.poster_url || ''); return }
    const MAX_MB = 5
    if (!file.type.startsWith('image/')) { setErrorMsg('Please select an image file.'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setErrorMsg(`Image must be under ${MAX_MB} MB.`); return }
    setErrorMsg(null); setPosterFile(file); setPosterPreview(URL.createObjectURL(file))
  }

  async function uploadPosterIfNeeded(): Promise<string | null> {
    if (!posterFile || !me) return game?.poster_url || null
    const ext = (() => {
      const n = posterFile.name.toLowerCase()
      const maybe = n.includes('.') ? n.split('.').pop()! : ''
      return maybe || 'jpg'
    })()
    const path = `${me}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('posters').upload(path, posterFile, {
      cacheControl: '3600', upsert: true, contentType: posterFile.type || 'image/*',
    })
    if (upErr) throw upErr
    const { data } = supabase.storage.from('posters').getPublicUrl(path)
    return data.publicUrl || null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!game) return
    setSaving(true); setErrorMsg(null)
    try {
      const poster_url = await uploadPosterIfNeeded()
      const minutes = Math.round((Number.isFinite(lengthHours) ? lengthHours : 2) * 60)
      await updateGame(game.id, {
        title: title || 'Untitled game',
        system,
        poster_url,
        seats,
        length_min: minutes,
        vibe,
        welcomes_new: welcomesNew,
        is_mature: isMature,
      })
      router.push(`/lobbies/${game.id}`)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to update game')
    } finally {
      setSaving(false)
    }
  }

  if (!authChecked) return <Shell><div className="text-white/70">Checking sign-in…</div></Shell>

  return (
    <Shell>
      <TopBanner />
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8 text-white">
        <h1 className="text-2xl font-bold">Edit game</h1>
        <p className="text-white/60 mt-1">Update details for your lobby.</p>

        {errorMsg && <div className="mt-4 text-sm text-red-400">{errorMsg}</div>}

        {!game ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 h-40 animate-pulse" />
        ) : (
          <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-4 mt-6">

            {/* Poster upload */}
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

            <Field label="Length (Hours)">
              <input type="number" min={0.5} max={8} step={0.5} className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={lengthHours} onChange={e=>setLengthHours(parseFloat(e.target.value || '2'))} />
            </Field>

            <Field label="Vibe (short description)">
              <input className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={vibe} onChange={e=>setVibe(e.target.value)} placeholder="Casual, rules-light, beginner friendly" />
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

            <div className="md:col-span-2 flex items-center gap-2">
              <button disabled={saving} className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <a href={`/lobbies/${id}`} className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Cancel</a>
            </div>
          </form>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) { return <div className="max-w-4xl mx-auto px-4 py-8 text-white">{children}</div> }
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
