// File: frontend/src/app/live/players/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Presence = {
  user_id: string
  room_id: string | null
  lat: number | null
  lon: number | null
  updated_at: string
  display_name?: string | null
  avatar_url?: string | null
}

export default function LivePlayersPage() {
  const [points, setPoints] = useState<Presence[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Load initial + subscribe to realtime changes
  useEffect(() => {
    let mounted = true

    async function load() {
      setErrorMsg(null)
      setLoading(true)
      try {
        // "Active" = pinged within the last 2 minutes
        const sinceIso = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('live_presence')
          .select('user_id, room_id, lat, lon, updated_at, profiles:profiles!inner(display_name, avatar_url)')
          .gte('updated_at', sinceIso)
        if (error) throw error

        const mapped: Presence[] = (data as any[]).map((r) => ({
          user_id: r.user_id,
          room_id: r.room_id ?? null,
          lat: r.lat ?? null,
          lon: r.lon ?? null,
          updated_at: r.updated_at,
          display_name: r.profiles?.display_name ?? null,
          avatar_url: r.profiles?.avatar_url ?? null,
        }))

        if (mounted) setPoints(mapped)
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message || 'Failed to load live presence')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    const channel = supabase
      .channel('live_presence_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_presence' },
        () => void load()
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const active = useMemo(
    () => points.filter(p => isFinite(p.lat ?? NaN) && isFinite(p.lon ?? NaN)),
    [points]
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-white">
      <TopBar />

      <h1 className="text-2xl font-bold">Live players</h1>
      <p className="text-white/70 mt-1">
        Connected users hosting or joining live games right now.
      </p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/95 overflow-hidden relative aspect-[2/1]">
        {/* Optional land silhouette — place /public/world-map.svg for outlines */}
        <img
          src="/world-map.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none select-none"
          onError={(e) => {
            // If the svg isn’t present, keep a plain black background.
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />

        {/* Dots */}
        {active.map((p) => {
          const left = lonToPercent(p.lon!)
          const top = latToPercent(p.lat!)
          return (
            <div
              key={`${p.user_id}-${p.room_id ?? 'none'}`}
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%` }}
              title={p.display_name ?? 'Player'}
            >
              <div className="h-2 w-2 rounded-full bg-[#29e0e3] shadow-[0_0_10px_2px_rgba(41,224,227,0.7)]" />
            </div>
          )
        })}

        {/* Empty state */}
        {!loading && active.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">
            No live users yet.
          </div>
        )}
      </div>

      <div className="mt-3 text-sm text-white/70">
        Total live users: <span className="text-white">{active.length}</span>
      </div>

      {errorMsg && <div className="mt-3 text-sm text-red-400">{errorMsg}</div>}
    </div>
  )
}

/* ------------------------------ UI chrome ------------------------------ */

function TopBar() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
      >
        <LogoIcon />
        <span className="font-semibold">ttrplobby</span>
      </a>

      <a
        href="/profile"
        className="inline-flex items-center gap-2 rounded-xl border border-white/20 hover:border-white/40 px-3 py-1.5 text-sm transition"
      >
        Profile
      </a>
    </div>
  )
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

/* ------------------------------ helpers ------------------------------ */

/** Equirectangular projection → percentage from left */
function lonToPercent(lon: number) {
  // lon ∈ [-180, 180]
  return ((lon + 180) / 360) * 100
}
/** Equirectangular projection → percentage from top */
function latToPercent(lat: number) {
  // lat ∈ [-90, 90]
  return ((90 - lat) / 180) * 100
}
