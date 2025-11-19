# Snake — browser version

A small, self-contained Snake game written in HTML/CSS/JS.

Files
- `index.html` — game page
- `style.css` — styles
- `script.js` — game logic

How to run

Option 1 — Open directly
- Open `index.html` in your browser (double-click). On some browsers local file restrictions may affect behavior; if you see a blank canvas, use option 2.

Option 2 — Serve with a simple static server (recommended)

Using Python 3 (PowerShell):

```powershell
python -m http.server 8000
# then open http://localhost:8000/snake/
```

Controls & start
- Press any movement key (W/A/S/D or Arrow keys) to start the game. The initial board shows a centered overlay with instructions.
- Use arrow keys or WASD to move.
- Space to pause/resume.

Customization (change in code)
- Map size: open `snake/script.js` and edit the top-level constants `COLS` and `ROWS` to change the board dimensions (width, height in cells). The canvas and grid will resize automatically.
 

Customization (base speed)
- Base step time: open `snake/script.js` and edit `BASE_STEP_MS` (milliseconds per step) to change the base speed used by the game.

Speed (pause menu)
- The in-game pause menu contains a Speed × slider that acts as a multiplier of `BASE_STEP_MS`. For example, set `BASE_STEP_MS = 120` and set the slider to `1.5` to make the snake move at 120/1.5 ms per step (faster).
- Open the pause menu with Space or Esc. Adjust the slider while paused; resuming will apply the multiplier immediately.

Apples / food
- Change how many apples spawn after you eat one by editing `APPLES_ON_EAT` in `snake/script.js`. For example set `APPLES_ON_EAT = 2` to spawn two new apples whenever you eat one.

Map size note
- To change the map size, edit the `COLS` and `ROWS` constants near the top of `snake/script.js`. Example:

```js
// width and height of the grid in cells
const COLS = 30;
const ROWS = 20;
```

After changing those values reload the page. The canvas and snake will initialize to the new size.

Cell size note
- To change how big the snake and food appear on screen (in pixels), edit `CELL_SIZE` near the top of `snake/script.js`. Keeping `CELL_SIZE` larger will make each grid cell bigger; changing `COLS`/`ROWS` then increases the overall canvas size while the snake/food retain the same pixel size.

Notes & ideas
- The game ends when you hit a wall (Game Over) and a game-over overlay appears; press Restart or press a movement key to start again.
- I can add wrap-around behavior, touch controls, persistent high scores, difficulty levels, or a Python/pygame port. Tell me which you'd like next.
