// File: frontend/src/app/lobbies/[id]/join/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function JoinPreferencesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [exp, setExp] = useState<'new' | 'some' | 'veteran'>('some')
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(false)
  const [role, setRole] = useState('player')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(`/login?next=${encodeURIComponent(`/lobbies/${id}/join`)}`); return }
      setAuthChecked(true)
    })()
  }, [id, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true); setErrorMsg(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      // add membership (idempotent-ish)
      await supabase.from('game_players').insert({ game_id: id, user_id: user.id, role }).then(() => {}, () => {})

      // upsert preferences
      const prefs = { experience: exp, mic, cam, notes }
      const { error } = await supabase
        .from('game_player_prefs')
        .upsert({ game_id: id as string, user_id: user.id, preferences: prefs }, { onConflict: 'game_id,user_id' })
      if (error) throw error

      router.push(`/lobbies/${id}/live`)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (!authChecked) return <Shell><TopBanner /><div className="rounded-3xl border border-white/10 bg-white/5 h-40 animate-pulse" /></Shell>

  return (
    <Shell>
      <TopBanner />
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8 text-white">
        <h1 className="text-2xl font-bold">Before you join…</h1>
        <p className="text-white/70 mt-1">Tell the GM your preferences. You’ll enter the live lobby next.</p>

        {errorMsg && <div className="mt-4 text-sm text-red-400">{errorMsg}</div>}

        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4 mt-6">
          <Field label="Experience">
            <select className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={exp} onChange={e=>setExp(e.target.value as any)}>
              <option value="new">New player</option>
              <option value="some">Some experience</option>
              <option value="veteran">Veteran</option>
            </select>
          </Field>
          <Field label="Role">
            <select className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10" value={role} onChange={e=>setRole(e.target.value)}>
              <option value="player">Player</option>
              <option value="support">Support</option>
            </select>
          </Field>
          <Field label="Mic available?">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand" checked={mic} onChange={e=>setMic(e.target.checked)} />
              <span>Yes</span>
            </label>
          </Field>
          <Field label="Camera available?">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand" checked={cam} onChange={e=>setCam(e.target.checked)} />
              <span>Yes</span>
            </label>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes to GM (optional)">
              <textarea className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 min-h-[90px]" value={notes} onChange={e=>setNotes(e.target.value)} />
            </Field>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <button disabled={saving} className="px-4 py-2 rounded-xl bg-brand hover:bg-brandHover font-medium disabled:opacity-60">
              {saving ? 'Joining…' : 'Join lobby'}
            </button>
            <a href={`/lobbies/${id}`} className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Back</a>
          </div>
        </form>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) { return <div className="max-w-3xl mx-auto px-4 py-8 text-white">{children}</div> }
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
