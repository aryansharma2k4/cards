import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAuthClient } from '@neondatabase/auth'
import { get as game, set as setGame, useGame } from '../game/store'
import { useHistory, type HandRecord, type RoundRecord, type SessionRecord } from '../game/history'

// Public endpoints (not secrets). Override with VITE_NEON_AUTH_URL / VITE_SYNC_URL.
const AUTH_URL =
  import.meta.env.VITE_NEON_AUTH_URL ?? 'https://ep-winter-haze-b3r8ecpd.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth'
const SYNC_URL = (import.meta.env.VITE_SYNC_URL ?? 'https://br-damp-silence-b3m5d1fe-sync.compute.c-4.ap-southeast-1.aws.neon.tech').replace(/\/$/, '')

export const auth = createAuthClient(AUTH_URL)

interface CloudState {
  email: string | null
  status: 'signed-out' | 'idle' | 'syncing' | 'error'
  error: string | null
  lastSync: number | null
}
export const useCloud = create<CloudState>()(
  persist((): CloudState => ({ email: null, status: 'signed-out', error: null, lastSync: null }), {
    name: 'cards:cloud:v1',
    partialize: (s) => ({ email: s.email, lastSync: s.lastSync }),
  }),
)
const setCloud = useCloud.setState

interface RemoteState {
  balance: number | null
  balanceAt: number | null
  sessions: SessionRecord[]
  /** Poker hands and casino rounds (rounds carry a `game` field). */
  hands: (HandRecord | RoundRecord)[]
}

const errMsg = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e))

async function token(): Promise<string> {
  const { data, error } = await auth.token()
  if (error || !data?.token) throw new Error(error?.message ?? 'Not signed in')
  return data.token
}

async function api(path: string, body?: unknown): Promise<RemoteState> {
  const r = await fetch(SYNC_URL + path, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`Sync failed (${r.status})`)
  return r.json()
}

const isRound = (x: HandRecord | RoundRecord): x is RoundRecord => 'game' in x

/** Merge the server's view into local state. Balance: newest write wins, but never while you're seated. */
function merge(remote: RemoteState) {
  const g = game()
  const seated = g.screen !== 'lobby' && g.screen !== 'stats'
  if (remote.balance !== null && remote.balanceAt !== null && remote.balanceAt > g.balanceAt && !seated)
    setGame({ bankroll: remote.balance, balanceAt: remote.balanceAt })
  useHistory.setState((h) => {
    const haveH = new Set(h.hands.map((x) => x.id))
    const haveS = new Set(h.sessions.map((x) => x.id))
    const haveR = new Set(h.rounds.map((x) => x.id))
    const hands = [...h.hands, ...remote.hands.filter((x): x is HandRecord => !isRound(x) && !haveH.has(x.id))].sort((a, b) => a.ts - b.ts).slice(-3000)
    const rounds = [...h.rounds, ...remote.hands.filter((x): x is RoundRecord => isRound(x) && !haveR.has(x.id))].sort((a, b) => a.ts - b.ts).slice(-3000)
    const sessions = [...h.sessions, ...remote.sessions.filter((x) => !haveS.has(x.id))]
    const synced = new Set([...h.synced, ...remote.hands.map((x) => x.id), ...remote.sessions.map((x) => x.id)])
    return { hands, rounds, sessions, synced: [...synced] }
  })
}

let running: Promise<void> | null = null

/** Push unsynced hands/sessions + balance, pull anything new. Safe to call often. */
export function syncNow(): Promise<void> {
  if (useCloud.getState().status === 'signed-out') return Promise.resolve()
  return (running ??= (async () => {
    setCloud({ status: 'syncing', error: null })
    try {
      const { hands, rounds, sessions, synced } = useHistory.getState()
      const done = new Set(synced)
      const newHands = [...hands, ...rounds].filter((h) => !done.has(h.id))
      // sessions change as hands are played, so always resend open/recent ones
      const recent = sessions.filter((s) => !done.has(s.id) || !s.end || s.end > (useCloud.getState().lastSync ?? 0))
      const g = game()
      const since = Math.max(0, ...hands.map((h) => h.ts), ...rounds.map((r) => r.ts))
      let remote: RemoteState | null = null
      for (let i = 0; i === 0 || i < newHands.length; i += 1000) {
        remote = await api(`/sync?since=${since}`, {
          balance: g.bankroll + g.seated,
          balanceAt: g.balanceAt || 1,
          sessions: i === 0 ? recent : [],
          hands: newHands.slice(i, i + 1000),
        })
      }
      useHistory.setState((h) => ({ synced: [...new Set([...h.synced, ...newHands.map((x) => x.id), ...recent.map((x) => x.id)])] }))
      merge(remote!)
      setCloud({ status: 'idle', lastSync: Date.now() })
    } catch (e) {
      setCloud({ status: 'error', error: errMsg(e) })
    } finally {
      running = null
    }
  })())
}

/** First sync on a device: pull everything the account has. */
async function pullAll() {
  merge(await api('/state?since=0'))
}

export async function signIn(email: string, password: string, create: boolean) {
  setCloud({ status: 'syncing', error: null })
  const res = create
    ? await auth.signUp.email({ email, password, name: email.split('@')[0] })
    : await auth.signIn.email({ email, password })
  if (res.error) {
    setCloud({ status: 'signed-out', error: res.error.message ?? 'Sign-in failed' })
    return false
  }
  setCloud({ email, status: 'syncing' }) // stays "Syncing…" until the first round trip is done
  try {
    await pullAll()
  } catch (e) {
    setCloud({ status: 'error', error: errMsg(e) })
  }
  await syncNow()
  return true
}

export async function signOut() {
  await auth.signOut().catch(() => {})
  setCloud({ email: null, status: 'signed-out', error: null })
}

/** Restore the session on load and keep syncing in the background. */
let started = false
export async function startCloud() {
  if (started) return
  started = true
  let t: ReturnType<typeof setTimeout> | undefined
  const soon = () => {
    clearTimeout(t)
    t = setTimeout(() => void syncNow(), 2000)
  }
  useHistory.subscribe((s, p) => (s.hands !== p.hands || s.rounds !== p.rounds) && soon()) // after each hand or round
  // leaving a table syncs right away; any other change to your money (rebuy, reset) shortly after
  useGame.subscribe((s, p) => {
    if (s.screen !== p.screen && s.screen === 'lobby') void syncNow()
    else if (s.balanceAt !== p.balanceAt || s.screen !== p.screen) soon()
  })
  window.addEventListener('focus', soon)
  // coming back to the app pulls, leaving it (home button, tab switch) pushes, plus a quiet pull every minute
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? soon() : void syncNow()))
  setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60_000)

  const { data } = await auth.getSession().catch(() => ({ data: null }))
  if (!data?.user) return setCloud({ status: 'signed-out' })
  setCloud({ email: data.user.email, status: 'idle' })
  await syncNow()
}
