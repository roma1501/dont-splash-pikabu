// GameEconomy.js — Eco: монеты, припасы, инструменты, слоты, улучшения, пропуска, скины, уровни и прогресс «за рекламу».
// Контракт — docs/DESIGN.md («API Eco»). Каталог и цены — GameData.js. Состояние — save.eco внутри ЕДИНОГО сохранения игры:
//
//   const save = (await Platform.load()) || {};
//   Eco.init(save, () => Platform.save(save));      // save.eco дополняется значениями по умолчанию, битые поля чинятся
//
// Запись в сохранение — через persist(), не чаще раза в persistDelayMs (по умолчанию 250 мс; 0 — сразу); Eco.flush() — немедленно
// (и сам вызывается, когда вкладка скрывается). Любое изменение шлёт событие Eco.on(fn): fn({ type, ... }), по нему UI перерисовывается.
//
// ТИПЫ СОБЫТИЙ: init coins item use tool loadout upgrade pass level skin ad adstart adend prefs.
//
// КОСМЕТИКА (6 вкладок, GameData.COSMETIC_TABS): itemOwned equippedIn itemEquipped tabCount composeLook(previewId) flair grantItem buyItem equipItem unequipSlot;
// Eco.skin() = composeLook() — полный вид с trail / victory. Daily Gift и колесо: Eco.sink, _initSystems, takeRecoveredPrize; проверка каталога — validateCatalog().
//
// Дополнения к DESIGN.md (нужны экранам GameUI): buyUnlock buyRefill buyUpgrade buySkin equip unequip equipSkin grant unlockTool
// infinite upNeeds upBlock adWait adWaitLabel adBusy adBlock pref/setPref/prefs flush reset. Всё прочее — как в DESIGN.md.
//
// РЕКЛАМА. watchAd(offerId) — один запрос за раз (повторный клик -> reason 'busy'), просмотр засчитывается ТОЛЬКО по
// `await Platform.rewarded(тип) === true`; на последнем просмотре выдаётся награда, повторяемые предложения начинаются заново,
// остальные закрываются. Неудача прогресс не трогает и на REWARDED_RETRY_SEC блокирует новые запросы.

const ECO_MAX_COINS = 999999999;

/** @typedef {{ ok: boolean, reason?: string, missing?: number, [key: string]: any }} EcoResult */

/** @satisfies {Record<string, any>} */
const Eco = {
    VERSION: 1,
    /** Состояние (save.eco). @type {any} */
    state: null,
    /** @type {any} */ _save: null,
    /** @type {(() => any) | null} */ _persist: null,
    /** @type {Array<(e: any) => void>} */ _subs: [],
    _busy: false,
    _retryAt: 0,
    /** @type {any} */ _timer: 0,
    _dirty: false,
    _hooked: false,
    /** Задержка записи в сохранение, мс (0 — сразу при каждом изменении). */
    persistDelayMs: 250,
    /** Часы (мс): подменяются в тестах. */
    now() { return Date.now(); },

    // =================================================================================================
    // Запуск и состояние
    // =================================================================================================

    /** save — общий объект сохранения игры (Eco живёт в save.eco); persist() — сохранить его целиком. */
    init(save, persist) {
        this._save = save && typeof save === 'object' ? save : {};
        this._persist = typeof persist === 'function' ? persist : null;
        this.state = this.normalize(this._save.eco);
        this._save.eco = this.state;
        this._busy = false;
        this._retryAt = 0;
        this._dirty = false;
        if (!this._hooked && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            this._hooked = true;
            window.addEventListener('pagehide', () => this.flush());
            if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
        }
        this._initSystems();
        this._emit('init', {});
        return this;
    },

    /** Начать заново (тесты, отладка): чистое состояние в тот же save. */
    reset() {
        if (this._save) { delete this._save.eco; delete this._save.daily; delete this._save.wheel; }
        this.state = this.normalize(null);
        if (this._save) { this._save.eco = this.state; this._initSystems(); }
        this._dirty = true;
        this._emit('init', {});
        this.flush();
    },

    /** Состояние нового игрока. */
    defaults() {
        const S = GameData.START;
        /** @type {Record<string, number>} */
        const items = {};
        for (const id of GameData.itemIds()) items[id] = S.items[id] | 0;
        /** @type {Record<string, number>} */
        const up = {};
        for (const u of GameData.UPGRADES) up[u.id] = 0;
        const def = GameData.SKINS.find((s) => s.default) || GameData.SKINS[0];
        return {
            v: this.VERSION,
            coins: S.coins | 0,
            items,
            tools: ['pebble'],
            loadout: ['pebble'],
            up,
            passes: { x2: false, maxed: false, rope: false },
            levels: { done: [], unlocked: [] },
            skins: { owned: [def.id], equipped: def.id },
            cos: { owned: [], eq: { hair: null, hat: null, acc: null, trail: null, victory: null } },
            ads: {},
            prefs: { bots: S.bots, monsters: S.monsters, level: 1 },
        };
    },

    /** Сохранение любой формы (в том числе битое, старое, null) -> полное корректное состояние. Чистая функция. */
    normalize(raw) {
        const d = this.defaults();
        const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
        const int = (v, lo, hi, def) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
        const list = (v) => (Array.isArray(v) ? v : []);
        const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
        const out = d;
        if (has(r, 'coins')) out.coins = int(r.coins, 0, ECO_MAX_COINS, d.coins);
        for (const id of GameData.itemIds()) {
            if (has(r.items, id)) out.items[id] = int(r.items[id], 0, GameData.CAP[id] || 999, d.items[id]);
        }
        const toolIds = GameData.TOOLS.map((t) => t.id);
        if (Array.isArray(r.tools)) out.tools = uniq(['pebble'].concat(r.tools.filter((t) => toolIds.includes(t))));
        for (const u of GameData.UPGRADES) if (has(r.up, u.id)) out.up[u.id] = int(r.up[u.id], 0, 3, 0);
        for (const p of ['x2', 'maxed', 'rope']) if (has(r.passes, p)) out.passes[p] = r.passes[p] === true;
        // пропуска открывают инструменты
        if (out.passes.maxed) for (const t of ['toy', 'flare', 'rope']) if (!out.tools.includes(t)) out.tools.push(t);
        if (out.passes.rope && !out.tools.includes('rope')) out.tools.push('rope');
        const N = GameData.LEVELS.length;
        const lv = (a) => uniq(list(a).map((x) => Math.floor(Number(x))).filter((x) => x >= 1 && x <= N)).sort((a, b) => a - b);
        if (r.levels) { out.levels.done = lv(r.levels.done); out.levels.unlocked = lv(r.levels.unlocked); }
        if (Array.isArray(r.loadout)) out.loadout = uniq(r.loadout.filter((t) => out.tools.includes(t))).slice(0, GameData.MAX_SLOTS);
        if (r.skins) {
            const ids = GameData.outfitIds();
            out.skins.owned = uniq(out.skins.owned.concat(list(r.skins.owned).filter((s) => ids.includes(s))));
            if (ids.includes(r.skins.equipped) && out.skins.owned.includes(r.skins.equipped)) out.skins.equipped = r.skins.equipped;
        }
        if (r.cos && typeof r.cos === 'object') {
            // старые сохранения без cos грузятся как есть; здесь — причёски, шапки, аксессуары, следы, победы
            const own = (id) => { const it = GameData.item(id); return !!it && it.tab !== 'outfit' && !it.free && !it.exclusive; };
            out.cos.owned = uniq(list(r.cos.owned).filter(own));
            for (const slot of GameData.OPT_SLOTS) {
                const id = r.cos.eq && typeof r.cos.eq === 'object' ? r.cos.eq[slot] : null;
                const it = GameData.item(id);
                if (it && it.tab === slot && (it.free || out.cos.owned.includes(id))) out.cos.eq[slot] = id;
            }
        }
        if (r.ads && typeof r.ads === 'object') {
            for (const id of Object.keys(r.ads)) {
                const o = GameData.adOffer(id);
                const n = o ? int(r.ads[id], 0, o.need, 0) : 0;
                if (o && n > 0 && n < o.need) out.ads[id] = n;     // полный или нулевой прогресс не храним
            }
        }
        if (r.prefs) {
            out.prefs.bots = int(r.prefs.bots, 0, GameData.MAX_BOTS, d.prefs.bots);
            out.prefs.monsters = int(r.prefs.monsters, 1, GameData.MAX_MONSTERS, d.prefs.monsters);
            out.prefs.level = int(r.prefs.level, 1, N, 1);
        }
        return out;
    },

    /** Подписка на изменения: fn({ type, ... }); возвращает отписку. */
    on(fn) {
        if (typeof fn !== 'function') return () => {};
        this._subs.push(fn);
        return () => { const i = this._subs.indexOf(fn); if (i >= 0) this._subs.splice(i, 1); };
    },

    _emit(type, data) {
        const e = Object.assign({ type }, data || {});
        for (const fn of this._subs.slice()) {
            try { fn(e); } catch (err) { console.error('Eco.on:', err); }
        }
    },

    /** Изменение: событие + отложенная запись в сохранение. */
    _changed(type, data) {
        this._queue();
        this._emit(type, data);
    },

    _queue() {
        this._dirty = true;
        if (!(this.persistDelayMs > 0) || typeof setTimeout !== 'function') { this.flush(); return; }
        if (this._timer) return;
        this._timer = setTimeout(() => { this._timer = 0; this.flush(); }, this.persistDelayMs);
    },

    /** Записать сохранение сейчас, если есть что писать. */
    flush() {
        if (this._timer && typeof clearTimeout === 'function') { clearTimeout(this._timer); this._timer = 0; }
        if (!this._dirty) return false;
        this._dirty = false;
        if (this._persist) {
            try {
                const r = /** @type {any} */ (this._persist());
                if (r && typeof r.catch === 'function') r.catch((e) => console.warn('Eco persist:', e));
            } catch (e) { console.warn('Eco persist:', e); }
        }
        return true;
    },

    _fail(reason, extra) { return Object.assign({ ok: false, reason }, extra || {}); },

    // =================================================================================================
    // Монеты
    // =================================================================================================

    get coins() { return this.state.coins; },

    /** Начислить монеты; возвращает сколько начислено. reason 'run' удваивается пропуском 'x2'. */
    addCoins(n, reason) {
        let v = Math.floor(Number(n));
        if (!(v > 0)) return 0;
        if (reason === 'run' && this.state.passes.x2) v *= 2;
        v = Math.min(v, ECO_MAX_COINS - this.state.coins);
        if (v <= 0) return 0;
        this.state.coins += v;
        this._changed('coins', { delta: v, reason: reason || '' });
        return v;
    },

    /** Потратить монеты: true, если хватило. */
    spend(n) {
        const v = Math.floor(Number(n));
        if (!Number.isFinite(v) || v < 0 || v > this.state.coins) return false;
        if (v === 0) return true;
        this.state.coins -= v;
        this._changed('coins', { delta: -v, reason: 'spend' });
        return true;
    },

    // =================================================================================================
    // Припасы и инструменты
    // =================================================================================================

    isItem(id) { return GameData.itemIds().includes(id); },
    isTool(id) { return GameData.tool(id) !== null; },
    /** Бесконечный запас (верёвка с пропуском). */
    infinite(id) { return id === 'rope' && this.state.passes.rope === true; },

    /** Сколько припаса (Infinity — бесконечная верёвка). */
    count(id) {
        if (this.infinite(id)) return Infinity;
        return this.isItem(id) ? this.state.items[id] | 0 : 0;
    },

    /** Добавить припас (с пределом стопки); возвращает сколько добавлено. Инструмент не открывает. */
    add(id, n) {
        const v = Math.floor(Number(n));
        if (!this.isItem(id) || !(v > 0)) return 0;
        const room = Math.max(0, (GameData.CAP[id] || 999) - (this.state.items[id] | 0));
        const got = Math.min(v, room);
        if (got <= 0) return 0;
        this.state.items[id] = (this.state.items[id] | 0) + got;
        this._changed('item', { id, delta: got });
        return got;
    },

    /** Израсходовать одну штуку: true, если была. Инструмент должен быть открыт. */
    use(id) {
        if (!this.isItem(id)) return false;
        if (this.isTool(id) && !this.toolUnlocked(id)) return false;
        if (this.infinite(id)) { this._emit('use', { id }); return true; }
        if ((this.state.items[id] | 0) <= 0) return false;
        this.state.items[id]--;
        this._changed('item', { id, delta: -1 });
        return true;
    },

    toolUnlocked(id) { return id === 'pebble' ? true : this.state.tools.includes(id); },

    /** Открыть инструмент (+uses бесплатных использований, +в слот, если есть место). true — открыт сейчас. */
    unlockTool(id, opts) {
        if (!this.isTool(id) || this.toolUnlocked(id)) return false;
        this.state.tools.push(id);
        const uses = opts && opts.uses ? opts.uses | 0 : 0;
        if (uses > 0) this.add(id, uses);
        if (this.state.loadout.length < GameData.MAX_SLOTS && !this.state.loadout.includes(id)) this.state.loadout.push(id);
        this._changed('tool', { id });
        return true;
    },

    /** Открыть инструмент за монеты («Снаряжение»): даёт UNLOCK_USES бесплатных использований. */
    buyUnlock(id) {
        const c = GameData.unlockCost(id);
        if (!c) return this._fail('unknown');
        if (this.toolUnlocked(id)) return this._fail('owned');
        if (this.state.coins < c.coins) return this._fail('noCoins', { missing: c.coins - this.state.coins });
        this.spend(c.coins);
        this.unlockTool(id, { uses: GameData.UNLOCK_USES });
        return { ok: true, id };
    },

    /** Пополнить инструмент за монеты: index — номер в GameData.coinRefills(id). */
    buyRefill(id, index) {
        const r = GameData.coinRefills(id)[index | 0];
        if (!r) return this._fail('unknown');
        if (!this.toolUnlocked(id)) return this._fail('locked');
        if (this.infinite(id)) return this._fail('endless');
        if ((this.state.items[id] | 0) >= (GameData.CAP[id] || 999)) return this._fail('full');
        if (this.state.coins < r.coins) return this._fail('noCoins', { missing: r.coins - this.state.coins });
        this.spend(r.coins);
        this.add(id, r.n);
        return { ok: true, id, n: r.n };
    },

    // =================================================================================================
    // Слоты (3 инструмента в забеге)
    // =================================================================================================

    /** Инструменты в слотах (≤ 3 id, порядок = слоты 1..3). Присваивание чистится: только открытые, без повторов. */
    get loadout() { return this.state.loadout.slice(); },
    set loadout(v) {
        const a = Array.isArray(v) ? v : [];
        this.state.loadout = a.filter((t, i) => this.toolUnlocked(t) && a.indexOf(t) === i).slice(0, GameData.MAX_SLOTS);
        this._changed('loadout', {});
    },

    /** Поставить инструмент в слот (первый свободный или slot 0..2 — на его место). */
    equip(id, slot) {
        if (!this.isTool(id) || !this.toolUnlocked(id)) return this._fail('locked');
        const lo = this.state.loadout;
        if (lo.includes(id)) return this._fail('has');
        if (slot != null && slot >= 0 && slot < GameData.MAX_SLOTS) {
            if (slot < lo.length) lo[slot] = id; else lo.push(id);
        } else {
            if (lo.length >= GameData.MAX_SLOTS) return this._fail('full');
            lo.push(id);
        }
        this._changed('loadout', {});
        return { ok: true };
    },

    /** Убрать из слота: id инструмента или номер слота. */
    unequip(idOrSlot) {
        const lo = this.state.loadout;
        const i = typeof idOrSlot === 'number' ? idOrSlot : lo.indexOf(idOrSlot);
        if (i < 0 || i >= lo.length) return this._fail('none');
        lo.splice(i, 1);
        this._changed('loadout', {});
        return { ok: true };
    },

    // =================================================================================================
    // Улучшения
    // =================================================================================================

    /** Уровень 0..3 (пропуск 'maxed' — всегда 3). */
    upLevel(id) {
        if (!GameData.upgrade(id)) return 0;
        return this.state.passes.maxed ? 3 : this.state.up[id] | 0;
    },
    /** Значение улучшения по таблице DESIGN.md на текущем уровне. */
    stat(id) { return GameData.upValue(id, this.upLevel(id)); },
    /** Инструмент, нужный улучшению (null — не нужен). */
    upNeeds(id) { const u = GameData.upgrade(id); return u ? u.need : null; },
    /** Почему нельзя купить следующий уровень: '' | 'unknown' | 'max' | 'needTool'. */
    upBlock(id) {
        const u = GameData.upgrade(id);
        if (!u) return 'unknown';
        if (this.upLevel(id) >= 3) return 'max';
        if (u.need && !this.toolUnlocked(u.need)) return 'needTool';
        return '';
    },
    /** Цена следующего уровня в монетах (0 — нет следующего). */
    upCost(id) { const l = this.upLevel(id); return l >= 3 ? 0 : GameData.UPGRADE_COST.coins[l]; },

    /** Следующий уровень улучшения за монеты. */
    buyUpgrade(id) {
        const block = this.upBlock(id);
        if (block) return this._fail(block);
        const cost = this.upCost(id);
        if (this.state.coins < cost) return this._fail('noCoins', { missing: cost - this.state.coins });
        this.spend(cost);
        this._setUp(id, this.upLevel(id) + 1);
        return { ok: true, level: this.upLevel(id) };
    },

    _setUp(id, level) {
        this.state.up[id] = Math.max(this.state.up[id] | 0, Math.min(3, level | 0));
        delete this.state.ads['up:' + id + ':' + level];
        this._changed('upgrade', { id, level: this.state.up[id] });
    },

    // =================================================================================================
    // Пропуска
    // =================================================================================================

    /** 'x2' | 'maxed' | 'rope' */
    hasPass(id) { return this.state.passes[id] === true; },

    grantPass(id) {
        if (!Object.prototype.hasOwnProperty.call(this.state.passes, id) || this.state.passes[id]) return false;
        this.state.passes[id] = true;
        if (id === 'maxed') for (const t of ['toy', 'flare', 'rope']) this.unlockTool(t, { uses: 0 });
        if (id === 'rope') this.unlockTool('rope', { uses: 0 });
        this._changed('pass', { id });
        return true;
    },

    /** Выдать награду предложения: { coins, items: {id: n}, unlock: [tool], pass }. Монеты не удваиваются. */
    grant(give, reason) {
        if (!give) return;
        if (give.unlock) for (const t of give.unlock) this.unlockTool(t, { uses: 0 });
        if (give.coins) this.addCoins(give.coins, reason || 'shop');
        if (give.items) for (const id of Object.keys(give.items)) this.add(id, give.items[id]);
        if (give.pass) this.grantPass(give.pass);
    },

    // =================================================================================================
    // Уровни
    // =================================================================================================

    levelDone(n) { return this.state.levels.done.includes(n | 0); },

    /** Уровень открыт: первый всегда, дальше — после прохождения предыдущего или открытый за рекламу. */
    levelUnlocked(n) {
        n = n | 0;
        if (n < 1 || n > GameData.LEVELS.length) return false;
        if (n === 1) return true;
        const L = this.state.levels;
        return L.done.includes(n - 1) || L.done.includes(n) || L.unlocked.includes(n);
    },

    /** Отметить пройденным. true — пройден впервые. */
    completeLevel(n) {
        n = n | 0;
        if (n < 1 || n > GameData.LEVELS.length || this.levelDone(n)) return false;
        this.state.levels.done.push(n);
        this.state.levels.done.sort((a, b) => a - b);
        this._changed('level', { n, done: true });
        return true;
    },

    /** Открыть уровень (за рекламу). true — открыт сейчас. */
    unlockLevel(n) {
        n = n | 0;
        if (n < 2 || n > GameData.LEVELS.length || this.levelUnlocked(n)) return false;
        this.state.levels.unlocked.push(n);
        this.state.levels.unlocked.sort((a, b) => a - b);
        delete this.state.ads['level:' + n];
        this._changed('level', { n, unlocked: true });
        return true;
    },

    /** Первый непройденный открытый уровень («Играть» продолжает с него); всё пройдено — последний. */
    currentLevel() {
        const N = GameData.LEVELS.length;
        for (let n = 1; n <= N; n++) if (this.levelUnlocked(n) && !this.levelDone(n)) return n;
        return N;
    },

    // =================================================================================================
    // Косметика: образы (skins) и 5 необязательных слотов (hair hat acc trail victory)
    // =================================================================================================
    //   Образ — основа вида (skins.equipped); причёска / головной убор / аксессуар перекрывают его части, след и победа — свои слоты.
    //   Смена образа не снимает остальное. Бесплатные «пустые» предметы (hair.none, hat.none, acc.none) есть у всех с начала.

    skinId() { return this.state.skins.equipped; },
    /** Предмет любой вкладки получен (образ куплен/выдан, «пустой» предмет — всегда). */
    itemOwned(id) {
        const it = GameData.item(id);
        if (!it) return false;
        if (it.tab === 'outfit') return this.state.skins.owned.includes(id);
        return !!it.free || this.state.cos.owned.includes(id);
    },
    ownsSkin(id) { return this.itemOwned(id); },
    /** id надетого в слоте: 'outfit' | 'hair' | 'hat' | 'acc' | 'trail' | 'victory' (null — пусто). */
    equippedIn(slot) { return slot === 'outfit' ? this.state.skins.equipped : (this.state.cos.eq[slot] || null); },
    itemEquipped(id) { const it = GameData.item(id); return !!it && this.equippedIn(it.tab) === id; },
    /** Сколько предметов вкладки получено / всего (без бесплатных «пустых»). */
    tabCount(tab) {
        const list = GameData.itemsOf(tab).filter((it) => !it.free);
        return { have: list.filter((it) => this.itemOwned(it.id)).length, total: list.length };
    },

    /**
     * Полный вид героя с применённым предметом previewId (примерка): { skin, shirt, pants, shoes, hair, hairColor, hat, hatColor?, acc: [],
     * trail: id|null, victory: id|null } — trail и victory это id эффектов GameFx. Порядок: образ -> головной убор (его причёска, если есть)
     * -> причёска -> аксессуары; примерка заменяет надетое в слоте предмета. Без аргумента — то, что надето сейчас.
     */
    composeLook(previewId) {
        const pv = previewId ? GameData.item(previewId) : null;
        const slotItem = (slot) => {
            const id = pv && pv.tab === slot ? pv.id : this.equippedIn(slot);
            return id ? GameData.item(id) : null;
        };
        const outfit = slotItem('outfit') || GameData.SKINS[0];
        const L = outfit.look;
        /** @type {any} */
        const look = { skin: L.skin, shirt: L.shirt, pants: L.pants, shoes: L.shoes, hair: L.hair, hairColor: L.hairColor, hat: L.hat, acc: L.acc.slice() };
        if (L.hatColor != null) look.hatColor = L.hatColor;
        const hat = slotItem('hat');
        if (hat) {
            look.hat = hat.look.hat;
            if (hat.look.hatColor != null) look.hatColor = hat.look.hatColor; else delete look.hatColor;
            if (hat.look.hair) { look.hair = hat.look.hair; look.hairColor = hat.look.hairColor; }
        }
        const hair = slotItem('hair');
        if (hair) { look.hair = hair.look.hair; look.hairColor = hair.look.hairColor; }
        const acc = slotItem('acc');
        if (acc) look.acc = acc.look.acc.slice();
        const trail = slotItem('trail'), win = slotItem('victory');
        look.trail = trail ? trail.fx : null;
        look.victory = win ? win.fx : null;
        return look;
    },

    /** Вид героя для игры (то, что надето сейчас): composeLook() — с полями trail / victory. */
    skin() { return this.composeLook(); },

    /** Лучшая редкость надетых причёски и головного убора, если она epic и выше ('epic' | 'legendary' | 'mythic'), иначе null: GameFx рисует искры. */
    flair() {
        let best = -1;
        for (const slot of ['hair', 'hat']) {
            const it = GameData.item(this.equippedIn(slot) || '');
            if (it) best = Math.max(best, GameData.RARITIES.indexOf(it.rarity));
        }
        return best >= GameData.RARITIES.indexOf('epic') ? GameData.RARITIES[best] : null;
    },

    /** Выдать предмет любой вкладки (покупка, реклама, Daily Gift, колесо). true — выдан впервые. Не надевает. */
    grantItem(id) {
        const it = GameData.item(id);
        if (!it || this.itemOwned(id)) return false;
        if (it.tab === 'outfit') this.state.skins.owned.push(id); else this.state.cos.owned.push(id);
        delete this.state.ads[GameData.adIdOf(id)];
        this._changed('skin', { id, slot: it.tab, owned: true });
        return true;
    },
    grantSkin(id) { return this.grantItem(id); },

    /** Купить за монеты. reason: unknown | owned | exclusive | notForCoins | noCoins (+ missing). */
    buyItem(id) {
        const it = GameData.item(id);
        if (!it) return this._fail('unknown');
        if (this.itemOwned(id)) return this._fail('owned');
        if (it.exclusive) return this._fail('exclusive');
        const price = GameData.coinPrice(it);
        if (!price) return this._fail('notForCoins');
        if (this.state.coins < price) return this._fail('noCoins', { missing: price - this.state.coins });
        this.spend(price);
        this.grantItem(id);
        return { ok: true, id };
    },
    buySkin(id) { return this.buyItem(id); },

    /** Надеть полученный предмет в его слот. reason: unknown | locked. same: true — уже надето. */
    equipItem(id) {
        const it = GameData.item(id);
        if (!it) return this._fail('unknown');
        if (!this.itemOwned(id)) return this._fail('locked');
        if (this.equippedIn(it.tab) === id) return { ok: true, same: true };
        if (it.tab === 'outfit') this.state.skins.equipped = id; else this.state.cos.eq[it.tab] = id;
        this._changed('skin', { id, slot: it.tab, equipped: true });
        return { ok: true };
    },
    equipSkin(id) { return this.equipItem(id); },

    /** Снять предмет слота (образ снять нельзя). reason: unknown | outfit | none. */
    unequipSlot(slot) {
        if (!GameData.OPT_SLOTS.includes(slot)) return this._fail(slot === 'outfit' ? 'outfit' : 'unknown');
        const prev = this.state.cos.eq[slot];
        if (!prev) return this._fail('none');
        this.state.cos.eq[slot] = null;
        this._changed('skin', { id: null, slot, prev, equipped: false });
        return { ok: true, prev };
    },

    // =================================================================================================
    // Награды Daily Gift и колеса: «приёмник» (Eco вместо Shop) и сами модули
    // =================================================================================================
    //   Shop.js (состояние) здесь не используется: кошелёк, прогресс «за рекламу» и сохранение уже в Eco; от Shop берём только проверку каталога
    //   (validateCatalog -> Shop.validate). DailyGift и Wheel — движковые, состояние в save.daily / save.wheel того же объекта сохранения.

    /** Генератор случайных чисел наград (подменяется в тестах). */
    rng() { return Math.random(); },
    /** Приз колеса, выданный при запуске за оборванное вращение (UI покажет и забудет). @type {any} */
    recovered: null,

    /** Приёмник наград для DailyGift / Wheel: монеты, образы и косметика, припасы ('sup.*' — GameData.SUPPLY_PACKS). */
    sink: {
        addCoins(n, opts) { return Eco.addCoins(n, (opts && opts.reason) || 'gift'); },
        owns(id) { return GameData.supply(id) ? false : Eco.itemOwned(id); },
        grant(id) {
            const sp = GameData.supply(id);
            if (sp) { Eco.add(sp.item, sp.n); return true; }
            return Eco.grantItem(id);
        },
        isExclusive(id) { const it = GameData.item(id); return !!(it && it.exclusive); },
        exclusiveIds(kind) { return GameData.allItems().filter((it) => it.exclusive === (kind || 'daily')).map((it) => it.id); },
        item(id) { return GameData.item(id) || (GameData.supply(id) ? { id, supply: true } : undefined); },
        name(id) { return GameData.itemName(id); },
        /** Случайный не полученный предмет магазина (не эксклюзив, не «пустой», с ценой), редкость не выше maxRarity; обычные выпадают чаще. */
        randomItem(o) {
            const opt = o || {};
            const R = GameData.RARITIES;
            const max = R.indexOf(opt.maxRarity) >= 0 ? R.indexOf(opt.maxRarity) : R.length - 1;
            const pool = GameData.allItems().filter((it) => !it.exclusive && !it.free && !it.default && it.price && R.indexOf(it.rarity) <= max && !Eco.itemOwned(it.id));
            if (!pool.length) return null;
            const rng = typeof opt.rng === 'function' ? opt.rng : () => Eco.rng();
            const w = (it) => GameData.RARITY_WEIGHT[it.rarity] || 1;
            let total = 0;
            for (const it of pool) total += w(it);
            let r = Math.min(0.999999999, Math.max(0, rng())) * total;
            for (const it of pool) { r -= w(it); if (r < 0) return it.id; }
            return pool[pool.length - 1].id;
        },
    },

    /** Подключить DailyGift и Wheel к сохранению (вызывается из init/reset; без модулей — тишина). */
    _initSystems() {
        const save = this._save;
        const common = {
            rewardsSink: this.sink,
            persist: () => { this._dirty = true; this.flush(); },     // выдача и «ожидающее вращение» пишутся сразу, не по таймеру
            now: () => this.now(),
            rng: () => this.rng(),
        };
        this.recovered = null;
        if (typeof DailyGift !== 'undefined') {
            DailyGift.init(Object.assign({ rewards: GameData.DAILY.rewards, exclusive: GameData.DAILY.exclusive, state: save.daily, onChange: (e) => this._emit('daily', { kind: e.type }) }, common));
            save.daily = DailyGift.state;
        }
        if (typeof Wheel !== 'undefined') {
            Wheel.init(Object.assign({ sectors: GameData.WHEEL, state: save.wheel, onChange: (e) => {
                if (e.type === 'prize' && e.recovered) this.recovered = e;      // призы вращения, оборванного перезагрузкой: UI покажет при первом меню
                this._emit('wheel', { kind: e.type });
            } }, common));
            save.wheel = Wheel.state;
        }
    },

    /** Приз колеса, выданный при запуске за оборванное вращение: отдаётся один раз. */
    takeRecoveredPrize() { const r = this.recovered; this.recovered = null; return r; },

    /**
     * Проверка каталога косметики по правилу пользователя (Shop.validate: 5–6 вкладок, 20–50 предметов, ≈35% валюта / ≈65% реклама).
     * У Shop.validate лимит рекламы 1..5 (SHOP_ADS_MAX в Constants.js), в этой игре 1..7 — его замечания adsRange сверяются здесь с диапазоном 1..7.
     * Возвращает { ok, problems: [{ code, message, ... }], report } (report — ответ Shop.validate как есть).
     */
    validateCatalog() {
        const cat = GameData.catalog();
        /** @type {any} */
        const rep = typeof Shop !== 'undefined' ? Shop.validate(cat) : { problems: [], perTab: [] };
        const problems = rep.problems.filter((p) => p.code !== 'adsRange');
        for (const it of cat.items) {
            const ads = GameData.adPrice(it);
            if (ads && (ads < 1 || ads > 7)) problems.push({ code: 'adsRange', id: it.id, message: 'Предмет «' + it.id + '»: просмотров рекламы ' + ads + ', нужно 1–7' });
        }
        return { ok: problems.length === 0, problems, report: rep };
    },

    // =================================================================================================
    // Настройки окна «Новый забег»
    // =================================================================================================

    get prefs() { return Object.assign({}, this.state.prefs); },
    pref(key) { return this.state.prefs[key]; },
    setPref(key, value) {
        const lim = { bots: [0, GameData.MAX_BOTS], monsters: [1, GameData.MAX_MONSTERS], level: [1, GameData.LEVELS.length] }[key];
        if (!lim) return;
        const v = Math.max(lim[0], Math.min(lim[1], Math.floor(Number(value)) || lim[0]));
        if (this.state.prefs[key] === v) return;
        this.state.prefs[key] = v;
        this._changed('prefs', { key });
    },

    // =================================================================================================
    // Реклама: предложения «За рекламу N/M»
    // =================================================================================================

    /** Идёт запрос рекламы (кнопки «за рекламу» неактивны). */
    get adBusy() { return this._busy; },

    /** Прогресс предложения: { have, need } (need 0 — такого предложения нет; уже полученное — N/N). */
    adProgress(offerId) {
        const o = GameData.adOffer(offerId);
        if (!o) return { have: 0, need: 0 };
        if (this.adBlock(offerId) === 'owned') return { have: o.need, need: o.need };     // получено: N/N
        return { have: Math.min(o.need, this.state.ads[offerId] | 0), need: o.need };
    },

    /** Секунд до возможного показа: общая пауза между rewarded (Platform) или пауза после неудачи. 0 — можно. */
    adWait() {
        let left = 0;
        if (typeof Platform !== 'undefined' && typeof Platform.rewardedCooldownLeft === 'function') left = Platform.rewardedCooldownLeft() | 0;
        const retry = Math.ceil((this._retryAt - this.now()) / 1000);
        return Math.max(left, retry > 0 ? retry : 0);
    },

    /** «Через N с» / «In N s» ('' — можно). */
    adWaitLabel() {
        const n = this.adWait();
        if (n <= 0) return '';
        if (typeof Platform !== 'undefined' && typeof Platform.rewardedCooldownLabel === 'function' && Platform.rewardedCooldownLeft() === n) return Platform.rewardedCooldownLabel();
        return typeof Lang !== 'undefined' ? Lang.t('ads.cooldown', { n }) : String(n);
    },

    /** Площадка умеет rewarded (иначе кнопки «за рекламу» прячут). */
    adSupported() {
        return typeof Platform !== 'undefined' && (typeof Platform.rewardedSupported !== 'function' || Platform.rewardedSupported());
    },

    /**
     * Можно ли сейчас смотреть рекламу за предложение: '' — можно, иначе причина:
     * unknown | owned (уже получено) | order (улучшение не по порядку) | needTool | endless.
     */
    adBlock(offerId) {
        const o = GameData.adOffer(offerId);
        if (!o) return 'unknown';
        switch (o.kind) {
            case 'shop': return o.offer.once && o.offer.give.pass && this.hasPass(o.offer.give.pass) ? 'owned' : '';
            case 'refill': return this.infinite(o.tool) ? 'endless' : !this.toolUnlocked(o.tool) ? 'needTool' : '';
            case 'unlock': return this.toolUnlocked(o.tool) ? 'owned' : '';
            case 'up': {
                const lvl = this.upLevel(o.up);
                if (lvl >= o.level) return 'owned';
                if (lvl + 1 < o.level) return 'order';
                return this.upBlock(o.up) === 'needTool' ? 'needTool' : '';
            }
            case 'level': return this.levelUnlocked(o.n) ? 'owned' : '';
            case 'skin': return this.itemOwned(o.skin) ? 'owned' : '';
            case 'cos': return this.itemOwned(o.cos) ? 'owned' : '';
            default: return 'unknown';
        }
    },

    _applyOffer(o) {
        switch (o.kind) {
            case 'shop': this.grant(o.offer.give, 'shop'); break;
            case 'refill': this.add(o.tool, o.n); break;
            case 'unlock': this.unlockTool(o.tool, { uses: GameData.UNLOCK_USES }); break;
            case 'up': this._setUp(o.up, o.level); break;
            case 'level': this.unlockLevel(o.n); break;
            case 'skin': this.grantItem(o.skin); break;
            case 'cos': this.grantItem(o.cos); break;
            default: break;
        }
    },

    /**
     * Посмотреть рекламу за предложение offerId. Платформа: Platform.rewarded(<тип>) — засчитывается только `true`.
     * Результат: { ok, done, have, need, reason? }. ok — просмотр засчитан; done — на нём выдана награда.
     * reason при ok=false: unknown | owned | order | needTool | endless | busy | unsupported | cooldown (wait — секунды) | failed.
     */
    async watchAd(offerId) {
        const o = GameData.adOffer(offerId);
        const p = this.adProgress(offerId);
        const no = (reason, extra) => Object.assign({ ok: false, done: false, have: p.have, need: p.need, reason }, extra || {});
        if (!o) return no('unknown');
        const block = this.adBlock(offerId);
        if (block) return no(block);
        if (this._busy) return no('busy');
        if (!this.adSupported()) return no('unsupported');
        const wait = this.adWait();
        if (wait > 0) return no('cooldown', { wait });
        this._busy = true;
        this._emit('adstart', { offer: offerId });
        let ok = false;
        try {
            ok = (await Platform.rewarded(o.type)) === true;
        } catch (e) {
            ok = false;
        }
        this._busy = false;
        if (!ok) {
            const retry = typeof REWARDED_RETRY_SEC !== 'undefined' ? Number(REWARDED_RETRY_SEC) : 4;
            this._retryAt = this.now() + Math.max(0, retry) * 1000;
            this._emit('adend', { offer: offerId, ok: false });
            return no('failed');
        }
        // за время ролика состояние могло измениться (предложение уже получено другим путём): просмотр не теряем молча
        if (this.adBlock(offerId)) {
            this._emit('adend', { offer: offerId, ok: true });
            return no(this.adBlock(offerId));
        }
        const have = (this.state.ads[offerId] | 0) + 1;
        const done = have >= o.need;
        if (done) {
            delete this.state.ads[offerId];
            this._applyOffer(o);
            if (!o.repeat) delete this.state.ads[offerId];
        } else {
            this.state.ads[offerId] = have;
        }
        this._changed('ad', { offer: offerId, have: done ? o.need : have, need: o.need, done });
        this._emit('adend', { offer: offerId, ok: true });
        return { ok: true, done, have: done ? o.need : have, need: o.need };
    },
};

Eco.state = Eco.normalize(null);
