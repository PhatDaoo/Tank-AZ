// Visual Effects: Tread Marks, Scorch Marks, Muzzle Puffs, Sparks, Tank Explosions

export class ParticleSystem {
    constructor() {
        this.treadMarks = [];
        this.scorchMarks = [];
        this.particles = [];
        this.rings = [];
        this.floatingTexts = [];
    }

    clear() {
        this.treadMarks = [];
        this.scorchMarks = [];
        this.particles = [];
        this.rings = [];
        this.floatingTexts = [];
    }

    spawnFloatingText(x, y, text, color = '#ffffff') {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            life: 1.0,
            maxLife: 1.0
        });
    }

    addTreadMark(x, y, angle) {
        this.treadMarks.push({
            x,
            y,
            angle,
            alpha: 0.22
        });
        if (this.treadMarks.length > 420) {
            this.treadMarks.shift();
        }
    }

    spawnMuzzlePuff(x, y, angle) {
        for (let i = 0; i < 6; i++) {
            const spread = (Math.random() - 0.5) * 0.65;
            const speed = 35 + Math.random() * 55;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                size: 3 + Math.random() * 3,
                life: 0.25 + Math.random() * 0.15,
                maxLife: 0.4,
                color: '#777'
            });
        }
    }

    spawnWallSpark(x, y) {
        for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 30 + Math.random() * 70;
            this.particles.push({
                x,
                y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                size: 2 + Math.random() * 1.5,
                life: 0.16 + Math.random() * 0.1,
                maxLife: 0.26,
                color: '#ffb300'
            });
        }
    }

    spawnBulletPop(x, y) {
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 20 + Math.random() * 40;
            this.particles.push({
                x,
                y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                size: 2.5,
                life: 0.2,
                maxLife: 0.2,
                color: '#555'
            });
        }
    }

    spawnTankExplosion(x, y, tankColor) {
        this.scorchMarks.push({ x, y, radius: 22 });

        this.rings.push({
            x,
            y,
            radius: 6,
            maxRadius: 52,
            alpha: 0.85,
            color: tankColor
        });

        const palette = [tankColor, '#ff5722', '#ffc107', '#333333', '#ffffff'];
        for (let i = 0; i < 38; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 40 + Math.random() * 190;
            const life = 0.35 + Math.random() * 0.45;
            this.particles.push({
                x,
                y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                size: 3 + Math.random() * 5.5,
                life,
                maxLife: life,
                color: palette[Math.floor(Math.random() * palette.length)]
            });
        }
    }

    update(dt) {
        for (let i = this.treadMarks.length - 1; i >= 0; i--) {
            this.treadMarks[i].alpha -= dt * 0.025;
            if (this.treadMarks[i].alpha <= 0) {
                this.treadMarks.splice(i, 1);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 10);
            r.alpha -= dt * 2.2;
            if (r.alpha <= 0) {
                this.rings.splice(i, 1);
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 28 * dt;
            ft.life -= dt;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    drawFloorDecals(ctx) {
        ctx.save();
        for (const t of this.treadMarks) {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(t.angle);
            ctx.fillStyle = `rgba(40, 44, 52, ${t.alpha})`;
            ctx.fillRect(-2, -11, 4, 4);
            ctx.fillRect(-2, 7, 4, 4);
            ctx.restore();
        }

        for (const s of this.scorchMarks) {
            const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.radius);
            grad.addColorStop(0, 'rgba(20, 20, 20, 0.45)');
            grad.addColorStop(0.6, 'rgba(35, 35, 35, 0.2)');
            grad.addColorStop(1, 'rgba(35, 35, 35, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawTopParticles(ctx) {
        ctx.save();
        for (const r of this.rings) {
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = Math.max(0, r.alpha);
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const ft of this.floatingTexts) {
            ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
            ctx.font = '900 12px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.restore();
    }
}
