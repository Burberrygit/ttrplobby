'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ProfilePage() {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('profiles').select('username').eq('id', data.user.id).single()
          .then(({ data, error }) => {
            if (!error && data) setUsername(data.username || '')
          })
      }
    })
  }, [])

  async function saveProfile() {
    if (!user) return
    const { error } = await supabase.from('profiles')
      .update({ username })
      .eq('id', user.id)
    setStatus(error ? error.message : 'Saved!')
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!user) return <p className="text-center mt-20">Not signed in</p>

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Your Profile</h1>
        <input
          type="text"
          value={username}
          onChange={(e)=>setUsername(e.target.value)}
          placeholder="Username"
          className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 mb-3"
        />
        <button
          onClick={saveProfile}
          className="w-full px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium"
        >
          Save
        </button>
        <button
          onClick={signOut}
          className="w-full px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 font-medium mt-3"
        >
          Sign out
        </button>
        <p className="text-sm text-zinc-400 mt-4">{status}</p>
      </div>
    </div>
  )
}
