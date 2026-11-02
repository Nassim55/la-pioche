// Deck size as sliders: one normally; two (the missed cards, and the rest) after
// "Practise the ones I missed" — live labels, growing and shrinking each group,
// played cards kept, never an empty deck, and the game's keys left alone.
const { boot, ok, done } = require('./harness');
const { w, d, ev, errors, warns } = boot();
ok(errors.length === 0 && warns.length === 0, 'loads cleanly');
const el = id => d.getElementById(id);
const label = id => el(`${id}-value`).textContent;
const set = (id, v, type = 'change') => { el(id).value = String(v); el(id).dispatchEvent(new w.Event(type)); };
const answer = (noun, raw) => { ev(`index = deck.findIndex(c => c.noun === ${JSON.stringify(noun)}); render();`); el('answer').value = raw; el('submit').click(); };
const nouns = ['pain', 'maison', 'livre', 'eau', 'chat', 'chien'];

// ---- One slider ----
ev(`selectedNouns = new Set(${JSON.stringify(nouns)}); capValue = '4'; updateReadout();`);
el('deck-cap') && (el('deck-cap').value = '4', el('deck-cap').dispatchEvent(new w.Event('input')));
el('start-btn').click();
const n0 = ev('deck.length');
ok(el('game-trim-input').type === 'range' && +el('game-trim-input').min === 1 && +el('game-trim-input').max === 6 && +el('game-trim-input').value === n0 && label('game-trim-input') === `${n0} / 6`,
   `a round shows one slider: Deck size, from 1 to all 6 (now ${n0})`);
set('game-trim-input', 5, 'input');
ok(label('game-trim-input') === '5 / 6' && ev('deck.length') === n0 && /%/.test(el('game-trim-input').style.getPropertyValue('--fill')), 'dragging updates the number as you go; the deck changes when you let go');
set('game-trim-input', 5);
ok(ev('deck.length') === 5 && el('total').textContent === '5', 'letting go at 5: five cards');
set('game-trim-input', 2);
ok(ev('deck.length') === 2 && label('game-trim-input') === '2 / 6', 'and down to 2');
set('game-trim-input', 6);

// ---- Two sliders after missing some ----
for (const n of ['pain', 'maison', 'livre']) answer(n, 'faux');   // three misses (an empty answer wouldn't count)
for (const n of ['eau', 'chat', 'chien']) answer(n, ev(`deck.find(c => c.noun === ${JSON.stringify(n)}).italian`));
ev('index = deck.length; render();');
el('practise-missed').click();
const missedKeys = ev('sessionMaxDeck.map(c => c.key)');
ok(!el('game-trim-input') && +el('game-trim-focus').value === 3 && +el('game-trim-focus').max === 3 && +el('game-trim-rest').value === 0 && +el('game-trim-rest').max === 3,
   'after missing 3: two sliders — Missed 3 of 3, The rest 0 of 3');
set('game-trim-rest', 2);
ok(ev('deck.length') === 5 && ev(`deck.slice(0, 3).every(c => ${JSON.stringify(missedKeys)}.includes(c.key))`) && ev(`deck.slice(3).every(c => !${JSON.stringify(missedKeys)}.includes(c.key))`),
   'adding 2 of the rest: the missed 3 stay first, then 2 others');
set('game-trim-focus', 1);
ok(ev('deck.length') === 3 && ev(`deck.filter(c => ${JSON.stringify(missedKeys)}.includes(c.key)).length`) === 1 && +el('game-trim-rest').value === 2, 'down to 1 missed: the others are untouched');
set('game-trim-rest', 0);
set('game-trim-focus', 0);
ok(ev('deck.length') === 1 && +el('game-trim-focus').value === 1, 'both at 0 would empty the deck, so one card stays');
set('game-trim-focus', 3); set('game-trim-rest', 3);
answer(ev('deck[0].noun'), ev('deck[0].italian'));
const playedMissed = ev(`deck.slice(0, index).filter(c => ${JSON.stringify(missedKeys)}.includes(c.key)).length`);
ok(+el('game-trim-focus').min === playedMissed && +el('game-trim-rest').min === ev('index') - playedMissed, "a slider can't go below the cards already played from its group");

// ---- The game's keys ----
const before = ev('index');
el('game-trim-rest').focus();
el('game-trim-rest').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
ok(ev('index') === before, "keys pressed on a slider don't move the game on");
done();
