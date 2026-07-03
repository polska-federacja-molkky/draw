// =====================================================================
//  KONFIGURACJA ŚRODOWISKA — jedyny plik różniący main (produkcję) od dev/test
// =====================================================================
// groupStats: false → PRODUKCJA. Bez statystyk pod grupami (mediana, średnia,
//                     ciekawostki, macierz). Zabawy z nimi robimy na dev/test.
//
// Uwaga: znaczek 🌱 (debiutant) NIE zależy od tej flagi — pokazuje się wszędzie,
// dopóki wczytany jest ranking.js.
const CONFIG = { groupStats: false };
