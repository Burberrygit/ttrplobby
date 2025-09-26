// File: frontend/src/app/about/page.tsx
import Script from 'next/script'

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-white">
      <TopBanner />

      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 md:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">About me</h1>

        <p className="mt-4 text-white/80">
          I am Mr. Burberry, your friendly neighbourhood DM. I built this project because finding a D&amp;D game when you
          have a shifting schedule can be hard. I struggled to line up players at the last minute, and the existing
          TTRPG finders never felt right for how I like to run and join sessions. So I started building my own in my spare time.
        </p>

        <p className="mt-4 text-white/80">
          The difference here is the Lobby system. It lets people start live games on the fly and find active players
          who are ready to jump in now. You can spin up a group and be rolling within an hour. If you love to DM but
          your availability is unpredictable, or you are a player who likes to hop into a session when you have a free
          evening, this site is designed for you.
        </p>

        <p className="mt-4 text-white/80">
          If you like the idea and want to help it gain traction, or you would like to support development, you can
          donate here:
        </p>

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

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          This is an early community project. Feedback and ideas are welcome. Thanks for checking it out.
        </div>
      </div>
    </div>
  )
}

function TopBanner() {
  return (
    <div className="mb-6">
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
      >
        <LogoIcon />
        <span className="font-semibold">ttrplobby</span>
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
