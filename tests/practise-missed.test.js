const { boot, ok, done } = require('./harness');
const { w, d, ev, key, errors, warns } = boot();
const answer = (sel, raw) => { ev(`index = deck.findIndex(${sel}); render();`); d.getElementById('answer').value = raw; d.getElementById('submit').click(); };
const finish = () => ev('index = deck.length; render();');
const missedShown = () => [...d.querySelectorAll('.missed-item')].map(e => e.textContent);
const btn = () => d.getElementById('practise-missed');
const slider = id => { const el = d.getElementById(id); return el && { value: +el.value, min: +el.min, max: +el.max, name: el.closest('.trim-slider').querySelector('.trim-name').textContent }; };
const setSlider = (id, v) => { const el = d.getElementById(id); el.value = String(v); el.dispatchEvent(new w.Event('change')); };
ok(warns.length === 0 && errors.length === 0, 'loads cleanly');
// ---- Nouns: 2 wrong, 2 right ----
ev("selectedNouns = new Set(['pain', 'maison', 'livre', 'eau']); updateReadout();");
d.getElementById('start-btn').click();
answer("c => c.noun === 'pain'", 'la pain');
answer("c => c.noun === 'maison'", 'il maison');
answer("c => c.noun === 'livre'", 'le livre');
answer("c => c.noun === 'eau'", "l'eau");
finish();
ok(btn() && btn().textContent === '↻ Practise the 2 I missed', `button: "${btn() && btn().textContent}"`);
ok(JSON.stringify(missedShown().sort()) === JSON.stringify(['la maison', 'le pain']), `missed list: ${missedShown().join(', ')}`);
const actions = [...d.querySelectorAll('.complete-actions button')].map(b => `${b.id}:${b.className}`);
ok(d.getElementById('play-again').textContent === '↻ Play all 4 again' && actions[0] === 'play-again:submit' && actions[1] === 'practise-missed:submit secondary',
   'Play all 4 again is the main button, first; Practise the ones I missed sits beside it, outlined');
btn().click();
ok(ev('container.dataset.view') === 'game' && JSON.stringify(ev('deck.map(c => c.noun).sort()')) === JSON.stringify(['maison', 'pain']) && d.getElementById('total').textContent === '2', 'review round: the 2 missed cards in play');
ok(ev('sessionPool.length') === 4, 'the pool is still the full original set of 4 (a filter, not a new deck)');
ok(!d.getElementById('game-trim-input') && slider('game-trim-focus').name === 'Missed' && slider('game-trim-focus').value === 2 && slider('game-trim-focus').max === 2
   && slider('game-trim-rest').name === 'The rest' && slider('game-trim-rest').value === 0 && slider('game-trim-rest').max === 2, 'Deck size becomes two sliders: Missed 2 of 2, and The rest 0 of 2');
d.getElementById('game-focus-btn').click();
ok(d.getElementById('focus-total').textContent === '4' && JSON.stringify(ev('[...focusChecked].sort()')) === JSON.stringify(['maison', 'pain']), 'Focus lists all 4, with only the missed 2 ticked');
d.getElementById('focus-cancel') ? d.getElementById('focus-cancel').click() : ev('closeFocusModal()');
answer("c => c.noun === 'pain'", 'le pain');
answer("c => c.noun === 'maison'", 'la caza');
finish();
ok(btn() && btn().textContent === '↻ Practise the one I missed' && missedShown().join() === 'la maison' && /Fin de la révision/i.test(d.querySelector('.badge').textContent), 'still missed one → "Practise the one I missed" (la maison)');
btn().click();
ok(ev('sessionPool.length') === 4 && ev('deck.length') === 1, 'a review of a review still filters the original 4');
answer("c => c.noun === 'maison'", 'la maison');
finish();
ok(!btn() && /Sans faute/.test(d.querySelector('.msg').textContent) && d.getElementById('play-again').className === 'submit', 'all fixed → "Sans faute !", no practise button');
d.getElementById('play-again').click();
ok(JSON.stringify(ev('deck.map(c => c.noun)')) === JSON.stringify(['maison']), 'Play again inside a review replays just the review cards');
d.getElementById('change-btn').click();
d.getElementById('start-btn').click();
ok(ev('deck.length') === 4 && !ev('sessionIsReview'), 'back to setup → a fresh round of all 4, not a review');
// ---- "I was right" takes a card out ----
d.querySelector('.direction-toggle [data-dir="it-en"]').click();
answer("c => c.noun === 'pain'", 'loaf');
d.getElementById('override-btn').click();
answer("c => c.noun === 'maison'", 'car');
finish();
ok(missedShown().join() === 'la maison', `an "I was right" override is not counted as missed (${missedShown().join(', ')})`);
d.querySelector('.direction-toggle') ; d.getElementById('back-to-setup').click();
ok(errors.length === 0, `no runtime errors ${errors.join('; ')}`);
// ---- Enter on the summary plays the round again, like its main button ----
{
  const E = boot({ 'pioche-subject': 'nouns' });
  E.ev("selectedNouns = new Set(NOUN_ITEMS.slice(0, 2).map(n => n.noun)); updateReadout();");
  E.d.getElementById('start-btn').click();
  for (let k = 0, n = E.ev('deck.length'); k < n; k++) {
    E.d.getElementById('answer').value = k === 0 ? 'faux' : E.ev('deck[index].italian'); E.d.getElementById('submit').click();
    if (k === 0) E.d.getElementById('answer').value = E.ev('deck[index].italian');
    E.d.getElementById('submit').click();
  }
  const onSummary = !!E.d.querySelector('.complete') && !!E.d.getElementById('practise-missed');
  E.d.dispatchEvent(new E.d.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  ok(onSummary && !E.d.querySelector('.complete') && E.ev('index') === 0 && E.ev('deck.length') === 2, 'Enter on the summary plays all of the round again, like its main button');
}
done();
