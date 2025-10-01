// File: frontend/src/app/schedule/page.tsx
import { Suspense } from 'react'
import Script from 'next/script'
import SearchClient from './SearchClient'

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

      {/* Timezone (new "EST/GMT/etc" structure + auto-detect) */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
        <span className="opacity-70">Timezone:&nbsp;</span>
        <span id="tz-label">Auto-detecting…</span>
      </div>

      {/* Auto-detect timezone and expose in a new structure:
          {
            code: "EDT",                   // e.g., EST/EDT, PST/PDT, CET, GMT, etc. (fallbacks to "GMT-04:00")
            gmt: "GMT-04:00",             // canonical GMT offset string
            offsetMinutes: -240,          // minutes relative to UTC (+east / -west)
            iana: "America/Toronto",      // browser-reported IANA zone if available
            label: "EDT (GMT-04:00)",     // human label
            source: "auto"
          }
          It also persists cookies (tz_code, tz_gmt, tz_iana) and localStorage ("ttrplobby:tz"),
          keeps any existing ?tz param (IANA) for backward compatibility, and adds ?tz_code=<abbr>.
      */}
      <Script
        id="tz-auto-detect-new-structure"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  try {
    var now = new Date();

    // IANA zone from the browser, if available
    var iana = (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || null;

    // getTimezoneOffset(): minutes behind UTC (west=positive). Convert to minutes relative to UTC (east=+).
    var offsetMinutes = -now.getTimezoneOffset();

    function fmtGMT(mins){
      var sign = mins >= 0 ? '+' : '-';
      var abs = Math.abs(mins);
      var hh = String(Math.floor(abs / 60)).padStart(2, '0');
      var mm = String(abs % 60).padStart(2, '0');
      return 'GMT' + sign + hh + ':' + mm;
    }

    // Try to extract a short timezone code like "EDT", "PST", "CET".
    function detectAbbr(zone){
      try {
        // Prefer formatting with a specific zone if available to avoid locale/system defaults
        var parts = new Intl.DateTimeFormat('en-US', { timeZone: zone || undefined, timeZoneName: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
        var part = parts.find(function(p){ return p.type === 'timeZoneName'; });
        if (part && part.value) {
          var v = part.value.trim();
          // Most browsers return either an alphabetic code (EDT) or a "GMT-4" style.
          // If alphabetic (2-5 letters), accept it as the code.
          if (/^[A-Za-z]{2,5}$/.test(v)) return v.toUpperCase();
          // If "GMT-4" or "GMT-04:00", we'll fall through to GMT string fallback below.
        }
      } catch(_) {}
      return null;
    }

    var abbr = detectAbbr(iana);
    var gmt = fmtGMT(offsetMinutes);
    var code = abbr || gmt; // fallback to GMT-xx:xx if a clean alpha code isn't available

    var payload = {
      code: code,
      gmt: gmt,
      offsetMinutes: offsetMinutes,
      iana: iana,
      label: (abbr ? (abbr + ' (' + gmt + ')') : gmt),
      source: 'auto'
    };

    // Expose globally for any client component to read
    try { window.__TTRPL_TZ = payload; } catch(_) {}

    // Persist (1 year)
    try { localStorage.setItem('ttrplobby:tz', JSON.stringify(payload)); } catch(_) {}
    document.cookie = 'tz_code=' + encodeURIComponent(payload.code) + '; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'tz_gmt=' + encodeURIComponent(payload.gmt) + '; path=/; max-age=31536000; SameSite=Lax';
    document.cookie = 'tz_iana=' + encodeURIComponent(payload.iana || '') + '; path=/; max-age=31536000; SameSite=Lax';

    // Reflect in URL:
    // - keep existing ?tz (IANA) if present to avoid breaking old flows
    // - add/update ?tz_code with the abbreviation/GMT form for new flows
    try {
      var url = new URL(location.href);
      if (!url.searchParams.get('tz') && payload.iana) {
        url.searchParams.set('tz', payload.iana);
      }
      url.searchParams.set('tz_code', payload.code);
      history.replaceState(null, '', url.toString());
    } catch(_) {}

    // Update inline UI label
    try {
      var el = document.getElementById('tz-label');
      if (el) el.textContent = payload.label;
    } catch(_) {}

    // Notify listeners
    try { window.dispatchEvent(new CustomEvent('ttrplobby:tz', { detail: payload })); } catch(_) {}
  } catch (e) { /* ignore */ }
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

