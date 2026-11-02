# La Pioche

French flashcards in a single HTML file — nouns for now, with progress tracking, history notes, spaced review and listening practice. *La pioche* is the pile you draw from in a card game.

La Pioche is the French twin of [Il Mazzo](https://github.com/Nassim55/il-mazzo), the Italian game it was copied from in November 2026; the two now grow separately. It lives at https://nassim55.github.io/la-pioche/.

## Sections

| Section | Items | What you practise |
|---|---|---|
| Noms | 400 nouns | the noun with its definite article (*le pain, la maison, l'eau, le héros, les gens*), in 17 themes |

More sections will follow one at a time, each built for French: verbs, adjectives, everyday phrases, sentences.

Every card works in three directions — English → French, French → English, and Listening (hear the French, type it) — and each direction keeps its own progress.

## Features

**Checking French.** Capitals don't matter, and an apostrophe can be straight, curly or a space (*l'eau, l’eau, l eau*). The article does matter, and so does its elision: *maison* alone is wrong, and so is *la eau*. A missing accent is forgiven but never hidden — *la foret* counts, and the answer comes back as *la forêt* with the ê highlighted — while a wrong or extra accent is a mistake (*la forèt*). The cedilla and hyphens work the same way (*garcon*, *grand mere*), *oe* for *œ* is always fine (*le coeur*), and a few nouns accept another correct spelling (*la clef*, *le petit déjeuner*).

**The gender behind *l'* and *les*.** *L'eau* and *les gens* don't show their gender, so the answer does: *l'eau (f.)*, *les gens (m.)*.

**Why the article is wrong.** A wrong article gets its reason: *eau* starts with a vowel, so *le* or *la* becomes *l'*; the h of *héros* is aspirated, so there's no elision; *gens* is plural; *maison* is feminine.

**En balade — out and about, listen only.** Under *Start practising*, *🎧 En balade* plays the same cards with nothing to type or say: each one is read aloud, the French and then the English, five times over (*Répétitions* changes the number; *Lent* slows the French), then the next card — and at the end of the deck it goes round again, reshuffled, for as long as it's left on. The English is read without its brackets. *Verrouiller l'écran* covers the screen against pocket taps.

**The grid shows your record.** In the pick grid, each noun's tile is shaded by how often you get it wrong in the current direction — olive for right, through gold, to terracotta — and more strongly the more you've tried it.

**Parle — say it, don't just type it.** Wherever the answer is French (English → French, and Listening, where repeating what you hear is shadowing), the microphone in the answer box (or ⇧ Enter) listens in French. A right guess counts like a typed answer; anything else stays in the box to fix. If the browser is listening in English, it says how to switch it.

**Nothing typed is never wrong; *Passer* is.** An empty Enter just asks for an answer. *Passer* shows the answer and counts as a miss.

**Typing it right after a miss.** After a wrong answer the box clears and the button reads *Réécris →*: the right answer has to be typed (checked as leniently as the answer itself) before the next card. It's practice: it changes neither the score nor the history.

- **Révision du jour** — spaced repetition: every noun you practise is scheduled, and the daily review brings back exactly what's due (see below)
- Themes, quick picks (Random, Weakest), hand-picking, and "the most common" by frequency
- Deck size and Focus, to grow or narrow a round while playing
- History notes — where a word comes from, its English cousins, false friends and gender traps — plus your own word associations
- Practise the cards you missed, as a filter on the round you just played
- Spoken French in the device's own voices, France's first
- Back up and restore all progress to a file

## Révision du jour

Every noun you answer gets a review date, separately for each direction. A correct answer moves it up a box and pushes it further out — 1, 2, 4, 8, 16, 32, then 64 days; a wrong answer brings it back tomorrow. The strip at the top of the setup screen shows what's due today in the chosen direction. **Start** plays it as one round (up to 30 cards at first; Deck size reaches the rest).

## Syncing across devices

**Not switched on yet.** La Pioche will sync through a small API of its own — a Cloudflare Worker with a D1 database, as Il Mazzo does, but a separate one, so the two games' progress never mixes. Until it's deployed the app makes no requests and shows no sign-in: progress stays on each device, and each device's progress merges in at its first sign-in later (for a word practised on two devices, the larger count is kept).

**To switch it on:**

1. In Cloudflare, create a D1 database called `la-pioche` (Storage & databases → D1, or `npx wrangler d1 create la-pioche`) and copy its ID.
2. In this repository's Settings → Secrets and variables → Actions, add the secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ALLOWED_EMAILS` (the same values as Il Mazzo's), and the variables `D1_DATABASE_ID` (the new database's ID) and `GOOGLE_CLIENT_ID`. Il Mazzo's Google client should work as it is, since both games are on `https://nassim55.github.io`; check its authorised JavaScript origins in the Google Cloud console.
3. Push to `main`: the `deploy-sync` job applies the migrations and deploys the Worker as `la-pioche-sync` (on the account's `workers.dev` subdomain — don't rename that subdomain, as Il Mazzo's sync depends on it).
4. Then ask for sync to be switched on: `SYNC_URL` in `index.html` gets the Worker's address, and the `sync-off` test changes with it.

After that it works as in Il Mazzo: sign in with Google once on each device, and syncing happens by itself, with nothing to see.

## Your progress

Progress, associations and voice settings are saved in the browser's local storage — never in this repository. Each browser keeps its own copy, and so does each address the page is opened from. La Pioche and Il Mazzo are on the same site, `nassim55.github.io`, so they share that storage: every one of La Pioche's keys starts with `pioche-`, and neither game ever touches the other's progress. A backup is a file of your own; restoring checks that it's a La Pioche backup.

## Using it

- **Locally:** clone or download the repository and open `index.html` in a browser.
- **Online:** in the repository's Settings → Pages, set **Source** to **GitHub Actions**. The workflow then publishes `main` after every successful test run.
- **Spoken French** needs a French voice on the device. On a Mac: System Settings → Accessibility → Spoken Content → ⓘ next to System voice → Français, then download an Enhanced or Premium voice from France. A voice from France is chosen before a Canadian one.

## Development

Everything — markup, styles, data and code — lives in `index.html`. The tests load it in [jsdom](https://github.com/jsdom/jsdom) and play it the way a person would: picking nouns, answering, skipping, reloading.

```sh
npm install
npm test                    # every suite, one line each
npm test -- audio nouns     # only suites whose name contains "audio" or "nouns"
node tests/audio.test.js    # one suite, listing every check
```

Node 20 or later is required.

### Continuous integration and publishing

`.github/workflows/tests.yml` runs the full suite on every push, on any branch:

- **A push to `main`** is tested, then published to GitHub Pages.
- **A push to a `claude/…` branch** (Claude Code on the web works on these) is tested; if everything passes, it's merged into `main` automatically and published.
- **Anything that fails** stays where it is — a red cross on the commit, and the live site untouched.

### What the tests cover

- **The nouns:** `nouns-core` (the data: 400 nouns, no duplicates, every article right for its gender and first letter, aspirated h, plurals, the ranking, notes and associations), `nouns-features` (the screens: labels, the gender behind *l'* and *les*, why an article is wrong, accents forgiven and shown), `checking` (every rule for checking French).
- **Storage:** `storage-keys` — every key starts with `pioche-`, and Il Mazzo's keys on the same site are never read or changed; `backup-restore`.
- **Sync:** `sync-off` (nothing at all while there's no server), `sync-merge` (what syncs, the merge rules, epochs, two devices through a stand-in), `sync-client` (signing in with Google and recording, against the real Worker code), `sync-worker` (the API).
- **Shared features:** `ripasso` (Révision du jour, with the clock under test control), `audio`, `passive` (En balade), `parla` (Parle), `practise-missed`, `retype`, `shading`, `deck-sliders`.

## Project layout

```
index.html                   the whole app
worker/                      the sync API (Cloudflare Worker + D1 migrations)
CLAUDE.md                    project rules and landmarks for Claude Code
tests/
  run-all.js                 runs every suite; exits non-zero if any fails
  harness.js                 loads index.html in jsdom, plus small helpers
  *.test.js                  the suites
.github/workflows/tests.yml  continuous integration
```

## Data

The deck's frequency ranking comes from [wordfreq](https://github.com/rspeer/wordfreq)'s French data (itself a blend of Wikipedia, subtitles, news, books and the web), weighted by how often each form is really a noun in the French [Universal Dependencies](https://universaldependencies.org/) treebanks — GSD, Sequoia, ParTUT, PUD and FQB for written French, Rhapsodie and ParisStories for spoken — so that *été* (summer, but also "been") or *pas* (step, but also "not") don't rank higher than they should. Hyphenated nouns, which wordfreq splits in two, are scored from the OpenSubtitles 2018 counts in [FrequencyWords](https://github.com/hermitdave/FrequencyWords), scaled to match. The first 300 nouns are the most common; the other 100 are everyday nouns from Il Mazzo's concrete themes. The notes beside each data block in `index.html` give the details.
