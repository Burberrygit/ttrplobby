// File: frontend/src/app/live/search/Client.tsx
'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function Client() {
  const router = useRouter();
  const q = useSearchParams();
  const [status, setStatus] = useState<'searching'|'expanding'|'failed'>('searching');
  const stopAt = useRef<number>(Date.now() + 60_000); // try up to 60s

  useEffect(() => {
    let cancelled = false;

    async function getToken(): Promise<string | null> {
      // Dynamic import avoids running the Supabase browser client during prerender
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    }

    async function callApi(body: Record<string, unknown>) {
      const token = await getToken();
      if (!token) return { ok: false, status: 401 };

      const res = await fetch('/api/live/quick-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (res.ok) {
        const { gameId } = await res.json();
        if (!cancelled) router.replace(`/live/${gameId}`);
        return { ok: true, status: 200 };
      }
      return { ok: false, status: res.status };
    }

    async function loop() {
      const base = {
        system: q.get('system') ?? 'dnd5e',
        newPlayerFriendly: (q.get('npf') ?? 'true') === 'true',
        adult: (q.get('adult') ?? 'false') === 'true',
        lengthMinutes: Number(q.get('length') ?? '120'),
      };

      // initial strict search
      {
        const r = await callApi({ ...base, widen: false });
        if (r.ok) return;
        if (r.status === 401) { setStatus('failed'); return; } // not logged in
      }

      setStatus('expanding');

      // progressively widen length tolerance
      const tolerances = [15, 30, 45, 60];
      for (const tol of tolerances) {
        if (Date.now() > stopAt.current) break;
        const r = await callApi({ ...base, toleranceMinutes: tol, widen: true });
        if (r.ok) return;
        await new Promise(r => setTimeout(r, 1500));
      }

      // final pass: ignore newbie/adult flags but keep system
      if (Date.now() <= stopAt.current) {
        const r = await callApi({ ...base, ignoreFlags: true, widen: true });
        if (r.ok) return;
      }

      setStatus('failed');
    }

    loop();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col text-white">
      {/* Halfway-from-center buttons */}
      <a
        href="/"
        className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
      >
        ttrplobby
      </a>
      <a
        href="/profile"
        className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
      >
        Profile
      </a>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative w-28 h-28">
            <Image
              src="/logo.png"
              alt="TTRPLobby"
              fill
              className="animate-spin-slow object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold">
            We are searching for a game…
          </h1>
          <p className="text-sm text-white/80 max-w-prose">
            Please stay on this page until you are connected.
          </p>

          {/* Optional subtle status line */}
          <p className="text-xs text-white/60">
            {status === 'searching'
              ? 'Searching with your exact filters.'
              : status === 'expanding'
              ? 'No instant match — expanding the search window.'
              : 'No matching games found right now.'}
          </p>
        </div>
      </main>

      {/* Pinned footer */}
      <footer className="border-t border-white/10 px-4">
        <div className="max-w-4xl mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2025 ttrplobby</div>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/contact" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 2.5s linear infinite; }
      `}</style>
    </div>
  );
}
