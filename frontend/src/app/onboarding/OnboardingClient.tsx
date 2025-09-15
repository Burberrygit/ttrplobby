'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function OnboardingClient() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) {
        router.replace('/login?next=/onboarding')
        return
      }
      setEmail(u.email ?? null)
      setUserId(u.id)

      // Load existing partial profile if any
      supabase.from('profiles').select('username, display_name, bio, avatar_url')
        .eq('id', u.id).maybeSingle().then(({ data }) => {
          if (data) {
            setUsername(data.username ?? '')
            setDisplayName((data as any).display_name ?? '')
            setBio(data.bio ?? '')
            if (data.avatar_url) setAvatarPreview(data.avatar_url)
          }
        })
    })
  }, [router])

  function onPick(file: File | null) {
    setAvatarFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setAvatarPreview(url)
    } else {
      setAvatarPreview(null)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setErr(null)

    try {
      let avatar_url: string | null = avatarPreview

      if (avatarFile) {
        const filePath = `${userId}/${Date.now()}-${avatarFile.name}`
        const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath)
        avatar_url = pub.publicUrl
      }

      // Require a username to consider profile "complete"
      if (!username.trim()) {
        throw new Error('Please choose a username.')
      }

      // Optional: uniqueness check
      if (username) {
        const { data: taken } = await supabase
          .from('profiles')
          .select('id')
          .neq('id', userId)
          .eq('username', username)
        if (taken && taken.length > 0) throw new Error('That username is taken.')
      }

      const { error: upsertErr } = await supabase.from('profiles').upsert({
        id: userId,
        username,
        display_name: displayName,
        bio,
        avatar_url
      }, { onConflict: 'id' })
      if (upsertErr) throw upsertErr

      router.replace('/profile')
    } catch (e: any) {
      setErr(e.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Banner */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between relative z-50">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ttrplobby logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-lg tracking-tight">ttrplobby</span>
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <p className="text-zinc-400 mt-1 text-sm">We’ll use this info across lobbies and games.</p>

        <form onSubmit={handleSave} className="mt-6 grid gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center border border-zinc-700">
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
                : <span className="text-xs text-zinc-400">No avatar</span>}
            </div>
            <label className="text-sm">
              <span className="block mb-1 text-zinc-400">Avatar</span>
              <input type="file" accept="image/*" onChange={(e)=>onPick(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Username */}
          <label className="text-sm">
            <div className="mb-1 text-zinc-400">Username (required)</div>
            <input
              value={username}
              onChange={(e)=>setUsername(e.target.value)}
              placeholder="e.g. crit_wizard"
              className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
              required
            />
          </label>

          {/* Display name */}
          <label className="text-sm">
            <div className="mb-1 text-zinc-400">Display name</div>
            <input
              value={displayName}
              onChange={(e)=>setDisplayName(e.target.value)}
              placeholder="e.g. Aria Winters"
              className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
            />
          </label>

          {/* Bio */}
          <label className="text-sm">
            <div className="mb-1 text-zinc-400">Bio</div>
            <textarea
              value={bio}
              onChange={(e)=>setBio(e.target.value)}
              placeholder="What games do you enjoy? Timezones? Safety tools? Anything helpful for GMs/players."
              className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 min-h-[120px]"
            />
          </label>

          {email && (
            <div className="text-xs text-zinc-500">Account email: {email}</div>
          )}

          {err && <div className="text-sm text-red-400">{err}</div>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium disabled:opacity-70"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <button
              type="button"
              onClick={()=>router.replace('/profile')}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
