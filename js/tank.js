// Tank & Bullet Entities + Special Weapon Firing Logic

import { resolveCircleMazeCollision, hasLineOfSight } from './physics.js';
import {
    WEAPON_TYPES,
    computeBouncingLaserPath,
    LaserBeamEffect,
    HomingMissile,
    FragBombBullet,
    ProximityMine
} from './powerups.js';

export const TANK_COLORS = [
    { id: 'red', name: 'RED', fill: '#e53935', dark: '#8e1b18' },
    { id: 'blue', name: 'BLUE', fill: '#1e88e5', dark: '#0d47a1' },
    { id: 'green', name: 'GREEN', fill: '#43a047', dark: '#1b5e20' },
    { id: 'yellow', name: 'YELLOW', fill: '#fdd835', dark: '#b28900' },
    { id: 'purple', name: 'PURPLE', fill: '#8e24aa', dark: '#4a148c' },
    { id: 'cyan', name: 'CYAN', fill: '#00acc1', dark: '#006064' },
    { id: 'orange', name: 'ORANGE', fill: '#fb8c00', dark: '#bf360c' },
    { id: 'pink', name: 'PINK', fill: '#ec407a', dark: '#880e4f' }
];

export const TANK_HATS = [
    { id: 'none', label: 'CLASSIC' },
    { id: 'star', label: 'STAR' },
    { id: 'stripe', label: 'STRIPE' },
    { id: 'crown', label: 'CROWN' },
    { id: 'visor', label: 'VISOR' }
];

export const TANK_BARRELS = [
    { id: 'standard', label: 'NORMAL' },
    { id: 'heavy', label: 'HEAVY' },
    { id: 'muzzle', label: 'MUZZLE' }
];

export function drawTankModel(ctx, opts) {
    const {
        x = 0,
        y = 0,
        angle = 0,
        color = TANK_COLORS[0],
        hat = 'none',
        barrel = 'standard',
        recoil = 0,
        scale = 1,
        weaponColor = null
    } = opts;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(angle);

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.roundRect(-14, -11, 28, 26, 4);
    ctx.fill();

    // Left & Right Treads
    ctx.fillStyle = '#26292e';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 6, 2);
    ctx.roundRect(-14, 8, 28, 6, 2);
    ctx.fill();
    ctx.stroke();

    // Tread ribs
    ctx.fillStyle = '#4a4f57';
    for (let tx = -11; tx <= 9; tx += 5) {
        ctx.fillRect(tx, -13, 2, 4);
        ctx.fillRect(tx, 9, 2, 4);
    }

    // Tank Hull
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-12, -10, 24, 20, 4);
    ctx.fill();
    ctx.stroke();

    // Hull inner shading / stripe
    ctx.fillStyle = color.dark;
    ctx.fillRect(-10, -7, 5, 14);

    if (hat === 'stripe') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(-4, -9, 4, 18);
    }

    // Cannon Barrel (with recoil offset)
    const bx = 4 - recoil * 4;
    ctx.fillStyle = weaponColor || '#454a52';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;

    if (barrel === 'heavy') {
        ctx.beginPath();
        ctx.roundRect(bx, -4, 18, 8, 2);
        ctx.fill();
        ctx.stroke();
    } else if (barrel === 'muzzle') {
        ctx.beginPath();
        ctx.rect(bx, -3, 16, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = weaponColor || color.dark;
        ctx.fillRect(bx + 13, -4.5, 4, 9);
        ctx.strokeRect(bx + 13, -4.5, 4, 9);
    } else {
        ctx.beginPath();
        ctx.roundRect(bx, -3, 17, 6, 2);
        ctx.fill();
        ctx.stroke();
    }

    // Turret Dome
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = weaponColor || '#111';
    ctx.lineWidth = weaponColor ? 2.6 : 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Turret Emblem / Hat
    if (hat === 'star') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = 4.5;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    } else if (hat === 'crown') {
        ctx.fillStyle = '#ffeb3b';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-4, 3);
        ctx.lineTo(-4, -3);
        ctx.lineTo(-1, 0);
        ctx.lineTo(2, -3.5);
        ctx.lineTo(4, 0);
        ctx.lineTo(4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (hat === 'visor') {
        ctx.fillStyle = '#00e5ff';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.2;
        ctx.fillRect(1, -4.5, 4.5, 9);
        ctx.strokeRect(1, -4.5, 4.5, 9);
    } else {
        ctx.fillStyle = weaponColor || color.dark;
        ctx.beginPath();
        ctx.arc(-1, 0, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

export class Bullet {
    constructor(ownerSlot, x, y, angle, opts = {}) {
        this.ownerSlot = ownerSlot;
        this.x = x;
        this.y = y;
        this.speed = opts.speed || 255;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.radius = opts.radius || 4.2;
        this.color = opts.color || '#1f2226';
        this.bounces = 0;
        this.age = 0;
        this.maxAge = opts.maxAge || 9.0; // 9 seconds classic AZ lifetime
        this.alive = true;
        this.leftShooter = Boolean(opts.leftShooter);
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle highlight
        ctx.fillStyle = '#787e88';
        ctx.beginPath();
        ctx.arc(this.x - 1, this.y - 1, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class Tank {
    constructor(config, spawn) {
        this.slot = config.slot;
        this.name = config.name;
        this.type = config.type; // 'human' | 'ai'
        this.aiLevel = config.aiLevel || 'normal';
        this.color = config.color;
        this.hat = config.hat || 'none';
        this.barrel = config.barrel || 'standard';

        this.x = spawn.x;
        this.y = spawn.y;
        this.angle = spawn.angle || 0;
        this.radius = 13.5;

        this.moveSpeed = 138;
        this.reverseSpeed = 98;
        this.turnSpeed = 3.55; // radians/sec

        this.alive = true;
        this.maxBullets = 5;
        this.fireCooldown = 0.35; // Prevent instant accidental shot on round spawn
        this.shootLatch = true;   // Require a fresh button press after spawning
        this.recoil = 0;
        this.treadTimer = 0;

        // Active Special Weapon: null or { id, name, short, color, ammo }
        this.weapon = null;
    }

    equipWeapon(weaponKey) {
        const def = WEAPON_TYPES[weaponKey];
        if (!def) return;
        this.weapon = {
            id: def.id,
            name: def.name,
            short: def.short,
            color: def.color,
            ammo: def.ammo
        };
    }

    update(dt, input, maze, bullets, mines, laserBeams, particles, callbacks = {}) {
        if (!this.alive) return;

        if (this.fireCooldown > 0) this.fireCooldown -= dt;
        if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 5);

        let moved = false;

        if (input.steerMode === 'direct') {
            const targetAngle = Math.atan2(input.vecY, input.vecX);
            let diff = targetAngle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const maxTurn = this.turnSpeed * 1.35 * dt;
            if (Math.abs(diff) <= maxTurn) {
                this.angle = targetAngle;
            } else {
                this.angle += Math.sign(diff) * maxTurn;
            }

            const mag = Math.min(1, Math.hypot(input.vecX, input.vecY));
            if (mag > 0.2 && Math.abs(diff) < Math.PI * 0.65) {
                this.x += Math.cos(this.angle) * this.moveSpeed * mag * dt;
                this.y += Math.sin(this.angle) * this.moveSpeed * mag * dt;
                moved = true;
            }

            if (input.down) {
                this.x -= Math.cos(this.angle) * this.reverseSpeed * dt;
                this.y -= Math.sin(this.angle) * this.reverseSpeed * dt;
                moved = true;
            }
        } else {
            if (input.left) this.angle -= this.turnSpeed * dt;
            if (input.right) this.angle += this.turnSpeed * dt;

            if (input.up) {
                this.x += Math.cos(this.angle) * this.moveSpeed * dt;
                this.y += Math.sin(this.angle) * this.moveSpeed * dt;
                moved = true;
            } else if (input.down) {
                this.x -= Math.cos(this.angle) * this.reverseSpeed * dt;
                this.y -= Math.sin(this.angle) * this.reverseSpeed * dt;
                moved = true;
            }
        }

        resolveCircleMazeCollision(this, this.radius, maze);

        if (moved) {
            this.treadTimer += dt;
            if (this.treadTimer >= 0.055) {
                this.treadTimer = 0;
                particles.addTreadMark(this.x, this.y, this.angle);
            }
        }

        // Firing logic (Gatling allows continuous hold-to-fire; others require button press)
        const isGatling = this.weapon && this.weapon.id === 'GATLING';
        if (input.shoot) {
            if ((isGatling || !this.shootLatch) && this.fireCooldown <= 0) {
                this.handleFire(maze, bullets, mines, laserBeams, particles, callbacks);
                this.shootLatch = true;
            }
        } else {
            this.shootLatch = false;
        }
    }

    handleFire(maze, bullets, mines, laserBeams, particles, callbacks) {
        const muzzleDist = this.radius + 6;
        const bx = this.x + Math.cos(this.angle) * muzzleDist;
        const by = this.y + Math.sin(this.angle) * muzzleDist;

        if (!this.weapon) {
            const activeCount = bullets.filter((b) => b.alive && b.ownerSlot === this.slot && !b.isSpecial).length;
            if (activeCount >= this.maxBullets) return;

            const bullet = this.spawnProjectile(new Bullet(this.slot, bx, by, this.angle), maze);
            bullets.push(bullet);
            this.recoil = 1;
            this.fireCooldown = 0.22;
            particles.spawnMuzzlePuff(bx, by, this.angle);
            if (callbacks.onShoot) callbacks.onShoot(this, 'NORMAL');
            return;
        }

        const wId = this.weapon.id;

        if (wId === 'LASER') {
            const points = computeBouncingLaserPath(bx, by, this.angle, maze, 3, 950);
            laserBeams.push(new LaserBeamEffect(points, this.weapon.color));
            this.recoil = 1.2;
            this.fireCooldown = 0.35;
            particles.spawnMuzzlePuff(bx, by, this.angle);
            if (callbacks.onLaserFire) callbacks.onLaserFire(this, points);
        } else if (wId === 'GATLING') {
            const spread = (Math.random() - 0.5) * 0.24;
            const b = this.spawnProjectile(
                new Bullet(this.slot, bx, by, this.angle + spread, {
                    speed: 315,
                    radius: 3.2,
                    maxAge: 4.8,
                    color: '#ff6d00'
                }),
                maze
            );
            bullets.push(b);
            this.recoil = 0.65;
            this.fireCooldown = 0.085;
            particles.spawnMuzzlePuff(bx, by, this.angle);
            if (callbacks.onShoot) callbacks.onShoot(this, 'GATLING');
        } else if (wId === 'HOMING') {
            const missile = this.spawnProjectile(new HomingMissile(this.slot, bx, by, this.angle), maze);
            bullets.push(missile);
            this.recoil = 1.2;
            this.fireCooldown = 0.35;
            particles.spawnMuzzlePuff(bx, by, this.angle);
            if (callbacks.onShoot) callbacks.onShoot(this, 'HOMING');
        } else if (wId === 'FRAG') {
            const frag = this.spawnProjectile(new FragBombBullet(this.slot, bx, by, this.angle), maze);
            bullets.push(frag);
            this.recoil = 1.2;
            this.fireCooldown = 0.35;
            particles.spawnMuzzlePuff(bx, by, this.angle);
            if (callbacks.onShoot) callbacks.onShoot(this, 'FRAG');
        } else if (wId === 'SHOTGUN') {
            const pelletCount = 7;
            for (let i = 0; i < pelletCount; i++) {
                const offset = ((i / (pelletCount - 1)) - 0.5) * 0.42;
                const p = this.spawnProjectile(
                    new Bullet(this.slot, bx, by, this.angle + offset, {
                        speed: 285 + (Math.random() - 0.5) * 25,
                        radius: 3.1,
                        maxAge: 3.6,
                        color: '#0288d1'
                    }),
                    maze
                );
                bullets.push(p);
            }
            this.recoil = 1.4;
            this.fireCooldown = 0.38;
            particles.spawnMuzzlePuff(bx, by, this.angle);
            if (callbacks.onShoot) callbacks.onShoot(this, 'SHOTGUN');
        } else if (wId === 'MINE') {
            // Drop proximity mine behind tank
            const mx = this.x - Math.cos(this.angle) * (this.radius + 4);
            const my = this.y - Math.sin(this.angle) * (this.radius + 4);
            mines.push(new ProximityMine(this.slot, mx, my));
            this.fireCooldown = 0.3;
            if (callbacks.onShoot) callbacks.onShoot(this, 'MINE');
        }

        // Consume special weapon ammo
        this.weapon.ammo--;
        if (this.weapon.ammo <= 0) {
            this.weapon = null;
        }
        if (callbacks.onWeaponChanged) {
            callbacks.onWeaponChanged(this);
        }
    }

    spawnProjectile(proj, maze) {
        if (!hasLineOfSight(this.x, this.y, proj.x, proj.y, maze)) {
            proj.x = this.x + Math.cos(this.angle) * (this.radius * 0.45);
            proj.y = this.y + Math.sin(this.angle) * (this.radius * 0.45);
            proj.leftShooter = true;
        }
        return proj;
    }

    draw(ctx, maze) {
        if (!this.alive) return;

        // Draw dotted bouncing Laser Sight when holding LASER
        if (this.weapon && this.weapon.id === 'LASER' && maze) {
            const muzzleDist = this.radius + 6;
            const bx = this.x + Math.cos(this.angle) * muzzleDist;
            const by = this.y + Math.sin(this.angle) * muzzleDist;
            const sightPoints = computeBouncingLaserPath(bx, by, this.angle, maze, 2, 700);

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 23, 68, 0.65)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(sightPoints[0].x, sightPoints[0].y);
            for (let i = 1; i < sightPoints.length; i++) {
                ctx.lineTo(sightPoints[i].x, sightPoints[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        drawTankModel(ctx, {
            x: this.x,
            y: this.y,
            angle: this.angle,
            color: this.color,
            hat: this.hat,
            barrel: this.barrel,
            recoil: this.recoil,
            scale: 1,
            weaponColor: this.weapon ? this.weapon.color : null
        });

        // Player Name Tag (+ Weapon Tag if holding a special weapon)
        ctx.save();
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        const labelText = this.weapon ? `${this.name} [${this.weapon.short}:${this.weapon.ammo}]` : this.name;
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
        ctx.fillRect(this.x - textWidth / 2 - 4, this.y - 28, textWidth + 8, 14);
        ctx.fillStyle = this.weapon ? this.weapon.color : '#fff';
        ctx.fillText(labelText, this.x, this.y - 17.5);
        ctx.restore();
    }
}
