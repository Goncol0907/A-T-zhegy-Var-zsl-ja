/**
 * A Tűzhegy Varázslója — Digitális Adaptáció
 * Teljes játékmenet-logika
 * Steve Jackson & Ian Livingstone (1982) | Magyar ford.: Fekete Miklós (1989)
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
//  GLOBALS & STATE
// ═══════════════════════════════════════════════════════════════
let SECTIONS = {};   // loaded from sections.json
let gameState = {};  // active game state

const DEFAULT_INVENTORY = [
  { id: 'kard',      nev: 'Kard',     ikon: '⚔️',  db: 1 },
  { id: 'pajzs',     nev: 'Pajzs',    ikon: '🛡️',  db: 1 },
  { id: 'pancel',    nev: 'Bőrpáncél',ikon: '🥋',  db: 1 },
  { id: 'lampas',    nev: 'Lámpa',    ikon: '🔦',  db: 1 },
  { id: 'hatizsak',  nev: 'Hátizsák', ikon: '🎒',  db: 1 },
];

// ═══════════════════════════════════════════════════════════════
//  BOOT — load JSON, init ember particles, show menu
// ═══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  startEmbers();
  updateLoadingBar(10, 'Könyv betöltése...');
  
  try {
    const resp = await fetch('sections.json');
    SECTIONS = await resp.json();
    updateLoadingBar(80, 'Világ előkészítése...');
  } catch(e) {
    updateLoadingBar(80, 'Hiba! Ellenőrizd a sections.json fájlt.');
    console.error('Nem sikerült betölteni a sections.json fájlt:', e);
  }

  await delay(400);
  updateLoadingBar(100, 'Kaland vár...');
  await delay(500);

  document.getElementById('loading-screen').style.opacity = '0';
  await delay(300);
  document.getElementById('loading-screen').style.display = 'none';

  initMainMenu();
});

// ═══════════════════════════════════════════════════════════════
//  LOADING
// ═══════════════════════════════════════════════════════════════
function updateLoadingBar(pct, msg) {
  document.getElementById('loading-bar').style.width = pct + '%';
  document.getElementById('loading-text').textContent = msg;
}

// ═══════════════════════════════════════════════════════════════
//  EMBER PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════
function startEmbers() {
  const canvas = document.getElementById('ember-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Ember {
    constructor() { this.reset(true); }
    reset(init = false) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : H + 10;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = -(Math.random() * 1.2 + 0.4);
      this.r  = Math.random() * 2.5 + 0.5;
      this.life = 1;
      this.decay = Math.random() * 0.005 + 0.003;
      this.hue = Math.floor(Math.random() * 30);  // 0..30 => orange/red
    }
    update() {
      this.x += this.vx + Math.sin(Date.now() * 0.001 + this.y * 0.01) * 0.3;
      this.y += this.vy;
      this.life -= this.decay;
      if (this.life <= 0 || this.y < -10) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.life * 0.7;
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2);
      g.addColorStop(0, `hsl(${20 + this.hue}, 100%, 80%)`);
      g.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Ember());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }
  loop();
}

// ═══════════════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideOverlay(id) {
  document.getElementById(id).classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════════════════════════
function initMainMenu() {
  showScreen('main-menu');
  const hasSave = !!localStorage.getItem('tuzhegy_save');
  const btnCont = document.getElementById('btn-continue');
  const btnDel  = document.getElementById('btn-delete-save');
  btnCont.disabled = !hasSave;
  if (hasSave) btnDel.style.display = '';
  else btnDel.style.display = 'none';

  document.getElementById('btn-new-game').onclick = () => showScreen('char-creation');
  document.getElementById('btn-continue').onclick = () => {
    if (hasSave) { loadGame(); showScreen('game-screen'); }
  };
  document.getElementById('btn-rules').onclick = () => showScreen('rules-screen');
  document.getElementById('btn-delete-save').onclick = () => {
    if (confirm('Biztosan töröljük a mentést?')) {
      localStorage.removeItem('tuzhegy_save');
      initMainMenu();
    }
  };
}

// ═══════════════════════════════════════════════════════════════
//  CHARACTER CREATION
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const rollBtns = document.querySelectorAll('.roll-btn');
  const vals = { ugyesseg: null, eletero: null, szerencse: null };

  rollBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      let result;
      if (stat === 'eletero') {
        result = rollDice(2) + 12;
      } else {
        result = rollDice(1) + 6;
      }
      vals[stat] = result;
      document.getElementById('val-' + stat).textContent = result;
      document.getElementById('card-' + stat).classList.add('rolled');
      btn.disabled = true;
      checkCharReady(vals);
    });
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    const potion = document.querySelector('input[name="potion"]:checked');
    if (!potion) { showToast('Válassz egy varázsitalt!', 'damage'); return; }
    startNewGame(vals, potion.value);
  });

  document.getElementById('btn-back-menu').addEventListener('click', initMainMenu);
  document.getElementById('btn-rules-back').addEventListener('click', initMainMenu);
});

function checkCharReady(vals) {
  const allRolled = vals.ugyesseg && vals.eletero && vals.szerencse;
  document.getElementById('btn-start-game').disabled = !allRolled;
}

// ═══════════════════════════════════════════════════════════════
//  NEW GAME
// ═══════════════════════════════════════════════════════════════
function startNewGame(vals, potion) {
  gameState = {
    section: 1,
    ugyesseg: vals.ugyesseg,
    ugyesseg_max: vals.ugyesseg,
    eletero: vals.eletero,
    eletero_max: vals.eletero,
    szerencse: vals.szerencse,
    szerencse_max: vals.szerencse,
    arany: 0,
    elelmiszer: 10,
    ital: potion,
    ital_db: 1,
    ital_hasznalt: false,
    inventory: JSON.parse(JSON.stringify(DEFAULT_INVENTORY)),
    visited: [1],
    history: [],
  };

  showScreen('game-screen');
  initGameUI();
  goToSection(1);
}

// ═══════════════════════════════════════════════════════════════
//  GAME UI INIT
// ═══════════════════════════════════════════════════════════════
function initGameUI() {
  document.getElementById('btn-toggle-char').onclick = () => {
    const sb = document.getElementById('char-sidebar');
    sb.classList.toggle('mobile-open');
    document.getElementById('inv-sidebar').classList.remove('mobile-open');
  };
  document.getElementById('btn-toggle-inv').onclick = () => {
    const inv = document.getElementById('inv-sidebar');
    inv.classList.toggle('mobile-open');
    document.getElementById('char-sidebar').classList.remove('mobile-open');
  };
  document.getElementById('btn-save').onclick = () => {
    saveGame();
    const n = document.getElementById('save-notif');
    n.classList.remove('hidden');
    setTimeout(() => n.classList.add('hidden'), 2000);
  };
  document.getElementById('btn-menu').onclick = () => {
    if (confirm('Visszamész a főmenübe? (A játék automatikusan ment.)')) {
      saveGame();
      initMainMenu();
    }
  };
  document.getElementById('btn-eat').onclick = eatFood;
  document.getElementById('btn-drink').onclick = drinkPotion;

  // Restart / Game over
  document.getElementById('btn-restart').onclick = () => {
    hideOverlay('gameover-overlay');
    showScreen('char-creation');
    // Reset roll buttons
    document.querySelectorAll('.roll-btn').forEach(b => b.disabled = false);
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('rolled'));
    document.querySelectorAll('.stat-value').forEach(v => v.textContent = '?');
    document.getElementById('btn-start-game').disabled = true;
  };
  document.getElementById('btn-gameover-menu').onclick = () => {
    hideOverlay('gameover-overlay');
    initMainMenu();
  };
  document.getElementById('btn-victory-menu').onclick = () => {
    hideOverlay('victory-overlay');
    initMainMenu();
  };

  updateUI();
  renderInventory();
}

// ═══════════════════════════════════════════════════════════════
//  NAVIGATE TO SECTION
// ═══════════════════════════════════════════════════════════════
async function goToSection(num) {
  const key = String(num);
  const section = SECTIONS[key];
  if (!section) {
    showToast(`${num}. szakasz nem található!`, 'damage');
    return;
  }

  gameState.section = num;
  if (!gameState.visited.includes(num)) gameState.visited.push(num);
  if (gameState.history.at(-1) !== num) {
    gameState.history.push(num);
    if (gameState.history.length > 100) gameState.history.shift();
  }

  // Update HUD
  document.getElementById('hud-section').textContent = num;
  document.getElementById('section-num').textContent = num;

  // Section appearance animation
  const storyArea = document.querySelector('.story-area');
  storyArea.style.opacity = '0';
  await delay(150);
  storyArea.style.opacity = '1';
  storyArea.classList.add('section-appear');
  setTimeout(() => storyArea.classList.remove('section-appear'), 400);

  // Apply any stat changes embedded in the section text
  applyAutoStatChanges(section.szoveg);

  // Render story text with typewriter
  await renderStoryText(section);

  // Render choices
  renderChoices(section);

  // Auto-save
  saveGame();
  updateUI();
  renderInventory();

  // Check death
  if (gameState.eletero <= 0) {
    await delay(500);
    showOverlay('gameover-overlay');
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelector('.story-area').scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════
//  STORY TEXT RENDERER (typewriter)
// ═══════════════════════════════════════════════════════════════
async function renderStoryText(section) {
  const el = document.getElementById('story-text');
  el.innerHTML = '';

  // Format text into paragraphs
  const raw = section.szoveg;
  const paras = raw.split(/\n\n+/).filter(p => p.trim().length > 0);

  for (let pi = 0; pi < paras.length; pi++) {
    const p = document.createElement('p');
    el.appendChild(p);

    // Skip typewriter for long sections to be snappy
    const useTypewriter = paras.length <= 3 && raw.length < 800;

    if (useTypewriter && pi === 0) {
      await typewriter(p, paras[pi].replace(/\n/g, ' '), 18);
    } else {
      p.textContent = paras[pi].replace(/\n/g, ' ');
    }
  }
}

async function typewriter(el, text, speed = 20) {
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  el.appendChild(cursor);

  for (const ch of text) {
    const t = document.createTextNode(ch);
    el.insertBefore(t, cursor);
    await delay(speed);
  }
  cursor.remove();
}

// ═══════════════════════════════════════════════════════════════
//  CHOICE RENDERER
// ═══════════════════════════════════════════════════════════════
function renderChoices(section) {
  const container = document.getElementById('story-actions');
  container.innerHTML = '';

  // ── Combat encounter ──
  if (section.harc && section.harc.length > 0) {
    section.harc.forEach(enemy => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn combat-choice';
      btn.innerHTML = `<i class="fas fa-swords"></i> Harc: ${enemy.nev} (Ügyesség ${enemy.ugyesseg}, Életerő ${enemy.eletero})`;
      btn.onclick = () => startCombat(enemy, section);
      container.appendChild(btn);
    });
  }

  // ── Luck test ──
  if (section.szerencse_proba) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn luck-choice';
    btn.innerHTML = `<i class="fas fa-star"></i> Tedd Próbára Szerencséd!`;
    btn.onclick = () => openLuckTest(null);
    container.appendChild(btn);
  }

  // ── Regular choices ──
  section.valasztasok.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.szoveg;
    btn.onclick = () => goToSection(choice.cel);
    container.appendChild(btn);
  });

  // ── No choices → dead end or special ──
  if (container.children.length === 0) {
    const info = document.createElement('p');
    info.style.cssText = 'color:var(--text-dim);font-style:italic;text-align:center;padding:1rem;';
    info.textContent = '— Vége. —';
    container.appendChild(info);

    // Victory check (section 400)
    if (gameState.section === 400) {
      setTimeout(() => showOverlay('victory-overlay'), 1000);
    }
  }

  // Special action row (eat / drink quick access)
  const row = document.createElement('div');
  row.className = 'special-action-row';

  const eatBtn = document.createElement('button');
  eatBtn.className = 'special-btn';
  eatBtn.innerHTML = `<i class="fas fa-drumstick-bite"></i> Étkezés`;
  eatBtn.onclick = eatFood;
  row.appendChild(eatBtn);

  if (!gameState.ital_hasznalt && gameState.ital) {
    const drinkBtn = document.createElement('button');
    drinkBtn.className = 'special-btn';
    drinkBtn.innerHTML = `<i class="fas fa-flask"></i> Ital`;
    drinkBtn.onclick = drinkPotion;
    row.appendChild(drinkBtn);
  }

  container.appendChild(row);
}

// ═══════════════════════════════════════════════════════════════
//  AUTO STAT CHANGES — detect keywords in section text
// ═══════════════════════════════════════════════════════════════
function applyAutoStatChanges(text) {
  // Gold gains
  const goldMatch = text.match(/(\d+)\s*aranypénz(?:t kapsz|t talál)/i);
  if (goldMatch) {
    const g = parseInt(goldMatch[1]);
    gameState.arany += g;
    showToast(`+${g} arany!`, 'gain');
  }

  // Check for explicit stat changes (e.g. "vonj le 1 ÜGYESSÉG pontot")
  const ugyMinus = text.match(/vonj le\s+(\d+)\s+(?:pont[ot]?\s+)?ÜGYESSÉG/i);
  if (ugyMinus) statChange('ugyesseg', -parseInt(ugyMinus[1]));

  const ugyPlus = text.match(/(?:nyersz|kapsz|adj hozzá)\s+(\d+)\s+(?:pont[ot]?\s+)?ÜGYESSÉG/i);
  if (ugyPlus) statChange('ugyesseg', parseInt(ugyPlus[1]));

  // Items
  const keyItems = [
    { re: /kulcsot?\s+(?:kapsz|talál|felvesz)/i,    item: { id: 'kulcs', nev: 'Kulcs', ikon: '🗝️', db: 1 } },
    { re: /kardot?\s+(?:kapsz|talál|felvesz)/i,     item: { id: 'kulcs2', nev: 'Kard', ikon: '⚔️', db: 1 } },
    { re: /amulett(?:et)?\s+(?:kapsz|talál)/i,      item: { id: 'amulett', nev: 'Amulett', ikon: '📿', db: 1 } },
    { re: /gyűrűt?\s+(?:kapsz|talál)/i,             item: { id: 'gyuru', nev: 'Gyűrű', ikon: '💍', db: 1 } },
    { re: /sisakot?\s+(?:kapsz|talál)/i,             item: { id: 'sisak', nev: 'Sisak', ikon: '⛑️', db: 1 } },
  ];
  keyItems.forEach(ki => {
    if (ki.re.test(text)) addItem(ki.item);
  });
}

// ═══════════════════════════════════════════════════════════════
//  COMBAT SYSTEM
// ═══════════════════════════════════════════════════════════════
let activeCombat = null;

function startCombat(enemy, section) {
  activeCombat = {
    enemy: { ...enemy },
    enemyCurrent: enemy.eletero,
    enemyUgy: enemy.ugyesseg,
    section: section,
    round: 1,
    canEscape: section.valasztasok.some(v =>
      section.szoveg.toLowerCase().includes('meneküls') ||
      section.szoveg.toLowerCase().includes('menekülhetsz')
    ),
    afterWin: section.valasztasok.find(v =>
      section.szoveg.includes('legyőzöd') || section.szoveg.includes('megölöd') ||
      !section.harc || section.harc.length === 0
    )
  };

  // Try to find the "after combat" destination
  const winDest = findWinDestination(section);
  activeCombat.winDest = winDest;

  // Also find escape destination
  const escapeDest = findEscapeDestination(section);
  activeCombat.escapeDest = escapeDest;

  // Update combat UI
  updateCombatUI();
  showOverlay('combat-overlay');

  document.getElementById('btn-fight-round').onclick = fightRound;
  document.getElementById('btn-fight-luck').onclick = combatLuckTest;
  document.getElementById('btn-fight-escape').onclick = combatEscape;

  if (!activeCombat.canEscape && !escapeDest) {
    document.getElementById('btn-fight-escape').disabled = true;
  }
}

function findWinDestination(section) {
  // Look for "Ha legyőzöd / megölöd" type patterns
  const text = section.szoveg;
  const patterns = [
    /[Ll]egyőzöd[^,;.]*,?\s*[Ll]apozz\s+a\s+(\d+)/,
    /megölöd[^,;.]*,?\s*[Ll]apozz\s+a\s+(\d+)/,
    /[Hh]a\s+nyertél[^,;.]*[Ll]apozz\s+a\s+(\d+)/,
    /[Cc]sata\s+után[^,;.]*[Ll]apozz\s+a\s+(\d+)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1]);
  }
  // Fallback: last choice destination that's not the escape
  if (section.valasztasok.length > 0) {
    return section.valasztasok[section.valasztasok.length - 1].cel;
  }
  return null;
}

function findEscapeDestination(section) {
  const text = section.szoveg;
  const m = text.match(/[Mm]eneküls[zz]?[^,;.]*[Ll]apozz\s+a\s+(\d+)/);
  if (m) return parseInt(m[1]);
  const m2 = text.match(/[Ee]lmenekül[^,;.]*[Ll]apozz\s+a\s+(\d+)/);
  if (m2) return parseInt(m2[1]);
  return null;
}

async function fightRound() {
  if (!activeCombat) return;
  const btn = document.getElementById('btn-fight-round');
  btn.disabled = true;

  const log = document.getElementById('combat-log');

  // Roll dice
  const pd1 = rollDice(1), pd2 = rollDice(1);
  const ed1 = rollDice(1), ed2 = rollDice(1);

  // Animate dice
  await animateDice(
    document.getElementById('die-p1'), pd1,
    document.getElementById('die-p2'), pd2,
    document.getElementById('die-e1'), ed1,
    document.getElementById('die-e2'), ed2,
  );

  const playerAtk = pd1 + pd2 + gameState.ugyesseg;
  const enemyAtk  = ed1 + ed2 + activeCombat.enemyUgy;

  document.getElementById('atk-player').textContent = playerAtk;
  document.getElementById('atk-enemy').textContent  = enemyAtk;

  let msg = `<div class="log-entry log-info">Forduló ${activeCombat.round}: Te: ${playerAtk} vs ${activeCombat.enemy.nev}: ${enemyAtk}</div>`;

  if (playerAtk > enemyAtk) {
    // Player hits enemy
    activeCombat.enemyCurrent -= 2;
    msg += `<div class="log-entry log-hit">Megsebesítetted a ${activeCombat.enemy.nev}-t! (−2 ÉL → ${activeCombat.enemyCurrent})</div>`;
    showStatChange(-2, 'enemy');
  } else if (enemyAtk > playerAtk) {
    // Enemy hits player
    gameState.eletero -= 2;
    msg += `<div class="log-entry log-enemy">${activeCombat.enemy.nev} megsebesített! (−2 ÉL → ${gameState.eletero})</div>`;
    showStatChange(-2, 'player');
  } else {
    msg += `<div class="log-entry log-info">Döntetlen — egyiküket sem éri találat.</div>`;
  }

  log.innerHTML += msg;
  log.scrollTop = log.scrollHeight;

  activeCombat.round++;
  updateCombatUI();
  updateUI();

  // Check combat end
  if (gameState.eletero <= 0) {
    await delay(500);
    hideOverlay('combat-overlay');
    showOverlay('gameover-overlay');
    return;
  }
  if (activeCombat.enemyCurrent <= 0) {
    log.innerHTML += `<div class="log-entry log-hit" style="color:var(--gold)">🏆 Győzelem! Legyőzted a ${activeCombat.enemy.nev}-t!</div>`;
    log.scrollTop = log.scrollHeight;
    document.getElementById('btn-fight-round').disabled = true;
    document.getElementById('btn-fight-luck').disabled = true;
    document.getElementById('btn-fight-escape').disabled = true;
    showToast(`${activeCombat.enemy.nev} legyőzve!`, 'success');

    const winDest = activeCombat.winDest;
    setTimeout(() => {
      hideOverlay('combat-overlay');
      if (winDest) {
        goToSection(winDest);
      }
    }, 1800);
    return;
  }

  btn.disabled = false;
}

async function animateDice(d1el, d1v, d2el, d2v, d3el, d3v, d4el, d4v) {
  [d1el, d2el, d3el, d4el].forEach(d => d.classList.add('rolling'));
  await delay(200);
  for (let i = 0; i < 6; i++) {
    d1el.textContent = rollDice(1);
    d2el.textContent = rollDice(1);
    d3el.textContent = rollDice(1);
    d4el.textContent = rollDice(1);
    await delay(60);
  }
  d1el.textContent = d1v;
  d2el.textContent = d2v;
  d3el.textContent = d3v;
  d4el.textContent = d4v;
  [d1el, d2el, d3el, d4el].forEach(d => d.classList.remove('rolling'));
}

function combatLuckTest() {
  openLuckTest((isLucky) => {
    if (!activeCombat) return;
    const log = document.getElementById('combat-log');
    if (isLucky) {
      // Lucky hit: extra -2
      activeCombat.enemyCurrent -= 2;
      log.innerHTML += `<div class="log-entry log-luck">⭐ Szerencsés! Extra −2 az ellenféltől!</div>`;
      showToast('Szerencsés! Extra sebzés!', 'success');
    } else {
      // Unlucky: -1 to enemy damage gets reversed (we give back 1)
      gameState.eletero -= 1;
      log.innerHTML += `<div class="log-entry log-enemy">💔 Balszerencsés. +1 sebzés!</div>`;
    }
    log.scrollTop = log.scrollHeight;
    updateCombatUI();
    updateUI();
  });
}

function combatEscape() {
  const dest = activeCombat?.escapeDest;
  hideOverlay('combat-overlay');
  activeCombat = null;
  if (dest) {
    showToast('Elmenekültél!', '');
    goToSection(dest);
  } else {
    showToast('Nem sikerült menekülni!', 'damage');
    // Take a hit for trying to escape
    gameState.eletero -= 2;
    updateUI();
  }
}

function updateCombatUI() {
  if (!activeCombat) return;
  document.getElementById('comb-enemy-name').textContent = activeCombat.enemy.nev;
  document.getElementById('comb-player-hp').textContent  = `❤ ${gameState.eletero}`;
  document.getElementById('comb-player-ugy').textContent = `⚔ ${gameState.ugyesseg}`;
  document.getElementById('comb-enemy-hp').textContent   = `❤ ${activeCombat.enemyCurrent}`;
  document.getElementById('comb-enemy-ugy').textContent  = `⚔ ${activeCombat.enemyUgy}`;
}

// ═══════════════════════════════════════════════════════════════
//  LUCK TEST SYSTEM
// ═══════════════════════════════════════════════════════════════
let luckCallback = null;

function openLuckTest(callback) {
  luckCallback = callback;
  document.getElementById('luck-current-val').textContent = gameState.szerencse;
  document.getElementById('luck-die1').textContent = '?';
  document.getElementById('luck-die2').textContent = '?';
  const result = document.getElementById('luck-result');
  result.classList.add('hidden');
  result.className = 'luck-result hidden';
  document.getElementById('btn-luck-close').style.display = 'none';
  document.getElementById('btn-luck-roll').style.display  = '';
  showOverlay('luck-overlay');

  document.getElementById('btn-luck-roll').onclick = rollLuck;
  document.getElementById('btn-luck-close').onclick = () => {
    hideOverlay('luck-overlay');
  };
}

async function rollLuck() {
  document.getElementById('btn-luck-roll').style.display = 'none';
  const d1 = document.getElementById('luck-die1');
  const d2 = document.getElementById('luck-die2');

  d1.classList.add('rolling'); d2.classList.add('rolling');
  for (let i = 0; i < 8; i++) {
    d1.textContent = rollDice(1);
    d2.textContent = rollDice(1);
    await delay(70);
  }
  const r1 = rollDice(1), r2 = rollDice(1);
  d1.textContent = r1;
  d2.textContent = r2;
  d1.classList.remove('rolling'); d2.classList.remove('rolling');

  const total = r1 + r2;
  const isLucky = total <= gameState.szerencse;

  // Always -1 luck
  gameState.szerencse = Math.max(0, gameState.szerencse - 1);
  document.getElementById('luck-current-val').textContent = gameState.szerencse;

  const result = document.getElementById('luck-result');
  if (isLucky) {
    result.textContent = `🌟 Szerencsés! (${total} ≤ ${gameState.szerencse + 1})`;
    result.className = 'luck-result success';
    showToast('Szerencsés!', 'success');
  } else {
    result.textContent = `💔 Balszerencsés! (${total} > ${gameState.szerencse + 1})`;
    result.className = 'luck-result fail';
    showToast('Balszerencsés!', 'damage');
  }
  result.classList.remove('hidden');
  document.getElementById('btn-luck-close').style.display = '';

  updateUI();

  if (luckCallback) {
    setTimeout(() => {
      hideOverlay('luck-overlay');
      luckCallback(isLucky);
      luckCallback = null;
    }, 1500);
  }
}

// ═══════════════════════════════════════════════════════════════
//  FOOD & POTIONS
// ═══════════════════════════════════════════════════════════════
function eatFood() {
  if (gameState.elelmiszer <= 0) { showToast('Nincs több élelmiszer!', 'damage'); return; }
  if (gameState.eletero >= gameState.eletero_max) { showToast('Életerőd már teljes!', ''); return; }
  const gain = Math.min(4, gameState.eletero_max - gameState.eletero);
  gameState.eletero += gain;
  gameState.elelmiszer--;
  showToast(`+${gain} Életerő!`, 'gain');
  showStatChange(gain, 'player');
  updateUI();
}

function drinkPotion() {
  if (gameState.ital_hasznalt) { showToast('Az italod már elfogyott!', 'damage'); return; }
  if (!gameState.ital) { showToast('Nincs italod!', 'damage'); return; }

  gameState.ital_hasznalt = true;
  gameState.ital_db = 0;

  switch (gameState.ital) {
    case 'ugyesseg':
      gameState.ugyesseg = gameState.ugyesseg_max;
      showToast('Ügyesség visszaállítva!', 'success');
      break;
    case 'eletero':
      gameState.eletero = gameState.eletero_max;
      showToast('Életerő visszaállítva!', 'success');
      break;
    case 'szerencse':
      gameState.szerencse = gameState.szerencse_max + 1;
      gameState.szerencse_max++;
      showToast('Szerencse visszaállítva és +1!', 'success');
      break;
  }
  updateUI();
  renderInventory();
}

// ═══════════════════════════════════════════════════════════════
//  UI UPDATE
// ═══════════════════════════════════════════════════════════════
function updateUI() {
  const gs = gameState;

  // HUD
  document.getElementById('hud-ugy').textContent = gs.ugyesseg;
  document.getElementById('hud-ele').textContent = gs.eletero;
  document.getElementById('hud-sze').textContent = gs.szerencse;

  // Sidebar stats
  document.getElementById('cs-ugy').textContent     = gs.ugyesseg;
  document.getElementById('cs-ugy-max').textContent = gs.ugyesseg_max;
  document.getElementById('cs-ele').textContent     = gs.eletero;
  document.getElementById('cs-ele-max').textContent = gs.eletero_max;
  document.getElementById('cs-sze').textContent     = gs.szerencse;
  document.getElementById('cs-sze-max').textContent = gs.szerencse_max;
  document.getElementById('cs-arany').textContent   = gs.arany;
  document.getElementById('cs-elel').textContent    = gs.elelmiszer;
  document.getElementById('cs-ital').textContent    = gs.ital_db;

  // Bars
  const ugyPct = Math.max(0, Math.min(100, (gs.ugyesseg / gs.ugyesseg_max) * 100));
  const elePct = Math.max(0, Math.min(100, (gs.eletero  / gs.eletero_max)  * 100));
  const szePct = Math.max(0, Math.min(100, (gs.szerencse / gs.szerencse_max) * 100));
  document.getElementById('bar-ugy').style.width = ugyPct + '%';
  document.getElementById('bar-ele').style.width = elePct + '%';
  document.getElementById('bar-sze').style.width = szePct + '%';

  // Eat/drink button states
  document.getElementById('btn-eat').disabled   = gs.elelmiszer <= 0;
  document.getElementById('btn-drink').disabled = gs.ital_hasznalt || !gs.ital;
}

// ═══════════════════════════════════════════════════════════════
//  INVENTORY
// ═══════════════════════════════════════════════════════════════
function addItem(item) {
  const existing = gameState.inventory.find(i => i.id === item.id);
  if (existing) {
    existing.db++;
  } else {
    gameState.inventory.push({ ...item });
  }
  showToast(`Kaptál: ${item.nev}!`, 'gain');
  renderInventory();
}

function renderInventory() {
  const grid = document.getElementById('inv-grid');
  grid.innerHTML = '';

  const slots = 15;
  for (let i = 0; i < slots; i++) {
    const div = document.createElement('div');
    const item = gameState.inventory[i];
    if (item) {
      div.className = 'inv-item';
      div.innerHTML = `<span class="item-icon">${item.ikon}</span><span class="item-name">${item.nev}${item.db > 1 ? ' ×'+item.db : ''}</span>`;
      div.title = item.nev;
    } else {
      div.className = 'inv-item empty';
      div.innerHTML = `<span style="font-size:0.6rem;opacity:0.3">○</span>`;
    }
    grid.appendChild(div);
  }

  // Potion slot
  if (!gameState.ital_hasznalt && gameState.ital) {
    const names = { ugyesseg: 'Ügyesség Itala', eletero: 'Erő Itala', szerencse: 'Szerencse Itala' };
    const icons = { ugyesseg: '⚡', eletero: '💗', szerencse: '🌟' };
    const potionItem = document.createElement('div');
    potionItem.className = 'inv-item';
    potionItem.innerHTML = `<span class="item-icon">${icons[gameState.ital]}</span><span class="item-name">${names[gameState.ital]}</span>`;
    grid.insertBefore(potionItem, grid.children[5] || null);
  }
}

// ═══════════════════════════════════════════════════════════════
//  STAT CHANGE — helper
// ═══════════════════════════════════════════════════════════════
function statChange(stat, amount) {
  gameState[stat] = Math.max(0, Math.min(gameState[stat + '_max'] || 999, gameState[stat] + amount));
  updateUI();
}

// ═══════════════════════════════════════════════════════════════
//  FLOATING STAT CHANGE ANIMATION
// ═══════════════════════════════════════════════════════════════
function showStatChange(amount, target) {
  const el = document.createElement('div');
  el.className = 'stat-change ' + (amount < 0 ? 'negative' : 'positive');
  el.textContent = (amount > 0 ? '+' : '') + amount;
  // Position near the stat bars
  const rect = document.querySelector('.char-stat-block')?.getBoundingClientRect() || { left: 100, top: 200 };
  el.style.cssText = `left:${rect.left + 20}px;top:${rect.top + (target === 'enemy' ? 80 : 40)}px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ═══════════════════════════════════════════════════════════════
//  SAVE / LOAD
// ═══════════════════════════════════════════════════════════════
function saveGame() {
  try {
    localStorage.setItem('tuzhegy_save', JSON.stringify(gameState));
  } catch(e) {
    console.warn('Mentés sikertelen:', e);
  }
}

function loadGame() {
  try {
    const saved = localStorage.getItem('tuzhegy_save');
    if (saved) {
      gameState = JSON.parse(saved);
      initGameUI();
      goToSection(gameState.section || 1);
    }
  } catch(e) {
    console.error('Betöltés sikertelen:', e);
    startNewGame({ ugyesseg: 9, eletero: 20, szerencse: 9 }, 'eletero');
  }
}

// ═══════════════════════════════════════════════════════════════
//  DICE ROLLER
// ═══════════════════════════════════════════════════════════════
function rollDice(n = 1, sides = 6) {
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
