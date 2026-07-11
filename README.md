# Litero — Redakcja słów

Edukacyjna polska gra słowna dla graczy od 7 lat. Łączy układanie słów, odkrywanie
liter i odgadywanie pojęć. Każda runda kończy się kartą wiedzy z definicją,
przykładem użycia, synonimem i krótkim pytaniem utrwalającym.

## Uruchomienie

```bash
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

## Główna pętla

1. Gracz otrzymuje definicję oraz zakryte hasło.
2. Z ośmiu liter układa poprawne polskie słowa.
3. Każde przyjęte słowo wymienia użyte litery na nowe i pozwala wybrać
   podpowiedź: spółgłoskę, samogłoskę, dowolną literę albo dodatkową próbę.
4. Gracz może w dowolnym momencie spróbować odgadnąć hasło.
5. Po rundzie poznaje pełne znaczenie, przykład i ciekawostkę oraz odpowiada na
   jedno nieblokujące pytanie.

Pełne wydanie ma pięć haseł i finał. Hasła dnia mają trzy rundy oraz deterministyczny
seed lokalnej daty. Porażka pojedynczego hasła nie kończy gry — obniża nakład,
ale run trwa dalej.

## Punktacja i wsparcie

Wynik rundy ma cztery ograniczone części i nie może przekroczyć 1000 punktów:

- rozwiązanie: 500;
- warsztat słowny: 300;
- wiedza: 100;
- styl i narzędzia: 100.

Automatyczne wsparcie analizuje trzy poprzednie rundy i może zmienić się najwyżej
o jeden poziom pomiędzy hasłami. Nie zmienia rozpoczętego hasła ani jego rozwiązania.
W ustawieniach można wybrać stały poziom.

## Architektura

- `src/editorial/roundEngine.js` — czysta maszyna stanów rundy;
- `src/editorial/runEngine.js` — run, tryb dzienny, finał i ekonomia;
- `src/editorial/scoring.js` — punktacja 0–1000;
- `src/editorial/adaptation.js` — ograniczona adaptacja wsparcia;
- `src/editorial/content.js` — walidacja treści edukacyjnych;
- `src/editorial/persistence.js` — wersjonowany zapis `litero_save_v3`;
- `data/editorial-puzzles.json` — zredagowana pula haseł;
- `src/main.js` — kontroler i semantyczne widoki aplikacji.

Stare moduły gry pozostają czasowo w repozytorium jako zabezpieczenie porównawcze
do czasu zakończenia szerszych playtestów. Nie są ładowane przez nową aplikację.

## Design i dostępność

Interfejs interpretuje język Primary Simplified jako ciepłą, drukarską rozkładówkę:
papierowe powierzchnie, spokojne szarości oraz czerwone, niebieskie i żółte akcenty.
Geist Variable obsługuje cały tekst, a Geist Mono Variable — litery, wyniki i dane.
Odstępy, promienie, typografia i proporcje układu korzystają z jednej skali opartej
na złotym podziale. Gra oferuje jasny, ciemny i systemowy motyw, pełną obsługę
klawiatury, widoczny fokus, cele dotykowe minimum 42 px, komunikaty `aria-live`
i ograniczenie animacji przez `prefers-reduced-motion`.

## Dane i prywatność

Walidacja słów korzysta z lokalnego słownika gier słownych SJP.PL. Aplikacja nie
wysyła danych gracza. Zapis, preferencje i wyniki dzienne pozostają w `localStorage`.
Service worker w wersji zgodnej z wydaniem `26.7.0` udostępnia zasoby po pierwszym
wczytaniu także offline.
