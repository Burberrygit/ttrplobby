'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  tokens: number
  plan: string
}

type Stats = {
  active_users?: number
  active_lobbies?: number
}

// Safe client-side env handling (same pattern as landing page)
function resolveApiBase(): string {
  try {
    if (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_API_URL) {
      return (process as any).env.NEXT_PUBLIC_API_URL as string
    }
  } catch {}
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="ttrplobby-api"]') as HTMLMetaElement | null
    if (meta?.content) return meta.content
  }
  return ''
}

const API = resolveApiBase()

export default function ProfileClient() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        router.replace('/login?next=/profile')
        return
      }
      setEmail(user.email ?? null)

      const { data: prof } = await supabase
        .from('profiles')
        .select('username, display_name, bio, avatar_url, tokens, plan')
        .eq('id', user.id)
        .maybeSingle()

      if (!prof?.username) {
        router.replace('/onboarding')
        return
      }
      setProfile({
        username: prof.username ?? null,
        display_name: (prof as any).display_name ?? null,
        bio: prof.bio ?? null,
        avatar_url: prof.avatar_url ?? null,
        tokens: prof.tokens ?? 0,
        plan: prof.plan ?? 'free'
      })

      // Try to fetch live stats from your API if configured
      if (API) {
        try {
          const res = await fetch(`${API}/stats`, { cache: 'no-store' })
          if (res.ok) {
            const js = await res.json()
            setStats({
              active_users: typeof js.active_users === 'number' ? js.active_users : undefined,
              active_lobbies: typeof js.active_lobbies === 'number' ? js.active_lobbies : undefined,
            })
          }
        } catch {}
      }

      setLoading(false)
    })()
  }, [router])

  const tokenDisplay = useMemo(() => {
    if (!profile) return ''
    if (profile.plan && profile.plan.toLowerCase() !== 'free') return '∞'
    return String(profile.tokens ?? 0)
  }, [profile])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  function startLobby() {
    const href = '/lobbies/new'
    if (typeof window !== 'undefined') window.location.href = href
  }
  function joinLobby() {
    const href = '/lobbies'
    if (typeof window !== 'undefined') window.location.href = href
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-sm text-zinc-400">Loading your profile…</div>
      </div>
    )
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
          <div className="flex items-center gap-3">
            <button onClick={()=>router.replace('/onboarding')} className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm">
              Edit profile
            </button>
            <button onClick={handleSignOut} className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-6">
        {/* Left: Profile card */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                  : <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400">No avatar</div>}
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">{profile?.display_name || profile?.username}</div>
                <div className="text-sm text-zinc-400">@{profile?.username}</div>
                {email && <div className="text-xs text-zinc-500 mt-1">{email}</div>}
              </div>
            </div>

            {profile?.bio && (
              <div className="mt-4 text-sm text-zinc-200 whitespace-pre-wrap">{profile.bio}</div>
            )}
          </div>
        </div>

        {/* Right: Live status + tokens + actions */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">Active users</div>
              <div className="text-lg font-semibold">{stats.active_users ?? '—'}</div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-zinc-400">Active games</div>
              <div className="text-lg font-semibold">{stats.active_lobbies ?? '—'}</div>
            </div>

            <div className="mt-4 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-400">Your tokens</div>
                <div className="text-lg font-semibold">{tokenDisplay}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={joinLobby} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium">
                  Join lobby
                </button>
                <button onClick={startLobby} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
                  Start lobby
                </button>
              </div>

              {/* Optional upgrade CTA */}
              {profile?.plan?.toLowerCase() === 'free' && (
                <div className="mt-3 text-xs text-zinc-400">
                  Need more tokens? <a href="/billing" className="text-emerald-400 hover:text-emerald-300">Upgrade</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
