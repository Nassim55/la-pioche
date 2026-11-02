// Sync, part 2: the Worker (worker/src/index.js) against real SQLite — D1 is SQLite —
// with a stand-in Google. Covers sign-in (and every way a token can be wrong), sessions,
// the version check (including two saves at the same instant), validation, deleting,
// and the one-time move from the old built-in key.
const { ok, done } = require('./harness');
const path = require('path');
const { makeD1 } = require('./d1-fixture');
const { makeGoogle, CLIENT_ID, ME } = require('./google-fixture');

(async () => {
  const google = await makeGoogle();
  google.install();
  const worker = (await import(path.join(__dirname, '..', 'worker', 'src', 'index.js'))).default;
  const env = { DB: makeD1(), GOOGLE_CLIENT_ID: CLIENT_ID, ALLOWED_EMAILS: ` ${ME.toUpperCase()} ` };
  const ORIGIN = 'https://nassim55.github.io';
  const call = async (method, p, { auth, body, origin = ORIGIN, e = env } = {}) => {
    const h = { Origin: origin };
    if (auth) h.Authorization = `Bearer ${auth}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const res = await worker.fetch(new Request(`https://la-pioche-sync.example.workers.dev${p}`, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), e);
    let data = null;
    try { data = await res.json(); } catch (err) { /* empty */ }
    return { status: res.status, data, headers: res.headers };
  };
  const signIn = async (claims, opts, extra = {}) => call('POST', '/v1/session', { body: { credential: await google.token(claims, opts), ...extra } });
  const raw = env.DB.raw;

  // ---- Browser access and config ----
  let r = await call('OPTIONS', '/v1/progress');
  ok(r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === ORIGIN && /Authorization/.test(r.headers.get('Access-Control-Allow-Headers')), 'the GitHub Pages site may call the API');
  r = await call('OPTIONS', '/v1/progress', { origin: 'https://evil.example' });
  ok(!r.headers.get('Access-Control-Allow-Origin'), 'other websites may not');
  r = await call('GET', '/v1/config');
  ok(r.status === 200 && r.data.googleClientId === CLIENT_ID, "the app can ask which Google client to sign in with");

  // ---- Every way a sign-in can be wrong ----
  const bad = {
    'signed by an impostor': [{}, { impostor: true }], 'unsigned (alg none)': [{}, { unsigned: true, alg: 'none' }],
    'an unknown signing key': [{}, { kid: 'kid-404' }], 'issued for another app': [{ aud: 'someone-else.apps.googleusercontent.com' }],
    'not from Google': [{ iss: 'https://evil.example' }], 'expired': [{ exp: Math.floor(Date.now() / 1000) - 600 }],
    'an unverified email': [{ email_verified: false }]
  };
  const refused = [];
  for (const [label, [claims, opts]] of Object.entries(bad)) { const x = await signIn(claims, opts); if (x.status !== 401) refused.push(`${label}: ${x.status}`); }
  ok(refused.length === 0, `tokens that are forged, unsigned, from an unknown key, for another app, not from Google, expired or unverified are all refused${refused.length ? ' — ' + refused.join('; ') : ''}`);
  ok((await call('POST', '/v1/session', { body: { credential: 'not.a.token' } })).status === 401 && (await call('POST', '/v1/session', { body: '{}' })).status === 401, 'malformed or missing tokens are refused');
  r = await signIn({ email: 'someone.else@example.com', sub: '200000000000000000002' });
  ok(r.status === 403 && r.data.error === 'not-allowed', "a genuine Google account that isn't on the allow-list is refused");
  ok((await signIn({}, {}, {})).status === 200 && (await call('POST', '/v1/session', { body: { credential: await google.token() }, e: { ...env, ALLOWED_EMAILS: '' } })).status === 403,
     'with no allow-list set, nobody can sign in');
  ok(raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n === 1, '(only the allowed sign-in made a session)');

  // ---- Signing in ----
  r = await signIn();
  const T1 = r.data && r.data.token;
  ok(r.status === 200 && /^[A-Za-z0-9_-]{43}$/.test(T1) && r.data.email === ME && Math.round((r.data.expiresAt - Date.now()) / 86400000) === 365, 'your Google account gets a session, good for a year');
  ok(!JSON.stringify(raw.prepare('SELECT * FROM sessions').all()).includes(T1), 'only the session\'s hash is stored, never the token');
  r = await call('GET', '/v1/progress', { auth: T1 });
  ok(r.status === 200 && r.data.version === 0 && JSON.stringify(r.data.items) === '{}', 'a first sign-in opens an empty space for the account');
  ok((await call('GET', '/v1/progress')).status === 401 && (await call('GET', '/v1/progress', { auth: 'x'.repeat(43) })).status === 401, 'no session, or a made-up one: refused');

  // ---- Saving and fetching ----
  r = await call('PUT', '/v1/progress', { auth: T1, body: { baseVersion: 0, items: { 'pioche-noms-stats-v1': { v: { maison: { seen: 4, wrong: 1 } }, e: 0 }, 'pioche-noms-assoc-v1': { v: null, e: 1 } } } });
  ok(r.status === 200 && r.data.version === 1, 'a save based on the current version is accepted');
  const T2 = (await signIn()).data.token;
  r = await call('GET', '/v1/progress', { auth: T2 });
  ok(r.data.items['pioche-noms-stats-v1'].v.maison.seen === 4 && r.data.items['pioche-noms-assoc-v1'].v === null && r.data.items['pioche-noms-assoc-v1'].e === 1, 'signing in on another device opens the same progress');
  r = await call('PUT', '/v1/progress', { auth: T2, body: { baseVersion: 0, items: { 'pioche-noms-stats-v1': { v: { maison: { seen: 99, wrong: 0 } }, e: 0 } } } });
  ok(r.status === 409 && r.data.version === 1, 'a save based on an out-of-date version is refused, and changes nothing');
  env.DB.hooks.beforeBatch = db => db.prepare('UPDATE spaces SET version = version + 1').run();
  r = await call('PUT', '/v1/progress', { auth: T2, body: { baseVersion: 1, items: { 'pioche-noms-stats-v1': { v: { maison: { seen: 77, wrong: 0 } }, e: 0 } } } });
  ok(r.status === 409 && (await call('GET', '/v1/progress', { auth: T1 })).data.items['pioche-noms-stats-v1'].v.maison.seen === 4, 'two saves at the same instant: the second writes nothing and is told to merge again');
  const statuses = [];
  for (const b of [{ baseVersion: 2, items: { 'Bad Key!': { v: {}, e: 0 } } }, { baseVersion: 2, items: { 'pioche-noms-stats-v1': { v: [1], e: 0 } } }, { items: {} }, 'not json']) statuses.push((await call('PUT', '/v1/progress', { auth: T1, body: b })).status);
  ok(statuses.every(s => s === 400) && (await call('PUT', '/v1/progress', { auth: T1, body: { baseVersion: 2, items: { x: { v: { s: 'a'.repeat(1_600_000) }, e: 0 } } } })).status === 413, 'malformed and oversized saves are refused');

  // ---- Sessions end ----
  ok((await call('DELETE', '/v1/session', { auth: T2 })).status === 200 && (await call('GET', '/v1/progress', { auth: T2 })).status === 401 && (await call('GET', '/v1/progress', { auth: T1 })).status === 200,
     'signing a device out ends only that device\'s session');
  raw.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1000);
  ok((await call('GET', '/v1/progress', { auth: T1 })).status === 401, 'an expired session is refused');

  // ---- A second account, and deleting ----
  const env2 = { ...env, ALLOWED_EMAILS: `${ME},other@example.com` };
  const T3 = (await call('POST', '/v1/session', { body: { credential: await google.token({ email: 'other@example.com', sub: '300000000000000000003' }) }, e: env2 })).data.token;
  ok(JSON.stringify((await call('GET', '/v1/progress', { auth: T3, e: env2 })).data.items) === '{}', "another allowed account has its own space, and can't see yours");
  const T4 = (await signIn()).data.token;
  ok((await call('DELETE', '/v1/space', { auth: T4 })).status === 200 && (await call('GET', '/v1/progress', { auth: T4 })).status === 401
     && raw.prepare("SELECT COUNT(*) AS n FROM items WHERE value LIKE '%maison%'").get().n === 0, 'deleting an account\'s space removes its progress and signs it out everywhere');

  done();
})().catch(e => { console.error(e); process.exit(1); });
