// GameMonster.js — слепой монстр бассейна. Не видит ничего: только СЛЫШИТ шум воды (GamePool.noise). Без шума — бродит
// в воде на расстоянии от игрока (далеко отстал — ныряет и всплывает ближе). Громкий всплеск — короткая реакция и бросок
// по воде к точке всплеска на большой скорости (платформы проныривает, стены и колонны обходит по сетке GamePool.path).
// На месте — принюхивается; тихие гребки рядом слышит и бросается снова. Дотянулся до пловца — хватает (игрок: скример).
// Фальшфейер держит его на расстоянии. Вид — assets/models/monster.glb (риг Rig.js: idle, crawl, sniff, lunge, scream, dive,
// rise, grab); нет модели — тёмная фигура-заглушка.
//
//   const m = await PoolMonster.create(view, { x, z, level });   // level — номер уровня (скорость броска)
//   GamePool.onNoise(n => m.hear(n));                           // Game раздаёт шум всем монстрам
//   m.update(dt, { player, swimmers, flare, safe, onGrab });     // swimmers: [{ actor, bot }] — кто сейчас в воде

const MONSTER_MODEL_URL = 'assets/models/monster.glb';

class PoolMonster {
    static cfg() {
        const U = 'undefined';
        return {
            rush: typeof MONSTER_RUSH_SPEED !== U ? MONSTER_RUSH_SPEED : 1150,
            rushPer: typeof MONSTER_RUSH_PER_LEVEL !== U ? MONSTER_RUSH_PER_LEVEL : 55,
            react: typeof MONSTER_REACT_SEC !== U ? MONSTER_REACT_SEC : 0.35,
            lurkMin: typeof MONSTER_LURK_MIN !== U ? MONSTER_LURK_MIN : 1900,
            lurkMax: typeof MONSTER_LURK_MAX !== U ? MONSTER_LURK_MAX : 3200,
            lurkSpeed: typeof MONSTER_LURK_SPEED !== U ? MONSTER_LURK_SPEED : 160,
            grab: typeof MONSTER_GRAB_DIST !== U ? MONSTER_GRAB_DIST : 120,
            search: typeof MONSTER_SEARCH_SEC !== U ? MONSTER_SEARCH_SEC : 2.2,
            hearNear: typeof MONSTER_HEAR_NEAR !== U ? MONSTER_HEAR_NEAR : 700,
        };
    }

    /** @param {any} view @param {any} opts */
    static async create(view, opts) {
        const m = new PoolMonster(view, opts);
        await m.ready;
        return m;
    }

    /** @param {any} view @param {{ x: number, z: number, level?: number, id?: number, rnd?: () => number }} opts */
    constructor(view, opts) {
        this.view = view;
        this.id = opts.id || 0;
        this.c = PoolMonster.cfg();
        this.speed = this.c.rush + this.c.rushPer * Math.max(0, (opts.level || 1) - 1);
        this.rnd = opts.rnd || Math.random;
        this.x = opts.x; this.z = opts.z; this.y = GamePool.level;
        this.yaw = this.rnd() * Math.PI * 2;
        /** @type {'lurk' | 'react' | 'rush' | 'search' | 'grab' | 'retreat' | 'dive' | 'rise' | 'scream'} */
        this.state = 'lurk';
        this.t = 0;
        /** @type {any} */ this.target = null;      // { x, z, power, src, who }
        /** @type {any[]} */ this.path = [];
        this.pathT = 0;
        this.wakeT = 0;
        this.wander = null;
        /** @type {any} */ this.prey = null;
        this.sink = 0;                              // доп. погружение (под платформой, нырок)
        /** @type {any} */ this.rig = null;
        /** @type {any} */ this.mesh = null;
        this.disposed = false;
        this.loop = null;
        this.ready = this._build();
    }

    async _build() {
        try {
            const model = await Rig.load(MONSTER_MODEL_URL);
            if (this.disposed) return;
            this.rig = Rig.create(model, this.view, { name: 'monster-' + this.id, kind: 'actor' });
            this.rig.play('idle', { fade: 0, at: this.rnd() });
        } catch (e) {
            console.warn('PoolMonster: модель не загрузилась, заглушка —', (e && e.message) || e);
            const scene = this.view.scene;
            const body = BABYLON.MeshBuilder.CreateCapsule('monster-stub', { radius: 60, height: 240, orientation: new BABYLON.Vector3(1, 0, 0) }, scene);
            const mat = new BABYLON.StandardMaterial('monster-stub-mat', scene);
            mat.diffuseColor = new BABYLON.Color3(0.12, 0.1, 0.09);
            body.material = mat;
            this.mesh = new BABYLON.Mesh('monster-root', scene);
            body.parent = this.mesh; body.position.y = 60;
            World3D.addObject(this.view, this.mesh, 'actor');
        }
        this._sync();
    }

    get root() { return this.rig ? this.rig.root : this.mesh; }

    _play(clip, opts) { if (this.rig) this.rig.play(clip, opts || {}); }

    // ---------------------------------------------------------------------------------------------
    // Слух
    // ---------------------------------------------------------------------------------------------

    /** Шум воды. Громкое (≥ 0.6) слышно везде, тихое — только рядом (в поиске — вдвое дальше). */
    hear(n) {
        if (this.state === 'grab' || this.state === 'scream' || this.state === 'dive' || this.state === 'retreat') return;
        const d = Math.hypot(n.x - this.x, n.z - this.z);
        const near = this.c.hearNear * (this.state === 'search' ? 2 : 1);
        if (n.power < 0.6 && d > near) return;
        if (this.state === 'rush' || this.state === 'react') {
            const cur = this.target;
            // слабее и дальше текущей цели — не отвлекается; тихие гребки у цели — уточняют её
            const nearCur = cur && Math.hypot(n.x - cur.x, n.z - cur.z) < 500;
            if (cur && !nearCur && n.power < cur.power * 0.8) return;
            this.target = { x: n.x, z: n.z, power: Math.max(n.power, nearCur ? cur.power * 0.9 : 0), src: n.src, who: n.who };
            this.pathT = 0;
            return;
        }
        if (this.state === 'rise') { this.target = n; return; }
        const wasSearch = this.state === 'search';
        this.target = { x: n.x, z: n.z, power: n.power, src: n.src, who: n.who };
        this.state = 'react';
        this.t = wasSearch ? 0.1 : this.c.react;
        this._play('sniff', { fade: 0.1 });
        if (typeof Game !== 'undefined' && Game.sfxAt) Game.sfxAt('monster-hear', this.x, this.z, 0.8);
    }

    // ---------------------------------------------------------------------------------------------
    // Кадр
    // ---------------------------------------------------------------------------------------------

    /** @param {number} dt @param {{ player: any, swimmers: any[], flare: any, safe?: boolean, onGrab: (m: PoolMonster, s: any) => void }} ctx */
    update(dt, ctx) {
        if (this.disposed) return;
        this.t -= dt;
        const P = ctx.player;
        switch (this.state) {
            case 'lurk': this._lurk(dt, P); break;
            case 'react':
                if (this.t <= 0) this._startRush();
                break;
            case 'rush': this._rush(dt, ctx); break;
            case 'search':
                this._turnTo(this.yaw + Math.sin(this.t * 3) * 0.02, dt);
                this._catch(ctx);
                if (this.t <= 0) { this.state = 'lurk'; this.wander = null; this._play('idle', { fade: 0.3 }); }
                break;
            case 'grab':
                if (this.prey && this.prey.actor) {
                    const a = this.prey.actor;
                    // жертва тянется ко рту
                    a.x += (this.x + Math.cos(this.yaw) * 80 - a.x) * Math.min(1, dt * 6);
                    a.z += (this.z + Math.sin(this.yaw) * 80 - a.z) * Math.min(1, dt * 6);
                    if (a.sync) a.sync();
                }
                if (this.t <= 0) {
                    if (this.prey && this.prey.bot) { this.prey.actor.setVisible(false); this.prey = null; }
                    if (!this.prey || !this.prey.player) { this.state = 'search'; this.t = 1.2; this._play('sniff', { fade: 0.2 }); }
                }
                break;
            case 'scream': break;                    // скример игрока: стоит Game
            case 'retreat': this._retreat(dt, ctx); break;
            case 'dive':                              // клип сам уводит тело под воду (корень — на уровне воды)
                if (this.t <= 0) this._resurface(P);
                break;
            case 'rise':
                if (this.t <= 0) {
                    if (this.target) { const n = this.target; this.target = null; this.state = 'lurk'; this.hear(n); }
                    else { this.state = 'lurk'; this._play('idle', { fade: 0.2 }); }
                }
                break;
        }
        // фальшфейер: в радиус не заходит
        const F = ctx.flare;
        if (F && this.state !== 'grab' && this.state !== 'scream' && this.state !== 'dive') {
            const d = Math.hypot(this.x - F.x, this.z - F.z);
            if (d < F.radius) { this.state = 'retreat'; this.t = 2.5; this.target = null; this._play('crawl', { fade: 0.1, speed: 0.8 }); }
        }
        // под платформой — глубже (проныривает), на воде — спина и голова над водой
        const under = ObbyCourse.groundAt(this.x, this.z, GamePool.level + 120, 160) != null;
        const want = under ? 260 : 0;
        this.sinkUnder = (this.sinkUnder || 0) + (want - (this.sinkUnder || 0)) * Math.min(1, dt * 7);
        this.y = GamePool.surface(this.x, this.z) - this.sink - this.sinkUnder;   // корень модели — уровень воды
        this._sync();
    }

    _sync() {
        const r = this.root;
        if (!r) return;
        r.position.set(this.x, this.y, this.z);
        r.rotation.y = -this.yaw;
    }

    _turnTo(want, dt, rate) {
        let d = want - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += d * Math.min(1, dt * (rate || 6));
    }

    /** Шаг к точке по воде; true — дошёл. */
    _moveTo(tx, tz, speed, dt) {
        const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
        if (d < 1) return true;
        const s = Math.min(d, speed * dt);
        const nx = this.x + dx / d * s, nz = this.z + dz / d * s;
        if (GamePool.navFree(nx, nz) || !GamePool.navFree(this.x, this.z)) { this.x = nx; this.z = nz; }
        else return true;
        this._turnTo(Math.atan2(dz, dx), dt, 9);
        return s >= d - 0.5;
    }

    _lurk(dt, P) {
        const c = this.c;
        const d = P ? Math.hypot(P.x - this.x, P.z - this.z) : 0;
        if (P && d > c.lurkMax * 1.35) { this._dive(); return; }
        if (!this.wander || this.t <= 0) {
            this.t = 3 + this.rnd() * 4;
            let p = null;
            if (P) p = GamePool.randomWaterNear(P.x, P.z, c.lurkMin, c.lurkMax, this.rnd);
            if (!p) p = GamePool.randomWaterNear(this.x, this.z, 300, 900, this.rnd);
            this.wander = p;
            if (p) { this.path = GamePool.path(this.x, this.z, p.x, p.z) || []; }
            this._play(this.path.length ? 'crawl' : 'idle', { fade: 0.3, speed: 0.35 });
        }
        if (this.path.length) {
            const n = this.path[0];
            if (this._moveTo(n.x, n.z, c.lurkSpeed, dt)) this.path.shift();
            if (!this.path.length) this._play('idle', { fade: 0.4 });
        }
        this._wake(dt, 0.25, 0.35);
    }

    _dive() {
        this.state = 'dive'; this.t = 0.7; this.path = [];
        this._play('dive', { loop: false, fade: 0.1 });
    }

    _resurface(P) {
        const c = this.c;
        const p = P ? GamePool.randomWaterNear(P.x, P.z, c.lurkMin, c.lurkMax, this.rnd) : null;
        if (p) { this.x = p.x; this.z = p.z; }
        this.state = 'rise'; this.t = 0.7;
        this._play('rise', { loop: false, fade: 0.05 });
    }

    _startRush() {
        const T = this.target;
        if (!T) { this.state = 'lurk'; return; }
        this.path = GamePool.path(this.x, this.z, T.x, T.z) || [{ x: T.x, z: T.z }];
        this.pathT = 0.25;
        this.state = 'rush';
        this._play('crawl', { fade: 0.08, speed: 1.25 });
        if (typeof Game !== 'undefined' && Game.sfxAt) Game.sfxAt('monster-growl', this.x, this.z);
    }

    _rush(dt, ctx) {
        const T = this.target;
        if (!T) { this.state = 'lurk'; return; }
        // утка уплывает — цель едет за ней (шум сам обновляет точку); путь пересчитывается не чаще 4 раз в секунду
        this.pathT -= dt;
        if (this.pathT <= 0) {
            this.pathT = 0.25;
            const last = this.path[this.path.length - 1];
            if (!last || Math.hypot(last.x - T.x, last.z - T.z) > 80) this.path = GamePool.path(this.x, this.z, T.x, T.z) || [{ x: T.x, z: T.z }];
        }
        const n = this.path[0];
        if (n && this._moveTo(n.x, n.z, this.speed, dt)) this.path.shift();
        this._wake(dt, 0.07, 0.9);
        if (this._catch(ctx)) return;
        // добрался до точки всплеска — принюхивается
        if (!this.path.length || Math.hypot(T.x - this.x, T.z - this.z) < 70) {
            this.state = 'search';
            this.t = this.c.search;
            this.target = null;
            this._play('sniff', { fade: 0.12 });
        }
    }

    /** Хватает ближайшего пловца в радиусе. true — схватил. */
    _catch(ctx) {
        if (ctx.safe && !ctx.swimmers.some(s => s.bot)) return false;
        let best = null, bd = this.c.grab;
        for (const s of ctx.swimmers) {
            if (s.player && ctx.safe) continue;
            const a = s.actor;
            if (!a || a.grabbed) continue;
            if (a.climb && a.climb.t > a.climb.dur * 0.45) continue;      // почти вылез — не достать
            const d = Math.hypot(a.x - this.x, a.z - this.z);
            if (d < bd) { bd = d; best = s; }
        }
        // утка: сожрать игрушку
        if (!best && ctx.toys) for (const toy of ctx.toys) {
            const p = GamePool.toyAt(toy);
            if (!toy.done && Math.hypot(p.x - this.x, p.z - this.z) < this.c.grab) {
                toy.done = true; toy.sinkT = 0.4;
                if (typeof Game !== 'undefined' && Game.sfxAt) Game.sfxAt('chomp', this.x, this.z, 0.9);
                this.state = 'search'; this.t = 1.4; this.target = null; this._play('grab', { loop: false, fade: 0.06 });
                return true;
            }
        }
        if (!best) return false;
        this.prey = best;
        best.actor.grabbed = true;
        this.yaw = Math.atan2(best.actor.z - this.z, best.actor.x - this.x);
        this.state = best.player ? 'scream' : 'grab';
        this.t = 1.1;
        this.path = []; this.target = null;
        this._play(best.player ? 'lunge' : 'grab', { loop: false, fade: 0.05 });
        if (GamePool.water) GamePool.water.splash(this.x, this.z, 1.2, true);
        ctx.onGrab(this, best);
        return true;
    }

    _retreat(dt, ctx) {
        const F = ctx.flare;
        if (!F || this.t <= 0) { this.state = 'lurk'; this.wander = null; return; }
        const dx = this.x - F.x, dz = this.z - F.z, d = Math.hypot(dx, dz) || 1;
        if (d > F.radius * 1.6) { this.state = 'lurk'; this.wander = null; return; }
        this._moveTo(this.x + dx / d * 200, this.z + dz / d * 200, this.speed * 0.45, dt);
        this._wake(dt, 0.1, 0.6);
    }

    /** Кильватер: круги по воде за монстром. */
    _wake(dt, every, power) {
        this.wakeT -= dt;
        if (this.wakeT > 0 || !GamePool.water || this.sinkUnder > 120 || this.state === 'dive') return;
        this.wakeT = every;
        GamePool.water.disturb(this.x - Math.cos(this.yaw) * 60, this.z - Math.sin(this.yaw) * 60, power, 70);
    }

    /** Отпустить жертву (игрок спасся): монстр отплывает и принюхивается. */
    release() {
        if (this.prey && this.prey.actor) this.prey.actor.grabbed = false;
        this.prey = null;
        this.sink = 0;
        this.state = 'dive'; this.t = 0.7;
        this._play('dive', { loop: false, fade: 0.1 });
    }

    /** Скример: поза «крик» (камеру ставит Game). */
    scream() { this._play('scream', { fade: 0.05 }); }

    /** Точка лица для камеры скримера (мир). */
    facePos() {
        if (this.rig && this.rig.nodes.has('Head')) { const p = this.rig.nodePosition('Head'); return { x: p.x, y: p.y, z: p.z }; }
        return { x: this.x + Math.cos(this.yaw) * 60, y: this.y + 200, z: this.z + Math.sin(this.yaw) * 60 };
    }

    dispose() {
        this.disposed = true;
        if (this.rig) { const root = this.rig.root; this.rig.dispose(); try { root.dispose(false, false); } catch (e) { /* уже */ } }
        if (this.mesh) { try { this.mesh.dispose(false, true); } catch (e) { /* уже */ } }
        this.rig = null; this.mesh = null;
    }
}
