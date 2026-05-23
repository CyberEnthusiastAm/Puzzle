const board = document.querySelector("#board");
const moveCount = document.querySelector("#move-count");
const timer = document.querySelector("#timer");
const bestScore = document.querySelector("#best-score");
const statusText = document.querySelector("#status");
const shuffleButton = document.querySelector("#shuffle-button");
const undoButton = document.querySelector("#undo-button");
const hintButton = document.querySelector("#hint-button");
const solveButton = document.querySelector("#solve-button");
const winDialog = document.querySelector("#win-dialog");
const winSummary = document.querySelector("#win-summary");
const difficultyButtons = [...document.querySelectorAll("[data-size]")];

let size = 3;
let tiles = [];
let moves = 0;
let history = [];
let startedAt = null;
let timerId = null;
let locked = false;

function solvedTiles(boardSize = size) {
  const values = Array.from({ length: boardSize * boardSize - 1 }, (_, index) => index + 1);
  values.push(0);
  return values;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function elapsedSeconds() {
  if (!startedAt) {
    return 0;
  }

  return Math.floor((Date.now() - startedAt) / 1000);
}

function startTimer() {
  if (startedAt) {
    return;
  }

  startedAt = Date.now();
  timerId = window.setInterval(() => {
    timer.textContent = formatTime(elapsedSeconds());
  }, 1000);
}

function stopTimer() {
  window.clearInterval(timerId);
  timerId = null;
}

function bestKey() {
  return `circuit-shift-best-${size}`;
}

function loadBest() {
  const stored = localStorage.getItem(bestKey());
  bestScore.textContent = stored ? stored : "--";
}

function saveBest() {
  const seconds = elapsedSeconds();
  const score = `${moves}/${formatTime(seconds)}`;
  const stored = localStorage.getItem(bestKey());

  if (!stored) {
    localStorage.setItem(bestKey(), score);
    return score;
  }

  const [storedMoves, storedTime] = stored.split("/");
  const [storedMinutes, storedSeconds] = storedTime.split(":").map(Number);
  const storedTotal = storedMinutes * 60 + storedSeconds;

  if (moves < Number(storedMoves) || (moves === Number(storedMoves) && seconds < storedTotal)) {
    localStorage.setItem(bestKey(), score);
    return score;
  }

  return stored;
}

function indexToPosition(index) {
  return {
    row: Math.floor(index / size),
    col: index % size,
  };
}

function canMove(index) {
  const emptyIndex = tiles.indexOf(0);
  const tilePosition = indexToPosition(index);
  const emptyPosition = indexToPosition(emptyIndex);
  const distance = Math.abs(tilePosition.row - emptyPosition.row) + Math.abs(tilePosition.col - emptyPosition.col);
  return distance === 1;
}

function isSolved(values = tiles) {
  return values.every((value, index) => value === solvedTiles()[index]);
}

function render() {
  board.style.setProperty("--size", size);
  board.replaceChildren();

  tiles.forEach((value, index) => {
    const tile = document.createElement(value ? "button" : "div");
    tile.className = value ? "tile" : "empty-tile";

    if (value) {
      tile.type = "button";
      tile.textContent = value;
      tile.setAttribute("aria-label", `Move tile ${value}`);
      tile.disabled = locked || !canMove(index);
      tile.classList.toggle("correct", value === index + 1);
      tile.addEventListener("click", () => moveTile(index));
    } else {
      tile.setAttribute("aria-label", "Open socket");
    }

    board.append(tile);
  });

  moveCount.textContent = moves;
  undoButton.disabled = locked || history.length === 0;
}

function moveTile(index, shouldRecord = true) {
  if (locked || !canMove(index)) {
    return;
  }

  startTimer();
  const emptyIndex = tiles.indexOf(0);

  if (shouldRecord) {
    history.push([...tiles]);
    moves += 1;
  }

  [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
  render();

  if (isSolved()) {
    finishGame();
  }
}

function shuffle() {
  stopTimer();
  startedAt = null;
  timer.textContent = "00:00";
  moves = 0;
  history = [];
  locked = false;
  tiles = solvedTiles();

  let lastEmptyIndex = tiles.indexOf(0);
  const iterations = size * size * 42;

  for (let step = 0; step < iterations; step += 1) {
    const emptyIndex = tiles.indexOf(0);
    const candidates = tiles
      .map((_, index) => index)
      .filter((index) => {
        if (index === lastEmptyIndex) {
          return false;
        }
        const emptyPosition = indexToPosition(emptyIndex);
        const candidatePosition = indexToPosition(index);
        return Math.abs(emptyPosition.row - candidatePosition.row) + Math.abs(emptyPosition.col - candidatePosition.col) === 1;
      });
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    lastEmptyIndex = emptyIndex;
    [tiles[choice], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[choice]];
  }

  if (isSolved()) {
    const emptyIndex = tiles.indexOf(0);
    const fallback = emptyIndex === 0 ? 1 : emptyIndex - 1;
    [tiles[fallback], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[fallback]];
  }

  statusText.textContent = "Slide tiles into order. Use arrow keys or tap a tile beside the empty socket.";
  loadBest();
  render();
}

function undo() {
  const previous = history.pop();
  if (!previous) {
    return;
  }

  tiles = previous;
  moves = Math.max(0, moves - 1);
  statusText.textContent = "Last move reversed.";
  render();
}

function showHint() {
  const movableCorrectTile = tiles.findIndex((value, index) => value && canMove(index) && value === index + 1);
  const movableTile = movableCorrectTile >= 0 ? movableCorrectTile : tiles.findIndex((value, index) => value && canMove(index));

  if (movableTile < 0) {
    return;
  }

  const tileElement = board.children[movableTile];
  tileElement.classList.add("hint");
  statusText.textContent = `Tile ${tiles[movableTile]} can move into the open socket.`;
  window.setTimeout(() => tileElement.classList.remove("hint"), 2700);
}

function previewSolution() {
  locked = true;
  statusText.textContent = "Previewing the solved circuit.";
  tiles = solvedTiles();
  render();

  window.setTimeout(() => {
    locked = false;
    shuffle();
  }, 1600);
}

function finishGame() {
  locked = true;
  stopTimer();
  const best = saveBest();
  loadBest();
  winSummary.textContent = `Finished ${size}x${size} in ${moves} moves and ${formatTime(elapsedSeconds())}. Best: ${best}.`;
  statusText.textContent = "Circuit restored. Nicely done.";
  render();
  winDialog.showModal();
}

function changeSize(nextSize) {
  size = nextSize;
  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.size) === size);
  });
  shuffle();
}

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => changeSize(Number(button.dataset.size)));
});

shuffleButton.addEventListener("click", shuffle);
undoButton.addEventListener("click", undo);
hintButton.addEventListener("click", showHint);
solveButton.addEventListener("click", previewSolution);
winDialog.addEventListener("close", shuffle);

document.addEventListener("keydown", (event) => {
  const emptyIndex = tiles.indexOf(0);
  const { row, col } = indexToPosition(emptyIndex);
  const keyMoves = {
    ArrowUp: row < size - 1 ? emptyIndex + size : null,
    ArrowDown: row > 0 ? emptyIndex - size : null,
    ArrowLeft: col < size - 1 ? emptyIndex + 1 : null,
    ArrowRight: col > 0 ? emptyIndex - 1 : null,
  };

  if (!(event.key in keyMoves) || keyMoves[event.key] === null) {
    return;
  }

  event.preventDefault();
  moveTile(keyMoves[event.key]);
});

shuffle();
