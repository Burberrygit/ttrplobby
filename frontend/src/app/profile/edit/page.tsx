// File: frontend/src/app/profile/edit/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile, saveProfile } from '@/lib/profile'

const COMMON_TZS = [
  'UTC',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Mexico_City','America/Sao_Paulo',
  'Europe/London','Europe/Dublin','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome',
  'Africa/Johannesburg',
  'Asia/Jerusalem','Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Bangkok',
  'Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo','Asia/Seoul','Asia/Shanghai',
  'Australia/Sydney','Pacific/Auckland','Pacific/Honolulu'
]

function getBrowserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export default function EditProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [timeZone, setTimeZone] = useState<string>('auto')

  // avatar upload
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

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
          setTimeZone(p.time_zone ?? 'auto')
        } else {
          // sensible defaults for first-run setup
          setTimeZone('auto')
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMsg(null)
    try {
      setUploading(true)
      // local preview
      const r = new FileReader()
      r.onload = () => setPreview(String(r.result))
      r.readAsDataURL(file)

      // upload to Supabase Storage bucket: "avatars"
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw authErr || new Error('Not signed in')

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(pub.publicUrl)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to upload avatar (check Storage bucket "avatars" and RLS)')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      const tz = timeZone === 'auto' ? getBrowserTz() : timeZone

      // Pass all fields; if your saveProfile type is strict, the `as any` keeps TS happy.
      await saveProfile({
        username,
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio,
        time_zone: tz,
      } as any)

      router.push('/profile')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10 text-white">
        <div className="text-white/70">Loading…</div>
      </div>
    )
  }

  const effectiveAvatar =
    preview ||
    avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username || 'Player')}&background=0B0B0E&color=FFFFFF`

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-white">
      <h1 className="text-2xl font-bold">Profile settings</h1>

      <form onSubmit={onSubmit} className="grid gap-5 mt-6">
        {/* Avatar picker */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveAvatar}
              alt="Avatar preview"
              className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/10"
            />
            <div>
              <div className="text-sm text-white/80">Profile image</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Choose image'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => { setAvatarUrl(''); setPreview(null) }}
                    className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="text-xs text-white/50 mt-2">PNG or JPG, up to ~5MB.</div>
            </div>
          </div>
        </div>

        {/* Text fields */}
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Display name</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white placeholder:text-white/40"
            value={displayName}
            onChange={(e)=>setDisplayName(e.target.value)}
            required
            placeholder="What should people call you?"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Username</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white placeholder:text-white/40"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            placeholder="Optional handle (must be unique)"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Bio</span>
          <textarea
            rows={4}
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white placeholder:text-white/40"
            value={bio}
            onChange={(e)=>setBio(e.target.value)}
            placeholder="Tell folks what you like to run or play."
          />
        </label>

        {/* Time zone */}
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Time zone</span>
          <select
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white"
            value={timeZone}
            onChange={(e)=>setTimeZone(e.target.value)}
          >
            <option value="auto">Auto-detect (browser: {getBrowserTz()})</option>
            {COMMON_TZS.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>

        {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}

        <div className="flex items-center gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#29e0e3] hover:bg-[#22c8cb] font-medium text-black disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 font-medium"
            onClick={()=>router.push('/profile')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

