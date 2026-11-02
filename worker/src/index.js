// La Pioche sync API — a Cloudflare Worker with a D1 database.
//
// The app does all the merging (see "Sync, part 1" in index.html); this server keeps
// the latest agreed copy of each progress store and a version number for the whole
// set. A save names the version it was based on, and is refused (409) if another
// device saved in between — that device then fetches, merges again and retries, so
// two devices saving at once can never overwrite each other's practice.
//
// Sign-in: the app gets a Google ID token ("Sign in with Google") and exchanges it
// here for a long-lived session. The token's RS256 signature is checked against
// Google's public keys; it must come from Google, be issued for this app
// (GOOGLE_CLIENT_ID), be unexpired, and carry a verified email on the allow-list
// (ALLOWED_EMAILS, a Worker secret — with none set, nobody can sign in). Sessions are
// random 32-byte tokens, sent as "Authorization: Bearer <token>"; only their SHA-256
// hash is stored. Each Google account has its own space.
//
//   GET    /v1/config     → { googleClientId }
//   POST   /v1/session    ← { credential } → { token, email, expiresAt }
//   DELETE /v1/session    → sign this device out
//   GET    /v1/progress   → { version, items: { key: { v, e } } }
//   PUT    /v1/progress   ← { baseVersion, items: { key: { v, e } } } → { version }
//   DELETE /v1/space      → delete everything stored for this account

const ALLOWED_ORIGINS = ['https://nassim55.github.io'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{24,128}$/;
const STORE_RE = /^[a-z0-9:_-]{1,80}$/;
const MAX_BODY = 1_500_000;   // bytes; all of a heavy user's progress is far smaller
const MAX_STORES = 200;
const SESSION_DAYS = 365;
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin) && !LOCAL_ORIGIN.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
const json = (request, status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(request) }
});

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
const b64urlBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const b64urlJSON = s => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
function newToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Google's signing keys, cached for as long as Google says they're good (max a day)
let jwksCache = { keys: null, until: 0 };
async function googleKeys() {
  if (jwksCache.keys && Date.now() < jwksCache.until) return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`google keys ${res.status}`);
  const body = await res.json();
  const age = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '');
  jwksCache = { keys: Array.isArray(body.keys) ? body.keys : [], until: Date.now() + Math.min(age ? +age[1] : 3600, 86400) * 1000 };
  return jwksCache.keys;
}
// The claims of a genuine, current Google ID token issued for this app — or null
async function verifyGoogleCredential(credential, env) {
  if (typeof credential !== 'string' || credential.length > 4096 || !env.GOOGLE_CLIENT_ID) return null;
  const parts = credential.split('.');
  if (parts.length !== 3) return null;
  let header, claims;
  try { header = b64urlJSON(parts[0]); claims = b64urlJSON(parts[1]); } catch (e) { return null; }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
  const jwk = (await googleKeys()).find(k => k && k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) return null;
  let valid = false;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  } catch (e) { return null; }
  if (!valid || !claims || typeof claims !== 'object') return null;
  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.has(claims.iss) || claims.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now - 30) return null;
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string') return null;
  if (claims.email_verified !== true && claims.email_verified !== 'true') return null;
  return claims;
}
const allowedEmails = env => new Set(String(env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

async function readBody(request) {
  const length = +(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY) return { tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY) return { tooLarge: true };
  try { return { body: JSON.parse(text) }; } catch (e) { return { body: null }; }
}
async function session(request, env) {
  const m = /^Bearer (.+)$/.exec(request.headers.get('Authorization') || '');
  if (!m || !TOKEN_RE.test(m[1])) return null;
  const hash = await sha256(m[1]);
  const row = await env.DB.prepare('SELECT space_id, expires_at FROM sessions WHERE token_hash = ?').bind(hash).first();
  if (!row || row.expires_at < Date.now()) return null;
  return { spaceId: row.space_id, hash };
}

// A save's items: known-shaped keys, JSON values (or null), whole-number epochs
function validItems(items) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return null;
  const entries = Object.entries(items);
  if (entries.length > MAX_STORES) return null;
  const out = [];
  for (const [key, item] of entries) {
    if (!STORE_RE.test(key) || !item || typeof item !== 'object') return null;
    const e = item.e === undefined ? 0 : item.e;
    if (!Number.isInteger(e) || e < 0) return null;
    if (item.v !== null && (typeof item.v !== 'object' || Array.isArray(item.v))) return null;
    out.push([key, item.v === null ? null : JSON.stringify(item.v), e]);
  }
  return out;
}

async function signIn(request, env) {
  const { body, tooLarge } = await readBody(request);
  if (tooLarge) return json(request, 413, { error: 'too-large' });
  const claims = await verifyGoogleCredential(body && body.credential, env);
  if (!claims) return json(request, 401, { error: 'bad-credential' });
  if (!allowedEmails(env).has(claims.email.toLowerCase())) return json(request, 403, { error: 'not-allowed' });
  const db = env.DB, now = Date.now(), token = newToken(), expiresAt = now + SESSION_DAYS * 86400000;
  const spaceId = await sha256(`google:${claims.sub}`);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    db.prepare('INSERT OR IGNORE INTO spaces (id, version, created_at, updated_at) VALUES (?, 0, ?, ?)').bind(spaceId, now, now),
    db.prepare('INSERT INTO sessions (token_hash, space_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256(token), spaceId, claims.email, now, expiresAt)
  ]);
  return json(request, 200, { token, email: claims.email, expiresAt });
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  const route = `${request.method} ${url.pathname}`;
  if (route === 'GET /v1/config') return json(request, 200, { googleClientId: env.GOOGLE_CLIENT_ID || null });
  if (route === 'POST /v1/session') return signIn(request, env);
  if (!['DELETE /v1/session', 'GET /v1/progress', 'PUT /v1/progress', 'DELETE /v1/space'].includes(route)) {
    return json(request, 404, { error: 'not-found' });
  }
  const s = await session(request, env);
  if (!s) return json(request, 401, { error: 'signed-out' });
  const db = env.DB, id = s.spaceId, now = Date.now();

  if (route === 'DELETE /v1/session') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(s.hash).run();
    return json(request, 200, { signedOut: true });
  }
  const space = await db.prepare('SELECT version FROM spaces WHERE id = ?').bind(id).first();
  if (!space) return json(request, 404, { error: 'no-space' });

  if (route === 'GET /v1/progress') {
    const { results } = await db.prepare('SELECT key, value, epoch FROM items WHERE space_id = ?').bind(id).all();
    const items = {};
    for (const r of results) items[r.key] = { v: r.value === null ? null : JSON.parse(r.value), e: r.epoch };
    return json(request, 200, { version: space.version, items });
  }

  if (route === 'DELETE /v1/space') {
    await db.batch([
      db.prepare('DELETE FROM items WHERE space_id = ?').bind(id),
      db.prepare('DELETE FROM sessions WHERE space_id = ?').bind(id),
      db.prepare('DELETE FROM spaces WHERE id = ?').bind(id)
    ]);
    return json(request, 200, { deleted: true });
  }

  // PUT /v1/progress
  const { body, tooLarge } = await readBody(request);
  if (tooLarge) return json(request, 413, { error: 'too-large' });
  const base = body && body.baseVersion;
  const items = body && validItems(body.items);
  if (!Number.isInteger(base) || base < 0 || !items) return json(request, 400, { error: 'bad-request' });
  if (base !== space.version) return json(request, 409, { error: 'conflict', version: space.version });
  // Every write is conditional on the version still being `base`, and the version bump
  // comes last: if another save got in first, none of this batch changes anything
  const guard = 'EXISTS (SELECT 1 FROM spaces WHERE id = ? AND version = ?)';
  const statements = items.map(([key, value, epoch]) => db.prepare(
    `INSERT INTO items (space_id, key, value, epoch, updated_at) SELECT ?, ?, ?, ?, ? WHERE ${guard}
     ON CONFLICT (space_id, key) DO UPDATE SET value = excluded.value, epoch = excluded.epoch, updated_at = excluded.updated_at`
  ).bind(id, key, value, epoch, now, id, base));
  statements.push(db.prepare('UPDATE spaces SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?').bind(now, id, base));
  const results = await db.batch(statements);
  if (results[results.length - 1].meta.changes !== 1) {
    const current = await db.prepare('SELECT version FROM spaces WHERE id = ?').bind(id).first();
    return json(request, 409, { error: 'conflict', version: current ? current.version : null });
  }
  return json(request, 200, { version: base + 1 });
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) { return json(request, 500, { error: 'server-error' }); }
  }
};
