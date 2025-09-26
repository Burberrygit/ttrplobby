'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile } from '@/lib/profile'

type MenuItem = { href?: string; onClick?: () => void; label: string; icon: JSX.Element }

export default function ProfileDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  // Close dropdown on outside click / Esc
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  // Load profile (require auth)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          const next = encodeURIComponent('/profile')
          router.replace(`/login?next=${next}`)
          return
        }
        const p = await fetchMyProfile()
        if (p) {
          setDisplayName(p.display_name ?? '')
          setUsername(p.username ?? '')
          setBio(p.bio ?? '')
          setAvatarUrl(p.avatar_url ?? '')
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imgSrc =
    avatarUrl?.trim() ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username || 'Player')}&background=0B0B0E&color=FFFFFF`

  // Menu items
  const items: MenuItem[] = [
    { href: '/schedule', label: 'Search for games', icon: <SearchIcon /> },
    { href: '/lobbies/new', label: 'Start live game', icon: <PlayIcon /> },
    { href: '/lobbies', label: 'Join live game', icon: <UsersIcon /> },
    { href: '/schedule/new', label: 'Post a game', icon: <PlusCircleIcon /> },
    { href: '/profile/edit', label: 'Profile settings', icon: <SettingsIcon /> },
    {
      label: 'Sign out',
      icon: <LogoutIcon />,
      onClick: async () => {
        setMenuOpen(false)
        await supabase.auth.signOut()
        router.push('/login')
      },
    },
  ]

  if (loading) return <PageShell><SkeletonProfileCard /></PageShell>

  return (
    <PageShell>
      {/* Header / Card */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />

        <div className="p-6 md:p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:gap-6">
            <div className="relative shrink-0">
              <img
                src={imgSrc}
                alt="Avatar"
                className="h-20 w-20 md:h-24 md:w-24 rounded-2xl object-cover ring-2 ring-white/10"
              />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 ring-2 ring-zinc-900" title="Online" />
            </div>

            <div className="mt-4 md:mt-0 flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight">
                {displayName || 'Unnamed Adventurer'}
              </h1>
              {username && <div className="text-white/60 mt-0.5">@{username}</div>}

              {bio ? (
                <p className="text-white/80 mt-3 max-w-3xl">{bio}</p>
              ) : (
                <p className="text-white/50 mt-3">You haven’t written a bio yet. Add one in <a className="underline underline-offset-4" href="/profile/edit">Profile settings</a>.</p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 md:mt-0 flex items-center gap-2">
              <a
                href="/profile/edit"
                className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40 text-white transition"
              >
                Edit profile
              </a>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  Menu
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur shadow-2xl p-1 text-white"
                  >
                    {items.map((it, i) => (
                      <div key={i}>
                        {'href' in it && it.href ? (
                          <a
                            role="menuitem"
                            href={it.href}
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition"
                          >
                            <span className="opacity-90">{it.icon}</span>
                            <span className="text-sm">{it.label}</span>
                          </a>
                        ) : (
                          <button
                            role="menuitem"
                            onClick={it.onClick}
                            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition"
                          >
                            <span className="opacity-90">{it.icon}</span>
                            <span className="text-sm">{it.label}</span>
                          </button>
                        )}
                        {i === 3 && <div className="my-1 h-px bg-white/10" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats / shortcuts */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Games played" value="—" />
            <StatCard label="Games hosted" value="—" />
            <StatCard label="Reputation" value="—" />
            <StatCard label="Member since" value="—" />
          </div>
        </div>
      </div>

      {/* Primary actions grid */}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard href="/schedule" title="Search for games" desc="Find tables by system, vibe, time." icon={<SearchIcon />} />
        <ActionCard href="/lobbies/new" title="Start live game" desc="Spin up an instant lobby." icon={<PlayIcon />} />
        <ActionCard href="/lobbies" title="Join live game" desc="Jump into active tables." icon={<UsersIcon />} />
        <ActionCard href="/schedule/new" title="Post a game" desc="Schedule a session for later." icon={<PlusCircleIcon />} />
      </div>

      {errorMsg && <div className="text-sm text-red-400 mt-6">{errorMsg}</div>}
    </PageShell>
  )
}

/* ----------------------- UI helpers (white text first) ---------------------- */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] max-w-6xl mx-auto px-4 py-8 text-white">
      {children}
    </div>
  )
}

function SkeletonProfileCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 rounded-2xl bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-6 w-64 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-40 bg-white/10 rounded mt-2 animate-pulse" />
            <div className="h-4 w-96 bg-white/10 rounded mt-4 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function ActionCard({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: JSX.Element }) {
  return (
    <a
      href={href}
      className="group block rounded-2xl border border-white/10 bg-zinc-900/60 p-4 hover:border-white/30 transition"
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        <div className="opacity-80 group-hover:opacity-100">{icon}</div>
      </div>
      <div className="text-sm text-white/70 mt-1">{desc}</div>
    </a>
  )
}

/* --------------------------- Minimal inline icons --------------------------- */

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  )
}
function PlusCircleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 19c.3-2.1 1.9-3.7 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.8-1L12 2 9.9 4a7.5 7.5 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2.1l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.8 1L12 22l2.1-2a7.5 7.5 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M10 12h11m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
