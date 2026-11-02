// Sync, part 1: which saved data counts as progress, how two devices' copies merge
// (counters add up, schedules keep the latest answer, resets win), and a two-device
// simulation through a stand-in server.
const { boot, ok, done } = require('./harness');
const quiet = w => { w.confirm = () => true; w.alert = () => {}; };
const A0 = { 'pioche-noms-stats-v1': JSON.stringify({ maison: { seen: 3, wrong: 1 } }), 'pioche-subject': 'nouns' };
const { d, ev, errors, warns } = boot(A0, quiet);
ok(errors.length === 0 && warns.length === 0, 'loads cleanly');

// ---- What syncs ----
const keys = ev('[...syncedKeys().keys()]');
ok(keys.length === 7, `7 stores sync (${keys.length}): the three directions' stats and review schedules, and the word associations`);
ok(['pioche-noms-stats-v1', 'pioche-noms-stats-v1:srs', 'pioche-noms-stats-fren-v1', 'pioche-noms-stats-listen-v1:srs', 'pioche-noms-assoc-v1'].every(k => keys.includes(k)),
   'stats, review schedules and associations, for every direction');
ok(!['pioche-audio-v1', 'pioche-revision-dir', 'pioche-subject', 'pioche-sync-meta-v1', 'pioche-sync-base-v1'].some(k => keys.includes(k)),
   'device settings (voice, review direction, last section) and sync bookkeeping stay on the device');

// ---- Counters ----
const m = (kind, b, l, r) => ev(`SYNC_MERGERS[${JSON.stringify(kind)}](${JSON.stringify(b)}, ${JSON.stringify(l)}, ${JSON.stringify(r)})`);
const c = m('counters', { maison: { seen: 3, wrong: 1 } }, { maison: { seen: 5, wrong: 1 }, chat: { seen: 1, wrong: 0 } }, { maison: { seen: 4, wrong: 2 }, chien: { seen: 2, wrong: 1 } });
ok(c.maison.seen === 6 && c.maison.wrong === 2, 'counters: both devices\' new answers add up (3 seen, +2 here, +1 there = 6)');
ok(c.chat.seen === 1 && c.chien.seen === 2, 'counters: words practised on only one device are kept');
const nb = m('counters', undefined, { maison: { seen: 4, wrong: 1 }, chien: { seen: 7, wrong: 0 } }, { maison: { seen: 4, wrong: 1 }, chien: { seen: 5, wrong: 2 } });
ok(nb.maison.seen === 4 && nb.maison.wrong === 1 && nb.chien.seen === 7 && nb.chien.wrong === 2, "with no shared starting point (a device's first sync) the larger count is kept, so a backup restored on two devices isn't counted twice");
ok(m('counters', {}, { maison: { seen: 2, wrong: 0 } }, { maison: { seen: 3, wrong: 1 } }).maison.seen === 5, 'a word first practised on both devices since the last sync: both sessions count');

// ---- Review schedules ----
const s = m('schedule', { a: { b: 2, d: 10, l: 8 }, b: { b: 2, d: 10, l: 8 }, c: { b: 3, d: 12, l: 9 }, del: { b: 1, d: 9, l: 8 } },
  { a: { b: 3, d: 14, l: 10 }, b: { b: 2, d: 10, l: 8 }, c: { b: 4, d: 20, l: 12 }, del: { b: 1, d: 9, l: 8 }, mine: { b: 1, d: 11, l: 10 } },
  { a: { b: 2, d: 10, l: 8 }, b: { b: 1, d: 11, l: 10 }, c: { b: 1, d: 13, l: 13 }, theirs: { b: 1, d: 11, l: 10 } });
ok(s.a.b === 3 && s.b.b === 1, 'schedules: a change on either side wins');
ok(s.c.l === 13 && s.c.b === 1, 'schedules: changed on both, the most recently answered wins');
ok(!('del' in s) && s.mine && s.theirs, 'schedules: a record removed on one side is removed; new records on both sides are kept');
ok(ev(`syncSame({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })`) && !ev(`syncSame({ a: 1 }, { a: 2 })`), 'copies are compared by content, not by the order words were added in');
ok(JSON.stringify(Object.keys(ev(`syncChanges({ x: { v: { a: 1, b: 2 }, e: 0 }, y: { v: {}, e: 1 } }, { x: { v: { b: 2, a: 1 }, e: 0 }, y: { v: {}, e: 0 } })`))) === '["y"]', 'a save sends only the stores that really changed');
ok(m('schedule', {}, { x: { b: 3, d: 9, l: 7 } }, { x: { b: 2, d: 9, l: 7 } }).x.b === 3, 'schedules: answered the same day on both, the higher box wins');

// ---- Associations ----
const a = m('assoc', { maison: 'home', chien: 'dog', chat: 'cat' }, { maison: 'my house', chien: 'dog' , chat: 'kitty' }, { maison: 'home', chat: 'puss', nuovo: 'new' });
ok(a.maison === 'my house' && !('chien' in a) && a.nuovo === 'new', 'associations: edits and deletions on either side are kept');
ok(a.chat === 'kitty', "associations: edited on both, this device's version wins");

// ---- Epochs: a reset wins outright ----
const all = (b, l, r) => ev(`syncMergeAll(${JSON.stringify(b)}, ${JSON.stringify(l)}, ${JSON.stringify(r)})`);
const K = 'pioche-noms-stats-v1';
let r = all({}, { [K]: { v: {}, e: 1 } }, { [K]: { v: { maison: { seen: 9, wrong: 2 } }, e: 0 } });
ok(JSON.stringify(r[K].v) === '{}' && r[K].e === 1, 'a reset on this device beats the other copy, however much history it has');
r = all({}, { [K]: { v: { maison: { seen: 9, wrong: 2 } }, e: 0 } }, { [K]: { v: {}, e: 1 } });
ok(JSON.stringify(r[K].v) === '{}' && r[K].e === 1, '…and a reset elsewhere wins here');
r = all({ [K]: { v: { maison: { seen: 9, wrong: 0 } }, e: 0 } }, { [K]: { v: { maison: { seen: 1, wrong: 0 } }, e: 1 } }, { [K]: { v: { maison: { seen: 2, wrong: 0 } }, e: 1 } });
ok(r[K].v.maison.seen === 2, 'reset on both: the old starting point is ignored (no shared base, so the larger count)');
r = all({}, { [K]: { v: { maison: { seen: 1, wrong: 0 } }, e: 0 } }, {});
ok(r[K].v.maison.seen === 1 && Object.keys(r).length === 1, 'a store only one side has is taken as it is');

// ---- Hooks: reset and restore raise epochs; backups leave sync bookkeeping out ----
d.querySelector('#reset-stats').click();
const ep = ev('syncMeta().epochs');
ok(ep['pioche-noms-stats-v1'] === 1 && ep['pioche-noms-stats-v1:srs'] === 1 && Object.keys(ep).length === 2, 'reset progress raises the epoch of exactly the stores it cleared');
const backup = JSON.stringify(ev('buildBackup()'));
ok(!/pioche-sync-/.test(backup), 'backups leave the sync bookkeeping out');
ev(`restoreFromText(${JSON.stringify(backup)})`);
const ep2 = ev('syncMeta().epochs');
ok(Object.keys(ep2).length === 7 && ep2['pioche-noms-stats-v1'] === 2 && ep2['pioche-noms-assoc-v1'] === 1, 'restoring a backup raises every store\'s epoch, so the restored copy wins');

// ---- Two devices, one stand-in server ----
const server = { items: {} };
const start = { 'pioche-noms-stats-v1': JSON.stringify({ maison: { seen: 4, wrong: 1 } }), 'pioche-subject': 'nouns' };   // the same backup on both
const devA = boot(start, quiet), devB = boot(start, quiet);
// What the sync step will do: merge base, this device and the server; store the result on both
function syncOnce(dev) {
  const merged = dev.ev(`syncMergeAll(syncReadJSON(SYNC_BASE_KEY, {}), syncLocalSnapshot(), ${JSON.stringify(server.items)})`);
  dev.ev(`syncApply(${JSON.stringify(merged)}); localStorage.setItem(SYNC_BASE_KEY, ${JSON.stringify(JSON.stringify(merged))})`);
  server.items = merged;
}
syncOnce(devA); syncOnce(devB);
const practise = (dev, word, seen, wrong) => dev.ev(`(() => { const o = readStats('nouns', 'en-it'); const s = o[${JSON.stringify(word)}] || { seen: 0, wrong: 0 };
  localStorage.setItem('pioche-noms-stats-v1', JSON.stringify({ ...o, [${JSON.stringify(word)}]: { seen: s.seen + ${seen}, wrong: s.wrong + ${wrong} } })); })()`);
ok(devB.ev("readStats('nouns', 'en-it').maison.seen") === 4, "first sync of a second device holding the same backup: it isn't counted twice");
practise(devA, 'maison', 3, 1); practise(devA, 'chat', 2, 0);   // one laptop
practise(devB, 'maison', 2, 0); practise(devB, 'chien', 1, 1);    // the other, before either syncs
syncOnce(devA); syncOnce(devB); syncOnce(devA);
const sa = devA.ev("readStats('nouns', 'en-it')"), sb = devB.ev("readStats('nouns', 'en-it')");
// Same words and counts; the order words were added in can differ between devices
const canon = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
ok(canon(sa) === canon(sb), 'after syncing, both devices hold the same progress');
ok(sa.maison.seen === 9 && sa.maison.wrong === 2 && sa.chat.seen === 2 && sa.chien.wrong === 1, 'and nothing practised on either device was lost (maison 4 + 3 + 2 = 9 seen)');
ok(devA.ev('stats.maison.seen') === 9 && /\b3\b.*practised|practised/.test(devA.d.querySelector('.setup-meta').textContent), 'the app reloads its progress and redraws the setup screen after a sync');
syncOnce(devA); syncOnce(devB);
ok(devA.ev("readStats('nouns', 'en-it').maison.seen") === 9, 'syncing again with nothing new changes nothing');
devB.d.querySelector('#reset-stats').click();
syncOnce(devB); syncOnce(devA);
ok(JSON.stringify(devA.ev("readStats('nouns', 'en-it')")) === '{}' && JSON.stringify(devA.ev("loadSrs('nouns', 'en-it')")) === '{}', 'a reset on one device reaches the other');
done();
