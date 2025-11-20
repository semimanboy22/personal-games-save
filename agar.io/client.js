// Offline single-player version with AI bots and selectable modes
(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let width = 800, height = 600;
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; width = canvas.width; height = canvas.height; }
  window.addEventListener('resize', resize);
  resize();

  // UI elements
  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('startBtn');
  const nameInput = document.getElementById('nameInput');
  const colorInput = document.getElementById('colorInput');
  const modeSelect = document.getElementById('modeSelect');
  const botCountInput = document.getElementById('botCount');
  const hud = document.getElementById('hud');
  const playerInfo = document.getElementById('playerInfo');
  const modeInfo = document.getElementById('modeInfo');
  const leaderboard = document.getElementById('leaderboard');

  // World
  const WORLD_W = 5000, WORLD_H = 5000;
  const foods = [];
  function spawnFood(n){ for(let i=0;i<n;i++) foods.push({x:Math.random()*WORLD_W,y:Math.random()*WORLD_H,id:Math.random().toString(36).slice(2)}); }
  spawnFood(600);

  // Entities
  class Cell { constructor(x,y,mass,color,name,isPlayer=false){ this.x=x;this.y=y;this.mass=mass;this.vx=0;this.vy=0;this.color=color;this.name=name;this.canMergeAt=Date.now()+1000;this.invulnerableUntil=0;this.isPlayer=isPlayer } radius(){ return Math.max(6, Math.sqrt(this.mass)*6) } }
  class Player { constructor(name,color,isBot=false){ this.name=name;this.color=color;this.isBot=isBot; this.cells=[new Cell(Math.random()*WORLD_W,Math.random()*WORLD_H,10,color,name,isBot)]; this.target=null; this.score=0; this.isIt=false; this.lastSplitAt=0 } }

  let player = null;
  const bots = [];

  // Input
  const mouse = {x:0,y:0};
  canvas.addEventListener('mousemove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY });
  window.addEventListener('keydown', e=>{ if(e.code==='Space') splitPlayer(); });

  function splitPlayer(){ if(!player) return; // split largest cell
    let largest=0; for(let i=1;i<player.cells.length;i++) if(player.cells[i].mass>player.cells[largest].mass) largest=i;
    const cell=player.cells[largest]; if(cell.mass<=20) return;
    const m=Math.floor(cell.mass/2); cell.mass=Math.ceil(cell.mass/2);
    const angle=Math.atan2(player.target?.y - cell.y||0, player.target?.x - cell.x||1);
    const speed=10; const nc=new Cell(cell.x+Math.cos(angle)*cell.radius(), cell.y+Math.sin(angle)*cell.radius(), m, player.color, player.name, true);
    nc.vx=Math.cos(angle)*speed; nc.vy=Math.sin(angle)*speed; nc.canMergeAt=Date.now()+3000; nc.invulnerableUntil = Date.now() + 2000; player.cells.push(nc);
  }

  // generic split function usable by bots
  function splitEntity(ent, targetX, targetY){
    if(!ent) return false;
    // find largest cell
    let largest=0; for(let i=1;i<ent.cells.length;i++) if(ent.cells[i].mass>ent.cells[largest].mass) largest=i;
    const cell = ent.cells[largest];
    if(!cell || cell.mass <= 20) return false;
    const m = Math.floor(cell.mass/2);
    cell.mass = Math.ceil(cell.mass/2);
    const angle = Math.atan2((targetY||cell.y) - cell.y, (targetX||cell.x) - cell.x);
    const speed = 12;
    const nc = new Cell(cell.x + Math.cos(angle)*cell.radius(), cell.y + Math.sin(angle)*cell.radius(), m, ent.color || '#888', ent.name || 'Bot', ent.isBot || false);
    nc.vx = Math.cos(angle)*speed; nc.vy = Math.sin(angle)*speed; nc.canMergeAt = Date.now() + 3000; nc.invulnerableUntil = Date.now() + 2000;
    ent.cells.push(nc);
    ent.lastSplitAt = Date.now();
    return true;
  }

  // Update leaderboard UI with top N players by total mass
  function updateLeaderboard(entities){
    try{
      if(!leaderboard) return;
      const list = entities.map(e=>({ name: e.name||'Bot', mass: e.cells.reduce((s,c)=>s+c.mass,0), color: e.color || '#888', isLocal: (e===player) }));
      list.sort((a,b)=>b.mass - a.mass);
      const top = list.slice(0,10);
      let html = '<strong>Top 10</strong>';
      for(let i=0;i<top.length;i++){
        const it = top[i];
        const bg = it.isLocal ? 'background:rgba(255,255,255,0.06);padding:4px;border-radius:4px' : '';
        html += `<div class="lb-entry" style="${bg}"><div class=\"lb-left\"><span class=\"lb-swatch\" style=\"background:${it.color}\"></span><span class=\"lb-name\">${i+1}. ${escapeHtml(it.name)}</span></div><div class=\"lb-mass\">${Math.round(it.mass)}</div></div>`;
      }
      leaderboard.innerHTML = html;
    }catch(e){ /* ignore errors */ }
  }

  function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  // Game loop
  let last = performance.now();
  let mode = 'ffa';
  let safeZone = {x:WORLD_W/2,y:WORLD_H/2,r:Math.min(WORLD_W,WORLD_H)/2};

  function startGame(){
    const name = (nameInput.value||'Player').slice(0,20);
    const color = colorInput.value||'#66a3ff';
    mode = modeSelect.value;
    const botCount = Math.max(1, Math.min(50, parseInt(botCountInput.value)||8));
    player = new Player(name,color,false);
    player.cells[0].x = WORLD_W/2; player.cells[0].y = WORLD_H/2;
    // brief invulnerability at start
    player.cells[0].invulnerableUntil = Date.now() + 2000;
    bots.length=0; for(let i=0;i<botCount;i++) bots.push(new Player('Bot'+(i+1), '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'), true));
    // center bots
    for(const b of bots){ b.cells[0].x=Math.random()*WORLD_W; b.cells[0].y=Math.random()*WORLD_H; b.cells[0].invulnerableUntil = Date.now() + 2000 }
    // mode-specific init
    safeZone = {x:WORLD_W/2,y:WORLD_H/2,r:Math.min(WORLD_W,WORLD_H)/2};
    if(mode==='tag'){ // choose random 'it'
      const all=[player,...bots]; const it = all[Math.floor(Math.random()*all.length)]; it.isIt=true;
    }
    menu.style.display='none'; hud.style.display='block'; modeInfo.style.display='block';
    if(leaderboard) leaderboard.style.display = 'block';
    requestAnimationFrame(tick);
  }
  startBtn.addEventListener('click', startGame);

  function worldToScreen(wx,wy,me){ return { x: wx - me.cells[0].x + width/2, y: wy - me.cells[0].y + height/2 } }

  function tick(ts){ const dt = Math.min(40, ts-last); last = ts;
    // update targets
    if(player){ const mx = player.cells[0].x - width/2 + mouse.x; const my = player.cells[0].y - height/2 + mouse.y; player.target={x:mx,y:my} }
    // AI behavior (improved): avoid invulnerable players and flee big players
    const now = Date.now();
    for(const b of bots){
      // compute bot mass
      const botMass = b.cells.reduce((s,c)=>s+c.mass,0);

      // find nearby larger threats
      let nearestThreat = null; let threatDist = Infinity;
      const others = [player, ...bots].filter(x=>x && x!==b);
      for(const o of others){
        const oMass = o.cells.reduce((s,c)=>s+c.mass,0);
        // treat invulnerable players as threats to avoid (don't chase)
        const isInvulnerable = o.cells.some(c=>c.invulnerableUntil && c.invulnerableUntil > now);
        // distance to entity (use first cell as representative)
        const dx = (o.cells[0].x - b.cells[0].x); const dy = (o.cells[0].y - b.cells[0].y); const d = Math.hypot(dx,dy);
        // consider a threat if much larger and reasonably close
        if(oMass > botMass * 1.2 && d < Math.max(200, Math.sqrt(oMass)*12)){
          if(d < threatDist){ threatDist = d; nearestThreat = o; }
        }
        // also mark invulnerable nearby entities to avoid
        if(isInvulnerable && d < Math.max(180, Math.sqrt(oMass)*10)){
          if(d < threatDist){ threatDist = d; nearestThreat = o; }
        }
      }

      if(nearestThreat){
        // flee away from threat
        const ox = nearestThreat.cells[0].x; const oy = nearestThreat.cells[0].y;
        const bx = b.cells[0].x; const by = b.cells[0].y;
        const dx = bx - ox; const dy = by - oy; const dist = Math.hypot(dx,dy) || 1;
        const fleeDist = 200 + Math.sqrt(botMass)*10;
        b.target = { x: bx + (dx/dist) * fleeDist, y: by + (dy/dist) * fleeDist };
        continue;
      }

      // prefer nearest safe food (not too close to larger players)
      let bestFood = null; let bestFoodDist = Infinity;
      FOOD_LOOP: for(const f of foods){
        const fd = Math.hypot(f.x - b.cells[0].x, f.y - b.cells[0].y);
        if(fd > 1200) continue; // ignore too far food to reduce computation
        // check safety: ensure no much larger player is very close to this food
        for(const o of others){
          const oMass = o.cells.reduce((s,c)=>s+c.mass,0);
          if(oMass > botMass * 1.2){
            const od = Math.hypot(o.cells[0].x - f.x, o.cells[0].y - f.y);
            if(od < Math.max(80, Math.sqrt(oMass)*6)) continue FOOD_LOOP; // unsafe
          }
          // avoid invulnerable players
          if(o.cells.some(c=>c.invulnerableUntil && c.invulnerableUntil > now)){
            const od = Math.hypot(o.cells[0].x - f.x, o.cells[0].y - f.y);
            if(od < 120) continue FOOD_LOOP;
          }
        }
        if(fd < bestFoodDist){ bestFoodDist = fd; bestFood = f; }
      }
      if(bestFood){ b.target = { x: bestFood.x, y: bestFood.y }; continue; }

      // chase smaller nearby player if safe
      let prey = null; let preyDist = Infinity;
      for(const o of others){
        const oMass = o.cells.reduce((s,c)=>s+c.mass,0);
        if(oMass < botMass * 0.95 && !o.cells.some(c=>c.invulnerableUntil && c.invulnerableUntil > now)){
          const d = Math.hypot(o.cells[0].x - b.cells[0].x, o.cells[0].y - b.cells[0].y);
          if(d < preyDist && d < 800){ preyDist = d; prey = o; }
        }
      }
      if(prey){
        // consider splitting to catch prey: if prey mass is at least half of bot mass, split (if cooldown passed)
        const preyMass = prey.cells.reduce((s,c)=>s+c.mass,0);
        const botMassNow = b.cells.reduce((s,c)=>s+c.mass,0);
        const largestCellMass = Math.max(...b.cells.map(c=>c.mass));
        if(preyMass >= botMassNow * 0.5 && Date.now() - (b.lastSplitAt||0) > 1500 && largestCellMass > 30){
          splitEntity(b, prey.cells[0].x, prey.cells[0].y);
        }
        b.target = { x: prey.cells[0].x, y: prey.cells[0].y };
        continue;
      }

      // fallback: wander to random nearby point
      if(!b.target || Math.random() < 0.02){ b.target = { x: b.cells[0].x + (Math.random()-0.5)*800, y: b.cells[0].y + (Math.random()-0.5)*800 }; }
    }

    const entities = [player, ...bots].filter(Boolean);
    // movement
    for(const e of entities){ for(const c of e.cells){ const tgt = e.target || e.cells[0]; const dx = tgt.x - c.x; const dy = tgt.y - c.y; const dist = Math.hypot(dx,dy) || 1;
        // larger masses move slower: reduce speed as mass grows
        let speed = Math.max(0.4, 6 / (1 + Math.sqrt(c.mass) * 0.15));
        if(mode==='experimental') speed *= 1.6; // faster in experimental
        const ax = (dx/dist) * speed * 0.06; const ay = (dy/dist) * speed * 0.06; c.vx += ax; c.vy += ay; c.x += c.vx; c.y += c.vy; c.vx *= (mode==='experimental'?0.94:0.90); c.vy *= (mode==='experimental'?0.94:0.90);
        // clamp
        c.x = Math.max(0,Math.min(WORLD_W,c.x)); c.y = Math.max(0,Math.min(WORLD_H,c.y));
      }}

    // collisions: food
    for(const e of entities){ for(const c of e.cells){ for(let i=foods.length-1;i>=0;i--){ const f=foods[i]; const r=c.radius()+4; if(Math.abs(c.x-f.x)<r && Math.abs(c.y-f.y)<r && Math.hypot(c.x-f.x,c.y-f.y)<r){ c.mass+=1; foods.splice(i,1) } } } }

    // player-cell collisions (consumption)
    for(let i=0;i<entities.length;i++){
      for(let j=0;j<entities.length;j++){
        if(i===j) continue;
        const A=entities[i];
        const B=entities[j];
        for(let ia=A.cells.length-1;ia>=0;ia--){
          for(let jb=B.cells.length-1;jb>=0;jb--){
            const a=A.cells[ia], b=B.cells[jb];
            const ra=a.radius(), rb=b.radius();
            const d=Math.hypot(a.x-b.x,a.y-b.y);
            // if victim is temporarily invulnerable, skip
            if (b.invulnerableUntil && Date.now() < b.invulnerableUntil) continue;
            if(d<ra - rb*0.25 && a.mass> b.mass*1.1){
              // add eaten mass to eater (some loss)
              a.mass += b.mass*0.9;
              // remove eaten cell
              B.cells.splice(jb,1);
              // if the eaten entity has no cells left, respawn it as a bot/player starter cell
              if(B.cells.length === 0){
                const respawnMass = 10;
                const rx = Math.random()*WORLD_W;
                const ry = Math.random()*WORLD_H;
                const newCell = new Cell(rx, ry, respawnMass, B.color || '#888', B.name || 'Bot', B.isBot || false);
                // ensure respawned cell cannot immediately merge
                newCell.canMergeAt = Date.now() + 1000;
                // brief invulnerability after respawn
                newCell.invulnerableUntil = Date.now() + 2000;
                B.cells.push(newCell);
              }
            }
          }
        }
      }
    }

    // merge same-player cells
    for(const e of entities){ if(e.cells.length<=1) continue; let merged=false; for(let i=0;i<e.cells.length && !merged;i++){ for(let j=i+1;j<e.cells.length && !merged;j++){ const a=e.cells[i], b=e.cells[j]; if(Date.now()<a.canMergeAt||Date.now()<b.canMergeAt) continue; const d=Math.hypot(a.x-b.x,a.y-b.y); if(d< a.radius()*0.6 + b.radius()*0.6){ a.mass+=b.mass; a.vx=(a.vx+b.vx)/2; a.vy=(a.vy+b.vy)/2; e.cells.splice(j,1); merged=true; } } } }

    // respawn food
    while(foods.length<600) spawnFood(20);

    // mode rules
    if(mode==='battle'){ safeZone.r = Math.max(80, safeZone.r - 0.02 * dt); }
    if(mode==='battle' || mode==='tag'){ // apply outside safe zone damage
      for(const e of entities){ for(const c of e.cells){ const d = Math.hypot(c.x-safeZone.x,c.y-safeZone.y); if(mode==='battle' && d>safeZone.r){ c.mass -= 0.02 * dt; if(c.mass<1) c.mass=1 } } }
    }
    if(mode==='tag'){ // update tag: if 'it' touches someone, transfer
      const allEntities=[player,...bots].filter(Boolean);
      let it = allEntities.find(x=>x.isIt);
      if(!it){ it = allEntities[Math.floor(Math.random()*allEntities.length)]; if(it) it.isIt=true }
      // if it collides with someone else
      for(const target of allEntities){ if(target===it) continue; for(const a of it.cells){ for(const b of target.cells){ if(Math.hypot(a.x-b.x,a.y-b.y) < a.radius()){ it.isIt=false; target.isIt=true; it=null; break; } } if(!it) break } if(!it) break }
    }

    // HUD
    if(player){ playerInfo.innerText = `${player.name} — Mass: ${Math.round(player.cells.reduce((s,c)=>s+c.mass,0))} — Cells: ${player.cells.length}`; }
    if(mode==='battle'){ modeInfo.innerText = `Battle Royale — Safe radius: ${Math.round(safeZone.r)}` } else if(mode==='tag'){ modeInfo.innerText = `Tag — ${ (player.isIt? 'You are IT!':'Not IT') }` } else if(mode==='experimental'){ modeInfo.innerText = 'Experimental — Faster, slippery physics' } else { modeInfo.innerText = 'FFA' }
    // update leaderboard
    try{ updateLeaderboard(entities); }catch(e){}

    // render
    render();
    requestAnimationFrame(tick);
  }

  function render(){ if(!player) return; ctx.clearRect(0,0,width,height);
    // background
    ctx.fillStyle='#0b0b0b'; ctx.fillRect(0,0,width,height);
    // draw safe zone for battle
    const me = player;
    // foods
    for(const f of foods){ const s = worldToScreen(f.x,f.y,me); if(s.x< -10||s.y<-10||s.x>width+10||s.y>height+10) continue; ctx.fillStyle='#7fff66'; ctx.beginPath(); ctx.arc(s.x,s.y,4,0,Math.PI*2); ctx.fill() }
    // players and bots
    const all=[player,...bots];
    for(const p of all){ for(const c of p.cells){ const s = worldToScreen(c.x,c.y,me); const r = c.radius(); if(s.x < -r || s.y < -r || s.x > width+r || s.y > height+r) continue; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(s.x,s.y,r,0,Math.PI*2); ctx.fill(); if(p.isIt){ ctx.strokeStyle='#ffff00'; ctx.lineWidth=3; ctx.stroke(); } } // names
      const base = p.cells[0]; const sb = worldToScreen(base.x,base.y,me); ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.fillText(p.name || 'Bot', sb.x-20, sb.y - base.radius() - 8);
    }
    // safe zone overlay
    if(mode==='battle'){ const s = worldToScreen(safeZone.x, safeZone.y, me); ctx.beginPath(); ctx.strokeStyle='rgba(0,200,255,0.2)'; ctx.lineWidth=4; ctx.arc(s.x,s.y, safeZone.r,0,Math.PI*2); ctx.stroke(); }
  }

  // start info
  modeInfo.style.display='none';
  // expose startGame for tests
  window.__agar_start = startGame;
})();
