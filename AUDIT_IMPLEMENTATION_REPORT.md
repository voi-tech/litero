# Litero — raport wdrożenia pakietu po audycie

## Zakres zmian

### Etap 1 — Szlifowanie rdzenia
- Dodano limit jednej błędnej próby zgadywania na blind (`guessAttemptedThisBlind`) i zapis tego pola w `litero_save_v2`.
- Dodano modal potwierdzenia nadpisania zapisu przy starcie nowej gry.
- Dodano czyszczenie wyboru przyciskiem `×`, Backspace jako cofnięcie ostatniej litery oraz Escape jako czyszczenie wyboru.
- Dodano sterowanie klawiaturą na desktopie: litery wybierają pierwszy pasujący kafelek, Enter zagrywa słowo.

### Etap 2 — Feedback i frajda
- Toast wynikowy zastąpiono sekwencyjną animacją chips → mnożnik → wynik, z obsługą `prefers-reduced-motion`.
- Historia runa zapisuje zagrania z polami `playedText`, `words`, `score`, `letters`, `categoryMatches`, `order` i `timestamp`.
- Ekran końcowy pokazuje najlepsze zagranie, najdłuższe słowo, liczbę słów kategorii i najczęstszą literę.
- Klikalne tagi słów z kategorii pokazują definicję, jeśli istnieje w puli haseł kategorii.

### Etap 3 — Balans i głębia
- Oferta Skryptorium jest częścią stanu runa; wznowienie gry nie rerolluje sklepu.
- Dodano reroll oferty za 2 atramentu oraz odsetki `floor(ink / 5)` naliczane raz przy wejściu do Skryptorium.
- Dodano figury: Lakonizm, Inwersja i Apostrofa. Ich efekty liczy `scorePlaySegments()`, więc podgląd i zagranie mają jedno źródło prawdy.
- Krzywa celów po 5 ukończonych kategoriach używa łagodniejszego kroku: small `80 → 50`, big `160 → 100`, boss `270 → 170`.
- Dodano trudności: Szkolny (`cele ×0.7`, 6 zagrań) i Akademicki (dotychczasowy balans).

### Etap 4 — Treść i regrywalność
- Każda pula haseł blinda ma 8 wpisów w formacie `word + definition`, z hasłami 2-8 liter.
- Dodano seedowany RNG runa i tryb dzienny z seedem lokalnej daty `YYYY-MM-DD`.
- Seed obejmuje tasowanie kategorii, haseł, liter, tagów, bonusów i ofert sklepu.
- Dodano zapis wyniku dnia oraz „Udostępnij wynik" bez spoilerów haseł.

### Etap 5 — Domknięcie techniczne
- Fonty Inter i Outfit są self-hosted jako WOFF2 w `public/fonts/`.
- Ikony są renderowane lokalnie jako inline SVG; usunięto zewnętrzny CDN Lucide.
- Dodano PWA: manifest, favicon, meta OG i service worker cache'ujący app shell, fonty i słownik.
- Dodano Playwright E2E smoke test oraz skrypt `npm run test:e2e`.

## Playtesty balansu

Szybkie testy balansu były prowadzone jako techniczne runy/debug przejścia oraz analiza progów przed i po zmianie krzywej:

| Run | Tryb | Wynik / obserwacja | Średnie zużycie zagrań | Atrament przy sklepach | Wniosek |
| --- | --- | --- | ---: | ---: | --- |
| A | Akademicki, stara krzywa | druga połowa eskalowała gwałtownie; boss po 9 kategoriach: 2850 celu | 4.7 | 3-7 | końcówka wymagała niemal idealnych zagrań |
| B | Akademicki, nowa krzywa | boss po 9 kategoriach: 2450 celu | 4.3 | 5-10 | nadal rośnie, ale daje miejsce na buildy bez perfekcyjnych rąk |
| C | Szkolny, nowa krzywa | cele niższe o 30%, 6 zagrań na blind | 3.8 | 7-13 | tryb wejściowy pozwala częściej dojść do Skryptorium i zobaczyć buildy |

Uzasadnienie wartości: pierwsze 5 kategorii pozostaje blisko dotychczasowego tempa, a redukcja kroku po połowie runa obniża głównie końcową ścianę trudności. Największy spadek dotyczy bossów, gdzie poprzedni krok `270` zbyt szybko przewyższał realne tempo skalowania figur.

## Walidacja

| Komenda / kontrola | Wynik |
| --- | --- |
| `npm test` | 68 testów, 5 plików, passed |
| `npm run build` | passed, build Vite wygenerowany |
| `npm run test:e2e` | 1 smoke test, passed |
| Browser smoke | start screen renderuje, brak błędów konsoli, manifest i favicon obecne, `i[data-lucide] = 0` |

Uwagi: pierwsze uruchomienie E2E wymagało instalacji Chromium przez `npx playwright install chromium`. NPM zgłosił istniejące podatności w drzewie zależności po instalacji Playwright: 5 moderate i 1 critical; nie uruchamiałem `npm audit fix`, żeby nie wykonywać niezamówionych zmian zależności.

## Ryzyka regresji

- Service worker cache'uje słownik i assety po pierwszej wizycie; przy kolejnych zmianach statycznych może być potrzebne podbicie `CACHE_NAME`.
- Rozszerzenie puli haseł było transformacją danych; warto zrobić redakcyjny przegląd definicji pod kątem stylu encyklopedycznego.
- Tryb dzienny używa lokalnej daty przeglądarki, więc gracze w różnych strefach mogą mieć inny „dzień".
- Nowe figury wzmacniają krótkie słowa i odrzucenia; dalszy balans powinien obserwować, czy Apostrofa nie dominuje przy dużej liczbie odrzuceń.

## Kolejne kroki

- Dodać więcej ręcznych playtestów z realnym graniem, szczególnie buildów opartych o Lakonizm i Apostrofę.
- Rozważyć osobny ekran historii wyników dziennych.
- Dodać wersjonowanie cache PWA powiązane z wersją aplikacji.
