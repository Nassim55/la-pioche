// Until La Pioche's own Worker is deployed, SYNC_URL is empty and nothing syncs: not one
// request (above all, none to Il Mazzo's Worker) and no sign-in screen. Progress stays on
// the device, and merges in at each device's first sign-in once the Worker is up.
const { boot, ok, done } = require('./harness');
const calls = [];
const B = boot({ 'pioche-noms-stats-v1': JSON.stringify({ maison: { seen: 2, wrong: 0 } }) }, w => {
  w.fetch = async (...a) => { calls.push(String(a[0])); throw new Error('offline'); };
});
const wait = ms => new Promise(r => B.w.setTimeout(r, ms));
(async () => {
  await wait(30);
  ok(B.ev('SYNC_URL') === '' && B.ev('syncKey()') === null, 'no sync address, so no session');
  B.ev("selectedNouns = new Set(['maison']); updateReadout();"); B.d.getElementById('start-btn').click();
  B.d.getElementById('answer').value = 'la maison'; B.d.getElementById('submit').click();
  B.d.getElementById('change-btn').click();
  B.w.dispatchEvent(new B.w.Event('online'));
  ok(await B.ev('syncNow()') === 'signed-out', 'asked to sync, it does nothing');
  B.ev('syncSoon(1)'); B.ev('syncStart()');
  await wait(40);
  ok(calls.length === 0, `not one request is made (${calls.join(', ')})`);
  ok(!B.d.getElementById('signin-gate'), 'and no sign-in screen');
  ok(JSON.parse(B.w.localStorage.getItem('pioche-noms-stats-v1')).maison.seen === 3, 'progress is saved on the device as usual');
  ok(B.errors.length === 0 && B.warns.length === 0, 'no errors or warnings');
  done();
})();
