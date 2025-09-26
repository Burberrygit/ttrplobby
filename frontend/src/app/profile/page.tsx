'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile } from '@/lib/profile'

export default function ProfileDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState('')
  const [bio, setBio] = useState(''); const [avatarUrl, setAvatarUrl] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick); return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(`/login?next=${encodeURIComponent('/profile')}`); return }
      try {
        const p = await fetchMyProfile()
        if (p) { setDisplayName(p.display_name ?? ''); setUsername(p.username ?? ''); setBio(p.bio ?? ''); setAvatarUrl(p.avatar_url ?? '') }
      } catch (e:any) { setErrorMsg(e?.message || 'Failed to load profile') }
      finally { setLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imgSrc = avatarUrl?.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username || 'Player')}&background=111827&color=29e0e3`

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-10"><div className="text-zinc-400">Loading…</div></div>

  return (
    <div className="min-h-[70vh] max-w-5xl mx-auto px-4 py-10">
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex gap-4 items-center">
        <img src={imgSrc} alt="Avatar" className="h-16 w-16 rounded-xl object-cover border border-zinc-800" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold truncate">{displayName || 'Unnamed Adventurer'}</h1>
            {username && <span className="text-xs text-zinc-400">@{username}</span>}
          </div>
          {bio ? <p className="text-sm text-zinc-300 mt-1">{bio}</p> : <p className="text-sm text-zinc-500 mt-1">You haven’t written a bio yet.</p>}
        </div>

        <div className="relative" ref={menuRef}>
          <button onClick={()=>setMenuOpen(v=>!v)} className="px-3 py-2 rounded-lg bg-brand hover:bg-brandHover font-medium">Menu</button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur shadow-xl p-1">
              <MenuItem href="/schedule" label="Search for games" onClick={()=>setMenuOpen(false)} />
              <MenuItem href="/lobbies/new" label="Start live game" onClick={()=>setMenuOpen(false)} />
              <MenuItem href="/lobbies" label="Join live game" onClick={()=>setMenuOpen(false)} />
              <MenuItem href="/schedule/new" label="Post a game" onClick={()=>setMenuOpen(false)} />
              <div className="my-1 h-px bg-zinc-800" />
              <MenuItem href="/profile/edit" label="Profile settings" onClick={()=>setMenuOpen(false)} />
              <button className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-zinc-800"
                      onClick={async()=>{ setMenuOpen(false); await supabase.auth.signOut(); router.push('/login') }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMsg && <div className="text-sm text-red-400 mt-6">{errorMsg}</div>}
    </div>
  )
}

function MenuItem({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return <a href={href} onClick={onClick} className="block px-3 py-2 rounded-lg text-sm hover:bg-zinc-800">{label}</a>
}
