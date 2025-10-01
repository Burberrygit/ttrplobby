'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Game = {
  id: string
  host_id: string
  title: string | null
  system: string | null
  seats: number | null
}

type Application = {
  id: string
  listing_id: string
  player_id: string
  status: string
  answers: any
  fit_score?: number | null
  created_at: string
  dm_decision?: any
}

export default function ApplicationDetailPage() {
  const router = useRouter()
  const { id, appId } = useParams<{ id: string, appId: string }>()
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Accept modal
  const [showAccept, setShowAccept] = useState(false)
  const [acceptDetails, setAcceptDetails] = useState('')
  const [discordInvite, setDiscordInvite] = useState('')
  const [vttLink, setVttLink] = useState('')
  const [busy, setBusy] = useState(false)

  // Decline modal (optional message)
  const [showDecline, setShowDecline] = useState(false)
  const [declineMsg, setDeclineMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=' + encodeURIComponent(`/dm/games/${id}/apps/${appId}`))
        return
      }
      setMe({ id: user.id })
    })()
  }, [id, appId, router])

  useEffect(() => {
    if (!me) return
    ;(async () => {
      try {
        setLoading(true)
        const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', id).single()
        if (gErr) throw gErr
        if (g.host_id !== me.id) throw new Error('You are not the host of this game.')
        setGame(g as Game)

        const { data: a, error: aErr } = await supabase
          .from('applications').select('*').eq('id', appId).single()
        if (aErr) throw aErr
        if (a.listing_id !== id) throw new Error('Application does not belong to this game.')
        setApp(a as Application)
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load application')
      } finally {
        setLoading(false)
      }
    })()
  }, [me, id, appId])

  const accept = async () => {
    if (!app || !game) return
    setBusy(true); setErrorMsg(null)
    try {
      // 1) Add player to game_players via RPC (handles player_id vs user_id, ignores duplicates)
      await supabase.rpc('add_player_to_game', {
        p_game_id: game.id,
        p_player_id: app.player_id,
      })
      // (Optional fallback if RPC not deployed yet)
      // .catch(async () => {
      //   try {
      //     await supabase.from('game_players').insert({ game_id: game.id, player_id: app.player_id })
      //   } catch {
      //     await supabase.from('game_players').insert({ game_id: game.id, user_id: app.player_id })
      //   }
      // })

      // 2) Update application status + decision payload
      const decision = {
        accepted_at: new Date().toISOString(),
        details: acceptDetails,
        discord_invite: discordInvite,
        vtt_link: vttLink,
      }
      let { error: upErr } = await supabase
        .from('applications')
        .update({ status: 'accepted', dm_decision: decision })
        .eq('id', app.id)

      // Fallback if schema cache hasn't picked up dm_decision yet
      if (upErr) {
        const msg = String(upErr.message || '').toLowerCase()
        if (msg.includes('dm_decision')) {
          const { error: upErr2 } = await supabase
            .from('applications')
            .update({ status: 'accepted' })
            .eq('id', app.id)
          if (upErr2) throw upErr2
        } else {
          throw upErr
        }
      }

      // 3) Notify the player
      const title = `You're in! Accepted to ${game.title ?? 'a game'}`
      const body = (acceptDetails || '').trim().length
        ? acceptDetails
        : 'You have been added to the game. See the links below to join the table.'
      const { error: nErr } = await supabase.from('notifications').insert({
        user_id: app.player_id,
        type: 'application_accepted',
        title,
        body,
        data: {
          game_id: game.id,
          discord_invite: discordInvite || null,
          vtt_link: vttLink || null,
          application_id: app.id,
        },
      })
      if (nErr) throw nErr

      // 4) Done → back to Kanban
      router.push(`/dm/games/${game.id}/apps`)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to accept application')
    } finally {
           setBusy(false)
    }
  }

  const decline = async () => {
    if (!app || !game) return
    setBusy(true); setErrorMsg(null)
    try {
      const decision = {
        declined_at: new Date().toISOString(),
        message: declineMsg || null
      }
      let { error: upErr } = await supabase
        .from('applications')
        .update({ status: 'declined', dm_decision: decision })
        .eq('id', app.id)

      // Fallback if schema cache hasn't picked up dm_decision yet
      if (upErr) {
        const msg = String(upErr.message || '').toLowerCase()
        if (msg.includes('dm_decision')) {
          const { error: upErr2 } = await supabase
            .from('applications')
            .update({ status: 'declined' })
            .eq('id', app.id)
          if (upErr2) throw upErr2
        } else {
          throw upErr
        }
      }

      // notify
      const { error: nErr } = await supabase.from('notifications').insert({
        user_id: app.player_id,
        type: 'application_declined',
        title: `Application update for ${game.title ?? 'a game'}`,
        body: declineMsg || 'Thanks for applying! Unfortunately the table is full or not a match this time.',
        data: { game_id: game.id, application_id: app.id },
      })
      if (nErr) throw nErr

      router.push(`/dm/games/${game.id}/apps`)
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to decline application')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-white/70">Loading…</div>
  }
  if (errorMsg) {
    return <div className="min-h-screen grid place-items-center text-red-400">{errorMsg}</div>
  }
  if (!app || !game) return null

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        {/* Top bar — ttrplobby (left) + Profile (right) */}
        <div className="mb-4 flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
            <LogoIcon /><span className="font-semibold">ttrplobby</span>
          </a>
          <a href="/profile" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition">
            <span className="font-semibold">Profile</span>
          </a>
        </div>

        <h1 className="text-2xl font-bold mt-2">{game.title || 'Untitled game'}</h1>
        <p className="text-white/70">{game.system || 'TTRPG'}</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 grid gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="px-2 py-0.5 rounded-lg border border-white/20">Status: {app.status}</span>
            {typeof app.fit_score === 'number' ? <span className="px-2 py-0.5 rounded-lg border border-white/20">Fit {app.fit_score}</span> : null}
            <span className="text-white/60">Applied {formatDateTime(app.created_at)}</span>
          </div>

          {/* Applicant Answers (human-readable, no code blocks) */}
          <section>
            <h2 className="text-sm font-semibold">Applicant Answers</h2>
            <div className="mt-2 rounded-xl bg-black/30 border border-white/10 p-3">
              {renderAnswers(app.answers)}
            </div>
          </section>

          {/* Decision (human-readable, no code blocks) */}
          {app.dm_decision ? (
            <section>
              <h2 className="text-sm font-semibold">Decision</h2>
              <div className="mt-2 rounded-xl bg-black/30 border border-white/10 p-3">
                {renderDecision(app.dm_decision)}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowAccept(true)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60" disabled={busy || app.status === 'accepted'}>
              Accept
            </button>
            <button onClick={() => setShowDecline(true)} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60" disabled={busy || app.status === 'declined'}>
              Decline
            </button>
            <a href={`/dm/games/${game.id}/apps`} className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40">Back</a>
          </div>

          {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}
        </div>
      </div>

      {/* Pinned footer */}
      <footer className="border-t border-white/10 px-6">
        <div className="max-w-3xl mx-auto w-full py-6 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2025 ttrplobby</div>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/contact" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </footer>

      {/* Accept Modal */}
      {showAccept && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-4">
            <h3 className="text-lg font-semibold">Send details to the player</h3>
            <p className="text-white/70 text-sm mt-1">These will be included in the acceptance notification.</p>

            <label className="grid gap-1 text-sm mt-3">
              <span>Details (session 0 info, expectations, schedule, etc.)</span>
              <textarea
                rows={5}
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                value={acceptDetails}
                onChange={e => setAcceptDetails(e.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm mt-3">
              <span>Discord invite link (optional)</span>
              <input
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                placeholder="https://discord.gg/…"
                value={discordInvite}
                onChange={e => setDiscordInvite(e.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm mt-3">
              <span>Virtual Tabletop link (optional)</span>
              <input
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                placeholder="Foundry/Roll20/FG link…"
                value={vttLink}
                onChange={e => setVttLink(e.target.value)}
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowAccept(false)} className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">Cancel</button>
              <button onClick={accept} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60">
                {busy ? 'Sending…' : 'Accept & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDecline && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-4">
            <h3 className="text-lg font-semibold">Add a note (optional)</h3>
            <label className="grid gap-1 text-sm mt-3">
              <span>Message to applicant</span>
              <textarea
                rows={4}
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-white/10"
                value={declineMsg}
                onChange={e => setDeclineMsg(e.target.value)}
                placeholder="Thanks for applying! The table is full at the moment…"
              />
            </label>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowDecline(false)} className="px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40">Cancel</button>
              <button onClick={decline} disabled={busy} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60">
                {busy ? 'Sending…' : 'Decline & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------- render helpers ---------------------------- */

function renderAnswers(ans: any) {
  if (!ans || typeof ans !== 'object') {
    return <div className="text-sm text-white/70">No answers provided.</div>
  }
  const entries = Object.entries(ans).filter(
    ([k, v]) =>
      k !== 'playstyle' && // remove Playstyle section entirely
      v !== null && v !== undefined && String(v).trim() !== ''
  )
  if (!entries.length) return <div className="text-sm text-white/70">No answers provided.</div>

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-white/60">{labelForKey(k)}</dt>
          <dd className="mt-0.5 text-sm break-words">{formatAnswer(k, v)}</dd>
        </div>
      ))}
    </dl>
  )
}

function renderDecision(dec: any) {
  const d = dec || {}
  const items: Array<{ k: string; v: any }> = [
    { k: 'accepted_at', v: d.accepted_at },
    { k: 'declined_at', v: d.declined_at },
    { k: 'details', v: d.details },
    { k: 'discord_invite', v: d.discord_invite },
    { k: 'vtt_link', v: d.vtt_link },
    { k: 'message', v: d.message },
  ].filter(x => x.v !== null && x.v !== undefined && String(x.v).trim() !== '')

  if (!items.length) return <div className="text-sm text-white/70">No decision details.</div>

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {items.map(({ k, v }) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-white/60">{labelForKey(k)}</dt>
          <dd className="mt-0.5 text-sm break-words">
            {k === 'accepted_at' || k === 'declined_at'
              ? formatDateTime(v)
              : isUrl(String(v))
                ? <a href={String(v)} target="_blank" rel="noreferrer" className="underline hover:text-white">{String(v)}</a>
                : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function labelForKey(k: string) {
  switch (k) {
    case 'notes': return 'Notes'
    case 'timezone': return 'Time zone'
    case 'playstyle': return 'Playstyle'
    case 'experience': return 'Experience'
    case 'accepted_at': return 'Accepted at'
    case 'declined_at': return 'Declined at'
    case 'details': return 'Details'
    case 'discord_invite': return 'Discord invite'
    case 'vtt_link': return 'Virtual Tabletop'
    case 'message': return 'Message'
    default:
      return k.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

function formatAnswer(k: string, v: any) {
  if (k === 'playstyle' && typeof v === 'number') return `${v}/5`
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function formatDateTime(input: any) {
  try {
    return new Date(String(input)).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(input)
  }
}

function isUrl(s: string) {
  try { const u = new URL(s); return Boolean(u.protocol && u.host) } catch { return false }
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}
