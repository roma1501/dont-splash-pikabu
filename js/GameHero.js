// GameHero.js — герой и боты Blind Pool Monster: тело обби (ObbyBody: бег, прыжок, опоры, стены) + вид из Blender
// (assets/models/hero.glb, жёсткий риг Rig.js с клипами) + плавание в бассейне и вылезание на платформу.
// Один класс на игрока и ботов (контракт актора — шапка js/ObbyBots.js). Вид перекрашивается по скину:
// части модели с префиксами Skin_/Shirt_/Pants_/Shoe_/Hair_/Hat_ получают свой клон материала и цвет,
// причёска, шапка и аксессуары (Hair_*, Hat_*, Acc_*) показываются по скину.
//
//   const hero = await PoolHero.create(ObbyCourse, view, { look, who: 'player' });
//   hero.step(dt, { dx, dz, jump });   // на суше — ObbyBody; в воде — плавание (сам переходит по уровню воды)
//   hero.pose(state, dt);              // 'idle' | 'run' | 'air' | 'dead' | 'cheer' (+ сам ставит swim/tread/climb/grabbed)
//   hero.tryClimb()                    // в воде: ухватиться за ближайший край и вылезти (true — началось)

const HERO_MODEL_URL = 'assets/models/hero.glb';

class PoolHero extends ObbyBody {
    /** Скин по умолчанию (цвета 0xRRGGBB; формат — docs/DESIGN.md). */
    static get DEFAULT_LOOK() {
        return { skin: 0xf2c7a0, shirt: 0x2bb3a3, pants: 0x3b4a6b, shoes: 0xf06b4f, hair: 'short', hairColor: 0x4a2f1f, hat: 'none', acc: [] };
    }

    /** Части модели по названиям из скина. */
    static get PARTS() {
        return {
            hair: { short: 'Hair_Short', spiky: 'Hair_Spiky', long: 'Hair_Long', bun: 'Hair_Bun', mohawk: 'Hair_Mohawk', curly: 'Hair_Curly' },
            hat: { cap: 'Hat_Cap', swimcap: 'Hat_SwimCap', beanie: 'Hat_Beanie', bucket: 'Hat_Bucket', crown: 'Hat_Crown' },
            acc: { goggles: 'Acc_Goggles', snorkel: 'Acc_Snorkel', floaties: 'Acc_Float', backpack: 'Acc_Backpack', scarf: 'Acc_Scarf', ring: 'Acc_Ring', headphones: 'Acc_Headphones' },
        };
    }

    /** @param {any} course @param {any} view @param {any} [opts] */
    static async create(course, view, opts) {
        const h = new PoolHero(course, view, opts);
        await h.ready;
        return h;
    }

    /** @param {any} course @param {any} view @param {any} [opts] */
    constructor(course, view, opts) {
        super(course, opts);
        const o = opts || {};
        this.view = view;
        this.who = o.who || 'player';
        this.look = Object.assign(PoolHero.DEFAULT_LOOK, o.look || {});
        /** @type {any} */ this.rig = null;
        /** @type {any} */ this.avatar = null;
        /** @type {any[]} */ this.mats = [];
        this.swimming = false;
        /** @type {any} */ this.climb = null;
        this.grabbed = false;
        this.visible = true;
        this.shield = false;
        this.disposed = false;
        this.state = 'idle';
        this.t = 0;
        this.noiseT = 0;
        this.swimSpeed = 230;
        this.enterT = 0;
        this.tumble = 0; this.phase = Math.random() * 6;
        /** @type {((a: PoolHero) => void) | null} */ this.onEnterWater = null;
        /** @type {((a: PoolHero) => void) | null} */ this.onClimbed = null;
        this.ready = this._build();
    }

    async _build() {
        try {
            const model = await Rig.load(HERO_MODEL_URL);
            if (this.disposed) return;
            this.rig = Rig.create(model, this.view, { name: 'hero-' + this.who, kind: 'actor' });
            this.applyLook(this.look);
            this.rig.play('idle', { fade: 0, at: Math.random() });
        } catch (e) {
            // нет модели — блочный человечек движка (тот же контракт вида)
            console.warn('PoolHero: модель героя не загрузилась, запасной вид —', (e && e.message) || e);
            const L = this.look;
            this.avatar = ObbyAvatar.create(this.view, { skin: L.skin, shirt: L.shirt, pants: L.pants, hair: ['short', 'spiky', 'long'].includes(L.hair) ? L.hair : 'short', hairColor: L.hairColor, cap: -1 }, this.height);
        }
        this.sync();
    }

    // ---------------------------------------------------------------------------------------------
    // Вид: скин
    // ---------------------------------------------------------------------------------------------

    applyLook(look) {
        this.look = Object.assign(PoolHero.DEFAULT_LOOK, look || {});
        const rig = this.rig;
        if (!rig) return;
        const P = PoolHero.PARTS, L = this.look;
        for (const pre of ['Hair_', 'Hat_', 'Acc_']) rig.setPartVisible(pre, false);
        if (P.hair[L.hair]) rig.setPartVisible(P.hair[L.hair], true);
        if (P.hat[L.hat]) {
            rig.setPartVisible(P.hat[L.hat], true);
            // под шапку помещаются только короткая и длинная причёски; остальные торчали бы сквозь неё
            if (L.hat !== 'crown' && P.hair[L.hair] && !['short', 'long'].includes(L.hair)) rig.setPartVisible(P.hair[L.hair], false);
        }
        for (const a of L.acc || []) if (P.acc[a]) rig.setPartVisible(P.acc[a], true);
        const tint = (part) => {
            if (part.startsWith('Skin_')) return L.skin;
            if (part.startsWith('Shirt_')) return L.shirt;
            if (part.startsWith('Pants_')) return L.pants;
            if (part.startsWith('Shoe_')) return L.shoes;
            if (part.startsWith('Hair_')) return L.hairColor;
            if (part.startsWith('Hat_') && part !== 'Hat_Crown') return L.hatColor != null ? L.hatColor : L.shirt;
            return null;
        };
        for (const m of rig._meshes || []) {
            const part = String(m.metadata && m.metadata.part || m.name);
            const c = tint(part);
            if (c == null || !m.material) continue;
            if (!m.metadata.bpmOwnMat) {
                const src = m.material;
                const clone = src.subMaterials ? src.clone(src.name + '#' + this.who, true) : src.clone(src.name + '#' + this.who);
                m.material = clone;
                m.metadata = Object.assign({}, m.metadata, { bpmOwnMat: true });
                this.mats.push(clone);
            }
            const col = BABYLON.Color3.FromHexString('#' + Number(c).toString(16).padStart(6, '0'));
            const mats = m.material.subMaterials ? m.material.subMaterials : [m.material];
            for (const sm of mats) if (sm && sm.diffuseColor) sm.diffuseColor = col;
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Физика: суша (ObbyBody) и вода
    // ---------------------------------------------------------------------------------------------

    place(x, y, z, yaw) {
        super.place(x, y, z, yaw);
        this.swimming = false; this.climb = null; this.grabbed = false; this.enterT = 0;
        if (this.avatar) this.avatar.body.rotation.z = 0;
        this.sync();
    }

    /** Глубина пловца: ноги на столько ниже поверхности. */
    static depth() { return typeof POOL_SWIM_DEPTH !== 'undefined' ? POOL_SWIM_DEPTH : 120; }

    step(dt, cmd) {
        dt = Math.min(0.1, Math.max(0, dt || 0));
        this.t += dt;
        if (this.grabbed) { this.vx = this.vy = this.vz = 0; this.sync(); return; }
        if (this.climb) { this._stepClimb(dt); this.sync(); return; }
        if (this.swimming) this._stepSwim(dt, cmd || {});
        else {
            super.step(dt, cmd);
            // упал в бассейн: ноги ушли под воду над открытой водой
            if (!this.grounded && GamePool.rects.length && this.y < GamePool.level - 30 && GamePool.inPool(this.x, this.z)) this._enterWater();
        }
        this.sync();
    }

    _enterWater() {
        const fall = Math.max(0, -this.vy);
        this.swimming = true;
        this.knocked = false;
        this.grounded = false; this.support = null;
        this.vy = Math.max(-700, this.vy * 0.35);
        this.vx *= 0.35; this.vz *= 0.35;
        this.enterT = 0.6;
        this.noiseT = 0.8;
        const power = Math.min(1.4, 0.8 + fall / 2600);
        GamePool.splash(this.x, this.z, power, this.who === 'player' ? 'player' : 'bot', this);
        if (this.onEnterWater) this.onEnterWater(this);
    }

    _stepSwim(dt, cmd) {
        const sp = this.swimSpeed;
        const wx = (cmd.dx || 0) * sp, wz = (cmd.dz || 0) * sp;
        const k = Math.min(1, dt * 3.2);
        this.vx += (wx - this.vx) * k; this.vz += (wz - this.vz) * k;
        let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
        // из бассейна не выплываем
        if (!GamePool.inPool(nx, nz)) { nx = this.x; nz = this.z; this.vx *= -0.2; this.vz *= -0.2; }
        // вертикаль: пружина к поверхности (вход — нырок и всплытие)
        const target = GamePool.surface(nx, nz) - PoolHero.depth();
        this.vy += ((target - this.y) * 38 - this.vy * 7.5) * dt;
        let ny = this.y + this.vy * dt;
        const o = this.course.pushOut(nx, ny, nz, this.radius, this.height);
        nx = o.x; nz = o.z;
        if (o.y > ny + 2) { ny = Math.min(o.y, target); this.vy = Math.max(0, this.vy); }   // под плиту не подныриваем
        this.x = nx; this.y = ny; this.z = nz;
        const s = Math.hypot(this.vx, this.vz);
        this.speed = s;
        if (s > 25) {
            const want = Math.atan2(this.vz, this.vx);
            let d = want - this.yaw;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            this.yaw += d * Math.min(1, dt * 8);
        }
        if (this.enterT > 0) this.enterT -= dt;
        // плывущий шумит: монстр слышит гребки
        this.noiseT -= dt;
        if (s > 70 && this.noiseT <= 0) {
            this.noiseT = typeof POOL_SWIM_NOISE_SEC !== 'undefined' ? POOL_SWIM_NOISE_SEC : 0.45;
            GamePool.noise(this.x, this.z, 0.3, this.who === 'player' ? 'player-swim' : 'bot-swim', this);
            if (GamePool.water) GamePool.water.disturb(this.x, this.z, 0.25, 40);
            if (this.who === 'player' && typeof GameAudio !== 'undefined') GameAudio.play('swim');
        }
        if (cmd.jump) this.tryClimb();
    }

    /** Ближайший край платформы, за который можно ухватиться: { x, y, z, yaw } | null. */
    ledge() {
        const reach = typeof POOL_CLIMB_REACH !== 'undefined' ? POOL_CLIMB_REACH : 95;
        const climbMax = typeof POOL_CLIMB_MAX !== 'undefined' ? POOL_CLIMB_MAX : 150;
        const lvl = GamePool.surface(this.x, this.z);
        let best = null, bd = Infinity;
        const n = 16;
        for (let i = 0; i < n; i++) {
            const a = this.yaw + (i / n) * Math.PI * 2;
            // сначала — по курсу (меньший штраф), потом вокруг
            const pen = Math.min(i, n - i) * 6;
            for (let d = this.radius + 10; d <= this.radius + reach; d += 15) {
                const px = this.x + Math.cos(a) * d, pz = this.z + Math.sin(a) * d;
                const g = this.course.groundAt(px, pz, lvl + climbMax + 40, climbMax + 120);
                if (g == null || g < lvl - 10 || g > lvl + climbMax) continue;
                // встать на плиту с запасом от края
                const ix = px + Math.cos(a) * 45, iz = pz + Math.sin(a) * 45;
                const g2 = this.course.groundAt(ix, iz, g + 40, 80);
                const ok = g2 != null && Math.abs(g2 - g) < 24;
                const tx = ok ? ix : px, tz = ok ? iz : pz;
                const score = d + pen;
                if (score < bd) { bd = score; best = { x: tx, y: g, z: tz, yaw: a }; }
                break;
            }
        }
        return best;
    }

    canClimb() { return this.swimming && !this.climb && !!this.ledge(); }

    tryClimb() {
        if (!this.swimming || this.climb || this.grabbed) return false;
        const L = this.ledge();
        if (!L) return false;
        this.startClimb(L, typeof POOL_CLIMB_SEC !== 'undefined' ? POOL_CLIMB_SEC : 0.5);
        return true;
    }

    /** Вылезти на точку (край или верёвка): t — секунд. */
    startClimb(to, t) {
        this.climb = { x0: this.x, y0: this.y, z0: this.z, x1: to.x, y1: to.y, z1: to.z, t: 0, dur: t, rope: !!to.rope };
        this.yaw = Math.atan2(to.z - this.z, to.x - this.x);
        this.vx = this.vy = this.vz = 0;
        if (this.rig) this.rig.play('climb', { loop: false, restart: true, fade: 0.08, speed: 0.5 / Math.max(0.2, t) });
        if (GamePool.water) GamePool.water.splash(this.x, this.z, 0.35, true);
    }

    _stepClimb(dt) {
        const c = this.climb;
        c.t += dt;
        const k = Math.min(1, c.t / c.dur);
        const up = 1 - Math.pow(1 - Math.min(1, k * 1.35), 3), fw = k * k * (3 - 2 * k);
        this.x = c.x0 + (c.x1 - c.x0) * fw;
        this.z = c.z0 + (c.z1 - c.z0) * fw;
        this.y = c.y0 + (c.y1 - c.y0) * up + Math.sin(Math.PI * k) * (c.rope ? 60 : 12);
        if (k >= 1) {
            const yaw = this.yaw;
            super.place(c.x1, c.y1, c.z1, yaw);
            this.swimming = false; this.climb = null;
            if (this.onClimbed) this.onClimbed(this);
        }
    }

    knock(vx, vy, vz) {
        if (this.swimming || this.climb) return;
        super.knock(vx, vy, vz);
    }

    // ---------------------------------------------------------------------------------------------
    // Вид: поза и клипы
    // ---------------------------------------------------------------------------------------------

    sync() {
        const r = this.rig ? this.rig.root : this.avatar ? this.avatar.root : null;
        if (!r) return;
        r.position.set(this.x, this.y, this.z);
        r.rotation.y = -this.yaw;
    }

    setVisible(on) {
        this.visible = !!on;
        if (this.rig) this.rig.setEnabled(this.visible);
        else if (this.avatar) this.avatar.root.setEnabled(this.visible);
    }

    setShield(on) {
        this.shield = !!on;
        if (!on) this._alpha(1);
    }

    _alpha(v) {
        const list = this.rig ? this.rig._meshes || [] : this.avatar ? this.avatar.meshes : [];
        for (const m of list) m.visibility = v;
    }

    /** Поза: состояние от игры/ботов + своё (вода, вылезание, схвачен). */
    pose(state, dt) {
        let s = state;
        if (this.grabbed) s = 'grabbed';
        else if (this.climb) s = 'climb';
        else if (this.swimming) s = this.speed > 60 ? 'swim' : 'tread';
        else if (s === 'air') s = this.vy > 0 ? 'jump' : 'fall';
        else if (s === 'dead') s = 'fall';
        this.state = s;
        if (this.shield) this._alpha(Math.floor(this.t * 8) % 2 ? 0.35 : 0.85);
        if (this.rig) {
            if (s === 'climb') return;            // клип уже запущен в startClimb
            const clip = { idle: 'idle', run: 'run', jump: 'jump', fall: 'fall', swim: 'swim', tread: 'tread', cheer: 'cheer', grabbed: 'grabbed' }[s] || 'idle';
            const speed = s === 'run' ? Math.max(0.6, Math.min(1.5, (this.speed || 0) / 520)) : 1;
            this.rig.play(clip, { fade: s === 'jump' || s === 'fall' ? 0.1 : 0.15, speed });
            return;
        }
        // запасной вид: позы ObbyCharacter
        if (this.avatar) ObbyCharacter.prototype.pose.call(this, s === 'swim' || s === 'tread' || s === 'grabbed' ? 'dead' : s === 'jump' || s === 'fall' ? 'air' : s === 'climb' ? 'air' : s, dt);
    }

    /** Жест верхней половиной тела: 'throw' | 'push' | 'wave'. */
    gesture(name) {
        if (this.rig) this.rig.play(name, { layer: 'upper', loop: false, restart: true, fade: 0.06 });
    }

    /** Точка руки для броска (мир). */
    handPos() {
        if (this.rig && this.rig.nodes.has('Grip_R')) { const p = this.rig.nodePosition('Grip_R'); return { x: p.x, y: p.y, z: p.z }; }
        return { x: this.x + Math.cos(this.yaw) * 30, y: this.y + 150, z: this.z + Math.sin(this.yaw) * 30 };
    }

    dispose() {
        this.disposed = true;
        if (this.rig) { const root = this.rig.root; this.rig.dispose(); try { root.dispose(false, false); } catch (e) { /* уже */ } }
        if (this.avatar) this.avatar.dispose();
        for (const m of this.mats) { try { m.dispose(); } catch (e) { /* уже */ } }
        this.mats = [];
        this.rig = null; this.avatar = null;
    }
}
