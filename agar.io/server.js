const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from this folder
app.use(express.static(__dirname));

// Game state
const players = new Map(); // id -> player { name, cells: [{id,x,y,mass,vx,vy,canMergeAt}], lastInput }
const foods = [];
const GAME_WIDTH = 5000;
const GAME_HEIGHT = 5000;

function spawnFood(count = 500) {
  for (let i = 0; i < count; i++) {
    foods.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, id: uuidv4() });
  }
}

spawnFood(500);

function broadcastState() {
  const playersArr = [];
  for (const [id, p] of players) {
    playersArr.push({ id, name: p.name, cells: p.cells.map(c => ({ id: c.id, x: c.x, y: c.y, mass: c.mass })) });
  }
  const payload = JSON.stringify({ type: 'state', players: playersArr, foods });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function cellRadius(mass) {
  return Math.max(6, Math.sqrt(mass) * 6);
}

setInterval(() => {
  const now = Date.now();

  for (const [id, p] of players) {
    if (!p.cells || p.cells.length === 0) {
      p.cells = [{ id: uuidv4(), x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, mass: 10, vx: 0, vy: 0, canMergeAt: now + 3000 }];
    }

    const target = p.lastInput || null;
    for (const cell of p.cells) {
      if (target) {
        const dx = target.x - cell.x;
        const dy = target.y - cell.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = Math.max(1, 7 - Math.log(cell.mass + 1));
        const ax = (dx / dist) * speed * 0.6;
        const ay = (dy / dist) * speed * 0.6;
        cell.vx += ax;
        cell.vy += ay;
      }
      cell.x += cell.vx;
      cell.y += cell.vy;
      cell.vx *= 0.92;
      cell.vy *= 0.92;
      cell.x = Math.max(0, Math.min(GAME_WIDTH, cell.x));
      cell.y = Math.max(0, Math.min(GAME_HEIGHT, cell.y));
    }
  }

  // Food collisions
  for (const [id, p] of players) {
    for (const cell of p.cells) {
      for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        const r = cellRadius(cell.mass) + 4;
        if (Math.abs(cell.x - f.x) < r && Math.abs(cell.y - f.y) < r) {
          if (distance(cell, f) < r) {
            cell.mass += 1;
            foods.splice(i, 1);
          }
        }
      }
    }
  }

  // Player vs player consumption
  const allPlayers = Array.from(players.entries());
  for (let i = 0; i < allPlayers.length; i++) {
    const [idA, pA] = allPlayers[i];
    for (let j = 0; j < allPlayers.length; j++) {
      if (i === j) continue;
      const [idB, pB] = allPlayers[j];
      for (let ca = pA.cells.length - 1; ca >= 0; ca--) {
        const cellA = pA.cells[ca];
        for (let cb = pB.cells.length - 1; cb >= 0; cb--) {
          const cellB = pB.cells[cb];
          const ra = cellRadius(cellA.mass);
          const rb = cellRadius(cellB.mass);
          const d = distance(cellA, cellB);
          if (d < ra - rb * 0.25 && cellA.mass > cellB.mass * 1.1) {
            cellA.mass += cellB.mass * 0.9;
            pB.cells.splice(cb, 1);
          }
        }
      }
    }
  }

  // Merge same-player cells
  for (const [id, p] of players) {
    if (p.cells.length <= 1) continue;
    let merged = false;
    for (let i = 0; i < p.cells.length && !merged; i++) {
      for (let j = i + 1; j < p.cells.length && !merged; j++) {
        const a = p.cells[i];
        const b = p.cells[j];
        if (Date.now() < a.canMergeAt || Date.now() < b.canMergeAt) continue;
        const d = distance(a, b);
        if (d < cellRadius(a.mass) * 0.6 + cellRadius(b.mass) * 0.6) {
          a.mass += b.mass;
          a.vx = (a.vx + b.vx) * 0.5;
          a.vy = (a.vy + b.vy) * 0.5;
          p.cells.splice(j, 1);
          merged = true;
        }
      }
    }
  }

  // Refill food
  while (foods.length < 500) {
    foods.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, id: uuidv4() });
  }

  broadcastState();
}, 1000 / 20);

wss.on('connection', (ws) => {
  const id = uuidv4();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.type === 'join') {
      const cell = { id: uuidv4(), x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, mass: 10, vx: 0, vy: 0, canMergeAt: Date.now() + 3000 };
      players.set(id, { name: msg.name || 'Anon', cells: [cell], lastInput: null });
      ws.send(JSON.stringify({ type: 'welcome', id }));
    } else if (msg.type === 'input') {
      const p = players.get(id);
      if (p) p.lastInput = { x: msg.x, y: msg.y };
    } else if (msg.type === 'split') {
      const p = players.get(id);
      if (p) {
        let largestIdx = 0;
        for (let i = 1; i < p.cells.length; i++) if (p.cells[i].mass > p.cells[largestIdx].mass) largestIdx = i;
        const cell = p.cells[largestIdx];
        if (cell.mass > 20) {
          const splitMass = Math.floor(cell.mass / 2);
          cell.mass = Math.ceil(cell.mass / 2);
          const newCell = { id: uuidv4(), x: cell.x + 1, y: cell.y + 1, mass: splitMass, vx: 0, vy: 0, canMergeAt: Date.now() + 3000 };
          if (p.lastInput) {
            const dx = p.lastInput.x - cell.x;
            const dy = p.lastInput.y - cell.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 20;
            newCell.vx = (dx / dist) * speed;
            newCell.vy = (dy / dist) * speed;
          }
          p.cells.push(newCell);
        }
      }
    }
  });

  ws.on('close', () => players.delete(id));
});

server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
