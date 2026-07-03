// =====================================================================
//  KONFIGURACJA ŚRODOWISKA — jedyny plik różniący main (produkcję) od dev/test
// =====================================================================
// groupStats: true  → statystyki pod grupami (mediana, średnia, ciekawostki,
//                     macierz klub×grupa). Włączone na dev/test.
// Na produkcji (branch main) ten plik ma groupStats: false.
//
// Uwaga: znaczek 🌱 (debiutant) NIE zależy od tej flagi — pokazuje się wszędzie,
// dopóki wczytany jest ranking.js.
const CONFIG = { groupStats: true };
