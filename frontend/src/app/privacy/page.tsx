// File: frontend/src/app/privacy/page.tsx
export default function PrivacyPage() {
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
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-white/60 mt-1">Last updated: September 28, 2025</p>

          <div className="mt-6 grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-6 text-white/85 leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold">Overview</h2>
                <p className="mt-2">
                  ttrplobby is a community project for hosting and joining tabletop RPG sessions (“Service”). This Privacy Policy explains
                  what we collect, how we use it, and the choices you have. By using the Service, you agree to this policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">What we collect</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>
                    <span className="font-medium">Account data:</span> email (if provided by your auth provider), display name, username, and
                    basic profile fields. When you sign in with providers like Discord or Google, we receive limited profile data they share.
                  </li>
                  <li>
                    <span className="font-medium">Content you upload:</span> avatars and game posters you choose to store (e.g., in Supabase Storage).
                  </li>
                  <li>
                    <span className="font-medium">Lobby/activity data:</span> the lobbies you create or join, presence signals, and messages you send
                    through real-time channels.
                  </li>
                  <li>
                    <span className="font-medium">Technical data:</span> logs from our hosting and infrastructure (e.g., IP, user agent, timestamps) used for
                    security and reliability.
                  </li>
                  <li>
                    <span className="font-medium">Cookies/local storage:</span> primarily for authentication (e.g., PKCE verifiers, session tokens handled by the auth SDK).
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">How we use data</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>To authenticate you and maintain your session.</li>
                  <li>To operate core features (create/join lobbies, chat/presence, profile pages).</li>
                  <li>To keep the Service secure, monitor abuse, and debug issues.</li>
                  <li>To communicate important updates or policy changes.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Sharing & third parties</h2>
                <p className="mt-2">
                  We rely on infrastructure and providers (e.g., Supabase for auth/database/storage, Netlify for hosting, OAuth providers like
                  Discord/Google). These processors handle data on our behalf under their terms. Public content (like your display name, username,
                  avatar, lobby titles) may be visible to other users as part of normal functionality.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Security</h2>
                <p className="mt-2">
                  We use role-based access controls and row-level security in our database where appropriate. No online service can be 100% secure,
                  but we work to protect your data and limit access to what’s necessary to operate the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Retention</h2>
                <p className="mt-2">
                  We retain account data while your account is active. You can request deletion of your account and associated profile content; some
                  minimal logs may be kept for security, fraud prevention, or legal reasons.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Your choices</h2>
                <ul className="mt-2 space-y-2 list-disc pl-5">
                  <li>Update your profile details (display name, username, avatar) on your profile pages.</li>
                  <li>Control what you upload; remove images or posts you no longer want to share.</li>
                  <li>Contact us to request account deletion or data access (see “Contact”).</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Children</h2>
                <p className="mt-2">
                  The Service is not directed to children under 13. If you believe a minor has provided us personal information, please contact us
                  so we can take appropriate action.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Changes to this policy</h2>
                <p className="mt-2">
                  We may update this Privacy Policy from time to time. We will post the updated version here and adjust the “Last updated” date.
                  Material changes may also be announced in-app.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Contact</h2>
                <p className="mt-2">
                  For privacy questions or requests, please reach out via the options listed on our <a href="/about" className="underline">About</a> page.
                </p>
              </section>
            </div>

            <aside className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold">At a glance</div>
                <ul className="mt-3 text-sm text-white/70 space-y-2 list-disc pl-5">
                  <li>We collect minimal account/profile & lobby data.</li>
                  <li>Storage is user-initiated (avatars/posters you upload).</li>
                  <li>We use third-party infrastructure to run the Service.</li>
                  <li>You can edit or delete your profile data.</li>
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
