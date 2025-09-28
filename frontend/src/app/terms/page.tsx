// File: frontend/src/app/terms/page.tsx
export default function TermsPage() {
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
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-white/60 mt-1">Last updated: September 28, 2025</p>

          <div className="mt-6 grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-6 text-white/85 leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold">Acceptance of Terms</h2>
                <p className="mt-2">
                  By accessing or using ttrplobby (the “Service”), you agree to these Terms. If you do not agree, do not use the Service.
                  We may update these Terms from time to time; continued use means you accept the changes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Accounts & Security</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>You are responsible for your account and for maintaining the security of your login credentials.</li>
                  <li>Provide accurate information and keep your profile up to date.</li>
                  <li>We may suspend or terminate accounts that violate these Terms or create risk for others.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">User Content & Conduct</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>
                    You retain ownership of content you upload (e.g., avatars, posters, lobby text). By posting, you grant us a worldwide,
                    non-exclusive license to host, display, and transmit your content to operate the Service.
                  </li>
                  <li>
                    Do not post illegal content; hate speech; harassment; doxxing; threats; sexual content involving minors; or content that
                    infringes others’ rights.
                  </li>
                  <li>
                    No spamming, scraping, exploiting security vulnerabilities, or attempting to disrupt the Service or other users’ sessions.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Lobbies, Real-Time Features & Links</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>Lobby availability, presence, and chat are best-effort real-time features and may experience interruptions.</li>
                  <li>Use caution when sharing external links (Discord, VTTs, etc.). Third-party sites are not controlled by us.</li>
                  <li>Hosts are responsible for moderating their lobbies and the conduct of participants they admit.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Username & Display Name</h2>
                <p className="mt-2">
                  Usernames and display names must be unique and may be reclaimed or changed if they impersonate others, infringe rights,
                  or otherwise violate these Terms. We may apply reasonable technical limits (length, characters) to prevent abuse.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Intellectual Property</h2>
                <p className="mt-2">
                  The Service’s look and feel, branding, and code are protected by intellectual-property laws. Do not copy, modify, or host
                  derivative services without permission.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Termination</h2>
                <p className="mt-2">
                  We may suspend or terminate your access at any time for breach of these Terms or risk to the Service or its users. You may
                  stop using the Service at any time and request deletion of your account.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Disclaimers</h2>
                <p className="mt-2">
                  The Service is provided “as is” without warranties of any kind. We do not warrant uninterrupted or error-free operation, or
                  the availability or accuracy of third-party services linked from the platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Limitation of Liability</h2>
                <p className="mt-2">
                  To the fullest extent permitted by law, ttrplobby and its contributors will not be liable for any indirect, incidental,
                  special, consequential, or punitive damages, or any loss of data, opportunities, or profits, arising out of your use of
                  the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Indemnification</h2>
                <p className="mt-2">
                  You agree to defend, indemnify, and hold harmless ttrplobby and its contributors from any claims, liabilities, damages, and
                  expenses arising from your use of the Service or violation of these Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Governing Law</h2>
                <p className="mt-2">
                  These Terms are governed by the laws of Ontario, Canada, without regard to conflict-of-laws principles. Courts in Ontario,
                  Canada will have exclusive jurisdiction over disputes arising from or relating to these Terms or the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Changes</h2>
                <p className="mt-2">
                  We may update these Terms from time to time. We will post updates here and adjust the “Last updated” date. Material changes
                  may also be announced in-app.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Contact</h2>
                <p className="mt-2">
                  Questions about these Terms? Reach out via the options listed on our <a href="/about" className="underline">About</a> page.
                </p>
              </section>
            </div>

            <aside className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold">Summary</div>
                <ul className="mt-3 text-sm text-white/70 space-y-2 list-disc pl-5">
                  <li>Be respectful; no illegal or abusive conduct.</li>
                  <li>Your content is yours; we need a license to host it.</li>
                  <li>Real-time features are best-effort and may vary.</li>
                  <li>We can suspend accounts that create risk or violate rules.</li>
                </ul>
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
