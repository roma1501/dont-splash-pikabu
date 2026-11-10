// Game.js — Blind Pool Monster: паркур по плиточным платформам в туманных бассейных залах. В воде живёт слепой монстр:
// он слышит только всплески и мчится к точке, где кто-то упал. Успел вылезти на платформу — монстр принюхивается и уходит;
// не успел — скример и экран «Тебя схватили!» (спасательный круг, спасение за рекламу или чекпоинт). Карты — js/Maps.js
// (лобби с лавками + уровни pool-1…pool-10, генератор tools/gen-levels.mjs), дизайн и контракты модулей — docs/DESIGN.md.
//
// Состояния: 'menu' (меню поверх уровня, камера кружит) → 'run' (забег) ⇄ 'scare' (скример) → 'down' (схватили) → 'run' | чекпоинт;
// 'run' → 'result' (уровень пройден) → следующий уровень или лобби. 'lobby' — прогулка по лобби: лавки и портал забега.

ObbyCourse.hookMaps();

Object.assign(LANG_STRINGS.ru, {
    'title': GAME_TITLE,                 // экран загрузки (data-t="title"); у площадок со своим названием (GAME_TITLES) его ставит сборка
    'bpm.jump': 'Прыжок', 'bpm.climb': 'Вылезти', 'bpm.swim': 'Плыви к краю',
    'bpm.fellTip': 'Монстр услышал всплеск! Скорее к краю — Пробел, чтобы вылезти',
    'bpm.fellTipTouch': 'Монстр услышал всплеск! Скорее к краю — жми «Вылезти»',
    'bpm.checkpoint': 'Чекпоинт {n}!', 'bpm.noSupply': 'Закончилось: {name}', 'bpm.ropeOnlyWater': 'Верёвка — только в воде',
    'bpm.ropeNone': 'Рядом нет платформы', 'bpm.noPush': 'Рядом некого толкнуть', 'bpm.pushed': 'Вы толкнули {name}!',
    'bpm.botEaten': 'Монстр утащил {name}!', 'bpm.botFell': '{name} упал в воду', 'bpm.joined': '{name} зашёл', 'bpm.left': '{name} вышел',
    'bpm.finished': '{name} дошёл до выхода!', 'bpm.saved': 'Спасён!', 'bpm.coin': '+{n}', 'bpm.toyAte': 'Монстр сожрал утку!',
    'bpm.flareOn': 'Фальшфейер горит: монстр не подойдёт', 'bpm.stall.equipment': 'Снаряжение', 'bpm.stall.upgrades': 'Улучшения',
    'bpm.stall.shop': 'Магазин', 'bpm.stall.skins': 'Скины', 'bpm.stall.portal': 'Новый забег', 'bpm.lobby': 'Лобби',
    'bpm.capture': 'Нажми на экран, чтобы управлять', 'bpm.lockTip': 'Камера — мышью. Клавиша P — пауза',
    'bpm.stall.daily': 'Подарок дня', 'bpm.stall.wheel': 'Колесо фортуны',
    'bpm.tip.1': 'Монстр слепой — он слышит только всплески.', 'bpm.tip.2': 'Брось камень подальше: монстр поплывёт на звук.',
    'bpm.tip.3': 'В воде греби к краю и жми прыжок, чтобы вылезти.', 'bpm.tip.4': 'Чем больше монстров в забеге, тем больше монет.',
    'bpm.tip.5': 'Заводная утка шумит долго — монстр гонится за ней.', 'bpm.tip.6': 'Фальшфейер держит монстра на расстоянии.',
    'bpm.tip.7': 'Упавший бот тоже шумит — используй это!', 'bpm.tip.8': 'Подарок дня и колесо фортуны ждут в лобби.',
    'bpm.tut.pebble.t': 'Камень', 'bpm.tut.pebble.h': 'Брось камень (клавиша 1 или кнопка слота): всплеск уведёт монстра',
    'bpm.tut.cp.t': 'Чекпоинт', 'bpm.tut.cp.h': 'Беги по плиткам к флажку. Упадёшь в воду — вылезай быстрее, чем доплывёт монстр',
});
Object.assign(LANG_STRINGS.en, {
    'title': GAME_TITLE,
    'bpm.jump': 'Jump', 'bpm.climb': 'Climb out', 'bpm.swim': 'Swim to an edge',
    'bpm.fellTip': 'The monster heard the splash! Swim to an edge — Space to climb out',
    'bpm.fellTipTouch': 'The monster heard the splash! Swim to an edge — tap "Climb out"',
    'bpm.checkpoint': 'Checkpoint {n}!', 'bpm.noSupply': 'Out of {name}', 'bpm.ropeOnlyWater': 'The rope works only in water',
    'bpm.ropeNone': 'No platform in reach', 'bpm.noPush': 'Nobody to push', 'bpm.pushed': 'You pushed {name}!',
    'bpm.botEaten': 'The monster dragged {name} under!', 'bpm.botFell': '{name} fell into the water', 'bpm.joined': '{name} joined', 'bpm.left': '{name} left',
    'bpm.finished': '{name} reached the exit!', 'bpm.saved': 'Saved!', 'bpm.coin': '+{n}', 'bpm.toyAte': 'The monster ate the duck!',
    'bpm.flareOn': 'Flare lit: the monster keeps away', 'bpm.stall.equipment': 'Equipment', 'bpm.stall.upgrades': 'Upgrades',
    'bpm.stall.shop': 'Shop', 'bpm.stall.skins': 'Skins', 'bpm.stall.portal': 'New run', 'bpm.lobby': 'Lobby',
    'bpm.capture': 'Click the screen to take control', 'bpm.lockTip': 'Mouse moves the camera. P to pause',
    'bpm.stall.daily': 'Daily Gift', 'bpm.stall.wheel': 'Wheel of Fortune',
    'bpm.tip.1': 'The monster is blind — it only hears splashes.', 'bpm.tip.2': 'Throw a pebble far away: the monster swims to the sound.',
    'bpm.tip.3': 'In the water, swim to an edge and press jump to climb out.', 'bpm.tip.4': 'More monsters in a run means more coins.',
    'bpm.tip.5': 'A wind-up duck stays noisy for a while — the monster chases it.', 'bpm.tip.6': 'A flare keeps the monster at a distance.',
    'bpm.tip.7': 'A bot falling in makes noise too — use it!', 'bpm.tip.8': 'The Daily Gift and the Wheel of Fortune wait in the lobby.',
    'bpm.tut.pebble.t': 'Pebble', 'bpm.tut.pebble.h': 'Throw a pebble (key 1 or the slot button): the splash lures the monster away',
    'bpm.tut.cp.t': 'Checkpoint', 'bpm.tut.cp.h': 'Run along the tiles to the flag. Fall in — climb out before the monster arrives',
});

const LEVEL_COUNT = 10;

/** Совет на экране загрузки (случайный). */
function showLoadingTip() {
    const el = typeof document !== 'undefined' ? document.getElementById('ld-tip') : null;
    if (!el) return;
    el.textContent = Lang.t('bpm.tip.' + (1 + Math.floor(Math.random() * 8)));
}
showLoadingTip();
const STALLS = [
    { marker: 'stall-equipment', win: 'equipment', label: 'bpm.stall.equipment', color: '#3fd0c0', icon: '›' },
    { marker: 'stall-upgrades', win: 'upgrades', label: 'bpm.stall.upgrades', color: '#ffb23f', icon: '›' },
    { marker: 'stall-shop', win: 'shop', label: 'bpm.stall.shop', color: '#a77bff', icon: '›' },
    { marker: 'stall-skins', win: 'skins', label: 'bpm.stall.skins', color: '#ff7fc4', icon: '›' },
    { marker: 'portal', win: 'create', label: 'bpm.stall.portal', color: '#5fd6ff', icon: '›' },
    { marker: 'stall-daily', win: 'daily', label: 'bpm.stall.daily', color: '#ff6fae', icon: '›' },
    { marker: 'stall-wheel', win: 'wheel', label: 'bpm.stall.wheel', color: '#ffd23f', icon: '›' },
];
// Скины ботов: свои сочетания (не «нуб» и не «бекон»)
const BOT_HAIRS = ['short', 'spiky', 'long', 'bun', 'mohawk', 'curly', 'none'];
const BOT_HATS = ['none', 'none', 'cap', 'swimcap', 'beanie', 'bucket'];
const BOT_ACC = ['goggles', 'snorkel', 'floaties', 'backpack', 'scarf', 'ring', 'headphones'];
const BOT_SHIRTS = [0x2bb3a3, 0xf06b4f, 0x7a5cff, 0xffc93c, 0x34c38f, 0xff6fae, 0x3d8bff, 0xfafafa, 0x2e2e3a, 0xff8a3d];
const BOT_PANTS = [0x3b4a6b, 0x2e2e3a, 0x6b4a3b, 0x1f6b5c, 0x58507a, 0xd9d2c0];
const BOT_SKINS = [0xf6d2b4, 0xf2c7a0, 0xd9a47c, 0xb67a52, 0x8a5636, 0x5e3a24];
const BOT_HAIRC = [0x2a1d14, 0x4a2f1f, 0x9b5a2c, 0xe0c068, 0xc23b22, 0x9aa0ad, 0x2c4b8a, 0xff7fb0];

/** @satisfies {Record<string, any>} */
const Game = {
    /** @type {LoryApp | null} */ app: null,
    /** @type {any} */ save: null,
    /** @type {'menu' | 'lobby' | 'run' | 'scare' | 'down' | 'result'} */ state: 'menu',
    /** @type {any} */ hero: null,
    /** @type {any} */ tags: null,
    /** @type {PoolMonster[]} */ monsters: [],
    /** @type {any[]} */ coins: [],
    /** @type {any[]} */ rings: [],
    /** @type {any} */ coinMesh: null,
    cam: { x: 0, y: 0, h: 0, frameHeight: 820, frameWidth: 780 },
    run: { level: 1, bots: 4, monsters: 1 },
    level: 0, stage: 0, runTime: 0, falls: 0, runCoins: 0, downT: 0, scareT: 0, hudT: 0, heartT: 0,
    /** @type {any} */ grabber: null,
    /** @type {any} */ nearStall: null,
    slotCd: [0, 0, 0], pushCd: 0, shieldT: 0, fellTipShown: false, botsReady: false,
    /** @type {any} */ drone: null,
    /** @type {any} */ scareCam: null,

    // -------------------------------------------------------------------------------------------
    // Запуск
    // -------------------------------------------------------------------------------------------

    /** Продолжить с уровня, на котором игрок остановился. */
    async firstMap() {
        try { const s = await Platform.load(); return (s && s.map) || 'pool-1'; } catch (e) { return 'pool-1'; }
    },

    async init(app) {
        this.app = app;
        const saved = (await Platform.load()) || {};
        this.save = Object.assign({ map: 'pool-1', stage: 0, tutorialDone: false, runCfg: { bots: 4, monsters: 1 }, score: 0 }, saved);
        this.run = Object.assign({ level: 1, bots: 4, monsters: 1 }, this.save.runCfg);
        Eco.init(this.save, () => this.persist());
        Eco.on((e) => {
            this.refreshHud(true);
            const now = performance.now();
            if (now - (this._ecoSfxT || 0) < 150) return;       // одна покупка — несколько событий, звук один
            const name = { item: 'buy', tool: 'buy', upgrade: 'buy', pass: 'buy', daily: 'gift' }[e.type] || (e.type === 'adend' && e.ok ? 'reward' : '');
            if (name) { this._ecoSfxT = now; this.sfx(name); }
        });
        HudLayout.init({ app });
        Input.init({
            app, mouse: Platform.name === 'playgama' ? 'lock' : 'drag', actions: Object.assign({}, Input.DEFAULTS, {
                slot1: { keys: ['Digit1', 'Numpad1'] }, slot2: { keys: ['Digit2', 'Numpad2'] },
                slot3: { keys: ['Digit3', 'Numpad3'] }, push: { keys: ['KeyF'] },
                // Playables: вся игра одной мышью — ЛКМ как палец (стик и взгляд), ПКМ — прыжок; на остальных ПКМ крутит камеру
                jump: { keys: Platform.name === 'playables' ? ['Space', 'Mouse2'] : ['Space'], pad: [0] },
            }),
        });
        GameUI.init({
            onPlay: () => this.play(), onLobby: () => this.goLobby(), onStartRun: (cfg) => this.startRun(cfg),
            onOpen: () => this.windowOpened(), onClose: () => this.windowClosed(),
            onSlot: (i) => this.useSlot(i), onPush: () => this.doPush(), onRescue: (kind) => this.selfRescue(kind),
            onCheckpoint: () => Platform.ads.next(() => this.giveUp()), onNext: () => this.nextLevel(), onMenu: () => Platform.ads.next(() => this.goLobby()),
            onPause: () => this.togglePause(), onResume: () => this.togglePause(), onHowTo: () => this.howTo(),
            onSound: () => GameUI.setSound(!Sound.toggleMuted()), onEquipSkin: () => this.applySkin(), onPreviewSkin: (look) => this.previewSkin(look),
            onDouble: () => this.doubleCoins(), onInteract: () => this.interact(), onLogin: () => this.afterLogin(),
        });
        GameFx.init(app);
        if (Platform.name === 'playgama') {
            const hint = document.createElement('div');
            hint.id = 'bpm-capture';
            hint.textContent = Lang.t('bpm.capture');
            document.body.appendChild(hint);
        }
        if ((this.save.score | 0) > 0) Platform.submitScore(this.save.score | 0);   // таблица рекордов узнаёт прежний результат
        World3D.setLighting({ fog: 0.00052 });   // густой тёплый туман, как пар в бане (константа движка — для редактора и тестов)
        this.ui('setBestScore', this.save.score | 0);
        // Playables: межстраничная реклама при нажатии кнопок интерфейса (меню, окна, пауза, результат) — не в игровом процессе
        if (Platform.name === 'playables') document.addEventListener('click', (e) => this.uiClickAd(e), true);
        GameUI.setSound(!Sound.muted);
        GameAudio.init();
        GamePool.onNoise((n) => { for (const m of this.monsters) m.hear(n); });
        Input.on('unlock', () => this.onCursorFreed());
        app.onFrame(() => this.syncCursor());
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Escape' && e.code !== 'KeyP') return;
            if (e.code === 'Escape' && Platform.name === 'playgama') return;
            if (e.code === 'Escape' && performance.now() - (this._unlockT || -1e9) < 300) return;   // этот Esc уже отпустил курсор и открыл паузу
            if (GameUI.isOpen()) { if (e.code === 'Escape') GameUI.closeWindows(); return; }
            this.togglePause();
        });
        const cam = app.camera;
        Object.assign(cam.c, { collide: 1, fade: 1 });          // камера не уходит в стены и колонны, заслоны полупрозрачны
        // средняя кнопка мыши в игре не двигает камеру (панорама отцепила бы её от героя)
        const ignore = cam.ignorePointer;
        cam.ignorePointer = (e) => (e.pointerType !== 'touch' && e.button === 1) || (ignore ? ignore(e) : false);
        app.canvas && app.canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
        if (cam.sight) cam.sight.query = (a, b) => {
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
            if (L < 1) return null;
            const h = ObbyCourse.ray(a.x, a.y, a.z, dx / L, dy / L, dz / L, L);
            return h ? h.t : null;
        };
        await this.prepare(app);
        Tutorial.init({
            app, state: () => this.save, field: 'tutorialDone', persist: () => this.persist(),
            steps: [
                Tutorial.preset('move'), Tutorial.preset('look'), Tutorial.preset('jump'),
                { id: 'pebble', title: 'bpm.tut.pebble.t', hint: 'bpm.tut.pebble.h', target: '#bpm-slot-0' },
                { id: 'checkpoint', title: 'bpm.tut.cp.t', hint: 'bpm.tut.cp.h', world: () => { const c = ObbyCourse.checkpoints[0]; return c ? { x: c.x, y: c.z, h: c.y + 260 } : null; } },
            ],
        });
        if (typeof Quality !== 'undefined') Quality.onChange(() => ObbyBots.setCount(this.botCount()));
        this.toMenu();
    },

    async ready() { Platform.gameplay(false); },

    levelOf(mapId) { const m = /^pool-(\d+)$/.exec(mapId || ''); return m ? Number(m[1]) : 0; },

    botCount() {
        // в лобби — «живой сервер»: игроки бегают круг по залу, болтают, заходят и выходят
        let n = this.level === 0 ? 4 : this.run.bots | 0;
        if (typeof IS_MOBILE !== 'undefined' && IS_MOBILE) n = Math.min(n, 4);
        if (typeof Quality !== 'undefined' && Quality.level === 0) n = Math.min(n, 2);
        return n;
    },

    /** Карта под экраном загрузки: трасса, вода, герой, монстры, боты, монеты, кольца лавок. */
    async prepare(app) {
        const loc = app.location, view = loc.view;
        this.level = this.levelOf(loc.map.id);
        GameFx.clear();
        showLoadingTip();
        this.nearStall = null;
        GameUI.prompt(null);
        Input.clearContext('stall');
        ObbyCourse.build(loc.map, {});
        const lobby = loc.map.id === 'lobby';
        ObbyCourseView.build(app, ObbyCourse, { side: 0xe4d6b6, sideTile: [0xf3e9d2, 0xe2d2b0], startColor: 0x5fc9c4, markers: !lobby, flagStyle: 'pennant' });
        World3D.setOverrides({ shadows: lobby ? 0 : null });   // в лобби потолок закрыл бы солнце и лёг тенью на весь пол
        GamePool.build(app);
        GameProps.build(app);
        if (!this.hero) {
            this.hero = await PoolHero.create(ObbyCourse, view, { look: Eco.skin(), who: 'player' });
            this.hero.onEnterWater = () => this.playerFell();
            this.hero.onClimbed = () => this.playerClimbed();
            app.onUpdate(() => { if (this.tags) this.tags.update(0.016); });
        }
        this.hero.course = ObbyCourse;
        this.applySkin();
        this.hero.swimSpeed = Eco.stat('swimSpeed');
        const saveStage = this.save.map === loc.map.id ? this.save.stage | 0 : 0;
        this.stage = Math.min(saveStage, Math.max(0, ObbyCourse.stages.length - 2));
        this.placeHero();
        ObbyCourseView.setStage(this.stage);
        app.camera.follow(this.cam);
        // монстры
        for (const m of this.monsters) m.dispose();
        this.monsters = [];
        if (this.level > 0 && GamePool.rects.length) {
            const spots = loc.markers('monster');
            const n = Math.max(1, Math.min(3, this.run.monsters | 0));
            for (let i = 0; i < n; i++) {
                const s = spots[i % Math.max(1, spots.length)];
                let p = s ? { x: s.x, z: s.y } : null;
                if (!p || i >= spots.length) p = GamePool.randomWaterNear(this.hero.x, this.hero.z, 2200, 3600) || p;
                if (!p) continue;
                this.monsters.push(await PoolMonster.create(view, { x: p.x, z: p.z, level: this.level, id: i }));
            }
        }
        // боты
        if (!this.tags) this.tags = new ObbyNameTags(view);
        this.botsReady = false;
        ObbyBots.init({
            course: ObbyCourse, lang: Lang.code, tags: this.tags, count: this.botCount(),
            createActor: (spec) => this.makeBot(spec),
            getPlayer: () => ({ actor: this.hero, stage: this.stage, alive: this.state === 'run' && !this.hero.swimming }),
            onChat: (bot, text) => GameUI.chat(bot.name, text, '#' + Number(bot.actor && bot.actor.look ? bot.actor.look.shirt : 0xffffff).toString(16).padStart(6, '0')),
            onEvent: (type, bot, data) => this.botEvent(type, bot, data),
        });
        await ObbyBots.build();
        this.botsReady = true;
        await GameNpc.build(app, this.tags);
        this.buildCoins(loc);
        this.buildRings(loc);
        this.glowLights(loc);
        this.fitLadders(loc);
        this.runCoins = 0;
    },

    /**
     * Лесенка бассейна: начало модели — у кромки, ступени уходят вперёд (+X) вниз в воду. Карта ставит её по расчётной
     * кромке; тут она доезжает до настоящего края опоры, чтобы ступени висели над водой, а не проходили сквозь плиту.
     */
    fitLadders(loc) {
        for (const rec of loc.objects) {
            if (!rec.mesh || !/pool_ladder/.test(String(rec.def.model || ''))) continue;
            const hd = (Array.isArray(rec.def.rot) ? Number(rec.def.rot[1]) || 0 : 0) * Math.PI / 180;
            const fx = Math.cos(hd), fz = Math.sin(hd), x0 = rec.def.x, z0 = rec.def.y, h0 = Number(rec.def.h) || 260;
            const solid = (d) => { const g = ObbyCourse.groundAt(x0 + fx * d, z0 + fz * d, h0 + 80, 120); return g != null && g > h0 - 30 ? g : null; };
            // от точки карты назад до опоры и вперёд до её края (шаг 5 px)
            let d = 0;
            while (d > -300 && solid(d) == null) d -= 5;
            if (solid(d) == null) continue;
            while (d < 400 && solid(d + 5) != null) d += 5;
            if (d >= 400) continue;                 // край так и не нашёлся — оставить, как поставила карта
            const top = solid(d);
            rec.mesh.position.x = x0 + fx * (d + 4);
            rec.mesh.position.z = z0 + fz * (d + 4);
            rec.mesh.position.y = top;
        }
    },

    /** Потолочные лампы светятся сами (низ панели смотрит от солнца — без этого тёмный). */
    glowLights(loc) {
        for (const rec of loc.objects) {
            if (!rec.mesh || !/light_panel/.test(String(rec.def.model || ''))) continue;
            for (const m of [rec.mesh, ...rec.mesh.getChildMeshes()]) {
                const mats = m.material ? (m.material.subMaterials || [m.material]) : [];
                for (const mat of mats) if (mat && mat.emissiveColor) { mat.emissiveColor = new BABYLON.Color3(0.92, 0.9, 0.82); mat.metadata = Object.assign({}, mat.metadata, { toon: false }); }
            }
        }
    },

    makeBot(spec) {
        let seed = (spec.id * 2654435761) >>> 0;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const pick = (a) => a[Math.floor(rnd() * a.length)];
        const acc = rnd() < 0.55 ? [pick(BOT_ACC)] : [];
        const look = { skin: pick(BOT_SKINS), shirt: pick(BOT_SHIRTS), pants: pick(BOT_PANTS), shoes: pick(BOT_SHIRTS), hair: pick(BOT_HAIRS), hairColor: pick(BOT_HAIRC), hat: pick(BOT_HATS), acc };
        return PoolHero.create(ObbyCourse, this.app.location.view, { look, who: 'bot' }).then((a) => {
            a.onEnterWater = (actor) => this.botFell(actor);
            return a;
        });
    },

    botOf(actor) { return ObbyBots.list.find(b => b.actor === actor) || null; },

    botFell(actor) {
        const b = this.botOf(actor);
        if (!b || b.state === 'dead') return;
        ObbyBots.kill(b, 'water');
        b.deadT = 4 + Math.random() * 2.5;          // барахтается, пока не доплывёт до чекпоинта или монстр не утащит
        if (Math.hypot(actor.x - this.hero.x, actor.z - this.hero.z) < 2500) GameUI.chat('', Lang.t('bpm.botFell', { name: b.name }), '#9fe6ff');
    },

    botEvent(type, bot, data) {
        if (!this.botsReady) return;
        if (type === 'join') GameUI.chat('', Lang.t('bpm.joined', { name: bot.name }));
        else if (type === 'leave') GameUI.chat('', Lang.t('bpm.left', { name: bot.name }));
        else if (type === 'finish') { if (this.level > 0) GameUI.chat('', Lang.t('bpm.finished', { name: bot.name }), '#ffd23f'); }
        else if (type === 'respawn' && bot.actor) { bot.actor.grabbed = false; bot.actor.setVisible(true); }
        else if (type === 'knock') { this.sfxAt('hit', bot.actor ? bot.actor.x : 0, bot.actor ? bot.actor.z : 0, 0.8); void data; }
    },

    /** Монеты уровня: маркеры coin, coin-2… (один меш, инстансы). */
    buildCoins(loc) {
        for (const c of this.coins) { try { c.mesh.dispose(); } catch (e) { /* сцена */ } }
        this.coins = [];
        const scene = loc.view.scene;
        if (!this.coinMesh || this.coinMesh.isDisposed()) {
            const m = BABYLON.MeshBuilder.CreateCylinder('coin', { diameter: 58, height: 9, tessellation: 22 }, scene);
            m.rotation.x = Math.PI / 2;
            m.bakeCurrentTransformIntoVertices();
            const mat = new BABYLON.StandardMaterial('coin-mat', scene);
            mat.diffuseColor = new BABYLON.Color3(1, 0.78, 0.18);
            mat.emissiveColor = new BABYLON.Color3(0.45, 0.3, 0.02);
            mat.specularColor = new BABYLON.Color3(1, 0.9, 0.5);
            m.material = mat;
            m.isVisible = false;
            World3D.addObject(loc.view, m, 'prop');
            this.coinMesh = m;
        }
        for (const mk of loc.markers('coin')) {
            const inst = this.coinMesh.createInstance('coin-i');
            inst.position.set(mk.x, (Number(mk.h) || 340), mk.y);
            this.coins.push({ mesh: inst, x: mk.x, y: Number(mk.h) || 340, z: mk.y, taken: false, ph: Math.random() * 6 });
        }
    },

    /** Кольца у лавок и портала в лобби. */
    buildRings(loc) {
        for (const r of this.rings) { try { r.mesh.dispose(); } catch (e) { /* сцена */ } }
        this.rings = [];
        const scene = loc.view.scene;
        for (const st of STALLS) {
            const mk = loc.marker(st.marker);
            if (!mk) continue;
            const r = Math.max(60, (Number(mk.scale && mk.scale[0]) || 1.1) * 100);
            const ring = BABYLON.MeshBuilder.CreateTorus('ring-' + st.marker, { diameter: r * 2, thickness: 12, tessellation: 48 }, scene);
            const mat = new BABYLON.StandardMaterial('ring-mat-' + st.marker, scene);
            const col = BABYLON.Color3.FromHexString(st.color);
            mat.diffuseColor = col; mat.emissiveColor = col.scale(0.9); mat.alpha = 0.85; mat.disableLighting = true;
            mat.metadata = { toon: false };
            ring.material = mat;
            ring.position.set(mk.x, (Number(mk.h) || 260) + 4, mk.y);
            this.rings.push({ st, mesh: ring, x: mk.x, z: mk.y, y: Number(mk.h) || 260, r });
        }
    },

    // -------------------------------------------------------------------------------------------
    // Состояния
    // -------------------------------------------------------------------------------------------

    toMenu() {
        this.state = 'menu';
        Input.clearContext();
        Platform.gameplay(false);
        GameUI.hud(false);
        GameUI.menu(true, { level: Eco.currentLevel(), levelName: this.levelName(Eco.currentLevel()) });
        GameAudio.scene('lobby');
        this.placeHero();
        Tutorial.whenIdle(() => { if (this.state === 'menu' || this.state === 'lobby') this.ui('offerDaily'); });
    },

    levelName(n) {
        const L = (typeof GAME_LEVELS !== 'undefined' ? GAME_LEVELS : [])[n - 1];
        return L ? (L.name && (L.name[Lang.code] || L.name.en)) || L.id : 'pool-' + n;
    },

    /** «Играть» в меню: продолжить текущий уровень (или тот, что ждёт в сохранении). */
    play() {
        if (this.state !== 'menu') return;
        GameUI.menu(false);
        const n = this.level > 0 ? this.level : Eco.currentLevel();
        if (this.level === n && this.app.location.map.id === 'pool-' + n) this.beginRun();
        else this.startRun({ level: n, bots: this.run.bots, monsters: this.run.monsters });
    },

    /** Окно «Новый забег» → загрузка уровня. */
    async startRun(cfg) {
        const level = Math.max(1, Math.min(LEVEL_COUNT, cfg.level | 0 || 1));
        this.run = { level, bots: Math.max(0, Math.min(6, cfg.bots | 0)), monsters: Math.max(1, Math.min(3, cfg.monsters | 0 || 1)) };
        this.save.runCfg = { bots: this.run.bots, monsters: this.run.monsters };
        GameUI.closeWindows();
        GameUI.menu(false);
        GameUI.result(false);
        if (this.save.map !== 'pool-' + level) { this.save.map = 'pool-' + level; this.save.stage = 0; }
        this.persist();
        Pause.set('manual', false);
        await /** @type {LoryApp} */ (this.app).loadMap('pool-' + level, { prepare: (app) => this.prepare(app), gameplay: true, label: this.levelName(level) });
        this.beginRun();
    },

    beginRun() {
        this.state = 'run';
        this.runTime = 0; this.falls = 0; this.runCoins = 0;
        this.grabber = null; this.fellTipShown = false; this.shieldT = 2;
        this.adRescueUsed = false;            // спасение за рекламу — раз за забег (не «+1 жизнь» за каждый проигрыш)
        this.placeHero();
        const cam = /** @type {LoryApp} */ (this.app).camera;
        cam.azimuth = ObbyCourse.respawn(this.stage).yaw;
        cam.snap();
        this.setJumpContext();
        GameUI.menu(false);
        GameUI.hud(true);
        GameUI.setLevel(this.level, this.levelName(this.level));
        this.refreshHud(true);
        GameAudio.scene('level');
        this.sfx('start');
        Platform.gameplay(true);
        if (typeof Telemetry !== 'undefined') Telemetry.progress('started', 'pool_' + this.level, { step_index: this.level });
        if (!this.save.tutorialDone && this.level === 1) Tutorial.autoStart();
    },

    async goLobby() {
        GameUI.closeWindows(); GameUI.result(false); GameUI.down(false); GameUI.menu(false);
        Pause.set('manual', false);
        Platform.gameplay(false);
        await /** @type {LoryApp} */ (this.app).loadMap('lobby', { prepare: (app) => this.prepare(app), gameplay: false, label: Lang.t('bpm.lobby') });
        this.state = 'lobby';
        this.placeHero();
        /** @type {LoryApp} */ (this.app).camera.snap();
        this.setJumpContext();
        GameUI.hud(true);
        GameUI.setThreat({ state: '', eta: 0, dir: 0 });
        GameAudio.scene('lobby');
        GameUI.setLevel(0, Lang.t('bpm.lobby'));
        this.refreshHud(true);
    },

    async nextLevel() {
        const n = Math.min(LEVEL_COUNT, this.level + 1);
        GameUI.result(false);
        if (this.level >= LEVEL_COUNT) { Platform.ads.next(() => this.goLobby()); return; }
        Platform.ads.next(() => this.startRun({ level: n, bots: this.run.bots, monsters: this.run.monsters }));
    },

    howTo() {
        if (Pause.has('manual')) this.togglePause();
        if (this.state === 'menu') this.play();
        Tutorial.start({ replay: true });
    },

    togglePause() {
        if (this.state !== 'run' && this.state !== 'lobby' && !Pause.has('manual')) return;
        const on = !Pause.has('manual');
        Pause.set('manual', on);
        GameUI.pause(on);
    },

    windowOpened() {
        this.sfx('ui-open');
        this._winFromPause = Pause.has('manual');      // окно открыто из меню паузы — закрытие вернёт в паузу, а не в игру
        if (this.state === 'run' || this.state === 'lobby') Pause.set('manual', true);
        Input.configure({ controls: false });
    },

    windowClosed() {
        this.sfx('ui-close');
        if (!GameUI.isOpen()) {
            if (!this._winFromPause) Pause.set('manual', false);
            Input.configure({ controls: true });
            this.applySkin();
            this.hero.swimSpeed = Eco.stat('swimSpeed');
            this.refreshHud(true);
        }
    },

    /**
     * Playgama: курсор захвачен только в самой игре (забег, лобби). Меню, окна, пауза, экран «Схватили», реклама и обучение
     * (там кнопка «Пропустить» под мышью) — курсор свободен; вернулись в игру — захватываем снова. Отказ браузера — подсказка
     * «нажми на экран»; нет pointer lock совсем (iframe) — Input сам переходит на камеру правой кнопкой.
     */
    syncCursor() {
        if (Platform.name !== 'playgama') return;
        const el = document.getElementById('bpm-capture');
        if (Input.lockFailed || Input.mouseTouch) { if (el) el.classList.remove('on'); return; }   // площадка не даёт захват: камера — правой кнопкой
        const tutorial = !!Tutorial.active;
        const mode = tutorial ? 'drag' : 'lock';
        if (Input.mouseMode !== mode) Input.configure({ mouse: mode });
        const want = !tutorial && (this.state === 'run' || this.state === 'lobby') && !GameUI.isOpen() && !Platform.adActive && Input.wantsLock();
        this._lockWanted = want;
        if (!want) {
            this._lockTried = false;
            if (Input.locked) Input.release();
        } else if (!Input.locked && !this._lockTried && performance.now() - (this._unlockT || -1e9) > 1400) {
            // после Esc браузер не даёт захватить снова примерно секунду — поэтому пауза перед попыткой
            this._lockTried = true;
            Input.capture();
        }
        if (el) el.classList.toggle('on', want && !Input.locked && this._lockTried);
        if (Input.locked && !this.save.lockTipDone) {
            this.save.lockTipDone = true;
            GameUI.toast(Lang.t('bpm.lockTip'), 2600);
            this.persist();
        }
    },

    /** Курсор отпущен. Если игра этого не просила — игрок нажал Esc: открываем паузу. */
    onCursorFreed() {
        this._unlockT = performance.now();
        if (this._lockWanted && !Pause.has('manual')) this.togglePause();
    },

    /** Вызов необязательного метода интерфейса (окна подарка, рекордов — если они есть). */
    ui(name, ...args) {
        const f = /** @type {any} */ (GameUI)[name];
        if (typeof f === 'function') return f.apply(GameUI, args);
        return undefined;
    },

    persist() { try { Platform.save(this.save); } catch (e) { console.warn('Platform.save:', e); } },

    placeHero() {
        if (!this.hero) return;
        const r = ObbyCourse.respawn(this.stage);
        this.hero.place(r.x, r.y, r.z, r.yaw);
        this.hero.setShield(false);
        this.hero.pose('idle', 0);
        this.syncCam();
    },

    syncCam() {
        const h = this.hero;
        if (this.scareCam) { Object.assign(this.cam, this.scareCam); return; }
        this.cam.x = h.x; this.cam.y = h.z; this.cam.h = h.y + 70;
        this.cam.frameHeight = 820; this.cam.frameWidth = 780;
    },

    setJumpContext() { Input.setContext({ id: 'jump', label: Lang.t('bpm.jump'), icon: '⤒', action: 'jump' }, 1); },

    applySkin() {
        if (!this.hero) return;
        const look = Eco.skin();
        this.hero.applyLook(look);
        GameFx.setTrail(this.hero, look.trail || null);
    },
    /** Примерка в магазине: собранный вид (или null — вернуть надетое). */
    previewSkin(look) {
        if (!this.hero) return;
        const L = look && typeof look === 'object' ? look : Eco.skin();
        this.hero.applyLook(L);
        GameFx.setTrail(this.hero, L.trail || null);
    },

    /** Вход в аккаунт (Яндекс): прогресс из облака перечитывается. */
    async afterLogin() {
        try {
            const s = await Platform.load();
            if (s && typeof s === 'object') { Object.assign(this.save, s); Eco.init(this.save, () => this.persist()); }
        } catch (e) { console.warn('afterLogin:', e); }
        this.applySkin();
        this.ui('setBestScore', this.save.score | 0);
        this.refreshHud(true);
    },

    /** Рекорд: очки копятся за пройденные уровни; отправляется после каждого уровня и каждого захвата монстром. */
    submitScore(add) {
        if (add > 0) { this.save.score = (this.save.score | 0) + Math.round(add); this.persist(); }
        Platform.submitScore(this.save.score | 0);
        this.ui('setBestScore', this.save.score | 0);
    },

    /**
     * Playables: при любом нажатии кнопки интерфейса вне игрового процесса — межстраничная реклама (частоту режет YouTube).
     * Не трогает: HUD забега (слоты, толчок, пауза), экран «Схватили», кнопки «за рекламу» (там свой rewarded).
     */
    uiClickAd(e) {
        const t = /** @type {HTMLElement} */ (e.target);
        const b = t && t.closest ? /** @type {HTMLButtonElement | null} */ (t.closest('button')) : null;
        if (!b || b.disabled || this._uiAdBusy || Platform.adActive || Pause.has('platform')) return;
        if (!b.closest('#bpm-menu, #bpm-win, #bpm-result, #bpm-pause, #bpm-prompt')) return;
        if (/(^|\s)(ad|bpm-ad)(\s|$)/.test(b.className) || /(^|-)ad($|-)/.test(b.dataset.act || '')) return;
        if (this.state === 'run' && !Pause.has('manual') && !GameUI.isOpen()) return;
        if (!Platform.interstitialSupported()) return;
        this._uiAdBusy = true;
        Promise.resolve(Platform.interstitial()).catch(() => false).then(() => { this._uiAdBusy = false; });
    },

    // -------------------------------------------------------------------------------------------
    // Кадр
    // -------------------------------------------------------------------------------------------

    update(dt) {
        const app = /** @type {LoryApp} */ (this.app), cam = app.camera;
        ObbyCourse.update(dt);
        const look = Input.consumeLook();
        if (this.state === 'menu') cam.azimuth += dt * 0.12;
        else if (this.state === 'run' || this.state === 'lobby') {
            const k = Input.locked ? 0.55 : 1;       // захваченная мышь шлёт сырое движение — чувствительность ниже
            cam.azimuth += look.dx * 0.0045 * k;
            cam.pitch = Math.max(0.12, Math.min(1.25, cam.pitch + look.dy * 0.0035 * k));
        }
        if (this.state === 'run' || this.state === 'lobby') this.stepHero(dt);
        else if (this.state === 'scare') this.stepScare(dt);
        else if (this.state === 'down') this.stepDown(dt);
        else { this.hero.step(dt, {}); this.hero.pose(this.state === 'result' ? 'cheer' : 'idle', dt); }
        // монстры слышат всех, кто в воде
        const swimmers = [];
        if (this.hero.swimming || this.hero.climb || this.hero.grabbed) swimmers.push({ actor: this.hero, player: true });
        for (const b of ObbyBots.list) if (b.actor && (b.actor.swimming || b.actor.grabbed)) swimmers.push({ actor: b.actor, bot: b });
        const flare = GamePool.flare ? { x: this.hero.x, z: this.hero.z, radius: GamePool.flare.radius } : null;
        const safe = this.state !== 'run' || Platform.adActive || this.shieldT > 0;
        const toys = GamePool.items.filter(it => it.kind === 'toy');
        for (const m of this.monsters) m.update(dt, { player: this.hero, swimmers, flare, safe, toys, onGrab: (mm, s) => this.onGrab(mm, s) });
        ObbyBots.update(dt);
        GamePool.update(dt);
        const pushers = [this.hero];
        for (const b of ObbyBots.list) if (b.actor && b.actor.visible !== false) pushers.push(b.actor);
        GameProps.update(dt, pushers);
        this.stepCoins(dt);
        this.syncCam();
        ObbyCourseView.update(dt, { x: this.hero.x, z: this.hero.z });
        Rig.updateAll(dt);
        GameFx.update(dt);
        if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.hero.setShield(false); }
        for (let i = 0; i < 3; i++) this.slotCd[i] = Math.max(0, this.slotCd[i] - dt);
        this.pushCd = Math.max(0, this.pushCd - dt);
        if (this.state === 'run') {
            this.runTime += dt;
            this.threat(dt);
        }
        this.hudT -= dt;
        if (this.hudT <= 0) { this.hudT = 0.12; this.refreshHud(false); }
        for (const r of this.rings) r.mesh.rotation.y += dt * 0.6;
        // утка и фальшфейер звучат, пока работают
        let toy = 0;
        for (const it of GamePool.items) if (it.kind === 'toy' && !it.done) { const p = GamePool.toyAt(it); toy = Math.max(toy, 1 - Math.hypot(p.x - this.hero.x, p.z - this.hero.z) / 3000); }
        GameAudio.loop('toy', toy);
        GameAudio.loop('flare', GamePool.flareActive() ? 1 : 0);
    },

    stepHero(dt) {
        const cam = /** @type {LoryApp} */ (this.app).camera, h = this.hero;
        const m = Input.move();
        const fx = Math.cos(cam.azimuth), fz = Math.sin(cam.azimuth);
        const dx = fx * m.y - fz * m.x, dz = fz * m.y + fx * m.x;
        const jumped = Input.pressed('jump');
        if (this.state === 'run') {
            if (Input.pressed('slot1')) this.useSlot(0);
            if (Input.pressed('slot2')) this.useSlot(1);
            if (Input.pressed('slot3')) this.useSlot(2);
            if (Input.pressed('push')) this.doPush();
        }
        if (Input.pressed('interact')) this.interact();
        const wasGrounded = h.grounded, fallV = h.vy;
        h.step(dt, { dx, dz, jump: jumped });
        if (h.grounded && !wasGrounded && fallV < -450) this.sfx('land', Math.min(1, -fallV / 1400));
        if (h.grounded) {
            this._stepDist = (this._stepDist || 0) + Math.hypot(h.vx, h.vz) * dt;
            if (this._stepDist > 175) { this._stepDist = 0; this.sfx('step'); }
        }
        if (jumped && wasGrounded && !h.swimming && !h.grounded) this.sfx('jump');
        h.pose(!h.grounded ? 'air' : Math.hypot(h.vx, h.vz) > 60 ? 'run' : 'idle', dt);
        if (h.bounced) { h.bounced = false; this.sfx('jump', 1.3); }
        // ловушки (вертушка) сбивают; пустота — назад на чекпоинт
        if (!h.swimming && !h.climb) {
            const hit = ObbyCourse.hazardAt(h.x, h.y, h.z, h.radius * 0.9, h.height);
            if (hit) {
                const cause = typeof hit === 'string' ? hit : hit.cause;
                if (cause === 'trap') { const n = hit.n || [0, 0, 0]; h.knock(n[0] * 700, 650, n[2] * 700); this.sfx('hit'); }
                else if (cause === 'void' || cause === 'kill' || cause === 'lava') { this.placeHero(); this.shieldT = 1.5; }
            }
        }
        // контекстная кнопка: в воде — «Вылезти», у лавки — окно, иначе — прыжок
        if (h.swimming) {
            const can = h.canClimb();
            Input.setContext({ id: 'jump', label: Lang.t(can ? 'bpm.climb' : 'bpm.swim'), icon: can ? '⤴' : '≈', action: 'jump' }, 1);
            GameUI.swim(true, { canClimb: can, canRope: Eco.toolUnlocked('rope') && (Eco.count('rope') > 0 || Eco.hasPass('rope')) });
        } else if (this._swimUi) { this.setJumpContext(); GameUI.swim(false, {}); }
        this._swimUi = h.swimming;
        if (this.state === 'lobby') { this.checkStalls(); GameNpc.update(dt, h); }
        if (this.state === 'run' && h.grounded) {
            const ns = ObbyCourse.reached(h.x, h.y, h.z, this.stage);
            if (ns > this.stage) this.reachStage(ns);
        }
    },

    checkStalls() {
        const h = this.hero;
        let near = null;
        for (const r of this.rings) if (Math.hypot(h.x - r.x, h.z - r.z) < r.r) near = r;
        if (near !== this.nearStall) {
            this.nearStall = near;
            if (near) {
                Input.setContext({ id: 'stall', label: Lang.t(near.st.label), icon: near.st.icon, action: 'interact' }, 2);
                GameUI.prompt(Lang.t(near.st.label));
                this.sfx('npc');
            } else { Input.clearContext('stall'); GameUI.prompt(null); }
        }
    },

    interact() {
        if (this.state === 'lobby' && this.nearStall) GameUI.openWindow(this.nearStall.st.win, this.nearStall.st.win === 'create' ? { level: Eco.currentLevel(), bots: this.run.bots, monsters: this.run.monsters } : undefined);
    },

    reachStage(ns) {
        this.stage = ns;
        ObbyCourseView.setStage(ns);
        ObbyBots.playerCheckpoint(ns);
        if (ns >= ObbyCourse.stages.length - 1 && ObbyCourse.finish) { this.finishRun(); return; }
        this.save.stage = ns; this.save.map = 'pool-' + this.level;
        this.persist();
        GameUI.toast(Lang.t('bpm.checkpoint', { n: ns }));
        const cp = ObbyCourse.checkpoints.find(c => c.n === ns);
        const fx = /** @type {LoryApp} */ (this.app).fx;
        if (cp && fx) {
            try {
                fx.create({ burst: 46, capacity: 50, life: [0.8, 1.6], size: [6, 13], speed: [260, 520], color: '#d64933', color2: '#f2c14e',
                    position: new BABYLON.Vector3(cp.x, cp.y + 240, cp.z), direction: [[-0.6, 1, -0.6], [0.6, 1.4, 0.6]], gravity: [0, -900, 0], blend: 'standard',
                    spin: [-6, 6], colorGradient: [[0, '#ffffff', 1], [0.2, '#2a9d8f', 1], [1, '#f2c14e', 0]] });
            } catch (e) { /* без эффекта */ }
        }
        this.sfx('checkpoint');
        Tutorial.complete('checkpoint');
        if (typeof Telemetry !== 'undefined') Telemetry.progress('completed', 'pool_' + this.level + '_cp' + ns, { step_index: ns });
    },

    // ----- вода: упал, вылез -----

    playerFell() {
        if (this.state !== 'run' && this.state !== 'lobby') return;
        this.falls++;
        /** @type {LoryApp} */ (this.app).camera.shake(160, 0.008);
        if (!this.fellTipShown && this.monsters.length) {
            this.fellTipShown = true;
            GameUI.toast(Lang.t(Input.device === 'touch' ? 'bpm.fellTipTouch' : 'bpm.fellTip'), 3200);
        }
    },

    playerClimbed() {
        this.sfx('plop');
        this.setJumpContext();
        GameUI.swim(false, {});
    },

    /** Самый опасный монстр для HUD: «бросок к тебе» с ETA и направлением на экране. */
    threat(dt) {
        const h = this.hero, cam = /** @type {LoryApp} */ (this.app).camera;
        let best = null, bestScore = -1, eta = 0;
        for (const m of this.monsters) {
            const d = Math.hypot(m.x - h.x, m.z - h.z);
            let score = 0;
            if (m.state === 'rush' && m.target && Math.hypot(m.target.x - h.x, m.target.z - h.z) < 700) score = 3;
            else if (m.state === 'react') score = 2;
            else if (m.state === 'search' && d < 1100) score = 2.5;
            else if (d < 1500) score = 1;
            if (score > bestScore) { bestScore = score; best = m; eta = d / m.speed; }
        }
        let state = 'calm';
        if (best && bestScore >= 3) state = 'rushing';
        else if (best && bestScore >= 2.5) state = 'near';
        else if (best && bestScore >= 2) state = 'listening';
        let dir = 0;
        if (best) {
            const dx = best.x - h.x, dz = best.z - h.z, az = cam.azimuth;
            const f = dx * Math.cos(az) + dz * Math.sin(az), r = -dx * Math.sin(az) + dz * Math.cos(az);
            dir = Math.atan2(r, f);
        }
        GameUI.setThreat({ state, eta, dir });
        // вода кипит за мчащимся монстром: громче с приближением
        let rush = 0;
        for (const m of this.monsters) if (m.state === 'rush') rush = Math.max(rush, 1 - Math.hypot(m.x - h.x, m.z - h.z) / 4500);
        GameAudio.danger(rush);
        // сердце стучит, когда монстр мчится к тебе в воде
        this.heartT -= dt;
        if (state === 'rushing' && h.swimming && this.heartT <= 0) { this.heartT = Math.max(0.42, Math.min(0.9, eta * 0.35)); this.sfx('heart'); }
    },

    // ----- монстр схватил -----

    onGrab(m, s) {
        if (s.bot) {
            this.sfxAt('screech', m.x, m.z);
            GameUI.chat('', Lang.t('bpm.botEaten', { name: s.bot.name }), '#ff6b6b');
            if (s.bot.state === 'dead') s.bot.deadT = Math.max(s.bot.deadT, 1.6);
            return;
        }
        // игрок: скример
        this.state = 'scare';
        this.grabber = m;
        this.scareT = 1.35;
        this.falls++;
        Input.clearContext();
        GameUI.swim(false, {});
        GameUI.jumpscare(true);
        GameAudio.scare(true);
        GameAudio.danger(0);
        this.sfx('scream');
        this.sfx('sting');
        const cam = /** @type {LoryApp} */ (this.app).camera;
        cam.shake(420, 0.03);
        this._zoomBack = cam.zoomTarget;
        cam.zoom = cam.zoomTarget = typeof CAMERA_ZOOM_MAX !== 'undefined' ? CAMERA_ZOOM_MAX : 3;   // морда во весь экран
        GameUI.setThreat({ state: 'calm', eta: 0, dir: 0 });
        setTimeout(() => m.scream(), 380);
        if (Tutorial.roundCounts()) Platform.ads.roundEnded(false, this.level);
        this.submitScore(0);
        if (typeof Telemetry !== 'undefined') Telemetry.progress('failed', 'pool_' + this.level, { step_index: this.stage });
    },

    stepScare(dt) {
        const m = this.grabber, cam = /** @type {LoryApp} */ (this.app).camera;
        this.scareT -= dt;
        this.hero.step(dt, {});
        this.hero.pose('idle', dt);
        if (m) {
            // камера — прямо в морду: перед лицом монстра, близко
            const f = m.facePos();
            this.scareCam = { x: f.x, y: f.z, h: f.y - 20, frameHeight: 150, frameWidth: 150 };
            cam.azimuth = m.yaw + Math.PI;
            cam.pitch = 0.1;
        }
        if (this.scareT <= 0) {
            GameUI.jumpscare(false);
            this.state = 'down';
            this.downT = typeof DOWN_SEC !== 'undefined' ? DOWN_SEC : 9;
            GameUI.down(true, { timeLeft: this.downT, total: this.downT, rescues: Eco.count('rescue'), adRescue: !this.adRescueUsed });
        }
    },

    stepDown(dt) {
        this.downT -= dt;
        this.hero.step(dt, {});
        this.hero.pose('idle', dt);
        GameUI.down(true, { timeLeft: Math.max(0, this.downT), total: typeof DOWN_SEC !== 'undefined' ? DOWN_SEC : 9, rescues: Eco.count('rescue'), adRescue: !this.adRescueUsed });
        if (this.downT <= 0 && !this._rescuing) this.giveUp();
    },

    /** Спасение: круг из запаса или за рекламу — на ближайшую платформу, монстр отплывает. */
    async selfRescue(kind) {
        if (this.state !== 'down' || this._rescuing) return;
        if (kind === 'item') { if (!Eco.use('rescue')) return; }
        else {
            if (this.adRescueUsed) return;
            this._rescuing = true;
            const ok = await Platform.rewarded('self-rescue');
            this._rescuing = false;
            if (!ok || this.state !== 'down') return;
            this.adRescueUsed = true;
        }
        const h = this.hero;
        const spot = GamePool.ropeTarget(h.x, h.z, 1600);
        this.endGrab();
        if (spot) { h.place(spot.x, spot.y, spot.z, h.yaw); }
        else this.placeHero();
        this.shieldT = 3; h.setShield(true);
        GameUI.toast(Lang.t('bpm.saved'), 1400);
        this.sfx('reward');
    },

    /** Вернуться на чекпоинт (кнопка или кончилось время). */
    giveUp() {
        if (this.state !== 'down' && this.state !== 'scare') return;
        this.endGrab();
        this.placeHero();
        this.shieldT = 2; this.hero.setShield(true);
    },

    endGrab() {
        if (this.grabber) this.grabber.release();
        this.grabber = null;
        this.scareCam = null;
        GameAudio.scare(false);
        this.hero.grabbed = false;
        GameUI.down(false);
        GameUI.jumpscare(false);
        this.state = 'run';
        this.setJumpContext();
        const cam = /** @type {LoryApp} */ (this.app).camera;
        cam.pitch = 0.45;
        if (this._zoomBack) { cam.zoom = cam.zoomTarget = this._zoomBack; this._zoomBack = 0; }
        cam.snap();
    },

    // ----- финиш -----

    finishRun() {
        this.state = 'result';
        Input.clearContext();
        Platform.gameplay(false);
        GameAudio.danger(0);
        this.sfx('win');
        const L = (typeof GAME_LEVELS !== 'undefined' ? GAME_LEVELS : [])[this.level - 1];
        const base = L && L.reward != null ? L.reward : 40 + 15 * this.level;
        const mult = [1, 1, 1.5, 2][this.run.monsters] || 1;
        const earned = Math.round(base * mult) + this.runCoins;
        const got = Eco.addCoins(earned, 'run');
        this._lastEarned = got;
        this._doubled = false;
        Eco.completeLevel(this.level);
        this.submitScore(100 * this.level + 5 * this.runCoins + Math.max(0, 60 - 15 * this.falls));
        GameFx.celebrate(Eco.skin().victory || null, { x: this.hero.x, y: this.hero.y, z: this.hero.z });
        this.save.stage = 0;
        const nextN = Math.min(LEVEL_COUNT, this.level + 1);
        this.save.map = Eco.levelUnlocked(nextN) ? 'pool-' + nextN : 'pool-' + this.level;
        this.persist();
        if (Tutorial.roundCounts()) Platform.ads.roundEnded(true, this.level);
        if (typeof Telemetry !== 'undefined') Telemetry.progress('completed', 'pool_' + this.level, { step_index: this.level });
        GameUI.hud(false);
        GameUI.result(true, { level: this.level, name: this.levelName(this.level), time: this.runTime, coins: got, bonus: this.runCoins, falls: this.falls, next: this.level < LEVEL_COUNT });
    },

    async doubleCoins() {
        if (this._doubled || this.state !== 'result') return false;
        const ok = await Platform.rewarded('double-coins');
        if (!ok || this._doubled) return false;
        this._doubled = true;
        Eco.addCoins(this._lastEarned || 0, 'bonus');
        return true;
    },

    // -------------------------------------------------------------------------------------------
    // Предметы и толчок
    // -------------------------------------------------------------------------------------------

    useSlot(i) {
        if (this.state !== 'run' || this.slotCd[i] > 0 || this.hero.grabbed) return;
        const id = (Eco.loadout || [])[i];
        if (!id) return;
        const h = this.hero, cam = /** @type {LoryApp} */ (this.app).camera, yaw = cam.azimuth;
        const free = id === 'rope' && Eco.hasPass('rope');
        if (!free && Eco.count(id) <= 0) { this.sfx('ui-error'); GameUI.toast(Lang.t('bpm.noSupply', { name: this.toolName(id) }), 1400); return; }
        if (id === 'rope') {
            if (!h.swimming || h.climb) { this.sfx('ui-error'); GameUI.toast(Lang.t('bpm.ropeOnlyWater'), 1400); return; }
            const t = GamePool.ropeTarget(h.x, h.z, Eco.stat('ropeReach'));
            if (!t) { this.sfx('ui-error'); GameUI.toast(Lang.t('bpm.ropeNone'), 1400); return; }
            h.startClimb(Object.assign({ rope: true }, t), 0.75);
            this.sfx('rope');
        } else if (id === 'flare') {
            GamePool.flareOn(h, Eco.stat('flareRadius'), 10);
            this.sfx('flare');
            GameUI.toast(Lang.t('bpm.flareOn'), 1600);
        } else if (id === 'toy') {
            h.yaw = yaw; h.gesture('throw');
            GamePool.launchToy({ x: h.x, z: h.z }, yaw, Eco.stat('toyBattery'));
            this.sfx('whoosh');
        } else {
            h.yaw = yaw; h.gesture('throw');
            GamePool.throwItem(id === 'bottle' ? 'bottle' : 'pebble', h.handPos(), yaw, Eco.stat('throwRange'), id === 'pebble' ? Eco.stat('skips') : 1);
            this.sfx('whoosh');
            if (id === 'pebble') Tutorial.complete('pebble');
        }
        if (!free) Eco.use(id);
        this.slotCd[i] = id === 'flare' ? 10 : 0.7;
        this.refreshHud(true);
    },

    toolName(id) {
        const T = typeof GAME_TOOLS !== 'undefined' ? GAME_TOOLS : null;
        const t = T ? (Array.isArray(T) ? T.find(x => x.id === id) : T[id]) : null;
        return t && t.name ? (t.name[Lang.code] || t.name.en) : id;
    },

    doPush() {
        if (this.state !== 'run' || this.pushCd > 0 || this.hero.swimming) return;
        const sup = Eco.count('superpush') > 0, has = Eco.count('push') > 0;
        if (!sup && !has) return;
        const h = this.hero, cam = /** @type {LoryApp} */ (this.app).camera;
        const yaw = cam.azimuth, fx = Math.cos(yaw), fz = Math.sin(yaw);
        let target = null, bd = 230;
        for (const b of ObbyBots.list) {
            const a = b.actor;
            if (!a || b.state !== 'run' && b.state !== 'wait' || a.swimming) continue;
            const dx = a.x - h.x, dz = a.z - h.z, d = Math.hypot(dx, dz);
            if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.35 && Math.abs(a.y - h.y) < 120) { bd = d; target = b; }
        }
        if (!target) { this.sfx('ui-error'); GameUI.toast(Lang.t('bpm.noPush'), 1000); return; }
        const p = sup ? 1350 : 850;
        h.yaw = yaw; h.gesture('push');
        target.actor.knock(fx * p, sup ? 700 : 480, fz * p);
        Eco.use(sup ? 'superpush' : 'push');
        this.pushCd = 0.8;
        this.sfx('push');
        this.sfx('hit', 0.8);
        GameUI.toast(Lang.t('bpm.pushed', { name: target.name }), 1200);
        this.refreshHud(true);
    },

    stepCoins(dt) {
        if (!this.coins.length || this.state !== 'run') return;
        const h = this.hero, t = performance.now() / 1000;
        for (const c of this.coins) {
            if (c.taken) continue;
            c.mesh.rotation.y = t * 2.4 + c.ph;
            c.mesh.position.y = c.y + Math.sin(t * 2 + c.ph) * 8;
            if (Math.abs(h.x - c.x) < 80 && Math.abs(h.z - c.z) < 80 && Math.abs(h.y + 90 - c.y) < 160) {
                c.taken = true; c.mesh.setEnabled(false);
                this.runCoins += 1;
                this.sfx('coin');
            }
        }
    },

    refreshHud(force) {
        if (!this.hero || (this.state !== 'run' && this.state !== 'lobby' && !force)) return;
        GameUI.setCoins(Eco.coins);
        GameUI.setRunCoins(this.runCoins);
        const lo = Eco.loadout || [];
        const slots = [];
        for (let i = 0; i < 3; i++) {
            const id = lo[i] || null;
            const cdMax = id === 'flare' ? 10 : 0.7;
            slots.push({ id, count: id ? (id === 'rope' && Eco.hasPass('rope') ? Infinity : Eco.count(id)) : 0, cooldown: id ? this.slotCd[i] / cdMax : 0, active: id === 'flare' && GamePool.flareActive() });
        }
        slots.push({ id: Eco.count('superpush') > 0 ? 'superpush' : 'push', count: Eco.count('push') + Eco.count('superpush'), cooldown: this.pushCd / 0.8, active: false });
        GameUI.setHotbar(slots);
        if (this.state === 'run') GameUI.setProgress(ObbyCourse.progress(this.stage, this.hero.x, this.hero.y, this.hero.z), this.stage, Math.max(1, ObbyCourse.stages.length - 1));
    },

    // -------------------------------------------------------------------------------------------
    // Звук: таблица событий, музыка и сведение — js/GameAudio.js
    // -------------------------------------------------------------------------------------------

    /** name — событие из GameAudio.EVENTS; volume — множитель громкости. */
    sfx(name, volume) { GameAudio.play(name, volume); },

    /** Звук в точке мира: тише с расстоянием от героя. */
    sfxAt(name, x, z, volume) { GameAudio.at(name, x, z, volume); },
};
