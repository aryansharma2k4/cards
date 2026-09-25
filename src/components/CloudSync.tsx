import { useState } from 'react'
import { signIn, signOut, syncNow, useCloud } from '../cloud/sync'
import { Button } from './ui/kit'

const ago = (t: number | null) => {
  if (!t) return null
  const s = Math.round((Date.now() - t) / 1000)
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString()
}

/** Account + sync controls (lives in Settings). */
export function CloudSync() {
  const { email, status, error, lastSync } = useCloud()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const go = async (create: boolean) => {
    setBusy(true)
    await signIn(form.email.trim(), form.password, create)
    setBusy(false)
  }

  if (status !== 'signed-out' && email)
    return (
      <div className="space-y-2">
        <p className="text-[14px] text-[#efe6cf]">
          Signed in as <b>{email}</b>
        </p>
        <p className="text-[13px] text-[#bfb49a]" aria-live="polite">
          {status === 'syncing' ? 'Syncing…' : status === 'error' ? `Couldn't sync: ${error}` : lastSync ? `Balance and hands synced ${ago(lastSync)}` : 'Not synced yet'}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="felt" onClick={() => void syncNow()} disabled={status === 'syncing'}>
            Sync now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    )

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        void go(false)
      }}
    >
      <p className="text-[13px] text-[#bfb49a]">Sign in to keep your balance and hand history in sync across devices.</p>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        aria-label="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="h-10 w-full rounded-xl bg-black/35 px-3 text-[15px] text-[#f8f4ea] ring-1 ring-[#d4af5a]/30 placeholder:text-[#8d8471] focus:ring-[#f3dc9a]"
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete="current-password"
        placeholder="Password (8+ characters)"
        aria-label="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        className="h-10 w-full rounded-xl bg-black/35 px-3 text-[15px] text-[#f8f4ea] ring-1 ring-[#d4af5a]/30 placeholder:text-[#8d8471] focus:ring-[#f3dc9a]"
      />
      {error && (
        <p className="text-[13px] text-[#ffb4a8]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="gold" disabled={busy}>
          Sign in
        </Button>
        <Button type="button" size="sm" variant="wood" disabled={busy || !form.email || form.password.length < 8} onClick={() => void go(true)}>
          Create account
        </Button>
      </div>
    </form>
  )
}

/** Tiny status line for the lobby. */
export function CloudBadge() {
  const { email, status, lastSync } = useCloud()
  if (status === 'signed-out' || !email) return null
  return (
    <span className="text-[12px] text-[#9d937c]" title={email}>
      {status === 'syncing' ? 'Syncing…' : status === 'error' ? 'Sync paused' : lastSync ? `Synced ${ago(lastSync)}` : 'Not synced yet'}
    </span>
  )
}
