// The French game's screens: names and labels, the gender behind l' and les, why an
// article is wrong, and accents forgiven with the right spelling shown
const { boot, ok, done } = require('./harness');
const round = (keys, dir = 'en-it') => {
  const B = boot();
  B.ev(`direction = ${JSON.stringify(dir)}; selectedNouns = new Set(${JSON.stringify(keys)}); updateReadout();`);
  B.d.getElementById('start-btn').click();
  return B;
};
const answer = (B, noun, raw) => {
  B.ev(`index = deck.findIndex(c => c.noun === ${JSON.stringify(noun)}); render();`);
  B.d.getElementById('answer').value = raw; B.d.getElementById('submit').click();
  return B.d.getElementById('feedback');
};
let B = boot();
const d = B.d;
ok(d.title === 'La Pioche · Noms' && d.getElementById('app-title').textContent === 'Noms' && d.getElementById('app-subtitle').textContent === 'La Pioche · Article défini',
   'the tab, title and subtitle: La Pioche · Noms · Article défini');
ok(!d.getElementById('subject-toggle'), 'one section so far, so no section switcher');
ok(/Révision du jour/.test(d.getElementById('ripasso').textContent), 'the review strip is Révision du jour');
ok(d.querySelectorAll('.verb-chip').length === 400, 'the grid has all 400 nouns');
const labels = B.ev('THEMES.map(t => t.label)');
ok(['Temps', 'Personnes', 'Corps', 'Lieux', 'Maison', 'Nourriture', 'Vêtements', 'Société', 'Idées'].every(l => labels.includes(l)), `themes in French: ${labels.join(', ')}`);
ok(/En balade/.test(d.getElementById('passive-btn').textContent) && /the French then the English/.test(d.getElementById('passive-btn').textContent), 'En balade: hear each card, the French then the English');

B = round(['eau', 'maison', 'gens', 'hiver']);
ok(B.d.querySelector('.direction-toggle [data-dir="en-it"]').textContent === 'EN → FR' && B.d.querySelector('.direction-toggle [data-dir="it-en"]').textContent === 'FR → EN', 'directions: EN → FR, FR → EN');
ok(B.d.getElementById('submit').textContent === 'Vérifier' && B.d.getElementById('skip-btn').textContent === 'Passer' && B.d.getElementById('pronoun-hint').textContent === '+ article'
   && B.d.getElementById('answer').placeholder === 'type the french with its article…', 'Vérifier, Passer, + article');
let fb = answer(B, 'eau', "l'eau");
ok(fb.classList.contains('correct') && /✓ Correct/.test(fb.textContent) && fb.querySelector('.gender-tag')?.textContent === '(f.)', "l'eau: right, with its gender shown (f.)");
ok(B.d.getElementById('submit').textContent === 'Suivant →', 'then Suivant →');
fb = answer(B, 'maison', 'la maison');
ok(fb.classList.contains('correct') && !fb.querySelector('.gender-tag'), 'la maison: the article already says it, so no tag');
fb = answer(B, 'gens', 'les gens');
ok(fb.querySelector('.gender-tag')?.textContent === '(m.)', 'les gens: (m.)');
fb = answer(B, 'hiver', "l'hiver");
ok(fb.querySelector('.gender-tag')?.textContent === '(m.)', "l'hiver (m.): a mute h elides, and hides the gender too");

B = round(['eau', 'héros', 'gens', 'maison', 'hôpital']);
fb = answer(B, 'eau', 'la eau');
ok(fb.classList.contains('incorrect') && /starts with a vowel, so le or la becomes l'/.test(fb.textContent) && /l'eau/.test(fb.textContent) && /feminine/.test(fb.textContent),
   "la eau: the elision explained — l'eau (feminine)");
fb = answer(B, 'hôpital', 'le hôpital');
ok(/starts with a mute h, so le or la becomes l'/.test(fb.textContent), 'le hôpital: a mute h elides too');
fb = answer(B, 'héros', "l'héros");
ok(/the h of héros is aspirated, so there's no elision: le héros/.test(fb.textContent), "l'héros: an aspirated h keeps the full article");
fb = answer(B, 'gens', 'le gens');
ok(/gens is plural here: les gens/.test(fb.textContent), 'le gens: plural only');
fb = answer(B, 'maison', 'le maison');
ok(/maison is feminine: la maison/.test(fb.textContent), 'le maison: the gender');
fb = answer(B, 'maison', 'maison');
ok(/Don't forget the article/.test(fb.textContent), 'maison alone: the article is required');
fb = answer(B, 'eau', 'eau');
ok(/Don't forget the article/.test(fb.textContent) && fb.querySelector('.gender-tag')?.textContent === '(f.)', "eau alone: the article is required, and the gender shown with l'eau");

B = round(['forêt', 'grand-mère', 'clé', 'cœur']);
fb = answer(B, 'forêt', 'la foret');
ok(fb.classList.contains('correct') && fb.querySelector('.accent-miss')?.textContent === 'ê' && /mind the ê/.test(fb.querySelector('.accent-note').textContent),
   'la foret: counted, with the ê highlighted and named');
fb = answer(B, 'forêt', 'la forèt');
ok(fb.classList.contains('incorrect'), 'la forèt: a wrong accent is a mistake');
B.d.getElementById('answer').value = 'la foret'; B.d.getElementById('submit').click();
ok(B.ev('mustRetype') === false && B.ev('index') > B.ev("deck.findIndex(c => c.noun === 'forêt')"), '…and the retype forgives a missing accent too');
fb = answer(B, 'grand-mère', 'la grand mere');
ok(fb.classList.contains('correct') && [...fb.querySelectorAll('.accent-miss')].map(e => e.textContent).join('') === '-è' && /mind the hyphen, the è/.test(fb.textContent),
   'la grand mere: counted, the hyphen and the è highlighted');
fb = answer(B, 'clé', 'la clef');
ok(fb.classList.contains('correct') && /la clef/.test(fb.textContent) && /or la clé/.test(fb.textContent) && !fb.querySelector('.accent-note'), 'la clef: the other spelling counts, with la clé beside it');
fb = answer(B, 'cœur', 'le coeur');
ok(fb.classList.contains('correct') && !fb.querySelector('.accent-note') && /le cœur/.test(fb.textContent), 'le coeur: right, shown as le cœur, nothing to mind');
ok(B.errors.length === 0 && B.warns.length === 0, 'no errors or warnings');
done();
