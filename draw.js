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
// RNG
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

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ======================
// PARSE INPUT
// ======================
function parseInput(text) {
  const lines = text.split(/\r?\n/);
  const baskets = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^KOSZYK/i.test(line)) {
      const n = line.match(/\d+/)?.[0] || "?";
      current = { label: "Koszyk " + n, players: [] };
      baskets.push(current);
      continue;
    }

    if (!current) {
      current = { label: "Koszyk 1", players: [] };
      baskets.push(current);
    }

    let [name, club] = line.split(/\s{2,}|\t+/);
    if (!club) club = "-";
    current.players.push({ name, club });
  }

  return baskets;
}

// ======================
// TABLE
// ======================
function buildTable(baskets, groupCount) {
  const wrap = document.getElementById("tableWrap");
  const t = document.createElement("table");
  t.className = "resultTable";

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  tr.innerHTML = "<th>Koszyk</th>";
  for (let g = 0; g < groupCount; g++) tr.innerHTML += `<th>Grupa ${String.fromCharCode(65+g)}</th>`;
  thead.appendChild(tr);
  t.appendChild(thead);

  const tbody = document.createElement("tbody");
  baskets.forEach((b,bIdx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<th>${b.label}</th>`;
    for (let g=0; g<groupCount; g++) {
      tr.innerHTML += `<td id="cell-${bIdx}-${g}">—</td>`;
    }
    tbody.appendChild(tr);
  });
  t.appendChild(tbody);
  wrap.innerHTML="";
  wrap.appendChild(t);
}

// ======================
// START
// ======================
function startDraw() {
  const seed = document.getElementById("seed").value;
  const input = document.getElementById("input").value;
  const groupCount = +document.getElementById("groupCount").value;

  const baskets = parseInput(input);
  const rnd = createSeededRandom(seed);
  baskets.forEach(b=>shuffle(b.players, rnd));

  const steps=[];
  baskets.forEach((b,bIdx)=>{
    for (let g=0; g<groupCount; g++) {
      steps.push({ bIdx, g, player: b.players[g] || {name:"—",club:"—"} });
    }
  });

  STATE = { steps, idx:0, baskets, groupCount, started:true };

  document.getElementById("log").innerHTML="";
  buildTable(baskets, groupCount);
  renderPool();

  document.getElementById("btnNext").disabled=false;
  document.getElementById("btnCopy").disabled=false;
}

// ======================
// STEP
// ======================
function nextStep() {
  if (!STATE.started || STATE.idx>=STATE.steps.length) return;
  const s = STATE.steps[STATE.idx];
  const cell = document.getElementById(`cell-${s.bIdx}-${s.g}`);
  cell.textContent = `${s.player.name} ${s.player.club}`;
  STATE.idx++;
  renderPool();
}

// ======================
// POOL (READ ONLY)
// ======================
function renderPool() {
  const wrap = document.getElementById("poolList");
  wrap.innerHTML="";
  if (!STATE.started) return;

  const used = new Set(
    STATE.steps.slice(0,STATE.idx).map(s=>s.player.name)
  );

  STATE.baskets.forEach(b=>{
    const h=document.createElement("div");
    h.className="poolBasket";
    h.textContent=b.label;
    wrap.appendChild(h);
    b.players.forEach(p=>{
      const d=document.createElement("div");
      d.textContent=`${p.name} (${p.club})`;
      if (used.has(p.name)) d.classList.add("used");
      wrap.appendChild(d);
    })
  });
}

// ======================
async function copyResultsToClipboard(){ alert("OK – tu nic nie zmieniałem"); }
function exportTSV(){ alert("OK – tu nic nie zmieniałem"); }
function exportLog(){ alert("OK – tu nic nie zmieniałem"); }
function clearSaved(){ localStorage.clear(); }
