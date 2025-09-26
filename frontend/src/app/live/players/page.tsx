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

const BRAND = '#29e0e3'
const BG = '#0b0b0e'

export default function LivePlayersPage() {
  const [points, setPoints] = useState<Presence[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [mapPath, setMapPath] = useState<string>('')        // countries outline path (single path)
  const [projFn, setProjFn] = useState<((lon: number, lat: number) => [number, number] | null) | null>(null)
  const [ready, setReady] = useState(false)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{w:number,h:number}>({ w: 1200, h: 600 })

  // --- measure container and recompute projection on resize
  useEffect(() => {
    function measure() {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // keep a pleasant 2:1 aspect but fill width
      const w = Math.max(600, Math.floor(r.width))
      const h = Math.max(300, Math.floor(r.width / 2))
      setSize({ w, h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [])

  // --- build map projection + outline path (client-only)
  useEffect(() => {
    let cancelled = false
    async function build() {
      try {
        // dynamic imports keep SSR bundle light
        const d3 = await import('d3-geo')
        const topo = await import('topojson-client')
        // TopoJSON (Natural Earth) — countries at 1:110m resolution
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - JSON import type
        const world = (await import('world-atlas/countries-110m.json')).default as any

        const projection = d3.geoEquirectangular().fitSize([size.w, size.h], { type: 'Sphere' } as any)
        const path = d3.geoPath(projection as any)

        // a single MultiLineString for country borders (a !== b gives borders only)
        const borders = topo.mesh(world, world.objects.countries, (a: any, b: any) => a !== b)

        const d = path(borders as any) || ''

        if (!cancelled) {
          setMapPath(d)
          setProjFn(() => (lon: number, lat: number) => {
            try {
              const p = projection([lon, lat])
              if (!p || !isFinite(p[0]) || !isFinite(p[1])) return null
              return [p[0], p[1]]
            } catch { return null }
          })
          setReady(true)
        }
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load map libraries')
      }
    }
    build()
    return () => { cancelled = true }
  }, [size.w, size.h])

  // --- presence load (Option A: 2 queries, no FK requirement)
  useEffect(() => {
    let mounted = true

    async function load() {
      setErrorMsg(null)
      setLoading(true)
      try {
        const sinceIso = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        const { data: pres, error: perr } = await supabase
          .from('live_presence')
          .select('user_id, room_id, lat, lon, updated_at')
          .gte('updated_at', sinceIso)
        if (perr) throw perr

        const base: Presence[] = (pres ?? []).map((r: any) => ({
          user_id: r.user_id,
          room_id: r.room_id ?? null,
          lat: r.lat ?? null,
          lon: r.lon ?? null,
          updated_at: r.updated_at,
        }))

        // fetch basic profiles for labels/avatars
        const ids = Array.from(new Set(base.map(b => b.user_id))).filter(Boolean)
        let byId: Record<string, { display_name: string | null, avatar_url: string | null }> = {}
        if (ids.length) {
          const { data: profs, error: perr2 } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', ids)
          if (perr2) throw perr2
          byId = Object.fromEntries(
            (profs ?? []).map((p: any) => [p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null }])
          )
        }

        const merged = base.map(p => ({
          ...p,
          display_name: byId[p.user_id]?.display_name ?? null,
          avatar_url: byId[p.user_id]?.avatar_url ?? null,
        }))

        if (mounted) setPoints(merged)
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
      <p className="text-white/70 mt-1">Connected users hosting or joining live games right now.</p>

      <div
        ref={wrapRef}
        className="mt-4 rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: BG }}
      >
        {/* SVG map */}
        <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label="World map">
          {/* Optional subtle globe arc vignette */}
          <defs>
            <filter id="glow">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={BRAND} floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Country borders outline */}
          {ready && (
            <path
              d={mapPath}
              fill="none"
              stroke={BRAND}
              strokeOpacity="0.7"
              strokeWidth={1}
            />
          )}

          {/* Presence dots */}
          {ready && projFn && active.map((p) => {
            const xy = projFn(p.lon!, p.lat!)
            if (!xy) return null
            return (
              <g key={`${p.user_id}-${p.room_id ?? 'none'}`} transform={`translate(${xy[0]},${xy[1]})`} >
                <circle r="3" fill={BRAND} filter="url(#glow)" />
                <title>{p.display_name || 'Player'}</title>
              </g>
            )
          })}
        </svg>

        {!loading && ready && active.length === 0 && (
          <div className="p-3 text-white/60 text-sm">No live users yet.</div>
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

