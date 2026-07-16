// ======================
// MODE UI
// ======================
function basketsEnabled() {
  return document.getElementById("basketsOff")?.checked !== true;
}

function updateModeUI() {
  const teamMode = document.getElementById("modeTeam")?.checked === true;
  const useBaskets = basketsEnabled();

  const lbl = document.getElementById("inputLabel");
  if (lbl) {
    if (useBaskets) lbl.textContent = "Koszyki (do wklejenia z Excela):";
    else lbl.textContent = teamMode
      ? "Lista drużyn (do wklejenia z Excela):"
      : "Lista zawodników (do wklejenia z Excela):";
  }

  const offDesc = document.getElementById("basketsOffDesc");
  if (offDesc) offDesc.textContent = teamMode ? "Sama lista drużyn" : "Sama lista nazwisk";

  const hint = document.getElementById("flatHint");
  if (hint) hint.hidden = useBaskets;

  refreshUI();
}


// ======================
// deterministic RNG
// ======================
function createSeededRandom(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ======================
// helpers
// ======================
function groupLabel(i) {
  const s = excelLetters(i);
  return `Grupa ${s}`;
}

// Excel-like column name: A..Z, AA..AZ, BA...
function excelLetters(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cryptoRandomInt() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  } catch {
    return Math.floor(Math.random() * 1e9);
  }
}

// ======================
// parsing excel paste
// ======================
// Placeholder = wpis "Gracz <numer>" (np. "Gracz 47"), losowany dopiero w ostatniej rundzie
function isPlaceholderLine(s) {
  return /^gracz\s*\d+$/i.test(s.trim());
}

// Ręczny znacznik pustego miejsca w koszyku — pojedyncze "X".
// Bierze udział w losowaniu (zajmuje slot), ale nie jest realnym uczestnikiem,
// więc nie wlicza się do liczby uczestników.
function isEmptyMarker(name) {
  return typeof name === "string" && name.trim().toLowerCase() === "x";
}

// ======================
// HERBY KLUBÓW (tylko wyświetlanie — eksport/kopiowanie dalej używa skrótów)
// ======================
// Dane klubów (nazwy + herby) są w osobnym pliku clubs.js (ładowanym przed
// draw.js), jako globalna stała CLUBS. Tu jest tylko logika.
// Klucz = znormalizowany skrót: wielkie litery, Ł→L, bez diakrytyków — żeby
// dopasować niezależnie od tego, jak klub wpisano na liście (np. "OŁA"/"OLA").
const CLUB_DATA = (typeof CLUBS !== "undefined") ? CLUBS : {};

function clubKey(s) {
  return (s || "").trim().toUpperCase()
    .replace(/Ł/g, "L")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Szary herb-placeholder z akronimem klubu — dla klubów bez logotypu.
// Zwraca element DOM (używane też z onerror <img>, gdy pliku herbu brakło).
function makeClubPlaceholder(acr, title) {
  const s = document.createElement("span");
  s.className = "clubLogo clubLogo--empty";
  s.title = title || acr || "";
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", title || acr || "");
  const t = document.createElement("span");
  t.className = "clubAcr";
  t.textContent = acr || "";
  s.appendChild(t);
  return s;
}

function placeholderHtml(acr, title) {
  return `<span class="clubLogo clubLogo--empty" title="${escapeHtml(title)}"` +
    ` role="img" aria-label="${escapeHtml(title)}">` +
    `<span class="clubAcr">${escapeHtml(acr)}</span></span>`;
}

// Zwraca HTML odznaki klubu do komórki wyniku:
//  • brak klubu ("-")         → nic
//  • klub z herbem            → <img> (fallback na placeholder, gdy pliku brak)
//  • klub bez herbu / nieznany → szara tarcza z 3-literowym akronimem
function clubBadge(club) {
  if (!club || club === "-") return "";
  const raw = club.trim();
  const acr = raw.toUpperCase();
  const info = CLUB_DATA[clubKey(raw)];
  const title = info ? info.name : raw;
  if (info && info.logo) {
    return `<img class="clubLogo" src="${escapeHtml(info.logo)}" alt="${escapeHtml(acr)}"` +
      ` title="${escapeHtml(title)}" loading="lazy" data-acr="${escapeHtml(acr)}"` +
      ` onerror="this.replaceWith(makeClubPlaceholder(this.dataset.acr, this.title))">`;
  }
  return placeholderHtml(acr, title);
}

// ======================
// RANKING PUNKTOWY (dane w ranking.js jako globalna stała RANKING)
// ======================
// Dwa niezależne przełączniki:
//  • RANKING_PRESENT — czy jest ranking (→ znaczek 🌱 dla debiutantów). Na obu środowiskach.
//  • SHOW_GROUP_STATS — statystyki pod grupami (mediana/średnia/ciekawostki/macierz).
//    Sterowane z config.js (test/dev: true, produkcja: false) — jedyna różnica między branchami.
const RANKING_DATA = (typeof RANKING !== "undefined") ? RANKING : {};
const RANKING_PRESENT = (typeof RANKING !== "undefined");
const SHOW_GROUP_STATS = (typeof CONFIG !== "undefined" && CONFIG.groupStats === true);
function rankKey(s) {
  return (s || "").trim().toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}
const RANKING_NORM = {};
for (const name in RANKING_DATA) RANKING_NORM[rankKey(name)] = RANKING_DATA[name];

// Zwraca {points, ranked} dla realnego zawodnika; null dla placeholderów/„X"/pustych.
// Brak w rankingu → {points: 0, ranked: false} (liczy się jako 0, dostaje 🌱).
function playerPoints(name) {
  const t = (name || "").trim();
  if (!t || t === "—" || isPlaceholderLine(t) || isEmptyMarker(t)) return null;
  const key = rankKey(t);
  if (key in RANKING_NORM) return { points: RANKING_NORM[key], ranked: true };
  return { points: 0, ranked: false };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length, m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Renderuje zawartość komórki: imię/nazwisko w bloku po lewej, herb klubu
// po prawej stronie. Rozbicie nazwiska na osobny wiersz daje większą czcionkę,
// a herb obok nie zabiera pionu. Debiutant (brak w rankingu) dostaje 🌱.
function cellMarkup(name, club) {
  const isEmpty = (name === "—" && club === "—");
  if (isEmpty) {
    return `<div class="cell empty"><div class="cellName"><span class="firstName">—</span></div></div>`;
  }
  const trimmed = (name || "").trim();
  const sp = trimmed.indexOf(" ");
  const first = sp > 0 ? trimmed.slice(0, sp) : trimmed;
  const last  = sp > 0 ? trimmed.slice(sp + 1) : "";
  // Listek 🌱 przy debiutancie — tuż przy nazwie (nie przy herbie); spacer
  // wypycha herb do prawej krawędzi.
  const info = RANKING_PRESENT ? playerPoints(trimmed) : null;
  const rookie = (info && !info.ranked)
    ? `<span class="rookieDot" title="Debiutant — brak w rankingu">🌱</span>` : "";
  const firstHtml = escapeHtml(first);
  const lastHtml  = escapeHtml(last);
  const nameBlock = last
    ? `<span class="firstName">${firstHtml}</span><span class="lastName">${lastHtml}</span>`
    : `<span class="firstName">${firstHtml}</span>`;
  return `<div class="cell filled"><div class="cellName">${nameBlock}</div>` +
    rookie + `<span class="cellGap"></span>` + clubBadge(club) + `</div>`;
}

// Auto-dopasowanie: długie imię/nazwisko zmniejsza czcionkę, aż zmieści się
// w jednej linii — dzięki temu każdy wpis mieści się w 2 rzędach, a krótkie
// nazwy zostają duże. Herb po prawej zabiera szerokość, więc bez tego
// najdłuższe nazwiska łamią się na 3 linie.
const NAME_FONT_MAX = 18, NAME_FONT_MIN = 11;
function fitName(span) {
  if (!span || !span.textContent) return;
  span.style.fontSize = "";                 // reset do domyślnych 18px
  // Łamanie tylko na myślniku/spacji (CSS). Dopóki tekst wystaje poza szerokość
  // komórki, zmniejszaj czcionkę: pojedyncze słowa trafiają do jednej linii,
  // człony z myślnikiem łamią się i mieszczą bez najeżdżania na herb.
  let fs = NAME_FONT_MAX, guard = 0;
  while (fs > NAME_FONT_MIN && span.scrollWidth > span.clientWidth + 1 && guard < 12) {
    fs -= 1;
    span.style.fontSize = fs + "px";
    guard++;
  }
}
function fitCell(cell) {
  if (!cell) return;
  const first = cell.querySelector(".firstName");
  const last = cell.querySelector(".lastName");
  fitName(first); fitName(last);
  // Ujednolicenie: gdy nazwisko musiało się zmniejszyć, imię również — obie
  // linie do wspólnego (mniejszego) rozmiaru, żeby nie było dysproporcji.
  if (first && last) {
    const fs = parseFloat(getComputedStyle(first).fontSize) || NAME_FONT_MAX;
    const ls = parseFloat(getComputedStyle(last).fontSize) || NAME_FONT_MAX;
    const m = Math.min(fs, ls);
    first.style.fontSize = m + "px";
    last.style.fontSize = m + "px";
  }
}
function fitAllCells() {
  document.querySelectorAll(".resultTable td .cell").forEach(fitCell);
}

// ======================
// TRYB PEŁNOEKRANOWY / PREZENTACJA (do rzutnika na sali)
// ======================
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
}

function onFullscreenChange() {
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  document.body.classList.toggle("presenting", on);
  const b = document.getElementById("btnFullscreen");
  if (b) b.textContent = on ? "⛶ Zamknij pełny ekran" : "⛶ Pełny ekran";
  fitAllCells();   // układ się zmienił — przelicz dopasowanie nazw
}

// ======================
// PRZYDZIAŁ DO KOSZYKÓW (pre-losowanie przy konfliktach punktowych)
// ======================
// Gdy nie da się jednoznacznie przypisać do koszyków (remis punktowy):
//  • główne okno — tradycyjne dwie kolumny (KOSZYK N + gracz/klub), a PUSTE
//    WIERSZE w koszyku to miejsca do obsadzenia,
//  • drugie okno (pojawia się po zaznaczeniu checkboxa) — bloki „KOSZYK a/b/c"
//    z pulą osób do rozlosowania między wskazane koszyki.
function bgLine(line) {
  // "Nazwa\tKLUB" (Excel) lub "Nazwa  KLUB" (2+ spacje); bez klubu → "-"
  const t = line.replace(/\t+$/, "");
  if (t.includes("\t")) {
    const p = t.split(/\t+/).map(x => x.trim());
    return { name: p[0] || "", club: p[1] || "-" };
  }
  const p = t.trim().split(/\s{2,}/);
  if (p.length >= 2) return { name: p[0].trim(), club: p[1].trim() || "-" };
  return { name: t.trim(), club: "-" };
}
function bgHeaderNums(line) { return (line.match(/\d+/g) || []).map(Number); }

// Główne okno → koszyki ze slotami (puste wiersze = puste miejsca).
// Uwaga: ostatni koszyk powinien kończyć się wpisami (X / Gracz N), nie samymi
// pustymi wierszami — końcowe puste ostatniego koszyka są przycinane jako kosmetyka.
function bgParseMainSlots(text) {
  const lines = text.replace(/[\s﻿]+$/, "").split(/\r?\n/);
  const mainByNum = {}; let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^KOSZYK\b/i.test(line)) {
      const n = bgHeaderNums(line)[0];
      cur = mainByNum[n] = { num: n, slots: [] };
      continue;
    }
    if (!cur) continue;                    // śmieci przed pierwszym nagłówkiem
    if (!line) { cur.slots.push({ empty: true }); continue; }
    const p = bgLine(raw);
    cur.slots.push({ name: p.name, club: p.club });
  }
  const nums = Object.keys(mainByNum).map(Number);
  if (nums.length) {
    const last = mainByNum[Math.max(...nums)];
    while (last.slots.length && last.slots[last.slots.length - 1].empty) last.slots.pop();
  }
  return mainByNum;
}

// Drugie okno → pule konfliktowe [{label, baskets, players}]; puste wiersze pomijane.
function bgParseConflictPools(text, mainByNum) {
  const pools = []; let cur = null;
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^KOSZYK\b/i.test(line)) {
      const nums = bgHeaderNums(line);
      cur = { label: line, baskets: nums, players: [] };
      pools.push(cur);
      continue;
    }
    if (!cur) continue;
    const p = bgLine(raw);
    if (p.name) cur.players.push({ name: p.name, club: p.club });
  }
  if (mainByNum) for (const p of pools) p.baskets = p.baskets.filter(n => mainByNum[n]);
  return pools.filter(p => p.players.length || p.baskets.length);
}

// Zwraca null, jeśli brak puli; inaczej {text, steps, warnings}.
// Przydział jako DOPASOWANIE DWUDZIELNE (algorytm Kuhna): każda osoba z bloku
// musi trafić do pustego miejsca w JEDNYM z jej koszyków. Kluczowe, gdy koszyk
// jest w kilku blokach (np. K4 w „3/4" i „4/5") — zachłanne wypełnianie
// potrafiło zostawić kogoś bez miejsca. Matching gwarantuje obsadzenie
// wszystkich (o ile układ jest wykonalny) i losuje przez tasowanie sąsiedztw.
function resolveBasketAssignment(mainText, conflictText) {
  const mainByNum = bgParseMainSlots(mainText);
  const pools = bgParseConflictPools(conflictText, mainByNum);
  if (!pools.length) return null;

  const rnd = createSeededRandom(`${new Date().toISOString()}-${cryptoRandomInt()}`);

  // Sloty (puste miejsca) po numerze koszyka + gracze z dozwolonymi koszykami.
  const slots = [];
  for (const n of Object.keys(mainByNum).map(Number).sort((a, b) => a - b))
    for (const s of mainByNum[n].slots) if (s.empty) slots.push({ basket: n, ref: s });
  const players = [];
  pools.forEach((p, poolIdx) => {
    for (const pl of p.players) players.push({ name: pl.name, club: pl.club, baskets: p.baskets, poolIdx });
  });

  // Sąsiedztwo gracz→sloty (tasowane dla losowości); kolejność graczy też tasowana.
  const adj = players.map(pl => {
    const a = [];
    for (let si = 0; si < slots.length; si++) if (pl.baskets.includes(slots[si].basket)) a.push(si);
    shuffle(a, rnd);
    return a;
  });
  const order = players.map((_, i) => i);
  shuffle(order, rnd);

  const slotMatch = new Array(slots.length).fill(-1);   // slot → gracz
  function augment(p, seen) {
    for (const si of adj[p]) {
      if (seen[si]) continue;
      seen[si] = true;
      if (slotMatch[si] === -1 || augment(slotMatch[si], seen)) { slotMatch[si] = p; return true; }
    }
    return false;
  }
  const placed = new Array(players.length).fill(false);
  for (const p of order) if (augment(p, new Array(slots.length).fill(false))) placed[p] = true;

  // Odsłanianie i pakowanie do slotów: BLOK po BLOKU (kolejność z drugiego okna),
  // a w obrębie bloku KOSZYK po KOSZYKU rosnąco — najpierw cały niższy koszyk, potem
  // wyższy. Kolejność OSÓB w obrębie koszyka jest LOSOWA (tasujemy przed stabilnym
  // sortem po numerze koszyka), żeby koszyk zapełniał się jak losowanie, a nie w
  // kolejności z listy. Osobę wstawiamy w NAJWCZEŚNIEJSZE wolne miejsce jej koszyka.
  // Dzięki temu blok „5/6/7": najpierw losuje się cały koszyk 5, potem z pozostałych
  // cały 6, na końcu reszta do 7. Blok „4/5" (2 os.): osoba do 4 zawsze przed osobą
  // do 5 (niższy koszyk pierwszy). Który koszyk dostaje kogo — rozstrzyga globalne
  // dopasowanie Kuhna (uczciwe, w proporcji do pojemności); tu tylko układamy przypisanych
  // w sloty i ustalamy kolejność animacji.
  const playerBasket = new Array(players.length).fill(-1);
  for (let si = 0; si < slots.length; si++)
    if (slotMatch[si] !== -1) playerBasket[slotMatch[si]] = slots[si].basket;

  const freeByBasket = {};                 // koszyk → lista wolnych slotów w kolejności
  for (const sl of slots) (freeByBasket[sl.basket] ||= []).push(sl.ref);

  const steps = [], warnings = [];
  const byPool = pools.map(() => []);
  players.forEach((pl, i) => { if (playerBasket[i] !== -1) byPool[pl.poolIdx].push(i); });
  for (const group of byPool) {
    shuffle(group, rnd);                                       // losowa kolejność osób...
    group.sort((a, b) => playerBasket[a] - playerBasket[b]);   // ...stabilnie rosnąco po koszyku
    for (const i of group) {
      const pl = players[i], basket = playerBasket[i];
      const s = freeByBasket[basket].shift();                  // najwcześniejsze wolne miejsce
      s.name = pl.name; s.club = pl.club; s.empty = false; s.conflict = true;
      steps.push({ name: pl.name, club: pl.club, basket });
    }
  }
  const unplaced = players.filter((_, i) => !placed[i]);
  if (unplaced.length) warnings.push(`${unplaced.length} os. bez miejsca (układ niewykonalny): ${unplaced.slice(0, 6).map(p => p.name).join(", ")}${unplaced.length > 6 ? " …" : ""}.`);
  const openSlots = slotMatch.filter(m => m === -1).length;
  if (openSlots) warnings.push(`${openSlots} pustych miejsc bez kandydata.`);

  const nums = Object.keys(mainByNum).map(Number).sort((a, b) => a - b);
  let out = "";
  for (const n of nums) {
    out += `KOSZYK ${n}\n`;
    for (const s of mainByNum[n].slots) if (!s.empty) out += `${s.name}\t${s.club}\n`;
  }
  return { text: out.replace(/\n+$/, "") + "\n", steps, warnings };
}

// Wynik ostatniego przydziału do koszyków — trafia do eksportu XLSX (osobna zakładka).
let lastBasketAssignment = null;

// Pokaż/schowaj drugie okno (koszyki konfliktowe) zależnie od checkboxa.
function updateConflictUI() {
  const on = document.getElementById("preAssignBaskets")?.checked === true;
  const col = document.getElementById("conflictCol");
  if (col) col.hidden = !on;
}

// Widoczny wynik pierwszego losowania (przydział do koszyków), grupowany per koszyk.
function renderBasketAssignPanel() {
  const panel = document.getElementById("basketAssignPanel");
  if (!panel) return;
  if (!lastBasketAssignment || !lastBasketAssignment.steps.length) {
    panel.hidden = true; panel.innerHTML = ""; return;
  }
  const byBasket = {};
  for (const s of lastBasketAssignment.steps) (byBasket[s.basket] ||= []).push(s);
  let html = `<div class="bapTitle">Wynik losowania przydziału do koszyków (${lastBasketAssignment.steps.length} os.)</div>`;
  for (const n of Object.keys(byBasket).map(Number).sort((a, b) => a - b)) {
    const who = byBasket[n].map(s => `${escapeHtml(s.name)}${s.club && s.club !== "-" ? ` <span class="bapClub">${escapeHtml(s.club)}</span>` : ""}`).join(", ");
    html += `<div class="bapRow"><b>Koszyk ${n}</b> ← ${who}</div>`;
  }
  panel.innerHTML = html;
  panel.hidden = false;
}

// ======================
// LOSOWANIE PRZYDZIAŁU DO KOSZYKÓW — klik po kliku, z wizualizacją
// ======================
let BASKET = { active: false, steps: [], idx: 0, finalText: "", warnings: [] };

function basketPhaseActive() { return BASKET.active === true; }

// Buduje tabelę wizualizacji: kolumny = koszyki docelowe, wiersze = miejsca.
function buildBasketVizTable() {
  const wrap = document.getElementById("tableWrap");
  if (!wrap) return;
  const byBasket = {};
  BASKET.steps.forEach((s, i) => { (byBasket[s.basket] ||= []).push(i); });
  const baskets = Object.keys(byBasket).map(Number).sort((a, b) => a - b);
  const maxRows = Math.max(1, ...baskets.map(n => byBasket[n].length));

  const table = document.createElement("table");
  table.className = "resultTable basketViz";
  const colgroup = document.createElement("colgroup");
  const c0 = document.createElement("col"); c0.style.width = "64px"; colgroup.appendChild(c0);
  baskets.forEach(() => { const c = document.createElement("col"); c.style.width = "200px"; colgroup.appendChild(c); });
  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  const th0 = document.createElement("th"); th0.textContent = "Miejsce"; trh.appendChild(th0);
  baskets.forEach(n => { const th = document.createElement("th"); th.textContent = `Koszyk ${n}`; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let r = 0; r < maxRows; r++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.textContent = r + 1; tr.appendChild(th);
    baskets.forEach(n => {
      const td = document.createElement("td");
      const stepIdx = byBasket[n][r];
      if (stepIdx == null) { td.className = "vizNA"; }
      else {
        td.id = `bviz-${stepIdx}`;
        td.innerHTML = `<div class="cell empty"><div class="cellName"><span class="firstName">—</span></div></div>`;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  // Panel pul konfliktowych (kto w którym bloku) — nad tabelą wyniku.
  let poolsHtml = "";
  if (BASKET.poolsView && BASKET.poolsView.length) {
    poolsHtml = `<div class="poolsPanel"><div class="poolsTitle">Bloki konfliktowe — do rozlosowania:</div>`;
    for (const p of BASKET.poolsView) {
      const who = p.players.map(pl => escapeHtml(pl.name)).join(", ");
      poolsHtml += `<div class="poolRow"><b>${escapeHtml(p.label)}</b> <span class="poolCount">(${p.players.length})</span> — ${who}</div>`;
    }
    poolsHtml += `</div>`;
  }

  wrap.innerHTML = poolsHtml;
  const center = document.createElement("div");
  center.className = "basketCenter";
  center.appendChild(table);
  wrap.appendChild(center);
}

function highlightNextBasketCell() {
  document.querySelectorAll(".basketViz td.nextCell").forEach(td => td.classList.remove("nextCell"));
  if (BASKET.idx >= BASKET.steps.length) return;
  const cell = document.getElementById(`bviz-${BASKET.idx}`);
  if (cell) cell.classList.add("nextCell");
}

// Start fazy przydziału (po zaznaczonym checkboxie i przejściu walidacji).
function startBasketAssignment(mainText, conflictText) {
  const res = resolveBasketAssignment(mainText, conflictText);
  if (!res) {
    setStatus("idle", "Wklej bloki KOSZYK a/b/c w drugie okno — albo odznacz checkbox, by losować grupy.");
    return false;
  }
  // Odsłanianie BLOK po BLOKU (kolejność jak w drugim oknie), a w obrębie bloku
  // rosnąco po numerze koszyka — kolejność ustalona już w resolveBasketAssignment.
  const steps = res.steps.slice();
  const mainByNum = bgParseMainSlots(mainText);
  const poolsView = bgParseConflictPools(conflictText, mainByNum)
    .map(p => ({ label: p.label, players: p.players.slice() }));
  BASKET = { active: true, steps, idx: 0, finalText: res.text, warnings: res.warnings, poolsView };
  const setup = document.getElementById("setup"); if (setup) setup.open = false;
  buildBasketVizTable();
  highlightNextBasketCell();
  refreshUI();
  return true;
}

function basketNextStep() {
  if (!BASKET.active) return;
  if (BASKET.idx >= BASKET.steps.length) { finishBasketAssignment(); return; }
  const s = BASKET.steps[BASKET.idx];
  const cell = document.getElementById(`bviz-${BASKET.idx}`);
  if (cell) {
    document.querySelectorAll(".basketViz td.justDrawn").forEach(t => t.classList.remove("justDrawn"));
    cell.innerHTML = cellMarkup(s.name, s.club);
    fitCell(cell.querySelector(".cell"));
    void cell.offsetWidth;
    cell.classList.add("justDrawn");
  }
  BASKET.idx++;
  highlightNextBasketCell();
  // Po ostatnim odsłonięciu NIE kończymy od razu — zostawiamy chwilę na podgląd
  // całości; dopiero kolejny klik („Zakończ przydział") finalizuje.
  refreshUI();
}

function finishBasketAssignment() {
  const inputEl = document.getElementById("input");
  if (inputEl) inputEl.value = BASKET.finalText;
  lastBasketAssignment = {
    steps: BASKET.steps.map(s => ({ basket: s.basket, name: s.name, club: s.club })),
    at: new Date().toISOString()
  };
  const warn = BASKET.warnings.length ? " ⚠ " + BASKET.warnings.join(" ") : "";
  BASKET = { active: false, steps: [], idx: 0, finalText: "", warnings: [] };
  const pre = document.getElementById("preAssignBaskets"); if (pre) pre.checked = false;
  updateConflictUI();
  renderBasketAssignPanel();
  const wrap = document.getElementById("tableWrap"); if (wrap) wrap.innerHTML = "";
  setTablePlaceholder();
  renderValidation();
  refreshUI();
  setStatus("idle", `Przydział do koszyków gotowy. Kliknij „Rozpocznij losowanie", aby losować grupy.${warn}`);
}

function cancelBasketAssignment() {
  BASKET = { active: false, steps: [], idx: 0, finalText: "", warnings: [] };
  const wrap = document.getElementById("tableWrap"); if (wrap) wrap.innerHTML = "";
  setTablePlaceholder();
  refreshUI();
  setStatus("idle", "Przerwano przydział do koszyków.");
}

function parseInput(text, teamMode, useBaskets = true) {
  const lines = text.split(/\r?\n/);
  const baskets = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNo = i + 1;
    if (!line) continue;

    if (/^KOSZYK\b/i.test(line)) {
      // Bez koszyków: pomijamy nagłówki KOSZYK, wszyscy trafiają do jednej puli
      if (!useBaskets) continue;
      const num = (line.match(/\d+/) || ["?"])[0];
      current = { label: `Koszyk ${num}`, players: [] };
      baskets.push(current);
      continue;
    }

    if (!current) {
      current = { label: useBaskets ? "Koszyk 1" : "Lista", players: [] };
      baskets.push(current);
    }

    // Placeholder "Gracz N" — normalizujemy nazwę i oznaczamy flagą
    if (isPlaceholderLine(line)) {
      const num = (line.match(/\d+/) || [""])[0];
      current.players.push({ name: `Gracz ${num}`, club: "", placeholder: true, line: lineNo });
      continue;
    }

    // Tryb drużynowy: cała linia = nazwa drużyny, brak klubu
    if (teamMode) {
      current.players.push({ name: line, club: "", line: lineNo });
      continue;
    }

    // Tryb indywidualny: wykrywanie klubu
    let name = line;
    let club = "-";

    if (line.includes("\t")) {
      const parts = line.split(/\t+/).map(x => x.trim()).filter(Boolean);
      name = parts[0] || "";
      club = parts[1] || "-";
    } else {
      const parts = line.split(/\s{2,}/).map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        name = parts[0];
        club = parts[1];
      } else {
        const tokens = line.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2 && tokens[tokens.length - 1].length <= 5) {
          club = tokens.pop();
          name = tokens.join(" ");
        }
      }
    }

    current.players.push({ name, club, line: lineNo });
  }

  return baskets;
}

// ======================
// WALIDACJA DANYCH WEJŚCIOWYCH (inline, nieblokująca prócz błędów krytycznych)
// ======================
function plural(n, forms) {
  if (n === 1) return forms[0];
  const m10 = n % 10, m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return forms[1];
  return forms[2];
}

// Walidacja w trybie „najpierw przydział do koszyków": główne okno z pustymi
// wierszami + drugie okno z blokami. Initial check: pula musi się zgadzać
// z liczbą pustych miejsc (błąd blokujący, żeby nie rozlosować źle).
function validatePreAssign(mainText, conflictText, groupCount) {
  const result = { empty: !mainText, counts: null, warnings: [], errors: [] };
  if (!mainText) return result;
  const mainByNum = bgParseMainSlots(mainText);
  const pools = bgParseConflictPools(conflictText, mainByNum);
  let mainReal = 0, empties = 0;
  const emptyPer = [];
  for (const n of Object.keys(mainByNum).map(Number).sort((a, b) => a - b)) {
    let e = 0;
    for (const s of mainByNum[n].slots) {
      if (s.empty) { empties++; e++; }
      else if (!isPlaceholderLine(s.name) && !isEmptyMarker(s.name)) mainReal++;
    }
    if (e) emptyPer.push(`K${n}:${e}`);
  }
  const pool = pools.reduce((a, p) => a + p.players.length, 0);
  const total = mainReal + pool;
  const parts = [`${total} ${plural(total, ["uczestnik", "uczestnicy", "uczestników"])}`];
  if (pools.length) parts.push(`${pool} do rozlosowania w ${pools.length} ${plural(pools.length, ["bloku", "blokach", "blokach"])}`);
  if (empties) parts.push(`${empties} pustych miejsc (${emptyPer.join(", ")})`);
  result.counts = parts.join(" · ");
  if (!groupCount || groupCount < 2) result.errors.push("Podaj liczbę grup (min. 2).");
  if (!pools.length) {
    result.warnings.push("Wklej bloki KOSZYK a/b/c w drugie okno — albo odznacz checkbox, by losować grupy.");
  } else if (pool !== empties) {
    result.errors.push(`Nie zgadza się: ${pool} os. do rozlosowania vs ${empties} pustych miejsc. Wyrównaj przed losowaniem.`);
  }
  // koszyki wskazane w blokach, których nie ma w głównym oknie
  for (const p of pools) {
    const missing = bgHeaderNums(p.label).filter(n => !mainByNum[n]);
    if (missing.length) result.warnings.push(`Blok „${p.label}" wskazuje koszyki spoza głównego okna: ${missing.join(", ")}.`);
  }
  return result;
}

function validateInput() {
  const text = document.getElementById("input")?.value.trim() ?? "";
  const teamMode = document.getElementById("modeTeam")?.checked === true;
  const useBaskets = basketsEnabled();
  const groupCount = parseInt(document.getElementById("groupCount")?.value, 10);

  // Tryb pre-losowania przydziału do koszyków — inna, świadoma konfliktów walidacja.
  if (document.getElementById("preAssignBaskets")?.checked === true) {
    const conflictText = document.getElementById("conflictInput")?.value ?? "";
    return validatePreAssign(text, conflictText, groupCount);
  }

  const result = { empty: !text, counts: null, warnings: [], errors: [] };
  if (!text) return result;

  const parsed = parseInput(text, teamMode, useBaskets);
  const players = parsed.flatMap(b => b.players);
  const reals = players.filter(p => !p.placeholder);
  // "X" zajmuje slot w koszyku, ale nie jest uczestnikiem — pomijamy w liczniku.
  const counted = reals.filter(p => !isEmptyMarker(p.name));
  const unit = teamMode ? ["drużyna", "drużyny", "drużyn"] : ["uczestnik", "uczestnicy", "uczestników"];

  // liczniki
  const clubs = teamMode ? [] : [...new Set(counted.map(p => p.club).filter(c => c && c !== "-"))];
  const parts = [`${counted.length} ${plural(counted.length, unit)}`];
  if (useBaskets) parts.push(`${parsed.length} ${plural(parsed.length, ["koszyk", "koszyki", "koszyków"])}`);
  if (groupCount >= 2) parts.push(`${groupCount} ${plural(groupCount, ["grupa", "grupy", "grup"])}`);
  if (!teamMode && clubs.length) parts.push(`${clubs.length} ${plural(clubs.length, ["klub", "kluby", "klubów"])}`);
  result.counts = parts.join(" · ");

  // błędy krytyczne (blokują start)
  if (!groupCount || groupCount < 2) {
    result.errors.push("Podaj liczbę grup (min. 2).");
  }
  if (!reals.length) {
    result.errors.push(teamMode ? "Brak drużyn na liście." : "Brak uczestników na liście.");
  }
  if (useBaskets && groupCount >= 2) {
    parsed
      .filter(b => b.players.length > groupCount)
      .forEach(b => result.errors.push(
        `${b.label} ma więcej osób (${b.players.length}) niż grup (${groupCount}). Zmniejsz koszyk lub zwiększ liczbę grup.`
      ));
  }

  // ostrzeżenia (pozwalają losować)
  // Duplikaty — pomijamy placeholdery "X" (ręczne znaczniki pustych miejsc)
  const seen = new Map();
  for (const p of reals) {
    const key = p.name.trim().toLowerCase();
    if (!key || key === "x") continue;
    if (!seen.has(key)) seen.set(key, { name: p.name.trim(), lines: [] });
    seen.get(key).lines.push(p.line);
  }
  const dups = [...seen.values()].filter(x => x.lines.length > 1);
  if (dups.length) {
    const sample = dups.slice(0, 4).map(d => `${d.name} (linie ${d.lines.join(", ")})`).join("; ");
    result.warnings.push(
      `Możliwe duplikaty — ${dups.length} ${plural(dups.length, ["pozycja", "pozycje", "pozycji"])}: ${sample}${dups.length > 4 ? " …" : ""}`
    );
  }

  return result;
}

function renderValidation() {
  const panel = document.getElementById("validationPanel");
  if (!panel) return null;

  // Panel walidacji ma sens tylko przed losowaniem
  if (drawPhase() !== "idle") { panel.hidden = true; panel.innerHTML = ""; return null; }

  const v = validateInput();
  if (v.empty) { panel.hidden = true; panel.innerHTML = ""; return v; }

  let html = "";
  if (v.counts) html += `<div class="vRow vCounts">Wykryto: ${escapeHtml(v.counts)}</div>`;
  for (const e of v.errors)   html += `<div class="vRow vError">✗ ${escapeHtml(e)}</div>`;
  for (const w of v.warnings) html += `<div class="vRow vWarn">⚠ ${escapeHtml(w)}</div>`;

  panel.className = "validationPanel" + (v.errors.length ? " hasError" : v.warnings.length ? " hasWarn" : " ok");
  panel.innerHTML = html;
  panel.hidden = false;
  return v;
}

// ======================
// GLOBAL STATE
// ======================
let STATE = {
  steps: [],
  idx: 0,
  baskets: [],
  groupCount: 0,
  started: false,
  finalSeed: "",
  salt: "",
  teamMode: false,
  useBaskets: true
};

// Poprzednia faza — do jednorazowego zwijania panelu danych przy przejściu
let prevPhase = null;

// ======================
// TABLE BUILD (fixed widths via colgroup)
// ======================
// TRANSPOZYCJA (2026-07): grupy w WIERSZACH, koszyki w KOLUMNACH. Grup bywa
// znacznie więcej niż koszyków (np. 14 grup × 6 koszyków) — przy grupach w
// kolumnach tabela była za ciasna na szerokość (zoom → ścisk). Komórki
// zachowują id `cell-b{basket}-g{group}`, więc odsłanianie/restore bez zmian.
function buildTable(baskets, groupCount, useBaskets = true) {
  const wrap = document.getElementById("tableWrap");

  const table = document.createElement("table");
  table.className = "resultTable transposed";

  const colgroup = document.createElement("colgroup");

  const colGrupa = document.createElement("col");
  colGrupa.style.width = "92px";
  colgroup.appendChild(colGrupa);

  for (let i = 0; i < baskets.length; i++) {
    const col = document.createElement("col");
    col.style.width = "auto";
    colgroup.appendChild(col);
  }
  if (SHOW_GROUP_STATS) {
    const colStat = document.createElement("col");
    colStat.style.width = "150px";
    colgroup.appendChild(colStat);
  }

  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = "Grupa";
  trHead.appendChild(th0);

  baskets.forEach(b => {
    const th = document.createElement("th");
    th.textContent = useBaskets ? b.label : `Runda ${b.label}`;
    trHead.appendChild(th);
  });

  // Kolumna statystyk per grupa (tylko dev/test) — wypełnia się po zakończeniu.
  if (SHOW_GROUP_STATS) {
    const thStat = document.createElement("th");
    thStat.textContent = "Punkty";
    trHead.appendChild(thStat);
  }

  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let g = 0; g < groupCount; g++) {
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.textContent = groupLabel(g);
    tr.appendChild(th);

    baskets.forEach((b, bIdx) => {
      const td = document.createElement("td");
      td.id = `cell-b${bIdx}-g${g}`;
      td.innerHTML = `<div class="cell"><span class="firstName">—</span></div>`;
      tr.appendChild(td);
    });

    if (SHOW_GROUP_STATS) {
      const td = document.createElement("td");
      td.id = `stat-g${g}`;
      td.className = "statCell statCol";
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);

  wrap.innerHTML = "";
  wrap.appendChild(table);

  const box = document.getElementById("drawSummary");
  if (box) { box.innerHTML = ""; box.hidden = true; }
}

// Statystyki po zakończeniu losowania:
//  • stopka pod grupami: MEDIANA (główna) + średnia + pasek „siły”
//  • ciekawostki: najbardziej różnorodna grupa, najwyższa mediana
//  • rozwijana macierz klub × grupa (podświetlone 2+ tego samego klubu w grupie)
// Placeholdery („gracz N") i „X" pomijamy; brak w rankingu = 0 pkt.
function renderGroupStats() {
  if (!SHOW_GROUP_STATS) return;
  // Po transpozycji statystyki siedzą w kolumnie „Punkty" (komórki stat-g{g}).
  if (!document.getElementById("stat-g0") || !STATE.started) return;
  const G = STATE.groupCount;

  const groupPoints = Array.from({ length: G }, () => []);
  const clubs = {};   // klucz → {label, name, counts:[G], total}
  for (const s of STATE.steps) {
    const nm = s.player && s.player.name;
    const info = playerPoints(nm);
    if (info) groupPoints[s.groupIndex].push(info.points);

    const club = s.player && s.player.club;
    if (club && club !== "-" && !isPlaceholderLine(nm || "") && !isEmptyMarker(nm || "")) {
      const k = clubKey(club);
      if (!clubs[k]) {
        const ci = CLUB_DATA[k];
        clubs[k] = { label: club.trim().toUpperCase(), name: ci ? ci.name : club.trim(),
                     counts: Array(G).fill(0), total: 0 };
      }
      clubs[k].counts[s.groupIndex]++;
      clubs[k].total++;
    }
  }

  const meds = groupPoints.map(a => a.length ? median(a) : 0);
  const avgs = groupPoints.map(a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const maxMed = Math.max(1, ...meds);

  // Kolumna „Punkty": mediana (duża) + średnia + segmentowy miernik siły
  // (5 kresek, wypełnienie wg mediany względem najsilniejszej grupy).
  for (let g = 0; g < G; g++) {
    const cell = document.getElementById(`stat-g${g}`);
    if (!cell) continue;
    if (!groupPoints[g].length) { cell.innerHTML = ""; continue; }
    const filled = Math.max(1, Math.round(meds[g] / maxMed * 5));
    let meter = `<span class="meter" title="Siła grupy wg mediany">`;
    for (let i = 0; i < 5; i++) meter += `<span class="seg${i < filled ? " on" : ""}"></span>`;
    meter += `</span>`;
    cell.innerHTML =
      `<span class="statMed">mediana <b>${Math.round(meds[g])}</b></span>` +
      `<span class="statAvg">śr. ${Math.round(avgs[g])} pkt</span>` + meter;
  }

  // Ciekawostki + macierz klubów pod tabelą
  const box = document.getElementById("drawSummary");
  if (!box) return;
  const distinct = Array.from({ length: G }, (_, g) =>
    Object.values(clubs).filter(c => c.counts[g] > 0).length);
  const divG = distinct.indexOf(Math.max(...distinct));
  const leastG = distinct.indexOf(Math.min(...distinct));
  const strongG = meds.indexOf(Math.max(...meds));
  const weakG = meds.indexOf(Math.min(...meds));

  const clubWord = n => plural(n, ["klub", "kluby", "klubów"]);
  const topClubs = Object.values(clubs)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, 5);

  const items = [
    `<b>Najbardziej różnorodna</b>: ${groupLabel(divG)} · ${distinct[divG]} ${clubWord(distinct[divG])}`,
    `<b>Najmniej różnorodna</b>: ${groupLabel(leastG)} · ${distinct[leastG]} ${clubWord(distinct[leastG])}`,
    `<b>Najwyższa mediana</b>: ${groupLabel(strongG)} · ${Math.round(meds[strongG])} pkt`,
    `<b>Najniższa mediana</b>: ${groupLabel(weakG)} · ${Math.round(meds[weakG])} pkt`,
  ];
  if (topClubs.length) {
    items.push(`<b>Najliczniej reprezentowane</b>: ${topClubs.map(c => `${escapeHtml(c.label)} ×${c.total}`).join(" · ")}`);
  }
  const facts = items.map(t => `<li>${t}</li>`).join("");

  const sorted = Object.values(clubs).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  let matrix = "";
  if (sorted.length) {
    let head = `<tr><th>Klub</th>`;
    for (let g = 0; g < G; g++) head += `<th>${escapeHtml(excelLetters(g))}</th>`;
    head += `<th>Σ</th></tr>`;
    let body = "";
    for (const c of sorted) {
      body += `<tr><th class="clubRow"><span class="clubAbbr">${escapeHtml(c.label)}</span> <span class="clubFull">${escapeHtml(c.name)}</span></th>`;
      for (let g = 0; g < G; g++) {
        const n = c.counts[g];
        const cls = n === 0 ? "zero" : (n >= 2 ? "hot" : "");
        body += `<td class="${cls}">${n || ""}</td>`;
      }
      body += `<th>${c.total}</th></tr>`;
    }
    matrix =
      `<details class="clubMatrix" open><summary>Rozkład klubów po grupach (${sorted.length} ${plural(sorted.length, ["klub", "kluby", "klubów"])})</summary>` +
      `<div class="matrixWrap"><table class="matrixTable"><thead>${head}</thead><tbody>${body}</tbody></table></div></details>`;
  }
  box.innerHTML = `<ul class="factList">${facts}</ul>${matrix}`;
  box.hidden = false;
}

// ======================
// HIGHLIGHT NEXT CELL
// ======================
function highlightNext() {
  document.querySelectorAll(".resultTable td.nextCell").forEach(td => td.classList.remove("nextCell"));
  if (!STATE.started || STATE.idx >= STATE.steps.length) return;
  const s = STATE.steps[STATE.idx];
  const cell = document.getElementById(`cell-b${s.basketIndex}-g${s.groupIndex}`);
  if (cell) cell.classList.add("nextCell");
}

// ======================
// STATUS + PRIMARY ACTION DISPATCH
// ======================
function drawPhase() {
  if (!STATE.started) return "idle";
  if (STATE.idx >= STATE.steps.length) return "done";
  return "drawing";
}

function setStatus(state, main, sub) {
  const bar = document.getElementById("statusBar");
  const mainEl = document.getElementById("statusMain");
  const subEl  = document.getElementById("statusSub");
  if (!bar || !mainEl || !subEl) return;
  bar.classList.remove("statusIdle", "statusDrawing", "statusDone");
  bar.classList.add("status" + state[0].toUpperCase() + state.slice(1));
  mainEl.textContent = main;
  if (sub) { subEl.textContent = sub; subEl.hidden = false; }
  else { subEl.textContent = ""; subEl.hidden = true; }
}

function lastAssignmentText() {
  if (STATE.idx === 0) return "";
  const s = STATE.steps[STATE.idx - 1];
  if (!s) return "";
  const clubPart = s.player.club ? ` [${s.player.club}]` : "";
  return `Ostatni przydział: ${s.basketLabel} → ${s.groupLabel}: ${s.player.name}${clubPart}`;
}

function countRealAssigned() {
  return STATE.baskets
    .flatMap(b => b.players)
    .filter(p => p && !p.placeholder && !isEmptyMarker(p.name) && !(p.name === "—" && p.club === "—"))
    .length;
}

function refreshUI() {
  const teamMode = document.getElementById("modeTeam")?.checked === true;
  const unitForms = teamMode ? ["drużyna", "drużyny", "drużyn"] : ["uczestnik", "uczestnicy", "uczestników"];

  const btnPrimary = document.getElementById("btnPrimary");
  const btnRestart = document.getElementById("btnRestart");
  const btnReset   = document.getElementById("btnReset");
  const btnExport  = document.getElementById("btnExport");
  const setup        = document.getElementById("setup");
  const summaryText  = document.getElementById("setupSummaryText");
  if (!btnPrimary) return;

  // Faza przydziału do koszyków (klik po kliku) — ma pierwszeństwo.
  if (basketPhaseActive()) {
    const done = BASKET.idx >= BASKET.steps.length;
    btnPrimary.textContent = done ? "Zakończ przydział →" : "Losuj koszyk dalej";
    btnPrimary.disabled = false;
    if (btnRestart) btnRestart.hidden = true;
    if (btnReset)   btnReset.hidden = false;
    if (btnExport)  btnExport.hidden = true;
    setStatus("drawing", done
      ? `Przydział do koszyków gotowy (${BASKET.steps.length}/${BASKET.steps.length}) — kliknij, aby przejść do losowania grup.`
      : `Losowanie przydziału do koszyków: ${BASKET.idx} / ${BASKET.steps.length}`);
    return;
  }

  const phase = drawPhase();

  if (phase === "idle") {
    btnPrimary.textContent = "Rozpocznij losowanie";
    btnPrimary.disabled = false;
    if (btnRestart) btnRestart.hidden = true;
    if (btnReset)   btnReset.hidden = true;
    if (btnExport)  btnExport.hidden = true;
    setTablePlaceholder();
    setStatus("idle", "Gotowe do losowania");
    renderValidation();
  } else if (phase === "drawing") {
    btnPrimary.textContent = "Losuj dalej";
    btnPrimary.disabled = false;
    if (btnRestart) btnRestart.hidden = true;
    if (btnReset)   btnReset.hidden = false;
    if (btnExport)  btnExport.hidden = false;
    setStatus(
      "drawing",
      `Losowanie w toku: ${STATE.idx} / ${STATE.steps.length}`,
      lastAssignmentText()
    );
  } else { // done
    // Przycisk główny nieaktywny, żeby z rozpędu nie kliknąć restartu.
    // "Nowe losowanie" to osobny, mniej eksponowany guzik z potwierdzeniem.
    btnPrimary.textContent = "Losowanie zakończone ✓";
    btnPrimary.disabled = true;
    if (btnRestart) btnRestart.hidden = false;
    if (btnReset)   btnReset.hidden = true;   // po zakończeniu tożsamy z „Nowe losowanie"
    if (btnExport)  btnExport.hidden = false;
    const cnt = countRealAssigned();
    setStatus(
      "done",
      `Losowanie zakończone: ${cnt} ${plural(cnt, unitForms)} w ${STATE.groupCount} ${plural(STATE.groupCount, ["grupie", "grupach", "grupach"])}`
    );
    renderGroupStats();
  }

  // Panel danych zwija się przy przejściu do losowania (raz, by nie blokować edycji)
  if (setup && phase !== prevPhase) {
    setup.open = (phase === "idle");
    prevPhase = phase;
  }
  if (summaryText) {
    if (phase === "idle") {
      summaryText.textContent = "Dane i ustawienia";
    } else {
      const cnt = countRealAssigned();
      summaryText.textContent = `Dane: ${cnt} ${plural(cnt, unitForms)} · ${STATE.groupCount} ${plural(STATE.groupCount, ["grupa", "grupy", "grup"])} — kliknij, aby edytować`;
    }
  }
}

function primaryAction() {
  if (basketPhaseActive()) { basketNextStep(); return; }
  const phase = drawPhase();
  if (phase === "idle")    { startDraw(); return; }
  if (phase === "drawing") { nextStep();  return; }
  /* done: przycisk nieaktywny — brak akcji */
}

function newDrawConfirm() {
  if (drawPhase() !== "done") return;
  if (!confirm("Nowe losowanie na AKTUALNYCH danych z panelu Dane i ustawienia? Jeśli chcesz inne dane — najpierw rozwiń panel i je zmień. Obecny wynik zostanie zastąpiony.")) return;
  // Reset stanu PRZED startem: bez tego faza była „done" i startDraw() pomijał
  // gałąź przydziału do koszyków (wymaga fazy „idle") — zaznaczony checkbox
  // „losujemy przydział do koszyków" był ignorowany i od razu szły grupy.
  newDraw();
  startDraw();
}

function setTablePlaceholder() {
  const wrap = document.getElementById("tableWrap");
  if (wrap && !wrap.querySelector("table")) {
    wrap.innerHTML = `<p class="tablePlaceholder">Tu pojawi się wynik losowania po kliknięciu „Rozpocznij losowanie”.</p>`;
  }
}

function newDraw() {
  STATE = {
    steps: [], idx: 0, baskets: [], groupCount: 0,
    started: false, finalSeed: "", salt: "", teamMode: false, useBaskets: true
  };
  const wrap = document.getElementById("tableWrap");
  if (wrap) wrap.innerHTML = "";
  const log = document.getElementById("log");
  if (log) log.innerHTML = "";
  lastBasketAssignment = null;
  renderBasketAssignPanel();
  localStorage.removeItem(STORAGE_KEY);
  refreshUI();
  document.getElementById("input")?.focus();
}

function resetDraw() {
  if (basketPhaseActive()) {
    if (!confirm("Przerwać losowanie przydziału do koszyków?")) return;
    cancelBasketAssignment();
    return;
  }
  if (drawPhase() === "idle") return;
  const inProgress = drawPhase() === "drawing";
  const msg = inProgress
    ? "Zresetować trwające losowanie? Postęp i przebieg zostaną usunięte. Wklejone dane pozostają."
    : "Wyczyścić wynik zakończonego losowania? Tabela i przebieg zostaną usunięte. Wklejone dane pozostają.";
  if (!confirm(msg)) return;
  newDraw();
}

// ======================
// LOG
// ======================
function addLog(text) {
  const log = document.getElementById("log");
  const div = document.createElement("div");
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ======================
// START / RESET
// ======================
function startDraw() {
  // FAZA WSTĘPNA: rozlosowanie przydziału do koszyków (konflikty punktowe).
  // Zaznaczony checkbox → najpierw rozlosuj pulę w puste miejsca, przepisz dane,
  // odznacz checkbox i NIE startuj jeszcze losowania grup (kolejny klik = grupy).
  const preAssign = document.getElementById("preAssignBaskets");
  if (preAssign && preAssign.checked && drawPhase() === "idle" && !basketPhaseActive()) {
    const inputEl = document.getElementById("input");
    const conflictEl = document.getElementById("conflictInput");

    // Initial check (błędy blokują, np. pula ≠ puste miejsca)
    const pv = renderValidation();
    if (pv && pv.errors.length) {
      document.getElementById("validationPanel")?.scrollIntoView({ block: "nearest" });
      return;
    }

    // Losowanie przydziału do koszyków — klik po kliku, z wizualizacją.
    startBasketAssignment(inputEl.value, conflictEl?.value || "");
    return;
  }

  const text = document.getElementById("input").value.trim();
  const groupCount = parseInt(document.getElementById("groupCount").value, 10);
  const teamMode = document.getElementById("modeTeam")?.checked === true;
  const useBaskets = basketsEnabled();

  // Bramka walidacji: błędy krytyczne blokują start (komunikat w panelu, nie alert)
  const v = renderValidation();
  if (v && v.errors.length) {
    document.getElementById("validationPanel")?.scrollIntoView({ block: "nearest" });
    document.getElementById("input")?.focus();
    return;
  }

  const parsed = parseInput(text, teamMode, useBaskets);

  // Losowy seed wewnętrzny — każde losowanie jest niezależne i nieprzewidywalne.
  const salt = `${new Date().toISOString()}-${cryptoRandomInt()}`;
  const finalSeed = salt;

  const random = createSeededRandom(finalSeed);

  let baskets;
  if (useBaskets) {
    parsed.forEach(b => shuffle(b.players, random));
    baskets = parsed;
  } else {
    // Bez koszyków: liczba rund i placeholderów wynika WYŁĄCZNIE z liczby realnych
    // graczy podzielonej na grupy. Np. 46 graczy / 8 grup => ceil(46/8)=6 rund,
    // 48 miejsc, czyli 2 placeholdery (6 grup po 6, 2 grupy po 5 + placeholder).
    // Ewentualne wklejone wpisy "Gracz N" są ignorowane — liczymy od nowa.
    const reals = parsed.flatMap(b => b.players).filter(p => !p.placeholder);
    shuffle(reals, random);

    const realCount = reals.length;
    const rows = Math.max(1, Math.ceil(realCount / groupCount));
    const bodyCells = (rows - 1) * groupCount;
    const placeholdersNeeded = rows * groupCount - realCount;

    // Ostatnia runda: pozostali realni + wygenerowane placeholdery "Gracz N"
    // (numeracja kontynuowana po liczbie graczy). Mieszamy i rozdajemy po kolei
    // do grup A, B, C... — placeholdery trafiają do losowych grup (maks. 1 na grupę).
    const lastItems = reals.slice(bodyCells);
    for (let i = 0; i < placeholdersNeeded; i++) {
      lastItems.push({ name: `Gracz ${realCount + 1 + i}`, club: "", placeholder: true });
    }
    shuffle(lastItems, random);

    baskets = [];
    for (let r = 0; r < rows - 1; r++) {
      baskets.push({ label: String(r + 1), players: reals.slice(r * groupCount, (r + 1) * groupCount) });
    }
    baskets.push({ label: String(rows), players: lastItems.slice(0, groupCount) });
  }

  const steps = [];
  baskets.forEach((b, bIdx) => {
    for (let g = 0; g < groupCount; g++) {
      const p = b.players[g] || { name: "—", club: "—" };
      steps.push({
        basketIndex: bIdx,
        groupIndex: g,
        basketLabel: b.label,
        groupLabel: groupLabel(g),
        player: p
      });
    }
  });

  document.getElementById("log").innerHTML = "";
  buildTable(baskets, groupCount, useBaskets);

  STATE = { steps, idx: 0, baskets, groupCount, started: true, finalSeed, salt, teamMode, useBaskets };

  const allPlayers = baskets.flatMap(b => b.players);
  const placeholderCount = allPlayers.filter(p => p.placeholder).length;
  const realCount = allPlayers.filter(p => !p.placeholder).length;
  const modeLabel = teamMode ? "DRUŻYNOWY" : "INDYWIDUALNY";
  const basketInfo = useBaskets
    ? `Koszyki=${baskets.length}`
    : `Bez koszyków, realnych=${realCount}` +
      (placeholderCount ? `, placeholderów=${placeholderCount} (ostatnia runda, losowe grupy)` : "");
  addLog(`Start losowania. Tryb: ${modeLabel}. Grupy=${groupCount}. ${basketInfo}.`);

  highlightNext();
  refreshUI();
  saveState();
}

// ======================
// STEP: 1 click = 1 person / team
// ======================
function nextStep() {
  if (!STATE.started) return;

  if (STATE.idx >= STATE.steps.length) {
    finalizeDraw();
    return;
  }

  const s = STATE.steps[STATE.idx];
  const cell = document.getElementById(`cell-b${s.basketIndex}-g${s.groupIndex}`);

  if (cell) {
    cell.innerHTML = cellMarkup(s.player.name, s.player.club);
    fitCell(cell.querySelector(".cell"));
    // Żywsze odsłanianie: podświetl tylko tę, świeżo wylosowaną komórkę.
    document.querySelectorAll(".resultTable td.justDrawn").forEach(t => t.classList.remove("justDrawn"));
    void cell.offsetWidth;            // restart animacji
    cell.classList.add("justDrawn");
  }

  addLog(`${s.basketLabel} → ${s.groupLabel}: ${s.player.name}${s.player.club ? " (" + s.player.club + ")" : ""}`);

  STATE.idx++;

  if (STATE.idx >= STATE.steps.length) {
    finalizeDraw();
  }

  highlightNext();
  refreshUI();
  saveState();
}

function finalizeDraw() {
  addLog("Losowanie zakończone.");
}

// ======================
// EXPORT: TSV (plik, Excel-friendly)
// Bugfix: każda grupa zawsze zajmuje dokładnie 2 kolumny (nazwa + klub)
// ======================
// Wynik pogrupowany: perGroup[g] = [{name, club}, ...] w kolejności losowania.
// Wspólne dla kopiowania do schowka i eksportu XLSX.
function resultPerGroup() {
  const perGroup = Array.from({ length: STATE.groupCount }, () => []);
  for (const s of STATE.steps) {
    if (s.player && s.player.name && s.player.name !== "—") {
      perGroup[s.groupIndex].push({ name: s.player.name, club: s.player.club || "" });
    }
  }
  return perGroup;
}

// ======================
// EXPORT: XLSX (siatka kart 4-w-rzędzie, jak w arkuszu turniejowym)
// Samodzielny generator bez bibliotek: pliki XML pakowane do ZIP metodą
// "store" (bez kompresji) z poprawnym CRC32. Polskie znaki w UTF-8.
// ======================
const GROUPS_PER_ROW = 4;

function colLetters1(n) {
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function xmlEsc(str) {
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function buildSheetXml() {
  const perGroup = resultPerGroup();
  const groups = [];
  for (let g = 0; g < STATE.groupCount; g++) {
    groups.push({ label: `Grupa ${excelLetters(g)}`, players: perGroup[g] });
  }

  const cells = [];   // {r, c, v, s}
  const merges = [];
  let rowCursor = 1;

  for (let start = 0; start < groups.length; start += GROUPS_PER_ROW) {
    const block = groups.slice(start, start + GROUPS_PER_ROW);
    const headerRow = rowCursor;
    const maxPlayers = Math.max(0, ...block.map(g => g.players.length));

    block.forEach((grp, p) => {
      const nameCol = 2 + p * 3;   // A=margines, potem nazwa/klub/odstęp
      const clubCol = 3 + p * 3;
      cells.push({ r: headerRow, c: nameCol, v: grp.label, s: 1 });
      cells.push({ r: headerRow, c: clubCol, v: "", s: 1 });
      merges.push(`${colLetters1(nameCol)}${headerRow}:${colLetters1(clubCol)}${headerRow}`);
      grp.players.forEach((pl, ri) => {
        const r = headerRow + 1 + ri;
        cells.push({ r, c: nameCol, v: pl.name, s: 2 });
        cells.push({ r, c: clubCol, v: pl.club, s: 3 });
      });
    });

    rowCursor = headerRow + 1 + maxPlayers + 1; // +1 wiersz odstępu między rzędami kart
  }

  const colCount = 1 + GROUPS_PER_ROW * 3;
  let colsXml = "<cols>";
  for (let c = 1; c <= colCount; c++) {
    const pos = (c - 2) % 3; // dla c>=2: 0=nazwa, 1=klub, 2=odstęp
    const w = c < 2 ? 2.5 : (pos === 0 ? 24 : pos === 1 ? 6.5 : 2.5);
    colsXml += `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`;
  }
  colsXml += "</cols>";

  const byRow = new Map();
  for (const cell of cells) {
    if (!byRow.has(cell.r)) byRow.set(cell.r, []);
    byRow.get(cell.r).push(cell);
  }
  let sheetRows = "";
  for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
    const rowCells = byRow.get(r).sort((a, b) => a.c - b.c);
    let cellsXml = "";
    for (const cell of rowCells) {
      const ref = `${colLetters1(cell.c)}${r}`;
      cellsXml += (cell.v === "" || cell.v == null)
        ? `<c r="${ref}" s="${cell.s}"/>`
        : `<c r="${ref}" s="${cell.s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
    }
    sheetRows += `<row r="${r}">${cellsXml}</row>`;
  }

  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    colsXml + `<sheetData>${sheetRows}</sheetData>` + mergeXml + `</worksheet>`;
}

// Druga zakładka (opcjonalna): wynik pre-losowania przydziału do koszyków.
function buildBasketSheetXml() {
  const steps = (lastBasketAssignment && lastBasketAssignment.steps) || [];
  const cells = [];
  cells.push({ r: 1, c: 2, v: "Koszyk", s: 1 });
  cells.push({ r: 1, c: 3, v: "Zawodnik", s: 1 });
  cells.push({ r: 1, c: 4, v: "Klub", s: 1 });
  const sorted = [...steps].sort((a, b) => a.basket - b.basket || a.name.localeCompare(b.name, "pl"));
  sorted.forEach((st, i) => {
    const r = 2 + i;
    cells.push({ r, c: 2, v: `Koszyk ${st.basket}`, s: 3 });
    cells.push({ r, c: 3, v: st.name, s: 2 });
    cells.push({ r, c: 4, v: st.club || "-", s: 3 });
  });
  const colsXml = `<cols>` +
    `<col min="1" max="1" width="2.5" customWidth="1"/>` +
    `<col min="2" max="2" width="10" customWidth="1"/>` +
    `<col min="3" max="3" width="28" customWidth="1"/>` +
    `<col min="4" max="4" width="8" customWidth="1"/></cols>`;
  const byRow = new Map();
  for (const cell of cells) {
    if (!byRow.has(cell.r)) byRow.set(cell.r, []);
    byRow.get(cell.r).push(cell);
  }
  let rows = "";
  for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
    let cx = "";
    for (const cell of byRow.get(r).sort((a, b) => a.c - b.c)) {
      const ref = `${colLetters1(cell.c)}${r}`;
      cx += (cell.v === "" || cell.v == null)
        ? `<c r="${ref}" s="${cell.s}"/>`
        : `<c r="${ref}" s="${cell.s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
    }
    rows += `<row r="${r}">${cx}</row>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    colsXml + `<sheetData>${rows}</sheetData></worksheet>`;
}

function xlsxContentTypes(hasBaskets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    (hasBaskets ? `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` : ``) +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;
}

const XLSX_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

function xlsxWorkbook(hasBaskets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Wynik losowania" sheetId="1" r:id="rId1"/>` +
    (hasBaskets ? `<sheet name="Przydział do koszyków" sheetId="2" r:id="rId3"/>` : ``) +
    `</sheets></workbook>`;
}

function xlsxWorkbookRels(hasBaskets) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    (hasBaskets ? `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` : ``) +
    `</Relationships>`;
}

const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFC0141C"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function concatBytes(list) {
  let len = 0; for (const a of list) len += a.length;
  const out = new Uint8Array(len); let p = 0;
  for (const a of list) { out.set(a, p); p += a.length; }
  return out;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const u16 = v => new Uint8Array([v & 255, (v >>> 8) & 255]);
  const u32 = v => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const size = data.length;
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0),
      nameBytes, data
    ]);
    locals.push(local);
    centrals.push(concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]));
    offset += local.length;
  }
  const central = concatBytes(centrals);
  const eocd = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0)
  ]);
  return concatBytes([...locals, central, eocd]);
}

function exportXLSX() {
  if (!STATE.started) return alert("Najpierw rozpocznij losowanie.");
  const hasBaskets = !!(lastBasketAssignment && lastBasketAssignment.steps.length);
  const files = [
    { name: "[Content_Types].xml", data: xlsxContentTypes(hasBaskets) },
    { name: "_rels/.rels", data: XLSX_ROOT_RELS },
    { name: "xl/workbook.xml", data: xlsxWorkbook(hasBaskets) },
    { name: "xl/_rels/workbook.xml.rels", data: xlsxWorkbookRels(hasBaskets) },
    { name: "xl/styles.xml", data: XLSX_STYLES },
    { name: "xl/worksheets/sheet1.xml", data: buildSheetXml() }
  ];
  if (hasBaskets) files.push({ name: "xl/worksheets/sheet2.xml", data: buildBasketSheetXml() });
  const blob = new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadBlob(`losowanie_${stamp}.xlsx`, blob);
  addLog("Pobrano wynik do pliku XLSX.");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ======================
// COPY RESULTS TO CLIPBOARD
// ======================
async function copyResultsToClipboard() {
  if (!STATE || !STATE.started) return alert("Najpierw rozpocznij losowanie.");

  const groups = STATE.groupCount;
  const perGroup = resultPerGroup();
  const maxRows = Math.max(0, ...perGroup.map(g => g.length));
  const lines = [];

  const header = [];
  for (let g = 0; g < groups; g++) {
    header.push(`Grupa ${excelLetters(g)}`);
    header.push(STATE.teamMode ? "" : "Klub");
    if (g !== groups - 1) header.push("");
  }
  lines.push(header.join("\t"));

  for (let r = 0; r < maxRows; r++) {
    const row = [];
    for (let g = 0; g < groups; g++) {
      const p = perGroup[g][r];
      row.push(p ? p.name : "");
      row.push(p ? p.club : "");
      if (g !== groups - 1) row.push("");
    }
    lines.push(row.join("\t"));
  }

  const tsv = lines.join("\n");

  try {
    await navigator.clipboard.writeText(tsv);
    addLog("Skopiowano wyniki do schowka (Excel). Wklej w Excelu w A1 jako wartości.");
  } catch (e) {
    addLog("Kopiowanie do schowka zablokowane — użyj przycisku „Pobierz Excel”.");
    alert("Kopiowanie do schowka zablokowane. Użyj „Pobierz Excel”.");
  }
}

// ======================
// EXPORT LOG (TXT)
// ======================
function exportLog() {
  const log = document.getElementById("log");
  if (!log) return alert("Brak logu do eksportu.");
  const text = log.innerText || "";
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadText(`log_losowania_${stamp}.txt`, text, "text/plain;charset=utf-8");
}

// ======================
// PERSISTENCE: localStorage (refresh safe)
// ======================
const STORAGE_KEY = "pfm_draw_state_v8";

function saveState() {
  if (!STATE || !STATE.started) return;

  const payload = {
    version: 8,
    savedAt: new Date().toISOString(),
    teamMode: STATE.teamMode ?? false,
    useBaskets: STATE.useBaskets ?? true,
    finalSeed: STATE.finalSeed ?? "",
    salt: STATE.salt ?? "",
    groupCount: STATE.groupCount,
    inputText: document.getElementById("input")?.value ?? "",
    started: STATE.started,
    idx: STATE.idx,
    baskets: STATE.baskets,
    steps: STATE.steps,
    basketAssignment: lastBasketAssignment,
    logHtml: document.getElementById("log")?.innerHTML ?? ""
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return false;
  }

  if (!payload || payload.version !== 8 || !payload.started) return false;

  const groupEl = document.getElementById("groupCount");
  const inputEl = document.getElementById("input");
  const modeSingleEl = document.getElementById("modeSingle");
  const modeTeamEl   = document.getElementById("modeTeam");
  const basketsOnEl  = document.getElementById("basketsOn");
  const basketsOffEl = document.getElementById("basketsOff");

  if (groupEl) groupEl.value   = payload.groupCount || 10;
  if (inputEl) inputEl.value   = payload.inputText  || "";
  if (modeTeamEl && modeSingleEl) {
    modeTeamEl.checked   = payload.teamMode === true;
    modeSingleEl.checked = payload.teamMode !== true;
  }
  if (basketsOnEl && basketsOffEl) {
    const ub = payload.useBaskets !== false;
    basketsOnEl.checked  = ub;
    basketsOffEl.checked = !ub;
  }
  updateModeUI();

  lastBasketAssignment = payload.basketAssignment || null;
  renderBasketAssignPanel();

  STATE = {
    steps:      payload.steps      || [],
    idx:        payload.idx        || 0,
    baskets:    payload.baskets    || [],
    groupCount: payload.groupCount || 10,
    started:    true,
    finalSeed:  payload.finalSeed  || "",
    salt:       payload.salt       || "",
    teamMode:   payload.teamMode   ?? false,
    useBaskets: payload.useBaskets !== false
  };

  buildTable(STATE.baskets, STATE.groupCount, STATE.useBaskets);

  for (let i = 0; i < STATE.idx; i++) {
    const s = STATE.steps[i];
    const cell = document.getElementById(`cell-b${s.basketIndex}-g${s.groupIndex}`);
    if (!cell) continue;
    cell.innerHTML = cellMarkup(s.player.name, s.player.club);
    fitCell(cell.querySelector(".cell"));
  }

  const logEl = document.getElementById("log");
  if (logEl) logEl.innerHTML = payload.logHtml || "";

  addLog(`Przywrócono stan po odświeżeniu (krok ${STATE.idx}/${STATE.steps.length}).`);
  if (STATE.salt)      addLog(`Sół: ${STATE.salt}`);
  if (STATE.finalSeed) addLog(`Seed końcowy użyty do losowania (AUDYT): ${STATE.finalSeed}`);

  highlightNext();
  refreshUI();
  return true;
}

function clearSaved() {
  localStorage.removeItem(STORAGE_KEY);
  addLog("Wyczyszczono zapis lokalny (localStorage).");
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  ["modeSingle", "modeTeam", "basketsOn", "basketsOff"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", updateModeUI);
  });
  document.getElementById("input")?.addEventListener("input", renderValidation);
  document.getElementById("groupCount")?.addEventListener("input", renderValidation);
  document.getElementById("preAssignBaskets")?.addEventListener("change", () => {
    updateConflictUI();
    renderValidation();
  });
  document.getElementById("conflictInput")?.addEventListener("input", renderValidation);
  updateModeUI();

  // Zmiana szerokości okna zmienia szerokość kolumn → przelicz dopasowanie nazw.
  let fitTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitAllCells, 150);
  });

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
});
