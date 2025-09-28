'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const SYSTEMS = [
  { value: 'dnd5e', label: 'D&D 5e' },
  { value: 'pf2e', label: 'Pathfinder 2e' },
  { value: 'pf1', label: 'Pathfinder 1e' },
  { value: 'generic', label: 'Generic TTRPG' },
];

export default function QuickJoinPage() {
  const router = useRouter();
  const [system, setSystem] = useState('dnd5e');
  const [newbie, setNewbie] = useState(true);
  const [adult, setAdult] = useState(false);
  const [lengthMin, setLengthMin] = useState(120);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      system,
      npf: String(newbie),
      adult: String(adult),
      length: String(lengthMin),
    });
    router.push(`/live/search?${params.toString()}`);
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl rounded-2xl shadow-lg border p-6 grid gap-5"
      >
        <h1 className="text-2xl font-semibold">Quick Join a Live Game</h1>
        <p className="text-sm opacity-80">
          Pick your preferences and we’ll drop you into the first open table that matches.
        </p>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Game system</span>
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            {SYSTEMS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={newbie}
              onChange={(e) => setNewbie(e.target.checked)}
            />
            <span className="text-sm">New-player friendly</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
            />
            <span className="text-sm">18+ content</span>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Length (minutes)</span>
          <input
            type="number"
            min={30}
            step={15}
            value={lengthMin}
            onChange={(e) => setLengthMin(Number(e.target.value))}
            className="border rounded-lg px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-xl px-4 py-2 bg-black text-white hover:opacity-90"
        >
          Join
        </button>
      </form>
    </main>
  );
}
