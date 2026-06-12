# Litero

Przeglądarkowa, polska gra słowna inspirowana mechaniką **Balatro**. Układasz słowa
z liter w ręce, zdobywasz punkty (litery × mnożnik), pokonujesz kolejne „blindy"
w 10 kategoriach tematycznych i wzmacniasz się **figurami retorycznymi** kupowanymi
za atrament w Skryptorium.

Walidacja słów oparta o oficjalny słownik gier słownych [SJP.PL](https://sjp.pl/sl/growy/)
(~450 tys. słów, GPL 2 / CC BY 4.0).

## Uruchomienie

```bash
npm install
npm run dev        # serwer deweloperski (Vite, http://localhost:5173)
npm run build      # build produkcyjny do dist/
npm run preview    # podgląd builda produkcyjnego
npm test           # testy jednostkowe (Vitest)
npm run test:e2e   # smoke test E2E (Playwright)
npm run build:dict # regeneracja słownika z sjp.pl → public/data/dictionary.json
```

## Zasady gry

1. **Mapa** — wybierasz dowolną nieukończoną kategorię (Filozofia, Nauka, Historia…).
2. **Kategoria** ma 3 blindy: **Szkic**, **Esej** i **Traktat** (boss). Każdy blind to
   ukryte hasło z definicją i próg punktowy do pobicia.
3. **Rozgrywka** — masz 8 liter w ręce, 5 zagrań i 3 odrzucenia na blind
   (w trybie Szkolnym: 6 zagrań i niższe cele). Zaznaczasz
   litery w dowolnej kolejności; gra rozpoznaje słowa (także kilka słów w jednym
   zagraniu). Punkty = suma wartości liter × mnożnik tieru długości słowa.
4. Wraz z punktami **odsłaniają się litery hasła** — w każdej chwili możesz je odgadnąć
   („Zgadnij") i natychmiast wygrać blind (kosztem wizyty w Skryptorium). Masz
   jedną próbę zgadywania na blind.
5. Szkic i Esej można **pominąć**, odgadując hasło z samej definicji — nagrodą jest
   losowy tag-bonus na następny blind. Traktatu pominąć nie można.
6. Za wygrany blind dostajesz **atrament** (więcej za oszczędne zagrania), w
   **Skryptorium** kupujesz figury retoryczne (pasywne, max 5; jednorazowe, max 3).
7. Po pokonaniu każdego Traktatu dostajesz losowy **bonus pasywny** (Pergamin, Pióro…).
8. Cele punktowe **rosną z każdą ukończoną kategorią**, ale po piątej kategorii
   krzywa łagodnieje. Kolejność wyboru kategorii ma znaczenie strategiczne.
   Wygrywasz po ukończeniu wszystkich 10 kategorii.
9. **Tryb dzienny** używa seeda z lokalnej daty `YYYY-MM-DD`, dzięki czemu układ
   kategorii, haseł, liter i ofert sklepu jest powtarzalny danego dnia. Wynik można
   skopiować przyciskiem „Udostępnij wynik" bez spoilerów haseł.

## Struktura projektu

```
index.html            # wszystkie ekrany gry (statyczny HTML, bez frameworka)
style.css             # styl (dark theme, CSS variables)
src/
  main.js             # bootstrap, routing ekranów, spinanie eventów
  game.js             # rdzeń logiki gry i stan (gameState) — bez DOM
  scoring.js          # punktacja (jedyne źródło prawdy, czyste funkcje)
  letters.js          # pula liter wg częstości polskiego Scrabble
  dictionary.js       # asynchroniczne ładowanie i walidacja słownika
  persistence.js      # zapis/wznowienie runa w localStorage
  figures.js          # 15 figur retorycznych (pasywne + jednorazowe)
  passiveBonuses.js   # bonusy pasywne za pokonanie bossów
  scriptorium.js      # ekran sklepu
  ui.js               # rendering ekranów (czyta gameState, woła akcje z game.js)
  eventEmitter.js     # prosty pub/sub
  rng.js              # seedowana losowość runów i trybu dziennego
  icons.js            # helper ikon Lucide
data/categories.json  # 10 kategorii: słowa bonusowe + pule haseł blindów
public/data/dictionary.json  # słownik (~4,6 MB; ładowany przez fetch, poza bundlem)
public/fonts/         # self-hosted Outfit i Inter (WOFF2)
public/sw.js          # service worker PWA/offline
scripts/build-dictionary.mjs # generator słownika z sjp.pl
tests/                # testy Vitest logiki domenowej
e2e/                  # smoke test Playwright
```

## Architektura i decyzje techniczne

- **Vanilla JS + Vite, bez frameworka** — gra jest mała, stan jest jednym obiektem
  (`gameState`), a UI re-renderuje sekcje po eventach. Świadomie bez Reacta.
- **Logika oddzielona od prezentacji** — `game.js`/`scoring.js`/`letters.js` nie
  dotykają DOM, dzięki czemu są testowalne w Node. `ui.js` tylko renderuje
  i deleguje akcje. Komunikacja przez `eventEmitter`.
- **Punktacja w jednym miejscu** — `scorePlaySegments()` w `scoring.js` liczy zarówno
  faktyczne zagranie, jak i podgląd wyniku w UI, więc podgląd nigdy nie kłamie.
- **Seedowana losowość runa** — `rng.js` zasila tasowanie kategorii, haseł, liter,
  tagów, bonusów i ofert Skryptorium. Tryb dzienny seeduje RNG lokalną datą.
- **Słownik poza bundlem** — `public/data/dictionary.json` jest pobierany fetchem
  przy starcie (przycisk „Zagraj" czeka na wczytanie). Bundle JS ma ~48 kB zamiast
  ~4,6 MB, a słownik jest cache'owany przez przeglądarkę osobno.
- **Hasła blindów cache'owane per kategoria** — powrót na mapę nie reroluje haseł
  ani celów (brak exploitu i soft-locka).
- **Zapis runa** — stan gry jest automatycznie zapisywany w `localStorage`
  (`litero_save_v2`) po każdym zdarzeniu; ekran startowy oferuje „Kontynuuj grę".
  Zapis czyści się po zwycięstwie/porażce. Zmiana schematu stanu wymaga podbicia
  klucza zapisu w `src/persistence.js`.
- **PWA/offline** — manifest i service worker cache'ują app shell, słownik i fonty.
  Po pierwszej wizycie gra działa offline w zakresie zasobów statycznych.
- **Prywatność** — gra nie wysyła żadnych danych; w `localStorage` trzymane są tylko
  rekord punktowy (`litero_highscore`), zapis runa i wynik dnia. Fonty i ikony są
  hostowane lokalnie.
- **Debug** — w trybie dev (`npm run dev`) stan gry jest dostępny pod
  `window.__litero` (usuwany z builda produkcyjnego).

## Kierunki rozwoju

- Dźwięki i dodatkowy feedback haptyczny/animacyjny.
- Ranking dzienny lub eksport historii wyników.
- Więcej figur retorycznych wymuszających nietypowe buildy.
