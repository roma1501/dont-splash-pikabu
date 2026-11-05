// GameProps.js — физичные мелочи уровня: таблички «мокрый пол», шезлонги, надувные круги, мячи, спасательные круги.
// Объекты карты с этими моделями толкаются героем и ботами: скользят по плитке с трением, упираются в стены и колонны,
// табличка от сильного толчка опрокидывается, мяч катится. Столкнутое с платформы падает в воду — всплеск (его слышит
// монстр!) и дальше качается на живой воде поплавком (LiveWater3D.addFloater); в воде предмет можно толкать вплавь.
//
//   GameProps.build(app);                 // в prepare карты, после GamePool.build
//   GameProps.update(dt, actors);         // actors — [{ x, y, z, vx, vz, radius, swimming }]: герой и боты

const PROP_KINDS = [
    { re: /wet_sign/, r: 24, h: 72, mass: 0.6, tip: 230, lie: 18, floats: true, draft: 14 },
    { re: /float_ball/, r: 30, h: 60, mass: 0.35, roll: true, floats: true, draft: 20 },
    { re: /float_ring/, r: 50, h: 23, mass: 0.45, floats: true, draft: 7 },
    { re: /lifebuoy/, r: 44, h: 17, mass: 0.45, floats: true, draft: 6 },
    { re: /lounge_chair/, r: 62, h: 85, mass: 1.6, floats: true, draft: 30 },
];

/** @satisfies {Record<string, any>} */
const GameProps = {
    /** @type {any[]} */ list: [],
    /** @type {any} */ app: null,

    build(app) {
        this.app = app;
        this.list = [];
        const level = GamePool.level;
        for (const rec of app.location.objects) {
            const model = String(rec.def && rec.def.model || '');
            const kind = PROP_KINDS.find(k => k.re.test(model));
            if (!kind || !rec.mesh) continue;
            const m = rec.mesh;
            const s = Array.isArray(rec.def.scale) ? Number(rec.def.scale[0]) || 1 : 1;
            const b = {
                rec, mesh: m, kind, x: m.position.x, y: m.position.y, z: m.position.z, vx: 0, vy: 0, vz: 0,
                yaw: -m.rotation.y, spin: 0, tilt: m.rotation.z || 0, tipped: false, roll: 0,
                r: kind.r * s, h: kind.h * s, grounded: true, floater: null, gone: false, hitT: 0,
            };
            // уже на воде (плавает с карты) — сразу поплавок
            if (b.y <= level + 10 && GamePool.inWater(b.x, b.z)) this._toWater(b, false);
            this.list.push(b);
        }
    },

    _toWater(b, splash) {
        const w = GamePool.water;
        if (splash) GamePool.splash(b.x, b.z, Math.min(1.2, 0.35 + b.kind.mass * 0.25 + Math.hypot(b.vx, b.vz) / 2000), 'prop');
        if (!w || !b.kind.floats) { b.gone = true; b.sink = 1.2; return; }
        b.mesh.position.set(b.x, b.y, b.z);
        b.floater = w.addFloater(b.mesh, { radius: b.r, draft: b.kind.draft, heading: b.yaw, vx: b.vx * 0.5, vy: b.vz * 0.5, bounce: 0.5 });
        if (!b.floater) { b.gone = true; b.sink = 1.2; }
    },

    update(dt, actors) {
        if (!this.list.length) return;
        dt = Math.min(0.05, dt);
        const C = ObbyCourse, level = GamePool.level;
        for (const b of this.list) {
            if (b.gone) {
                if (b.sink > 0) { b.sink -= dt; b.mesh.position.y -= dt * 120; if (b.sink <= 0) b.mesh.setEnabled(false); }
                continue;
            }
            if (b.hitT > 0) b.hitT -= dt;
            // в воде: живая вода качает, пловцы и боты толкают поплавок
            if (b.floater) {
                const f = b.floater;
                for (const a of actors) {
                    const dx = f.x - a.x, dz = f.y - a.z, d = Math.hypot(dx, dz), minD = b.r + (a.radius || 28);
                    if (d >= minD || d < 1) continue;
                    const nx = dx / d, nz = dz / d, push = (minD - d) * 9 / b.kind.mass;
                    f.vx += nx * push; f.vy += nz * push;
                }
                continue;
            }
            // толчки героя и ботов
            for (const a of actors) {
                if (a.y > b.y + b.h + 30 || a.y + (a.height || 180) < b.y - 10) continue;
                const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01, minD = b.r + (a.radius || 28);
                if (d >= minD) continue;
                const nx = dx / d, nz = dz / d;
                b.x += nx * (minD - d); b.z += nz * (minD - d);
                const va = (a.vx || 0) * nx + (a.vz || 0) * nz;
                if (va <= 20) continue;
                const k = 1.35 / b.kind.mass;
                b.vx += nx * va * k; b.vz += nz * va * k;
                const sp = Math.hypot(b.vx, b.vz), cap = 1400;
                if (sp > cap) { b.vx *= cap / sp; b.vz *= cap / sp; }
                b.spin += ((dx * (a.vz || 0) - dz * (a.vx || 0)) / (d * 400)) * (b.kind.roll ? 0.5 : 1);
                if (b.kind.roll && b.grounded) b.vy = Math.min(380, va * 0.35);
                if (b.kind.tip && va > b.kind.tip) b.tipped = true;
                if (b.hitT <= 0) { b.hitT = 0.25; if (typeof Game !== 'undefined' && Game.sfxAt) Game.sfxAt('bump', b.x, b.z, Math.min(0.7, 0.2 + va / 1500)); }
            }
            // движение, трение, стены
            b.x += b.vx * dt; b.z += b.vz * dt;
            const fr = Math.exp(-(b.grounded ? (b.kind.roll ? 1.6 : b.tipped ? 5 : 4) : 0.3) * dt);
            b.vx *= fr; b.vz *= fr;
            b.yaw += b.spin * dt;
            b.spin *= Math.exp(-3 * dt);
            if (b.kind.roll) b.roll += Math.hypot(b.vx, b.vz) * dt / Math.max(10, b.r);
            const o = C.pushOut(b.x, b.y + 4, b.z, Math.max(10, b.r * 0.6), Math.max(20, b.h * 0.8));
            if (o.moved) {
                const mx = o.x - b.x, mz = o.z - b.z, ml = Math.hypot(mx, mz);
                if (ml > 0.5) { const nx = mx / ml, nz = mz / ml, vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; } }
                b.x = o.x; b.z = o.z;
            }
            // опора: плита под предметом; нет — падает (в воду или в пустоту)
            const g = C.groundAt(b.x, b.z, b.y + 40, b.grounded ? 30 : 60 + Math.max(0, -b.vy * dt));
            if (b.grounded && g != null) b.y = g;
            else {
                b.grounded = false;
                b.vy -= 3000 * dt;
                b.y += b.vy * dt;
                if (g != null && b.y <= g && b.vy <= 0) {
                    b.y = g;
                    if (b.kind.roll && b.vy < -300) b.vy = -b.vy * 0.45;
                    else { b.vy = 0; b.grounded = true; }
                }
                if (b.y < level - 10 && GamePool.inWater(b.x, b.z)) { this._toWater(b, true); continue; }
                if (b.y < -300) { b.gone = true; b.sink = 0.01; continue; }
            }
            // опрокидывание и вид
            if (b.tipped) b.tilt += (Math.PI / 2 - b.tilt) * Math.min(1, dt * 7);
            const m = b.mesh;
            m.position.set(b.x, b.y + (b.kind.lie ? Math.sin(b.tilt) * b.kind.lie : 0), b.z);
            m.rotation.y = -b.yaw;
            m.rotation.z = b.kind.roll ? -b.roll : b.tilt;
        }
    },
};
