'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100 p-8">
      <h1 className="text-5xl font-extrabold mb-4">
        Welcome to <span className="text-emerald-400">TTRP Lobby</span>
      </h1>
      <p className="text-lg max-w-2xl opacity-80 mb-8">
        Instantly find and join tabletop RPG games, or schedule your next adventure. 
        Create a profile, connect with players, and jump into a lobby within minutes. 
        Supporting D&D, Pathfinder, and dozens more — as many as Roll20.
      </p>

      <div className="flex gap-4 flex-wrap justify-center">
        <Link href="/signup" className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500">
          Get Started
        </Link>
        <Link href="/lobbies" className="px-6 py-3 rounded-lg bg-zinc-800 text-zinc-100 font-medium hover:bg-zinc-700">
          Browse Lobbies
        </Link>
        <Link href="/schedule" className="px-6 py-3 rounded-lg bg-zinc-800 text-zinc-100 font-medium hover:bg-zinc-700">
          Scheduled Games
        </Link>
      </div>

      <div className="mt-16 grid sm:grid-cols-3 gap-8 text-left max-w-5xl">
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-xl font-semibold mb-2">🎲 Instant Lobbies</h3>
          <p className="text-sm opacity-80">Join a game starting within the hour. Meet other players in a real-time chat lobby and dive in quickly.</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-xl font-semibold mb-2">📅 Scheduled Games</h3>
          <p className="text-sm opacity-80">Plan your campaign sessions ahead of time. Search and filter scheduled games across multiple TTRPG systems.</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-xl font-semibold mb-2">🧑‍🤝‍🧑 Player Profiles</h3>
          <p className="text-sm opacity-80">Build a profile with avatar and username. Track games you’ve played and show off your TTRPG experience.</p>
        </div>
      </div>

      <footer className="mt-24 text-sm opacity-60">
        © {new Date().getFullYear()} TTRP Lobby. All rights reserved.
      </footer>
    </div>
  )
}
