# Litero

Przeglądarkowa gra słowna łącząca mechanikę wisielca z systemem figur retorycznych. Zgaduj polskie słowa literka po literce, budując mnożniki i kolekcjonując figury które zmieniają reguły każdej rundy.

## Jak grać

1. Wybierz liczbę rund (5 / 10 / 15) i poziom trudności
2. Przed każdą rundą wybierz figurę retoryczną — pasywną (działa przez całą rundę) lub jednorazową (używasz ręcznie)
3. Zgaduj litery słowa. Masz 6 prób i 30 sekund
4. Buduj combo i mnożnik punktów
5. Zdobywaj atrament ✦ na zakupy w Scriptorium
6. Co 3 rundy wzrasta trudność (Ante) — timer się skraca, słowa stają się trudniejsze

## Figury retoryczne

### Pasywne (działają przez całą rundę)

| Figura | Efekt |
|--------|-------|
| Hiperbola | Mnożnik startuje od 1.5 |
| Aliteracja | Powtarzające się litery w słowie warte 2× |
| Polonizm | Polskie znaki (ą, ę, ć...) warte 3× |
| Pleonazm | Odkrycie litery kosztuje 30% mniej atramentu |
| Litotes | Timer startuje od 45s zamiast 30s |
| Bezbłędnik | Pierwszy błąd w rundzie jest anulowany |
| Inicjał | Na starcie pierwsza litera słowa jest odkryta |
| Kombo | Bonus za combo +0.5 zamiast +0.3 |
| Skryba | +1 atrament za każde trafienie |
| Perfekcjonista | Brak błędów = podwójne punkty końcowe |

### Jednorazowe (używasz ręcznie w trakcie rundy)

| Figura | Efekt |
|--------|-------|
| Elipsa | Pauzuje timer na 10 sekund |
| Synekdocha | Odkrywa najrzadszą zakrytą literę za darmo |
| Anakolut | Przywraca combo sprzed ostatniego błędu |
| Emfaza | Podwaja mnożnik do końca rundy |
| Akrostych | Pokazuje pierwszą i ostatnią literę słowa |

## System punktacji

- Samogłoski (A, E, I, O, U): **20 pkt**
- Popularne spółgłoski (N, S, T, R, L): **30 pkt**
- Rzadkie spółgłoski (W, K, D, P, M): **40 pkt**
- Bardzo rzadkie (G, B, H, F, J, C): **55 pkt**
- Polskie znaki (Ą, Ć, Ę, Ł, Ń, Ó, Ś, Ź, Ż): **70 pkt**

**Wynik rundy** = `punkty_bazowe × mnożnik + czas_pozostały × 5`

**Mnożnik** rośnie o +0.1 za każde trafienie. Combo ≥ 3 daje dodatkowy bonus +0.3.

**Atrament** ✦ = 3 za odgadnięcie słowa + 1 za każde 100 pkt bazowych.

## Stack techniczny

- Vanilla JS (ES Modules) + HTML + CSS
- [Vite](https://vitejs.dev/) jako dev server i bundler
- Słownik: [Wikisłownik](https://pl.wiktionary.org/) przez MediaWiki API z fallback JSON (90 słów)
- Brak frameworków, brak backendu — localStorage do przechowywania rekordów
- Architektura event-driven z własnym EventEmitter

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz `http://localhost:5173` w przeglądarce.

### Build produkcyjny

```bash
npm run build
npm run preview
```

## Struktura projektu

```
litero/
├── index.html          # Struktura 6 ekranów gry
├── style.css           # Dark theme, mobile-first, animacje CSS
├── src/
│   ├── main.js         # Bootstrap, routing między ekranami
│   ├── game.js         # Core loop, gameState
│   ├── words.js        # Słownik + fetch z Wikisłownika
│   ├── figures.js      # 15 figur retorycznych + hook system
│   ├── scoring.js      # Punkty, mnożniki, atrament
│   ├── timer.js        # requestAnimationFrame timer
│   ├── ui.js           # Renderowanie DOM, animacje
│   ├── scriptorium.js  # Sklep między rundami
│   └── eventEmitter.js # Pub/sub singleton
└── data/
    └── words.json      # 90 polskich słów z definicjami
```
