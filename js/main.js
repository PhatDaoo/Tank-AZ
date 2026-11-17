// Main Controller: Gun-Mayhem-style 4-Slot Player Setup & AZ Tank Game Loop (Phase 1-3)

import { sound } from './sound.js';
import { inputManager, KEYBOARD_PRESETS } from './input.js';
import { Maze } from './maze.js';
import { resolveTankVsTankCollisions, stepBulletWithRicochet } from './physics.js';
import { ParticleSystem } from './particles.js';
import { TANK_COLORS, TANK_HATS, TANK_BARRELS, Tank, Bullet, drawTankModel } from './tank.js';
import { aiController } from './ai.js';
import { HostNetworkManager } from './network.js';
import { PowerUpCrate, checkLaserHitsTank } from './powerups.js';

// --- DEFAULT 4 SLOTS STATE (Matches Gun Mayhem screenshot: Slot 1 Human, Slots 2-4 Empty) ---
const defaultSlotConfigs = () => [
    {
        slot: 1,
        type: 'human', // 'empty' | 'human' | 'ai'
        name: 'Player 1',
        colorIndex: 1, // Blue like Gun Mayhem P1 in screenshot
        hatIndex: 0,
        barrelIndex: 0,
        aiLevel: 'normal',
        score: 0
    },
    {
        slot: 2,
        type: 'empty',
        name: 'Player 2',
        colorIndex: 0, // Red
        hatIndex: 0,
        barrelIndex: 0,
        aiLevel: 'normal',
        score: 0
    },
    {
        slot: 3,
        type: 'empty',
        name: 'Player 3',
        colorIndex: 2, // Green
        hatIndex: 0,
        barrelIndex: 0,
        aiLevel: 'normal',
        score: 0
    },
    {
        slot: 4,
        type: 'empty',
        name: 'Player 4',
        colorIndex: 3, // Yellow
        hatIndex: 0,
        barrelIndex: 0,
        aiLevel: 'normal',
        score: 0
    }
];

let slots = defaultSlotConfigs();

// --- DOM ELEMENTS ---
const lobbyEl = document.getElementById('lobby');
const toggleLobbyBtn = document.getElementById('toggle-lobby-btn');
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const slotsGridEl = document.getElementById('slots-grid');
const setupWarningEl = document.getElementById('setup-warning');
const startMatchBtn = document.getElementById('start-match-btn');
const resetSlotsBtn = document.getElementById('reset-slots-btn');
const targetScoreSelect = document.getElementById('target-score-select');
const mazeSizeSelect = document.getElementById('maze-size-select');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreboardEl = document.getElementById('scoreboard');
const roundStatusText = document.getElementById('round-status-text');
const roundBannerEl = document.getElementById('round-banner');
const victoryModal = document.getElementById('victory-modal');
const victoryTitle = document.getElementById('victory-title');
const victorySub = document.getElementById('victory-sub');

// --- LOBBY TOGGLE ---
toggleLobbyBtn.addEventListener('click', () => {
    sound.playClick();
    lobbyEl.classList.toggle('minimized');
    if (lobbyEl.classList.contains('minimized')) {
        toggleLobbyBtn.innerText = '➕ Show QR';
    } else {
        toggleLobbyBtn.innerText = '➖ Minimize';
    }
});

// --- RENDER 4-SLOT PLAYER SETUP (Gun Mayhem Style) ---
function renderSetupSlots() {
    slotsGridEl.innerHTML = '';

    slots.forEach((s, idx) => {
        const card = document.createElement('div');
        card.className = 'slot-card';

        if (s.type === 'empty') {
            card.innerHTML = `
                <div class="slot-empty-view">
                    <div class="slot-empty-title">SLOT EMPTY</div>
                    <div class="select-type-heading">SELECT A<br>PLAYER TYPE</div>
                    <button class="slot-type-btn" data-action="set-human" data-idx="${idx}">HUMAN PLAYER</button>
                    <button class="slot-type-btn ai-btn" data-action="set-ai" data-idx="${idx}">AI PLAYER</button>
                </div>
            `;
        } else {
            const colorObj = TANK_COLORS[s.colorIndex];
            const hatObj = TANK_HATS[s.hatIndex];
            const barrelObj = TANK_BARRELS[s.barrelIndex];
            const kbLabel = KEYBOARD_PRESETS[s.slot].label;
            const phoneConnected = inputManager.phoneState[s.slot]?.connected;

            const controlBadgeHtml =
                s.type === 'ai'
                    ? `<div class="control-badge">🤖 AI BOT<br><span style="color:#4fc3f7">${s.aiLevel.toUpperCase()}</span></div>`
                    : phoneConnected
                    ? `<div class="control-badge" style="border-color:#4caf50;color:#81c784">📱 PHONE P${s.slot}<br><span>+ ${kbLabel}</span></div>`
                    : `<div class="control-badge">⌨️ KEYBOARD<br><span style="color:#ffd54f">${kbLabel}</span></div>`;

            card.innerHTML = `
                <div class="slot-active-view">
                    <button class="clear-slot-btn" data-action="clear" data-idx="${idx}">CLEAR SLOT</button>

                    <div class="tank-customizer">
                        <div class="tank-preview-box">
                            <canvas class="tank-preview-canvas" id="preview-canvas-${s.slot}" width="100" height="100"></canvas>
                        </div>
                        <div class="customizer-btns">
                            <button class="cust-btn" data-action="cycle-hat" data-idx="${idx}" title="Change Turret Style">
                                HAT: ${hatObj.label}
                            </button>
                            <button class="cust-btn" data-action="cycle-barrel" data-idx="${idx}" title="Change Barrel Style">
                                GUN: ${barrelObj.label}
                            </button>
                            ${
                                s.type === 'ai'
                                    ? `<button class="cust-btn" data-action="cycle-ai" data-idx="${idx}" style="background:#b3e5fc">
                                        AI: ${s.aiLevel.toUpperCase()}
                                       </button>`
                                    : `<button class="cust-btn" data-action="cycle-color" data-idx="${idx}">
                                        COLOR: ${colorObj.name}
                                       </button>`
                            }
                        </div>
                    </div>

                    <div class="slot-badges-row">
                        <div class="color-diamond" data-action="cycle-color" data-idx="${idx}" style="background:${colorObj.fill}" title="Click to change tank color"></div>
                        ${controlBadgeHtml}
                    </div>

                    <div class="slot-name-group">
                        <label class="slot-name-label">name:</label>
                        <input class="slot-name-input" type="text" maxlength="14" value="${s.name}" data-idx="${idx}" />
                    </div>
                </div>
            `;
        }

        slotsGridEl.appendChild(card);
    });

    // Draw tank previews on active slot canvases
    slots.forEach((s) => {
        if (s.type === 'empty') return;
        const pCanvas = document.getElementById(`preview-canvas-${s.slot}`);
        if (!pCanvas) return;
        const pCtx = pCanvas.getContext('2d');
        pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

        drawTankModel(pCtx, {
            x: 50,
            y: 52,
            angle: -Math.PI / 5,
            color: TANK_COLORS[s.colorIndex],
            hat: TANK_HATS[s.hatIndex].id,
            barrel: TANK_BARRELS[s.barrelIndex].id,
            recoil: 0,
            scale: 2.05
        });
    });

    // Validate active slot count (need >= 2 tanks to battle)
    const activeCount = slots.filter((s) => s.type !== 'empty').length;
    if (activeCount < 2) {
        setupWarningEl.innerText = '⚠ Select at least 2 slots (Human or AI Player) to start!';
        startMatchBtn.disabled = true;
    } else {
        setupWarningEl.innerText = `✅ Ready: ${activeCount} tanks in battle`;
        startMatchBtn.disabled = false;
    }
}

// Event delegation for Setup Cards
slotsGridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = Number(btn.dataset.idx);
    const s = slots[idx];
    if (!s) return;

    sound.playClick();

    if (action === 'set-human') {
        s.type = 'human';
        s.name = `Player ${s.slot}`;
    } else if (action === 'set-ai') {
        s.type = 'ai';
        s.name = `Bot ${s.slot}`;
    } else if (action === 'clear') {
        s.type = 'empty';
    } else if (action === 'cycle-color') {
        s.colorIndex = (s.colorIndex + 1) % TANK_COLORS.length;
    } else if (action === 'cycle-hat') {
        s.hatIndex = (s.hatIndex + 1) % TANK_HATS.length;
    } else if (action === 'cycle-barrel') {
        s.barrelIndex = (s.barrelIndex + 1) % TANK_BARRELS.length;
    } else if (action === 'cycle-ai') {
        const order = ['easy', 'normal', 'hard'];
        s.aiLevel = order[(order.indexOf(s.aiLevel) + 1) % order.length];
    }

    renderSetupSlots();
    hostNet.broadcastPlayersUpdate();
});

slotsGridEl.addEventListener('input', (e) => {
    if (e.target.classList.contains('slot-name-input')) {
        const idx = Number(e.target.dataset.idx);
        if (slots[idx]) {
            slots[idx].name = e.target.value.trim() || `Player ${slots[idx].slot}`;
            hostNet.broadcastPlayersUpdate();
        }
    }
});

resetSlotsBtn.addEventListener('click', () => {
    sound.playClick();
    slots = defaultSlotConfigs();
    slots.forEach((s) => {
        if (inputManager.phoneState[s.slot]?.connected) {
            s.type = 'human';
        }
    });
    renderSetupSlots();
    hostNet.broadcastPlayersUpdate();
});

// --- GAME ENGINE STATE ---
let gameRunning = false;
let roundNumber = 1;
let targetScore = 10;
let mazeSizeMode = 'medium';

let maze = null;
let tanks = [];
let bullets = [];
let crates = [];
let mines = [];
let laserBeams = [];
let crateSpawnTimer = 4.0;
const particles = new ParticleSystem();
let screenShake = 0;

// Round end grace period (authentic AZ: wait ~2.2s after <= 1 tank left)
let roundState = 'playing'; // 'playing' | 'grace' | 'intermission' | 'match_over'
let graceTimer = 0;
let intermissionTimer = 0;

function getMazeDimensions(mode, activePlayerCount) {
    if (mode === 'small') return { cols: 7, rows: 5 };
    if (mode === 'large') return { cols: 11, rows: 7 };
    return activePlayerCount >= 4 ? { cols: 10, rows: 6 } : { cols: 9, rows: 6 };
}

function startMatch() {
    const activeSlots = slots.filter((s) => s.type !== 'empty');
    if (activeSlots.length < 2) return;

    sound.playClick();
    targetScore = Number(targetScoreSelect.value) || 10;
    mazeSizeMode = mazeSizeSelect.value || 'medium';
    roundNumber = 1;

    slots.forEach((s) => {
        s.score = 0;
    });

    setupScreen.classList.remove('active');
    gameScreen.classList.add('active');
    victoryModal.classList.remove('show');

    // Auto-minimize QR lobby when entering battle so it doesn't cover the arena
    if (!lobbyEl.classList.contains('minimized')) {
        lobbyEl.classList.add('minimized');
        toggleLobbyBtn.innerText = '➕ Show QR';
    }

    gameRunning = true;
    startNewRound();
}

function returnToSetup() {
    sound.playClick();
    gameRunning = false;
    victoryModal.classList.remove('show');
    gameScreen.classList.remove('active');
    setupScreen.classList.add('active');
    renderSetupSlots();
}

function startNewRound() {
    const activeSlots = slots.filter((s) => s.type !== 'empty');
    const dims = getMazeDimensions(mazeSizeMode, activeSlots.length);

    inputManager.resetRoundInputs();
    hostNet.broadcast({ type: 'roundReset' });

    maze = new Maze(dims.cols, dims.rows, canvas.width, canvas.height);
    const spawns = maze.pickSpawnCells(activeSlots.length);

    tanks = activeSlots.map((s, i) => {
        hostNet.sendWeaponToSlot(s.slot, null);
        return new Tank(
            {
                slot: s.slot,
                name: s.name,
                type: s.type,
                aiLevel: s.aiLevel,
                color: TANK_COLORS[s.colorIndex],
                hat: TANK_HATS[s.hatIndex].id,
                barrel: TANK_BARRELS[s.barrelIndex].id
            },
            spawns[i]
        );
    });

    bullets = [];
    crates = [];
    mines = [];
    laserBeams = [];
    crateSpawnTimer = 3.8;
    particles.clear();
    aiController.reset();
    roundState = 'playing';
    graceTimer = 0;
    screenShake = 0;

    roundBannerEl.style.display = 'none';
    roundStatusText.innerText = `ROUND ${roundNumber} — Goal: ${targetScore === 999 ? 'Endless' : targetScore + ' Pts'}`;
    renderScoreboard();
}

function spawnRandomCrate() {
    if (!maze || crates.length >= 3) return;
    for (let attempt = 0; attempt < 20; attempt++) {
        const col = Math.floor(Math.random() * maze.cols);
        const row = Math.floor(Math.random() * maze.rows);
        const pos = maze.cellCenter(col, row);

        const tooCloseToTank = tanks.some((t) => t.alive && Math.hypot(t.x - pos.x, t.y - pos.y) < maze.cellSize * 0.85);
        const tooCloseToCrate = crates.some((c) => c.alive && Math.hypot(c.x - pos.x, c.y - pos.y) < maze.cellSize * 0.8);

        if (!tooCloseToTank && !tooCloseToCrate) {
            crates.push(new PowerUpCrate(pos.x, pos.y));
            break;
        }
    }
}

function detonateFragBurst(ownerSlot, x, y, count = 14) {
    sound.playExplosion();
    screenShake = Math.max(screenShake, 5);
    particles.spawnWallSpark(x, y);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        bullets.push(
            new Bullet(ownerSlot, x, y, angle, {
                speed: 295 + (Math.random() - 0.5) * 35,
                radius: 3.1,
                maxAge: 2.1,
                color: '#aa00ff',
                leftShooter: true
            })
        );
    }
}

function destroyTank(tank) {
    if (!tank.alive) return;
    tank.alive = false;
    tank.weapon = null;
    screenShake = 8;
    sound.playExplosion();
    hostNet.sendHapticToSlot(tank.slot, [70, 40, 130]);
    hostNet.sendWeaponToSlot(tank.slot, null);
    particles.spawnTankExplosion(tank.x, tank.y, tank.color.fill);
    renderScoreboard();
}

function renderScoreboard(winnerSlot = null) {
    scoreboardEl.innerHTML = '';
    const activeSlots = slots.filter((s) => s.type !== 'empty');

    activeSlots.forEach((s) => {
        const tank = tanks.find((t) => t.slot === s.slot);
        const isDead = tank && !tank.alive;
        const colorObj = TANK_COLORS[s.colorIndex];
        const phoneConnected = inputManager.phoneState[s.slot]?.connected;
        let subLabel =
            s.type === 'ai'
                ? `🤖 AI (${s.aiLevel.toUpperCase()})`
                : phoneConnected
                ? `📱 Phone P${s.slot}`
                : `⌨️ ${KEYBOARD_PRESETS[s.slot].label}`;

        if (tank && tank.alive && tank.weapon) {
            subLabel = `<span style="color:${tank.weapon.color};font-weight:900">⚡ ${tank.weapon.name} (${tank.weapon.ammo})</span>`;
        }

        const card = document.createElement('div');
        card.className = `score-card ${isDead ? 'dead' : ''} ${winnerSlot === s.slot ? 'winner-pulse' : ''}`;
        card.innerHTML = `
            <div class="score-tank-badge" style="background:${colorObj.fill}">P${s.slot}</div>
            <div class="score-info">
                <div class="score-name">${s.name}</div>
                <div class="score-sub">${subLabel}</div>
            </div>
            <div class="score-points">${s.score}</div>
        `;
        scoreboardEl.appendChild(card);
    });
}

function updatePhysicsStep(dt) {
    if (!gameRunning || roundState === 'match_over') return;

    if (screenShake > 0) {
        screenShake = Math.max(0, screenShake - dt * 28);
    }

    // Spawn Mystery Weapon Crates periodically
    if (roundState === 'playing') {
        crateSpawnTimer -= dt;
        if (crateSpawnTimer <= 0) {
            spawnRandomCrate();
            crateSpawnTimer = 5.5 + Math.random() * 2.5;
        }
    }

    for (const c of crates) {
        c.update(dt);
    }

    // 1. Update Tanks
    for (const tank of tanks) {
        if (!tank.alive) continue;
        const input =
            tank.type === 'ai'
                ? aiController.computeInput(tank, tanks, bullets, maze, dt, crates)
                : inputManager.getTankInput(tank.slot);

        tank.update(dt, input, maze, bullets, mines, laserBeams, particles, {
            onShoot: (shooter, weaponType) => {
                if (weaponType === 'MINE') sound.playMinePlace();
                else sound.playShoot();
            },
            onLaserFire: (shooter, points) => {
                sound.playLaser();
                screenShake = Math.max(screenShake, 4.5);
                for (const other of tanks) {
                    if (!other.alive) continue;
                    const res = checkLaserHitsTank(points, other, other.slot === shooter.slot);
                    if (res.hit) {
                        destroyTank(other);
                    }
                }
            },
            onWeaponChanged: (shooter) => {
                hostNet.sendWeaponToSlot(shooter.slot, shooter.weapon);
                renderScoreboard();
            }
        });

        // Check Crate Pickup
        for (let i = crates.length - 1; i >= 0; i--) {
            const c = crates[i];
            if (!c.alive) continue;
            if (Math.hypot(tank.x - c.x, tank.y - c.y) < tank.radius + c.radius) {
                c.alive = false;
                crates.splice(i, 1);
                tank.equipWeapon(c.weaponKey);
                sound.playPickup();
                particles.spawnFloatingText(tank.x, tank.y - 24, `+${c.weapon.name}`, c.weapon.color);
                hostNet.sendWeaponToSlot(tank.slot, tank.weapon);
                renderScoreboard();
            }
        }
    }

    resolveTankVsTankCollisions(tanks);

    // 2. Update Proximity Mines
    for (let i = mines.length - 1; i >= 0; i--) {
        const m = mines[i];
        if (!m.alive) {
            mines.splice(i, 1);
            continue;
        }
        m.update(dt);
        if (m.isArmed()) {
            const triggered = tanks.some((t) => t.alive && Math.hypot(t.x - m.x, t.y - m.y) < m.triggerRadius + t.radius * 0.5);
            if (triggered) {
                m.alive = false;
                mines.splice(i, 1);
                // Destroy any tank inside blast radius + spawn shrapnel
                for (const t of tanks) {
                    if (t.alive && Math.hypot(t.x - m.x, t.y - m.y) < 54) {
                        destroyTank(t);
                    }
                }
                detonateFragBurst(m.ownerSlot, m.x, m.y, 10);
            }
        }
    }

    // 3. Update Bullets, Homing Missiles & Frag Bombs
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.alive) {
            bullets.splice(i, 1);
            continue;
        }

        b.age += dt;
        if (b.age >= b.maxAge) {
            if (b.isSpecial === 'FRAG') {
                detonateFragBurst(b.ownerSlot, b.x, b.y, 14);
            } else {
                particles.spawnBulletPop(b.x, b.y);
            }
            bullets.splice(i, 1);
            continue;
        }

        if (b.isSpecial === 'HOMING') {
            b.steerTowardsTarget(dt, tanks, maze, particles);
        }

        stepBulletWithRicochet(b, dt, maze, (bouncedBullet) => {
            sound.playBounce();
            particles.spawnWallSpark(bouncedBullet.x, bouncedBullet.y);
        });

        // Check if bullet hits a Proximity Mine
        for (let mIdx = mines.length - 1; mIdx >= 0; mIdx--) {
            const m = mines[mIdx];
            if (m.alive && Math.hypot(b.x - m.x, b.y - m.y) < b.radius + m.radius) {
                b.alive = false;
                m.alive = false;
                mines.splice(mIdx, 1);
                for (const t of tanks) {
                    if (t.alive && Math.hypot(t.x - m.x, t.y - m.y) < 54) {
                        destroyTank(t);
                    }
                }
                detonateFragBurst(m.ownerSlot, m.x, m.y, 10);
                break;
            }
        }
        if (!b.alive) {
            bullets.splice(i, 1);
            continue;
        }

        // Check if bullet has cleared its shooter's hull so it can later self-kill
        if (!b.leftShooter) {
            const shooter = tanks.find((t) => t.slot === b.ownerSlot);
            if (!shooter || !shooter.alive) {
                b.leftShooter = true;
            } else {
                const distFromShooter = Math.hypot(b.x - shooter.x, b.y - shooter.y);
                if (distFromShooter > shooter.radius + b.radius + 3 || b.bounces > 0 || b.age > 0.14) {
                    b.leftShooter = true;
                }
            }
        }

        // Check collision with all living tanks
        for (const tank of tanks) {
            if (!tank.alive) continue;
            if (tank.slot === b.ownerSlot && !b.leftShooter) continue;

            const dist = Math.hypot(b.x - tank.x, b.y - tank.y);
            if (dist < tank.radius + b.radius) {
                b.alive = false;
                if (b.isSpecial === 'FRAG') {
                    detonateFragBurst(b.ownerSlot, b.x, b.y, 12);
                }
                destroyTank(tank);
                break;
            }
        }

        if (!b.alive) {
            bullets.splice(i, 1);
        }
    }

    // 4. Update Laser Beams & Particles
    for (let i = laserBeams.length - 1; i >= 0; i--) {
        laserBeams[i].update(dt);
        if (laserBeams[i].life <= 0) {
            laserBeams.splice(i, 1);
        }
    }

    particles.update(dt);

    // 5. Round State Machine (Grace Period & Scoring)
    const livingTanks = tanks.filter((t) => t.alive);

    if (roundState === 'playing') {
        if (livingTanks.length <= 1) {
            roundState = 'grace';
            graceTimer = 2.2;
        }
    } else if (roundState === 'grace') {
        graceTimer -= dt;
        if (livingTanks.length === 0 && graceTimer > 0.9) {
            graceTimer = 0.9;
        }
        if (graceTimer <= 0) {
            concludeRound();
        }
    } else if (roundState === 'intermission') {
        intermissionTimer -= dt;
        if (intermissionTimer <= 0) {
            roundNumber++;
            startNewRound();
        }
    }
}

function concludeRound() {
    const livingTanks = tanks.filter((t) => t.alive);

    if (livingTanks.length === 1) {
        const winner = livingTanks[0];
        const slotCfg = slots.find((s) => s.slot === winner.slot);
        if (slotCfg) {
            slotCfg.score++;
            sound.playRoundWin();
            renderScoreboard(winner.slot);

            if (targetScore !== 999 && slotCfg.score >= targetScore) {
                roundState = 'match_over';
                victoryTitle.innerText = `🏆 ${slotCfg.name.toUpperCase()} WINS!`;
                victoryTitle.style.color = TANK_COLORS[slotCfg.colorIndex].fill;
                victorySub.innerText = `Reached ${slotCfg.score} points in ${roundNumber} rounds!`;
                victoryModal.classList.add('show');
                return;
            }
        }
        roundBannerEl.innerText = `🎖 ${winner.name} wins Round ${roundNumber}! (+1 Point)`;
        roundBannerEl.style.borderColor = winner.color.fill;
    } else {
        roundBannerEl.innerText = `💥 DRAW! No tank survived`;
        roundBannerEl.style.borderColor = '#ff9800';
    }

    roundBannerEl.style.display = 'block';
    roundState = 'intermission';
    intermissionTimer = 1.8;
}

function drawArena() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer frame background
    ctx.fillStyle = '#dfe3e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake * 2;
        const sy = (Math.random() - 0.5) * screenShake * 2;
        ctx.translate(sx, sy);
    }

    if (maze) {
        maze.draw(ctx);
    }

    particles.drawFloorDecals(ctx);

    for (const m of mines) {
        m.draw(ctx);
    }

    for (const c of crates) {
        c.draw(ctx);
    }

    for (const lb of laserBeams) {
        lb.draw(ctx);
    }

    for (const b of bullets) {
        b.draw(ctx);
    }

    for (const tank of tanks) {
        tank.draw(ctx, maze);
    }

    particles.drawTopParticles(ctx);

    // Countdown indicator during Grace Period when 1 tank is dodging final bullets
    if (roundState === 'grace') {
        const living = tanks.filter((t) => t.alive);
        if (living.length === 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(canvas.width / 2 - 110, 8, 220, 26);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`⏳ Scoring in ${graceTimer.toFixed(1)}s...`, canvas.width / 2, 25);
        }
    }

    ctx.restore();
}

// --- FIXED TIMESTEP 60FPS LOOP ---
let lastTime = performance.now();
let accumulator = 0;
const FIXED_DT = 1 / 60;

function mainLoop(now) {
    const frameTime = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (gameRunning) {
        accumulator += frameTime;
        while (accumulator >= FIXED_DT) {
            updatePhysicsStep(FIXED_DT);
            accumulator -= FIXED_DT;
        }
        drawArena();
    }

    requestAnimationFrame(mainLoop);
}

// --- TOP BAR & VICTORY BUTTONS ---
startMatchBtn.addEventListener('click', startMatch);
document.getElementById('btn-back-setup').addEventListener('click', returnToSetup);
document.getElementById('btn-victory-setup').addEventListener('click', returnToSetup);
document.getElementById('btn-rematch').addEventListener('click', startMatch);
document.getElementById('btn-skip-map').addEventListener('click', () => {
    if (gameRunning && roundState !== 'match_over') {
        sound.playClick();
        startNewRound();
    }
});

const muteBtn = document.getElementById('btn-mute');
muteBtn.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    muteBtn.innerText = isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
});

window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Escape' && gameRunning) {
        returnToSetup();
    } else if (e.code === 'KeyR' && gameRunning && roundState !== 'match_over') {
        sound.playClick();
        startNewRound();
    }
});

// Initialize Host WebRTC Manager (PeerJS + QR Lobby)
const hostNet = new HostNetworkManager({
    getSlotConfigs: () => slots,
    onSlotsChanged: () => {
        renderSetupSlots();
        if (gameRunning) renderScoreboard();
    }
});
hostNet.init();

window.AZHost = {
    getSlots: () => slots,
    renderSetupSlots,
    renderScoreboard,
    hostNet
};

// Initialize Setup Screen & Start Loop
renderSetupSlots();
requestAnimationFrame(mainLoop);
