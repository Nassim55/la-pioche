# La Pioche — guide for Claude Code

French flashcards for one learner (Nassim), in a single HTML file served by GitHub Pages at https://nassim55.github.io/la-pioche/. Read `README.md` for what the app does.

La Pioche began in November 2026 as a copy of Il Mazzo, its Italian twin (https://github.com/Nassim55/il-mazzo), taken at commit `8d2ff68`. The two games now evolve independently: a feature added to one is not ported to the other unless Nassim asks. Il Mazzo stays the reference for how a section should look and behave, and its code — and this repository's history from before the copy — is where to look before rebuilding a section for French.

## Workflow for every change

1. Make the change in `index.html` (markup, CSS, data and code all live there).
2. Add or update tests in `tests/` for any new behaviour.
3. Run `npm test` — **every suite must pass** before committing. Run one suite with `node tests/<name>.test.js` to see each check.
4. Commit with a descriptive message and push:
   - **On a laptop** (Claude Code desktop or terminal): push to `main`. GitHub Actions re-tests it and publishes the site.
   - **In Claude Code on the web**: push your `claude/…` branch as usual. GitHub Actions tests it and, if every suite passes, merges it into `main` and publishes. If a test fails, the branch is not merged — fix it and push again.
   The live site updates a minute or two after `main` passes.

If a suite fails, fix the cause; never weaken a test to make it pass unless the behaviour change was requested (then update the test and say why in the commit).

**From a chat** (no push access): fetch the repository from GitHub first and build on its latest commit. Run every suite (a command stops after five minutes, so run them in parts or in parallel, with the output saved to a file). Hand over a zip of only the files that differ from GitHub, after applying it to a fresh clone and re-running every suite there; list any deleted files for `git rm`. Commands start with `git pull` and run in `~/Documents/la-pioche`.

## Rules that protect the user's data

- **Never rename saved-data keys.** Progress lives in each browser's localStorage, and every key starts with `pioche-`: the site shares `nassim55.github.io` — and so its localStorage — with Il Mazzo, whose keys (`sostantivi-stats-v1`, `mazzo-audio-v1`, `flipcards-subject`…) must never be read or written from here. The `storage-keys` suite checks both. The keys: `pioche-noms-stats-v1`, `pioche-noms-stats-fren-v1` (French → English), `pioche-noms-stats-listen-v1`, each with a `:srs` review schedule; `pioche-noms-assoc-v1`; and the device's own settings, `pioche-subject`, `pioche-revision-dir`, `pioche-audio-v1`, `pioche-passive-v1`.
- New saved data goes in new `pioche-` keys, and must be added to `storageKeys()` so backups include it. New *progress* data must also be added to `syncedKeys()` with a merge rule (and a test in `sync-merge`).
- `pioche-sync-meta-v1` and `pioche-sync-base-v1` are per-device sync bookkeeping: never in backups, never synced.
- A backup file says `"app": "la-pioche"`; restore refuses anything else, Il Mazzo's backups included. Keep it that way.

## Behaviour conventions

- No regressions: existing features keep working exactly as before unless the user asks otherwise.
- British English in UI text and notes ("practise" as the verb, "colour"); explanations in plain English, labels and buttons in French (*Vérifier, Passer, Suivant, Réécris, Révision du jour, En balade, Parle*). French text uses French typography: « guillemets », and a non-breaking space before `! ? : ;` (`\u00a0` in code).
- Answers stay lenient where it doesn't matter (capitals; an apostrophe straight, curly or a space) and strict where it does (the article, and its elision).
- **Accents (Nassim's choice, Nov 2026):** a missing accent is forgiven but flagged — the answer is shown with the left-out letter highlighted and named; a wrong or extra accent is wrong (*la foret* passes for *la forêt*, *la forèt* doesn't). The cedilla and hyphens follow the same rule (*garcon*, *grand mere* and *grandmere* pass); *oe* for *œ* always passes, unflagged. A card's `alts` are other correct spellings (*la clef*); the one needing fewest allowances wins. This is `checkAnswer` / `frMatch`, tested in `checking`.
- History notes: accurate etymology, English cognates, false friends, gender traps and the circumflex for a lost s; say "probably" or "disputed" where an origin is disputed. A note where it helps — not on every noun.
- Present tense only, in any verb or sentence work to come, until Nassim says otherwise.
- Frequency rankings, as in Il Mazzo: a noun's score is wordfreq's French frequency of its singular plus its plural, each form weighted by its share of noun tags in the French UD treebanks (GSD, Sequoia, ParTUT, PUD, FQB; Rhapsodie and ParisStories, spoken); a form seen fewer than 10 times counts fully. wordfreq splits hyphenated words, so those are scored from OpenSubtitles 2018 counts scaled to wordfreq. The method notes sit beside the data.
- Layout must work from desktop down to 320px phones with no sideways scroll.

## Nouns (*Noms*)

- `NOUN_ITEMS`: `{ en, it, noun, g, pl, aspH?, alts?, note? }`, listed most common first. **The field `it` holds the French**: it keeps Il Mazzo's name on purpose (the low-risk path for phase 1), as do the other internal names — `card.italian`, the directions `'en-it'` and `'it-en'`, `ripassoDir`. Renaming them is a job of its own, done in one step with the tests.
- The English is unique across the deck, with a qualifier in brackets where needed (*the time (occasion)*); *En balade* reads it without the brackets.
- Articles: *le* or *la* by gender; *l'* before a vowel or a mute h; the full article before an aspirated h (`aspH: true` — *le héros, la hache, le haricot, le hasard, la honte, le hibou, le haut*); *les* for a plural-only noun (*les gens, les vacances, les lunettes*, with the gender in `g`). `validateSubjects` checks every article against its gender and first letter, as well as themes, ranks and plurals; the tests fail on any warning.
- Plurals are spelled out in `pl` — never guessed — or `null` where there's no everyday plural (*l'argent*).
- *L'* and *les* hide the gender, so every answer to such a card shows it: *l'eau (f.)* (`genderTagHTML`). A wrong article is explained: the elision before a vowel or a mute h, none before an aspirated h, the plural, or the gender (`articleRuleHTML`).
- Nouns with one form for both sexes (*l'enfant, le ministre, l'artiste*) get the masculine card and a note, as in Il Mazzo.
- The first deck (Nov 2026): the 300 most common nouns — leaving out letters and abbreviations, months (they take no article), words met mostly inside set phrases (*d'abord, à travers*), labels like *le chef-lieu* and some office vocabulary — then 100 everyday nouns from Il Mazzo's concrete themes (days, seasons, people, body, home, food, nature, animals, clothes, transport, places, objects). New nouns go in their themes and in `NOUN_FREQUENCY_ORDER`, by the same score.

## Sections still to come

One phase at a time, each built as a French section rather than a translation of Il Mazzo's: verbs (the *-er* verbs first), irregular verbs, adjectives (with the BANGS adjectives that go before the noun), phrases (with *tu* and *vous* kept distinct), sentences, dialogues, a story. A new section is a new entry in `SUBJECTS`, with `pioche-` keys; the section switcher appears by itself once there are two.

## Sync

- The app does all merging (`syncMergeAll` and the per-kind rules); the Worker in `worker/` only stores copies and enforces the version check. Keep it that way — the merge rules are tested in jsdom with the rest of the app.
- La Pioche has its own Worker (`la-pioche-sync`) and D1 database (`la-pioche`), never Il Mazzo's: both games sign in with the same Google account, so sharing the server would put both games' progress in one space.
- **Until that Worker is deployed, `SYNC_URL` is empty and nothing syncs** — no requests, no sign-in screen (the `sync-off` suite checks). The tests reach a stand-in server through `window.PIOCHE_SYNC_URL`. To switch sync on: deploy the Worker (README, *Syncing across devices*), set `SYNC_URL` to its address, and update `sync-off`.
- There is no old built-in key: the French game started with sign-in, so Il Mazzo's changeover code is gone from the app and the Worker.
- The Worker's API and `worker/migrations/` change together with `tests/sync-worker.test.js`. Never edit an applied migration; add a new numbered one.
- Deployment is the `deploy-sync` job; it needs the Cloudflare secrets, `ALLOWED_EMAILS`, and the `D1_DATABASE_ID` and `GOOGLE_CLIENT_ID` variables, and skips quietly without them. Its allowed browser origins are in `worker/src/index.js`. Never rename the Cloudflare account's `workers.dev` subdomain: Il Mazzo's live `SYNC_URL` depends on it.
- Sign-in is Google only: the app gets an ID token from Google Identity Services and swaps it at `POST /v1/session` for a year-long session; the Worker verifies the token (signature against Google's keys, `aud`, issuer, expiry, a verified email on `ALLOWED_EMAILS`).
- Syncing is invisible by the user's choice: no status line, panel, settings or wording about it in the UI (the `sync-client` tests check). Any new code that saves progress must call `syncTouched()` after writing. Syncing never runs while `container.dataset.view === 'game'`.
- `tests/d1-fixture.js` is the shared D1 stand-in (Node's built-in SQLite with the real migrations).

## Code landmarks (search for these in `index.html`)

- `SUBJECTS` — the sections (one so far, `nouns`: items, themes, frequency order, stats and association keys).
- `NOUN_ITEMS`, `NOUN_FREQUENCY_ORDER`, `NOUN_THEMES`, `validateSubjects` — the data and its start-up checks.
- `cardsForItem`, `render`, `handleSubmit`; `checkCard` → `checkAnswer` (French) or `checkEnglish`.
- `prepFr`, `frMatch`, `FOLD` — the accent rule; `answerHTML`, `accentNoteHTML`, `genderTagHTML`, `articleRuleHTML` — the French feedback.
- `refreshDeckSliders`, `handleGameResize`, `resizeDeckParts` — the in-round deck size; `startGame`, `sessionPool` / `sessionMaxDeck` — sessions, Focus and "practise the ones I missed".
- `srsAnswer`, `dueList`, `startRipasso`, `setCardContext` — spaced repetition and *Révision du jour* (the code keeps Il Mazzo's *Ripasso* names).
- `speak`, `chosenVoice`, `voiceScore` (France's voices first, then other French, then Canada's), `renderAudioRow` — spoken French; `startPassive`, `passiveStep`, `spokenEnglish` — *En balade*.
- `startListening`, `heard`, `soundsEnglish` (with `FRENCH_TELLS`, the deck's French words minus those English shares) — *Parle*.
- `buildBackup`, `restoreFromText`, `storageKeys`; `syncedKeys`, `syncNow`, `SYNC_URL` — backups and sync.
