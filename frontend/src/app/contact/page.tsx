// File: frontend/src/app/contact/page.tsx
export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-white">
      <TopBar />

      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 overflow-hidden">
        {/* subtle glow accents */}
        <div className="relative">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#29e0e3]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#29e0e3]/10 blur-3xl" />
        </div>

        <div className="p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Contact us</h1>
          <p className="text-sm text-white/60 mt-1">We’re most responsive on Discord.</p>

          <div className="mt-6 grid md:grid-cols-5 gap-6">
            {/* Main */}
            <div className="md:col-span-3 space-y-6 text-white/85 leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold">Join our Discord</h2>
                <p className="mt-2">
                  Have a question, bug report, or suggestion? Hop into our community server and post in the support channel. We’ll follow up there.
                </p>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-sm text-white/70">Invite link</div>
                  <div className="mt-1 flex items-center gap-3">
                    <a
                      href="https://discord.gg/VUjpUzswKF"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] px-4 py-2 font-medium"
                    >
                      Open Discord
                    </a>
                    <code className="px-3 py-1.5 rounded-md bg-zinc-950 border border-white/10 text-white/80 text-sm break-all">
                      https://discord.gg/VUjpUzswKF
                    </code>
                  </div>
                  <p className="text-xs text-white/60 mt-2">
                    If the button doesn’t open, copy the link above and paste it into your browser or the Discord app.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold">What to include</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>Brief description of the issue or request.</li>
                  <li>Steps to reproduce (for bugs), and what you expected to happen.</li>
                  <li>Screenshot or URL, if applicable (e.g., a specific lobby or profile page).</li>
                  <li>Your device & browser (e.g., iPhone + Safari, Windows + Chrome).</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Response times</h2>
                <p className="mt-2">
                  We try to respond within 1–2 business days. Outages and account-access issues are prioritized.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Safety & conduct</h2>
                <p className="mt-2">
                  Please follow our community guidelines. Reports of harassment, hate speech, or dangerous behavior will be reviewed and may
                  result in account restrictions. See our <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a> for more.
                </p>
              </section>
            </div>

            {/* Side */}
            <aside className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold">Quick links</div>
                <ul className="mt-3 text-sm text-white/70 space-y-2 list-disc pl-5">
                  <li><a className="underline hover:text-white" href="https://discord.gg/VUjpUzswKF" target="_blank" rel="noreferrer">Discord invite</a></li>
                  <li><a className="underline hover:text-white" href="/privacy">Privacy Policy</a></li>
                  <li><a className="underline hover:text-white" href="/terms">Terms of Service</a></li>
                  <li><a className="underline hover:text-white" href="/about">About ttrplobby</a></li>
                </ul>
                <div className="mt-4 text-xs text-white/60">
                  Tip: If you can’t join via the button, open Discord and use <span className="font-mono">Invite → Enter a Server Link</span> with the URL.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

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
