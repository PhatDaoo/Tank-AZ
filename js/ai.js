// Smart Bot AI Controller for AZ Tank (Supports Easy / Normal / Hard)

import { hasLineOfSight } from './physics.js';

function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

export class AIController {
    constructor() {
        this.stateBySlot = {};
    }

    reset() {
        this.stateBySlot = {};
    }

    computeInput(tank, allTanks, bullets, maze, dt, crates = []) {
        const input = {
            up: false,
            down: false,
            left: false,
            right: false,
            shoot: false,
            steerMode: 'classic',
            vecX: 0,
            vecY: 0
        };

        if (!tank.alive) return input;

        if (!this.stateBySlot[tank.slot]) {
            this.stateBySlot[tank.slot] = {
                shootTimer: 0,
                stuckTimer: 0,
                reverseTimer: 0,
                lastX: tank.x,
                lastY: tank.y
            };
        }
        const st = this.stateBySlot[tank.slot];
        st.shootTimer = Math.max(0, st.shootTimer - dt);

        // 1. Check if stuck against a wall corner
        const movedDist = Math.hypot(tank.x - st.lastX, tank.y - st.lastY);
        st.lastX = tank.x;
        st.lastY = tank.y;
        if (movedDist < 12 * dt) {
            st.stuckTimer += dt;
            if (st.stuckTimer > 0.55) {
                st.reverseTimer = 0.45;
                st.stuckTimer = 0;
            }
        } else {
            st.stuckTimer = Math.max(0, st.stuckTimer - dt);
        }

        if (st.reverseTimer > 0) {
            st.reverseTimer -= dt;
            input.down = true;
            input.left = (tank.slot % 2 === 0);
            input.right = !input.left;
            return input;
        }

        // 2. Dodge incoming bullets heading toward this tank
        let urgentThreat = null;
        let minThreatTime = Infinity;
        for (const b of bullets) {
            if (!b.alive) continue;
            const rx = tank.x - b.x;
            const ry = tank.y - b.y;
            const dist = Math.hypot(rx, ry);
            if (dist > 170) continue;

            const bSpeed = Math.hypot(b.vx, b.vy) || 1;
            const bnx = b.vx / bSpeed;
            const bny = b.vy / bSpeed;
            const proj = rx * bnx + ry * bny;
            if (proj > 0) {
                // Perpendicular distance from tank center to bullet ray
                const perpDist = Math.abs(rx * (-bny) + ry * bnx);
                if (perpDist < tank.radius + 15) {
                    const tHit = proj / bSpeed;
                    if (tHit < minThreatTime) {
                        minThreatTime = tHit;
                        urgentThreat = { b, bnx, bny, rx, ry };
                    }
                }
            }
        }

        if (urgentThreat) {
            // Steer perpendicular to bullet path
            const cross = urgentThreat.rx * urgentThreat.bny - urgentThreat.ry * urgentThreat.bnx;
            const dodgeAngle = Math.atan2(urgentThreat.bny, urgentThreat.bnx) + (cross >= 0 ? -Math.PI / 2 : Math.PI / 2);
            const diff = normalizeAngle(dodgeAngle - tank.angle);
            if (Math.abs(diff) > Math.PI * 0.55) {
                // Reverse if facing opposite to dodge vector
                const revDiff = normalizeAngle(dodgeAngle + Math.PI - tank.angle);
                if (revDiff < -0.1) input.left = true;
                else if (revDiff > 0.1) input.right = true;
                input.down = true;
            } else {
                if (diff < -0.1) input.left = true;
                else if (diff > 0.1) input.right = true;
                input.up = true;
            }
            return input;
        }

        // 3. Find nearest living opponent
        let target = null;
        let bestDist = Infinity;
        for (const other of allTanks) {
            if (!other.alive || other.slot === tank.slot) continue;
            const d = Math.hypot(other.x - tank.x, other.y - tank.y);
            if (d < bestDist) {
                bestDist = d;
                target = other;
            }
        }

        if (!target) return input;

        const canSeeTarget = hasLineOfSight(tank.x, tank.y, target.x, target.y, maze);

        // If holding MINE and moving away from or near an enemy, drop mine!
        if (tank.weapon && tank.weapon.id === 'MINE' && st.shootTimer <= 0 && bestDist < 220) {
            input.shoot = true;
            st.shootTimer = 1.1;
        }

        if (canSeeTarget) {
            const aimAngle = Math.atan2(target.y - tank.y, target.x - tank.x);
            const diff = normalizeAngle(aimAngle - tank.angle);

            if (diff < -0.06) input.left = true;
            else if (diff > 0.06) input.right = true;

            // Keep comfortable combat distance
            if (bestDist > 125) input.up = true;
            else if (bestDist < 70) input.down = true;

            // Check safe front distance so AI doesn't blow itself up against a close wall
            const frontCheckX = tank.x + Math.cos(tank.angle) * 32;
            const frontCheckY = tank.y + Math.sin(tank.angle) * 32;
            const frontClear = hasLineOfSight(tank.x, tank.y, frontCheckX, frontCheckY, maze);

            const isGatling = tank.weapon && tank.weapon.id === 'GATLING';
            const aimTolerance = tank.aiLevel === 'hard' ? 0.16 : tank.aiLevel === 'easy' ? 0.32 : 0.22;
            const fireDelay = isGatling
                ? 0.05
                : tank.aiLevel === 'hard'
                ? 0.28
                : tank.aiLevel === 'easy'
                ? 0.78
                : 0.45;

            if (frontClear && Math.abs(diff) < aimTolerance && st.shootTimer <= 0) {
                input.shoot = true;
                st.shootTimer = fireDelay + (isGatling ? 0 : Math.random() * 0.18);
            }
        } else {
            // If no weapon equipped and a power-up crate is nearby, detour to grab it!
            let goalX = target.x;
            let goalY = target.y;

            if (!tank.weapon && crates.length > 0) {
                let bestCrate = null;
                let bestCrateDist = 230;
                for (const c of crates) {
                    if (!c.alive) continue;
                    const cd = Math.hypot(c.x - tank.x, c.y - tank.y);
                    if (cd < bestCrateDist) {
                        bestCrateDist = cd;
                        bestCrate = c;
                    }
                }
                if (bestCrate) {
                    goalX = bestCrate.x;
                    goalY = bestCrate.y;
                }
            }

            // Navigate through maze via BFS
            const myCell = maze.worldToCell(tank.x, tank.y);
            const targetCell = maze.worldToCell(goalX, goalY);
            const nextCell = maze.getNextStepTowards(myCell.col, myCell.row, targetCell.col, targetCell.row);
            const waypoint =
                myCell.col === targetCell.col && myCell.row === targetCell.row
                    ? { x: goalX, y: goalY }
                    : maze.cellCenter(nextCell.col, nextCell.row);

            const navAngle = Math.atan2(waypoint.y - tank.y, waypoint.x - tank.x);
            const diff = normalizeAngle(navAngle - tank.angle);

            if (diff < -0.11) input.left = true;
            if (diff > 0.11) input.right = true;

            if (Math.abs(diff) < 0.85) {
                input.up = true;
            }

            // Fire HOMING missile even around corners if reasonably close!
            const probeFarX = tank.x + Math.cos(tank.angle) * 58;
            const probeFarY = tank.y + Math.sin(tank.angle) * 58;
            const frontClear = hasLineOfSight(tank.x, tank.y, probeFarX, probeFarY, maze);

            if (tank.weapon && tank.weapon.id === 'HOMING' && frontClear && bestDist < maze.cellSize * 3.5 && st.shootTimer <= 0) {
                input.shoot = true;
                st.shootTimer = 0.7;
            } else if (tank.aiLevel !== 'easy' && bestDist < maze.cellSize * 1.9 && st.shootTimer <= 0 && frontClear && Math.random() < 0.025) {
                input.shoot = true;
                st.shootTimer = 0.85;
            }
        }

        return input;
    }
}

export const aiController = new AIController();
