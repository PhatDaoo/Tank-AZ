// Collision & Ricochet Physics Engine for AZ Tank

export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: x1, y: y1, t: 0 };
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return {
        x: x1 + t * dx,
        y: y1 + t * dy,
        t
    };
}

export function resolveCircleMazeCollision(entity, radius, maze) {
    const halfWall = maze.wallThickness * 0.5;
    const minDist = radius + halfWall;

    // 2 relaxation passes for smooth corner sliding
    for (let pass = 0; pass < 2; pass++) {
        for (const seg of maze.segments) {
            const cp = closestPointOnSegment(entity.x, entity.y, seg.x1, seg.y1, seg.x2, seg.y2);
            const dx = entity.x - cp.x;
            const dy = entity.y - cp.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.0001;
                const overlap = minDist - dist;
                entity.x += (dx / dist) * overlap;
                entity.y += (dy / dist) * overlap;
            }
        }
    }
}

export function resolveTankVsTankCollisions(tanks) {
    for (let i = 0; i < tanks.length; i++) {
        const a = tanks[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < tanks.length; j++) {
            const b = tanks[j];
            if (!b.alive) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDist = a.radius + b.radius;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = (minDist - dist) * 0.5;
                const nx = dx / dist;
                const ny = dy / dist;
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                b.x += nx * overlap;
                b.y += ny * overlap;
            }
        }
    }
}

export function stepBulletWithRicochet(bullet, dt, maze, onBounce) {
    const halfWall = maze.wallThickness * 0.5;
    const hitRadius = bullet.radius + halfWall;

    const totalDx = bullet.vx * dt;
    const totalDy = bullet.vy * dt;
    const moveDist = Math.hypot(totalDx, totalDy);
    const steps = Math.max(1, Math.ceil(moveDist / 2.5));
    const subDt = dt / steps;

    for (let s = 0; s < steps; s++) {
        bullet.x += bullet.vx * subDt;
        bullet.y += bullet.vy * subDt;

        let bouncedThisStep = false;
        for (const seg of maze.segments) {
            const cp = closestPointOnSegment(bullet.x, bullet.y, seg.x1, seg.y1, seg.x2, seg.y2);
            const dx = bullet.x - cp.x;
            const dy = bullet.y - cp.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < hitRadius * hitRadius) {
                let nx, ny;
                // Prefer clean axis normal when hitting the body of a horizontal/vertical wall
                if (cp.t > 0.02 && cp.t < 0.98) {
                    if (seg.orientation === 'H') {
                        nx = 0;
                        ny = dy >= 0 ? 1 : -1;
                    } else {
                        nx = dx >= 0 ? 1 : -1;
                        ny = 0;
                    }
                } else {
                    const dist = Math.sqrt(distSq) || 0.0001;
                    nx = dx / dist;
                    ny = dy / dist;
                }

                const dist = Math.sqrt(distSq) || 0.0001;
                const push = hitRadius - dist + 0.4;
                bullet.x += nx * push;
                bullet.y += ny * push;

                const dot = bullet.vx * nx + bullet.vy * ny;
                if (dot < 0) {
                    bullet.vx -= 2 * dot * nx;
                    bullet.vy -= 2 * dot * ny;
                    bullet.bounces++;
                    bouncedThisStep = true;
                }
            }
        }

        if (bouncedThisStep && onBounce) {
            onBounce(bullet);
        }
    }
}

export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) =>
        (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
    return (
        ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
        ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
    );
}

export function hasLineOfSight(x1, y1, x2, y2, maze) {
    for (const seg of maze.segments) {
        if (segmentsIntersect(x1, y1, x2, y2, seg.x1, seg.y1, seg.x2, seg.y2)) {
            return false;
        }
    }
    return true;
}
