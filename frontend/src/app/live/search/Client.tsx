'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Phase = 'strict' | 'widening' | 'open';

export default function Client() {
  const router = useRouter();
  const q = useSearchParams();

  const [phase, setPhase] = useState<Phase>('strict');
  const [hint, setHint] = useState<string>('Searching with your exact filters…');

  const strictUntil = useRef<number>(Date.now() + 30_000); // strict for first 30s
  const cancelledRef = useRef(false);

  useEffect(() => {
    let visHandler: (() => void) | null = null;
    cancelledRef.current = false;

    // Persist the user's search filters for later (used by kick redirect, etc.)
    try {
      localStorage.setItem('live:lastFilters', JSON.stringify({
        system: q.get('system') ?? '',
        npf: (q.get('npf') ?? 'true') === 'true',
        adult: (q.get('adult') ?? 'false') === 'true',
        length: Number(q.get('length') ?? '120'),
      }));
    } catch {}

    const exclude = q.get('exclude') || undefined;

    async function getToken(): Promise<string | null> {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    function visible(): boolean {
      return typeof document === 'undefined' ? true : document.visibilityState === 'visible';
    }

    async function callQuickJoin(body: Record<string, unknown>) {
      const token = await getToken();
      if (!token) return { ok: false, status: 401 };

      const res = await fetch(`/api/live/quick-join${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        credentials: 'include',
        keepalive: true,
      });

      if (res.ok) {
        const { gameId } = await res.json();
        if (!cancelledRef.current) router.replace(`/live/${gameId}`);
        return { ok: true, status: 200 };
      }
      return { ok: false, status: res.status };
    }

    async function run() {
      const system = q.get('system') ?? '';
      const npf = (q.get('npf') ?? 'true') === 'true';
      const adult = (q.get('adult') ?? 'false') === 'true';
      const length = Number(q.get('length') ?? '120');

      // ---- PHASE 1: STRICT (first 30s) ----
      setPhase('strict');
      setHint('Searching with your exact filters…');
      while (!cancelledRef.current && Date.now() < strictUntil.current) {
        if (!visible()) { setHint('Paused while in background…'); await sleep(1000); continue; }
        const r = await callQuickJoin({ system, npf, adult, length });
        if (r.ok) return;
        if (r.status === 401) { setHint('Please sign in to join games.'); return; }
        await sleep(2000);
      }

      // ---- PHASE 2: WIDEN BY HOURS (one pass) ----
      setPhase('widening');
      setHint('Expanding the search window by length…');
      const widenMinutes = [60, 120, 180, 240, 300, 360, 420, 480]; // up to 8 hours
      for (const tol of widenMinutes) {
        if (cancelledRef.current) return;
        if (!visible()) { setHint('Paused while in background…'); await sleep(1000); continue; }
        const r = await callQuickJoin({ system, npf, adult, length, toleranceMinutes: tol });
        if (r.ok) return;
        await sleep(2000);
      }

      // ---- PHASE 3: OPEN SEARCH (ignore newbie/adult; continuous) ----
      setPhase('open');
      setHint('No strict match yet — searching broadly…');
      // We'll use the widest tolerance (8h) and ignore flags; keep running forever (until page closes)
      while (!cancelledRef.current) {
        if (!visible()) { setHint('Paused while in background…'); await sleep(1200); continue; }
        const r = await callQuickJoin({ system, length, toleranceMinutes: 480 });
        if (r.ok) return;
        await sleep(3000);
      }
    }

    run();

    visHandler = () => {
      if (document.visibilityState === 'visible') {
        // Nudge the UI hint back to active if we were paused
        setHint(prev =>
          prev.includes('Paused') ? (phase === 'strict'
            ? 'Searching with your exact filters…'
            : phase === 'widening'
              ? 'Expanding the search window by length…'
              : 'No strict match yet — searching broadly…'
          ) : prev
        );
      }
    };
    document.addEventListener('visibilitychange', visHandler);

    return () => {
      cancelledRef.current = true;
      if (visHandler) document.removeEventListener('visibilitychange', visHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col text-white">
      {/* Top buttons */}
      <a
        href="/"
        className="absolute left-1/4 top-6 -translate-x-1/2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
      >
        ttrplobby
      </a>
      <a
        href="/profile"
        className="absolute left-3/4 top-6 -translate-x-1/2 px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 bg-black/30 backdrop-blur"
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
            Please keep this tab open; we&apos;ll connect you automatically when a seat opens.
          </p>

          {/* Live status line */}
          <p className="text-xs text-white/60">
            {hint}
          </p>
        </div>
      </main>

      {/* Footer */}
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

