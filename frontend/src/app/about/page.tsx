// File: frontend/src/app/about/page.tsx
import Script from 'next/script'

export default function AboutPage() {
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
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">About me</h1>

          <div className="mt-5 grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-4 text-white/85 leading-relaxed">
              <p>
                I am Mr. Burberry, your friendly neighbourhood DM. This project started because lining up a D&amp;D session on short notice was harder than it needed to be. Finding players at the last minute was unreliable, and the existing TTRPG sites did not match how I prefer to run or join games. I decided to build something that fits the way I like to play.
              </p>
              <p>
                The core idea is the Lobby system. It lets you start live games immediately and find people who are ready to play now. You can bring a table together quickly and be rolling within an hour. If you enjoy DMing but your availability changes week to week, or you are a player who likes to jump into a session when time allows, this site aims to meet that need.
              </p>
              <p>
                I am building this in my spare time and growing it step by step. If the idea resonates and you want to support development or help it gain traction, you can do so below.
              </p>
            </div>

            <aside className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold">Support the project</div>
                <p className="text-sm text-white/70 mt-1">
                  Contributions go toward hosting, infrastructure, and feature development.
                </p>

                {/* Buy Me a Coffee script (official button) */}
                <div className="mt-4">
                  <Script
                    src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
                    data-name="bmc-button"
                    data-slug="Burberrylounge"
                    data-color="#BD5FFF"
                    data-emoji="☕"
                    data-font="Cookie"
                    data-text="Buy me a coffee"
                    data-outline-color="#000000"
                    data-font-color="#ffffff"
                    data-coffee-color="#FFDD00"
                    strategy="afterInteractive"
                  />
                </div>

                {/* Visible fallback link to ensure a CTA always renders */}
                <div className="mt-3">
                  <a
                    href="https://www.buymeacoffee.com/Burberrylounge"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#BD5FFF] hover:opacity-90 font-medium"
                  >
                    Buy me a coffee
                  </a>
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            This is an early community project. Feedback and ideas are welcome.
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

