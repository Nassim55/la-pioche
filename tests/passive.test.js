// En balade: out and about, listen only. Each card is read — the French, then the English
// — five times over, then the next, and round again at the end, for as long as it's left
// on. A stand-in speech engine records every line; the test finishes each one by hand.
const { boot, ok, done } = require('./harness');

const VOICES = [
  { name: 'Thomas', lang: 'fr-FR', voiceURI: 'thomas', localService: true },
  { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha', localService: true },
  { name: 'Daniel', lang: 'en-GB', voiceURI: 'daniel', localService: true }
];
function fakes(voices = VOICES) {
  return w => {
    w.__said = []; w.__cancels = 0; w.__vis = 'visible';
    w.SpeechSynthesisUtterance = function (text) { this.text = text; };
    Object.defineProperty(w, 'speechSynthesis', { configurable: true, value: { getVoices: () => voices, cancel() { w.__cancels++; }, speak(u) { w.__said.push(u); }, addEventListener() {}, speaking: false } });
    w.__wakes = [];
    Object.defineProperty(w.navigator, 'wakeLock', { configurable: true, value: { request: async () => { const l = { released: false, release: async () => { l.released = true; }, addEventListener() {} }; w.__wakes.push(l); return l; } } });
    Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => w.__vis });
  };
}
const wait = (B, ms = 15) => new Promise(r => B.w.setTimeout(r, ms));
const last = B => B.w.__said[B.w.__said.length - 1];
const finish = async B => { const u = last(B); if (u.onstart) u.onstart(); if (u.onend) u.onend(); await wait(B); };
const fast = B => B.ev('Object.assign(PASSIVE_GAPS, { itEn: 1, again: 1, next: 1, watchdogBase: 100000, watchdogPerChar: 0, unlock: 40 })');
const start = (B, keys) => { B.ev(`selectedNouns = new Set(${JSON.stringify(keys)}); updateReadout();`); fast(B); B.d.getElementById('passive-btn').click(); };
const view = B => B.d.querySelector('.container').dataset.view;
const txt = (B, id) => B.d.getElementById(id).textContent.trim();

(async () => {
  // ---- On the setup screen ----
  let B = boot({ 'pioche-subject': 'nouns' }, fakes());
  const btn = B.d.getElementById('passive-btn');
  ok(btn && /En balade/.test(btn.textContent) && /the French then the English, 5 times over, on a loop/.test(btn.textContent) && btn.previousElementSibling.id === 'start-btn',
     'En balade sits under Start practising: hear each card, French then English, 5 times over, on a loop');
  B.ev("selectedNouns = new Set(); capValue = ''; updateReadout();");
  ok(btn.disabled, 'with nothing to play, it waits like Start does');

  // ---- French, then English, five times; then the next card ----
  start(B, ['maison', 'pain']);
  await wait(B);
  const cards = B.ev('passive.cards.map(c => c.noun)');
  const it = k => B.ev(`NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}).it`), en = k => B.ev(`spokenEnglish(NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}).en)`);   // said without its brackets
  ok(view(B) === 'passive' && B.w.__wakes.length === 1, 'it opens its own screen, and keeps the screen awake (phones stop the voice when it locks)');
  ok(last(B).text === it(cards[0]) && last(B).voice.name === 'Thomas' && last(B).rate === 0.9, 'first the French, in the French voice, straight from the tap');
  await finish(B);
  ok(last(B).text === en(cards[0]) && last(B).voice.name === 'Daniel' && last(B).rate === 0.95, 'then the English, in an English voice (British first)');
  for (let k = 0; k < 4; k++) await finish(B);
  ok(B.w.__said.length === 6 && last(B).text === en(cards[0]) && txt(B, 'passive-rep') === 'Répétition 3 sur 5', '…and again: on the third time round, it says so');
  for (let k = 0; k < 5; k++) await finish(B);
  ok(B.w.__said.length === 11 && last(B).text === it(cards[1]) && txt(B, 'passive-where') === 'Carte 2 sur 2 · tour 1' && txt(B, 'passive-rep') === 'Répétition 1 sur 5',
     'five times French-and-English, then the next card');
  ok(B.w.__said.slice(0, 10).map(u => u.voice.name).join() === 'Thomas,Daniel,Thomas,Daniel,Thomas,Daniel,Thomas,Daniel,Thomas,Daniel', 'always the French first, the English right after');
  for (let k = 0; k < 10; k++) await finish(B);
  ok(B.w.__said.length === 21 && /tour 2/.test(txt(B, 'passive-where')) && B.ev('passive.cards.map(c => c.noun).sort().join()') === 'maison,pain'
     && last(B).text === it(B.ev('passive.cards[0].noun')), 'at the end of the deck, round again (in a new order) — for as long as it\'s left on');
  ok(!B.w.localStorage.getItem('pioche-noms-stats-v1') && !B.w.localStorage.getItem('pioche-noms-stats-v1:srs'), 'nothing heard is counted: no scores, no reviews');

  // ---- Pause, carry on, skip ----
  const before = B.w.__said.length, playing = last(B), cancels = B.w.__cancels, at = B.ev('passive.index');
  B.d.getElementById('passive-play').click();
  ok(B.w.__cancels > cancels && txt(B, 'passive-play') === '▶ Reprendre', 'Pause stops the voice');
  if (playing.onend) playing.onend(); await wait(B);
  ok(B.w.__said.length === before, '…and nothing more is said, even as the stopped line ends');
  B.d.getElementById('passive-play').click();
  ok(B.w.__said.length === before + 1 && B.ev('passive.index') === at && last(B).voice.name === 'Thomas', 'Reprendre carries on with the same card, from its French');
  B.d.getElementById('passive-next').click(); await wait(B, 120);
  ok(B.ev('passive.index') === (at + 1) % 2 && last(B).text === it(B.ev('passive.cards[passive.index].noun')), '⏭ the next card, from its French');
  B.d.getElementById('passive-prev').click(); await wait(B, 120);
  ok(B.ev('passive.index') === at, '⏮ back one');

  // ---- Settings: how many times, and how fast ----
  B.d.getElementById('passive-less').click(); B.d.getElementById('passive-less').click();
  ok(txt(B, 'passive-reps') === '3' && JSON.parse(B.w.localStorage.getItem('pioche-passive-v1')).reps === 3 && txt(B, 'passive-rep') === 'Répétition 1 sur 3', 'Répétitions: fewer (or more), remembered on this device');
  const n0 = B.w.__said.length;
  for (let k = 0; k < 6; k++) await finish(B);
  ok(B.w.__said.length === n0 + 6 && B.ev('passive.index') !== at, 'three times each now');
  B.d.querySelector('#passive-speed [data-slow="1"]').click();
  await finish(B); await finish(B);
  const lastIt = [...B.w.__said].reverse().find(u => u.voice.name === 'Thomas');
  ok(lastIt.rate === 0.7 && JSON.parse(B.w.localStorage.getItem('pioche-passive-v1')).slow === true, 'Lent: the French slower');

  // ---- The pocket lock ----
  const cover = B.d.getElementById('passive-cover'), unlock = B.d.getElementById('passive-unlock');
  B.d.getElementById('passive-lock').click();
  ok(!cover.hidden && txt(B, 'passive-cover-it') === txt(B, 'passive-it'), 'Verrouiller l’écran: a dark cover over everything, the card still on it');
  const pd = new B.w.Event('pointerdown', { bubbles: true, cancelable: true });
  unlock.dispatchEvent(pd); await wait(B, 10); unlock.dispatchEvent(new B.w.Event('pointerup', { bubbles: true }));
  await wait(B, 60);
  ok(!cover.hidden, 'a tap in a pocket does nothing');
  unlock.dispatchEvent(new B.w.Event('pointerdown', { bubbles: true, cancelable: true })); await wait(B, 70);
  ok(cover.hidden, 'only holding the button lifts it');

  // ---- The screen going off and back on ----
  const n1 = B.w.__said.length, stalled = last(B);
  B.w.__vis = 'hidden'; B.w.__wakes.forEach(l => { l.released = true; });   // as the browser does when the page is hidden
  B.d.dispatchEvent(new B.w.Event('visibilitychange'));
  if (stalled.onend) stalled.onend(); await wait(B);
  ok(B.w.__said.length === n1, 'screen off: the browser stops the voice, and the player waits');
  B.w.__vis = 'visible'; B.d.dispatchEvent(new B.w.Event('visibilitychange')); await wait(B);
  ok(B.w.__said.length === n1 + 1 && last(B).voice.name === 'Thomas' && B.w.__wakes.length >= 2, 'screen back on: the card\'s French again, and the screen kept awake again');

  // ---- A line that never ends, or never starts ----
  B.ev('Object.assign(PASSIVE_GAPS, { watchdogBase: 40 })');
  await finish(B); const u2 = last(B); if (u2.onstart) u2.onstart(); await wait(B, 80);
  ok(B.w.__said.length > n1 + 2 && last(B) !== u2, 'a line that starts but never says it ended: carried on regardless');
  await wait(B, 80);
  ok(txt(B, 'passive-play') === '▶ Reprendre' && /didn’t start/.test(txt(B, 'passive-msg')), 'a line that never starts at all: it pauses, and says how to carry on');

  // ---- Fine ----
  B.ev('Object.assign(PASSIVE_GAPS, { watchdogBase: 100000 })');
  B.d.getElementById('passive-play').click();
  const n2 = B.w.__said.length, endLine = last(B);
  B.d.getElementById('passive-end').click();
  if (endLine.onend) endLine.onend(); await wait(B);
  ok(view(B) === 'setup' && B.w.__said.length === n2 && B.w.__wakes.every(l => l.released) && B.ev('passive') === null, 'Fine: back to the setup screen, the voice stopped, the screen free to sleep');
  B.d.getElementById('passive-btn').click(); await wait(B);
  B.d.dispatchEvent(new B.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  ok(view(B) === 'passive', 'Enter does nothing behind the player');
  ok(B.errors.length === 0 && B.warns.length === 0, 'no errors along the way');

  // ---- The English is made to be said ----
  B = boot({ 'pioche-subject': 'nouns' }, fakes());
  ok(B.ev("spokenEnglish('you (pl) send')") === 'you all send' && B.ev("spokenEnglish('he/she remembers / reminds')") === 'he or she remembers, or reminds'
     && B.ev("spokenEnglish('I talk about the friend (f.).')") === 'I talk about the friend.' && B.ev("spokenEnglish('You speak French? (tu)')") === 'You speak French?'
     && B.ev("spokenEnglish('fresh · cool')") === 'fresh, cool', '…as in: you all send · he or she remembers, or reminds · fresh, cool');
  ok(B.ev("spokenEnglish('to know (facts, how to)')") === 'to know' && B.ev("spokenEnglish('Good morning! What you take (formal)?')") === 'Good morning! What you take?'
     && B.ev("spokenEnglish('Do you like it? (tu) I do!')") === 'Do you like it? I do!' && B.ev("spokenEnglish('the wall (of a room)')") === 'the wall',
     'nothing in brackets is read out: "to know (facts, how to)" is said "to know"');

  // ---- No French voice ----
  B = boot({ 'pioche-subject': 'nouns' }, fakes([VOICES[1]]));
  start(B, ['maison']);
  ok(view(B) === 'setup' && /no French voice/.test(B.d.getElementById('passive-msg').textContent), 'no French voice on the device: it says so, and stays put');
  done();
})();
