# Elastyczne zagrania i szerszy słownik

## Cel

Usunąć blokadę rozgrywki powodowaną przez zbyt mały słownik i wymaganie, aby
cały wybór liter tworzył dokładnie jedno słowo. Gracz ma móc zużyć dowolny
wybór liter, a gra ma punktować rozpoznane słowa albo najlepszą pojedynczą
literę.

## Zakres

- rozszerzenie statycznego słownika często używanych polskich form,
- rozpoznawanie jednego lub kilku kolejnych słów w wybranym ciągu,
- punktowanie najlepszej litery, gdy ciąg nie zaczyna się od słowa,
- zużywanie wszystkich wybranych liter i jednego zagrania,
- jednoznaczne etykiety pozostałych zagrań i odrzuceń,
- aktualizacja zasad oraz testów jednostkowych i E2E.

Poza zakresem pozostają nazwy własne, skróty, słowa z łącznikiem, pełne
pokrycie wszystkich form fleksyjnych oraz nowy, trwały mnożnik niezależny od
punktowanego słowa.

## Słownik

Generator zachowa obecne źródła, licencje, filtr nazw własnych, filtr rodzinny
i ograniczenie długości do 2–8 liter. Przeanalizuje 100 000 najczęstszych
kandydatów i zachowa pierwsze 20 000 zaakceptowanych form. Zwykłe przykłady
`byk`, `byki`, `kot` i `tok` zostaną włączone do puli obowiązkowej przed
limitem, a ich obecność potwierdzi test danych.

W aplikacji nadal będzie ładowany jeden statyczny plik JSON. Nie będzie
zapytania sieciowego do zewnętrznego słownika podczas gry ani heurystycznego
uznawania nieznanych ciągów.

## Analiza wyboru liter

Analiza działa deterministycznie od lewej strony:

1. Dla bieżącej pozycji szuka najdłuższego słowa obecnego w słowniku.
2. Po znalezieniu słowa kontynuuje od pierwszej kolejnej litery.
3. Na pierwszym nierozpoznanym fragmencie kończy analizę. Dalsze litery nie
   punktują.
4. Jeśli od początku nie znaleziono żadnego słowa, wybiera pierwszą spośród
   liter o najwyższej wartości.

Przykłady:

- `KOTXYZ` rozpoznaje `KOT`;
- `KOTTOK` rozpoznaje `KOT` i `TOK`;
- `KOTXYZTOK` rozpoznaje tylko `KOT`;
- `XYZABSD` punktuje najwyżej wycenioną literę, a przy remisie pierwszą;
- jeżeli cały ciąg jest słowem, wygrywa całe słowo zamiast podziału na
  krótsze słowa.

Analizator będzie czystą funkcją niezależną od DOM, aby reguły dało się
sprawdzać bez uruchamiania przeglądarki.

## Punktowanie i stan rozgrywki

Każde rozpoznane słowo korzysta osobno z istniejącego `scoreWord` i kontekstu
karty językowej, zestawu liter, poprzedniego słowa oraz serii aliteracji.
Wyniki słów po zastosowaniu ulepszeń i utrudnień są sumowane, a suma trafia do
bieżącego wyniku wyzwania.

Efekt `Podwojenie` oraz utrudnienie dotyczące pierwszego poprawnego słowa
obejmują tylko pierwsze rozpoznane słowo. Poprzednim słowem po zagraniu staje
się ostatnie rozpoznane słowo. Statystyki słowne i odblokowania są
aktualizowane osobno dla każdego rozpoznanego słowa.

Zagranie bez słowa:

- otrzymuje punkty podstawowe najlepszej litery i mnożnik `×1`,
- korzysta z ulepszenia wartości liter i utrudnienia wyłączającego punkty
  samogłosek, jeżeli są aktywne,
- nie zużywa `Podwojenia`, nie zmienia poprzedniego słowa, serii aliteracji
  ani statystyk słownych.

Każde zagranie z co najmniej jedną wybraną literą jest dozwolone. Zużywa jedno
zagranie oraz wszystkie wybrane kafelki, również niepunktujące, po czym
uzupełnia rękę według obecnych reguł zestawu liter.

## Interfejs

Przycisk akcji będzie aktywny od jednej wybranej litery i otrzyma neutralną
etykietę „Zagraj litery”. Tekst pomocy wyjaśni, że punktują kolejne słowa od
lewej albo najlepsza litera.

Obecne wartości `playsLeft` i `discardsLeft` pozostają w karcie wyniku, lecz
etykiety zostaną zmienione na „pozostałe zagrania” i „pozostałe odrzucenia”.
Zasady w oknie dialogowym i README zostaną dostosowane do nowej mechaniki.

Komunikat po zagraniu poda rozpoznane słowa lub punktowaną literę oraz łączny
wynik. Istniejące zachowanie fokusu, `aria-live`, responsywność i motywy nie
ulegną zmianie.

## Obsługa błędów

Brak wpisu słownikowego nie jest błędem i nie blokuje zagrania. Błąd
wczytania całego pliku słownika zachowuje obecny ekran błędu danych.

Pusty wybór nie może zostać zagrany. Odrzucenie nadal wymaga co najmniej
jednej litery i dostępnego odrzucenia.

## Testy i kryterium ukończenia

- test danych potwierdza obecność `byk`, `byki`, `kot` i `tok`;
- testy analizatora obejmują wszystkie przykłady segmentacji i remis wartości
  liter;
- testy punktowania obejmują dwa słowa, końcowy nadmiar oraz zagranie bez
  słowa;
- test stanu potwierdza zużycie jednej próby przez każde niepuste zagranie;
- E2E potwierdza widoczne liczniki pozostałych akcji i możliwość zagrania
  jednej litery;
- pełne `npm test`, `npm run build`, `npm run test:e2e` oraz
  `git diff --check` kończą się bez błędów.
