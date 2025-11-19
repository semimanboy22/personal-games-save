/**
 * Simple, readable grid-based Snake game.
 *
 * Improvements made:
 * - Added clear function headers and comments
 * - startGame(initialDir) allows starting the game with the first direction
 * - Pressing a movement key (W/A/S/D or arrow keys) will start the game if it's not running
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('overlay');
const preStart = document.getElementById('preStart');
const gameOverDiv = document.getElementById('gameOver');
const overlayScore = document.getElementById('overlayScore');
const overlayRestart = document.getElementById('overlayRestart');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const pauseMenu = document.getElementById('pauseMenu');
const resumeBtn = document.getElementById('resumeBtn');
const overlayRestart2 = document.getElementById('overlayRestart2');

// -----------------------------
// Game configuration (edit these)
// -----------------------------
// Change the map size here by modifying COLS and ROWS. These set the
// number of grid cells horizontally and vertically. After you change them
// the canvas will automatically resize to fit the new grid.
const COLS = 40; // number of columns (width in cells)
const ROWS = 40; // number of rows (height in cells)

// Cell size in pixels. Edit this to change how big each grid cell (snake segment / food)
// appears on screen. Keeping this value fixed ensures that increasing COLS/ROWS
// makes the map larger while the snake and food remain the same visual size.
const CELL_SIZE = 20; // pixels per cell (edit to change visual size)

// SCALE is the size of one grid cell in pixels (kept equal to CELL_SIZE).
let SCALE = CELL_SIZE; // pixel size per cell (calculated in init)

// Base step time in milliseconds. Edit this to change the base speed used by
// the game. The in-game pause menu slider acts as a multiplier of this base.
// Example: BASE_STEP_MS = 120 and slider = 1.5 => effective ms = 120 / 1.5.
const BASE_STEP_MS = 120; // editable base ms per step (change this in code)

// Current multiplier value (controlled by the pause menu slider)
let speedMultiplier = 1.5;

// -----------------------------
// Food / apples configuration
// -----------------------------
// Change how many apples spawn after you eat one by editing APPLES_ON_EAT.
// For example, set APPLES_ON_EAT = 2 to spawn two new apples whenever you eat one.
const APPLES_ON_EAT = 100; // default: spawn 1 new apple after eating

// Game state
let snake = []; // array of segments {x,y}, head is snake[0]
let dir = {x: 1, y: 0}; // current direction
let nextDir = {x: 1, y: 0}; // direction to apply on next tick
let foods = []; // array of food positions [{x,y}, ...]
let score = 0;
let running = false;
let stepMs = BASE_STEP_MS; // ms per game step (actual, after applying multiplier)
let timer = null;
let firstStart = true; // if true, the first start will be slower (multiplied)

// ----- Utility functions -----
function randCell() {
  return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
}

function placeFood() {
  // (deprecated) kept for compatibility
  placeFoods(1);
}

/**
 * Place `count` food items on empty cells (not on snake or existing foods).
 * If the board is nearly full this will try up to a limited number of attempts
 * per food to avoid infinite loops.
 */
function placeFoods(count) {
  const maxAttempts = 200;
  for (let n = 0; n < count; n++) {
    let attempts = 0;
    let p;
    do {
      p = randCell();
      attempts++;
      if (attempts > maxAttempts) break;
    } while (
      snake.some(s => s.x === p.x && s.y === p.y) ||
      foods.some(f => f.x === p.x && f.y === p.y)
    );
    if (attempts <= maxAttempts) {
      foods.push(p);
    }
  }
}

// ----- Rendering -----
function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, SCALE - 1, SCALE - 1);
}

function draw() {
  // background
  ctx.fillStyle = '#071021';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // foods (apples)
  for (const f of foods) drawCell(f.x, f.y, '#ff6b6b');

  // snake (head a different color)
  for (let i = 0; i < snake.length; i++) {
    const s = snake[i];
    drawCell(s.x, s.y, i === 0 ? '#34d399' : '#10b981');
  }

  // draw two small black square "eyes" on the head so player knows facing
  // direction. Eyes are placed relative to `dir` so they appear on the
  // leading edge of the head segment.
  if (snake.length > 0) {
    const head = snake[0];
    const eyeSize = Math.max(2, Math.floor(SCALE * 0.18));
    ctx.fillStyle = '#000';

    if (dir.x === 1) {
      // facing right: eyes on the right side (top and bottom)
      const ex = head.x * SCALE + SCALE - eyeSize - 2;
      const ey1 = head.y * SCALE + Math.floor(SCALE * 0.25);
      const ey2 = head.y * SCALE + Math.floor(SCALE * 0.65);
      ctx.fillRect(ex, ey1, eyeSize, eyeSize);
      ctx.fillRect(ex, ey2, eyeSize, eyeSize);
    } else if (dir.x === -1) {
      // facing left: eyes on the left side
      const ex = head.x * SCALE + 2;
      const ey1 = head.y * SCALE + Math.floor(SCALE * 0.25);
      const ey2 = head.y * SCALE + Math.floor(SCALE * 0.65);
      ctx.fillRect(ex, ey1, eyeSize, eyeSize);
      ctx.fillRect(ex, ey2, eyeSize, eyeSize);
    } else if (dir.y === 1) {
      // facing down: eyes on bottom side (left and right)
      const ey = head.y * SCALE + SCALE - eyeSize - 2;
      const ex1 = head.x * SCALE + Math.floor(SCALE * 0.25);
      const ex2 = head.x * SCALE + Math.floor(SCALE * 0.65);
      ctx.fillRect(ex1, ey, eyeSize, eyeSize);
      ctx.fillRect(ex2, ey, eyeSize, eyeSize);
    } else if (dir.y === -1) {
      // facing up: eyes on top side
      const ey = head.y * SCALE + 2;
      const ex1 = head.x * SCALE + Math.floor(SCALE * 0.25);
      const ex2 = head.x * SCALE + Math.floor(SCALE * 0.65);
      ctx.fillRect(ex1, ey, eyeSize, eyeSize);
      ctx.fillRect(ex2, ey, eyeSize, eyeSize);
    }
  }
}

// ----- Game lifecycle -----
function init(initialDir) {
  // Use the fixed cell size so the map grows when COLS/ROWS increase.
  SCALE = CELL_SIZE;
  canvas.width = COLS * SCALE;
  canvas.height = ROWS * SCALE;
  // Make the displayed size match the internal canvas pixel size.
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  // place the snake centered on the board as a 2-block snake to avoid
  // accidental immediate reversals. If an initialDir is provided, align
  // the snake with that direction so pressing a key both sets direction
  // and produces sensible motion.
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);

  const startDir = initialDir || { x: 1, y: 0 };
  // head at center, tail immediately behind head (opposite to movement)
  snake = [
    { x: cx, y: cy },
    { x: cx - startDir.x, y: cy - startDir.y }
  ];

  dir = { x: startDir.x, y: startDir.y };
  nextDir = { x: startDir.x, y: startDir.y };

  score = 0;
  running = false;
  foods = [];
  // initial food placement: one apple at start
  placeFoods(1);
  scoreEl.textContent = `Score: ${score}`;
  // do not hide overlays here; caller will show/hide as appropriate
  draw();
}

/**
 * Start the game. Optionally provide an initialDir so the first key press can both set
 * the direction and start the game.
 * @param {{x:number,y:number}} initialDir
 */
function startGame(initialDir) {
  // initialize board using the requested initialDir (if any) so the
  // snake is placed consistently with that direction and cannot immediately
  // reverse into itself.
  init(initialDir);
  if (initialDir) {
    // ensure the first applied direction is the requested one
    nextDir = { x: initialDir.x, y: initialDir.y };
    dir = { x: initialDir.x, y: initialDir.y };
  }
  running = true;
  // Compute the effective base ms from the BASE_STEP_MS and current slider multiplier.
  const baseMs = Math.max(1, Math.round(BASE_STEP_MS / speedMultiplier));

  // On the very first start, make the game 4x slower (preserve prior behavior).
  stepMs = firstStart ? baseMs * 4 : baseMs;
  firstStart = false;
  hideAllOverlays();
  restartTimer();
}

function restartTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, stepMs);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function gameOver() {
  running = false;
  stopTimer();
  showGameOverOverlay();
}

function showGameOverOverlay() {
  overlayScore.textContent = `Score: ${score}`;
  gameOverDiv.classList.remove('hidden');
  preStart.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function showPauseMenu() {
  pauseMenu.classList.remove('hidden');
  preStart.classList.add('hidden');
  gameOverDiv.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  overlay.classList.add('hidden');
}

function showPreStartOverlay() {
  preStart.classList.remove('hidden');
  gameOverDiv.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function hideAllOverlays() {
  overlay.classList.add('hidden');
  preStart.classList.add('hidden');
  gameOverDiv.classList.add('hidden');
}

// ----- Game tick (update) -----
function tick() {
  if (!running) return;

  // prevent reversing into yourself (unless length==1)
  if ((nextDir.x !== -dir.x || nextDir.y !== -dir.y) || snake.length === 1) {
    dir = nextDir;
  }

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // wall collision -> game over
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    gameOver();
    return;
  }

  // self collision
  if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  // eat food
  // check if head landed on any food item
  const eatenIndex = foods.findIndex(f => f.x === head.x && f.y === head.y);
  if (eatenIndex !== -1) {
    // remove the eaten food
    foods.splice(eatenIndex, 1);
    score += 1;
    scoreEl.textContent = `Score: ${score}`;
    // spawn APPLES_ON_EAT new apples
    placeFoods(APPLES_ON_EAT);

    // NOTE: automatic speed increases removed by user request.
  } else {
    // move: drop tail
    snake.pop();
  }

  draw();
}

// ----- Input handling -----
// Movement mapping helper
function getMovementFromKey(k) {
  if (k === 'ArrowUp' || k === 'w' || k === 'W') return { x: 0, y: -1 };
  if (k === 'ArrowDown' || k === 's' || k === 'S') return { x: 0, y: 1 };
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') return { x: -1, y: 0 };
  if (k === 'ArrowRight' || k === 'd' || k === 'D') return { x: 1, y: 0 };
  return null;
}

window.addEventListener('keydown', (e) => {
  const k = e.key;
  const move = getMovementFromKey(k);

  // ESC toggles pause menu: if running -> pause, if paused -> resume
  if (k === 'Escape') {
    if (running) {
      // pause the game and show pause menu
      running = false;
      stopTimer();
      showPauseMenu();
      return;
    }
    // if pause menu is visible, resume
    if (!running && pauseMenu && !pauseMenu.classList.contains('hidden')) {
      hidePauseMenu();
      running = true;
      restartTimer();
      return;
    }
    return;
  }

  if (move) {
    // If the game isn't running, start it with this direction.
    if (!running) {
      // startGame will initialize state and then apply nextDir from initialDir
      startGame(move);
      return;
    }

    // otherwise set the next direction (applied on next tick)
    nextDir = move;
    return;
  }

  // space to pause/resume
  if (k === ' ') {
    running = !running;
    if (running) {
      // resume
      hideAllOverlays();
      restartTimer();
    } else {
      // paused via space: show pause menu
      stopTimer();
      showPauseMenu();
    }
  }
});

// Button handlers
overlayRestart.addEventListener('click', () => startGame());
overlayRestart2.addEventListener('click', () => startGame());
resumeBtn.addEventListener('click', () => {
  // resume from pause: hide pause menu and restart timer
  hidePauseMenu();
  if (!running) {
    running = true;
    restartTimer();
  }
});

// The slider in the pause menu acts as a multiplier of BASE_STEP_MS.
function mapSliderToMultiplier(v) {
  return Number(v);
}

// Update displayed multiplier and apply to running timer if needed
function applySpeedFromSlider() {
  const v = Number(speedRange.value);
  speedMultiplier = mapSliderToMultiplier(v);
  speedValue.textContent = speedMultiplier.toFixed(2);
  // compute effective ms: higher multiplier => faster, so divide base ms by multiplier
  stepMs = Math.max(1, Math.round(BASE_STEP_MS / speedMultiplier));
  if (running) restartTimer();
}

speedRange.addEventListener('input', () => applySpeedFromSlider());

// initialize on load: draw board, set slider to default and show the pre-start overlay
init();
// ensure slider displays default multiplier and computes stepMs
applySpeedFromSlider();
showPreStartOverlay();
