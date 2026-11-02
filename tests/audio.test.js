const { boot, ok, done } = require('./harness');
// A stand-in speech engine: a voice list, and a record of everything "spoken"
function fakeSpeech(voices) {
  return w => {
    w.__spoken = [];
    w.SpeechSynthesisUtterance = function (text) { this.text = text; };
    w.speechSynthesis = { getVoices: () => voices, cancel() {}, speak(u) { w.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate, lang: u.lang }); }, addEventListener() {} };
  };
}
const VOICES = [
  { name: 'Samantha', lang: 'en-US', voiceURI: 'sam', localService: true },
  { name: 'Thomas', lang: 'fr-FR', voiceURI: 'thomas', localService: true },
  { name: 'Audrey (Enhanced)', lang: 'fr-FR', voiceURI: 'audrey-enh', localService: true }
];
let { w, d, ev, key, errors, warns } = boot({}, fakeSpeech(VOICES));
const spoken = () => w.__spoken.map(s => s.text);
const last = () => w.__spoken[w.__spoken.length - 1];
ok(warns.length === 0 && errors.length === 0, 'loads cleanly with speech available');
ok(ev('chosenVoice().name') === 'Audrey (Enhanced)', 'picks the best French voice (Enhanced over standard, never the English one)');
const opts = [...d.querySelectorAll('#audio-voice option')].map(o => o.textContent);
ok(JSON.stringify(opts) === JSON.stringify(['Thomas', 'Audrey (Enhanced)']) && d.getElementById('audio-auto').checked, `voice settings list only French voices (${opts.join(', ')}); read-aloud on by default`);
d.getElementById('audio-test').click();
ok(last().text === 'Bonjour\u00a0! Voici ma voix.' && last().voice === 'Audrey (Enhanced)' && last().lang === 'fr-FR', '▶ test speaks in the chosen French voice');
// ---- Nouns, EN→IT: no 🔊 on the card before answering (it would give the answer away) ----
ev("selectedNouns = new Set(['pain', 'sac']); updateReadout();");
d.getElementById('start-btn').click();
ev("index = deck.findIndex(c => c.noun === 'pain'); render();");
ok(d.getElementById('card-speak').hidden && w.__spoken.length === 1, 'EN→IT: no 🔊 on the card, nothing spoken before you answer');
d.getElementById('answer').value = 'le pain'; d.getElementById('submit').click();
ok(last().text === 'le pain' && !!d.getElementById('speak-btn'), 'after answering: "le pain" is read aloud, with a 🔊 to replay');
const n = w.__spoken.length; d.getElementById('speak-btn').click();
ok(w.__spoken.length === n + 1 && last().text === 'le pain', '🔊 replays it');
ev("index = deck.findIndex(c => c.noun === 'sac'); render();");
d.getElementById('answer').value = 'il sac'; d.getElementById('submit').click();
ok(last().text === 'le sac', 'a wrong answer reads the right one: "le sac"');
// ---- Read-aloud off: silent, but 🔊 still works ----
d.getElementById('change-btn').click();
d.getElementById('audio-auto').checked = false; d.getElementById('audio-auto').dispatchEvent(new w.Event('change'));
ok(JSON.parse(w.localStorage.getItem('pioche-audio-v1')).auto === false, 'turning read-aloud off is remembered');
d.getElementById('start-btn').click();
const before = w.__spoken.length;
d.getElementById('answer').value = 'x'; d.getElementById('submit').click();
ok(w.__spoken.length === before && !!d.getElementById('speak-btn'), 'with read-aloud off nothing is spoken automatically, but 🔊 is there');
d.getElementById('change-btn').click();
d.getElementById('audio-auto').checked = true; d.getElementById('audio-auto').dispatchEvent(new w.Event('change'));
// ---- Speed and voice choice ----
const rate = d.getElementById('audio-rate'); rate.value = '0.7'; rate.dispatchEvent(new w.Event('change'));
ok(last().rate === 0.7 && ev('audioPrefs.rate') === 0.7, 'slow speed is used and remembered');
const vsel = d.getElementById('audio-voice'); vsel.value = 'thomas'; vsel.dispatchEvent(new w.Event('change'));
ok(last().voice === 'Thomas' && ev('chosenVoice().name') === 'Thomas', 'choosing another French voice switches to it');
ok(Object.keys(ev('buildBackup()').data).includes('pioche-audio-v1'), 'voice settings are included in backups');
ok(errors.length === 0, `no runtime errors ${errors.join('; ')}`);
// ---- No French voice: helpful message, nothing breaks ----
const r = boot({}, fakeSpeech([{ name: 'Samantha', lang: 'en-US', voiceURI: 'sam' }]));
ok(/No French voice found/.test(r.d.getElementById('audio-row').textContent) && /ⓘ next to System voice/.test(r.d.getElementById('audio-row').textContent), 'no French voice: the settings row explains how to add one');
r.ev("selectedNouns = new Set(['pain']); updateReadout();"); r.d.getElementById('start-btn').click();
r.d.querySelector('.direction-toggle [data-dir="listen"]').click();
ok(/no French voice found/.test(r.d.getElementById('pronoun-hint').textContent), 'listening without a voice says so on the card');
r.d.getElementById('answer').value = 'le pain'; r.d.getElementById('submit').click();
ok(!r.d.getElementById('speak-btn') && r.errors.length === 0, 'no 🔊 buttons and no errors without a voice');
// ---- No speech support at all ----
const z = boot();
ok(/isn't available in this browser/.test(z.d.getElementById('audio-row').textContent) && z.errors.length === 0, 'no speech support: one quiet line, no errors');
// ---- France's voices before Canada's ----
const ca = boot({}, fakeSpeech([{ name: 'Amélie (Enhanced)', lang: 'fr-CA', voiceURI: 'amelie-enh', localService: true }, { name: 'Thomas', lang: 'fr-FR', voiceURI: 'thomas', localService: true }]));
ok(ca.ev('chosenVoice().name') === 'Thomas', "France's voice comes first, even over an Enhanced Canadian one");
done();
