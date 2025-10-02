// frontend/src/app/server-sitemap.xml/route.ts
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

  // TODO: adjust table/columns/filters to your schema + RLS
  const [{ data: lobbies }, { data: live }] = await Promise.all([
    sb.from('lobbies').select('id, updated_at').eq('is_public', true).limit(5000),
    sb.from('live_games').select('id, updated_at').eq('discoverable', true).limit(5000),
  ])

  const entries: { loc: string; lastmod?: string }[] = []

  ;(lobbies ?? []).forEach(row => {
    entries.push({
      loc: `${BASE}/lobbies/${row.id}`,
      lastmod: row.updated_at ?? undefined,
    })
    entries.push({
      loc: `${BASE}/lobbies/${row.id}/live`,
      lastmod: row.updated_at ?? undefined,
    })
  })

  ;(live ?? []).forEach(row => {
    entries.push({
      loc: `${BASE}/live/${row.id}`,
      lastmod: row.updated_at ?? undefined,
    })
  })

  const now = new Date().toISOString()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : `<lastmod>${now}</lastmod>`}</url>`).join('\n')}
</urlset>`

  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } })
}
