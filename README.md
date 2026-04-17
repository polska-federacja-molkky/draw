# Losowanie grup – Polska Federacja Mölkky

To prosta aplikacja webowa służąca do przeprowadzania losowań grup podczas turniejów organizowanych przez Polską Federację Mölkky.

#### Funkcje:
- Losowanie zawodników do grup na podstawie wprowadzonego seeda (hasła) i "koszyków".
- Zachowanie powtarzalności losowania dzięki zapisowi seeda i "soli", umożliwiając audyt i odtworzenie wyników.
- Eksport wyników do Excela (TSV) oraz logu przebiegu losowania.
- Prosty interfejs użytkownika całkowicie w przeglądarce – **nie wymaga serwera**.
- Formularze dla kluczowych parametrów: seed, liczba grup, dane wejściowe.
- Przyciski umożliwiające powtarzanie i przechodzenie krok po kroku.

#### Podgląd działania:
- Wersja produkcyjna dostępna na:  
  [https://polska-federacja-molkky.github.io/draw/](https://polska-federacja-molkky.github.io/draw/)

- Podgląd zmian deweloperskich:  
  [https://polska-federacja-molkky.github.io/draw/test-preview/](https://polska-federacja-molkky.github.io/draw/test-preview/)

---

**Jak korzystać:**
1. Wklej zawodników w odpowiednim formacie z Excela do pola "Koszyki".
2. Ustaw seed (np. nazwę wydarzenia).
3. Wybierz liczbę grup.
4. Kliknij „Start / Reset”, a następnie prowadź losowanie.
5. Wyniki możesz skopiować lub wyeksportować.

---

Aplikacja działa na czystym HTML + JS + CSS, nie wymaga backendu ani instalacji narzędzi. 
 
