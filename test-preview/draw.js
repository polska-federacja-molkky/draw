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
// Klucz = znormalizowany skrót: wielkie litery, Ł→L, bez diakrytyków — żeby
// dopasować niezależnie od tego, jak klub wpisano na liście (np. "OŁA"/"OLA").
// Pełna nazwa trafia do tooltipa. Pole `logo` ustawiamy dopiero, gdy plik herbu
// faktycznie leży w logos/ — kluby bez herbu dostają pusty herb-placeholder.
const CLUBS = {
  ZAG: { name: "Zagryfka Tczew", logo: "logos/ZAG.png" },
  DWU: { name: "Dwunastka Warszawa", logo: "logos/DWU.png" },
  ZAK: { name: "Zakręgleni Szczecin", logo: "logos/ZAK.png" },
  PUS: { name: "Puszczyki Mölkky Puszczykowo", logo: "logos/PUS.png" },
  SUD: { name: "Suden Vuori", logo: "logos/SUD.png" },
  FOR: { name: "KF Format Sztum", logo: "logos/FOR.png" },
  TIM: { name: "Timbers Bojanowo", logo: "logos/TIM.png" },
  BES: { name: "Beskid Mölkky Team", logo: "logos/BES.png" },
  SIL: { name: "AKF Silesia Chorzów", logo: "logos/SIL.png" },
  FOL: { name: "Festiwal Folkowisko", logo: "logos/FOL.png" },
  LIS: { name: "LIS-ki Team Gryfów Śląski", logo: "logos/LIS.png" },
  ZBI: { name: "ŚKKF Zbijaki", logo: "logos/ZBI.png" },
  SAO: { name: "Stowarzyszenie Aktywny Orlik", logo: "logos/SAO.png" },
  LEM: { name: "Lemolki Chojnice" },
  DEM: { name: "Demölkky Gdynia", logo: "logos/DEM.png" },
  ROS: { name: "Rosengarten Rats Berlin", logo: "logos/ROS.png" },
  MAT: { name: "Mat4" },
  OLA: { name: "Mölkky Oława", logo: "logos/OLA.png" },
  BPK: { name: "Bez Pudła Kępno" },
  KSP: { name: "KS Petanque Oława", logo: "logos/KSP.png" },
};

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
  const info = CLUBS[clubKey(raw)];
  const title = info ? info.name : raw;
  if (info && info.logo) {
    return `<img class="clubLogo" src="${escapeHtml(info.logo)}" alt="${escapeHtml(acr)}"` +
      ` title="${escapeHtml(title)}" loading="lazy" data-acr="${escapeHtml(acr)}"` +
      ` onerror="this.replaceWith(makeClubPlaceholder(this.dataset.acr, this.title))">`;
  }
  return placeholderHtml(acr, title);
}

// Renderuje zawartość komórki: imię/nazwisko w bloku po lewej, herb klubu
// po prawej stronie. Rozbicie nazwiska na osobny wiersz daje większą czcionkę,
// a herb obok nie zabiera pionu.
function cellMarkup(name, club) {
  const isEmpty = (name === "—" && club === "—");
  if (isEmpty) {
    return `<div class="cell empty"><div class="cellName"><span class="firstName">—</span></div></div>`;
  }
  const trimmed = (name || "").trim();
  const sp = trimmed.indexOf(" ");
  const first = sp > 0 ? trimmed.slice(0, sp) : trimmed;
  const last  = sp > 0 ? trimmed.slice(sp + 1) : "";
  return `<div class="cell filled">` +
    `<div class="cellName">` +
      `<span class="firstName">${escapeHtml(first)}</span>` +
      (last ? `<span class="lastName">${escapeHtml(last)}</span>` : "") +
    `</div>` +
    clubBadge(club) +
    `</div>`;
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
  cell.querySelectorAll(".firstName, .lastName").forEach(fitName);
}
function fitAllCells() {
  document.querySelectorAll(".resultTable td .cell").forEach(fitCell);
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

function validateInput() {
  const text = document.getElementById("input")?.value.trim() ?? "";
  const teamMode = document.getElementById("modeTeam")?.checked === true;
  const useBaskets = basketsEnabled();
  const groupCount = parseInt(document.getElementById("groupCount")?.value, 10);

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
function buildTable(baskets, groupCount, useBaskets = true) {
  const wrap = document.getElementById("tableWrap");

  const table = document.createElement("table");
  table.className = "resultTable";

  const colgroup = document.createElement("colgroup");

  const colKoszyk = document.createElement("col");
  colKoszyk.style.width = "64px";
  colgroup.appendChild(colKoszyk);

  for (let i = 0; i < groupCount; i++) {
    const col = document.createElement("col");
    col.style.width = "auto";
    colgroup.appendChild(col);
  }

  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = useBaskets ? "Koszyk" : "Lp.";
  trHead.appendChild(th0);

  for (let g = 0; g < groupCount; g++) {
    const th = document.createElement("th");
    th.textContent = groupLabel(g);
    trHead.appendChild(th);
  }

  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  baskets.forEach((b, bIdx) => {
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.textContent = b.label;
    tr.appendChild(th);

    for (let g = 0; g < groupCount; g++) {
      const td = document.createElement("td");
      td.id = `cell-b${bIdx}-g${g}`;
      td.innerHTML = `<div class="cell"><span class="firstName">—</span></div>`;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  wrap.innerHTML = "";
  wrap.appendChild(table);
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
  const btnCopy    = document.getElementById("btnCopy");
  const btnExport  = document.getElementById("btnExport");
  const setup        = document.getElementById("setup");
  const summaryText  = document.getElementById("setupSummaryText");
  if (!btnPrimary) return;

  const phase = drawPhase();

  if (phase === "idle") {
    btnPrimary.textContent = "Rozpocznij losowanie";
    btnPrimary.disabled = false;
    if (btnRestart) btnRestart.hidden = true;
    if (btnReset)   btnReset.hidden = true;
    if (btnCopy)    btnCopy.hidden = true;
    if (btnExport)  btnExport.hidden = true;
    setTablePlaceholder();
    setStatus("idle", "Gotowe do losowania");
    renderValidation();
  } else if (phase === "drawing") {
    btnPrimary.textContent = "Losuj dalej";
    btnPrimary.disabled = false;
    if (btnRestart) btnRestart.hidden = true;
    if (btnReset)   btnReset.hidden = false;
    if (btnCopy)    btnCopy.hidden = false;
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
    if (btnReset)   btnReset.hidden = false;
    if (btnCopy)    btnCopy.hidden = false;
    if (btnExport)  btnExport.hidden = false;
    const cnt = countRealAssigned();
    setStatus(
      "done",
      `Losowanie zakończone: ${cnt} ${plural(cnt, unitForms)} w ${STATE.groupCount} ${plural(STATE.groupCount, ["grupie", "grupach", "grupach"])}`
    );
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
  const phase = drawPhase();
  if (phase === "idle")    { startDraw(); return; }
  if (phase === "drawing") { nextStep();  return; }
  /* done: przycisk nieaktywny — brak akcji */
}

function newDrawConfirm() {
  if (drawPhase() !== "done") return;
  if (!confirm("Rozpocząć nowe losowanie na tych samych danych? Obecny wynik zostanie zastąpiony nowym.")) return;
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
  localStorage.removeItem(STORAGE_KEY);
  refreshUI();
  document.getElementById("input")?.focus();
}

function resetDraw() {
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

const XLSX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const XLSX_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const XLSX_WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="Wynik losowania" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const XLSX_WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

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
  const files = [
    { name: "[Content_Types].xml", data: XLSX_CONTENT_TYPES },
    { name: "_rels/.rels", data: XLSX_ROOT_RELS },
    { name: "xl/workbook.xml", data: XLSX_WORKBOOK },
    { name: "xl/_rels/workbook.xml.rels", data: XLSX_WORKBOOK_RELS },
    { name: "xl/styles.xml", data: XLSX_STYLES },
    { name: "xl/worksheets/sheet1.xml", data: buildSheetXml() }
  ];
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
  updateModeUI();

  // Zmiana szerokości okna zmienia szerokość kolumn → przelicz dopasowanie nazw.
  let fitTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitAllCells, 150);
  });
});
