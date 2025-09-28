'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LiveSearchPage() {
  const router = useRouter();
  const q = useSearchParams();
  const [status, setStatus] = useState<'searching'|'expanding'|'failed'>('searching');
  const stopAt = useRef<number>(Date.now() + 60_000); // try up to 60s

  useEffect(() => {
    let cancelled = false;

    async function callApi(body: Record<string, unknown>) {
      // Get the current session token to authenticate the API request
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return { ok: false, status: 401 };

      const res = await fetch('/api/live/quick-join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass the Supabase access token for server-side user resolution
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
    <main className="min-h-[70vh] flex items-center justify-center p-6">
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

