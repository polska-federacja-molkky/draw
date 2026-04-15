
// ---------- deterministic RNG ----------
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

// ---------- main ----------
function startDraw() {
  const seed = document.getElementById("seed").value.trim();
  const text = document.getElementById("input").value.trim();

  if (!seed || !text) {
    alert("Brak seeda lub danych.");
    return;
  }

  const random = createSeededRandom(seed);
  const baskets = parseInput(text);

  const basketCount = baskets.length;
  const groupCount = Math.max(...baskets.map(b => b.players.length));

  // uzupełnij koszyki slotami
  let slotCounter = 1;
  baskets.forEach(basket => {
    while (basket.players.length < groupCount) {
      basket.players.push({ name: `Slot ${slotCounter++}`, club: "-" });
    }
    shuffle(basket.players, random);
  });

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: i + 1,
    players: []
  }));

  const steps = [];
  baskets.forEach((basket, basketIndex) => {
    for (let g = 0; g < groupCount; g++) {
      const p = basket.players[g];
      groups[g].players.push(p);
      steps.push({
        basket: basketIndex + 1,
        group: g + 1,
        player: p
      });
    }
  });

  document.getElementById("log").innerHTML = "";
  document.getElementById("result").textContent = "";

  playSteps(steps, groups);
}

// ---------- animation ----------
function playSteps(steps, groups) {
  const log = document.getElementById("log");
  let i = 0;

  function next() {
    if (i >= steps.length) {
      showResult(groups);
      return;
    }
    const s = steps[i];
    const div = document.createElement("div");
    div.textContent =
      `Koszyk ${s.basket} → Grupa ${s.group}: ${s.player.name} (${s.player.club})`;
    log.appendChild(div);
    i++;
    setTimeout(next, 600);
  }
  next();
}

// ---------- result ----------
function showResult(groups) {
  const result = document.getElementById("result");
  groups.forEach(g => {
    result.textContent += `Grupa ${g.id}:\n`;
    g.players.forEach(p => {
      result.textContent += `  - ${p.name} (${p.club})\n`;
    });
    result.textContent += "\n";
  });
}

// ---------- parsing ----------
function parseInput(text) {
  const lines = text.split("\n");
  const baskets = [];
  let current = null;

  lines.forEach(line => {
    const l = line.trim();
    if (!l) return;

    if (l.startsWith("KOSZYK")) {
      current = { players: [] };
      baskets.push(current);
      return;
    }

    const parts = l.split(/\t+/);
    current.players.push({
      name: parts[0],
      club: parts[1] || "-"
    });
  });

  return baskets;
}

// ---------- shuffle ----------
function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
