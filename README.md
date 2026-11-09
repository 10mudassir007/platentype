# Platen

A typing game disguised as a keyboard test. A fully white vector fighter stands
at the end of the strike line: every correct key throws a jab, and every finished
word launches a different full-body strike — kick, cross, slap, hook, uppercut or
elbow. Text streams in from the right and is literally consumed into the fighter
as you type.

Platen is a modern MonkeyType alternative with five drill modes, a full test-rules
and display settings surface, custom text rules, a command line, and twelve paired
themes — each one shipping a dark and a light variant. All text is static, local
data — no LLM, no network calls, no API keys.

Platen also includes a live duel arena over same-origin WebSockets, a score
system, easy/medium/hard difficulty, 15/30/60/90 second sprints, detailed WPM/WPS
statistics, a shared leaderboard, and optional OAuth2 sign-in. LAN players connect
to the host's address on the same port — no second port is needed.

Not affiliated with MonkeyType. Built as a standalone Next.js app.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and start typing.

## Modes

| Mode | What it does | Variants |
| --- | --- | --- |
| **time** | Fixed-duration sprint. The clock starts on the first keystroke. | 15s · 30s · 60s · 90s |
| **words** | Finish a fixed number of words, then the run ends. | 10 · 25 · 50 · 100 |
| **quote** | A real quote with its author credited. Ends after the last word. | short · medium · long · all |
| **zen** | Endless drill. Keep typing until you press <kbd>Enter</kbd>. | endless |
| **custom** | Paste or write your own text. Order, limit, delimiter and cleanup are yours to set. | words · time · sections |

The mode bar sits under the top bar. Mode, variant and options are saved to
`localStorage`, so a reload returns you to the same drill.

## Text options

**Punctuation** (on by default) keeps the natural punctuation of the corpus.
When it is off, only the punctuation clinging to the start or end of a word is
removed — internal apostrophes and hyphens stay, so real words do not change.

**Numbers** replaces roughly one in nine words with a numeric drill token of one
to three digits. Edge punctuation is preserved and two numeric tokens never sit
next to each other. Both options apply to **time**, **words** and **zen** only;
quote and custom text are always used exactly as written.

## Custom text rules

Custom mode has its own **rules** button in the mode bar (and `text rules` in the
command line). The dialog stages every change; **use rules** applies them and
starts a fresh drill, while <kbd>Esc</kbd> or **cancel** leaves the current one
alone. Defaults are `repeat`, a one-section limit, space delimiter, zero-width
removal on and newline flattening on.

| Rule | Options | Behaviour |
| --- | --- | --- |
| Mode | repeat · shuffle · random | Repeat keeps source order and cycles it. Shuffle reshuffles each cycle. Random samples words from the pool, so repeats are possible. |
| Limit | words · time · sections | Words and sections end after the last generated word; time ends on the clock. Word presets are 10/25/50/100, time presets 15/30/60/90s, section presets 1/2/3/5. |
| Sections | line breaks | A section is one non-empty line. If the limit asks for more sections than the text has, the selected order cycles the source until the count is filled. Flatten new lines to make the whole text one section. |
| Word delimiter | space · pipe <code>&#124;</code> | Space splits on any whitespace. Pipe makes <code>&#124;</code> the only split, so <code>one&#124;two three</code> becomes **one** and then **two three** as one group. The inner space is rendered and typed as a real space. |
| Remove zero-width | on / off | Strips invisible spaces, joiners, directional marks and the BOM that cause unexplainable typos. |
| Remove fancy typography | on / off | Turns curly quotes into straight quotes, fancy dashes into hyphens, the ellipsis into three dots, and unusual spaces into plain spaces. |
| Replace control characters | on / off | Turns literal `\n` and `\t` in the pasted text into real line breaks and tabs. |
| Replace new lines with spaces | on / off | Flattens every line into one stream. With **add periods** on, each line gets a period first unless it already ends with punctuation. Add periods is disabled while flattening is off. |

Cleanup always runs before splitting, in this order: zero-width characters →
fancy typography → literal control escapes → newline flattening. Custom words
stay verbatim; the punctuation and numbers options never rewrite them.

## Command line

Press <kbd>Esc</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> to open the
command line. Type to filter, move with <kbd>↑</kbd>/<kbd>↓</kbd>, run with
<kbd>Enter</kbd>, close with <kbd>Esc</kbd>. Commands cover every mode and
variant, punctuation and numbers, text rules and cleanup, all 24 themes,
sound, restart, text editing, and finishing the current run.

## Settings

Open **settings** from the gear in the top bar, or run `settings` in the command
line. The dialog has twelve sections:

| Section | Options |
| --- | --- |
| **test rules** | difficulty (easy · medium · hard), minimum speed, minimum accuracy, minimum word burst, stop on error, delete on error, confidence mode (off · on · max), freedom mode, strict space, opposite shift, quick end, blind mode |
| **navigation** | quick restart (tab · esc · enter · off), repeat quotes, always show words history, single-list command line |
| **language and input** | language (english · british), funbox (none · mirror · reverse · caps), lazy mode, layout emulation (qwerty · dvorak · colemak), code unindent on backspace, composition display |
| **error display** | indicate typos (off · below · replace), hide extra letters |
| **sound** | volume, click sound, error sound, time warning sound |
| **carets** | smooth caret, caret style (line · block · underline · off), pace caret (off · average · best), repeated pace, pace caret style |
| **live stats** | live style (text · bars), live colour, live opacity |
| **text display** | highlight mode (off · word · letter), typed effect (off · fade · pop), tape mode, tape margin, smooth line scroll, show all lines, max line width, font size, font family (JetBrains Mono · Berkeley Mono · system mono), use local font, keymap mode, flip test colours, colourful mode |
| **results** | always show decimal places, typing speed unit (wpm · cpm · wps · cps), start graphs at zero, show average of last 10 |
| **appearance** | custom background colour or gradient, random theme |
| **misc** | key tips, out of focus warning, caps lock warning, ad slot, cookie preferences |

Changes preview inside the dialog only. **use settings** (or
<kbd>Ctrl</kbd>+<kbd>Enter</kbd>) applies them and starts a fresh drill;
**cancel** or <kbd>Esc</kbd> discards the draft. **reset** restores every default
and clears stored bests and history. **export** copies the current settings as
JSON; **import** accepts an exported object and sanitizes it before applying.

Rules behave as follows:

- **difficulty** — easy never fails; medium fails on a submitted wrong word; hard
  fails synchronously on any wrong key.
- **minimums** — speed, accuracy and word burst are checked during the run; the
  first sample that drops below a non-zero threshold ends the run as failed.
- **stop on error** — further input is blocked until the wrong prefix is fixed.
- **delete on error** — a wrong key never enters the word.
- **confidence** — `on` blocks reopening earlier words; `max` disables backspace.
- **freedom** — backspace can reopen and delete correct words.
- **strict space** — a leading space is typed as a character instead of ignored.
- **opposite shift** — an uppercase letter must use the shift key on the other
  hand.
- **quick end** — the final word ends the run even when it is wrong. Without it,
  a wrong final word in words/custom pulls more text in.
- **blind mode** — hides error colours, typo hints and the red veil.

Speed is stored as WPM. The selected unit converts it for the live HUD, score,
raw and best lines. The custom background accepts colours and gradients only;
`url(`, `javascript:` and `expression(` are rejected, and a blank value returns
to the selected theme.

## Score

Every finished run produces a score:

```
score = (correctChars × 2 + correctWords × 12 + wpm × 3) × (accuracy / 100) × difficultyMultiplier
```

Difficulty multipliers: **easy 1.0**, **medium 1.2**, **hard 1.5**. Hard mode is
worth more because it fails on the first wrong key, so accuracy tends to be
lower. The score shows prominently in the result panel alongside WPM, and every
finished run is submitted to the leaderboard (when signed in or playing as a
guest).

## Detailed statistics

The result panel shows WPM, raw, WPS, CPM, CPS, accuracy, consistency, correct
and incorrect characters, extra and missed characters, clean and wrong words,
elapsed time, and score. The live HUD shows score, WPM, accuracy and burst. The
speed unit picker in settings (wpm · cpm · wps · cps) converts the stored WPM for
display everywhere.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>Tab</kbd> | Restart the test with a fresh drill (default quick restart) |
| <kbd>Esc</kbd> | Open the command line; while running, restarts if quick restart is `esc` |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Open the command line |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Apply the settings draft |
| <kbd>Space</kbd> | Submit the current word and fire the finisher; inside a pipe-delimited group it types the inner space |
| <kbd>Backspace</kbd> | Fix the current word; the clock keeps running |
| <kbd>Enter</kbd> | Finish a zen run / replay after a finished run |
| <kbd>N</kbd> | Replay after a finished run |

Quick restart can be bound to <kbd>Tab</kbd>, <kbd>Esc</kbd>, <kbd>Enter</kbd>, or
turned off. Opening the command line, the custom-text editor, the text-rules
dialog or settings pauses a running test; closing it resumes the same test and
clock.

## Duel arena — local network and online multiplayer

Open the **arena menu** (the crossed-swords icon in the top bar, or `duel` in the
command line) to create or join a room. Rooms share a seed and settings, so both
players type the exact same words. A mirrored opponent fighter on the left
animates in real time: their keys jab or hurt their fighter, their words throw
finishers, and their live word/typed prefix shows in the duel HUD alongside their
WPM, accuracy, progress and score.

- **Quick match** pairs you with the next player who hits quick match. The first
  player hosts, so both see the same text.
- **Create room** makes a five-character code you can share. The host starts the
  race when both players are ready.
- **Join** enters a room by code.
- **LAN** — other devices on the same network open the host's address (shown in
  the dialog) and join the same room. No second port is needed; the WebSocket
  shares the page's origin.
- **Online** — deploy the server publicly and set `PLATEN_BASE_URL` so OAuth
  callbacks resolve correctly.

A race ends when both players finish or the clock runs out. The first finisher or
highest score wins. After a duel, either player can rematch.

## Leaderboard

The leaderboard (arena menu → leaderboard) shows the best score per player per
difficulty/mode combination. Every finished run is submitted automatically when
signed in or playing as a guest. Filter by difficulty and mode; your own best row
is highlighted.

## Account, username and OAuth2 login

Playing without signing in makes you a **guest**: a session cookie remembers your
name for the browser session, and scores attach to that guest identity.

Open **account** from the arena menu to set a username. Your name travels with
your score, duel room and leaderboard row.

Optional **OAuth2** sign-in with GitHub or Google requires server credentials:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PLATEN_BASE_URL=https://your-domain.com
```

Add them to `.env` and restart the server. Without credentials, the OAuth buttons
show "not configured" and guest play works normally. Sign out from the account
dialog.

## Custom server

Platen runs on a custom Next.js server (`server.mjs`) so the WebSocket endpoint
(`/api/ws`) shares the page's origin. Start it with:

```bash
npm run dev      # development (Turbopack)
npm run start    # production
```

The server stores users, sessions and leaderboard rows in `.data/platen.json` —
no database dependency. Restarting clears in-memory duel rooms.

## How the test works

| Behaviour | Detail |
| --- | --- |
| Start | The first character starts the clock |
| Global keys | The page captures keystrokes; no input field to click |
| Extra letters | Typed past the word length, counted as errors, must be deleted |
| WPM | Net: correct characters / 5 / minutes |
| Speed unit | Stored as WPM; displayed as wpm, cpm, wps or cps |
| Raw | All characters in the final text / 5 / minutes |
| Accuracy | Keystroke-based; corrected mistakes still count |
| Consistency | 100 − coefficient of variation of per-second WPM |
| Best score | Per mode and variant, in `localStorage` under `platen:best:*` |
| History | Last ten successful runs in `platen:history`, with a ten-run average |
| Failed runs | Difficulty and minimum-rule failures are shown but never saved as a best or history entry |
| Time / zen | The static corpus appends more text if a fast typist runs out |
| Custom timed | Words keep coming from the same custom source until the clock stops |
| Custom words / sections | Ends after the final generated word; the clock shows words or sections left |

The caret is pinned to a strike line at the fighter's glove, and the line shifts
left by one letter as you type. Correct letters animate out of the stream; a
wrong letter stays at the strike line in red. The caret can be a line, block,
underline or hidden, can glide or snap, and an optional pace caret chases your
average or personal-best speed — per test or reset on every word.

## The fighter

Six finishers rotate one per completed word, starting with the kick so the
variety shows up immediately:

| Move | Motion |
| --- | --- |
| Kick | Hip loads, lead leg whips up, foot counter-rotates onto the line |
| Cross | Rear foot pivots, hips rotate, lead fist drives through |
| Slap | Glove swaps to an open palm and sweeps across the line |
| Hook | Guard wraps low, then a wide horizontal arc with torso rotation |
| Uppercut | Crouch, hip drive, fist rises through the strike line |
| Elbow | Short lunging step with the forearm folded back |

Each move uses a jointed rig (shoulder → elbow → glove, hip → knee → ankle) with
per-joint rotation, anticipation, follow-through, head lag, guard counterbalance
and motion trails. The impact sound, screen shake, sparks and smashed word wait
for the actual contact frame of the move. The face is deliberately neutral: dot
eyes and a nose, no mouth or eyebrows.

## Look and feel

- Twelve paired theme families: **slate** (teal), **ember** (amber), **forest**
  (mint), **iris** (violet), **ocean** (blue), **rose**, **sand**, **lime**,
  **coffee**, **ice**, **plum** and **mono** (graphite). Every family ships a dark
  and a light variant tuned together — surfaces, hairlines, muted copy, accent,
  buttons, errors and upcoming-word shades all clear WCAG AA against their own
  background. That is 24 themes in one picker: `theme <family> <mode>` works in
  the command line too.
- There is no separate light/dark switch. Choosing the light variant of a family
  is the light mode; the selected theme id (`slate-dark`, `rose-light`, …) is the
  only stored preference, and `THEME_INIT_SCRIPT` applies it before first paint so
  the wrong background never flashes.
- Every surface, border, button, badge and text token derives from the selected
  theme. Only the fighter stays `--fighter-white` in every theme; light themes add
  a soft drop shadow so the white body still separates from the page.
- Type split: JetBrains Mono for the word stream, Inter for UI, and tabular
  numbers for results and statistics.
- All-white SVG fighter with dark ink outlines, built from simple shapes in
  `components/Fighter.tsx`.
- Web Animations API drives every strike, anchored at real joints so limbs never
  detach. `prefers-reduced-motion` shortens the moves.
- Correct keys: additive glove jab, accent sparks, small screen shake, synth hit.
- Completed word: rotating finisher, the word flies apart, heavier shake.
- Wrong keys: hurt flinch, red veil, miss sound, accuracy hit.
- WebAudio sounds are generated at runtime (no audio files); the top-bar button
  toggles them, and volume, click, error and time-warning sounds are set in
  settings.
- The word line is measured against the resting glove at runtime, so the fist
  meets the caret on desktop, tablet and phone.
- Text display options include highlight word/letter, typed fade/pop, tape mode
  and margin, smooth line scroll, all lines, max width, font size and family,
  keymap mode, flipped colours and per-word hues.
- Live stats can be text or bars, with accent/text/muted colour and adjustable
  opacity. Results add a speed graph, ten-run average and word-by-word history in
  the chosen speed unit.

## Customize

| What | Where |
| --- | --- |
| Drill text corpus | `data/passages.json` (plain strings, one paragraph each) |
| Quote corpus | `data/quotes.json` (`{ text, author }` records) |
| Modes, variants, rules, defaults, persistence | `lib/settings.ts` |
| Test generation, cleanup, ordering, sections, punctuation / numbers, quote buckets, British/lazy/funbox transforms | `lib/text.ts` |
| Quote length thresholds | `lib/text.ts` → `quoteBucket` (short ≤ 70, medium ≤ 140, long > 140 chars) |
| Settings UI sections and rows | `components/SettingsDialog.tsx` → `SECTIONS` |
| Layout emulation, opposite-shift check, keymap rows | `lib/input.ts` |
| Command list | `components/TypeFight.tsx` → `commands` |
| Mode bar | `components/ModeBar.tsx` |
| Command line / custom editor / text rules / settings | `components/CommandLine.tsx`, `components/CustomTextDialog.tsx`, `components/TextRulesDialog.tsx`, `components/SettingsDialog.tsx` |
| Finisher order / impact timing | `components/TypeFight.tsx` → `FINISHERS`, `FINISHER_FEEDBACK` |
| Colors, word size, strike line | `app/globals.css` (`:root`, `--strike-x`) |
| Theme tokens per family and mode | `app/globals.css` (`html[data-theme="…"][data-scheme="…"]`) |
| Theme families, options and init script | `lib/theme.ts` (`THEME_FAMILIES`, `THEME_OPTIONS`, `THEME_INIT_SCRIPT`) |
| Fighter geometry / animations | `components/Fighter.tsx` |
| Stream and typing engine | `components/TypeFight.tsx` |
| Stats math | `lib/stats.ts` |
| Duel WebSocket server | `server.mjs`, `server/realtime.mjs` |
| Server-side store (users, sessions, leaderboard) | `server/store.mjs` |
| OAuth2 (GitHub, Google) | `server/oauth.mjs` |
| Auth hooks and session helpers | `lib/auth.ts`, `lib/server/session.ts` |
| Duel client hook and types | `lib/duel.ts` |
| Duel HUD | `components/DuelHud.tsx` |
| Multiplayer dialog | `components/MultiplayerDialog.tsx` |
| Auth dialog | `components/AuthDialog.tsx` |
| Leaderboard dialog | `components/LeaderboardDialog.tsx` |
| Auth and leaderboard API routes | `app/api/auth/*`, `app/api/leaderboard`, `app/api/network` |

## Storage keys

| Key | Value |
| --- | --- |
| `platen:settings` | Every mode, rule, input, display, sound, results and appearance option |
| `platen:theme` | One theme id: `<family>-dark` or `<family>-light`, e.g. `slate-dark` |
| `platen:sound` | `1` or `0` |
| `platen:history` | Last ten successful runs: WPM, accuracy, mode label and timestamp |
| `platen:best:time:<seconds>` | Best WPM for that duration |
| `platen:best:words:<count>` | Best WPM for that word count |
| `platen:best:quote:<length>` | Best WPM for that quote bucket |
| `platen:best:zen` | Best WPM for zen |
| `platen:best:custom` | Best WPM for custom |
| `.data/platen.json` | Server-side store: users, sessions, leaderboard rows |

Older builds stored `platen:theme` as `dark`/`light` plus a separate `platen:palette`.
The init script migrates that pair into one theme id and ignores the old key from
then on.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth2 app credentials |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth2 app credentials |
| `PLATEN_BASE_URL` | Public server URL for OAuth callback resolution |
| `PORT` | Server port (default 3000) |
| `HOST` | Server bind address (default 0.0.0.0) |

## Scripts

```bash
npm run dev        # dev server (custom Next.js server with WebSocket)
npm run build      # production build
npm run start      # serve the build via the custom server
npm run typecheck  # tsc --noEmit
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Web Animations API · WebAudio · WebSocket (ws).
No UI or animation libraries.
