
console.log("draw.js loaded");

// --- deterministic seeded RNG ---
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

// --- main draw ---
function startDraw() {
  const seed = document.getElementById("seed").value.trim();
  const basketsText = document.getElementById("baskets").value;
  const groupsCount = parseInt(document.getElementById("groups").value, 10);

  if (!seed || groupsCount < 1) {
    alert("Podaj seed i liczbę grup.");
    return;
  }

  const random = createSeededRandom(seed);
  const baskets = parseBaskets(basketsText);
  const groups = Array.from({ length: groupsCount }, () => []);

  const log = document.getElementById("log");
  const result = document.getElementById("result");
  log.innerHTML = "";
  result.textContent = "";

  let steps = [];
  let globalIndex = 0;

  baskets.forEach((basket, basketIndex) => {
    shuffle(basket, random);

    basket.forEach(player => {
      const groupIndex = globalIndex % groupsCount;
      groups[groupIndex].push(player);

      steps.push({
        basket: basketIndex + 1,
        player,
        group: groupIndex + 1
      });

      globalIndex++;
    });
  });

  playSteps(steps, groups);
}

// --- animated reveal ---
function playSteps(steps, groups) {
  const log = document.getElementById("log");
  let i = 0;

  function next() {
    if (i >= steps.length) {
      showResult(groups);
      return;
    }

    const step = steps[i];
    const div = document.createElement("div");
    div.textContent = `Koszyk ${step.basket} → Grupa ${step.group}: ${step.player}`;
    log.appendChild(div);

    i++;
    setTimeout(next, 700);
  }

  next();
}

// --- final output ---
function showResult(groups) {
  const result = document.getElementById("result");
  groups.forEach((group, i) => {
    result.textContent += `Grupa ${i + 1}: ${group.join(", ")}\n`;
  });
}

// --- helpers ---
function parseBaskets(text) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(block => {
      const lines = block
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);
      return lines.slice(1); // skip "Koszyk X:"
    })
    .filter(basket => basket.length > 0);
}

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
