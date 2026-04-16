
// ======================
// deterministic RNG
// =================1a hash -> mulberry-ish stream// ======================
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
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (i < alphabet.length) return `Grupa ${alphabet[i]}`;
  return `Grupa ${i + 1}`;
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
  // zabezpiecza przed HTML injection w innerHTML
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cryptoRandomInt() {
  // lepsze niż Math.random (ale z fallbackiem)
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
function parseInput(text) {
  const lines = text.split(/\r?\n/);
  const baskets = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^KOSZYK\b/i.test(line)) {
      const num = (line.match(/\d+/) || ["?"])[0];
      current = { label: `Koszyk ${num}`, players: [] };
      baskets.push(current);
      continue;
    }

    if (!current) {
      current = { label: "Koszyk 1", players: [] };
      baskets.push(current);
    }

    // TAB z Excela albo 2+ spacje
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

    current.players.push({ name, club });
  }

  return baskets;
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
  salt: ""
};

// ======================
// TABLE BUILD (fixed widths via colgroup)
// ======================
function buildTable(baskets, groupCount) {
  const wrap = document.getElementById("tableWrap");

  const table = document.createElement("table");
  table.className = "resultTable";

  // colgroup = stabilne szerokości
  const colgroup = document.createElement("colgroup");

  const colKoszyk = document.createElement("col");
  colKoszyk.style.width = "88px";
  colgroup.appendChild(colKoszyk);

  for (let i = 0; i < groupCount; i++) {
    const col = document.createElement("col");
    col.style.width = "240px"; // default pod nazwisko ~ "Agnieszka Wojciechowska"
    colgroup.appendChild(col);
  }

  table.appendChild(colgroup);

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = "Koszyk";
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
      td.innerHTML = `
        <div class="cell">
          <span class="name">—</span>
          <span class="club">—</span>
        </div>`;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  wrap.innerHTML = "";
  wrap.appendChild(table);
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
// POOL RENDER (UI ONLY)  ✅ NOWE
// ======================
function renderPool() {
  const wrap = document.getElementById("poolList");
  if (!wrap) return;

  if (!STATE || !STATE.started) {
    wrap.innerHTML = "";
    return;
  }

  const used = new Set(
    STATE.steps
      .slice(0, STATE.idx)
      .map(s => `${s.basketIndex}|${s.player.name}|${s.player.club}`)
  );

  wrap.innerHTML = "";

  STATE.baskets.forEach((b, bIdx) => {
    const h = document.createElement("div");
    h.className = "poolBasket";
    h.textContent = b.label;
    wrap.appendChild(h);

    b.players.forEach(p => {
      const key = `${bIdx}|${p.name}|${p.club}`;
      const div = document.createElement("div");
      div.className = "poolItem" + (used.has(key) ? " used" : "");
      div.textContent = `${p.name} (${p.club})`;
      wrap.appendChild(div);
    });
  });
}

// ======================
// START / RESET
// ======================
function startDraw() {
  const baseSeed = document.getElementById("seed").value.trim();
  const text = document.getElementById("input").value.trim();
  const groupCount = parseInt(document.getElementById("groupCount").value, 10);

  if (!baseSeed) return alert("Brak seeda.");
  if (!text) return alert("Brak danych z Excela.");
  if (!groupCount || groupCount < 2) return alert("Podaj poprawną liczbę grup (min 2).");

  const baskets = parseInput(text);
  if (!baskets.length) return alert("Nie wykryto żadnego koszyka (nagłówki 'KOSZYK X').");

  // walidacja: koszyk nie może mieć > groupCount
  const tooBig = baskets
    .map(b => ({ label: b.label, n: b.players.length }))
    .filter(x => x.n > groupCount);

  if (tooBig.length) {
    return alert(
      "Błąd: w niektórych koszykach jest więcej osób niż liczba grup.\n" +
      tooBig.map(x => `${x.label}: ${x.n} > ${groupCount}`).join("\n")
    );
  }

  const useExact = document.getElementById("exactSeed")?.checked === true;

  let salt = "";
  let finalSeed = "";

  if (useExact) {
    salt = "(wyłączona)";
    finalSeed = baseSeed;
  } else {
    // jawna sól, żeby było widać co wylosowało
    salt = `${new Date().toISOString()}-${cryptoRandomInt()}`;
    finalSeed = `${baseSeed} | ${salt}`;
  }

  const random = createSeededRandom(finalSeed);

  // tasujemy każdy koszyk deterministycznie dla finalSeed
  baskets.forEach(b => shuffle(b.players, random));

  // budujemy kroki: koszyk po koszyku, grupa A..Z
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

  // reset UI
  document.getElementById("log").innerHTML = "";
  buildTable(baskets, groupCount);

  STATE = { steps, idx: 0, baskets, groupCount, started: true, finalSeed, salt };

  // enable buttons
  const btnNext = document.getElementById("btnNext");
  const btnExport = document.getElementById("btnExport");
  const btnCopy = document.getElementById("btnCopy");
  if (btnNext) btnNext.disabled = false;
  if (btnExport) btnExport.disabled = false;
  if (btnCopy) btnCopy.disabled = false;

  addLog(`Start losowania. Grupy=${groupCount}. Koszyki=${baskets.length}.`);
  addLog(`Tryb seeda: ${useExact ? "DOKŁADNY (odtwarzanie)" : "NORMALNY (losowa sól)"}`);
  addLog(`Sól: ${salt}`);
  addLog(`Seed końcowy użyty do losowania (AUDYT): ${finalSeed}`);

  renderPool();   // ✅ ważne: pokaż pulę od razu
  saveState();
}

// ======================
// STEP: 1 click = 1 person
// ======================
function nextStep() {
  if (!STATE.started) return;

  if (STATE.idx >= STATE.steps.length) {
    addLog("Losowanie zakończone.");
    const btnNext = document.getElementById("btnNext");
    if (btnNext) btnNext.disabled = true;
    renderPool(); // ✅ domknij UI
    saveState();
    return;
  }

  const s = STATE.steps[STATE.idx];
  const cell = document.getElementById(`cell-b${s.basketIndex}-g${s.groupIndex}`);

  if (cell) {
    const isEmpty = (s.player.name === "—" && s.player.club === "—");
    cell.innerHTML = `
      <div class="cell ${isEmpty ? "empty" : "filled"}">
        <span class="name">${escapeHtml(s.player.name)}</span>
        <span class="club">${escapeHtml(s.player.club)}</span>
      </div>
    `;
  }

  addLog(`${s.basketLabel} → ${s.groupLabel}: ${s.player.name} (${s.player.club})`);

  STATE.idx++;

  if (STATE.idx >= STATE.steps.length) {
    addLog("Losowanie zakończone.");
    const btnNext = document.getElementById("btnNext");
    if (btnNext) btnNext.disabled = true;
  }

  renderPool();   // ✅ ważne: wyszarzaj na każdym kroku
  saveState();
}

// ======================
// EXPORT: TSV (plik, Excel-friendly – macierz koszyk x grupa)
// ======================
function buildExportMatrix() {
  const basketsCount = STATE.baskets.length;
  const groupCount = STATE.groupCount;

  const matrix = Array.from({ length: basketsCount }, () =>
    Array.from({ length: groupCount }, () => "")
  );

  for (const s of STATE.steps) {
    const label =
      (s.player.name === "—" && s.player.club === "—")
        ? ""
        : `${s.player.name}\t${s.player.club}`; // rozdzielone w TSV
    matrix[s.basketIndex][s.groupIndex] = label;
  }

  return matrix;
}

function matrixToTSV(matrix) {
  const headers = Array.from({ length: STATE.groupCount }, (_, g) => groupLabel(g));
  const rows = [];
  rows.push(["Koszyk", ...headers].join("\t"));

  for (let b = 0; b < matrix.length; b++) {
    const basketName = STATE.baskets[b].label;
    rows.push([basketName, ...matrix[b]].join("\t"));
  }
  return rows.join("\n");
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

function exportTSV() {
  if (!STATE.started) return alert("Najpierw kliknij Start.");
  const matrix = buildExportMatrix();
  const tsv = matrixToTSV(matrix);
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  downloadText(`losowanie_${stamp}.tsv`, tsv, "text/tab-separated-values;charset=utf-8");
  addLog("Wyeksportowano TSV do pliku.");
}

// ======================
// COPY RESULTS TO CLIPBOARD (format blokowy jak na screenie)
// - 2 kolumny na grupę: ImięNazwisko | Klub
// - + 1 pusta kolumna separatora między grupami (jak w Excelu)
// ======================
async function copyResultsToClipboard() {
  if (!STATE || !STATE.started) return alert("Najpierw kliknij Start.");

  const groups = STATE.groupCount;

  // perGroup[g] = [{name, club}, ...] w kolejności losowania
  const perGroup = Array.from({ length: groups }, () => []);

  // bierzemy tylko realnych graczy (bez pustych)
  for (const s of STATE.steps) {
    if (s.player && s.player.name && s.player.name !== "—") {
      perGroup[s.groupIndex].push({ name: s.player.name, club: s.player.club || "-" });
    }
  }

  const maxRows = Math.max(0, ...perGroup.map(g => g.length));
  const lines = [];

  // nagłówek: Grupa A | (puste) | sep | Grupa B | (puste) | sep ...
  const header = [];
  for (let g = 0; g < groups; g++) {
    header.push(`Grupa ${excelLetters(g)}`);
    header.push(""); // klub header pusty
    if (g !== groups - 1) header.push(""); // separator
  }
  lines.push(header.join("\t"));

  // wiersze danych
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
    addLog("Kopiowanie do schowka zablokowane — użyj eksportu TSV do pliku.");
    alert("Kopiowanie do schowka zablokowane. Użyj 'Eksport TSV'.");
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
const STORAGE_KEY = "pfm_draw_state_v5";

function saveState() {
  if (!STATE || !STATE.started) return;

  const payload = {
    version: 5,
    savedAt: new Date().toISOString(),
    baseSeed: document.getElementById("seed")?.value ?? "",
    exactSeed: document.getElementById("exactSeed")?.checked === true,
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

  if (!payload || payload.version !== 5 || !payload.started) return false;

  // restore inputs
  const seedEl = document.getElementById("seed");
  const groupEl = document.getElementById("groupCount");
  const inputEl = document.getElementById("input");
  const exactEl = document.getElementById("exactSeed");

  if (seedEl) seedEl.value = payload.baseSeed || "";
  if (groupEl) groupEl.value = payload.groupCount || 10;
  if (inputEl) inputEl.value = payload.inputText || "";
  if (exactEl) exactEl.checked = payload.exactSeed === true;

  // restore state
  STATE = {
    steps: payload.steps || [],
    idx: payload.idx || 0,
    baskets: payload.baskets || [],
    groupCount: payload.groupCount || 10,
    started: true,
    finalSeed: payload.finalSeed || "",
    salt: payload.salt || ""
  };

  // rebuild table + fill up to idx
  buildTable(STATE.baskets, STATE.groupCount);

  for (let i = 0; i < STATE.idx; i++) {
    const s = STATE.steps[i];
    const cell = document.getElementById(`cell-b${s.basketIndex}-g${s.groupIndex}`);
    if (!cell) continue;
    const isEmpty = (s.player.name === "—" && s.player.club === "—");
    cell.innerHTML = `
      <div class="cell ${isEmpty ? "empty" : "filled"}">
        <span class="name">${escapeHtml(s.player.name)}</span>
        <span class="club">${escapeHtml(s.player.club)}</span>
      </div>
    `;
  }

  // restore log
  const logEl = document.getElementById("log");
  if (logEl) logEl.innerHTML = payload.logHtml || "";

  // buttons
  const btnNext = document.getElementById("btnNext");
  const btnExport = document.getElementById("btnExport");
  const btnCopy = document.getElementById("btnCopy");

  if (btnNext) btnNext.disabled = (STATE.idx >= STATE.steps.length);
  if (btnExport) btnExport.disabled = false;
  if (btnCopy) btnCopy.disabled = false;

  addLog(`Przywrócono stan po odświeżeniu (krok ${STATE.idx}/${STATE.steps.length}).`);
  if (STATE.salt) addLog(`Sól: ${STATE.salt}`);
  if (STATE.finalSeed) addLog(`Seed końcowy użyty do losowania (AUDYT): ${STATE.finalSeed}`);

  renderPool(); // ✅ ważne: odtwórz pulę po refreshu
  return true;
}

function clearSaved() {
  localStorage.removeItem(STORAGE_KEY);
  addLog("Wyczyszczono zapis lokalny (localStorage).");
  // UI zostaje – użytkownik może chcieć skopiować wynik z ekranu mimo czyszczenia
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderPool(); // jeśli brak stanu, po prostu wyczyści poolList
});
function createSeededRandom(seed) {
