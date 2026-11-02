const { boot, ok, done } = require('./harness');
// ---- Session A: some history ----
const A = boot({
  'pioche-noms-stats-v1': JSON.stringify({ pain: { seen: 4, wrong: 1 }, maison: { seen: 2, wrong: 0 } }),
  'pioche-noms-assoc-v1': JSON.stringify({ pain: 'companion' }),
  'pioche-subject': 'nouns'
});
ok(A.d.title === 'La Pioche · Noms' && A.d.getElementById('app-subtitle').textContent === 'La Pioche · Article défini', `branded: tab "${A.d.title}", subtitle "${A.d.getElementById('app-subtitle').textContent}"`);
const meta = A.d.getElementById('setup-meta').textContent.replace(/\s+/g, ' ').trim();
ok(/back up · restore ·\s?reset progress/.test(meta), `strip shows back up · restore · reset ("${meta}")`);
const backup = A.ev('buildBackup()');
ok(backup.app === 'la-pioche' && ['pioche-subject', 'pioche-noms-stats-v1', 'pioche-noms-assoc-v1', 'pioche-noms-stats-v1:srs'].every(k => k in backup.data),
   `the backup holds the section, its progress, associations and review schedule (${Object.keys(backup.data).join(', ')})`);
// The download itself (jsdom has no object URLs, so stub them and catch the click)
let downloaded = null;
A.w.URL.createObjectURL = () => 'blob:test'; A.w.URL.revokeObjectURL = () => {};
A.w.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
A.d.getElementById('backup-progress').click();
ok(/^la-pioche-backup-\d{4}-\d{2}-\d{2}\.json$/.test(downloaded || ''), `"back up" downloads ${downloaded}`);

// ---- Session B: a browser with separate storage (starts empty) ----
const B = boot();
const metaB = B.d.getElementById('setup-meta');
ok(!metaB.classList.contains('empty') && /No noun progress logged yet/.test(metaB.textContent) && !B.d.getElementById('reset-stats') && !!B.d.getElementById('restore-progress'),
   'empty: strip still visible with "restore" (no reset link)');
const text = JSON.stringify(backup);
B.w.alert = () => {};
B.w.confirm = () => false;
ok(B.ev(`restoreFromText(${JSON.stringify(text)})`) === false && ['pioche-noms-stats-v1', 'pioche-noms-assoc-v1'].every(k => B.w.localStorage.getItem(k) === null), 'declining the confirm changes nothing');
let alerted = ''; B.w.alert = m => { alerted = m; };
ok(B.ev(`restoreFromText('{"hello": 1}')`) === false && /isn't a La Pioche backup/.test(alerted), 'a non-backup file is refused with a clear message');
alerted = '';
const italian = JSON.stringify({ app: 'il-mazzo', data: { 'sostantivi-stats-v1': JSON.stringify({ casa: { seen: 3, wrong: 0 } }) } });
ok(B.ev(`restoreFromText(${JSON.stringify(italian)})`) === false && /isn't a La Pioche backup/.test(alerted) && B.w.localStorage.getItem('sostantivi-stats-v1') === null,
   "an Il Mazzo backup is refused too: the two games' progress stays apart");
B.w.confirm = () => true;
const tampered = JSON.parse(text); tampered.data['some-other-site'] = '{"x":1}'; tampered.data['sostantivi-stats-v1'] = '{}';
ok(B.ev(`restoreFromText(${JSON.stringify(JSON.stringify(tampered))})`) === true, 'restore accepted');
ok(B.w.localStorage.getItem('some-other-site') === null && B.w.localStorage.getItem('sostantivi-stats-v1') === null, "unknown keys in the file are ignored, Il Mazzo's among them");
ok(/2\/400 practised · 1 with errors logged/.test(B.d.getElementById('setup-meta').textContent.replace(/\s+/g, ' ')), 'noun progress restored');
B.ev("selectedNouns = new Set(['pain']); updateReadout();"); B.d.getElementById('start-btn').click();
B.d.getElementById('answer').value = 'le pain'; B.d.getElementById('submit').click();
ok(B.d.querySelector('.assoc-text')?.textContent === 'companion', 'noun association restored and shown after answering');
ok(A.errors.length === 0 && B.errors.length === 0 && A.warns.length === 0 && B.warns.length === 0, 'no runtime errors or warnings');
done();
