
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
// UI helpers
// ======================
function groupLabel(i) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (i < alphabet.length) return `Grupa ${alphabet[i]}`;
  return `Grupa ${i + 1}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======================
// GLOBAL STATE
// ======================
let STATE = {
  steps: [],
  idx: 0,
  baskets: [],
  groupCount: 0,
  started: false
};

// ======================
// TABLE BUILD
// ======================
function buildTable(baskets, groupCount) {
  const wrap = document.getElementById("tableWrap");

  const table = document.createElement("table");
  table.className = "resultTable";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = "Koszyk \\ Grupa";
  headRow.appendChild(th0);

  for (let g = 0; g < groupCount; g++) {
    const th = document.createElement("th");
    th.textContent = groupLabel(g);
    headRow.appendChild(th);
  }

  thead.appendChild(headRow);
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
      td.innerHTML = `<div class="cell empty"><span class="name">—</span><span class="club">—</span></div>`;
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
// MAIN: START / RESET
// ======================
function startDraw() {
  const seed = document.getElementById("seed").value.trim();
  const text = document.getElementById("input").value.trim();
  const groupCount = parseInt(document.getElementById("groupCount").value, 10);

  if (!seed) return alert("Brak seeda.");
  if (!text) return alert("Brak danych z Excela.");
  if (!groupCount || groupCount < 2) return alert("Podaj poprawną liczbę grup (min 2).");

  const baskets = parseInput(text);
  if (!baskets.length) return alert("Nie wykryto żadnego koszyka (nagłówki 'KOSZYK X').");

  // WALIDACJA: koszyk nie może mieć > groupCount
  const tooBig = baskets
    .map(b => ({ label: b.label, n: b.players.length }))
    .filter(x => x.n > groupCount);

  if (tooBig.length) {
    return alert(
      "Błąd: w niektórych koszykach jest więcej osób niż liczba grup.\n" +
      tooBig.map(x => `${x.label}: ${x.n} > ${groupCount}`).join("\n")
    );
  }

  const random = createSeededRandom(seed);

  // deterministycznie mieszamy KAŻDY koszyk
  baskets.forEach(b => shuffle(b.players, random));

  // kroki: koszyk 1 -> grupa A.., koszyk 2 -> grupa A.., itd.
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

  STATE = { steps, idx: 0, baskets, groupCount, started: true };

  // enable buttons
  document.getElementById("btnNext").disabled = false;
  document.getElementById("btnExport").disabled = false;
  document.getElementById("btnCopy").disabled = false;

  addLog(`Start losowania. Seed="${seed}". Grupy=${groupCount}. Koszyki=${baskets.length}.`);

  // autosave
  saveState();
}

// ======================
// STEP: 1 click = 1 person
// ======================
function nextStep() {
  if (!STATE.started) return;

  if (STATE.idx >= STATE.steps.length) {
    addLog("Losowanie zakończone.");
    document.getElementById("btnNext").disabled = true;
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
    document.getElementById("btnNext").disabled = true;
  }

  // autosave
  saveState();
}

// ======================
// EXPORT: TSV (Excel-friendly)
// ======================
function buildExportMatrix() {
  // Matrix: rows = baskets, cols = groups
  const basketsCount = STATE.baskets.length;
  const groupCount = STATE.groupCount;

  const matrix = Array.from({ length: basketsCount }, () =>
    Array.from({ length: groupCount }, () => "")
  );

  for (const s of STATE.steps) {
    const label =
      (s.player.name === "—" && s.player.club === "—")
        ? ""
        : `${s.player.name} (${s.player.club})`;
    matrix[s.basketIndex][s.groupIndex] = label;
  }

  return matrix;
}

function matrixToTSV(matrix) {
  const headers = Array.from({ length: STATE.groupCount }, (_, g) => groupLabel(g));
  const rows = [];

  rows.push(["", ...headers].join("\t")); // top-left empty
  for (let b = 0; b < matrix.length; b++) {
    const basketName = STATE.baskets[b].label;
    rows.push([basketName, ...matrix[b]].join("\t"));
  }

  return rows.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
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
  downloadText(`losowanie_${stamp}.tsv`, tsv);

  addLog("Wyeksportowano TSV do pliku (Excel-friendly).");
}

async function copyTSV() {
  if (!STATE.started) return alert("Najpierw kliknij Start.");
  const matrix = buildExportMatrix();
  const tsv = matrixToTSV(matrix);

  try {
    await navigator.clipboard.writeText(tsv);
    addLog("Skopiowano TSV do schowka. Wklej w Excelu w komórkę A1.");
  } catch (e) {
    addLog("Kopiowanie do schowka zablokowane. Użyj Eksport (TSV).");
    alert("Kopiowanie do schowka zablokowane przez przeglądarkę. Użyj przycisku Eksport (TSV).");
  }
}

// ======================
// PERSISTENCE: localStorage (Opcja A)
// ======================
const STORAGE_KEY = "pfm_draw_state_v1";

function saveState() {
  if (!STATE || !STATE.started) return;

  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    seed: document.getElementById("seed")?.value ?? "",
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

  if (!payload || payload.version !== 1 || !payload.started) return false;

  // odtwórz inputy
  const seedEl = document.getElementById("seed");
  const groupEl = document.getElementById("groupCount");
  const inputEl = document.getElementById("input");
  if (seedEl) seedEl.value = payload.seed || "";
  if (groupEl) groupEl.value = payload.groupCount || 10;
  if (inputEl) inputEl.value = payload.inputText || "";

  // odtwórz STATE
  STATE = {
    steps: payload.steps || [],
    idx: payload.idx || 0,
    baskets: payload.baskets || [],
    groupCount: payload.groupCount || 10,
    started: true
  };

  // odbuduj tabelę
  buildTable(STATE.baskets, STATE.groupCount);

  // wypełnij tabelę do kroku idx (wszystko co już “wylosowane”)
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

  // przywróć log
  const logEl = document.getElementById("log");
  if (logEl) logEl.innerHTML = payload.logHtml || "";

  // ustaw przyciski
  document.getElementById("btnNext").disabled = (STATE.idx >= STATE.steps.length);
  document.getElementById("btnExport").disabled = false;
  document.getElementById("btnCopy").disabled = false;

  addLog(`Przywrócono stan po odświeżeniu (krok ${STATE.idx}/${STATE.steps.length}).`);

  return true;
}

function clearSaved() {
  localStorage.removeItem(STORAGE_KEY);
  addLog("Wyczyszczono zapis localStorage (refresh nie będzie przywracał poprzedniego stanu).");
}

// auto-restore po refresh
document.addEventListener("DOMContentLoaded", () => {
  loadState();
});
