// File: frontend/src/app/schedule/page.tsx
import { Suspense } from 'react'
import Script from 'next/script'
import SearchClient from './SearchClient'

// Force dynamic rendering and disable cache (must be on a Server Component)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SchedulePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-white">
      {/* Header: Left = ttrplobby pill, Right = Profile button */}
      <div className="mb-4 flex items-center justify-between">
        <TopBanner />
        <a
          href="/profile"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
        >
          <LogoIcon />
          <span className="font-semibold">Profile</span>
        </a>
      </div>

      {/* Time zone dropdown (same structure as /schedule/new) */}
      <div className="mb-6">
        <label className="grid gap-1 text-sm">
          <span className="text-white/70">Time zone</span>
          <select
            id="tz-select"
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10"
            defaultValue="__loading__"
          >
            <option value="__loading__">Loading time zones…</option>
          </select>
          <span className="text-xs text-white/50 mt-1">
            Pick EST, GMT, CET, JST, etc — or use Auto.
          </span>
        </label>
      </div>

      {/* Build + hydrate the dropdown and keep URL/localStorage in sync */}
      <Script
        id="tz-dropdown-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  // Helpers copied from /schedule/new
  function TZ_GROUPS(autoAbbr){
    return [
      {
        label: 'Auto',
        options: [{ value: '__auto__', label: 'Auto-detect' + (autoAbbr ? (' (' + autoAbbr + ')') : '') }],
      },
      {
        label: 'UTC / GMT',
        options: [
          { value: 'UTC', label: 'UTC (±0)' },
          { value: 'GMT', label: 'GMT (±0)' },
          { value: 'UTC-12:00', label: 'UTC-12:00' },
          { value: 'UTC-11:00', label: 'UTC-11:00' },
          { value: 'UTC-10:00', label: 'UTC-10:00 (HST)' },
          { value: 'UTC-09:00', label: 'UTC-09:00 (AKST)' },
          { value: 'UTC-08:00', label: 'UTC-08:00 (PST)' },
          { value: 'UTC-07:00', label: 'UTC-07:00 (MST/PDT)' },
          { value: 'UTC-06:00', label: 'UTC-06:00 (CST/MDT)' },
          { value: 'UTC-05:00', label: 'UTC-05:00 (EST/CDT)' },
          { value: 'UTC-04:00', label: 'UTC-04:00 (AST/EDT)' },
          { value: 'UTC-03:00', label: 'UTC-03:00' },
          { value: 'UTC-02:00', label: 'UTC-02:00' },
          { value: 'UTC-01:00', label: 'UTC-01:00' },
          { value: 'UTC+00:00', label: 'UTC+00:00 (WET)' },
          { value: 'UTC+01:00', label: 'UTC+01:00 (CET/WEST)' },
          { value: 'UTC+02:00', label: 'UTC+02:00 (EET/CEST)' },
          { value: 'UTC+03:00', label: 'UTC+03:00 (MSK/EEST)' },
          { value: 'UTC+03:30', label: 'UTC+03:30 (IRST)' },
          { value: 'UTC+04:00', label: 'UTC+04:00 (GST)' },
          { value: 'UTC+05:00', label: 'UTC+05:00 (PKT)' },
          { value: 'UTC+05:30', label: 'UTC+05:30 (IST India)' },
          { value: 'UTC+06:00', label: 'UTC+06:00 (BST Bangladesh)' },
          { value: 'UTC+07:00', label: 'UTC+07:00 (ICT)' },
          { value: 'UTC+08:00', label: 'UTC+08:00 (SGT/HKT/China)' },
          { value: 'UTC+09:00', label: 'UTC+09:00 (JST/KST)' },
          { value: 'UTC+09:30', label: 'UTC+09:30 (ACST)' },
          { value: 'UTC+10:00', label: 'UTC+10:00 (AEST)' },
          { value: 'UTC+11:00', label: 'UTC+11:00 (AEDT)' },
          { value: 'UTC+12:00', label: 'UTC+12:00 (NZST)' },
          { value: 'UTC+13:00', label: 'UTC+13:00 (NZDT)' },
        ],
      },
      {
        label: 'North America (abbr)',
        options: [
          { value: 'EST', label: 'EST (UTC-5)' },
          { value: 'EDT', label: 'EDT (UTC-4)' },
          { value: 'CST', label: 'CST (UTC-6)' },
          { value: 'CDT', label: 'CDT (UTC-5)' },
          { value: 'MST', label: 'MST (UTC-7)' },
          { value: 'MDT', label: 'MDT (UTC-6)' },
          { value: 'PST', label: 'PST (UTC-8)' },
          { value: 'PDT', label: 'PDT (UTC-7)' },
          { value: 'AKST', label: 'AKST (UTC-9)' },
          { value: 'AKDT', label: 'AKDT (UTC-8)' },
          { value: 'HST', label: 'HST (UTC-10)' },
          { value: 'AST', label: 'AST (UTC-4)' },
          { value: 'ADT', label: 'ADT (UTC-3)' },
          { value: 'NST', label: 'NST (UTC-3:30)' },
          { value: 'NDT', label: 'NDT (UTC-2:30)' },
        ],
      },
      {
        label: 'Europe (abbr)',
        options: [
          { value: 'WET', label: 'WET (UTC+0)' },
          { value: 'WEST', label: 'WEST (UTC+1)' },
          { value: 'CET', label: 'CET (UTC+1)' },
          { value: 'CEST', label: 'CEST (UTC+2)' },
          { value: 'EET', label: 'EET (UTC+2)' },
          { value: 'EEST', label: 'EEST (UTC+3)' },
          { value: 'MSK', label: 'MSK (UTC+3)' },
        ],
      },
      {
        label: 'Asia / Pacific (abbr)',
        options: [
          { value: 'PKT', label: 'PKT (UTC+5)' },
          { value: 'IST', label: 'IST — India (UTC+5:30)' },
          { value: 'BST', label: 'BST — Bangladesh (UTC+6)' },
          { value: 'ICT', label: 'ICT (UTC+7)' },
          { value: 'SGT', label: 'SGT — Singapore (UTC+8)' },
          { value: 'HKT', label: 'HKT — Hong Kong (UTC+8)' },
          { value: 'CSTCN', label: 'CST — China (UTC+8)' },
          { value: 'JST', label: 'JST (UTC+9)' },
          { value: 'KST', label: 'KST (UTC+9)' },
          { value: 'AWST', label: 'AWST (UTC+8)' },
          { value: 'ACST', label: 'ACST (UTC+9:30)' },
          { value: 'ACDT', label: 'ACDT (UTC+10:30)' },
          { value: 'AEST', label: 'AEST (UTC+10)' },
          { value: 'AEDT', label: 'AEDT (UTC+11)' },
          { value: 'NZST', label: 'NZST (UTC+12)' },
          { value: 'NZDT', label: 'NZDT (UTC+13)' },
        ],
      },
    ]
  }
  function getAbbrForIana(iana){
    try {
      var s = new Date().toLocaleTimeString('en-US', { timeZone: iana, timeZoneName: 'short' })
      var parts = s.split(' ')
      return parts[parts.length - 1] || null
    } catch { return null }
  }

  function buildOptions(select, groups){
    select.innerHTML = ''
    groups.forEach(function(group){
      var og = document.createElement('optgroup')
      og.label = group.label
      group.options.forEach(function(opt){
        var o = document.createElement('option')
        o.value = opt.value
        o.textContent = opt.label
        og.appendChild(o)
      })
      select.appendChild(og)
    })
  }

  function applySelection(val, autoAbbr){
    var resolved = (val === '__auto__') ? (autoAbbr || 'UTC') : val
    try { localStorage.setItem('ttrplobby:tz_code', resolved) } catch(_) {}
    try {
      var url = new URL(location.href)
      url.searchParams.set('tz_code', resolved)
      history.replaceState(null, '', url.toString())
    } catch(_) {}
    try { window.dispatchEvent(new CustomEvent('ttrplobby:tz', { detail: { code: resolved } })) } catch(_) {}
  }

  try {
    var select = document.getElementById('tz-select')
    if (!select) return

    var iana = (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC'
    var autoAbbr = getAbbrForIana(iana) || 'UTC'

    var prev =
      (function(){
        try {
          var url = new URL(location.href)
          return url.searchParams.get('tz_code') || localStorage.getItem('ttrplobby:tz_code') || ''
        } catch(_) { return '' }
      })()

    buildOptions(select, TZ_GROUPS(autoAbbr))

    if (prev) {
      // If previous code exists and is in list, select it; otherwise fall back to Auto
      var hasPrev = !!Array.from(select.options).find(function(o){ return o.value === prev })
      select.value = hasPrev ? prev : '__auto__'
      applySelection(hasPrev ? prev : '__auto__', autoAbbr)
    } else {
      select.value = '__auto__'
      applySelection('__auto__', autoAbbr)
    }

    select.addEventListener('change', function(e){
      applySelection(e.target.value, autoAbbr)
    })
  } catch(e) { /* ignore */ }
})();`
        }}
      />

      <Suspense
        fallback={
          <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
        }
      >
        <SearchClient />
      </Suspense>
    </div>
  )
}

function TopBanner() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
    >
      <LogoIcon />
      <span className="font-semibold">ttrplobby</span>
    </a>
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


