// Both games are served from nassim55.github.io, so they share its localStorage. Every key
// La Pioche reads or writes starts with pioche-; with Il Mazzo's key names, each game would
// overwrite the other's progress on the same device.
const { boot, ok, done } = require('./harness');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const literal = [...src.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*'([^']+)'/g)].map(m => m[1]);
const consts = [...src.matchAll(/const \w+_KEY = '([^']+)'/g)].map(m => m[1]);
const sectionKeys = [...src.matchAll(/statsKeys: \{([^}]*)\}|assocKey: '([^']+)'/g)].flatMap(m => m[1] ? [...m[1].matchAll(/'([^']+-v\d+)'/g)].map(x => x[1]) : [m[2]]);
const all = [...literal, ...consts, ...sectionKeys];
const bad = all.filter(k => !k.startsWith('pioche-'));
ok(consts.length >= 6 && sectionKeys.length === 4 && bad.length === 0, `every key named in the code starts with pioche- (${all.length} found${bad.length ? '; not: ' + bad.join(', ') : ''})`);
ok(!/sostantivi-|flipcards-|'mazzo-|il-mazzo-sync/.test(src), "none of Il Mazzo's key names appear, nor its sync server");

// Everything that saves, used once: rounds in each direction, an association, the review
// direction, voice and En balade settings, sync bookkeeping, a reset and a backup
const { w, d, ev, errors, warns } = boot({}, win => {
  win.confirm = () => true; win.alert = () => {};
  win.SpeechSynthesisUtterance = function (t) { this.text = t; };
  win.speechSynthesis = { getVoices: () => [{ name: 'Thomas', lang: 'fr-FR', voiceURI: 'thomas', localService: true }], cancel() {}, speak() {}, addEventListener() {} };
});
for (const dir of ['en-it', 'it-en', 'listen']) {
  ev(`showSetup(); direction = '${dir}'; selectedNouns = new Set(['pain', 'eau']); updateReadout();`);
  d.getElementById('start-btn').click();
  for (let k = 0; k < 2; k++) { d.getElementById('answer').value = 'faux'; d.getElementById('submit').click(); ev('index++; render();'); }
}
ev('showSetup()');
ev("associations = { pain: 'companion' }; saveAssociations(); saveAudioPrefs(); savePassivePrefs(); syncSaveMeta({ epochs: {} }); localStorage.setItem(SYNC_BASE_KEY, '{}');");
d.querySelector('[data-ripasso-dir="listen"]').click();
ev('buildBackup()');
const keys = []; for (let i = 0; i < w.localStorage.length; i++) keys.push(w.localStorage.key(i));
ok(keys.length >= 10 && keys.every(k => k.startsWith('pioche-')), `every key written starts with pioche- (${keys.length}: ${keys.join(', ')})`);
d.getElementById('reset-stats').click();
const after = []; for (let i = 0; i < w.localStorage.length; i++) after.push(w.localStorage.key(i));
ok(after.every(k => k.startsWith('pioche-')), 'a reset keeps to them too');
ok([...ev('storageKeys()')].every(k => k.startsWith('pioche-')) && ev('[...syncedKeys().keys()]').every(k => k.startsWith('pioche-')), 'and so does every key backed up or synced');
ok(errors.length === 0 && warns.length === 0, 'no errors or warnings');

// Il Mazzo's progress on the same site is neither read nor touched
const IM = { 'sostantivi-stats-v1': JSON.stringify({ casa: { seen: 3, wrong: 1 } }), 'flipcards-subject': 'verbs', 'mazzo-audio-v1': JSON.stringify({ voiceURI: 'alice' }), 'mazzo-ripasso-dir': 'it-en' };
const X = boot(IM);
X.ev("selectedNouns = new Set(['maison']); updateReadout();"); X.d.getElementById('start-btn').click();
X.d.getElementById('answer').value = 'la maison'; X.d.getElementById('submit').click();
ok(Object.entries(IM).every(([k, v]) => X.w.localStorage.getItem(k) === v) && X.ev('subject') === 'nouns' && X.ev('ripassoDir') === 'en-it' && X.ev('Object.keys(stats).join()') === 'maison',
   "Il Mazzo's keys, on the same site, are neither read nor changed");
done();
