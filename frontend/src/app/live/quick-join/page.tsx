// File: frontend/src/app/live/quick-join/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SYSTEMS = [
  'D&D 5e (2014)','D&D 2024','Pathfinder 2e','Pathfinder 1e','Call of Cthulhu','Starfinder',
  'Shadowrun','Dungeon World','OSR','Savage Worlds','GURPS','Cyberpunk RED','Alien RPG',
  'Delta Green','Blades in the Dark','PbtA','World of Darkness','Warhammer Fantasy','Warhammer 40K','Mörk Borg','Other'
];

// Canonical lengths (minutes) -> shown as hours in UI
const LENGTHS_MINUTES = [60, 90, 120, 180] as const;

export default function QuickJoinPage() {
  const router = useRouter();
  const [system, setSystem] = useState('D&D 5e (2014)');
  const [newbie, setNewbie] = useState(true);
  const [adult, setAdult] = useState(false);
  const [lengthMinutes, setLengthMinutes] = useState<number>(120);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Ensure user is signed in and attach bearer
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push(`/login?next=${encodeURIComponent('/live/quick-join')}`);
      return;
    }

    const res = await fetch('/api/live/quick-join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        system,
        npf: newbie,
        adult,
        length: lengthMinutes, // exact minutes, matches /live/new defaults
      }),
    });

    const json = await res.json().catch(() => null as any);

    if (!res.ok) {
      if (json?.step === 'match' && json?.error === 'no_game_found') {
        alert('No open table matches those filters yet. Try a different length or system.');
      } else if (json?.step === 'auth') {
        alert('Please sign in to join a game.');
      } else {
        console.error('Quick-join error:', json);
        alert('Could not join a game. Please try again.');
      }
      return;
    }

    if (json?.gameId) {
      router.push(`/live/${json.gameId}`);
    } else {
      alert('Joined, but no game id returned.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col text-white">
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
        <TopBanner />

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Quick join a live game</h1>
            <p className="text-white/70 mt-1">
              Pick your preferences and we’ll drop you into the first open table that matches.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/profile"
              className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
            >
              Profile
            </a>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-[280px,1fr] gap-4">
          {/* Sidebar info to mirror /live/new layout */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-sm font-medium mb-2">What we’ll match</div>
            <ul className="text-sm text-white/70 space-y-1.5">
              <li>• <span className="text-white/90">System</span>: exact match</li>
              <li>• <span className="text-white/90">New-player friendly</span>: respected when possible</li>
              <li>• <span className="text-white/90">18+ content</span>: respected when possible</li>
              <li>• <span className="text-white/90">Length</span>: exact canonical values (1.0, 1.5, 2.0, 3.0 hours)</li>
            </ul>
            <div className="mt-3 text-xs text-white/50">
              If nothing matches, you can tweak filters or start a new live game.
            </div>
          </div>

          {/* Form card styled like /live/new */}
          <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="mb-1 text-white/70">System</div>
                <select
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                >
                  {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-white/70">Length (Hours)</div>
                <select
                  value={String(lengthMinutes)}
                  onChange={(e) => setLengthMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                >
                  {LENGTHS_MINUTES.map(m => (
                    <option key={m} value={m}>
                      {(m/60).toFixed(m % 60 === 0 ? 0 : 1)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-sm md:col-span-2 flex items-center gap-6 mt-1">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newbie}
                    onChange={(e) => setNewbie(e.target.checked)}
                    className="accent-[#29e0e3]"
                  />
                  New-player friendly
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={adult}
                    onChange={(e) => setAdult(e.target.checked)}
                    className="accent-[#29e0e3]"
                  />
                  18+ content
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#29e0e3] hover:bg-[#22c8cb] font-medium"
              >
                Join now
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Pinned footer */}
      <footer className="mt-12 border-t border-white/10 px-4">
        <div className="max-w-4xl mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2025 ttrplobby</div>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/contact" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function TopBanner() {
  return (
    <div className="mb-4">
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
      >
        <LogoIcon />
        <span className="font-semibold">ttrplobby</span>
      </a>
    </div>
  );
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
