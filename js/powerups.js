// AZ Tank Special Weapons, Power-Up Crates, Laser Raycast, Homing Missiles & Mines

import { closestPointOnSegment, stepBulletWithRicochet, hasLineOfSight } from './physics.js';

export const WEAPON_TYPES = {
    LASER: {
        id: 'LASER',
        name: 'LASER',
        short: 'LSR',
        color: '#ff1744',
        ammo: 1
    },
    GATLING: {
        id: 'GATLING',
        name: 'GATLING',
        short: 'GAT',
        color: '#ff9100',
        ammo: 18
    },
    HOMING: {
        id: 'HOMING',
        name: 'HOMING',
        short: 'HMG',
        color: '#00e676',
        ammo: 1
    },
    FRAG: {
        id: 'FRAG',
        name: 'FRAG BOMB',
        short: 'FRG',
        color: '#d500f9',
        ammo: 1
    },
    SHOTGUN: {
        id: 'SHOTGUN',
        name: 'SHOTGUN',
        short: 'SHG',
        color: '#00b0ff',
        ammo: 2
    },
    MINE: {
        id: 'MINE',
        name: 'MINE',
        short: 'MIN',
        color: '#ffd600',
        ammo: 3
    }
};

const WEAPON_KEYS = Object.keys(WEAPON_TYPES);

export class PowerUpCrate {
    constructor(x, y, weaponKey) {
        this.x = x;
        this.y = y;
        this.weaponKey = weaponKey || WEAPON_KEYS[Math.floor(Math.random() * WEAPON_KEYS.length)];
        this.weapon = WEAPON_TYPES[this.weaponKey];
        this.radius = 13;
        this.age = 0;
        this.alive = true;
    }

    update(dt) {
        this.age += dt;
    }

    draw(ctx) {
        if (!this.alive) return;
        const pulse = 1 + Math.sin(this.age * 5) * 0.05;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(pulse, pulse);

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(-11, -9, 24, 24);

        // Crate box
        ctx.fillStyle = '#d7ccc8';
        ctx.strokeStyle = '#26292e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 24, 4);
        ctx.fill();
        ctx.stroke();

        // Colored weapon frame
        ctx.strokeStyle = this.weapon.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-9, -9, 18, 18);

        // Label inside crate
        ctx.fillStyle = '#111';
        ctx.font = '900 8.5px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.weapon.short, 0, 0.5);

        ctx.restore();
    }
}

// Compute a multi-bounce ray path for Laser Sight and Laser Beam
export function computeBouncingLaserPath(startX, startY, startAngle, maze, maxBounces = 2, maxLenPerSegment = 900) {
    const points = [{ x: startX, y: startY }];
    let curX = startX;
    let curY = startY;
    let dx = Math.cos(startAngle);
    let dy = Math.sin(startAngle);

    for (let bounce = 0; bounce <= maxBounces; bounce++) {
        let bestT = maxLenPerSegment;
        let hitSeg = null;

        for (const seg of maze.segments) {
            const hit = raySegmentIntersection(curX, curY, dx, dy, seg.x1, seg.y1, seg.x2, seg.y2);
            if (hit && hit.t > 0.5 && hit.t < bestT) {
                bestT = hit.t;
                hitSeg = seg;
            }
        }

        const nextX = curX + dx * bestT;
        const nextY = curY + dy * bestT;
        points.push({ x: nextX, y: nextY });

        if (!hitSeg) break;

        // Reflect direction vector off wall segment
        if (hitSeg.orientation === 'H') {
            dy = -dy;
        } else {
            dx = -dx;
        }
        curX = nextX + dx * 0.8;
        curY = nextY + dy * 0.8;
    }

    return points;
}

function raySegmentIntersection(rx, ry, rdx, rdy, x1, y1, x2, y2) {
    const sx = x2 - x1;
    const sy = y2 - y1;
    const denom = rdx * sy - rdy * sx;
    if (Math.abs(denom) < 1e-6) return null;

    const qpx = x1 - rx;
    const qpy = y1 - ry;
    const t = (qpx * sy - qpy * sx) / denom;
    const u = (qpx * rdy - qpy * rdx) / denom;

    if (t >= 0 && u >= 0 && u <= 1) {
        return { t, u };
    }
    return null;
}

// Check if a tank circle intersects any polyline segment of a fired Laser Beam
export function checkLaserHitsTank(points, tank, isOwner) {
    for (let i = 0; i < points.length - 1; i++) {
        // Owner cannot be hit by the first segment leaving their own barrel
        if (isOwner && i === 0) continue;
        const p1 = points[i];
        const p2 = points[i + 1];
        const cp = closestPointOnSegment(tank.x, tank.y, p1.x, p1.y, p2.x, p2.y);
        const dist = Math.hypot(tank.x - cp.x, tank.y - cp.y);
        if (dist <= tank.radius + 3) {
            return { hit: true, x: cp.x, y: cp.y };
        }
    }
    return { hit: false };
}

// Active Fired Laser Beam Visual
export class LaserBeamEffect {
    constructor(points, color = '#ff1744') {
        this.points = points;
        this.color = color;
        this.life = 0.28;
        this.maxLife = 0.28;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0 || this.points.length < 2) return;
        const alpha = Math.max(0, this.life / this.maxLife);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Outer glow
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha * 0.65;
        ctx.lineWidth = 9 * alpha;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();

        // Inner white core
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3 * alpha;
        ctx.stroke();

        ctx.restore();
    }
}

// Maze-Pathfinding Homing Missile
export class HomingMissile {
    constructor(ownerSlot, x, y, angle) {
        this.isSpecial = 'HOMING';
        this.ownerSlot = ownerSlot;
        this.x = x;
        this.y = y;
        this.speed = 235;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.angle = angle;
        this.radius = 5.2;
        this.bounces = 0;
        this.age = 0;
        this.armTime = 0.42; // Arms after 0.42s and locks onto nearest tank
        this.maxAge = 8.5;
        this.alive = true;
        this.leftShooter = false;
        this.smokeTimer = 0;
    }

    steerTowardsTarget(dt, tanks, maze, particles) {
        this.smokeTimer += dt;
        if (this.smokeTimer >= 0.035) {
            this.smokeTimer = 0;
            particles.particles.push({
                x: this.x - Math.cos(this.angle) * 6,
                y: this.y - Math.sin(this.angle) * 6,
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.5) * 18,
                size: 3,
                life: 0.22,
                maxLife: 0.22,
                color: this.age >= this.armTime ? '#ff6d00' : '#9e9e9e'
            });
        }

        this.angle = Math.atan2(this.vy, this.vx);
        if (this.age < this.armTime) return;

        // Find nearest living tank (once armed, like AZ, it targets the closest tank in maze!)
        let bestTank = null;
        let bestScore = Infinity;
        for (const t of tanks) {
            if (!t.alive) continue;
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            // Slightly prefer enemy tanks over owner unless owner is much closer
            const score = t.slot === this.ownerSlot ? d * 1.35 : d;
            if (score < bestScore) {
                bestScore = score;
                bestTank = t;
            }
        }

        if (!bestTank) return;

        let targetX = bestTank.x;
        let targetY = bestTank.y;

        if (!hasLineOfSight(this.x, this.y, bestTank.x, bestTank.y, maze)) {
            const myCell = maze.worldToCell(this.x, this.y);
            const tCell = maze.worldToCell(bestTank.x, bestTank.y);
            const nextStep = maze.getNextStepTowards(myCell.col, myCell.row, tCell.col, tCell.row);
            const center = maze.cellCenter(nextStep.col, nextStep.row);
            targetX = center.x;
            targetY = center.y;
        }

        const desiredAngle = Math.atan2(targetY - this.y, targetX - this.x);
        let diff = desiredAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnRate = 5.4; // rad/s
        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt);
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.age >= this.armTime ? '#ff3d00' : '#616161';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-5, -4.5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

// Frag Bomb Projectile (detonates into shrapnel pellets)
export class FragBombBullet {
    constructor(ownerSlot, x, y, angle) {
        this.isSpecial = 'FRAG';
        this.ownerSlot = ownerSlot;
        this.x = x;
        this.y = y;
        this.speed = 225;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.radius = 6.2;
        this.bounces = 0;
        this.age = 0;
        this.maxAge = 1.75; // Explodes into 14 shrapnel shards when timer expires!
        this.alive = true;
        this.leftShooter = false;
    }

    draw(ctx) {
        ctx.save();
        const flash = Math.floor(this.age * 12) % 2 === 0;
        ctx.fillStyle = flash ? '#d500f9' : '#212121';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - 1.5, this.y - 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Proximity Mine
export class ProximityMine {
    constructor(ownerSlot, x, y) {
        this.ownerSlot = ownerSlot;
        this.x = x;
        this.y = y;
        this.radius = 9;
        this.triggerRadius = 29;
        this.age = 0;
        this.armTime = 1.05; // 1.05s to get away after dropping
        this.alive = true;
    }

    update(dt) {
        this.age += dt;
    }

    isArmed() {
        return this.age >= this.armTime;
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.save();

        // Once armed, becomes stealthy (low opacity like AZ mines!)
        const alpha = this.isArmed() ? 0.22 + Math.sin(this.age * 6) * 0.08 : 0.92;
        ctx.globalAlpha = Math.max(0.12, alpha);

        ctx.fillStyle = '#37474f';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Blinking LED center
        ctx.fillStyle = this.isArmed() ? '#ff1744' : '#ffd600';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
