# Litero

Polska gra słowna oparta na punktowych wyzwaniach, odkrywaniu definicji i
budowaniu trwałego Słownika.

## Uruchomienie

```bash
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

## Pętla rozgrywki

Pełne podejście obejmuje trzy kategorie, a wyzwanie dzienne jedną. Każda
kategoria składa się z Łatwego słowa, Trudnego słowa i obowiązkowego finału —
Kategorii.

Przed wyzwaniem słownym gracz widzi część mowy, długość, definicję, cel i jawne
skutki pominięcia. Może rozpocząć grę, odgadnąć słowo z definicji i pominąć je
z premią albo pominąć bez odpowiedzi. Podczas właściwej gry nie ma zgadywania
ani wskazówek: każde zagranie tworzy dokładnie jedno słowo i powiększa wynik.

Pokonanie celu odsłania słowo i definicję, a następnie otwiera sklep. Finał
pokazuje nazwę kategorii oraz obowiązkowe utrudnienie; nie można go pominąć.
Zwycięstwo odsłania definicję kategorii i zapisuje jej dział w Słowniku.

## Metagra

- Zestawy liter zmieniają rozkład liter, rozmiar ręki lub zasady punktacji.
- Karty językowe premiują prawdziwe części mowy i cechy zapisu.
- Karty działań są jednorazowe i dokładnie opisują wykonywaną czynność.
- Ulepszenie wybrane po pierwszej i drugiej kategorii działa do końca podejścia.
- Warunki odblokowania są widoczne na ekranach Kart językowych i Zestawów liter.

Odblokowania są naliczane wyłącznie w zwykłych, niezseedowanych podejściach.

## Dane

`public/data/lexicon-v4.json` jest budowany przez `npm run build:lexicon` z
Morfeusza 2/SGJP oraz list częstości `wordfreq`. Plik przechowuje formę,
lemat, możliwe części mowy, cechy fleksyjne i zweryfikowane cechy pisowni.
Informacje o źródłach i licencjach są zapisane także w wygenerowanym pliku.
Pełne noty znajdują się w [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Interfejs i zapis

Interfejs korzysta z języka Primary Simplified: ciepłych neutralnych teł,
miękkich warstw, oszczędnych akcentów i systemowego fontu Inter. Obsługuje
klawiaturę, widoczny fokus, `aria-live`, ciemny motyw, układ mobilny oraz
`prefers-reduced-motion`.

Aktywne podejście korzysta z zapisu `litero_run_v4`, a trwały profil z
`litero_profile_v1`. Service worker jest rejestrowany wyłącznie w produkcji.
