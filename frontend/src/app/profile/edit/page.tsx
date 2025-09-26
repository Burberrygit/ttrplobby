// File: frontend/src/app/profile/edit/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile, saveProfile } from '@/lib/profile'

export default function EditProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const next = encodeURIComponent('/profile/edit')
        router.replace(`/login?next=${next}`)
        return
      }
      try {
        const p = await fetchMyProfile()
        if (p) {
          setUsername(p.username ?? '')
          setDisplayName(p.display_name ?? '')
          setAvatarUrl(p.avatar_url ?? '')
          setBio(p.bio ?? '')
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      await saveProfile({
        username,
        display_name: displayName,
        avatar_url: avatarUrl,
        bio,
      })
      // ✅ Send to the profile dashboard after save
      router.push('/profile')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="text-zinc-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold">Profile settings</h1>
      <p className="text-zinc-400 text-sm mt-1">
        Update your display name, avatar, and bio.
      </p>

      <form onSubmit={onSubmit} className="grid gap-3 mt-6">
        <label className="grid gap-1 text-sm">
          <span>Display name</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., Alain"
            required
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Username</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-handle"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Avatar URL</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…/avatar.png"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Bio</span>
          <textarea
            rows={4}
            className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell folks what you like to play…"
          />
        </label>

        {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}

        <div className="flex items-center gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand hover:bg-brandHover font-medium disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium"
            onClick={() => router.push('/profile')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
