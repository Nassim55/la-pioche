// Parle: say the answer. A stand-in recogniser replaces the browser's (there is no
// microphone here): it records how it was set up and lets the test deliver what was "heard".
const { boot, ok, done } = require('./harness');

let recs = [];
const withMic = w => {
  w.SpeechRecognition = class {
    constructor() { recs.push(this); this.started = false; this.aborted = false; this.processLocally = false; }
    start() { this.started = true; }
    stop() { if (this.onend) this.onend(); }
    abort() { this.aborted = true; }
  };
  w.cancelledSpeech = 0;
  w.speechSynthesis = { speaking: true, cancel() { w.cancelledSpeech++; this.speaking = false; }, speak() {}, getVoices() { return []; }, addEventListener() {} };
  w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
};
const last = () => recs[recs.length - 1];
const say = (alts, final = true) => last().onresult({ results: [Object.assign(alts.map(t => ({ transcript: t })), { isFinal: final })] });
const round = (subj, keys, dir = 'en-it', mic = true) => {
  recs = [];
  const B = boot({ 'pioche-subject': subj }, mic ? withMic : null);
  B.ev(`direction = ${JSON.stringify(dir)}; selectedNouns = new Set(${JSON.stringify(keys)}); updateReadout();`);
  B.d.getElementById('start-btn').click();
  B.flush = () => new Promise(r => B.w.setTimeout(r, 5));   // the button settles just after a card is drawn
  return B;
};

(async () => {
  // ---- Only where the browser can listen ----
  let B = round('nouns', ['maison'], 'en-it', false);
  await B.flush();
  ok(B.d.getElementById('mic-btn').hidden, 'no speech recognition in the browser (Firefox, say): no Parle button');

  // ---- Saying it right ----
  B = round('nouns', ['maison', 'pain']);
  await B.flush();
  const { d, ev } = B, mic = () => d.getElementById('mic-btn');
  ok(!mic().hidden && !!mic().querySelector('svg.mic-icon') && /^Parle/.test(mic().getAttribute('aria-label')) && mic().parentElement.id === 'answer-wrap'
     && mic().previousElementSibling.id === 'answer' && d.getElementById('answer-wrap').classList.contains('has-mic'), 'on an English card, a microphone inside the answer box (at its right edge)');
  ok(!d.getElementById('mic-help').hidden && /⇧ Enter/.test(d.getElementById('mic-help').textContent), 'and the help line under the card says so: ⇧ Enter or the microphone to say it');
  const c0 = ev('deck[0]'), s0 = ev(`JSON.stringify(stats[${JSON.stringify(c0.noun)}] || null)`);
  mic().click(); await B.flush();
  ok(last().started && last().lang === 'fr-FR' && last().maxAlternatives === 5 && last().interimResults === true && mic().classList.contains('listening') && mic().getAttribute('aria-pressed') === 'true'
     && /Listening — say it in French/.test(d.getElementById('speak-hint').textContent), 'pressed: it listens in French, for up to five guesses, showing words as they come ("Listening — say it in French")');
  ok(B.w.cancelledSpeech === 1, 'and the app stops speaking first, so it never hears itself');
  say(['la ca'], false);
  ok(d.getElementById('answer').value === 'la ca' && d.getElementById('answer').classList.contains('interim'), 'words appear in the box as you speak');
  say(['la chose', c0.italian.toUpperCase()]);
  ok(d.getElementById('feedback').classList.contains('correct') && /Said aloud/.test(d.getElementById('feedback').textContent)
     && ev(`JSON.stringify(stats[${JSON.stringify(c0.noun)}])`) === '{"seen":1,"wrong":0}' && s0 === 'null', 'any of its guesses right (checked as leniently as typing): a right answer, marked Said aloud');
  await B.flush();
  ok(mic().hidden, 'once the answer is out, there is nothing to say: the button steps aside');

  // ---- A mishearing marks nothing ----
  d.getElementById('submit').click();   // Suivant
  await B.flush();
  const c1 = ev('deck[1]'), st1 = ev(`JSON.stringify(stats[${JSON.stringify(c1.noun)}] || null)`);
  ok(!mic().hidden, 'the next card offers it again');
  mic().click(); await B.flush();
  say(['quelque chose', 'qualche cosa']);
  ok(!ev('answered') && d.getElementById('feedback').classList.contains('hidden') && d.getElementById('answer').value === 'quelque chose'
     && /Heard “quelque chose” — say it again, fix it, or press Vérifier/.test(d.getElementById('speak-hint').textContent) && ev(`JSON.stringify(stats[${JSON.stringify(c1.noun)}] || null)`) === st1,
     'no guess right: nothing is marked — what was heard stays in the box, to say again, fix, or check');
  d.getElementById('submit').click();
  ok(d.getElementById('submit').textContent === 'Réécris →' && ev(`stats[${JSON.stringify(c1.noun)}].wrong`) === 1, 'checked by choice, it counts like any answer (and asks for the retype)');
  await B.flush();
  ok(!mic().hidden, 'the retype can be said too');
  mic().click(); await B.flush();
  say([c1.italian]);
  ok(ev('index') === 2 && ev(`stats[${JSON.stringify(c1.noun)}].wrong`) === 1, 'saying it right moves on — the retype still changes nothing');

  // ---- Listening in French, and a reply that came back in English ----
  B = round('nouns', ['maison']);
  await B.flush();
  const pageLang0 = B.d.documentElement.lang;
  B.d.getElementById('mic-btn').click(); await B.flush();
  ok(last().lang === 'fr-FR' && B.d.documentElement.lang === 'fr-FR', 'while listening the page itself is French too (the fallback for a recogniser that skips its own language)');
  say(['the mason', 'lemon son']);
  ok(B.d.documentElement.lang === pageLang0 && !B.ev('answered')
     && /came back in English/.test(B.d.getElementById('speak-hint').textContent) && /In Chrome, add French under Settings → Languages/.test(B.d.getElementById('speak-hint').textContent),
     'a reply in English ("the mason" for la maison) says so, with the fix for this browser (Chrome: Settings → Languages) — and the page language is put back');
  B.d.getElementById('mic-btn').click(); await B.flush();
  say(['la raison']);
  ok(/Heard “la raison” — say it again/.test(B.d.getElementById('speak-hint').textContent), 'an French mishearing still just asks to say it again');

  // ---- Safari gets Safari's fix ----
  recs = [];
  B = boot({ 'pioche-subject': 'nouns' }, w => { withMic(w); Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15' }); });
  B.ev("selectedNouns = new Set(['maison']); updateReadout();"); B.d.getElementById('start-btn').click();
  B.flush = () => new Promise(r => B.w.setTimeout(r, 5));
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  say(['the mason']);
  ok(/In Safari, add French under System Settings → Keyboard → Dictation → Languages/.test(B.d.getElementById('speak-hint').textContent), "…and in Safari, Safari's fix (System Settings → Keyboard → Dictation)");

  // ---- French on the device, where the browser has it ----
  const onDevice = (status, installs) => w => {
    withMic(w);
    w.SpeechRecognition.available = async opts => { w.askedFor = opts; return status; };
    w.SpeechRecognition.install = opts => { w.installed = opts; return installs; };
  };
  const fresh = setup => {
    recs = [];
    const X = boot({ 'pioche-subject': 'nouns' }, setup);
    X.ev("selectedNouns = new Set(['maison', 'pain']); updateReadout();"); X.d.getElementById('start-btn').click();
    X.flush = () => new Promise(r => X.w.setTimeout(r, 5));
    return X;
  };
  B = fresh(onDevice('available'));
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  ok(JSON.stringify(B.w.askedFor) === JSON.stringify({ langs: ['fr-FR'], processLocally: true }) && last().processLocally === true && last().lang === 'fr-FR',
     'where the browser has French on the device, it listens in French there (no room for an English pack)');
  let finishInstall;
  B = fresh(onDevice('downloadable', new Promise(r => { finishInstall = r; })));
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  ok(JSON.stringify(B.w.installed) === JSON.stringify({ langs: ['fr-FR'], processLocally: true }) && last().processLocally === false && last().lang === 'fr-FR',
     'where French can be downloaded: the download starts, and meanwhile it listens online, in French');
  finishInstall(true); await B.flush();
  say(['quelque chose']);
  B.d.getElementById('mic-btn').click(); await B.flush();
  ok(last().processLocally === true, 'once downloaded, it listens on the device');
  B = fresh(onDevice('available'));
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  const refused = last();
  refused.onerror({ error: 'language-not-supported' });
  ok(recs.length === 2 && last() !== refused && last().processLocally === false && last().started && B.d.getElementById('mic-btn').classList.contains('listening')
     && !/Couldn't/.test(B.d.getElementById('speak-hint').textContent), 'on-device refused: straight back to listening online, with nothing said');

  // ---- ⇧ Enter: say it without leaving the keyboard ----
  B = round('nouns', ['maison']);
  await B.flush();
  const shiftEnter = () => B.d.getElementById('answer').dispatchEvent(new B.w.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  shiftEnter(); await B.flush();
  ok(recs.length === 1 && last().started && B.d.getElementById('mic-btn').classList.contains('listening') && !B.ev('answered'), '⇧ Enter starts listening (and checks nothing)');
  shiftEnter(); await B.flush();
  ok(last().aborted && !B.d.getElementById('mic-btn').classList.contains('listening'), '⇧ Enter again stops');
  B.d.getElementById('answer').dispatchEvent(new B.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  ok(recs.length === 1 && B.d.getElementById('answer').placeholder === 'type your answer first…', 'plain Enter is still Enter: on an empty box it asks for an answer');

  // ---- Errors ----
  B = round('nouns', ['maison', 'pain']);
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  last().onerror({ error: 'no-speech' });
  ok(/Didn't catch anything/.test(B.d.getElementById('speak-hint').textContent) && !B.d.getElementById('mic-btn').hidden, "silence: Didn't catch anything — try again");
  B.d.getElementById('mic-btn').click(); await B.flush();
  last().onerror({ error: 'not-allowed' });
  await B.flush();
  ok(/microphone is blocked/.test(B.d.getElementById('speak-hint').textContent) && B.d.getElementById('mic-btn').hidden, 'a blocked microphone: says so, and the button goes for the session');

  // ---- Directions, shadowing, and listening stopped when it should be ----
  B = round('nouns', ['maison'], 'it-en');
  await B.flush();
  ok(B.d.getElementById('mic-btn').hidden && B.d.getElementById('mic-help').hidden, 'French → English: the answer is English, so no Parle (and no mention of it)');
  B = round('nouns', ['eau'], 'listen');
  await B.flush();
  ok(!B.d.getElementById('mic-btn').hidden, 'Listen: hear it, then say it back — shadowing');
  B.d.getElementById('mic-btn').click(); await B.flush();
  say(["l'eau"]);
  ok(B.d.getElementById('feedback').classList.contains('correct'), "…l'eau, said aloud, is right");
  B = round('nouns', ['maison', 'pain']);
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  const r1 = last();
  B.d.getElementById('mic-btn').click(); await B.flush();
  ok(r1.aborted && !B.d.getElementById('mic-btn').classList.contains('listening') && B.d.getElementById('speak-hint').textContent === '', 'pressed again while listening: it stops');
  B.d.getElementById('mic-btn').click(); await B.flush();
  const r2 = last();
  B.d.getElementById('answer').value = 'xyz'; B.d.getElementById('skip-btn').click();
  B.d.getElementById('answer').value = B.ev('deck[0].italian'); B.d.getElementById('submit').click();
  ok(r2.aborted, 'a new card stops any listening');
  B = round('nouns', ['maison']);
  await B.flush();
  B.d.getElementById('mic-btn').click(); await B.flush();
  const r3 = last();
  B.d.getElementById('change-btn').click();
  ok(r3.aborted, 'so does going back to the setup screen');
  done();
})();
