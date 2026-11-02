// The pick grid, shaded by your record: each tile's colour comes from its error rate in the
// current direction — olive (rarely wrong) through gold to terracotta (wrong half the time
// or more) — faint while it has had few tries; untried tiles stay plain.
const { boot, ok, done } = require('./harness');

const rgb = c => (c.match(/\d+/g) || []).map(Number);
const redness = c => { const [r, g, b] = rgb(c); return r - g; };                  // terracotta: high; olive: negative
const strength = c => { const [r, g, b] = rgb(c); return Math.abs(251 - r) + Math.abs(246 - g) + Math.abs(234 - b); };   // distance from the paper
const tile = (d, k) => d.querySelector(`.verb-chip[data-noun="${k}"]`);
const shade = (d, k) => tile(d, k).style.getPropertyValue('--shade');

// ---- Nothing practised: plain tiles, no key ----
let B = boot({ 'pioche-subject': 'nouns' });
ok(!B.d.querySelector('.verb-chip.shaded') && !B.d.getElementById('shade-key'), 'nothing practised yet: every tile plain, and no key');
ok(tile(B.d, 'maison').title === 'Not practised yet (English → French)', 'hovering an untried tile says so');

// ---- A record: the colour follows the error rate ----
const nounStats = { maison: { seen: 10, wrong: 0 }, eau: { seen: 8, wrong: 2 }, pain: { seen: 10, wrong: 5 }, temps: { seen: 6, wrong: 6 }, livre: { seen: 1, wrong: 1 } };
B = boot({ 'pioche-subject': 'nouns', 'pioche-noms-stats-v1': JSON.stringify(nounStats) });
const { d } = B;
ok(['maison', 'eau', 'pain', 'temps', 'livre'].every(k => tile(d, k).classList.contains('shaded') && shade(d, k).startsWith('rgb(')) && !tile(d, 'homme').classList.contains('shaded'),
   'practised tiles are shaded; untried ones stay plain');
ok(redness(shade(d, 'maison')) < redness(shade(d, 'eau')) && redness(shade(d, 'eau')) < redness(shade(d, 'pain')),
   'from olive (never wrong) through gold (wrong a quarter of the time) to terracotta (half the time)');
ok(shade(d, 'pain') === shade(d, 'temps'), 'wrong half the time or more: the full terracotta — the bad end saturates');
ok(strength(shade(d, 'livre')) < strength(shade(d, 'temps')) && redness(shade(d, 'livre')) > 0,
   'one try, one slip: a faint terracotta, well short of a word missed every time in six tries');
ok(strength(shade(d, 'maison')) < strength(shade(d, 'pain')), 'the bad end stands out more than the good');
ok(tile(d, 'pain').title === 'Wrong 5 of 10 times — 50% (English → French)' && tile(d, 'livre').title === 'Wrong 1 of 1 time — 100% (English → French)',
   'hovering gives the numbers, and the direction they belong to');
const key = d.getElementById('shade-key');
ok(key && /rarely wrong/.test(key.textContent) && /often wrong/.test(key.textContent) && /fainter: only a few tries/.test(key.textContent)
   && /plain: not tried yet/.test(key.textContent) && /English → French/.test(key.textContent) && /linear-gradient/.test(key.querySelector('.shade-key-bar').getAttribute('style')),
   'a key above the grid: the scale, what fainter and plain mean, and the direction');

// ---- Left-out tiles keep their shade ----
B.ev("selectedNouns = new Set(['maison']); showSetup();");
ok(tile(d, 'pain').classList.contains('unselected') && tile(d, 'pain').classList.contains('shaded') && shade(d, 'pain') !== '',
   'a tile left out keeps its shade (its dashed border and fading say it\'s out)');

// ---- The direction's own record ----
B = boot({ 'pioche-subject': 'nouns', 'pioche-noms-stats-v1': JSON.stringify(nounStats), 'pioche-noms-stats-fren-v1': JSON.stringify({ maison: { seen: 4, wrong: 4 } }) });
B.ev("direction = 'it-en'; stats = loadStats(); showSetup();");
ok(redness(shade(B.d, 'maison')) > 0 && !tile(B.d, 'pain').classList.contains('shaded') && /French → English/.test(B.d.getElementById('shade-key').textContent)
   && tile(B.d, 'maison').title === 'Wrong 4 of 4 times — 100% (French → English)', 'switch to French → English and the grid shows that record instead');

done();
