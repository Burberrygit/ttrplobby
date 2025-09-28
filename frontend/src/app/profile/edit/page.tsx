// File: frontend/src/app/profile/edit/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile, saveProfile } from '@/lib/profile'

export default function EditProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [timeZone, setTimeZone] = useState<string>('auto')

  // uniqueness validation state
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [displayChecking, setDisplayChecking] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [displayError, setDisplayError] = useState<string | null>(null)

  // avatar file handling
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const chosenFileRef = useRef<File | null>(null)

  // delete account modal (hard delete)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }, [])

  // Curated set of IANA time zones
  const COMMON_TZS = useMemo(
    () => [
      'UTC',
      'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto',
      'America/Mexico_City','America/Sao_Paulo','Europe/London','Europe/Dublin','Europe/Paris','Europe/Berlin',
      'Europe/Madrid','Europe/Rome','Africa/Johannesburg','Asia/Dubai','Asia/Karachi','Asia/Kolkata',
      'Asia/Bangkok','Asia/Singapore','Asia/Hong_Kong','Asia/Shanghai','Asia/Tokyo','Asia/Seoul',
      'Australia/Sydney','Pacific/Auckland','Pacific/Honolulu'
    ],
    []
  )

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const next = encodeURIComponent('/profile/edit')
        router.replace(`/login?next=${next}`)
        return
      }
      setUserId(user.id)
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

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    chosenFileRef.current = file
    const fr = new FileReader()
    fr.onload = () => setLocalPreview(fr.result as string)
    fr.readAsDataURL(file)
  }

  async function uploadAvatarIfNeeded(userId: string): Promise<string | null> {
    const file = chosenFileRef.current
    if (!file) return null
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      return pub.publicUrl
    } finally {
      setUploading(false)
    }
  }

  // normalize usernames to a safe charset (lowers ambiguity in uniqueness)
  function normalizeUsername(raw: string) {
    const lower = raw.toLowerCase()
    // allow a-z, 0-9, underscore; collapse spaces/dots to underscore
    return lower.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32)
  }

  async function checkUsernameUnique(name: string) {
    if (!userId) return
    const candidate = normalizeUsername(name)
    setUsername(candidate)
    setUsernameError(null)
    if (!candidate) {
      setUsernameError('Username is required')
      return
    }
    setUsernameChecking(true)
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('username', candidate)
        .neq('id', userId)
      if (error) throw error
      if ((count ?? 0) > 0) setUsernameError('That username is taken')
    } catch (e: any) {
      setUsernameError(e?.message || 'Could not validate username')
    } finally {
      setUsernameChecking(false)
    }
  }

  async function checkDisplayNameUnique(name: string) {
    if (!userId) return
    const trimmed = name.trim()
    setDisplayError(null)
    if (!trimmed) {
      setDisplayError('Display name is required')
      return
    }
    setDisplayChecking(true)
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('display_name', trimmed)
        .neq('id', userId)
      if (error) throw error
      if ((count ?? 0) > 0) setDisplayError('That display name is taken')
    } catch (e: any) {
      setDisplayError(e?.message || 'Could not validate display name')
    } finally {
      setDisplayChecking(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw authErr || new Error('Not signed in')

      // Run final uniqueness checks before save
      await Promise.all([
        checkUsernameUnique(username),
        checkDisplayNameUnique(displayName),
      ])

      if (usernameError || displayError || usernameChecking || displayChecking) {
        throw new Error('Please fix the highlighted fields')
      }

      // upload avatar if user picked a new file
      const uploadedUrl = await uploadAvatarIfNeeded(user.id)
      const finalAvatarUrl = uploadedUrl ?? avatarUrl

      await saveProfile({
        username: normalizeUsername(username),
        display_name: displayName.trim(),
        avatar_url: finalAvatarUrl || undefined,
        bio,
        time_zone: timeZone === 'auto' ? browserTz : timeZone,
      })

      router.push('/profile')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ----- HARD DELETE (Edge Function) -----
  async function confirmHardDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL}/delete-account`
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) {
        const message = (await res.text()) || 'Delete failed'
        throw new Error(message)
      }

      await supabase.auth.signOut()
      router.replace('/')
    } catch (e: any) {
      setDeleteError(e?.message || 'Delete failed')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10 text-white">
        <div className="text-white/70">Loading…</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-white">
      <h1 className="text-2xl font-bold">Profile settings</h1>

      <form onSubmit={onSubmit} className="grid gap-4 mt-6">
        {/* Avatar */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="text-sm font-medium mb-2">Profile image</div>
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 rounded-xl overflow-hidden ring-2 ring-white/10 bg-white/5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={localPreview || avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username || 'Player')}&background=0B0B0E&color=FFFFFF`}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg border border-white/20 hover:border-white/40"
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : (localPreview ? 'Choose a different image' : 'Upload image')}
              </button>
              {localPreview && (
                <button
                  type="button"
                  className="ml-2 px-3 py-2 rounded-lg border border-white/20 hover:border-white/40"
                  onClick={() => { chosenFileRef.current = null; setLocalPreview(null) }}
                >
                  Remove selection
                </button>
              )}
              <div className="text-xs text-white/60 mt-2">JPEG/PNG recommended. Stored in your public “avatars” folder.</div>
            </div>
          </div>
        </div>

        {/* Names */}
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Display name</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white placeholder:text-white/40"
            value={displayName}
            onChange={(e)=>{ setDisplayName(e.target.value); setDisplayError(null) }}
            onBlur={(e)=>{ void checkDisplayNameUnique(e.target.value) }}
            required
          />
          {displayChecking && <span className="text-xs text-white/60">Checking availability…</span>}
          {displayError && <span className="text-xs text-red-400">{displayError}</span>}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Username</span>
          <input
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white placeholder:text-white/40"
            value={username}
            onChange={(e)=>{ setUsername(e.target.value); setUsernameError(null) }}
            onBlur={(e)=>{ void checkUsernameUnique(e.target.value) }}
            placeholder="letters, numbers, underscores"
            required
          />
          {usernameChecking && <span className="text-xs text-white/60">Checking availability…</span>}
          {usernameError && <span className="text-xs text-red-400">{usernameError}</span>}
        </label>

        {/* Time zone */}
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Time zone</span>
          <select
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white"
            value={timeZone}
            onChange={e => setTimeZone(e.target.value)}
          >
            <option value="auto">Auto (Browser: {browserTz})</option>
            {COMMON_TZS.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Bio</span>
          <textarea
            rows={4}
            className="px-3 py-2 rounded-md bg-zinc-950 border border-white/10 text-white placeholder:text-white/40"
            value={bio}
            onChange={(e)=>setBio(e.target.value)}
            placeholder="Tell people about the kinds of games you like to run or play."
          />
        </label>

        {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}

        <div className="flex items-center gap-2">
          <button
            disabled={saving || usernameChecking || displayChecking || !!usernameError || !!displayError}
            className="px-4 py-2 rounded-lg bg-[#29e0e3] hover:bg-[#22c8cb] font-medium text-black disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium"
            onClick={()=>router.push('/profile')}
          >
            Cancel
          </button>

          {/* Danger zone: Hard delete */}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => { setShowDelete(true); setDeleteError(null) }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold"
            >
              Delete profile
            </button>
          </div>
        </div>
      </form>

      {/* Delete confirm modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setShowDelete(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 mx-4">
            <h2 className="text-xl font-bold text-white">Delete your profile?</h2>
            <p className="text-white/80 mt-2">
              This action is <span className="text-red-400 font-semibold">permanent</span>. It will:
            </p>
            <ul className="mt-2 text-white/75 list-disc pl-5 space-y-1 text-sm">
              <li>End any live lobbies you are hosting.</li>
              <li>Delete your profile and public files (avatars/posters in your folders).</li>
              <li>Delete your account from authentication and sign you out.</li>
            </ul>
            {deleteError && <div className="mt-3 text-sm text-red-400">{deleteError}</div>}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                disabled={deleting}
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 rounded-lg border border-white/20 hover:border-white/40"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={confirmHardDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

