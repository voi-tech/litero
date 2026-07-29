# Elastyczne zagrania Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rozszerzyć słownik Litero i pozwolić punktować kilka kolejnych słów albo najlepszą pojedynczą literę bez blokowania rozgrywki.

**Architecture:** Generator przygotuje większy, nadal statyczny leksykon. Nowy czysty moduł `src/v4-play.js` oddzieli segmentację oraz punktowanie wyboru od kontrolera DOM, a `src/main.js` pozostanie odpowiedzialny za zastosowanie wyniku do stanu, wymianę kafelków i komunikaty.

**Tech Stack:** JavaScript ES modules, Vitest, Vite, Playwright, Python 3, Morfeusz 2/SGJP, wordfreq.

## Global Constraints

- Zachować nazwy własne, skróty, słowa z łącznikiem i pełne pokrycie wszystkich form fleksyjnych poza zakresem.
- Słownik przyjmuje wyłącznie polskie formy długości 2–8 liter, bez nazw własnych i słów odfiltrowanych dla rodzinnej gry 10+.
- Segmentacja wybiera najdłuższe słowo od lewej, powtarza analizę i zatrzymuje się na pierwszym nierozpoznanym fragmencie.
- Brak słowa punktuje pierwszą spośród liter o najwyższej wartości z bazowym mnożnikiem `×1`.
- Każde niepuste zagranie zużywa jedno zagranie i wszystkie wybrane kafelki.
- `Podwojenie` i utrudnienie pierwszego poprawnego słowa dotyczą tylko pierwszego rozpoznanego słowa.
- Nie dodawać trwałego mnożnika niezależnego od słowa ani zewnętrznych zapytań słownikowych podczas gry.
- Zachować obecne zachowanie fokusu, `aria-live`, responsywność, motywy i reguły uzupełniania ręki.

---

### Task 1: Rozszerzony leksykon

**Files:**
- Modify: `scripts/build-lexicon.py:17-213`
- Modify: `public/data/lexicon-v4.json`
- Modify: `tests/lexicon-v4.test.js:8-64`

**Interfaces:**
- Consumes: `analyse_word(morfeusz, surface, target)` oraz obecny format `payload.entries`.
- Produces: co najmniej 20 000 wpisów w tym samym formacie oraz gwarantowane formy `byk`, `byki`, `kot`, `tok`.

- [ ] **Step 1: Write the failing lexicon coverage test**

W `tests/lexicon-v4.test.js` zmień minimalny rozmiar i dodaj niezależne
sprawdzenie zwykłych słów:

```js
expect(payload.entries.length).toBeGreaterThanOrEqual(20_000);

const available = new Set(payload.entries.map(entry => entry.surface));
for (const word of ['byk', 'byki', 'kot', 'tok']) {
  expect(available.has(word), `brak zwykłego słowa: ${word}`).toBe(true);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/lexicon-v4.test.js
```

Expected: FAIL, ponieważ plik ma 6070 wpisów i nie zawiera `byk`, `byki` ani
`tok`.

- [ ] **Step 3: Expand the generator with exact limits**

W `scripts/build-lexicon.py` dodaj:

```python
FREQUENCY_CANDIDATE_LIMIT = 100_000
ENTRY_LIMIT = 20_000
REQUIRED_COMMON_WORDS = {"byk", "byki", "kot", "tok"}
```

Zbuduj pulę kandydatów w kolejności obowiązkowe słowa, lista częstości,
słowa kategorii:

```python
frequent = [
    word.lower()
    for word in top_n_list("pl", FREQUENCY_CANDIDATE_LIMIT)
    if WORD_RE.fullmatch(word.lower())
]
required = targets | REQUIRED_COMMON_WORDS

for word in [*sorted(REQUIRED_COMMON_WORDS), *frequent, *sorted(targets)]:
    if word in seen:
        continue
    seen.add(word)
    candidates.append(word)

for word in candidates:
    entry = analyse_word(morfeusz, word, word in required)
    if entry:
        entries.append(entry)
    if len(entries) >= ENTRY_LIMIT:
        break
```

Po limicie zachowaj obecną pętlę ratunkową, ale obejmij nią całe `required`:

```python
existing = {entry["surface"] for entry in entries}
for word in sorted(required - existing):
    entry = analyse_word(morfeusz, word, True)
    if entry:
        entries.append(entry)
```

- [ ] **Step 4: Regenerate the static asset**

Run:

```bash
python3 -m venv /private/tmp/litero-lexicon-venv
/private/tmp/litero-lexicon-venv/bin/pip install -r requirements-lexicon.txt
/private/tmp/litero-lexicon-venv/bin/python scripts/build-lexicon.py
```

Expected: generator reports at least 20 000 forms and rewrites
`public/data/lexicon-v4.json`.

- [ ] **Step 5: Verify GREEN and data invariants**

Run:

```bash
npx vitest run tests/lexicon-v4.test.js
```

Expected: all lexicon tests PASS, including length, proper-name and family
filters.

- [ ] **Step 6: Commit the lexicon task**

```bash
git add scripts/build-lexicon.py public/data/lexicon-v4.json tests/lexicon-v4.test.js
git commit -m "fix: rozszerz polski słownik gry"
```

---

### Task 2: Czysta analiza i punktowanie wyboru

**Files:**
- Create: `src/v4-play.js`
- Create: `tests/play-v4.test.js`
- Modify: `src/v4-scoring.js:1-155`

**Interfaces:**
- Consumes: `getLexiconEntry(word)`, `scoreWord(entry, context)` oraz `LETTER_VALUES`.
- Produces:
  - `analyzeSelection(selection, lookup = getLexiconEntry) -> { kind, words, letter, ignored }`
  - `scoreSelection(selection, context = {}, options = {}) -> { valid, kind, score, words, letter, units, previousWord, aliterationStreak, consumesDoubleNext }`
  - `scoreLetter(letter) -> { valid, chips, mult, score, appliedCards, aliterationStreak }`

- [ ] **Step 1: Write failing segmentation tests**

Utwórz `tests/play-v4.test.js`, ustawiając prawdziwy leksykon testowy przez
`setLexiconEntries`:

```js
import { beforeEach, describe, expect, it } from 'vitest';
import { setLexiconEntries } from '../src/lexicon.js';
import { analyzeSelection, scoreSelection } from '../src/v4-play.js';

const entry = surface => ({
  surface: surface.toLocaleLowerCase('pl-PL'),
  lemma: surface.toLocaleLowerCase('pl-PL'),
  analyses: [{ partOfSpeech: 'rzeczownik', features: [], properName: false }],
  spellingTags: [],
});

beforeEach(() => {
  setLexiconEntries(['kot', 'tok', 'kottok'].map(entry));
});

it('wybiera całe najdłuższe słowo zamiast krótszego podziału', () => {
  expect(analyzeSelection('KOTTOK').words.map(item => item.word)).toEqual(['KOTTOK']);
});

it('rozpoznaje kolejne słowa od lewej', () => {
  setLexiconEntries(['kot', 'tok'].map(entry));
  const result = analyzeSelection('KOTTOK');
  expect(result.words.map(item => item.word)).toEqual(['KOT', 'TOK']);
  expect(result.ignored).toBe('');
});

it('zatrzymuje analizę na pierwszym nierozpoznanym fragmencie', () => {
  setLexiconEntries(['kot', 'tok'].map(entry));
  const result = analyzeSelection('KOTXYZTOK');
  expect(result.words.map(item => item.word)).toEqual(['KOT']);
  expect(result.ignored).toBe('XYZTOK');
});

it('bez słowa wybiera pierwszą najwyżej wycenioną literę', () => {
  setLexiconEntries([]);
  expect(analyzeSelection('ABFJ').letter).toMatchObject({ letter: 'F', index: 2 });
});
```

- [ ] **Step 2: Run segmentation tests and verify RED**

Run:

```bash
npx vitest run tests/play-v4.test.js
```

Expected: FAIL because `src/v4-play.js` does not exist.

- [ ] **Step 3: Add the single-letter scoring primitive**

W `src/v4-scoring.js` dodaj:

```js
export function scoreLetter(letter) {
  const normalized = String(letter ?? '').toLocaleUpperCase('pl-PL');
  const chips = LETTER_VALUES[normalized] ?? 0;
  return {
    valid: chips > 0,
    chips,
    mult: 1,
    score: chips,
    appliedCards: [],
    aliterationStreak: 0,
  };
}
```

- [ ] **Step 4: Implement deterministic analysis**

W `src/v4-play.js` zaimportuj `getLexiconEntry`, `LETTER_VALUES`,
`scoreLetter` i `scoreWord`. `analyzeSelection` ma:

```js
const letters = [...String(selection ?? '').toLocaleUpperCase('pl-PL')];
const words = [];
let offset = 0;

while (offset < letters.length) {
  let match = null;
  const maxLength = Math.min(8, letters.length - offset);
  for (let length = maxLength; length >= 2; length -= 1) {
    const word = letters.slice(offset, offset + length).join('');
    const entry = lookup(word);
    if (entry) {
      match = { word, entry, start: offset, end: offset + length };
      break;
    }
  }
  if (!match) break;
  words.push(match);
  offset = match.end;
}
```

Jeżeli `words` jest puste, wybierz pierwszą literę o maksymalnej wartości
przez redukcję z warunkiem `value > best.value`, nie `>=`, aby zachować
pierwszy remis.

- [ ] **Step 5: Add failing scoring tests**

Do `tests/play-v4.test.js` dodaj:

```js
it('sumuje osobno punktowane słowa i zużywa Podwojenie tylko na pierwszym', () => {
  setLexiconEntries(['kot', 'tok'].map(entry));
  const result = scoreSelection('KOTTOK', { doubleNext: true });
  expect(result.kind).toBe('words');
  expect(result.units.map(unit => unit.score)).toEqual([30, 15]);
  expect(result.score).toBe(45);
  expect(result.previousWord).toBe('TOK');
  expect(result.consumesDoubleNext).toBe(true);
});

it('punktuje pojedynczą literę mnożnikiem jeden bez zużycia Podwojenia', () => {
  setLexiconEntries([]);
  const result = scoreSelection('ABFJ', { doubleNext: true, previousWord: 'KOT' });
  expect(result).toMatchObject({
    kind: 'letter',
    score: 3,
    previousWord: 'KOT',
    consumesDoubleNext: false,
  });
});
```

Wartości są policzone ręcznie: `KOT` i `TOK` mają po 5 punktów literowych,
długość 3 daje 7 chips po zaokrągleniu oraz mnożnik 3, więc testowe oczekiwania
należy skorygować do `[42, 21]` i sumy `63`. Użyj tych finalnych literałów w
teście.

- [ ] **Step 6: Run scoring tests and verify RED**

Run:

```bash
npx vitest run tests/play-v4.test.js
```

Expected: segmentation tests PASS, scoring tests FAIL because
`scoreSelection` is not implemented.

- [ ] **Step 7: Implement sequential scoring**

`scoreSelection` ma:

- zwracać `valid: false` wyłącznie dla pustego wyboru;
- dla litery używać `scoreLetter`, zachować poprzednie słowo i serię oraz
  ustawić `consumesDoubleNext: false`;
- dla słów wywołać `scoreWord` kolejno, przekazując wynikowe
  `previousWord` i `aliterationStreak` do następnego słowa;
- przekazać `doubleNext: true` wyłącznie do pierwszego słowa;
- zastosować opcjonalne
  `options.adjustScore({ result, word, index, isWord })`;
- zsumować skorygowane wyniki w `score`;
- zwrócić jednostki jako
  `{ word, entry, rawScore, score, index, isWord: true }`.

Rdzeń implementacji:

```js
export function scoreSelection(selection, context = {}, options = {}) {
  const analysis = analyzeSelection(
    selection,
    options.lookup ?? getLexiconEntry,
  );
  const adjustScore = options.adjustScore
    ?? (({ result }) => result.score);

  if (analysis.kind === 'empty') {
    return { valid: false, kind: 'empty', score: 0, words: [], units: [] };
  }

  if (analysis.kind === 'letter') {
    const rawScore = scoreLetter(analysis.letter.letter);
    const score = adjustScore({
      result: rawScore,
      word: analysis.letter.letter,
      index: 0,
      isWord: false,
    });
    return {
      valid: true,
      ...analysis,
      score,
      units: [{
        word: analysis.letter.letter,
        entry: null,
        rawScore,
        score,
        index: 0,
        isWord: false,
      }],
      previousWord: context.previousWord ?? null,
      aliterationStreak: context.aliterationStreak ?? 0,
      consumesDoubleNext: false,
    };
  }

  let previousWord = context.previousWord ?? null;
  let aliterationStreak = context.aliterationStreak ?? 0;
  const units = analysis.words.map((item, index) => {
    const rawScore = scoreWord(item.entry, {
      ...context,
      previousWord,
      aliterationStreak,
      doubleNext: Boolean(context.doubleNext && index === 0),
    });
    const score = adjustScore({
      result: rawScore,
      word: item.word,
      index,
      isWord: true,
    });
    previousWord = item.word;
    aliterationStreak = rawScore.aliterationStreak;
    return { ...item, rawScore, score, index, isWord: true };
  });

  return {
    valid: true,
    ...analysis,
    score: units.reduce((sum, unit) => sum + unit.score, 0),
    units,
    previousWord,
    aliterationStreak,
    consumesDoubleNext: Boolean(context.doubleNext),
  };
}
```

- [ ] **Step 8: Verify the play module GREEN**

Run:

```bash
npx vitest run tests/play-v4.test.js tests/lexicon-v4.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 9: Commit the play-analysis task**

```bash
git add src/v4-play.js src/v4-scoring.js tests/play-v4.test.js
git commit -m "feat: punktuj elastyczne układy liter"
```

---

### Task 3: Integracja rozgrywki i czytelne liczniki

**Files:**
- Modify: `src/main.js:1-467`
- Modify: `index.html:43-48`
- Modify: `README.md:13-28`
- Modify: `e2e/litero-smoke.spec.js:1-28`

**Interfaces:**
- Consumes: `scoreSelection(selection, context, { adjustScore })` z Task 2.
- Produces: każde niepuste zagranie przechodzi do `playValidWord`, zużywa kafelki i próbę; UI pokazuje jawne pozostałe akcje.

- [ ] **Step 1: Write failing E2E expectations**

W pierwszym teście E2E oczekuj przycisku `Zagraj litery` i nowego tekstu
pomocy. Dodaj osobny test:

```js
test('pokazuje pozostałe akcje i pozwala zagrać jedną literę', async ({ page }) => {
  await page.getByRole('button', { name: 'Pełna gra' }).click();
  await page.getByRole('button', { name: 'Rozpocznij wyzwanie' }).click();

  await expect(page.getByText('pozostałe zagrania', { exact: true })).toBeVisible();
  await expect(page.getByText('pozostałe odrzucenia', { exact: true })).toBeVisible();
  await expect(page.locator('.attempt-stats div').first().locator('strong')).toHaveText('5');

  await page.locator('.letter-tile').first().click();
  await page.getByRole('button', { name: 'Zagraj litery' }).click();

  await expect(page.locator('.attempt-stats div').first().locator('strong')).toHaveText('4');
});
```

- [ ] **Step 2: Run the focused E2E test and verify RED**

Run:

```bash
npx playwright test e2e/litero-smoke.spec.js --grep "pozostałe akcje"
```

Expected: FAIL because labels and one-letter play are not implemented.

- [ ] **Step 3: Replace whole-word validation in the controller**

W `src/main.js`:

- zamień import `getLexiconEntry` na import `scoreSelection` z
  `./v4-play.js`;
- zmień `adjustedPlayScore` na
  `adjustedPlayScore(result, word, index, isWord)`;
- dla utrudnienia samogłosek licz udział na podstawie argumentu `word`;
- stosuj `firstPlayMultiplier` wyłącznie, gdy
  `isWord && run.wordsPlayedInChallenge + index === 0`;
- w `playSelection` wywołaj `scoreSelection` z obecnym kontekstem i
  `adjustScore: adjustedPlayScore`;
- usuń gałąź blokującą brak wpisu słownikowego;
- przekaż łączny wynik do `playValidWord`;
- dla wyniku słownego ustaw ostatnie słowo i serię, zwiększ
  `wordsPlayedInChallenge` o liczbę jednostek, wyłącz `doubleNext` i wywołaj
  `updateMetaForWord` dla każdej jednostki;
- dla wyniku literowego zachowaj `doubleNext`, poprzednie słowo, serię i
  statystyki słowne;
- usuń wszystkie wybrane kafelki i uzupełnij rękę niezależnie od rodzaju
  wyniku;
- seed uzupełnienia oprzyj na całym wybranym ciągu;
- ogłoś listę rozpoznanych słów albo najlepszą literę oraz łączny wynik.

Rdzeń kontrolera:

```js
function adjustedPlayScore(result, word, index, isWord) {
  let score = result.score;
  if (run.upgrades.includes('letter-value')) score = Math.floor(score * 1.25);
  const boss = run.challenge.kind === 'category' ? run.challenge.bossModifier : null;
  if (boss?.vowelsGiveNoChips) {
    const letters = [...word];
    const vowelShare = letters.filter(letter => VOWELS.has(letter)).length / letters.length;
    score = Math.max(1, Math.floor(score * (1 - vowelShare)));
  }
  if (
    isWord
    && boss?.firstPlayMultiplier
    && run.wordsPlayedInChallenge + index === 0
  ) {
    score = Math.floor(score * boss.firstPlayMultiplier);
  }
  return score;
}

function playSelection() {
  const selection = selectedIndices.map(index => run.hand[index]).join('');
  const play = scoreSelection(selection, {
    activeCardIds: run.languageCardIds,
    letterSetId: run.letterSetId,
    previousWord: run.previousWord,
    aliterationStreak: run.aliterationStreak,
    doubleNext: run.doubleNext,
  }, {
    adjustScore: ({ result, word, index, isWord }) => (
      adjustedPlayScore(result, word, index, isWord)
    ),
  });
  if (!play.valid) return;

  const oldPhase = run.phase;
  run = playValidWord(run, { valid: true, score: play.score });

  if (play.kind === 'words') {
    run.previousWord = play.previousWord;
    run.aliterationStreak = play.aliterationStreak;
    run.wordsPlayedInChallenge += play.units.length;
    run.doubleNext = false;
    for (const unit of play.units) {
      run.maxWordLengthInCategory = Math.max(
        run.maxWordLengthInCategory ?? 0,
        [...unit.word].length,
      );
      updateMetaForWord(unit.entry, unit.rawScore, unit.score);
    }
  }

  const remaining = run.hand.filter((_, index) => !selectedIndices.includes(index));
  run.hand = refillPlayableHand(
    remaining,
    run.handSize,
    deterministicRandom(
      `${run.seed}:refill:${run.completedChallenges.length}:${run.playsLeft}:${selection}`,
    ),
    getLetterSetRules(run.letterSetId),
  );
  selectedIndices = [];
  if (oldPhase === 'playing' && run.phase !== 'playing' && run.phase !== 'defeat') {
    awardChallenge();
  }
  persistRun();
  announce(play.kind === 'words'
    ? `${play.words.map(item => item.word).join(' + ')}: ${play.score} punktów.`
    : `${play.letter.letter}: ${play.score} punktów — najlepsza litera.`);
  renderRun();
}
```

- [ ] **Step 4: Update controls, counters and rules copy**

W `renderTable`:

```js
<span>pozostałe zagrania</span>
<span>pozostałe odrzucenia</span>
```

Aktywuj przycisk przy `selectedWord.length >= 1`, zmień etykietę na
`Zagraj litery`, a pomoc na:

```text
Punktują kolejne słowa od lewej. Bez słowa punktuje najlepsza litera.
```

W `index.html` i `README.md` usuń twierdzenia o dokładnie jednym słowie i
opisz zużywanie każdej niepustej kombinacji.

- [ ] **Step 5: Run unit and focused E2E tests**

Run:

```bash
npm test
npx playwright test e2e/litero-smoke.spec.js --grep "płynnie|pozostałe akcje"
```

Expected: all unit tests and both focused E2E tests PASS.

- [ ] **Step 6: Commit the integration task**

```bash
git add src/main.js index.html README.md e2e/litero-smoke.spec.js
git commit -m "feat: pozwól zagrywać dowolne litery"
```

---

### Task 4: Pełna weryfikacja

**Files:**
- Verify only: all files changed in Tasks 1–3.

**Interfaces:**
- Consumes: complete implementation.
- Produces: fresh evidence that unit tests, production build, browser tests and whitespace checks pass.

- [ ] **Step 1: Run the complete unit suite**

```bash
npm test
```

Expected: exit 0 and zero failed tests.

- [ ] **Step 2: Build the production application**

```bash
npm run build
```

Expected: exit 0 without Vite build errors.

- [ ] **Step 3: Run all browser tests**

```bash
npm run test:e2e
```

Expected: every Playwright test passes.

- [ ] **Step 4: Check data and diff integrity**

```bash
git diff --check
git status --short
git log -4 --oneline --decorate
```

Expected: no whitespace errors; status lists no uncommitted implementation
files; history contains the spec, lexicon, play-analysis and integration
commits.

- [ ] **Step 5: Review requirements against the design**

Read
`docs/superpowers/specs/2026-07-29-elastyczne-zagrania-design.md` and confirm:

- `BYK`, `BYKI`, `KOT`, `TOK` are accepted;
- `KOTXYZ`, `KOTTOK`, `KOTXYZTOK` and random letters follow the specified
  scoring paths;
- every nonempty selection consumes one play and all selected tiles;
- counters explicitly say that they show remaining actions;
- names, abbreviations and hyphenated words remain unsupported.
