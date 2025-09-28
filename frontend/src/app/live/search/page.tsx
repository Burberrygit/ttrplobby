'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function LiveSearchPage() {
  const router = useRouter();
  const q = useSearchParams();
  const [status, setStatus] = useState<'searching'|'expanding'|'failed'>('searching');
  const stopAt = useRef<number>(Date.now() + 60_000); // try up to 60s

  useEffect(() => {
    let cancelled = false;

    async function tryOnce(body: Record<string, unknown>) {
      const res = await fetch('/api/live/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (res.ok) {
        const { gameId } = await res.json();
        if (!cancelled) router.replace(`/live/${gameId}`);
        return true;
      }
      return false;
    }

    async function loop() {
      const base = {
        system: q.get('system') ?? 'dnd5e',
        newPlayerFriendly: (q.get('npf') ?? 'true') === 'true',
        adult: (q.get('adult') ?? 'false') === 'true',
        lengthMinutes: Number(q.get('length') ?? '120'),
      };

      // initial strict search
      if (await tryOnce({ ...base, widen: false })) return;

      setStatus('expanding');

      // progressively widen length tolerance, then relax flags
      const tolerances = [15, 30, 45, 60];
      for (const tol of tolerances) {
        if (Date.now() > stopAt.current) break;
        if (await tryOnce({ ...base, toleranceMinutes: tol, widen: true })) return;
        await new Promise(r => setTimeout(r, 1500));
      }

      // final pass: ignore newbie/adult flags but keep system
      if (Date.now() <= stopAt.current) {
        if (await tryOnce({ ...base, ignoreFlags: true, widen: true })) return;
      }

      setStatus('failed');
    }

    loop();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative w-28 h-28">
          {/* The logo should exist at /public/logo.png in your repo */}
          <Image
            src="/logo.png"
            alt="TTRPLobby"
            fill
            className="animate-spin-slow object-contain"
            priority
          />
        </div>
        <h1 className="text-xl font-semibold">
          {status === 'searching' ? 'Searching for active games…' :
           status === 'expanding' ? 'Expanding search…' :
           'No matching games found right now'}
        </h1>
        <p className="text-sm opacity-80 max-w-prose">
          {status === 'failed'
            ? 'Try again in a minute, tweak your filters, or create a new live game.'
            : 'Hang tight while we look for an open table that fits your preferences.'}
        </p>
      </div>

      <style jsx global>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 2.5s linear infinite; }
      `}</style>
    </main>
  );
}
