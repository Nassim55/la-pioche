// Révision du jour: spaced repetition across sections, with the clock under test control.
const { boot, ok, done } = require('./harness');
const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 16, 9, 0, 0);   // tests run in UTC (CI and local runs)
let clock = T0;
const timeHook = w => { w.Date.now = () => clock; };
const history = {
  'pioche-noms-stats-v1': JSON.stringify({ pain: { seen: 6, wrong: 3 }, maison: { seen: 4, wrong: 1 }, livre: { seen: 5, wrong: 0 }, eau: { seen: 1, wrong: 0 } }),
  'pioche-subject': 'nouns'
};
let { w, d, ev, key, errors, warns } = boot(history, timeHook);
const t0 = ev('today()');
const rec = (subj, k, dir = 'en-it') => ev(`loadSrs('${subj}', '${dir}')['${k}']`);
const strip = () => d.getElementById('ripasso').textContent.replace(/\s+/g, ' ').trim();
ok(warns.length === 0 && errors.length === 0, 'loads cleanly');
// ---- Seeding from earlier history ----
ok(rec('nouns', 'pain').b === 1 && rec('nouns', 'pain').d === t0 && rec('nouns', 'maison').d === t0, 'weak words (≥ 25% wrong) come due straight away');
const livre = rec('nouns', 'livre'), eau = rec('nouns', 'eau');
ok(livre.b === 4 && livre.d > t0 && livre.d <= t0 + 8 && eau.b === 3 && eau.d > t0 && eau.d <= t0 + 4, 'solid words are spread over the coming days');
ok(/2 due today/.test(strip()) && /2 nouns/.test(strip()), `strip: "${strip()}"`);
// ---- The schedule rules ----
ev("srsAnswer('nouns', 'en-it', 'chat', true)");
ok(rec('nouns', 'chat').b === 1 && rec('nouns', 'chat').d === t0 + 1, 'a first correct answer: box 1, back tomorrow');
ev("srsAnswer('nouns', 'en-it', 'chat', true)");
ok(rec('nouns', 'chat').b === 1, 'a second correct answer the same day does not move it again');
clock += DAY; ev("srsAnswer('nouns', 'en-it', 'chat', true)");
ok(rec('nouns', 'chat').b === 2 && rec('nouns', 'chat').d === t0 + 1 + 2, 'next day: box 2, two days out');
ev("srsAnswer('nouns', 'en-it', 'chat', false)");
ok(rec('nouns', 'chat').b === 1 && rec('nouns', 'chat').d === t0 + 2, 'a wrong answer: back to box 1, due tomorrow');
for (let i = 0; i < 9; i++) { clock += DAY; ev("srsAnswer('nouns', 'en-it', 'chien', true)"); }
ok(rec('nouns', 'chien').b === 7 && rec('nouns', 'chien').d === ev('today()') + 64, 'intervals cap at 64 days (box 7)');
clock = T0;
// ---- A mixed review ----
ev("selectedNouns = new Set(['pain']); updateReadout();");
d.getElementById('ripasso-start').click();
ok(ev('reviewMode') && d.getElementById('app-title').textContent === 'Révision du jour' && ev('deck.length') === 2, 'Start: a review of the 2 due cards');
ok(new Set(ev('deck.map(c => c.subject)')).size === 1 && ev("deck.every(c => c.key.startsWith(c.subject + ':'))"), 'cards from the one section so far, each keyed by section');
ok(d.querySelector('.direction-toggle').hidden && !d.getElementById('game-focus-btn') && d.getElementById('change-btn').textContent === '← Back to setup', 'direction and Focus are hidden; "← Back to setup"');
let rightAll = true; const sections = [];
for (let i = 0; i < 2; i++) {
  ev(`index = ${i}; render();`);
  const c = ev(`deck[${i}]`);
  sections.push(d.getElementById('card-section').textContent);
  d.getElementById('answer').value = c.person ? `${c.pronounLabel.split(' / ')[0]} ${c.italian}` : c.italian;
  d.getElementById('submit').click();
  if (!d.getElementById('feedback').className.includes(' correct')) rightAll = false;
}
ok(rightAll, 'each card is checked by its own section\'s rules (nouns with articles, verbs with pronouns, phrases)');
ok(sections.every(s => s === 'Noms'), `each card shows its section (${[...new Set(sections)].join(', ')})`);
ok(JSON.parse(w.localStorage.getItem('pioche-noms-stats-v1')).pain.seen === 7, 'each answer is recorded in its section');
ok(rec('nouns', 'pain').b === 2 && rec('nouns', 'pain').d === t0 + 2, 'and each is rescheduled: box 2, two days out');
ev('index = deck.length; render();');
ok(/Fin de la révision/i.test(d.querySelector('.badge').textContent) && /C’est fait/.test(d.querySelector('.msg').textContent) && d.getElementById('back-to-setup').textContent === '← Back to setup', 'completion: "C’est fait !"');
d.getElementById('back-to-setup').click();
ok(ev('subject') === 'nouns' && !ev('reviewMode') && ev('selectedNouns.size') === 1 && ev("selectedNouns.has('pain')") && d.getElementById('app-title').textContent === 'Noms', 'back to Noms, with its selection intact');
ok(/All done for today ✓/.test(strip()), `strip afterwards: "${strip()}"`);
// ---- Two days later ----
clock = T0 + 2 * DAY;
ev('showSetup()');
ok(/due today/.test(strip()) && ev("dueList('en-it').some(x => x.n.noun === 'pain')"), 'two days later they are due again');
// ---- Wrong answers, and practising missed cards inside a review ----
d.getElementById('ripasso-start').click();
const n0 = ev('deck.length');
for (let i = 0; i < n0; i++) { ev(`index = ${i}; render();`); d.getElementById('answer').value = 'faux'; d.getElementById('submit').click(); }
const anyKey = ev('deck[0].noun'), anySubj = ev('deck[0].subject');
ok(rec(anySubj, anyKey).b === 1 && rec(anySubj, anyKey).d === ev('today()') + 1, 'a wrong answer in the review: due tomorrow');
ev('index = deck.length; render();');
ok(!!d.getElementById('practise-missed') && /back tomorrow/.test(d.querySelector('.msg').textContent), 'missed cards can be practised again straight away');
d.getElementById('practise-missed').click();
ok(ev('reviewMode') && ev('deck.length') === n0 && ev('sessionPool.length') >= n0, 'practising the missed cards stays inside the review');
d.getElementById('change-btn').click();
ok(ev('subject') === 'nouns' && !ev('reviewMode'), 'and "← Back to setup" returns to the section');
// ---- Other directions ----
d.querySelector('#ripasso [data-ripasso-dir="it-en"]').click();
ok(w.localStorage.getItem('pioche-revision-dir') === 'it-en' && /come back here/.test(strip()), 'French → English has its own schedule (nothing yet)');
d.querySelector('#ripasso [data-ripasso-dir="en-it"]').click();
// ---- Backups and reset ----
const keys = Object.keys(ev('buildBackup()').data);
ok(keys.includes('pioche-noms-stats-v1:srs') && keys.includes('pioche-revision-dir'), 'backups include the schedules');
w.confirm = () => true;
d.getElementById('reset-stats').click();
ok(w.localStorage.getItem('pioche-noms-stats-v1:srs') === null, "resetting the section's progress clears its schedule");
ok(errors.length === 0, `no runtime errors ${errors.join('; ')}`);
// ---- Listening review, with a stand-in French voice ----
clock = T0;
const spoken = [];
const L = boot({ 'pioche-noms-stats-listen-v1': JSON.stringify({ pain: { seen: 2, wrong: 2 } }), 'pioche-revision-dir': 'listen' }, win => {
  timeHook(win);
  win.SpeechSynthesisUtterance = function (t) { this.text = t; };
  win.speechSynthesis = { getVoices: () => [{ name: 'Thomas', lang: 'fr-FR', voiceURI: 'thomas', localService: true }], cancel() {}, speak(u) { spoken.push(u.text); }, addEventListener() {} };
});
ok(/1 due today/.test(L.d.getElementById('ripasso').textContent), 'a Listening review counts listening history');
L.d.getElementById('ripasso-start').click();
ok(L.ev('direction') === 'listen' && spoken.includes('le pain') && !!L.d.getElementById('listen-btn'), 'it speaks the French, as Listening does');
L.d.getElementById('answer').value = 'le pain'; L.d.getElementById('submit').click();
ok(JSON.parse(L.w.localStorage.getItem('pioche-noms-stats-listen-v1:srs')).pain.b === 2 && L.errors.length === 0, 'and reschedules it in the listening schedule');
done();
