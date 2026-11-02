// After a miss, the right answer has to be typed before the next card: the box clears,
// the button reads Réécris →, and only a right copy moves on (as leniently checked as
// the answer itself). It's practice: score, history and review schedule stay as the miss
// left them. Everywhere — both directions, and Révision du jour.
const { boot, ok, done } = require('./harness');
const key = (d, k) => d.dispatchEvent(new d.defaultView.KeyboardEvent('keydown', { key: k, bubbles: true }));

const round = (subj, keys, dir = 'en-it') => {
  const B = boot({ 'pioche-subject': subj });
  B.ev(`direction = ${JSON.stringify(dir)}; selectedNouns = new Set(${JSON.stringify(keys)}); updateReadout();`);
  B.d.getElementById('start-btn').click();
  return B;
};

// ---- Noms: the whole flow ----
let { d, ev } = round('nouns', ['maison', 'pain']);
const first = ev('deck[0]'), placeholder = d.getElementById('answer').placeholder;
const statsBefore = ev(`JSON.stringify(stats[${JSON.stringify(first.noun)}] || null)`);
d.getElementById('answer').value = 'quelque chose';
d.getElementById('submit').click();
const ans = () => d.getElementById('answer'), sub = () => d.getElementById('submit');
ok(!ans().disabled && ans().value === '' && sub().textContent === 'Réécris →' && ans().classList.contains('retype') && ans().placeholder !== placeholder
   && /Type it above to go on/.test(d.getElementById('feedback').textContent), 'a miss: the box clears for the right answer, and the button reads Réécris →');
const after = { score: ev('score'), stats: ev(`JSON.stringify(stats[${JSON.stringify(first.noun)}])`), srs: ev(`JSON.stringify(loadSrs('nouns', 'en-it')[${JSON.stringify(first.noun)}])`) };
key(d, 'Enter');
ok(ev('index') === 0 && /Type the answer to go on/.test(d.getElementById('retype-hint').textContent), 'Enter alone does not move on');
ans().value = 'la cosa sbagliata';
sub().click();
ok(ev('index') === 0 && /Not quite/.test(d.getElementById('retype-hint').textContent) && ans().classList.contains('retype-miss'), 'nor does a wrong copy (the box shakes)');
ans().value = first.italian.toUpperCase();
key(d, 'Enter');
ok(ev('index') === 1, 'the right answer (capitals forgiven, like the answer itself) moves on');
ok(ev('score') === after.score && ev(`JSON.stringify(stats[${JSON.stringify(first.noun)}])`) === after.stats && ev(`JSON.stringify(loadSrs('nouns', 'en-it')[${JSON.stringify(first.noun)}])`) === after.srs && statsBefore !== after.stats,
   'the retype is practice: the score, the card\'s history and its review stay as the miss left them');
ok(!ans().classList.contains('retype') && ans().placeholder === placeholder && sub().textContent === 'Vérifier' && ans().value === '', 'the next card starts clean');
ans().value = ev('deck[1].italian');
sub().click();
ok(sub().textContent === 'Suivant →' && ans().disabled, 'a right answer needs no retype: Suivant as before');

// ---- Nothing typed: asked for an answer, nothing counted ----
({ d, ev } = round('nouns', ['maison', 'pain']));
const card0 = ev('deck[0]'), ph = d.getElementById('answer').placeholder, stats0 = ev(`JSON.stringify(stats[${JSON.stringify(card0.noun)}] || null)`);
key(d, 'Enter');
d.getElementById('submit').click();
ok(ev('index') === 0 && d.getElementById('feedback').classList.contains('hidden') && !ev('answered') && d.getElementById('answer').placeholder === 'type your answer first…'
   && d.getElementById('answer').classList.contains('retype-miss') && ev('score') === 0 && ev('roundMissed.size') === 0 && ev(`JSON.stringify(stats[${JSON.stringify(card0.noun)}] || null)`) === stats0,
   'an empty answer (Enter by accident) is never wrong: the box asks for an answer, and nothing is counted');
d.getElementById('answer').value = 'faux'; d.getElementById('submit').click();
d.getElementById('answer').value = card0.italian; d.getElementById('submit').click();
ok(ev('index') === 1 && d.getElementById('answer').placeholder === ph, 'after a nudge and a miss, the next card gets its own placeholder back');

// ---- Passer: a skip counts as wrong, shows the answer, then it's typed out ----
({ d, ev } = round('nouns', ['maison', 'pain']));
const skipCard = ev('deck[0]'), skipBtn = () => d.getElementById('skip-btn');
const skipStats0 = ev(`JSON.parse(JSON.stringify(stats[${JSON.stringify(skipCard.noun)}] || { seen: 0, wrong: 0 }))`);
ok(skipBtn() && !skipBtn().hidden && skipBtn().textContent === 'Passer' && skipBtn().previousElementSibling.id === 'submit', 'Passer sits after Vérifier, on every new card');
skipBtn().click();
const skipStats1 = ev(`stats[${JSON.stringify(skipCard.noun)}]`);
ok(new RegExp('Skipped — the answer is ' + skipCard.italian).test(d.getElementById('feedback').textContent) && d.getElementById('feedback').classList.contains('incorrect')
   && skipStats1.seen === skipStats0.seen + 1 && skipStats1.wrong === (skipStats0.wrong || 0) + 1 && ev('score') === 0 && ev(`roundMissed.has(${JSON.stringify(skipCard.key)})`),
   'Passer: "Skipped — the answer is …", and it counts as wrong (history, missed list)');
ok(d.getElementById('submit').textContent === 'Réécris →' && !d.getElementById('answer').disabled && skipBtn().hidden, 'then the answer is to be typed out, as after any miss (Passer out of the way)');
d.getElementById('answer').value = skipCard.italian; d.getElementById('submit').click();
ok(ev('index') === 1 && !skipBtn().hidden, 'typed out: on to the next card, which offers Passer again');
d.getElementById('answer').value = ev('deck[1].italian'); d.getElementById('submit').click();
ok(d.getElementById('feedback').classList.contains('correct'), 'Vérifier is never taken for a skip (it gets a click event, not true)');
({ d, ev } = round('nouns', ['maison'], 'it-en'));
d.getElementById('skip-btn').click();
ok(/Skipped — la maison means/.test(d.getElementById('feedback').textContent) && !d.getElementById('override-btn'), 'French → English: Skipped — … means …, with no "I was right" (there was no answer)');

// ---- French → English: retype the English; "I was right" lifts it ----
({ d, ev } = round('nouns', ['maison'], 'it-en'));
d.getElementById('answer').value = 'home sweet home';
d.getElementById('submit').click();
ok(d.getElementById('submit').textContent === 'Réécris →', 'French → English: a miss asks for the English');
d.getElementById('override-btn').click();
ok(d.getElementById('submit').textContent === 'Suivant →' && d.getElementById('answer').disabled && !d.getElementById('retype-hint'), '"I was right — count it" lifts the retype');
key(d, 'Enter');
ok(!!d.querySelector('.complete'), 'and Enter moves on');

// ---- Révision du jour ----
const R = boot({ 'pioche-subject': 'nouns' });
R.ev(`(() => { const s = loadSrs('nouns', 'en-it'); s.maison = { b: 1, d: today(), l: today() - 1 }; saveSrs('nouns', 'en-it', s); startRipasso(); })()`);
R.d.getElementById('answer').value = 'no'; R.d.getElementById('submit').click();
ok(R.d.getElementById('submit').textContent === 'Réécris →', 'Révision du jour asks for it too');
R.d.getElementById('answer').value = R.ev('deck[index].italian'); R.d.getElementById('submit').click();
ok(!!R.d.querySelector('.complete'), 'and moves on once it is typed right');
done();
