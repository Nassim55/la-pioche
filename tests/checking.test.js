// How French answers are checked: Il Mazzo's rules (capitals and apostrophes forgiven,
// the article and its elision required) and the accent rule chosen for French — a
// missing accent forgiven, a wrong or extra one not; the cedilla and hyphens alike.
const { boot, ok, done } = require('./harness');
const { ev, warns, errors } = boot();
const check = (k, raw) => ev(`checkAnswer(${JSON.stringify(raw)}, cardsForItem(NOUN_ITEMS.find(n => n.noun === ${JSON.stringify(k)}))[0])`);
const right = (k, raw) => check(k, raw).correct === true;
ok(right('forêt', 'la forêt') && check('forêt', 'la forêt').missing.length === 0, 'la forêt: right, nothing to flag');
ok(right('forêt', 'la foret') && check('forêt', 'la foret').missing.length === 1, 'la foret: a missing accent is forgiven, and flagged');
ok(!right('forêt', 'la forèt') && !right('forêt', 'la forét') && !right('forêt', 'la fôret'), 'la forèt, la forét, la fôret: a wrong or extra accent is not');
ok(right('été', "l'ete") && !right('été', "l'èté"), "l'ete passes; l'èté doesn't");
ok(right('garçon', 'le garcon') && !right('garçon', 'le garcön') && !right('maison', 'la maiçon'), 'the cedilla follows the same rule');
ok(right('grand-mère', 'la grand-mère') && right('grand-mère', 'la grand mère') && right('grand-mère', 'la grandmère') && right('grand-mère', 'la grand mere'),
   'a missing hyphen is forgiven, as a space or as nothing');
ok(!right('maison', 'la mai-son'), 'an extra hyphen is not');
ok(right('cœur', 'le cœur') && right('cœur', 'le coeur') && right('œil', "l'oeil") && right('sœur', 'la soeur') && check('cœur', 'le coeur').missing.length === 0, 'oe for œ always passes, with nothing to flag');
ok(right('eau', "l'eau") && right('eau', 'l’eau') && right('eau', 'l eau') && right('eau', "L'EAU") && right('eau', "  l'eau  "), 'apostrophes straight, curly or a space; capitals and outer spaces ignored');
ok(!right('eau', 'leau'), 'but the article has to be there as a word');
ok(check('eau', 'la eau').reason === 'wrong-article' && check('eau', 'le eau').reason === 'wrong-article', 'a missed elision is a wrong article');
ok(check('héros', "l'héros").reason === 'wrong-article' && right('héros', 'le héros') && right('héros', 'le heros'), "an aspirated h keeps the full article: le héros (le heros forgiven), never l'héros");
ok(check('maison', 'maison').reason === 'missing-article' && check('eau', 'eau').reason === 'missing-article', 'a missing article is caught');
ok(check('maison', 'le maison').reason === 'wrong-article' && check('maison', 'une maison').reason === 'wrong-article', 'a wrong article is caught, the indefinite one too');
ok(right('gens', 'les gens') && check('gens', 'le gens').reason === 'wrong-article', 'plural-only nouns take les');
ok(right('clé', 'la clé') && right('clé', 'la clef') && right('clé', 'la cle') && check('clé', 'la clef').answer === 'la clef', 'other correct spellings count: la clef');
ok(right('petit-déjeuner', 'le petit déjeuner') && check('petit-déjeuner', 'le petit déjeuner').missing.length === 0, 'the spelling needing fewest allowances wins: le petit déjeuner is simply right');
ok(right('après-midi', "l'apres-midi") && right('week-end', 'le weekend'), "l'apres-midi and le weekend pass");
ok(!right('maison', 'la maisons') && !right('maison', 'la') && check('maison', '').correct === false, 'anything else is wrong');
ok(right('forêt', 'la fore\u0302t'), 'accents typed as combining marks count as the same letters');
ok(warns.length === 0 && errors.length === 0, 'no warnings or errors');
done();
