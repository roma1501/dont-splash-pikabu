// GamePool.js — вода уровня и всё, что в ней шумит. Живая вода движка (LiveWater3D) строится по маркерам карты
// `pool`, `pool-2`… (прямоугольники: полуразмеры scale[0]·100 × scale[2]·100, курс rot[1], h — уровень воды), платформы
// трассы — препятствия для ряби и пены. Слепой монстр ничего не видит: он слышит только «шум» — GamePool.noise(),
// который поднимают всплески (упал игрок или бот, камень, бутылка, заводная утка, плывущий). Здесь же предметы игрока
// (камень с «блинчиками», бутылка, утка, фальшфейер, верёвка, толчок) и сетка воды для пути монстра.
//
//   GamePool.build(app)            // в prepare карты, после ObbyCourse.build
//   GamePool.onNoise(fn)           // fn({ x, z, power, src, who }) — слушает монстр
//   GamePool.inWater(x, z)         // точка над водой (в прямоугольнике pool и не под платформой)
//   GamePool.surface(x, z)         // высота видимой поверхности (волны и рябь) | уровень
//   GamePool.path(ax, az, bx, bz)  // путь по воде для монстра [{x, z}] (платформы он проныривает, стены и колонны обходит)
//   GamePool.update(dt)            // вода, предметы

/** @satisfies {Record<string, any>} */
const GamePool = {
    /** @type {any} */ app: null,
    /** @type {any} */ water: null,
    /** @type {Array<{ x: number, y: number, hx: number, hy: number, rot: number, level: number, c: number, s: number }>} */ rects: [],
    level: 200,
    /** @type {Array<(n: any) => void>} */ listeners: [],
    /** @type {any[]} */ items: [],
    /** @type {any} */ nav: null,
    /** @type {any} */ flare: null,
    /** @type {Map<string, any>} */ models: new Map(),
    /** @type {any} */ steam: null,

    // ---------------------------------------------------------------------------------------------
    // Постройка
    // ---------------------------------------------------------------------------------------------

    build(app) {
        this.dispose();
        this.app = app;
        const loc = app.location;
        this.rects = loc.markers('pool').map((m) => {
            const s = Array.isArray(m.scale) ? m.scale : [1, 1, 1];
            const rot = Array.isArray(m.rot) ? Number(m.rot[1]) || 0 : 0, a = rot * Math.PI / 180;
            return { x: m.x, y: m.y, hx: (Number(s[0]) || 1) * 100, hy: (Number(s[2]) || Number(s[0]) || 1) * 100, rot, level: Number(m.h) || 200, c: Math.cos(a), s: Math.sin(a) };
        });
        this.level = this.rects.length ? this.rects[0].level : 200;
        if (!this.rects.length) return;
        // препятствия ряби: детали трассы, пересекающие уровень воды (платформы, колонны, стены)
        const obstacles = [];
        for (const p of ObbyCourse.pieces) {
            if (p.color === 'ghost' || p.type === 'arrow') continue;
            const bb = this._pieceBox(p);
            if (!bb || bb.y0 > this.level + 4 || bb.y1 < this.level - 30) continue;
            const rot = Array.isArray(p.def.rot) ? Number(p.def.rot[1]) || 0 : 0;
            if (p.type === 'cyl') obstacles.push({ x: p.O[0], y: p.O[2], r: p.sx / 2 });
            else obstacles.push({ x: p.O[0], y: p.O[2], hx: p.sx / 2, hy: p.sz / 2, rot });
        }
        const q = typeof Quality !== 'undefined' && Quality._inited ? Quality.level + 1 : 0;
        this.water = LiveWater3D.create(loc.view, /** @type {any} */ ({
            areas: this.rects.map(r => ({ x: r.x, y: r.y, hx: r.hx, hy: r.hy, rot: r.rot, level: r.level })),
            level: this.level, heightAt: () => 0, obstacles, fx: app.fx, quality: q || undefined,
            depthFull: 190, waveHeight: 5, shallow: 0x8fd8bf, deep: 0x3f9e86, sky: 0xdcdcc4, horizon: 0xd3ccad, waveLength: 900, rippleHeight: 30, alphaShallow: 0.8,
            onSplash: (x, y, power, quiet) => { if (!quiet) this._splashSound(x, y, power); },
        }));
        this._buildNav();
        this._buildSteam(app);
    },

    /** Пар над бассейном, как в бане: большие мягкие клубы медленно поднимаются вокруг игрока. */
    _buildSteam(app) {
        if (!app.fx || typeof BABYLON === 'undefined') return;
        const lvl = this.level;
        const at = () => { const h = typeof Game !== 'undefined' ? Game.hero : null; return new BABYLON.Vector3(h ? h.x : 0, lvl, h ? h.z : 0); };
        const low = typeof Quality !== 'undefined' && Quality.level === 0;
        try {
            this.steam = app.fx.create({
                name: 'steam', rate: low ? 6 : 13, capacity: low ? 60 : 130, life: [6, 10], size: [320, 720], speed: [6, 26],
                color: '#fffaf0', alpha: 0.11, blend: 'standard', box: [[-1700, -10, -1700], [1700, 30, 1700]],
                direction: [[-0.35, 1, -0.35], [0.35, 1, 0.35]], gravity: [0, 5, 0], follow: at, spin: [-0.08, 0.08],
                sizeGradient: [[0, 0.45], [1, 1.5]], colorGradient: [[0, '#ffffff', 0], [0.25, '#fffaf0', 0.13], [0.7, '#fffaf0', 0.09], [1, '#ffffff', 0]],
            });
        } catch (e) { this.steam = null; }
    },

    /** Габарит детали по её коллайдерам (мир): { x0, y0, z0, x1, y1, z1 }. */
    _pieceBox(p) {
        if (!p.cols || !p.cols.length) return null;
        const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
        for (const c of p.cols) {
            const a = c.aabb;
            b.x0 = Math.min(b.x0, a[0]); b.y0 = Math.min(b.y0, a[1]); b.z0 = Math.min(b.z0, a[2]);
            b.x1 = Math.max(b.x1, a[3]); b.y1 = Math.max(b.y1, a[4]); b.z1 = Math.max(b.z1, a[5]);
        }
        return b;
    },

    dispose() {
        for (const it of this.items) this._dropItem(it);
        this.items = [];
        this.flareOff();
        if (this.steam) { try { this.steam.dispose(); } catch (e) { /* сцена */ } this.steam = null; }
        if (this.water) { try { this.water.dispose(); } catch (e) { /* уже освобождена со сценой */ } }
        this.water = null;
        this.nav = null;
    },

    // ---------------------------------------------------------------------------------------------
    // Вода: где она, какая высота
    // ---------------------------------------------------------------------------------------------

    /** Внутри прямоугольника бассейна (без учёта платформ). */
    inPool(x, z) {
        for (const r of this.rects) {
            const dx = x - r.x, dz = z - r.y;
            const lx = dx * r.c + dz * r.s, lz = -dx * r.s + dz * r.c;
            if (Math.abs(lx) <= r.hx && Math.abs(lz) <= r.hy) return true;
        }
        return false;
    },

    /** Открытая вода: бассейн и нет платформы на уровне воды. */
    inWater(x, z) {
        if (!this.inPool(x, z)) return false;
        const g = ObbyCourse.groundAt(x, z, this.level + 120, 160);
        return g == null || g < this.level - 20;
    },

    surface(x, z) {
        const h = this.water ? this.water.heightAt(x, z) : null;
        return h != null ? h : this.level;
    },

    // ---------------------------------------------------------------------------------------------
    // Шум: монстр слышит только его
    // ---------------------------------------------------------------------------------------------

    onNoise(fn) { this.listeners.push(fn); },

    /** Шум без всплеска (плывущий, утка): power 0.2 — тихо, 1 — падение, 1.5 — бутылка. */
    noise(x, z, power, src, who) {
        const n = { x, z, power, src, who: who || null };
        for (const fn of this.listeners) { try { fn(n); } catch (e) { console.error('GamePool noise:', e); } }
    },

    /** Всплеск: круги и брызги на живой воде + шум монстру. */
    splash(x, z, power, src, who) {
        if (this.water) this.water.splash(x, z, Math.min(1.4, power), power < 0.3);
        this.noise(x, z, power, src, who);
    },

    _splashSound(x, z, power) {
        if (typeof Game !== 'undefined' && Game.sfxAt) Game.sfxAt(power > 0.7 ? 'splash-big' : 'splash', x, z, Math.min(1, 0.35 + power * 0.5));
    },

    // ---------------------------------------------------------------------------------------------
    // Путь монстра по воде: сетка клеток, платформы он проныривает, стены и колонны до дна — обходит
    // ---------------------------------------------------------------------------------------------

    _buildNav() {
        const cell = 120;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const r of this.rects) {
            const ex = Math.abs(r.hx * r.c) + Math.abs(r.hy * r.s), ez = Math.abs(r.hx * r.s) + Math.abs(r.hy * r.c);
            x0 = Math.min(x0, r.x - ex); x1 = Math.max(x1, r.x + ex); z0 = Math.min(z0, r.y - ez); z1 = Math.max(z1, r.y + ez);
        }
        const w = Math.max(1, Math.ceil((x1 - x0) / cell)), h = Math.max(1, Math.ceil((z1 - z0) / cell));
        const cells = new Uint8Array(w * h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            if (this.inPool(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell)) cells[j * w + i] = 1;
        }
        // стены и колонны (низ у дна) — непроходимы, с запасом на тело монстра
        const pad = 70;
        for (const p of ObbyCourse.pieces) {
            if (p.dynamic) continue;
            const bb = this._pieceBox(p);
            if (!bb || bb.y0 > 60 || bb.y1 < this.level) continue;
            for (const c of p.cols) {
                const a = c.aabb;
                const i0 = Math.max(0, Math.floor((a[0] - pad - x0) / cell)), i1 = Math.min(w - 1, Math.floor((a[3] + pad - x0) / cell));
                const j0 = Math.max(0, Math.floor((a[2] - pad - z0) / cell)), j1 = Math.min(h - 1, Math.floor((a[5] + pad - z0) / cell));
                for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                    const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell;
                    if (this._inCol(c, cx, cz, pad)) cells[j * w + i] = 0;
                }
            }
        }
        this.nav = { x0, z0, cell, w, h, cells };
    },

    /** Точка (x, z) в горизонтальном сечении коллайдера с запасом pad (коробка с поворотом или цилиндр). */
    _inCol(c, x, z, pad) {
        const dx = x - c.O[0], dz = z - c.O[2];
        if (c.kind === 'cyl') {
            const lx = dx * c.ax[0] + dz * c.ax[2], lz = dx * c.az[0] + dz * c.az[2];
            const rx = (c.rx || 1) + pad, rz = (c.rz || 1) + pad;
            return (lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) <= 1;
        }
        if (c.kind === 'box') {
            const lx = dx * c.ax[0] + dz * c.ax[2], lz = dx * c.az[0] + dz * c.az[2];
            return Math.abs(lx) <= (c.hx || 0) + pad && Math.abs(lz) <= (c.hz || 0) + pad;
        }
        const a = c.aabb;
        return x >= a[0] - pad && x <= a[3] + pad && z >= a[2] - pad && z <= a[5] + pad;
    },

    navFree(x, z) {
        const N = this.nav;
        if (!N) return this.inPool(x, z);
        const i = Math.floor((x - N.x0) / N.cell), j = Math.floor((z - N.z0) / N.cell);
        return i >= 0 && j >= 0 && i < N.w && j < N.h && N.cells[j * N.w + i] === 1;
    },

    /** Ближайшая свободная клетка воды к точке (в радиусе reach px) или null. */
    nearestFree(x, z, reach) {
        const N = this.nav;
        if (!N) return null;
        if (this.navFree(x, z)) return { x, z };
        const R = Math.ceil((reach || 600) / N.cell);
        const ci = Math.floor((x - N.x0) / N.cell), cj = Math.floor((z - N.z0) / N.cell);
        let best = null, bd = Infinity;
        for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) {
            if (i < 0 || j < 0 || i >= N.w || j >= N.h || N.cells[j * N.w + i] !== 1) continue;
            const px = N.x0 + (i + 0.5) * N.cell, pz = N.z0 + (j + 0.5) * N.cell, d = (px - x) ** 2 + (pz - z) ** 2;
            if (d < bd) { bd = d; best = { x: px, z: pz }; }
        }
        return best;
    },

    /** Прямая по воде свободна (шаг полклетки). */
    clearLine(ax, az, bx, bz) {
        const N = this.nav;
        const d = Math.hypot(bx - ax, bz - az), step = N ? N.cell * 0.5 : 60, n = Math.ceil(d / step);
        for (let k = 1; k < n; k++) { const t = k / n; if (!this.navFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
        return true;
    },

    /** A* по клеткам воды; путь сглажен «прямыми видимости». null — недостижимо. */
    path(ax, az, bx, bz) {
        const N = this.nav;
        if (!N) return [{ x: bx, z: bz }];
        const s = this.nearestFree(ax, az, 500), g = this.nearestFree(bx, bz, 700);
        if (!s || !g) return null;
        if (this.clearLine(s.x, s.z, g.x, g.z)) return [{ x: g.x, z: g.z }];
        const W = N.w, H = N.h, idx = (i, j) => j * W + i;
        const si = Math.floor((s.x - N.x0) / N.cell), sj = Math.floor((s.z - N.z0) / N.cell);
        const gi = Math.floor((g.x - N.x0) / N.cell), gj = Math.floor((g.z - N.z0) / N.cell);
        const G = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
        const hh = (k) => { const i = k % W, j = (k / W) | 0; return Math.hypot(i - gi, j - gj); };
        const goal = idx(gi, gj);
        // открытый список — двоичная куча по f = G + h (на огромных картах перебор массива стоил десятки мс)
        /** @type {number[]} */ const heap = [], hf = [];
        const push = (k, f) => {
            let i = heap.length; heap.push(k); hf.push(f);
            while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; heap[i] = heap[p]; hf[i] = hf[p]; i = p; }
            heap[i] = k; hf[i] = f;
        };
        const pop = () => {
            const top = heap[0], lk = heap.pop(), lf = hf.pop();
            if (heap.length) {
                let i = 0;
                for (;;) {
                    const l = 2 * i + 1, r = l + 1;
                    let m = i, mf = lf;
                    if (l < heap.length && hf[l] < mf) { m = l; mf = hf[l]; }
                    if (r < heap.length && hf[r] < mf) { m = r; mf = hf[r]; }
                    if (m === i) break;
                    heap[i] = heap[m]; hf[i] = hf[m]; i = m;
                }
                heap[i] = lk; hf[i] = lf;
            }
            return top;
        };
        G[idx(si, sj)] = 0;
        push(idx(si, sj), hh(idx(si, sj)));
        let guard = 0;
        while (heap.length && guard++ < 120000) {
            const cur = pop();
            if (cur === goal) break;
            if (closed[cur]) continue;
            closed[cur] = 1;
            const ci = cur % W, cj = (cur / W) | 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                if (!di && !dj) continue;
                const ni = ci + di, nj = cj + dj;
                if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
                const nk = idx(ni, nj);
                if (N.cells[nk] !== 1 || closed[nk]) continue;
                if (di && dj && (N.cells[idx(ci + di, cj)] !== 1 || N.cells[idx(ci, cj + dj)] !== 1)) continue;
                const ng = G[cur] + (di && dj ? 1.414 : 1);
                if (ng < G[nk]) { G[nk] = ng; from[nk] = cur; push(nk, ng + hh(nk)); }
            }
        }
        if (from[goal] < 0 && goal !== idx(si, sj)) return null;
        const pts = [];
        for (let k = goal; k >= 0 && k !== idx(si, sj); k = from[k]) pts.push({ x: N.x0 + ((k % W) + 0.5) * N.cell, z: N.z0 + (((k / W) | 0) + 0.5) * N.cell });
        pts.reverse();
        pts[pts.length - 1] = { x: g.x, z: g.z };
        // сглаживание: из текущей точки — к самой дальней видимой
        const out = [];
        let px = s.x, pz = s.z, k = 0;
        while (k < pts.length) {
            let far = k;
            for (let m = pts.length - 1; m > k; m--) if (this.clearLine(px, pz, pts[m].x, pts[m].z)) { far = m; break; }
            out.push(pts[far]); px = pts[far].x; pz = pts[far].z; k = far + 1;
        }
        return out;
    },

    /** Случайная точка воды на расстоянии [dMin, dMax] от (x, z) или null. */
    randomWaterNear(x, z, dMin, dMax, rnd) {
        const R = rnd || Math.random;
        for (let t = 0; t < 40; t++) {
            const a = R() * Math.PI * 2, d = dMin + R() * (dMax - dMin);
            const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
            if (this.navFree(px, pz) && this.inWater(px, pz)) return { x: px, z: pz };
        }
        return null;
    },

    // ---------------------------------------------------------------------------------------------
    // Предметы
    // ---------------------------------------------------------------------------------------------

    /** Модель предмета (кэш разбора) -> корень меша в сцене; нет файла — простая фигура. */
    async _mesh(kind) {
        const view = this.app.location.view, scene = view.scene;
        const url = { pebble: 'assets/models/pebble.glb', bottle: 'assets/models/bottle.glb', toy: 'assets/models/toy_duck.glb', flare: 'assets/models/flare.glb' }[kind];
        let root = null;
        try {
            let model = this.models.get(kind);
            if (!model && url) { model = await Model3D.load(url); this.models.set(kind, model); }
            if (model) root = Model3D.build(model, scene, { name: 'item-' + kind });
        } catch (e) { root = null; }
        if (!root) {
            const color = { pebble: [0.55, 0.56, 0.6], bottle: [0.2, 0.7, 0.35], toy: [1, 0.85, 0.15], flare: [0.9, 0.15, 0.1] }[kind] || [1, 1, 1];
            root = kind === 'toy' ? BABYLON.MeshBuilder.CreateSphere('item-' + kind, { diameter: 34 }, scene)
                : BABYLON.MeshBuilder.CreateBox('item-' + kind, { width: 14, height: kind === 'pebble' ? 10 : 30, depth: 14 }, scene);
            const m = new BABYLON.StandardMaterial('item-mat-' + kind, scene);
            m.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
            root.material = m;
        }
        World3D.addObject(view, root, 'prop');
        return root;
    },

    _dropItem(it) {
        if (it.floater && this.water) { try { this.water.removeFloater(it.floater); } catch (e) { /* вода уже освобождена */ } }
        if (it.mesh) { try { it.mesh.dispose(false, true); } catch (e) { /* сцена освобождена */ } }
        it.mesh = null;
    },

    /**
     * Бросок вперёд: камень (серия «блинчиков») или бутылка (один громкий всплеск). from — { x, y, z } руки,
     * yaw — курс броска, range — дальность (px). Касания воды — всплески и шум монстру; плита — бросок кончился.
     */
    async throwItem(kind, from, yaw, range, skips) {
        const dx = Math.cos(yaw), dz = Math.sin(yaw);
        const hops = [];
        if (kind === 'pebble') {
            const n = Math.max(1, skips | 0);
            for (let k = 0; k < n; k++) hops.push(range * (0.55 + 0.45 * (n === 1 ? 1 : k / (n - 1))));
        } else hops.push(range * 1.15);
        const mesh = await this._mesh(kind);
        const it = { kind, mesh, t: 0, hop: 0, hops, from: { x: from.x, y: from.y, z: from.z }, dx, dz, a: { x: from.x, y: from.y, z: from.z }, b: null, dur: 0.5, spin: 0, done: false };
        this._nextHop(it);
        this.items.push(it);
        return it;
    },

    _nextHop(it) {
        const d = it.hops[it.hop];
        const tx = it.from.x + it.dx * d, tz = it.from.z + it.dz * d;
        const g = ObbyCourse.groundAt(tx, tz, 1600, 2000);
        const ty = g != null && g > this.level - 20 ? g + 4 : this.surface(tx, tz);
        const len = Math.hypot(tx - it.a.x, tz - it.a.z);
        it.b = { x: tx, y: ty, z: tz, solid: g != null && g > this.level - 20 };
        it.dur = Math.max(0.18, Math.min(0.9, len / (it.hop === 0 ? 1400 : 1100)));
        it.arc = it.hop === 0 ? Math.max(120, len * 0.28) : Math.max(25, len * 0.12);
        it.t = 0;
    },

    _stepThrow(it, dt) {
        it.t += dt;
        const k = Math.min(1, it.t / it.dur);
        const x = it.a.x + (it.b.x - it.a.x) * k, z = it.a.z + (it.b.z - it.a.z) * k;
        const y = it.a.y + (it.b.y - it.a.y) * k + Math.sin(Math.PI * k) * it.arc;
        if (it.mesh) {
            it.mesh.position.set(x, y, z);
            it.mesh.rotation.x += dt * 12; it.mesh.rotation.z += dt * 7;
        }
        if (k < 1) return;
        if (it.b.solid) {
            it.done = true;
            if (typeof Game !== 'undefined' && Game.sfxAt) Game.sfxAt(it.kind === 'bottle' ? 'glass' : 'clack', it.b.x, it.b.z);
            return;
        }
        const power = it.kind === 'bottle' ? 1.5 : Math.max(0.35, 0.75 - it.hop * 0.08);
        this.splash(it.b.x, it.b.z, power, it.kind);
        it.hop++;
        if (it.kind === 'pebble' && it.hop < it.hops.length) { it.a = { x: it.b.x, y: it.b.y, z: it.b.z }; this._nextHop(it); }
        else { it.done = true; it.sinkT = 0.6; }
    },

    /** Заводная утка: падает в ближайшую воду перед героем и плывёт по yaw, шумя battery секунд. */
    async launchToy(from, yaw, battery) {
        const dx = Math.cos(yaw), dz = Math.sin(yaw);
        let spot = null;
        for (let d = 120; d <= 700 && !spot; d += 40) {
            const x = from.x + dx * d, z = from.z + dz * d;
            if (this.inWater(x, z)) spot = { x, z };
        }
        if (!spot && this.water) { const w = this.water.nearestWater(from.x, from.z, 700); if (w) spot = { x: w.x, z: w.y }; }
        if (!spot) return null;
        const mesh = await this._mesh('toy');
        mesh.position.set(spot.x, this.surface(spot.x, spot.z), spot.z);
        mesh.rotation.y = -yaw;
        const floater = this.water ? this.water.addFloater(mesh, { radius: 26, draft: 6, heading: yaw, align: 1 }) : null;
        const it = { kind: 'toy', mesh, floater, yaw, life: battery, noiseT: 0, x: spot.x, z: spot.z, done: false, sinkT: 0 };
        this.splash(spot.x, spot.z, 0.6, 'toy');
        this.items.push(it);
        return it;
    },

    _stepToy(it, dt) {
        it.life -= dt;
        const f = it.floater;
        if (it.life > 0) {
            // моторчик: держим скорость по курсу, у препятствия — разворот
            const sp = 300, ax = Math.cos(it.yaw), az = Math.sin(it.yaw);
            const nx = (f ? f.x : it.x) + ax * 60, nz = (f ? f.y : it.z) + az * 60;
            if (!this.inWater(nx, nz)) it.yaw += Math.PI * (0.5 + Math.random() * 0.5);
            if (f) { f.vx = Math.cos(it.yaw) * sp; f.vy = Math.sin(it.yaw) * sp; f.heading = it.yaw; }
            else if (it.mesh) { it.x += Math.cos(it.yaw) * sp * dt; it.z += Math.sin(it.yaw) * sp * dt; it.mesh.position.set(it.x, this.surface(it.x, it.z), it.z); }
            it.noiseT -= dt;
            if (it.noiseT <= 0) {
                it.noiseT = 0.3;
                const px = f ? f.x : it.x, pz = f ? f.y : it.z;
                this.noise(px, pz, 0.7, 'toy');
                if (this.water) this.water.disturb(px, pz, 0.35, 40);
            }
            // ключик крутится
            if (it.mesh && it.mesh.getChildMeshes) for (const ch of it.mesh.getChildMeshes()) if (/key/i.test(ch.name)) ch.rotation.x += dt * 14;
        } else {
            it.done = true; it.sinkT = 2.5;
            if (f) { f.vx *= 0.2; f.vy *= 0.2; }
        }
    },

    /** Где сейчас утка (для монстра — «добыча»). */
    toyAt(it) { return it.floater ? { x: it.floater.x, z: it.floater.y } : { x: it.x, z: it.z }; },

    /** Фальшфейер: свет и искры у героя; монстр не подходит ближе radius. */
    flareOn(target, radius, sec) {
        this.flareOff();
        const scene = this.app.location.view.scene;
        const light = new BABYLON.PointLight('flare-light', new BABYLON.Vector3(0, 0, 0), scene);
        light.diffuse = new BABYLON.Color3(1, 0.35, 0.2);
        light.intensity = 1.6;
        light.range = radius * 1.6;
        let fx = null;
        try {
            fx = this.app.fx.create({ rate: 60, capacity: 120, life: [0.3, 0.8], size: [6, 16], speed: [60, 200], color: '#ffd27a', color2: '#ff3a1a',
                position: new BABYLON.Vector3(0, 0, 0), direction: [[-0.4, 1, -0.4], [0.4, 1, 0.4]], gravity: [0, -200, 0], blend: 'add' });
        } catch (e) { fx = null; }
        this.flare = { target, radius, left: sec, light, fx };
    },

    flareOff() {
        const f = this.flare;
        if (!f) return;
        try { f.light.dispose(); } catch (e) { /* сцена освобождена */ }
        try { if (f.fx && f.fx.stop) f.fx.stop(); if (f.fx && f.fx.dispose) f.fx.dispose(); } catch (e) { /* эффект освобождён */ }
        this.flare = null;
    },

    flareActive() { return !!this.flare; },

    _stepFlare(dt) {
        const f = this.flare;
        if (!f) return;
        f.left -= dt;
        if (f.left <= 0) { this.flareOff(); return; }
        const t = f.target, p = new BABYLON.Vector3(t.x, t.y + 150, t.z);
        f.light.position.copyFrom(p);
        f.light.intensity = 1.3 + Math.sin(performance.now() * 0.03) * 0.25 + Math.random() * 0.2;
        if (f.fx && f.fx.emitter) { try { f.fx.emitter = p; } catch (e) { /* эмиттер — свойство эффекта */ } }
        else if (f.fx && f.fx.setPosition) f.fx.setPosition(p);
    },

    /** Верёвка: ближайший верх платформы в радиусе reach от пловца — { x, y, z } | null. */
    ropeTarget(x, z, reach) {
        let best = null, bd = Infinity;
        for (let r = 80; r <= reach; r += 60) {
            const n = Math.max(8, Math.round(r / 40));
            for (let k = 0; k < n; k++) {
                const a = k / n * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
                const g = ObbyCourse.groundAt(px, pz, this.level + 700, 800);
                if (g == null || g < this.level + 10 || g > this.level + 600) continue;
                // встать с запасом от края
                const ix = px + Math.cos(a) * 50, iz = pz + Math.sin(a) * 50, g2 = ObbyCourse.groundAt(ix, iz, this.level + 700, 800);
                const tx = g2 != null && Math.abs(g2 - g) < 20 ? ix : px, tz = g2 != null && Math.abs(g2 - g) < 20 ? iz : pz;
                if (r < bd) { bd = r; best = { x: tx, y: g, z: tz }; }
            }
            if (best) return best;
        }
        return best;
    },

    update(dt) {
        if (this.water) this.water.update(dt);
        for (const it of this.items) {
            if (it.done) {
                it.sinkT -= dt;
                if (it.mesh && it.kind !== 'toy') it.mesh.position.y -= dt * 60;
                if (it.sinkT <= 0) { this._dropItem(it); it.gone = true; }
                continue;
            }
            if (it.kind === 'toy') this._stepToy(it, dt);
            else this._stepThrow(it, dt);
        }
        if (this.items.some(it => it.gone)) this.items = this.items.filter(it => !it.gone);
        this._stepFlare(dt);
    },
};
