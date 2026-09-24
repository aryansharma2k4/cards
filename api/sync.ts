/**
 * cards sync API: a Neon Function next to the Postgres branch.
 *
 * Clients (the web app now, a phone app later) sign in with Neon Auth and call
 * this with `Authorization: Bearer <jwt>`. Every query is scoped to the token's
 * `sub`, so a user can only ever read or write their own rows.
 *
 *   GET  /state?since=<ms>  → { balance, balanceAt, sessions, hands }
 *   POST /sync              ← { balance, balanceAt, sessions, hands } → same as GET /state
 *
 * Balance is last-write-wins by `balanceAt` (client clock, ms). Hands and
 * sessions are keyed by client-generated UUIDs, so re-sending is harmless.
 */
import { Pool } from 'pg'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { attachDatabasePool } from '@neon/functions'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
attachDatabasePool(pool)

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!))
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin

const SCHEMA = `
create table if not exists profiles (
  user_id    text primary key,
  balance    bigint not null check (balance >= 0),
  balance_at bigint not null,
  updated_at timestamptz not null default now()
);
create table if not exists sessions (
  id       uuid primary key,
  user_id  text not null,
  started  timestamptz not null,
  data     jsonb not null
);
create index if not exists sessions_user on sessions (user_id, started);
create table if not exists hands (
  id         uuid primary key,
  user_id    text not null,
  session_id uuid not null,
  ts         timestamptz not null,
  net        bigint not null,
  data       jsonb not null
);
create index if not exists hands_user_ts on hands (user_id, ts);
`
let ready: Promise<unknown> | null = null
const migrate = () => (ready ??= pool.query(SCHEMA).catch((e) => ((ready = null), Promise.reject(e))))

// ---- input validation (this is a public URL; trust nothing) ----

const MAX_BALANCE = 1e15
const MAX_ITEMS = 2000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isInt = (n: unknown, max = MAX_BALANCE): n is number => Number.isSafeInteger(n) && Math.abs(n as number) <= max
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

interface SessionIn {
  id: string
  start: number
  [k: string]: unknown
}
interface HandIn {
  id: string
  sessionId: string
  ts: number
  net: number
  [k: string]: unknown
}

function parseBody(b: unknown) {
  if (!obj(b)) throw new Error('body must be an object')
  const { balance, balanceAt, sessions = [], hands = [] } = b
  if (balance !== undefined && (!isInt(balance) || (balance as number) < 0)) throw new Error('bad balance')
  if (balance !== undefined && !isInt(balanceAt, 1e14)) throw new Error('bad balanceAt')
  if (!Array.isArray(sessions) || sessions.length > MAX_ITEMS) throw new Error('bad sessions')
  if (!Array.isArray(hands) || hands.length > MAX_ITEMS) throw new Error('bad hands')
  for (const s of sessions as unknown[])
    if (!obj(s) || typeof s.id !== 'string' || !UUID.test(s.id) || !isInt(s.start, 1e14)) throw new Error('bad session')
  for (const h of hands as unknown[])
    if (!obj(h) || typeof h.id !== 'string' || !UUID.test(h.id) || typeof h.sessionId !== 'string' || !UUID.test(h.sessionId) || !isInt(h.ts, 1e14) || !isInt(h.net))
      throw new Error('bad hand')
  return {
    balance: balance as number | undefined,
    balanceAt: balanceAt as number | undefined,
    sessions: sessions as SessionIn[],
    hands: hands as HandIn[],
  }
}

// ---- handlers ----

async function readState(user: string, since: number) {
  const [p, s, h] = await Promise.all([
    pool.query('select balance, balance_at from profiles where user_id = $1', [user]),
    pool.query('select data from sessions where user_id = $1 order by started', [user]),
    pool.query('select data from hands where user_id = $1 and ts > to_timestamp($2 / 1000.0) order by ts limit 20000', [user, since]),
  ])
  return {
    balance: p.rows[0] ? Number(p.rows[0].balance) : null,
    balanceAt: p.rows[0] ? Number(p.rows[0].balance_at) : null,
    sessions: s.rows.map((r) => r.data),
    hands: h.rows.map((r) => r.data),
  }
}

async function writeState(user: string, body: ReturnType<typeof parseBody>) {
  const c = await pool.connect()
  try {
    await c.query('begin')
    if (body.balance !== undefined)
      await c.query(
        `insert into profiles (user_id, balance, balance_at) values ($1, $2, $3)
         on conflict (user_id) do update set balance = excluded.balance, balance_at = excluded.balance_at, updated_at = now()
         where profiles.balance_at < excluded.balance_at`,
        [user, body.balance, body.balanceAt],
      )
    for (const s of body.sessions)
      await c.query(
        `insert into sessions (id, user_id, started, data) values ($1, $2, to_timestamp($3 / 1000.0), $4)
         on conflict (id) do update set data = excluded.data where sessions.user_id = $2`,
        [s.id, user, s.start, s],
      )
    if (body.hands.length)
      await c.query(
        `insert into hands (id, user_id, session_id, ts, net, data)
         select (h->>'id')::uuid, $1, (h->>'sessionId')::uuid, to_timestamp((h->>'ts')::bigint / 1000.0), (h->>'net')::bigint, h
         from jsonb_array_elements($2::jsonb) h
         on conflict (id) do nothing`,
        [user, JSON.stringify(body.hands)],
      )
    await c.query('commit')
  } catch (e) {
    await c.query('rollback')
    throw e
  } finally {
    c.release()
  }
}

// ---- HTTP ----

const cors = (req: Request) => ({
  'access-control-allow-origin': req.headers.get('origin') ?? '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
  vary: 'origin',
})
const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(req) } })

async function userOf(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  try {
    const { payload } = await jwtVerify(auth.slice(7), jwks, { issuer })
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
    const url = new URL(req.url)
    if (url.pathname === '/health') return json(req, { ok: true })

    const user = await userOf(req)
    if (!user) return json(req, { error: 'unauthorized' }, 401)
    await migrate()

    if (req.method === 'GET' && url.pathname === '/state') {
      const since = Number(url.searchParams.get('since') ?? 0)
      return json(req, await readState(user, Number.isFinite(since) ? since : 0))
    }
    if (req.method === 'POST' && url.pathname === '/sync') {
      if (Number(req.headers.get('content-length') ?? 0) > 5_000_000) return json(req, { error: 'too large' }, 413)
      let body
      try {
        body = parseBody(await req.json())
      } catch (e) {
        return json(req, { error: (e as Error).message }, 400)
      }
      await writeState(user, body)
      return json(req, await readState(user, Number(url.searchParams.get('since') ?? 0) || 0))
    }
    return json(req, { error: 'not found' }, 404)
  },
}
