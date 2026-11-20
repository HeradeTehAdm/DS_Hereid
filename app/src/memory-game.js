const symbols = [
  ["🌙","Луна"], ["🪐","Сатурн"], ["☄️","Комета"],
  ["🚀","Ракета"], ["🛰️","Спутник"], ["☀️","Солнце"]
];

export class MemoryGame {
  constructor(random = Math.random) {
    this.cards = symbols.flatMap((_, index) => [index,index]);
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.cards[i],this.cards[j]] = [this.cards[j],this.cards[i]];
    }
    this.open = [];
    this.matched = new Set();
    this.moves = 0;
  }

  choose(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.cards.length ||
        this.open.length === 2 || this.open.includes(index) || this.matched.has(index)) return;
    this.open.push(index);
    if (this.open.length < 2) return;
    this.moves++;
    const [a,b] = this.open;
    if (this.cards[a] === this.cards[b]) {
      this.matched.add(a);
      this.matched.add(b);
      this.open = [];
    }
  }

  closeMismatch() {
    if (this.open.length === 2) this.open = [];
  }
}

let game;
let timer;
function status() {
  if (game.matched.size === game.cards.length) return "Все пары найдены! Ходов: " + game.moves + ".";
  if (game.open.length === 2) return "Разные карты. Запомни их места.";
  if (game.open.length === 1) return "Выбери вторую карту.";
  if (game.moves) return "Найдено пар: " + game.matched.size/2 + " из " + symbols.length + ".";
  return "Открой две карты с одинаковыми символами.";
}

function update(board) {
  board.querySelector("[data-moves]").textContent = game.moves;
  board.querySelector("[data-pairs]").textContent = game.matched.size/2 + " / " + symbols.length;
  board.querySelector('[role="status"]').textContent = status();
  for (const button of board.querySelectorAll("[data-card]")) {
    const i = Number(button.dataset.card);
    const matched = game.matched.has(i);
    const visible = matched || game.open.includes(i);
    const [icon,label] = symbols[game.cards[i]];
    button.dataset.state = matched ? "matched" : visible ? "open" : "closed";
    button.setAttribute("aria-disabled", String(visible || game.open.length === 2));
    button.setAttribute("aria-label","Карта " + (i+1) + (visible ? ", "+label+(matched ? ", пара найдена" : "") : ", закрыта"));
    button.querySelector(".card-face").textContent = visible ? icon : "✧";
  }
}

export function memoryPage() {
  game ??= new MemoryGame();
  return '<section class="memory-game"><header class="heading"><h1>Найди пару</h1></header>'+
    '<div class="game-tools"><span>Ходы <strong data-moves></strong></span><span>Пары <strong data-pairs></strong></span>'+
    '<button type="button" class="game-reset" data-new-game>Новая партия</button></div>'+
    '<p role="status" aria-live="polite"></p><div class="memory-grid" role="group" aria-label="Игровое поле">'+
    game.cards.map((_,i)=>'<button type="button" class="memory-card" data-card="'+i+'"><span class="card-face" aria-hidden="true"></span></button>').join("")+'</div></section>';
}

export function bindMemory(board) {
  update(board);
  board.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-new-game")) {
      clearTimeout(timer);
      game = new MemoryGame();
    } else if (button.hasAttribute("data-card")) {
      if (button.getAttribute("aria-disabled") === "true") return;
      game.choose(Number(button.dataset.card));
      if (game.open.length === 2) {
        timer = setTimeout(() => {
          game.closeMismatch();
          const currentBoard = document.querySelector(".memory-game");
          if (currentBoard) update(currentBoard);
        }, 850);
      }
    }
    update(board);
  });
}

