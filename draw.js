
function startDraw() {
  const seed = document.getElementById("seed").value.trim();
  const basketsText = document.getElementById("baskets").value;
  const groupsCount = parseInt(document.getElementById("groups").value, 10);

  if (!seed) {
    alert("Podaj seed losowania!");
    return;
  }

  Math.seedrandom(seed);

  const baskets = parseBaskets(basketsText);
  const groups = Array.from({ length: groupsCount }, () => []);

  const log = document.getElementById("log");
  const result = document.getElementById("result");
  log.innerHTML = "";
  result.textContent = "";

  let steps = [];

  baskets.forEach((basket, basketIndex) => {
    shuffle(basket);

    basket.forEach((player, i) => {
      const groupIndex = i % groupsCount;
      groups[groupIndex].push(player);

      steps.push({
        basket: basketIndex + 1,
        player,
        group: groupIndex + 1
      });
    });
  });

  playSteps(steps, groups);
}

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
    setTimeout(next, 800);
  }

  next();
}

function showResult(groups) {
  const result = document.getElementById("result");

  groups.forEach((group, i) => {
    result.textContent += `Grupa ${i + 1}: ${group.join(", ")}\n`;
  });
}

function parseBaskets(text) {
  return text
    .split(/\n\s*\n/)
    .map(block =>
      block
        .split("\n")
        .slice(1)
        .map(line => line.trim())
        .filter(Boolean)
    )
    .filter(b => b.length > 0);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
