
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

    // header: "KOSZYK 1", "KOSZYK 2"...
    if (/^KOSZYK\b/i.test(line)) {
      const num = (line.match(/\d+/) || ["?"])[0];
      current = { label: `Koszyk ${num}`, players: [] };
      baskets.push(current);
      continue;
    }

    if (!current) {
      // jeśli ktoś wklei bez "KOSZYK", to utwórz Koszyk 1
      current = { label: "Koszyk 1", players: [] };
      baskets.push(current);
    }

    // Excel zwykle daje TAB między kolumnami.
    // Czasem wklejane są wielokrotne spacje – obsłużmy oba przypadki.
    let name = line;
    let club = "-";

    if (line.includes("\t")) {
      const parts = line.split(/\t+/).map(x => x.trim()).filter(Boolean);
      name = parts[0] || "";
      club = parts[1] || "-";
    } else {
      // split on 2+ spaces
      const parts = line.split(/\s{2,}/).map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) {
        name = parts[0];
        club = parts[1];
      } else {
        // fallback: ostatni token jako klub, reszta jako nazwa (tylko jeśli ma sens)
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
// UI helpers: group labels
// ======================
function groupLabel(i) {
  // i: 0-based
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (i < alphabet.length) return `Grupa ${alphabet[i]}`;
  return `Grupa ${i + 1}`;
}

// ======================
// GLOBAL STATE for step-by-step
// ======================
let STATE = {
  steps: [],
  idx: 0,
  baskets: [],
  groupCount: 0,
  started: false
};

// ======================
// BUILD TABLE
// ======================
function buildTable(baskets, groupCount) {
  const wrap = document.getElementById("tableWrap");

  const table = document.createElement("table");
  table.className = "resultTable";

  // THEAD
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

  // TBODY
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
// MAIN: START
// ======================
function startDraw() {
  const seed = document.getElementById("seed").value.trim();
  const text = document.getElementById("input").value.trim();
  const groupCount = parseInt(document.getElementById("groupCount").value, 10);

  if (!seed) {
    alert("Brak seeda.");
    return;
  }
  if (!text) {
    alert("Brak danych z Excela.");
    return;
  }
  if (!groupCount || groupCount < 2) {
    alert("Podaj poprawną liczbę grup (min 2).");
    return;
  }

  const baskets = parseInput(text);
  if (!baskets.length) {
    alert("Nie wykryto żadnego koszyka (nagłówki 'KOSZYK X').");
    return;
  }

  // Walidacja: jeśli w koszyku jest więcej osób niż grup — nie da się rozdać 'po 1 na grupę' dla tego koszyka
  const tooBig = baskets
    .map((b, idx) => ({ idx, label: b.label, n: b.players.length }))
    .filter(x => x.n > groupCount);

  if (tooBig.length) {
    alert(
      "Błąd: w niektórych koszykach jest więcej osób niż liczba grup.\n" +
      tooBig.map(x => `${x.label}: ${x.n} > ${groupCount}`).join("\n") +
      "\n\nAlbo zwiększ liczbę grup, albo zmniejsz koszyk."
    );
    return;
  }

  const random = createSeededRandom(seed);

  // shuffle per basket (deterministic)
  baskets.forEach(b => shuffle(b.players, random));

  // budujemy kroki: koszyk 1 -> grupa 1..N, potem koszyk 2 -> grupa 1..N, itd.
  const steps = [];
  baskets.forEach((b, bIdx) => {
    for (let g = 0; g < groupCount; g++) {
      const p = b.players[g] || { name: "—", club: "—" }; // puste miejsce w koszyku
      steps.push({ basketIndex: bIdx, groupIndex: g, basketLabel: b.label, groupLabel: groupLabel(g), player: p });
    }
  });

  // reset UI
  document.getElementById("log").innerHTML = "";
  buildTable(baskets, groupCount);

  // state
  STATE = {
    steps,
    idx: 0,
    baskets,
    groupCount,
    started: true
  };

  // enable next
  document.getElementById("btnNext").disabled = false;

  // log start
  addLog(`Start losowania. Seed: "${seed}". Grupy: ${groupCount}. Koszyki: ${baskets.length}.`);
}

// ======================
// STEP: NEXT (1 click = 1 player)
// ======================
function nextStep() {
  if (!STATE.started) return;

  if (STATE.idx >= STATE.steps.length) {
    addLog("Losowanie zakończone.");
    document.getElementById("btnNext").disabled = true;
    return;
  }

  const s = STATE.steps[STATE.idx];

  // update table cell
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

  // log
  addLog(`${s.basketLabel} → ${s.groupLabel}: ${s.player.name} (${s.player.club})`);

  STATE.idx++;

  if (STATE.idx >= STATE.steps.length) {
    addLog("Losowanie zakończone.");
    document.getElementById("btnNext").disabled = true;
  }
}

// ======================
// LOG helper
// ======================
function addLog(text) {
  const log = document.getElementById("log");
  const div = document.createElement("div");
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ======================
// security / rendering
// ======================
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
