import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const BASE = 'https://www.ttrplobby.com'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  // Build a server-side Supabase client
  const sb = createServerClient(url, key, {
    cookies: {
      getAll() { return [] },
      setAll() {},
    },
  })

  // Fetch dynamic content for inclusion
  // TODO: adjust table/columns/filters to your schema + RLS
  const [{ data: lobbies }, { data: live }] = await Promise.all([
    sb.from('lobbies').select('id, updated_at').eq('is_public', true).limit(5000),
    sb.from('live_games').select('id, updated_at').eq('discoverable', true).limit(5000),
  ])

  const entries: { loc: string; lastmod?: string }[] = []

  // --- Static, important pages (ensure homepage is present) ---
  const now = new Date().toISOString()
  const staticPages: { loc: string; lastmod?: string }[] = [
    { loc: `${BASE}/`, lastmod: now },
    { loc: `${BASE}/about`, lastmod: now },
    { loc: `${BASE}/schedule`, lastmod: now },
    { loc: `${BASE}/live/join`, lastmod: now },
    // Intentionally omit /live/new from sitemap to reduce its prominence in search.
  ]
  entries.push(...staticPages)

  // --- Dynamic lobbies ---
  ;(lobbies ?? []).forEach(row => {
    entries.push({
      loc: `${BASE}/lobbies/${row.id}`,
      lastmod: row.updated_at ?? now,
    })
    entries.push({
      loc: `${BASE}/lobbies/${row.id}/live`,
      lastmod: row.updated_at ?? now,
    })
  })

  // --- Dynamic live games ---
  ;(live ?? []).forEach(row => {
    entries.push({
      loc: `${BASE}/live/${row.id}`,
      lastmod: row.updated_at ?? now,
    })
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod || now}</lastmod></url>`).join('\n')}
</urlset>`

  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=UTF-8' } })
}
