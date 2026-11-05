// GameAudio.js — весь звук игры в одном месте: событие -> файлы (варианты без повтора) и громкость канала. Файлы готовит
// tools/build-sounds.py из Sound Pack (сжатие в OGG, выравнивание уровня), здесь только сведение между собой.
//   GameAudio.play('coin');                  // событие; второй аргумент — множитель громкости
//   GameAudio.at('splash', x, z, 0.8);       // в точке мира: тише с расстоянием от героя
//   GameAudio.scene('level' | 'lobby');      // музыка и атмосфера зала
//   GameAudio.danger(0..1);                  // монстр мчится: кипение воды растёт, музыка уходит назад

/** @satisfies {Record<string, any>} */
const GameAudio = {
    /** Эффекты: файлы (литералами — их видит сборщик) и громкость относительно остальных. */
    EVENTS: {
        step: { files: ['assets/sounds/step-1.ogg', 'assets/sounds/step-2.ogg', 'assets/sounds/step-3.ogg', 'assets/sounds/step-4.ogg'], vol: 0.22 },
        jump: { files: ['assets/sounds/jump-1.ogg', 'assets/sounds/jump-2.ogg'], vol: 0.28 },
        land: { files: ['assets/sounds/land-1.ogg', 'assets/sounds/land-2.ogg'], vol: 0.36 },
        splash: { files: ['assets/sounds/splash.ogg'], vol: 0.55 },
        'splash-big': { files: ['assets/sounds/splash-big.ogg'], vol: 0.85 },
        plop: { files: ['assets/sounds/plop.ogg'], vol: 0.5 },
        swim: { files: ['assets/sounds/swim-1.ogg', 'assets/sounds/swim-2.ogg', 'assets/sounds/swim-3.ogg'], vol: 0.34 },
        whoosh: { files: ['assets/sounds/whoosh-1.ogg', 'assets/sounds/whoosh-2.ogg'], vol: 0.45 },
        clack: { files: ['assets/sounds/clack.ogg'], vol: 0.42 },
        glass: { files: ['assets/sounds/glass.ogg'], vol: 0.55 },
        flare: { files: ['assets/sounds/flare.ogg'], vol: 0.6 },
        rope: { files: ['assets/sounds/rope.ogg'], vol: 0.55 },
        push: { files: ['assets/sounds/push.ogg'], vol: 0.5 },
        hit: { files: ['assets/sounds/hit.ogg'], vol: 0.6 },
        bump: { files: ['assets/sounds/bump-1.ogg', 'assets/sounds/bump-2.ogg'], vol: 0.38 },
        'monster-hear': { files: ['assets/sounds/monster-hear.ogg'], vol: 0.65 },
        'monster-growl': { files: ['assets/sounds/monster-growl.ogg'], vol: 0.85 },
        chomp: { files: ['assets/sounds/chomp.ogg'], vol: 0.8 },
        scream: { files: ['assets/sounds/scream.ogg'], vol: 1 },
        screech: { files: ['assets/sounds/screech.ogg'], vol: 0.7 },
        sting: { files: ['assets/sounds/sting.ogg'], vol: 0.85 },
        heart: { files: ['assets/sounds/heart.ogg'], vol: 0.85 },
        coin: { files: ['assets/sounds/coin.ogg'], vol: 0.45 },
        checkpoint: { files: ['assets/sounds/checkpoint.ogg'], vol: 0.7 },
        win: { files: ['assets/sounds/win.ogg'], vol: 0.8 },
        start: { files: ['assets/sounds/start.ogg'], vol: 0.5 },
        buy: { files: ['assets/sounds/buy.ogg'], vol: 0.6 },
        reward: { files: ['assets/sounds/reward.ogg'], vol: 0.6 },
        prize: { files: ['assets/sounds/prize.ogg'], vol: 0.7 },
        gift: { files: ['assets/sounds/gift.ogg'], vol: 0.6 },
        'ui-click': { files: ['assets/sounds/ui-click.ogg'], vol: 0.45 },
        'ui-open': { files: ['assets/sounds/ui-open.ogg'], vol: 0.4 },
        'ui-close': { files: ['assets/sounds/ui-close.ogg'], vol: 0.35 },
        'ui-error': { files: ['assets/sounds/ui-error.ogg'], vol: 0.5 },
        'ui-tick': { files: ['assets/sounds/ui-tick.ogg'], vol: 0.3 },
        npc: { files: ['assets/sounds/npc.ogg'], vol: 0.35 },
    },
    /** Циклы: громкость на полном уровне. */
    LOOPS: {
        drip: { file: 'assets/sounds/amb-drip.ogg', vol: 0.3 },
        water: { file: 'assets/sounds/amb-water.ogg', vol: 0.2 },
        rush: { file: 'assets/sounds/monster-rush.ogg', vol: 0.75 },
        toy: { file: 'assets/sounds/toy-wind.ogg', vol: 0.35 },
        flare: { file: 'assets/sounds/flare-loop.ogg', vol: 0.14 },
    },
    MUSIC: { level: 'assets/sounds/music-level.ogg', lobby: 'assets/sounds/music-lobby.ogg' },
    MUSIC_GAIN: 0.75,

    /** @type {Record<string, any>} */ handles: {},
    duckT: 0,
    inited: false,

    init() {
        if (this.inited) return;
        this.inited = true;
        const all = [];
        for (const k of Object.keys(this.EVENTS)) all.push(...this.EVENTS[k].files);
        try { Sound.preload(all); } catch (e) { /* без звука игра идёт */ }
        // любая кнопка интерфейса щёлкает; слоты и толчок звучат своими предметами
        if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            const b = t && t.closest ? /** @type {HTMLButtonElement | null} */ (t.closest('button')) : null;
            if (b && !b.disabled && !b.closest('.bpm-slot, .bpm-pushbtn')) this.play('ui-click');
        }, true);
    },

    play(name, volume, rate) {
        const ev = this.EVENTS[name];
        if (!ev) return;
        try {
            /** @type {any} */ const o = { volume: ev.vol * (volume == null ? 1 : volume) };
            if (rate) o.rate = rate;
            Sound.play(ev.files.length > 1 ? ev.files : ev.files[0], o);
        } catch (e) { /* без звука игра идёт */ }
    },

    /** Звук в точке мира: тише с расстоянием от героя, совсем далёкое не слышно. */
    at(name, x, z, volume) {
        const h = typeof Game !== 'undefined' ? Game.hero : null;
        const k = h ? Math.max(0, 1 - Math.hypot(x - h.x, z - h.z) / 7000) : 1;
        if (k >= 0.08) this.play(name, (volume == null ? 1 : volume) * k * k);
    },

    /** Цикл с уровнем 0..1: заводится при первом ненулевом, 0 — глушит (сам цикл не рвётся). */
    loop(name, level) {
        const L = this.LOOPS[name];
        if (!L) return;
        const v = L.vol * Math.max(0, Math.min(1, level));
        try {
            if (!this.handles[name]) { if (v <= 0) return; this.handles[name] = Sound.loop(L.file, { volume: v }); }
            else this.handles[name].set(v, null);
        } catch (e) { /* без звука игра идёт */ }
    },

    /** Музыка и атмосфера: зал со стекающей водой есть и в лобби, и на уровнях (там — громче). */
    scene(kind) {
        try { Sound.music(kind === 'level' ? this.MUSIC.level : this.MUSIC.lobby, { volume: this.MUSIC_GAIN, fade: 1.2 }); } catch (e) { /* без звука игра идёт */ }
        this.loop('drip', kind === 'level' ? 1 : 0.55);
        this.loop('water', kind === 'level' ? 1 : 0.5);
        this.danger(0);
    },

    /** Монстр мчится (0..1): вода кипит громче и выше, музыка отступает. */
    danger(level) {
        const v = Math.max(0, Math.min(1, level));
        this.loop('rush', v);
        if (this.handles.rush) { try { this.handles.rush.set(this.LOOPS.rush.vol * v, 0.9 + v * 0.35); } catch (e) { /* без звука игра идёт */ } }
        if (v > 0.25 && performance.now() > this.duckT) {
            this.duckT = performance.now() + 300;
            try { Sound.duck(0.55, 0.15, 0.4, 0.7); } catch (e) { /* без звука игра идёт */ }
        }
    },

    /** Скример: всё затихает, кроме крика; после — плавно назад. */
    scare(on) {
        try { if (on) Sound.duck(0.12, 0.04, Infinity, 0); else Sound.unduck(0.9); } catch (e) { /* без звука игра идёт */ }
    },

    /** Колесо фортуны: щелчки реже и реже, как у замедляющегося диска. */
    wheelTicks(ms) {
        const t0 = performance.now();
        const tick = () => {
            const k = (performance.now() - t0) / Math.max(1, ms);
            if (k >= 1) return;
            this.play('ui-tick');
            setTimeout(tick, 55 + 300 * k * k);
        };
        tick();
    },
};
