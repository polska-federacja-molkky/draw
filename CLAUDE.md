# PFM — Losowanie grup (Mölkky) — notatki dla Claude

Statyczna apka webowa (HTML/CSS/JS, GitHub Pages) do losowania grup turniejowych
Polskiej Federacji Mölkky. Repo: **polska-federacja-molkky/draw**.

## Gałęzie i deploy
- **main** = PRODUKCJA → `https://polska-federacja-molkky.github.io/draw/`
  (deploy-prod.yml publikuje root repo do gh-pages).
- **test-preview** = DEV/STAGING → `.../draw/test-preview/`
  (deploy-preview.yml kopiuje pliki do podkatalogu test-preview/).
- **claude/hopeful-feynman-XD7Hu** = gałąź robocza Claude; trzymana w sync z
  test-preview (ff-only po każdym commicie).
- Oba workflowy robią **cache-busting** `?v=<sha>` na skryptach/stylu, a
  `index.html` ma `<meta ... no-cache>`. Po pushu odświeżenie wchodzi zwykle bez
  twardego refreshu; gh-pages aktualizuje się ~30–60 s.

## ⚠️ NAJWAŻNIEJSZY INWARIANT
**main i test-preview różnią się WYŁĄCZNIE plikiem `config.js`.** Zawsze to
utrzymuj. `config.js` na main: `{ groupStats: false }`, na test: `true`.
Promocja na produkcję = nałóż drzewo z testu na main i ustaw `groupStats:false`:
```
git checkout main && git pull --ff-only origin main
git checkout test-preview -- .
# ustaw config.js na groupStats:false (nadpisz)
git add -A && git commit && git push origin main
```
Weryfikuj: `git diff main test-preview --stat` → ma pokazać tylko `config.js`.

## Pliki
- `index.html`, `style.css` — UI/wygląd.
- `draw.js` — cała logika (parsowanie, losowanie, wizualizacje, XLSX).
- `clubs.js` — dane klubów: `KOD: { name, logo? }`. Herby w `logos/<KOD>.png`
  (tło usunięte). Klucz = skrót WIELKIMI literami bez PL znaków (Oława→OLA);
  kod z listy jest normalizowany. Bez `logo` → szara tarcza z akronimem.
- `ranking.js` — AUTOGENEROWANE `Imię i nazwisko: SUMA_punktów`. Steruje
  znaczkiem debiutanta 🌱 (kto nie jest w rankingu) i statystykami.
- `config.js` — flaga `groupStats` (patrz wyżej).

## Flaga groupStats (config.js)
`true` włącza dolną część pod tabelą wyniku: mediana/średnia punktów per grupa,
pasek siły, ciekawostki (najbardziej/najmniej różnorodna, najwyższa/najniższa
mediana, najliczniejsze kluby), macierz klub×grupa. Te „bajery" są tylko na
dev/test. **Znaczek 🌱 NIE zależy od flagi** — pokazuje się wszędzie, gdy jest
`ranking.js`.

## Główne funkcje
- Tryby: z koszykami / bez; indywidualny / drużynowy.
- Losowanie grup: klik po kliku („Losuj dalej"), pulsujące następne pole,
  pop przy odsłonięciu, herb klubu po prawej, 🌱 przy nazwie debiutanta.
- Tryb pełnoekranowy (prezentacja), animacje (reduced-motion-aware).
- Eksport XLSX (samodzielny generator ZIP/XML, bez bibliotek).
- **Przydział do koszyków** (pre-losowanie przy remisach punktowych):
  - Główne okno: `KOSZYK N` + gracz/klub; **puste wiersze = puste miejsca**.
  - Checkbox pokazuje drugie okno: bloki `KOSZYK a/b/c` (pula do rozlosowania).
  - `resolveBasketAssignment()` = **dopasowanie dwudzielne (Kuhn)** — każda osoba
    z bloku trafia do pustego miejsca w jednym ze swoich koszyków (kluczowe, gdy
    koszyk jest w kilku blokach, np. K4 w „3/4" i „4/5"). Losowość przez tasowanie.
  - Wizualizacja klik po kliku (osobna faza), panel pul nad tabelą, niewypełniane
    sloty wyszarzone (kreskówka), druga zakładka w XLSX „Przydział do koszyków".
  - **Ostatni koszyk musi kończyć się wpisami (X / Gracz N), nie samymi pustymi
    wierszami** — końcowe puste ostatniego koszyka są przycinane jako kosmetyka.

## Aktualizacja rankingu
Użytkownik wgrywa XLSX z rankingiem (wiele zakładek, nazwane po dacie DD.MM.RRRR).
Bierz **najnowszą zakładkę po dacie**, kolumny `Imię i nazwisko` + `SUMA`:
```python
import openpyxl, datetime, re
wb = openpyxl.load_workbook(PATH, data_only=True, read_only=True)
# newest = max sheet po dacie z nazwy; parsuj naglowek, wyciagnij name+SUMA
```
Zapisz do `ranking.js` jako `const RANKING = { "Imię Nazwisko": pkt, ... }`.
Wgraj na test I main (plik identyczny).

## Dodanie klubu / herbu
1. `clubs.js`: `KOD: { name: "Pełna nazwa" }` (placeholder) lub z `logo:`.
2. Herb: użytkownik wgrywa plik (upload), Ty: usuń tło (Pillow flood-fill od
   narożników), przytnij, zapisz `logos/KOD.png`, dodaj `logo` w clubs.js.
   Wgraj na test I main.

## Konwencje / pułapki
- **Obrazki wklejone do CZATU nie docierają na dysk. Pliki UPLOADOWANE tak** —
  szukaj w `/root/.claude/uploads/<sesja>/`.
- **Google Sheets NIE pobierzesz** (egress allowlista blokuje docs.google.com;
  WebFetch dostaje 403). Ranking przychodzi jako uploadowany XLSX.
- **Commit messages**: bez nawiasów/cudzysłowów (psują shell w heredoc) —
  czysty ASCII, przez `-F plik`. Dodawaj trailery Co-Authored-By + Claude-Session.
- **Podgląd wizualny**: headless chromium do zrzutów:
  `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell
   --headless --disable-gpu --no-sandbox --force-device-scale-factor=2
   --window-size=W,H --screenshot=out.png file://.../plik.html`.
  Testy interaktywne: `playwright-core` (executablePath = ten headless_shell).
- **Narzędzia**: `pip install openpyxl Pillow`, `npm i playwright-core`
  (PyPI/npm są na allowliście; docs.google/molkky.pl NIE).
- Po każdej zmianie: commit → push test-preview → ff working branch → (jeśli na
  prod) nałóż na main z `groupStats:false`. Weryfikuj gh-pages.

## Model
Sesje tej apki mają w `.claude/settings.json` ustawiony `model: claude-opus-4-8`
(subagenty dziedziczą model sesji).
