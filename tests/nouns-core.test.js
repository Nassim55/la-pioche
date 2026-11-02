// The French deck: its data, how answers are checked, notes and associations
const { boot, ok, done } = require('./harness');
let { w, d, ev, key, warns, errors } = boot();
ok(warns.length === 0 && errors.length === 0, 'loads with no validator warnings or errors');
ok(ev('subject') === 'nouns' && ev('nounData.length') === 400, 'opens on Noms with 400 nouns');
const keys = ev('nounData.map(n => n.noun)');
ok(new Set(keys).size === 400 && new Set(ev('nounData.map(n => n.en.toLowerCase())')).size === 400 && new Set(ev('nounData.map(n => n.it)')).size === 400, 'no duplicate keys, English prompts or French forms');
const themed = new Set(ev('THEMES.flatMap(t => t.nouns)'));
ok(keys.every(k => themed.has(k)) && [...themed].every(k => keys.includes(k)), 'every noun themed, no unknown theme keys');
ok(ev('FREQUENCY_ORDER.length') === 400 && keys.every(k => ev(`Number.isFinite(rankOf(${JSON.stringify(k)}))`)), 'every noun ranked');
ok(JSON.stringify(ev('NOUN_FREQUENCY_ORDER.slice(0, 5)')) === JSON.stringify(['an', 'temps', 'jour', 'fait', 'fois']), `the most common first: ${ev('NOUN_FREQUENCY_ORDER.slice(0, 5).join(", ")')}`);
const rank = k => ev(`NOUN_FREQUENCY_ORDER.indexOf(${JSON.stringify(k)})`);
ok(rank('maison') < rank('voiture') && rank('voiture') < rank('chien') && rank('chien') < rank('fromage') && rank('fromage') < rank('hibou'),
   'ranked by one score: la maison, la voiture, le chien, le fromage, le hibou');
ok(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'été', 'hiver', 'printemps', 'automne', 'pain', 'fromage', 'chemise', 'chien', 'gare'].every(k => keys.includes(k)),
   'the everyday nouns are there too: the days, the seasons, bread, cheese, the shirt, the dog, the station');
const fails = ev('nounData.filter(n => !checkEnglish(n.en, { english: n.en }).correct || !checkEnglish(n.en.replace(/\\([^)]*\\)/g, "").replace(/^the /i, "").trim(), { english: n.en }).correct).map(n => n.en)');
ok(fails.length === 0, `English checker accepts all 400 prompts (${fails.slice(0, 3).join(', ')})`);

// ---- Articles, genders, plurals ----
const wrongArticle = ev(`NOUN_ITEMS.filter(n => {
  const m = n.it.match(/^(le |la |les |l')(.+)$/);
  if (!m) return true;
  const art = m[1].trim(), word = m[2];
  if (art === 'les') return n.pl !== word;
  const elide = /^[aàâäeéèêëiîïoôöuùûüœæ]/.test(word) || (/^h/.test(word) && !n.aspH);
  return elide ? art !== "l'" : art !== (n.g === 'f' ? 'la' : 'le');
}).map(n => n.it)`);
ok(wrongArticle.length === 0, `every article fits its noun: l' before a vowel or a mute h, le or la by gender otherwise, les for plural-only nouns${wrongArticle.length ? ': ' + wrongArticle.join(', ') : ''}`);
const asp = ev('NOUN_ITEMS.filter(n => n.aspH).map(n => n.it)').sort();
ok(JSON.stringify(asp) === JSON.stringify(['la hache', 'la honte', 'le haricot', 'le hasard', 'le haut', 'le hibou', 'le héros']), `aspirated h marked: ${asp.join(', ')}`);
ok(ev(`NOUN_ITEMS.filter(n => /^h/.test(n.noun) && !n.aspH).every(n => n.it.startsWith("l'"))`) && ev(`['homme', 'heure', 'hôpital', 'hiver', 'histoire', 'hôtel'].every(k => NOUN_ITEMS.some(n => n.noun === k))`),
   "every other h is mute and elides: l'homme, l'heure, l'hôpital, l'hiver");
const g = k => ev(`NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}).g`);
ok(g('côté') === 'm' && g('été') === 'm' && g('musée') === 'm' && g('plage') === 'f' && g('image') === 'f' && g('page') === 'f' && g('personne') === 'f' && g('légume') === 'm' && g('problème') === 'm' && g('erreur') === 'f' && g('bébé') === 'm',
   'the genders that catch people out: le côté, l\'été, le musée, la plage, l\'image, la page, la personne, le légume, le problème, l\'erreur, le bébé');
const note = k => ev(`NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}).note || ''`);
ok(/-tion/.test(note('question')) && /-té/.test(note('côté')) && /-ment/.test(note('gouvernement')) && /-age/.test(note('image')) && /lost s/.test(note('forêt')) && /False friend/.test(note('chemise')),
   'notes carry the gender patterns (-tion, -té, -ment, -age), the circumflex for a lost s, and the false friends');
const pl = k => ev(`NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}).pl`);
ok(pl('œil') === 'yeux' && pl('monsieur') === 'messieurs' && pl('travail') === 'travaux' && pl('ciel') === 'cieux' && pl('cheveu') === 'cheveux' && pl('hibou') === 'hiboux' && pl('grand-mère') === 'grands-mères' && pl('argent') === null,
   'plurals are spelled out, irregular ones included: yeux, messieurs, travaux, cieux, cheveux, hiboux, grands-mères (none for l\'argent)');
const odd = ev(`NOUN_ITEMS.filter(n => n.pl && !/^les /.test(n.it) && !/[- ]/.test(n.noun)).filter(n => {
  const s = n.noun, p = n.pl;
  if (/[sxz]$/.test(s)) return p !== s;
  if (/eau$/.test(s)) return p !== s + 'x';
  if (/al$/.test(s)) return p !== s.slice(0, -2) + 'aux';
  return false;
}).map(n => n.noun + '/' + n.pl)`);
ok(odd.length === 0, `plurals follow the patterns: -s, -x, -z unchanged, -eau adds x, -al becomes -aux${odd.length ? ': ' + odd.join(', ') : ''}`);
const c = k => `cardsForItem(NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}))[0]`;
ok(ev(`checkAnswer('l eau', ${c('eau')}).correct`) && ev(`checkAnswer("L'EAU", ${c('eau')}).correct`) && ev(`checkAnswer('la eau', ${c('eau')}).reason`) === 'wrong-article'
   && ev(`checkAnswer('maison', ${c('maison')}).reason`) === 'missing-article' && ev(`checkAnswer('le maison', ${c('maison')}).reason`) === 'wrong-article',
   'article checking: apostrophes and capitals forgiven; a missing article, a wrong one and a missed elision caught');

// ---- Associations and notes ----
ev("selectedNouns = new Set(['pain', 'fromage']); updateReadout();");
d.getElementById('start-btn').click();
ev("deck.sort((a, b) => (a.noun === 'pain' ? -1 : 1)); render();");
ok(d.getElementById('prompt').textContent === 'the bread', 'card 1 prompt renders');
let card = ev('deck[0]');
d.getElementById('answer').value = card.italian; d.getElementById('submit').click();
let fb = d.getElementById('feedback');
ok(fb.className.includes('correct') && !!fb.querySelector('.feedback-note') && !!d.getElementById('assoc-edit'), 'correct answer: note + "+ Add association" shown');
d.getElementById('assoc-edit').click();
const input = d.getElementById('assoc-input'); input.value = 'companion <shared bread>'; key(input, 'Enter');
ok(ev('index') === 0, 'Enter in the association box saves without advancing');
ok(JSON.parse(w.localStorage.getItem('pioche-noms-assoc-v1')).pain === 'companion <shared bread>', 'association saved under the noun key');
ok(d.querySelector('.assoc-text').textContent === 'companion <shared bread>', 'association shown, HTML-escaped');
d.getElementById('assoc-edit').click(); d.getElementById('assoc-input').value = 'x'; key(d.getElementById('assoc-input'), 'Escape');
ok(d.querySelector('.assoc-text').textContent === 'companion <shared bread>', 'Escape cancels an edit');
key(d.body, 'Enter');
ok(ev('index') === 1, 'Enter moves to the next card');
d.getElementById('answer').value = 'quelque chose'; d.getElementById('submit').click();
fb = d.getElementById('feedback');
ok(fb.className.includes('incorrect') && !!fb.querySelector('.feedback-note') && !!d.getElementById('assoc'), 'wrong answer: note + association area');
ok(!d.getElementById('answer').disabled && d.getElementById('answer').value === '' && d.getElementById('submit').textContent === 'Réécris →', 'after a miss the box clears for the right answer');
d.getElementById('answer').value = ev('deck[index].italian'); key(d.body, 'Enter');
d.getElementById('play-again').click();
ev(`index = deck.findIndex(c => c.noun === 'pain'); render();`);
ok(!d.querySelector('.card').textContent.includes('companion'), 'association hidden before answering');
d.getElementById('answer').value = 'le pain'; d.getElementById('submit').click();
ok(d.querySelector('.assoc-text')?.textContent === 'companion <shared bread>', 'association appears after answering');
d.querySelector('.direction-toggle [data-dir="it-en"]').click();
ev(`index = deck.findIndex(c => c.noun === 'pain'); render();`);
ok(d.getElementById('prompt').textContent === 'le pain', 'FR → EN shows the French');
d.getElementById('answer').value = 'loaf'; d.getElementById('submit').click();
ok(!!d.getElementById('override-btn'), 'FR → EN: a wrong answer offers "I was right"');
d.getElementById('override-btn').click();
ok(d.getElementById('feedback').className.includes('correct') && !!d.querySelector('.feedback-note') && d.querySelector('.assoc-text')?.textContent.includes('companion'), 'override keeps note and association');
ok(errors.length === 0, 'no runtime errors');
const store = { 'pioche-noms-assoc-v1': w.localStorage.getItem('pioche-noms-assoc-v1') };
({ w, d, ev, errors } = boot(store));
ev("selectedNouns = new Set(['pain']); updateReadout();"); d.getElementById('start-btn').click();
d.getElementById('answer').value = 'le pain'; d.getElementById('submit').click();
ok(d.querySelector('.assoc-text')?.textContent === 'companion <shared bread>', 'association survives a reload');
done();
