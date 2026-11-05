// GameUI.js — весь DOM-интерфейс игры (название — GAME_TITLE, сейчас «Don’t Splash»): главное меню, HUD забега, окна (новый забег, магазин, снаряжение, улучшения,
// скины, инвентарь), экраны «Тебя схватили!», результат, пауза, скример, тосты и чат. Оформление — css/game.css, каталог — GameData.js,
// экономика — Eco (GameEconomy.js). Контракт для игры — docs/DESIGN.md («API GameUI»):
//
//   GameUI.init({ onLogin, onPlay, onLobby, onStartRun({ level, bots, monsters }), onOpen(win), onClose(), onSlot(i), onPush(), onRescue('item'|'ad'),
//                 onCheckpoint(), onNext(), onMenu(), onPause(), onResume(), onHowTo(), onSound(), onEquipSkin(id), onPreviewSkin(id|null),
//                 onDouble() -> Promise<boolean>, onInteract() })
//   GameUI.menu(on, { level, levelName })          GameUI.hud(on)
//   GameUI.openWindow('create'|'shop'|'equipment'|'upgrades'|'skins'|'inventory', opts) / closeWindows() / isOpen()
//   GameUI.setLevel(n, name) / setProgress(f, stage, total) / setCoins(n) / setRunCoins(n)
//   GameUI.setHotbar([{ id|null, count (Infinity — ∞), cooldown 0..1, active } ×3, { id: 'push'|'superpush', count, cooldown }])
//   GameUI.setThreat({ state: 'calm'|'listening'|'rushing'|'near', eta, dir })     dir — угол на экране, рад, 0 — вверх
//   GameUI.swim(on, { canClimb, canRope })         GameUI.prompt(text | null)
//   GameUI.down(open, { timeLeft, total, rescues, adRescue })    GameUI.jumpscare(on)    adRescue === false — кнопка «Спастись за рекламу» скрыта
//                                                                  (игра даёт спасение за рекламу раз за забег); не задано — показана
//   GameUI.result(open, { level, name, time, coins, bonus, falls, next })     coins — ВСЕГО начислено за забег, bonus — из них собранное по пути
//                                                                           (остальное — награда за уровень); «x2 за рекламу» — через onDouble
//   GameUI.toast(text, ms) / chat(name, text, color) / pause(on) / setSound(on)
// opts окон: shop { tab: 'coins'|'supplies'|'rescue'|'push'|'pass' }, create { level, bots, monsters }, skins { id | tab: 'outfit'|'hair'|'hat'|'acc'|'trail'|'victory' }.
// Ещё окна: 'daily' (Подарок дня, DailyGift), 'wheel' (Колесо фортуны, Wheel), 'records' (таблица рекордов; кнопка меню видна, только если Platform.leaderboard() -> массив).
// GameUI.offerDaily() — автопоказ подарка (только если DailyGift.shouldOffer() и нет туториала), GameUI.setBestScore(n) — «Мой рекорд: N» в окне рекордов.
// Обработчики h сверх списка выше: onLogin() (после Platform.login() в окне рекордов — игра перечитывает сохранение), onPreviewSkin(look | null) — полный вид из Eco.composeLook.
// setLevel(0, 'Лобби') — плашка с одним названием, без номера.
// Один аргумент (menu(false), result(false), down(false), swim(false)) — просто скрыть.
// Esc закрывает окно, но чуть позже обработчиков игры в том же событии: игра, обработавшая Esc сама (закрыла окно или не хочет
// закрывать), решает раньше — зови GameUI.isOpen() до паузы. Стабильные id для Tutorial: #bpm-hotbar #bpm-slot-0 #bpm-threat
// #bpm-coins #bpm-progress #bpm-swim. Все тексты — Lang (ключи ui.* ниже); реклама только «За рекламу N/M» (Eco.watchAd).

Object.assign(LANG_STRINGS.ru, {
    'menu.tagline': 'Не шуми — он слышит',
    'menu.play': 'Играть', 'menu.level': 'Уровень {n} · {name}', 'menu.lobby': 'Лобби', 'menu.howto': 'Как играть',
    'menu.shop': 'Магазин', 'menu.equipment': 'Снаряжение', 'menu.upgrades': 'Улучшения', 'menu.skins': 'Скины', 'menu.inventory': 'Инвентарь',
    'ui.close': 'Закрыть', 'ui.sound': 'Звук', 'ui.soundOn': 'Звук: вкл', 'ui.soundOff': 'Звук: выкл', 'ui.pause': 'Пауза',
    'win.create': 'Новый забег', 'win.shop': 'Магазин', 'win.equipment': 'Снаряжение', 'win.upgrades': 'Улучшения', 'win.skins': 'Скины', 'win.inventory': 'Инвентарь',
    'ad.progress': 'За рекламу {a}/{b}', 'ad.plus': '+{n} за рекламу {a}/{b}', 'ad.open': 'Открыть за рекламу {a}/{b}', 'ad.rescue': 'Спастись за рекламу',
    'ad.double': 'x2 за рекламу', 'ad.running': 'Идёт реклама…',
    'need.more': 'Нужно ещё {n}',
    'toast.adFail': 'Реклама сейчас недоступна. Прогресс сохранён.', 'toast.adLeft': 'Осталось просмотров: {n}', 'toast.got': 'Получено: {what}',
    'toast.noCoins': 'Не хватает монет: {n}', 'toast.slotsFull': 'Все слоты заняты: сними один инструмент', 'toast.unlocked': 'Открыто: {what}',
    'toast.upgraded': 'Улучшено: {what}, ур. {n}', 'toast.level': 'Уровень {n} открыт!', 'toast.skin': 'Новый скин: {what}', 'toast.equipped': 'Надето: {what}',
    'toast.bought': 'Куплено: {what}', 'toast.pass': 'Пропуск получен: {what}', 'toast.noAds': 'Рекламы здесь нет',
    'create.level': 'Уровень', 'create.bots': 'Боты', 'create.monsters': 'Монстры', 'create.start': 'Начать', 'create.locked': 'Закрыт: сначала пройди уровень {n}',
    'create.reward': 'Награда', 'create.done': 'Пройден', 'create.botsHint': 'Боты бегут те же уровни. Их падения тоже привлекают монстра.',
    'create.monstersHint': 'Больше монстров: выше награда.', 'create.baseReward': 'Базовая награда {n}', 'create.more': 'ещё',
    'shop.tab.coins': 'Монеты', 'shop.tab.supplies': 'Припасы', 'shop.tab.rescue': 'Спасение', 'shop.tab.push': 'Толчки', 'shop.tab.pass': 'Пропуска',
    'shop.have': 'Есть: {n}', 'shop.owned': 'Куплено', 'shop.noAds': 'В этой версии рекламы нет, поэтому магазин закрыт. Монеты можно заработать в забегах.',
    'shop.intro': 'Всё в магазине даётся за просмотр рекламы: чем ценнее, тем больше просмотров. Прогресс сохраняется.',
    'eq.slots': 'Слоты забега', 'eq.slotsHint': 'в забеге: 1, 2, 3 или касание', 'eq.empty': 'Пусто', 'eq.tools': 'Инструменты', 'eq.equip': 'В слот', 'eq.remove': 'Снять',
    'eq.left': 'Осталось: {n}', 'eq.endless': 'Без конца', 'eq.free': 'Открытие: +{n} бесплатно', 'eq.locked': 'Закрыто', 'eq.refill': 'Пополнить',
    'up.now': 'Сейчас', 'up.next': 'Дальше', 'up.max': 'Максимум', 'up.maxPass': 'Максимум по пропуску', 'up.needTool': 'Нужен {tool}', 'up.level': 'Ур. {n}/3',
    'unit.m': '{n} м', 'unit.s': '{n} с', 'unit.n': '×{n}', 'unit.mps': '{n} м/с',
    'skins.equip': 'Надеть', 'skins.equipped': 'Надето', 'skins.buy': 'Купить', 'skins.owned': 'Есть', 'skins.free': 'Бесплатно', 'skins.count': 'Собрано: {a} из {b}',
    'inv.supplies': 'Припасы', 'inv.upgrades': 'Улучшения', 'inv.passes': 'Пропуска', 'inv.progress': 'Прогресс', 'inv.levels': 'Уровней пройдено: {a} из {b}',
    'inv.skins': 'Скинов: {a} из {b}', 'inv.noPasses': 'Пропусков пока нет', 'inv.goShop': 'В магазин', 'inv.goGear': 'К снаряжению',
    'pass.x2': 'Монеты ×2', 'pass.maxed': 'Всё на максимум', 'pass.rope': 'Бесконечная верёвка',
    'hud.stage': 'Этап {a}/{b}', 'threat.calm': 'Тихо', 'threat.listening': 'Слушает…', 'threat.rushing': 'Мчится!', 'threat.near': 'Рядом!',
    'swim.title': 'Выбирайся!', 'swim.climbKey': 'Нажми {key}: залезть на платформу', 'swim.climbTouch': 'Нажми кнопку: залезть на платформу',
    'swim.find': 'Плыви к краю платформы', 'swim.rope': 'Верёвка достанет: выбери её в слоте',
    'down.title': 'Тебя схватили!', 'down.sub': 'Спасись, пока монстр не утащил тебя глубже', 'down.rescue': 'Спасательный круг ×{n}', 'down.checkpoint': 'Вернуться на чекпоинт', 'down.sec': '{n} с',
    'result.title': 'Уровень пройден!', 'result.time': 'Время', 'result.falls': 'Падений', 'result.coins': 'Награда за уровень', 'result.bonus': 'Собрано по пути', 'result.total': 'Итого',
    'result.next': 'Дальше', 'result.lobby': 'В лобби', 'result.doubled': 'Удвоено!',
    'pause.title': 'Пауза', 'pause.resume': 'Продолжить', 'pause.menu': 'В меню', 'pause.lobby': 'В лобби',
    'ui.credits': 'Музыка: Juhani Junkala, JDSherbert. Звуки: Kenney.',
    'menu.daily': 'Подарок', 'menu.wheel': 'Колесо', 'menu.records': 'Рекорды',
    'win.daily': 'Подарок дня', 'win.wheel': 'Колесо фортуны', 'win.records': 'Рекорды',
    'cos.tab.outfit': 'Образы', 'cos.tab.hair': 'Причёски', 'cos.tab.hat': 'Головные уборы', 'cos.tab.acc': 'Аксессуары', 'cos.tab.trail': 'Следы', 'cos.tab.victory': 'Победа',
    'cos.unequip': 'Снять', 'cos.exclusive': 'Подарок дня', 'cos.exclusiveHint': 'Нигде не продаётся: выдаётся на 7-й день подарка.',
    'cos.hint.outfit': 'Основа вида: цвета одежды, причёска и аксессуары образа.', 'cos.hint.hair': 'Причёска заменяет причёску образа.',
    'cos.hint.hat': 'Головной убор заменяет убор образа. Под шапку помещаются только короткая и длинная причёски.', 'cos.hint.acc': 'Набор заменяет аксессуары образа.',
    'cos.hint.trail': 'Эффект за героем при беге и плавании. Редкие и выше искрятся.', 'cos.hint.victory': 'Эффект при прохождении уровня.',
    'daily.intro': 'Заходи каждый день: награды растут, а на 7-й день ждёт эксклюзивный образ.', 'daily.item': 'Предмет', 'daily.coins': 'монет',
    'daily.got': 'Получено: {what}', 'daily.allSkins': 'Все эксклюзивные образы уже собраны.',
    'wheel.intro': 'Все призы видны заранее. Результат выбирается до вращения, колесо остановится точно на нём.', 'wheel.prizes': 'Призы', 'wheel.won': 'Выигрыш: {what}',
    'daily.exclusive': 'Эксклюзивный образ', 'daily.exclusiveHint': 'Нигде больше не продаётся', 'reward.big': 'Крупная награда: {n} монет',
    'wheel.noSpins': 'Вращения на сегодня закончились. Приходи завтра!',
    'rec.best': 'Мой рекорд: {n}', 'rec.empty': 'Пока нет лучших игроков', 'rec.signin': 'Войдите в аккаунт', 'rec.loading': 'Загрузка…',
    'key.space': 'Пробел',
});
Object.assign(LANG_STRINGS.en, {
    'menu.tagline': 'Don\'t make a sound — it hears you',
    'menu.play': 'Play', 'menu.level': 'Level {n} · {name}', 'menu.lobby': 'Lobby', 'menu.howto': 'How to play',
    'menu.shop': 'Shop', 'menu.equipment': 'Gear', 'menu.upgrades': 'Upgrades', 'menu.skins': 'Skins', 'menu.inventory': 'Backpack',
    'ui.close': 'Close', 'ui.sound': 'Sound', 'ui.soundOn': 'Sound: on', 'ui.soundOff': 'Sound: off', 'ui.pause': 'Pause',
    'win.create': 'New run', 'win.shop': 'Shop', 'win.equipment': 'Gear', 'win.upgrades': 'Upgrades', 'win.skins': 'Skins', 'win.inventory': 'Backpack',
    'ad.progress': 'Watch ad {a}/{b}', 'ad.plus': '+{n} for an ad {a}/{b}', 'ad.open': 'Unlock with ads {a}/{b}', 'ad.rescue': 'Escape with an ad',
    'ad.double': 'x2 for an ad', 'ad.running': 'Ad is playing…',
    'need.more': 'Need {n} more',
    'toast.adFail': 'No ad right now. Your progress is saved.', 'toast.adLeft': 'Ads left: {n}', 'toast.got': 'Got: {what}',
    'toast.noCoins': 'Not enough coins: {n}', 'toast.slotsFull': 'All slots are full: remove a tool first', 'toast.unlocked': 'Unlocked: {what}',
    'toast.upgraded': 'Upgraded: {what}, lvl {n}', 'toast.level': 'Level {n} unlocked!', 'toast.skin': 'New skin: {what}', 'toast.equipped': 'Equipped: {what}',
    'toast.bought': 'Bought: {what}', 'toast.pass': 'Pass unlocked: {what}', 'toast.noAds': 'No ads here',
    'create.level': 'Level', 'create.bots': 'Bots', 'create.monsters': 'Monsters', 'create.start': 'Start', 'create.locked': 'Locked: finish level {n} first',
    'create.reward': 'Reward', 'create.done': 'Completed', 'create.botsHint': 'Bots run the same levels. Their splashes lure the monster too.',
    'create.monstersHint': 'More monsters: bigger reward.', 'create.baseReward': 'Base reward {n}', 'create.more': 'more',
    'shop.tab.coins': 'Coins', 'shop.tab.supplies': 'Supplies', 'shop.tab.rescue': 'Rescue', 'shop.tab.push': 'Pushes', 'shop.tab.pass': 'Passes',
    'shop.have': 'You have: {n}', 'shop.owned': 'Owned', 'shop.noAds': 'This version has no ads, so the shop is closed. Earn coins in runs.',
    'shop.intro': 'Everything here is earned by watching ads: the better the prize, the more views. Progress is saved.',
    'eq.slots': 'Run slots', 'eq.slotsHint': 'in a run: 1, 2, 3 or tap', 'eq.empty': 'Empty', 'eq.tools': 'Tools', 'eq.equip': 'Equip', 'eq.remove': 'Remove',
    'eq.left': 'Left: {n}', 'eq.endless': 'Endless', 'eq.free': 'Unlock: +{n} free', 'eq.locked': 'Locked', 'eq.refill': 'Refill',
    'up.now': 'Now', 'up.next': 'Next', 'up.max': 'Maxed', 'up.maxPass': 'Maxed by pass', 'up.needTool': 'Needs {tool}', 'up.level': 'Lvl {n}/3',
    'unit.m': '{n} m', 'unit.s': '{n} s', 'unit.n': '×{n}', 'unit.mps': '{n} m/s',
    'skins.equip': 'Equip', 'skins.equipped': 'Equipped', 'skins.buy': 'Buy', 'skins.owned': 'Owned', 'skins.free': 'Free', 'skins.count': 'Collected: {a} of {b}',
    'inv.supplies': 'Supplies', 'inv.upgrades': 'Upgrades', 'inv.passes': 'Passes', 'inv.progress': 'Progress', 'inv.levels': 'Levels completed: {a} of {b}',
    'inv.skins': 'Skins: {a} of {b}', 'inv.noPasses': 'No passes yet', 'inv.goShop': 'To the shop', 'inv.goGear': 'To gear',
    'pass.x2': 'Coins ×2', 'pass.maxed': 'All maxed', 'pass.rope': 'Endless rope',
    'hud.stage': 'Stage {a}/{b}', 'threat.calm': 'Quiet', 'threat.listening': 'Listening…', 'threat.rushing': 'Rushing!', 'threat.near': 'Close!',
    'swim.title': 'Get out!', 'swim.climbKey': 'Press {key}: climb onto the platform', 'swim.climbTouch': 'Tap the button: climb onto the platform',
    'swim.find': 'Swim to the platform edge', 'swim.rope': 'The rope reaches: pick it in a slot',
    'down.title': 'You were grabbed!', 'down.sub': 'Escape before the monster drags you deeper', 'down.rescue': 'Lifebuoy ×{n}', 'down.checkpoint': 'Back to checkpoint', 'down.sec': '{n} s',
    'result.title': 'Level complete!', 'result.time': 'Time', 'result.falls': 'Falls', 'result.coins': 'Level reward', 'result.bonus': 'Collected on the way', 'result.total': 'Total',
    'result.next': 'Next', 'result.lobby': 'To lobby', 'result.doubled': 'Doubled!',
    'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.menu': 'To menu', 'pause.lobby': 'To lobby',
    'ui.credits': 'Music: Juhani Junkala, JDSherbert. Sounds: Kenney.',
    'menu.daily': 'Gift', 'menu.wheel': 'Wheel', 'menu.records': 'Records',
    'win.daily': 'Daily gift', 'win.wheel': 'Wheel of Fortune', 'win.records': 'Records',
    'cos.tab.outfit': 'Outfits', 'cos.tab.hair': 'Hair', 'cos.tab.hat': 'Hats', 'cos.tab.acc': 'Accessories', 'cos.tab.trail': 'Trails', 'cos.tab.victory': 'Victory',
    'cos.unequip': 'Take off', 'cos.exclusive': 'Daily gift', 'cos.exclusiveHint': 'Not sold anywhere: given on day 7 of the daily gift.',
    'cos.hint.outfit': 'The base look: clothes colours, hair and accessories of the outfit.', 'cos.hint.hair': 'Replaces the outfit\'s hair.',
    'cos.hint.hat': 'Replaces the outfit\'s headwear. Only short and long hair fit under a hat.', 'cos.hint.acc': 'The set replaces the outfit\'s accessories.',
    'cos.hint.trail': 'An effect behind the hero while running and swimming. Rare and better ones sparkle.', 'cos.hint.victory': 'An effect when you finish a level.',
    'daily.intro': 'Come back every day: rewards grow, and day 7 brings an exclusive outfit.', 'daily.item': 'Item', 'daily.coins': 'coins',
    'daily.got': 'Got: {what}', 'daily.allSkins': 'You already have every exclusive outfit.',
    'wheel.intro': 'Every prize is shown in advance. The result is chosen before the spin and the wheel stops exactly on it.', 'wheel.prizes': 'Prizes', 'wheel.won': 'You won: {what}',
    'daily.exclusive': 'Exclusive outfit', 'daily.exclusiveHint': 'Not sold anywhere else', 'reward.big': 'Big reward: {n} coins',
    'wheel.noSpins': 'No spins left today. Come back tomorrow!',
    'rec.best': 'My best: {n}', 'rec.empty': 'No top players yet', 'rec.signin': 'Sign in', 'rec.loading': 'Loading…',
    'key.space': 'Space',
});

/** @satisfies {Record<string, any>} */
const GameUI = {
    /** Обработчики игры (init). @type {Record<string, any>} */
    h: {},
    _inited: false,
    /** Элементы слоёв: hud menu win down result pause scare top. @type {Record<string, HTMLElement>} */
    el: {},
    /** Открытое окно ('' — нет). */
    win: '',
    /** Всё остальное состояние экранов. @type {any} */
    s: {
        shopTab: 'coins', skinSel: '', prevSkin: null, level: 1, menu: false, hud: false, runLevel: 0, runName: '', coins: -1, run: 0, sound: true,
        threat: null, hotbar: null, toastT: 0, winToastT: 0, scareT: 0, down: null, result: null, doubling: false, renderQ: 0, ticks: 0,
        cosTab: 'outfit', cosSel: {}, dailyGot: '', dailyBusy: false, sig: '', best: null, hasBoard: false, probeAt: 0, tickId: 0,
        wheel: { angle: 0, spinning: false, asking: false, result: null, go: null, resume: null, timer: 0 },
        board: { state: 'loading', rows: [], seq: 0, logging: false },
    },

    // =================================================================================================
    // Запуск
    // =================================================================================================

    init(h) {
        this.h = h || {};
        if (typeof document === 'undefined') return this;
        if (this._inited) return this;
        this._inited = true;
        this._build();
        this._bind();
        if (typeof Eco !== 'undefined') {
            Eco.on((e) => this._onEco(e));
            this.s.level = Eco.pref('level') || 1;
        }
        if (typeof Platform !== 'undefined') {
            if (typeof Platform.onRewardedCooldown === 'function') Platform.onRewardedCooldown(() => this.refreshAds());
            if (typeof Platform.onAd === 'function') Platform.onAd(() => this.refreshAds());
        }
        if (typeof HudLayout !== 'undefined') this._layout();
        this._syncCoins();
        this.setSound(true);
        this._menuBadges();
        this._probeBoard(true);
        if (typeof setInterval === 'function') this.s.tickId = setInterval(() => this._tick(), 1000);
        return this;
    },

    /** Блоки HUD: не пересекаются с экранным стиком и контекстной кнопкой движка. */
    _layout() {
        HudLayout.block('bpm-level', { dock: 'tl', w: 236, h: 58, el: '#bpm-level', order: 0 });
        HudLayout.block('bpm-coins', { dock: 'tr', w: 140, h: 40, el: '#bpm-coins', order: 0 });
        HudLayout.block('bpm-pause', { dock: 'tr', w: 48, h: 48, el: '#bpm-pausebtn', order: 1, min: 44 });
        HudLayout.block('bpm-run', { dock: 'tr', w: 84, h: 30, el: '#bpm-run', order: 2 });
        HudLayout.block('bpm-threat', { dock: 'tc', w: 232, h: 46, minW: 200, el: '#bpm-threat', order: 0 });
        HudLayout.block('bpm-swim', { dock: 'tc', w: 360, h: 78, fill: true, maxW: 520, el: '#bpm-swim', order: 1 });
        HudLayout.block('bpm-toast', { dock: 'tc', w: 340, h: 46, fill: true, maxW: 520, el: '#bpm-toast', order: 2 });
        HudLayout.block('bpm-hotbar', { dock: 'bc', w: 268, h: 62, minW: 268, el: '#bpm-hotbar', order: 0 });
        HudLayout.block('bpm-prompt', { dock: 'bc', w: 300, h: 46, el: '#bpm-prompt', order: 1 });
        // чат только там, где он не достаёт до персонажа в центре: на телефонах реплики видны пузырями над ботами
        HudLayout.block('bpm-chat', { dock: 'ml', w: 230, h: 128, el: '#bpm-chat', modes: ['wide', 'land', 'tall'], order: 2, visible: () => this._chatFits() });
    },

    /** Хватает ли ширины, чтобы чат у левого края не заходил на героя (он в центре экрана). */
    _chatFits() { return (typeof window !== 'undefined' ? window.innerWidth : 0) >= 760 && !!this.s.hud; },

    // =================================================================================================
    // Помощники
    // =================================================================================================

    t(key, p) { return Lang.t(key, p); },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); },
    /** Число с узким пробелом между тысячами. */
    num(n) { return String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
    ico(id, cls) { return GameData.icon(id, cls); },
    $(sel, root) { return /** @type {HTMLElement} */ ((root || document).querySelector(sel)); },
    $$(sel, root) { return /** @type {HTMLElement[]} */ (Array.from((root || document).querySelectorAll(sel))); },
    /** Подпись клавиши действия на ПК: из Input (текущая привязка) или запасная. */
    keyOf(action, fallback) {
        try {
            if (typeof Input !== 'undefined' && Input._inited && typeof Input.labelOf === 'function') {
                const l = Input.labelOf(action);
                if (l) return l;
            }
        } catch (e) { /* без Input */ }
        return fallback;
    },
    isTouch() { return document.documentElement.classList.contains('hl-touch'); },
    cnt(id) { const c = Eco.count(id); return c === Infinity ? '∞' : String(c); },
    /** Монетная кнопка: цена или «Нужно ещё N». */
    coinBtn(cost, act, attrs, cls) {
        const short = Eco.coins < cost;
        const label = short ? this.t('need.more', { n: this.num(cost - Eco.coins) }) : this.num(cost);
        return '<button type="button" class="bpm-btn gold ' + (cls || 'small') + '" data-act="' + act + '" ' + (attrs || '') + (short ? ' data-short="' + (cost - Eco.coins) + '"' : '') + '>' +
            this.ico('coin') + '<span>' + label + '</span></button>';
    },
    /** Кнопка «За рекламу N/M» с точками прогресса; пусто, если площадка без rewarded. */
    adBtn(offer, o) {
        if (!Eco.adSupported()) return '';
        const opt = o || {};
        const p = Eco.adProgress(offer);
        if (!p.need) return '';
        const label = this.t(opt.key || (opt.plus ? 'ad.plus' : 'ad.progress'), { n: opt.plus || 0, a: p.have, b: p.need });
        const wait = Eco.adWaitLabel();
        const off = Eco.adBusy || (typeof Platform !== 'undefined' && Platform.adActive) || wait;
        let pips = '';
        if (p.need > 1 && p.need <= 7) { pips = '<span class="pips">'; for (let i = 0; i < p.need; i++) pips += '<i' + (i < p.have ? ' class="on"' : '') + '></i>'; pips += '</span>'; }
        return '<button type="button" class="bpm-btn ad bpm-ad ' + (opt.cls || 'small') + '" data-act="ad" data-offer="' + offer + '" data-label="' + this.esc(label) + '"' + (off ? ' disabled' : '') + '>' +
            this.ico('ad') + '<span class="lbl">' + this.esc(wait || label) + '</span>' + pips + '</button>';
    },
    /** Подписи кнопок «за рекламу» по паузе между rewarded: без пересборки окон. */
    refreshAds() {
        if (!this._inited) return;
        const wait = Eco.adWaitLabel();
        const busy = Eco.adBusy || (typeof Platform !== 'undefined' && Platform.adActive);
        for (const b of this.$$('.bpm-ad')) {
            const lbl = this.$('.lbl', b);
            const base = b.dataset.label || '';
            const hardOff = b.dataset.off === '1';
            if (lbl) lbl.textContent = wait || base;
            /** @type {HTMLButtonElement} */ (b).disabled = !!(wait || busy || hardOff);
        }
    },
    /** Плавная подпись цены/награды предложения для тоста. */
    rewardText(offerId) {
        const o = GameData.adOffer(offerId);
        if (!o) return '';
        switch (o.kind) {
            case 'shop': return this.t('offer.' + o.offer.id);
            case 'refill': return '+' + o.n + ' ' + this.t('tool.' + o.tool);
            case 'unlock': return this.t('tool.' + o.tool);
            case 'up': return this.t('up.' + o.up);
            case 'level': return this.t('level.' + o.n);
            case 'skin': return this.t('skin.' + o.skin);
            case 'cos': return GameData.itemName(o.cos);
            default: return '';
        }
    },

    // =================================================================================================
    // Построение слоёв
    // =================================================================================================

    _build() {
        for (const n of this.$$('.bpm-layer')) n.remove();
        const mk = (id, cls, html) => {
            const d = document.createElement('div');
            d.id = id; d.className = 'bpm-layer' + (cls ? ' ' + cls : '');
            if (html) d.innerHTML = html;
            document.body.appendChild(d);
            this.el[id.replace('bpm-', '')] = d;
            return d;
        };
        mk('bpm-hud', '', this._hudHTML());
        mk('bpm-menu', '', this._menuHTML());
        mk('bpm-win', '', '<div class="bpm-panel"></div>');
        mk('bpm-down', 'bpm-screen', '');
        mk('bpm-result', 'bpm-screen', '');
        mk('bpm-pause', 'bpm-screen', this._pauseHTML());
        mk('bpm-scare', '', '<div class="flash"></div><div class="eye">' + this.ico('monster') + '</div>');
        mk('bpm-top', '', '<div id="bpm-toast" class="bpm-hudb bpm-plate"><span></span></div>');
        this.el.toast = this.$('#bpm-toast');
        this.el.hotbar = this.$('#bpm-hotbar');
    },

    _hudHTML() {
        let slots = '';
        for (let i = 0; i < 3; i++) {
            slots += '<button type="button" class="bpm-slot empty" id="bpm-slot-' + i + '" data-slot="' + i + '" aria-label="' + (i + 1) + '"><span class="k">' + (i + 1) + '</span><span class="ic"></span><span class="n"></span><span class="cd"></span></button>';
        }
        return '' +
            '<div id="bpm-level" class="bpm-hudb bpm-plate"><div class="r1"><span class="n">1</span><span class="nm"></span></div>' +
            '<div class="r2"><div id="bpm-progress" class="bpm-bar"><i></i><b></b></div><span class="st" id="bpm-stage"></span></div></div>' +
            '<div id="bpm-coins" class="bpm-hudb bpm-plate">' + this.ico('coin') + '<span class="v">0</span></div>' +
            '<div id="bpm-run" class="bpm-hudb bpm-plate"></div>' +
            '<button type="button" id="bpm-pausebtn" class="bpm-hudb bpm-pausebtn" data-act="pause" aria-label="' + this.esc(this.t('ui.pause')) + '">' + this.ico('pause') + '</button>' +
            '<div id="bpm-threat" class="bpm-hudb bpm-plate" data-state="calm"><span class="ic"></span><span class="txt"></span><span class="eta"></span></div>' +
            '<div id="bpm-dir"><div class="a">' + this.ico('arrow') + '</div></div>' +
            '<div id="bpm-swim" class="bpm-hudb"><div class="t bpm-stroke"></div><div class="s"></div></div>' +
            '<div id="bpm-hotbar" class="bpm-hudb">' + slots +
            '<button type="button" class="bpm-pushbtn" id="bpm-push" data-push="1" hidden aria-label="push"><span class="k">F</span><span class="ic"></span><span class="n"></span><span class="cd"></span></button></div>' +
            '<button type="button" id="bpm-prompt" class="bpm-hudb" data-act="interact"></button>' +
            '<div id="bpm-chat" class="bpm-hudb" aria-live="polite"></div>';
    },

    _menuHTML() {
        const words = String(typeof GAME_TITLE !== 'undefined' ? GAME_TITLE : 'Don\u2019t Splash').split(':')[0].trim().split(' ');   // логотип — название до двоеточия
        const l2 = words.pop() || '', l1 = words.join(' ');
        let bubbles = '';
        for (let i = 0; i < 9; i++) bubbles += '<i style="left:' + (6 + i * 11) + '%;animation-delay:' + (i * 1.1).toFixed(1) + 's;animation-duration:' + (7 + (i % 4) * 2) + 's;width:' + (9 + (i % 3) * 5) + 'px;height:' + (9 + (i % 3) * 5) + 'px"></i>';
        const quick = ['shop', 'equipment', 'upgrades', 'skins', 'inventory', 'daily', 'wheel', 'records'].map((w) =>
            '<button type="button" class="bpm-qbtn' + (w === 'daily' || w === 'wheel' ? ' hot' : '') + '" data-act="open" data-win="' + w + '"' + (w === 'records' && !this.s.hasBoard ? ' hidden' : '') + '>' +
            this.ico(w) + '<span>' + this.esc(this.t('menu.' + w)) + '</span>' + (w === 'daily' || w === 'wheel' ? '<b class="bdg" hidden></b>' : '') + '</button>').join('');
        return '' +
            '<div class="bpm-menu-bg"></div><div class="bpm-bubbles">' + bubbles + '</div>' +
            '<div class="bpm-menu-top"><div class="bpm-menu-l"><button type="button" class="bpm-round bpm-snd" data-act="sound" aria-label="' + this.esc(this.t('ui.sound')) + '"></button>' +
            '<button type="button" class="bpm-round bpm-howto-r" data-act="howto" aria-label="' + this.esc(this.t('menu.howto')) + '">' + this.ico('howto') + '</button></div>' +
            '<div class="bpm-coinpill" id="bpm-menucoins">' + this.ico('coin') + '<span>0</span></div></div>' +
            '<div class="bpm-menu-in">' +
            '<div class="bpm-logo"><div class="l1 bpm-stroke">' + this.esc(l1) + '</div><div class="l2 bpm-stroke">' + this.esc(l2) + '</div><span class="wave"></span></div>' +
            '<p class="bpm-tag bpm-soft">' + this.esc(this.t('menu.tagline')) + '</p>' +
            '<div class="bpm-menu-btns">' +
            '<button type="button" class="bpm-btn big" data-act="play" id="bpm-playbtn"><span class="col"><span>' + this.esc(this.t('menu.play')) + '</span><span class="sub" id="bpm-playsub"></span></span></button>' +
            '<button type="button" class="bpm-btn teal" data-act="lobby">' + this.ico('lobby') + '<span>' + this.esc(this.t('menu.lobby')) + '</span></button>' +
            '<div class="bpm-quick">' + quick + '</div>' +
            '<button type="button" class="bpm-btn ghost small bpm-howto-w" data-act="howto">' + this.ico('howto') + '<span>' + this.esc(this.t('menu.howto')) + '</span></button>' +
            '</div></div>';
    },

    _pauseHTML() {
        return '<div class="bpm-dialog"><h1 class="bpm-stroke">' + this.esc(this.t('pause.title')) + '</h1><div class="btns">' +
            '<button type="button" class="bpm-btn big" data-act="resume">' + this.ico('play') + '<span>' + this.esc(this.t('pause.resume')) + '</span></button>' +
            '<div class="btns row"><button type="button" class="bpm-btn teal small" data-act="howto">' + this.ico('howto') + '<span>' + this.esc(this.t('menu.howto')) + '</span></button>' +
            '<button type="button" class="bpm-btn teal small bpm-snd" data-act="sound" aria-label="' + this.esc(this.t('ui.sound')) + '"></button></div>' +
            '<div class="btns row"><button type="button" class="bpm-btn ghost small" data-act="lobby">' + this.ico('lobby') + '<span>' + this.esc(this.t('pause.lobby')) + '</span></button>' +
            '<button type="button" class="bpm-btn ghost small" data-act="menu"><span>' + this.esc(this.t('pause.menu')) + '</span></button></div>' +
            '<button type="button" class="bpm-btn teal small" data-act="open" data-win="records"' + (this.s.hasBoard ? '' : ' hidden') + '>' + this.ico('records') + '<span>' + this.esc(this.t('menu.records')) + '</span></button>' +
            '</div><p class="bpm-credits">' + this.esc(this.t('ui.credits')) + '</p></div>';
    },

    _bind() {
        this._bindLayers();
        // Esc: закрывает окно ПОСЛЕ обработчиков игры в том же событии
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Escape' || !this.win || Platform.name === 'playgama') return;
            setTimeout(() => { if (this.win) this.closeWindows(); }, 0);
        });
        window.addEventListener('lory-language', () => this._rebuild());
    },

    /** Слушатели слоёв (пересоздаются вместе со слоями при смене языка). */
    _bindLayers() {
        const click = (layer, fn) => layer.addEventListener('click', (e) => {
            const b = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (e.target)).closest('[data-act]'));
            if (b && !(/** @type {HTMLButtonElement} */ (b).disabled)) { e.stopPropagation(); fn(b.dataset.act || '', b); }
        });
        for (const k of ['hud', 'menu', 'pause', 'down', 'result', 'win']) click(this.el[k], (a, b) => this._act(a, b));
        this.el.win.addEventListener('click', (e) => { if (e.target === this.el.win) this.closeWindows(); });
        // хотбар: срабатывает по касанию сразу (pointerdown); клавиатурное нажатие кнопки приходит как click без координат
        const hb = this.el.hotbar;
        const fire = (e) => {
            const b = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (e.target)).closest('[data-slot],[data-push]'));
            if (!b || b.classList.contains('empty')) return;
            if (b.dataset.push) { if (this.h.onPush) this.h.onPush(); } else if (this.h.onSlot) this.h.onSlot(Number(b.dataset.slot));
        };
        hb.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); fire(e); });
        hb.addEventListener('click', (e) => { if (e.detail === 0) fire(e); });
        this.el.win.addEventListener('keydown', (e) => {
            if (e.code !== 'Enter' && e.code !== 'Space') return;
            const el = /** @type {HTMLElement} */ (e.target);
            if (el && el.dataset && el.dataset.act && el.tagName !== 'BUTTON') { e.preventDefault(); el.click(); }
        });
        // скины: примерка по наведению мыши
        this.el.win.addEventListener('pointerover', (e) => {
            if (this.win !== 'skins' || e.pointerType !== 'mouse') return;
            const c = /** @type {HTMLElement} */ ((/** @type {HTMLElement} */ (e.target)).closest('.bpm-skin'));
            if (c && c.dataset.id) this._previewSkin(c.dataset.id);
        });
        this.el.win.addEventListener('pointerout', (e) => {
            if (this.win !== 'skins' || e.pointerType !== 'mouse') return;
            const to = /** @type {HTMLElement} */ (e.relatedTarget);
            if (!(to && to.closest && to.closest('.bpm-skin'))) this._previewSkin(this._cosSelected(this.s.cosTab).id);
        });
        // аватар игрока в рекордах не загрузился: вместо картинки — инициалы
        this.el.win.addEventListener('error', (e) => {
            const img = /** @type {HTMLElement} */ (e.target);
            if (img && img.tagName === 'IMG' && img.parentElement && img.parentElement.classList.contains('av')) img.replaceWith(document.createTextNode(img.dataset.ini || '?'));
        }, true);
    },

    /** Смена языка: всё перестраивается, состояние возвращается. */
    _rebuild() {
        const s = this.s, win = this.win;
        const keep = { menu: s.menu, info: s.menuInfo, hud: s.hud, level: s.runLevel, name: s.runName, coins: s.coins, run: s.run, sound: s.sound, threat: s.threat };
        this.s.threat = null; this.s.hotbar = null; this.s.ticks = 0;
        this._build();
        this._bindLayers();
        this.menu(keep.menu, keep.info);
        this.hud(keep.hud);
        this.setLevel(keep.level, keep.name);
        this.setCoins(keep.coins);
        this.setRunCoins(keep.run);
        this.setSound(keep.sound);
        if (keep.threat && keep.threat.state) this.setThreat({ state: keep.threat.state, eta: keep.threat.eta, dir: undefined });
        if (typeof HudLayout !== 'undefined') HudLayout.schedule();
        if (win) { this.win = ''; this.openWindow(win, this.s.winOpts); }
    },

    // =================================================================================================
    // Действия кнопок
    // =================================================================================================

    _act(act, b) {
        const h = this.h;
        const d = b.dataset;
        switch (act) {
            case 'play': if (h.onPlay) h.onPlay(); break;
            case 'lobby': if (h.onLobby) h.onLobby(); break;
            case 'howto': if (h.onHowTo) h.onHowTo(); break;
            case 'sound': if (h.onSound) h.onSound(); break;
            case 'pause': if (h.onPause) h.onPause(); break;
            case 'resume': if (h.onResume) h.onResume(); break;
            case 'menu': if (h.onMenu) h.onMenu(); break;
            case 'interact': if (h.onInteract) h.onInteract(); break;
            case 'open': this.openWindow(d.win || ''); break;
            case 'close': this.closeWindows(); break;
            case 'rescue-item': if (h.onRescue) h.onRescue('item'); break;
            case 'rescue-ad': if (h.onRescue) h.onRescue('ad'); break;
            case 'checkpoint': if (h.onCheckpoint) h.onCheckpoint(); break;
            case 'next': if (h.onNext) h.onNext(); break;
            case 'result-lobby': if (h.onLobby) h.onLobby(); break;
            case 'double': this._double(b); break;
            case 'ad': this._watch(d.offer || ''); break;
            case 'tab': this.s.shopTab = d.tab || 'coins'; this._renderWin(); this._scrollTop(); break;
            // косметика
            case 'cos-tab': this.s.cosTab = GameData.COSMETIC_TABS.includes(d.tab) ? d.tab : 'outfit'; this._previewSkin(this._cosSelected(this.s.cosTab).id); this._renderWin(); this._scrollTop(); break;
            case 'cos-sel': this._selectItem(d.id || ''); break;
            case 'cos-buy': this._buy(Eco.buyItem(d.id || ''), () => { this._equipItem(d.id || ''); return this.t('toast.bought', { what: GameData.itemName(d.id || '') }); }); break;
            case 'cos-equip': this._equipItem(d.id || ''); break;
            case 'cos-unequip': this._unequipSlot(d.slot || ''); break;
            // подарок, колесо, рекорды
            case 'daily-claim': this._dailyDone(DailyGift.claim()); break;
            case 'daily-x2': this._dailyX2(); break;
            case 'wheel-free': this._wheelSpin('free'); break;
            case 'wheel-ad': this._wheelSpin('ad'); break;
            case 'rec-login': this._login(); break;
            // снаряжение
            case 'equip': this._res(Eco.equip(d.tool || ''), 'toast.slotsFull'); break;
            case 'unequip': this._res(Eco.unequip(Number(d.i))); break;
            case 'unequip-tool': this._res(Eco.unequip(d.tool || '')); break;
            case 'unlock-coins': this._buy(Eco.buyUnlock(d.tool || ''), () => this.t('toast.unlocked', { what: this.t('tool.' + d.tool) })); break;
            case 'refill': this._buy(Eco.buyRefill(d.tool || '', Number(d.idx)), () => this.t('toast.bought', { what: '+' + d.n + ' ' + this.t('tool.' + d.tool) })); break;
            // улучшения
            case 'up-coins': this._buy(Eco.buyUpgrade(d.id || ''), () => this.t('toast.upgraded', { what: this.t('up.' + d.id), n: Eco.upLevel(d.id || '') })); break;
            // новый забег
            case 'level-sel': this.s.level = Number(d.n) || 1; Eco.setPref('level', this.s.level); this._renderWin(); break;
            case 'step': this._step(d.k || '', Number(d.d)); break;
            case 'start': this._start(); break;
            default: break;
        }
    },

    _scrollTop() { const b = this.$('#bpm-win .bpm-body'); if (b) b.scrollTop = 0; },

    /** Итог покупки за монеты: тост успеха или причины. okText — строка или функция. */
    _buy(r, okText) {
        if (r && r.ok) { this.toast(typeof okText === 'function' ? okText() : okText, 1800); return true; }
        this._res(r);
        return false;
    },
    /** Результат действия -> тост при неудаче. */
    _res(r, fullKey) {
        if (!r || r.ok) return;
        if (r.reason === 'noCoins') this.toast(this.t('toast.noCoins', { n: this.num(r.missing || 0) }), 1800);
        else if (r.reason === 'full' && fullKey) this.toast(this.t(fullKey), 2200);
    },

    async _watch(offerId) {
        if (!offerId) return;
        const r = await Eco.watchAd(offerId);
        if (r.ok && r.done) {
            const o = GameData.adOffer(offerId);
            const what = this.rewardText(offerId);
            let msg = this.t('toast.got', { what });
            if (o && o.kind === 'unlock') msg = this.t('toast.unlocked', { what });
            else if (o && o.kind === 'up') msg = this.t('toast.upgraded', { what, n: Eco.upLevel(o.up) });
            else if (o && o.kind === 'level') msg = this.t('toast.level', { n: o.n });
            else if (o && o.kind === 'skin') msg = this.t('toast.skin', { what });
            else if (o && o.kind === 'cos') msg = this.t('toast.got', { what });
            else if (o && o.kind === 'shop' && o.offer.give.pass) msg = this.t('toast.pass', { what });
            this.toast(msg, 2600);
            if (o && o.kind === 'skin') this._equipItem(o.skin);
            if (o && o.kind === 'cos') this._equipItem(o.cos);
        } else if (r.ok) {
            this.toast(this.t('toast.adLeft', { n: r.need - r.have }), 2200);
        } else if (r.reason === 'failed') {
            this.toast(this.t('toast.adFail'), 2600);
        } else if (r.reason === 'cooldown') {
            this.toast(Eco.adWaitLabel() || this.t('toast.adFail'), 1500);
        }
        this.refreshAds();
    },

    // =================================================================================================
    // Eco -> экраны
    // =================================================================================================

    _onEco(e) {
        if (e.type === 'coins' || e.type === 'init') this._syncCoins();
        if (e.type === 'adstart' || e.type === 'adend') this.refreshAds();
        if (this.s.menu) { this._menuLevel(); if (e.type === 'daily' || e.type === 'wheel' || e.type === 'init') this._menuBadges(); }
        if (this.win && e.type !== 'adstart' && e.type !== 'adend' && e.type !== 'use') this._queueRender();
    },

    _queueRender() {
        if (this.s.renderQ) return;
        const run = () => { this.s.renderQ = 0; if (this.win === 'wheel' && this.s.wheel.spinning) { this._syncCoins(); return; } this._renderWin(); };
        this.s.renderQ = 1;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else run();
    },

    _syncCoins() {
        if (typeof Eco === 'undefined') return;
        this.setCoins(Eco.coins);
        const mc = this.$('#bpm-menucoins span');
        if (mc) mc.textContent = this.num(Eco.coins);
        const wc = this.$('#bpm-wincoins span');
        if (wc) wc.textContent = this.num(Eco.coins);
    },

    // =================================================================================================
    // Меню
    // =================================================================================================

    menu(on, info) {
        if (!this._inited) return;
        this.s.menu = !!on;
        this.s.menuInfo = info || null;
        this.el.menu.classList.toggle('on', !!on);
        if (on) {
            this._menuLevel(); this._syncCoins(); this._menuBadges(); this._probeBoard(false);
            const rec = Eco.takeRecoveredPrize();
            if (rec) this.toast(this.t('wheel.won', { what: rec.label }), 3600);
        }
    },

    _menuLevel() {
        const i = this.s.menuInfo || {};
        const n = i.level || Eco.currentLevel();
        const name = i.levelName || GameData.levelName(n);
        const sub = this.$('#bpm-playsub');
        if (sub) sub.textContent = this.t('menu.level', { n, name });
        const mc = this.$('#bpm-menucoins span');
        if (mc) mc.textContent = this.num(Eco.coins);
    },

    // =================================================================================================
    // HUD
    // =================================================================================================

    hud(on) {
        if (!this._inited) return;
        this.s.hud = !!on;
        this.el.hud.classList.toggle('on', !!on);
        if (typeof HudLayout !== 'undefined') HudLayout.schedule();
    },

    setLevel(n, name) {
        if (!this._inited) return;
        this.s.runLevel = n | 0; this.s.runName = name || '';
        const has = (n | 0) > 0 || !!name;
        this.el.hud.classList.toggle('has-level', has);
        this.el.hud.classList.toggle('no-lvl-n', (n | 0) <= 0);
        const nn = this.$('#bpm-level .n'), nm = this.$('#bpm-level .nm');
        if (nn) nn.textContent = String(n | 0);
        if (nm) nm.textContent = name || (n > 0 ? GameData.levelName(n) : '');
    },

    setProgress(f, stage, total) {
        if (!this._inited) return;
        const fill = this.$('#bpm-progress > i');
        const frac = Math.max(0, Math.min(1, Number(f) || 0));
        if (fill) fill.style.width = (frac * 100).toFixed(1) + '%';
        const st = this.$('#bpm-stage');
        const tot = total | 0;
        if (st) st.textContent = tot > 0 ? Math.max(0, stage | 0) + '/' + tot : '';
        if (tot !== this.s.ticks) {
            this.s.ticks = tot;
            let u = '';
            for (let i = 1; i < tot; i++) u += '<u style="left:' + ((i / tot) * 100).toFixed(2) + '%"></u>';
            const b = this.$('#bpm-progress > b');
            if (b) b.innerHTML = u;
        }
        const ticks = this.$$('#bpm-progress > b u');
        for (let i = 0; i < ticks.length; i++) ticks[i].classList.toggle('done', (i + 1) / Math.max(1, tot) <= frac + 1e-6);
    },

    setCoins(n) {
        if (!this._inited) return;
        const v = Math.floor(Number(n) || 0);
        const el = this.$('#bpm-coins .v');
        if (el) el.textContent = this.num(v);
        if (this.s.coins >= 0 && v > this.s.coins) {
            const box = this.$('#bpm-coins');
            if (box) { box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); }
        }
        this.s.coins = v;
    },

    setRunCoins(n) {
        if (!this._inited) return;
        this.s.run = Math.floor(Number(n) || 0);
        const el = this.$('#bpm-run');
        if (el) {
            el.textContent = this.s.run > 0 ? '+' + this.num(this.s.run) : '';
            el.classList.toggle('on', this.s.run > 0);
        }
    },

    /** items: 3 слота { id|null, count, cooldown 0..1, active } + толчок { id: 'push'|'superpush', count, cooldown }. */
    setHotbar(items) {
        if (!this._inited) return;
        const list = Array.isArray(items) ? items : [];
        const isPush = (it) => !!it && (it.id === 'push' || it.id === 'superpush');
        const push = list.find(isPush) || null;
        const slots = list.filter((it) => !isPush(it)).slice(0, 3);
        const cache = this.s.hotbar || (this.s.hotbar = { slots: [{}, {}, {}], push: {} });
        const apply = (el, c, it, kind) => {
            const id = it && it.id ? it.id : '';
            const count = it && it.count != null ? it.count : 0;
            const cd = it ? Math.round(Math.max(0, Math.min(1, Number(it.cooldown) || 0)) * 100) / 100 : 0;
            const active = !!(it && it.active);
            if (c.id !== id) { this.$('.ic', el).innerHTML = id ? this.ico(id) : ''; c.id = id; el.classList.toggle('empty', !id); el.setAttribute('aria-label', id ? this.t('tool.' + id) : ''); }
            if (c.count !== count) {
                c.count = count;
                this.$('.n', el).textContent = !id ? '' : count === Infinity ? '∞' : String(count);
                el.classList.toggle('zero', !!id && count === 0);
            }
            if (c.cd !== cd) { c.cd = cd; el.style.setProperty('--cd', String(cd)); }
            if (kind === 'slot' && c.active !== active) { c.active = active; el.classList.toggle('active', active); }
        };
        for (let i = 0; i < 3; i++) apply(this.$('#bpm-slot-' + i), cache.slots[i], slots[i], 'slot');
        const pe = this.$('#bpm-push');
        const showPush = !!push && (push.count === Infinity || push.count > 0);
        pe.hidden = !showPush;
        if (showPush) apply(pe, cache.push, push, 'push');
        this.el.hud.classList.add('has-hotbar');
    },

    /** state: calm | listening | rushing | near; eta — секунды; dir — угол на экране (рад, 0 — вверх). */
    setThreat(o) {
        if (!this._inited) return;
        const th = o || {};
        const state = ['calm', 'listening', 'rushing', 'near'].includes(th.state) ? th.state : '';
        const hud = this.el.hud;
        hud.classList.toggle('has-threat', !!state);
        if (!state) { hud.classList.remove('dir'); this.s.threat = null; return; }
        const eta = state === 'rushing' && th.eta != null && isFinite(th.eta) ? Math.max(0, Math.ceil(th.eta)) : -1;
        const showDir = (state === 'rushing' || state === 'near') && typeof th.dir === 'number' && isFinite(th.dir);
        const c = this.s.threat || (this.s.threat = {});
        const box = this.$('#bpm-threat');
        if (c.state !== state) {
            c.state = state;
            box.dataset.state = state;
            this.$('.ic', box).innerHTML = this.ico(state);
            this.$('.txt', box).textContent = this.t('threat.' + state);
        }
        if (c.eta !== eta) { c.eta = eta; this.$('.eta', box).textContent = eta >= 0 ? this.t('down.sec', { n: eta }) : ''; }
        if (c.dirOn !== showDir) { c.dirOn = showDir; hud.classList.toggle('dir', showDir); }
        if (showDir) {
            const deg = Math.round((th.dir * 180 / Math.PI) * 2) / 2;
            if (c.deg !== deg) {
                c.deg = deg;
                const d = this.$('#bpm-dir');
                const m = Math.min(window.innerWidth, window.innerHeight);
                d.style.setProperty('--ang', deg + 'deg');
                d.style.setProperty('--dr', Math.max(70, Math.min(190, m * 0.24)).toFixed(0) + 'px');
                d.style.setProperty('--da', Math.max(40, Math.min(72, m * 0.1)).toFixed(0) + 'px');
            }
        }
    },

    swim(on, o) {
        if (!this._inited) return;
        const el = this.$('#bpm-swim');
        const opt = o || {};
        el.classList.toggle('on', !!on);
        if (!on) return;
        const can = !!opt.canClimb;
        el.classList.toggle('can', can);
        this.$('.t', el).textContent = this.t('swim.title');
        let hint;
        if (can) hint = this.isTouch() ? this.t('swim.climbTouch') : this.t('swim.climbKey', { key: this.keyOf('jump', this.t('key.space')) });
        else hint = opt.canRope ? this.t('swim.rope') : this.t('swim.find');
        const s = this.$('.s', el);
        if (s.textContent !== hint) s.textContent = hint;
    },

    prompt(text) {
        if (!this._inited) return;
        const el = this.$('#bpm-prompt');
        const on = text != null && text !== '';
        el.classList.toggle('on', on);
        if (on && el.textContent !== text) el.textContent = text;
    },

    toast(text, ms) {
        if (!this._inited || text == null || text === '') return;
        const dur = ms > 0 ? ms : 2200;
        if (this.win) {
            const w = this.$('#bpm-win .bpm-win-toast');
            if (!w) return;
            w.textContent = text;
            w.classList.add('show');
            clearTimeout(this.s.winToastT);
            this.s.winToastT = setTimeout(() => w.classList.remove('show'), dur);
            return;
        }
        const el = this.el.toast;
        this.$('span', el).textContent = text;
        el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
        clearTimeout(this.s.toastT);
        this.s.toastT = setTimeout(() => el.classList.remove('on'), dur);
        if (typeof HudLayout !== 'undefined') HudLayout.schedule();
    },

    /** Реплика в чат: name — имя (цветом), '' — системная строка. Живёт ~8 с. */
    chat(name, text, color) {
        if (!this._inited) return;
        const box = this.$('#bpm-chat');
        const row = document.createElement('div');
        row.className = name ? 'row' : 'row sys';
        if (name) { const b = document.createElement('b'); b.style.color = color || '#ffd23f'; b.textContent = name + ':'; row.appendChild(b); }
        const t = document.createElement('span');
        t.textContent = text == null ? '' : String(text);
        row.appendChild(t);
        box.appendChild(row);
        while (box.children.length > 5) box.removeChild(/** @type {Node} */ (box.firstChild));
        setTimeout(() => { if (row.parentNode) row.parentNode.removeChild(row); }, 8000);
    },

    setSound(on) {
        this.s.sound = !!on;
        if (!this._inited) return;
        // круглая кнопка меню — только значок; «пилюля» на паузе — значок и подпись «Звук: вкл / выкл»
        for (const b of this.$$('.bpm-snd')) {
            b.innerHTML = this.ico(on ? 'sound' : 'mute') + (b.classList.contains('bpm-btn') ? '<span>' + this.esc(this.t(on ? 'ui.soundOn' : 'ui.soundOff')) + '</span>' : '');
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
    },

    pause(on) {
        if (!this._inited) return;
        this.el.pause.classList.toggle('on', !!on);
    },

    jumpscare(on) {
        if (!this._inited) return;
        const el = this.el.scare;
        clearTimeout(this.s.scareT);
        if (!on) { el.classList.remove('on'); document.body.classList.remove('bpm-shake'); return; }
        el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
        document.body.classList.remove('bpm-shake'); void document.body.offsetWidth; document.body.classList.add('bpm-shake');
        this.s.scareT = setTimeout(() => { el.classList.remove('on'); document.body.classList.remove('bpm-shake'); }, 900);
    },

    // =================================================================================================
    // «Тебя схватили!»
    // =================================================================================================

    down(open, o) {
        if (!this._inited) return;
        const el = this.el.down;
        if (!open) { el.classList.remove('on'); this.s.down = null; return; }
        const d = o || {};
        let st = this.s.down;
        if (!st) {
            el.innerHTML = '<div class="bpm-dialog danger"><h1 class="bpm-stroke shake">' + this.esc(this.t('down.title')) + '</h1>' +
                '<p class="sub">' + this.esc(this.t('down.sub')) + '</p><div class="bpm-timer"><i></i><span></span></div><div class="btns">' +
                '<button type="button" class="bpm-btn rescue big" data-act="rescue-item" id="bpm-dn-item">' + this.ico('rescue') + '<span id="bpm-dn-itemtx"></span></button>' +
                (Eco.adSupported() ? '<button type="button" class="bpm-btn ad bpm-ad" data-act="rescue-ad" id="bpm-dn-ad" data-label="' + this.esc(this.t('ad.rescue')) + '">' + this.ico('ad') + '<span class="lbl">' + this.esc(this.t('ad.rescue')) + '</span></button>' : '') +
                '<button type="button" class="bpm-btn ghost" data-act="checkpoint">' + this.ico('flag') + '<span>' + this.esc(this.t('down.checkpoint')) + '</span></button></div></div>';
            st = this.s.down = { rescues: -1, sec: -1 };
            el.classList.add('on');
            this.refreshAds();
        }
        const total = Math.max(0.001, Number(d.total) || 1);
        const left = Math.max(0, Math.min(total, Number(d.timeLeft) || 0));
        const bar = this.$('.bpm-timer > i', el);
        bar.style.width = (left / total * 100).toFixed(1) + '%';
        bar.classList.toggle('low', left / total < 0.3);
        const sec = Math.ceil(left);
        if (st.sec !== sec) { st.sec = sec; this.$('.bpm-timer > span', el).textContent = this.t('down.sec', { n: sec }); }
        // «Спастись за рекламу»: игра разрешает один раз за забег — adRescue === false прячет кнопку (по умолчанию показана)
        const adBtnEl = this.$('#bpm-dn-ad', el);
        if (adBtnEl) adBtnEl.hidden = d.adRescue === false;
        const r = Math.max(0, d.rescues | 0);
        if (st.rescues !== r) {
            st.rescues = r;
            const item = this.$('#bpm-dn-item', el);
            item.hidden = r <= 0;
            this.$('#bpm-dn-itemtx', el).textContent = this.t('down.rescue', { n: r });
        }
    },

    // =================================================================================================
    // Результат
    // =================================================================================================

    result(open, d) {
        if (!this._inited) return;
        const el = this.el.result;
        if (!open) { el.classList.remove('on'); this.s.result = null; return; }
        this.s.result = Object.assign({ level: 0, name: '', time: 0, coins: 0, bonus: 0, falls: 0, next: false }, d || {}, { doubled: false });
        this._renderResult();
        el.classList.add('on');
    },

    _fmtTime(sec) {
        const s = Math.max(0, Number(sec) || 0), m = Math.floor(s / 60);
        return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0');
    },

    _renderResult() {
        const r = this.s.result;
        if (!r) return;
        const all = Math.max(0, r.coins | 0);                         // всего начислено
        const extra = Math.max(0, Math.min(all, r.bonus | 0));        // из них собрано по пути
        const total = r.doubled ? all * 2 : all;
        const stars = r.falls <= 0 ? 3 : r.falls <= 2 ? 2 : 1;
        let st = '';
        for (let i = 0; i < 3; i++) st += this.ico('star', i < stars ? '' : 'dim');
        const canDouble = !r.doubled && !!this.h.onDouble && Eco.adSupported() && all > 0;
        this.el.result.innerHTML = '<div class="bpm-dialog"><div class="bpm-stars">' + st + '</div>' +
            '<h1 class="bpm-stroke">' + this.esc(this.t('result.title')) + '</h1>' +
            (r.level ? '<p class="sub">' + this.esc(this.t('menu.level', { n: r.level, name: r.name || GameData.levelName(r.level) })) + '</p>' : '') +
            '<div class="bpm-stats">' +
            '<div class="bpm-stat">' + this.ico('clock') + '<span>' + this.esc(this.t('result.time')) + '</span><b>' + this._fmtTime(r.time) + '</b></div>' +
            '<div class="bpm-stat">' + this.ico('rescue') + '<span>' + this.esc(this.t('result.falls')) + '</span><b>' + (r.falls | 0) + '</b></div>' +
            '<div class="bpm-stat">' + this.ico('coin') + '<span>' + this.esc(this.t('result.coins')) + '</span><b>+' + this.num(all - extra) + '</b></div>' +
            (extra ? '<div class="bpm-stat">' + this.ico('coinpile') + '<span>' + this.esc(this.t('result.bonus')) + '</span><b>+' + this.num(extra) + '</b></div>' : '') +
            '<div class="bpm-stat total' + (r.doubled ? ' x2' : '') + '">' + this.ico('coinpile') + '<span>' + this.esc(r.doubled ? this.t('result.doubled') : this.t('result.total')) + '</span><b>+' + this.num(total) + '</b></div></div>' +
            '<div class="btns">' +
            (canDouble ? '<button type="button" class="bpm-btn ad bpm-ad" data-act="double" data-label="' + this.esc(this.t('ad.double')) + '">' + this.ico('ad') + '<span class="lbl">' + this.esc(this.t('ad.double')) + '</span></button>' : '') +
            '<div class="btns row">' + (r.next ? '<button type="button" class="bpm-btn big" data-act="next">' + this.ico('play') + '<span>' + this.esc(this.t('result.next')) + '</span></button>' : '') +
            '<button type="button" class="bpm-btn teal' + (r.next ? ' small' : ' big') + '" data-act="result-lobby">' + this.ico('lobby') + '<span>' + this.esc(this.t('result.lobby')) + '</span></button>' +
            '<button type="button" class="bpm-btn teal small" data-act="open" data-win="records"' + (this.s.hasBoard ? '' : ' hidden') + '>' + this.ico('records') + '<span>' + this.esc(this.t('menu.records')) + '</span></button></div></div></div>';
        this.refreshAds();
    },

    async _double(btn) {
        const r = this.s.result;
        if (!r || this.s.doubling || !this.h.onDouble) return;
        this.s.doubling = true;
        /** @type {HTMLButtonElement} */ (btn).disabled = true;
        let ok = false;
        try { ok = (await this.h.onDouble()) === true; } catch (e) { ok = false; }
        this.s.doubling = false;
        if (!this.s.result) return;
        if (ok) { this.s.result.doubled = true; this._renderResult(); } else { this.refreshAds(); this.toast(this.t('toast.adFail'), 2400); }
    },

    // =================================================================================================
    // Окна
    // =================================================================================================

    isOpen() { return !!this.win; },

    openWindow(id, opts) {
        if (!this._inited) return;
        if (!['create', 'shop', 'equipment', 'upgrades', 'skins', 'inventory', 'daily', 'wheel', 'records'].includes(id)) return;
        const o = opts || {};
        const leaving = this.win === 'skins' && id !== 'skins';
        const was = this.win;
        this.win = id;
        this.s.winOpts = o;
        if (id === 'shop') this.s.shopTab = GameData.SHOP_TABS.includes(o.tab) ? o.tab : (this.s.shopTab || 'coins');
        if (id === 'create') {
            if (o.bots != null) Eco.setPref('bots', o.bots);
            if (o.monsters != null) Eco.setPref('monsters', o.monsters);
            this.s.level = Math.max(1, Math.min(GameData.LEVELS.length, (o.level | 0) || Eco.pref('level') || Eco.currentLevel()));
            if (!o.level && Eco.levelUnlocked(Eco.currentLevel())) this.s.level = Eco.currentLevel();
        }
        if (id === 'skins') {
            const it = GameData.item(o.id);
            this.s.cosTab = it ? it.tab : GameData.COSMETIC_TABS.includes(o.tab) ? o.tab : (this.s.cosTab || 'outfit');
            if (it) this.s.cosSel[it.tab] = it.id;
            this.s.prevSkin = undefined;
        }
        if (id === 'daily') this.s.dailyGot = '';
        if (id === 'wheel') this._wheelOpen();
        if (id === 'records') { this.s.board.rows = []; this.s.board.state = 'loading'; this._loadBoard(); }
        if (leaving) this._previewSkin(null);
        const w = this.el.win;
        w.classList.add('on');
        if (!was) { w.classList.remove('pop'); void w.offsetWidth; w.classList.add('pop'); }
        document.body.classList.add('bpm-win-open');
        this._renderWin();
        this._scrollTop();
        this._syncCoins();
        if (id === 'skins') this._previewSkin(this._cosSelected(this.s.cosTab).id);
        if (this.h.onOpen) this.h.onOpen(id);
    },

    closeWindows() {
        if (!this.win) return;
        const was = this.win;
        this.win = '';
        this.el.win.classList.remove('on', 'pop');
        document.body.classList.remove('bpm-win-open');
        if (was === 'skins') this._previewSkin(null);
        if (this.h.onClose) this.h.onClose();
    },

    _renderWin() {
        const id = this.win;
        if (!id) return;
        const panel = this.$('#bpm-win .bpm-panel');
        const body = this.$('.bpm-body', panel);
        const keep = body ? body.scrollTop : 0;
        const tabsEl = this.$('.bpm-tabs', panel);
        const keepX = tabsEl ? tabsEl.scrollLeft : 0;
        const icon = { create: 'play', shop: 'shop', equipment: 'equipment', upgrades: 'upgrades', skins: 'skins', inventory: 'inventory', daily: 'daily', wheel: 'wheel', records: 'records' }[id];
        const content = {
            create: () => this._winCreate(), shop: () => this._winShop(), equipment: () => this._winEquipment(),
            upgrades: () => this._winUpgrades(), skins: () => this._winSkins(), inventory: () => this._winInventory(),
            daily: () => this._winDaily(), wheel: () => this._winWheel(), records: () => this._winRecords(),
        }[id]();
        panel.innerHTML = '<header class="bpm-head"><h2 class="bpm-title bpm-stroke">' + this.ico(icon) + '<span>' + this.esc(this.t('win.' + id)) + '</span></h2>' +
            '<div class="bpm-coinpill" id="bpm-wincoins">' + this.ico('coin') + '<span>' + this.num(Eco.coins) + '</span></div>' +
            '<button type="button" class="bpm-round red bpm-x" data-act="close" aria-label="' + this.esc(this.t('ui.close')) + '">' + this.ico('close') + '</button></header>' +
            (id === 'shop' ? this._shopTabs() : id === 'skins' ? this._cosTabs() : '') +
            '<div class="bpm-body">' + content.body + '</div>' + (content.foot ? '<div class="bpm-foot">' + content.foot + '</div>' : '') + '<div class="bpm-win-toast"></div>';
        const nb = this.$('.bpm-body', panel);
        if (nb) nb.scrollTop = keep;
        const nt = this.$('.bpm-tabs', panel);
        if (nt) nt.scrollLeft = keepX;
        this.s.sig = this._sysSig();
        this.refreshAds();
        if (id === 'wheel') this._wheelKick();
    },

    // --- Магазин ---------------------------------------------------------------------------------------

    _shopTabs() {
        return '<div class="bpm-tabs">' + GameData.SHOP_TABS.map((k) =>
            '<button type="button" class="bpm-tab' + (k === this.s.shopTab ? ' on' : '') + '" data-act="tab" data-tab="' + k + '">' + this.esc(this.t('shop.tab.' + k)) + '</button>').join('') + '</div>';
    },

    _winShop() {
        const tab = this.s.shopTab;
        if (!Eco.adSupported()) return { body: '<p class="bpm-note">' + this.esc(this.t('shop.noAds')) + '</p>' };
        let h = '<p class="bpm-note">' + this.esc(this.t('shop.intro')) + '</p><div class="bpm-grid">';
        for (const o of GameData.OFFERS) if (o.tab === tab) h += this._offerCard(o);
        return { body: h + '</div>' };
    },

    _offerCard(o) {
        const id = 'shop:' + o.id;
        const owned = Eco.adBlock(id) === 'owned';
        const special = o.tab === 'pass' || o.id === 'starter';
        let have = '';
        if (o.give.items && !o.give.pass) {
            const first = Object.keys(o.give.items)[0];
            if (Object.keys(o.give.items).length === 1) have = '<div class="have"><span class="bpm-chip">' + this.esc(this.t('shop.have', { n: this.cnt(first) })) + '</span></div>';
        }
        return '<div class="bpm-card' + (special ? ' special' : '') + (owned ? ' owned' : '') + '">' +
            '<div class="bpm-card-top"><div class="bpm-card-ico">' + this.ico(o.icon) + '</div><div class="bpm-card-txt"><h3>' + this.esc(this.t('offer.' + o.id)) + '</h3><p>' +
            this.esc(this.t('offer.' + o.id + '.d')) + '</p></div></div>' + have +
            '<div class="bpm-card-foot">' + (owned ? '<span class="bpm-chip ok">' + this.ico('check') + this.esc(this.t('shop.owned')) + '</span>' : this.adBtn(id, { cls: 'small block' })) + '</div></div>';
    },

    // --- Снаряжение ------------------------------------------------------------------------------------

    _winEquipment() {
        const lo = Eco.loadout;
        let h = '<section><h2 class="bpm-h2">' + this.esc(this.t('eq.slots')) + ' <small>' + this.esc(this.t('eq.slotsHint')) + '</small></h2><div class="bpm-loadout">';
        for (let i = 0; i < GameData.MAX_SLOTS; i++) {
            const id = lo[i];
            if (!id) h += '<div class="bpm-lslot empty"><span class="no">' + (i + 1) + '</span>' + this.esc(this.t('eq.empty')) + '</div>';
            else {
                h += '<div class="bpm-lslot"><span class="no">' + (i + 1) + '</span>' + this.ico(id) + '<div class="tx"><b>' + this.esc(this.t('tool.' + id)) + '</b><span>×' + this.cnt(id) + '</span></div>' +
                    '<button type="button" class="bpm-round red rm" data-act="unequip" data-i="' + i + '" aria-label="' + this.esc(this.t('eq.remove')) + '">' + this.ico('close') + '</button></div>';
            }
        }
        h += '</div></section><section><h2 class="bpm-h2">' + this.esc(this.t('eq.tools')) + '</h2><div class="bpm-grid">';
        for (const tool of GameData.TOOLS) h += this._toolCard(tool);
        return { body: h + '</div></section>' };
    },

    _toolCard(tool) {
        const id = tool.id, open = Eco.toolUnlocked(id);
        const inSlot = Eco.loadout.includes(id);
        let info, foot = '';
        if (!open) {
            info = '<span class="bpm-chip">' + this.ico('lock') + this.esc(this.t('eq.locked')) + '</span> <span class="bpm-chip gold">' + this.esc(this.t('eq.free', { n: GameData.UNLOCK_USES })) + '</span>';
            foot = this.coinBtn(tool.unlock.coins, 'unlock-coins', 'data-tool="' + id + '"', 'small') + this.adBtn('unlock:' + id, { cls: 'small' });
        } else {
            info = '<span class="bpm-chip' + (Eco.count(id) === 0 ? '' : ' ok') + '">' + this.esc(Eco.infinite(id) ? this.t('eq.endless') : this.t('eq.left', { n: this.cnt(id) })) + '</span>';
            foot = inSlot
                ? '<button type="button" class="bpm-btn ghost small block" data-act="unequip-tool" data-tool="' + id + '">' + this.esc(this.t('eq.remove')) + '</button>'
                : '<button type="button" class="bpm-btn teal small block" data-act="equip" data-tool="' + id + '">' + this.esc(this.t('eq.equip')) + '</button>';
            if (!Eco.infinite(id)) {
                const rf = GameData.coinRefills(id);
                foot += '<div class="bpm-refills">';
                rf.forEach((r, i) => {
                    const short = Eco.coins < r.coins;
                    foot += '<button type="button" class="bpm-btn gold tiny" data-act="refill" data-tool="' + id + '" data-idx="' + i + '" data-n="' + r.n + '"' + (short ? ' data-short="1"' : '') + '>+' + r.n + this.ico('coin') + '<span>' + this.num(r.coins) + '</span></button>';
                });
                const ar = GameData.adRefill(id);
                if (ar) foot += this.adBtn('refill:' + id, { plus: ar.n, cls: 'tiny' });
                foot += '</div>';
            }
        }
        return '<div class="bpm-card' + (open ? '' : ' locked') + '"><div class="bpm-card-top"><div class="bpm-card-ico">' + this.ico(id) + '</div><div class="bpm-card-txt"><h3>' + this.esc(this.t('tool.' + id)) + '</h3><p>' +
            this.esc(this.t('tool.' + id + '.d')) + '</p></div></div><div class="have">' + info + '</div><div class="bpm-card-foot">' + foot + '</div></div>';
    },

    // --- Улучшения -------------------------------------------------------------------------------------

    _val(u, level) { return this.t('unit.' + u.unit, { n: GameData.upShown(u.id, level) }); },

    _winUpgrades() {
        let h = '<div class="bpm-grid">';
        for (const u of GameData.UPGRADES) h += this._upCard(u);
        return { body: h + '</div>' };
    },

    _upCard(u) {
        const lvl = Eco.upLevel(u.id), max = lvl >= 3, block = Eco.upBlock(u.id);
        let pips = '<div class="bpm-pipsrow">';
        for (let i = 0; i < 3; i++) pips += '<i' + (i < lvl ? ' class="on"' : '') + '></i>';
        pips += '</div>';
        const nn = '<div class="bpm-nownext"><span><small>' + this.esc(this.t('up.now')) + '</small><b>' + this.esc(this._val(u, lvl)) + '</b></span>' +
            (max ? '' : '<i>→</i><span><small>' + this.esc(this.t('up.next')) + '</small><b>' + this.esc(this._val(u, lvl + 1)) + '</b></span>') + '</div>';
        let foot;
        if (max) foot = '<div class="bpm-need max block">' + this.ico('check') + '<span>' + this.esc(Eco.hasPass('maxed') ? this.t('up.maxPass') : this.t('up.max')) + '</span></div>';
        else if (block === 'needTool') foot = '<div class="bpm-need">' + this.ico('lock') + '<span>' + this.esc(this.t('up.needTool', { tool: this.t('tool.' + u.need) })) + '</span></div>';
        else foot = this.coinBtn(Eco.upCost(u.id), 'up-coins', 'data-id="' + u.id + '"', 'small') + this.adBtn('up:' + u.id + ':' + (lvl + 1), { cls: 'small' });
        return '<div class="bpm-card' + (max ? ' owned' : '') + (block === 'needTool' ? ' locked' : '') + '"><div class="bpm-card-top"><div class="bpm-card-ico">' + this.ico(u.id) + '</div>' +
            '<div class="bpm-card-txt"><h3>' + this.esc(this.t('up.' + u.id)) + '</h3><p>' + this.esc(this.t('up.' + u.id + '.d')) + '</p></div></div>' + pips + nn + '<div class="bpm-card-foot">' + foot + '</div></div>';
    },

    // --- Скины -----------------------------------------------------------------------------------------

    /** Мини-аватар из цветов вида (CSS-блоки): look — { skin, shirt, pants, shoes, hair, hairColor, hat, acc }. */
    avatar(look, size) {
        const hex = (n) => '#' + ((Number(n) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
        const lum = (n) => { const v = Number(n) & 0xffffff; return (0.3 * ((v >> 16) & 255) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255)) / 255; };
        const hats = { cap: '#e5383b', swimcap: hex(look.pants), beanie: '#8d5cf0', bucket: '#e8c66a', crown: '#ffd23f' };
        const acc = Array.isArray(look.acc) ? look.acc : [];
        let h = '<div class="bpm-av" style="--sk:' + hex(look.skin) + ';--sh:' + hex(look.shirt) + ';--pa:' + hex(look.pants) + ';--se:' + hex(look.shoes) + ';--ha:' + hex(look.hairColor) +
            ';--hc:' + (look.hat !== 'crown' && look.hatColor != null ? hex(look.hatColor) : (hats[look.hat] || '#e5383b')) + ';--hc2:' + (lum(look.shirt) > 0.55 ? '#e5383b' : '#ffd23f') + (size ? ';--av:' + size + 'px' : '') + '">';
        if (acc.includes('backpack')) h += '<i class="acc backpack"></i><i class="acc straps"></i>';
        h += '<i class="leg l"></i><i class="leg r"></i><i class="arm l"></i><i class="arm r"></i><i class="body"></i><i class="head"></i>';
        if (look.hair && look.hair !== 'none') h += '<i class="hair ' + look.hair + '"></i>';
        if (look.hat && look.hat !== 'none') h += '<i class="hat ' + look.hat + '"></i>';
        for (const a of acc) if (a !== 'backpack') h += '<i class="acc ' + a + '"></i>';
        return h + '</div>';
    },

    // --- Скины: магазин косметики (6 вкладок) -----------------------------------------------------------

    /** Глиф следа / победы (SVG 24×24; цвета — --c1 / --c2 родителя). */
    glyph(name) { return '<svg class="bpm-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (GameData.GLYPHS[name] || '') + '</svg>'; },

    /** Картинка предмета-эффекта: 6 глифов, которые плывут за героем (след) или разлетаются (победа). */
    _fxArt(it) {
        let g = '';
        for (let i = 0; i < 6; i++) g += '<i style="--i:' + i + '">' + this.glyph(it.glyph) + '</i>';
        return '<div class="bpm-fx ' + (it.tab === 'victory' ? 'win' : 'trail') + (it.fx === 'rainbow' ? ' rb' : '') + '" style="--c1:' + it.c1 + ';--c2:' + it.c2 + '">' + g + '</div>';
    },

    _cosTabs() {
        return '<div class="bpm-tabs">' + GameData.COSMETIC_TABS.map((k) =>
            '<button type="button" class="bpm-tab' + (k === this.s.cosTab ? ' on' : '') + '" data-act="cos-tab" data-tab="' + k + '">' + this.ico(k) + '<span>' + this.esc(this.t('cos.tab.' + k)) + '</span></button>').join('') + '</div>';
    },

    /** Выбранный предмет вкладки: запомненный, иначе надетый, иначе первый настоящий. */
    _cosSelected(tab) {
        const list = GameData.itemsOf(tab);
        let it = GameData.item(this.s.cosSel[tab] || '');
        if (!it || it.tab !== tab) it = GameData.item(Eco.equippedIn(tab) || '') || list.find((x) => !x.free) || list[0];
        this.s.cosSel[tab] = it.id;
        return it;
    },

    /** Состояние и кнопки выбранного предмета: надеть / снять / купить / за рекламу. */
    _cosActions(it) {
        const own = Eco.itemOwned(it.id), eq = Eco.itemEquipped(it.id), opt = GameData.OPT_SLOTS.includes(it.tab);
        if (eq) {
            return '<span class="bpm-chip ok">' + this.ico('check') + this.esc(this.t('skins.equipped')) + '</span>' +
                (opt ? '<button type="button" class="bpm-btn ghost small" data-act="cos-unequip" data-slot="' + it.tab + '">' + this.esc(this.t('cos.unequip')) + '</button>' : '');
        }
        if (own) return '<button type="button" class="bpm-btn small" data-act="cos-equip" data-id="' + it.id + '">' + this.esc(this.t('skins.equip')) + '</button>';
        if (it.exclusive) {
            return '<span class="bpm-chip gold">' + this.ico('gift') + this.esc(this.t('cos.exclusive')) + '</span>' +
                '<button type="button" class="bpm-btn teal small" data-act="open" data-win="daily">' + this.ico('daily') + '<span>' + this.esc(this.t('menu.daily')) + '</span></button>';
        }
        if (GameData.coinPrice(it)) return this.coinBtn(GameData.coinPrice(it), 'cos-buy', 'data-id="' + it.id + '"', 'small');
        return this.adBtn(GameData.adIdOf(it.id), { cls: 'small' });
    },

    /** Картинка карточки / сцены: образ — свой вид; причёска, шапка, аксессуар — на вас; след и победа — эффект. */
    _cosArt(it) {
        if (it.tab === 'outfit') return this.avatar(it.look, 6);
        if (it.fx) return this._fxArt(it);
        const look = Eco.composeLook(it.id);
        if (it.tab === 'hair') look.hat = 'none';            // форма причёски видна без шапки
        return this.avatar(look, it.tab === 'acc' ? 8 : 11);   // причёски и шапки — крупно, по пояс
    },

    _winSkins() {
        const tab = this.s.cosTab;
        const sel = this._cosSelected(tab);
        const rar = sel.rarity;
        const cnt = Eco.tabCount(tab);
        const stageFx = sel.fx ? this._fxArt(sel) : '';
        const hint = sel.exclusive ? this.t('cos.exclusiveHint') : this.t('cos.hint.' + tab);
        let h = '<div class="bpm-skins"><div class="bpm-skin-pane ' + rar + '"><div class="stage">' + stageFx + this.avatar(Eco.composeLook(sel.id), 0) + '</div><div class="info"><h3>' + this.esc(GameData.itemName(sel.id)) +
            '</h3><div class="row"><span class="bpm-rar ' + rar + '">' + this.esc(this.t('skin.rarity.' + rar)) + '</span></div><p class="hint">' + this.esc(hint) + '</p><div class="row">' + this._cosActions(sel) + '</div></div></div>';
        h += '<div><h2 class="bpm-h2">' + this.esc(this.t('cos.tab.' + tab)) + ' <small>' + this.esc(this.t('skins.count', { a: cnt.have, b: cnt.total })) + '</small></h2><div class="bpm-skin-grid">';
        for (const it of GameData.itemsOf(tab)) {
            const own = Eco.itemOwned(it.id), on = Eco.itemEquipped(it.id), coins = GameData.coinPrice(it);
            let st;
            if (on) st = this.ico('check') + this.esc(this.t('skins.equipped'));
            else if (own) st = this.esc(this.t('skins.owned'));
            else if (it.exclusive) st = this.ico('gift') + this.esc(this.t('cos.exclusive'));
            else if (coins) st = this.ico('coin') + this.num(coins);
            else { const p = Eco.adProgress(GameData.adIdOf(it.id)); st = Eco.adSupported() ? this.ico('ad') + p.have + '/' + p.need : this.ico('lock'); }
            h += '<div class="bpm-skin ' + it.rarity + (it.id === sel.id ? ' sel' : '') + (on ? ' on' : '') + (own ? '' : ' closed') + '" data-act="cos-sel" data-id="' + it.id + '" role="button" tabindex="0">' +
                '<div class="art z-' + it.tab + '">' + this._cosArt(it) + '</div><div class="nm">' + this.esc(GameData.itemName(it.id)) + '</div><div class="st">' + st + '</div></div>';
        }
        return { body: h + '</div></div></div>' };
    },

    _selectItem(id) {
        const it = GameData.item(id);
        if (!it) return;
        this.s.cosSel[it.tab] = id;
        this._previewSkin(id);
        this._renderWin();
    },
    /** Надеть полученный предмет в его слот. */
    _equipItem(id) {
        const it = GameData.item(id);
        const r = Eco.equipItem(id);
        if (!it || !r.ok) return;
        this.s.cosSel[it.tab] = id;
        if (!r.same) this.toast(this.t('toast.equipped', { what: GameData.itemName(id) }), 1500);
        if (this.h.onEquipSkin) this.h.onEquipSkin(id);
        this._previewSkin(this.win === 'skins' ? id : null, true);
        this._renderWin();
    },
    _unequipSlot(slot) {
        const r = Eco.unequipSlot(slot);
        if (!r.ok) return;
        if (this.h.onEquipSkin) this.h.onEquipSkin('');
        this._previewSkin(this.s.cosSel[slot] || null, true);
        this._renderWin();
    },
    /** Примерка на персонаже: id предмета -> onPreviewSkin(полный вид), null — вернуть надетое. force — отправить даже тот же id. */
    _previewSkin(id, force) {
        if (!force && this.s.prevSkin === id) return;
        this.s.prevSkin = id;
        if (this.h.onPreviewSkin) this.h.onPreviewSkin(id ? Eco.composeLook(id) : null);
    },

    // --- Новый забег -----------------------------------------------------------------------------------

    _winCreate() {
        const N = GameData.LEVELS.length;
        const sel = Math.max(1, Math.min(N, this.s.level | 0));
        const unlocked = Eco.levelUnlocked(sel);
        const bots = Eco.pref('bots'), mon = Eco.pref('monsters');
        let lv = '<div class="bpm-levels">';
        for (const l of GameData.LEVELS) {
            const ok = Eco.levelUnlocked(l.n), done = Eco.levelDone(l.n);
            lv += '<button type="button" class="bpm-lv' + (l.n === sel ? ' sel' : '') + (ok ? '' : ' locked') + '" data-act="level-sel" data-n="' + l.n + '" aria-label="' + this.esc(GameData.levelName(l.n)) + '">' +
                '<b>' + l.n + '</b><span>' + this.esc(GameData.levelName(l.n)) + '</span>' + (ok ? '' : this.ico('lock')) + (done ? this.ico('check', 'done') : '') + '</button>';
        }
        lv += '</div>';
        let lock = '';
        if (!unlocked) {
            lock = '<p class="bpm-note">' + this.esc(this.t('create.locked', { n: sel - 1 })) + '</p>' + this.adBtn('level:' + sel, { key: 'ad.open', cls: 'small block' });
        }
        const stepper = (k, label, val, lo, hi, extra, hint) =>
            '<div class="bpm-box"><h2 class="bpm-h2">' + this.esc(label) + '</h2><div class="bpm-step"><button type="button" class="bpm-round" data-act="step" data-k="' + k + '" data-d="-1"' + (val <= lo ? ' disabled' : '') + ' aria-label="-">−</button>' +
            '<div class="val">' + val + (extra ? '<small>' + extra + '</small>' : '') + '</div><button type="button" class="bpm-round" data-act="step" data-k="' + k + '" data-d="1"' + (val >= hi ? ' disabled' : '') + ' aria-label="+">+</button></div>' +
            '<p class="bpm-note" style="margin-top:8px">' + this.esc(hint) + '</p></div>';
        const mult = GameData.monsterMult(mon);
        const reward = GameData.runReward(sel, mon);
        const body = '<div class="bpm-create-grid"><section class="bpm-box"><h2 class="bpm-h2">' + this.esc(this.t('create.level')) + '</h2>' + lv + '</section><div style="display:grid;gap:10px;align-content:start">' +
            '<section class="bpm-box"><div class="bpm-info"><div class="nm">' + this.esc(GameData.levelName(sel)) + '</div>' +
            (Eco.levelDone(sel) ? '<span class="bpm-chip ok">' + this.ico('check') + this.esc(this.t('create.done')) + '</span>' : '') + '</div>' +
            '<p class="bpm-note" style="margin-top:6px">' + this.esc(this.t('create.baseReward', { n: GameData.levelReward(sel) })) + '</p>' + (lock ? '<div style="margin-top:8px;display:grid;gap:8px">' + lock + '</div>' : '') + '</section>' +
            '<div class="bpm-steppers">' + stepper('bots', this.t('create.bots'), bots, 0, GameData.MAX_BOTS, '', this.t('create.botsHint')) +
            stepper('monsters', this.t('create.monsters'), mon, 1, GameData.MAX_MONSTERS, '×' + mult, this.t('create.monstersHint')) + '</div></div></div>';
        const foot = '<span class="bpm-reward">' + this.ico('coin') + '<span>' + this.esc(this.t('create.reward')) + ' ' + this.num(reward) + '</span></span>' +
            '<button type="button" class="bpm-btn big" data-act="start"' + (unlocked ? '' : ' disabled') + '>' + this.ico('play') + '<span>' + this.esc(this.t('create.start')) + '</span></button>';
        return { body, foot };
    },

    _step(key, d) {
        Eco.setPref(key, Eco.pref(key) + (d < 0 ? -1 : 1));
        this._renderWin();
    },

    _start() {
        const n = Math.max(1, Math.min(GameData.LEVELS.length, this.s.level | 0));
        if (!Eco.levelUnlocked(n)) return;
        const bots = Eco.pref('bots'), monsters = Eco.pref('monsters');
        Eco.setPref('level', n);
        Eco.flush();
        this.closeWindows();
        if (this.h.onStartRun) this.h.onStartRun({ level: n, bots, monsters });
    },

    // --- Инвентарь -------------------------------------------------------------------------------------

    _winInventory() {
        let h = '<section><h2 class="bpm-h2">' + this.esc(this.t('inv.supplies')) + '</h2><div class="bpm-inv">';
        for (const id of GameData.itemIds()) {
            const c = Eco.count(id);
            h += '<div class="bpm-slot-tile' + (c === 0 ? ' zero' : '') + '">' + this.ico(id) + '<b>' + this.esc(this.t('tool.' + id)) + '</b><div class="n">' + (c === Infinity ? '∞' : this.num(c)) + '</div></div>';
        }
        h += '</div></section><section><h2 class="bpm-h2">' + this.esc(this.t('inv.upgrades')) + '</h2><div class="bpm-rows">';
        for (const up of GameData.UPGRADES) {
            const lvl = Eco.upLevel(up.id);
            let p = '<div class="bpm-pipsrow">';
            for (let i = 0; i < 3; i++) p += '<i' + (i < lvl ? ' class="on"' : '') + '></i>';
            p += '</div>';
            h += '<div class="bpm-row">' + this.ico(up.id) + '<div class="tx">' + this.esc(this.t('up.' + up.id)) + p + '</div><span class="v">' + this.esc(this._val(up, lvl)) + '</span></div>';
        }
        h += '</div></section><section><h2 class="bpm-h2">' + this.esc(this.t('inv.passes')) + '</h2><div class="bpm-links">';
        const passes = [['x2', 'x2'], ['maxed', 'maxed'], ['rope', 'infinity']].filter((p) => Eco.hasPass(p[0]));
        if (!passes.length) h += '<p class="bpm-note">' + this.esc(this.t('inv.noPasses')) + '</p>';
        for (const p of passes) h += '<span class="bpm-chip gold">' + this.ico(p[1]) + this.esc(this.t('pass.' + p[0])) + '</span>';
        const doneN = GameData.LEVELS.filter((l) => Eco.levelDone(l.n)).length, skinN = GameData.SKINS.filter((s) => Eco.ownsSkin(s.id)).length;
        h += '</div></section><section><h2 class="bpm-h2">' + this.esc(this.t('inv.progress')) + '</h2><div class="bpm-links"><span class="bpm-chip">' + this.ico('flag') + this.esc(this.t('inv.levels', { a: doneN, b: GameData.LEVELS.length })) +
            '</span><span class="bpm-chip">' + this.ico('skins') + this.esc(this.t('inv.skins', { a: skinN, b: GameData.SKINS.length })) + '</span></div></section>' +
            '<div class="bpm-links"><button type="button" class="bpm-btn teal small" data-act="open" data-win="equipment">' + this.ico('equipment') + '<span>' + this.esc(this.t('inv.goGear')) + '</span></button>' +
            '<button type="button" class="bpm-btn small" data-act="open" data-win="shop">' + this.ico('shop') + '<span>' + this.esc(this.t('inv.goShop')) + '</span></button></div>';
        return { body: h };
    },

    // =================================================================================================
    // Подарок дня (DailyGift), колесо фортуны (Wheel), рекорды
    // =================================================================================================

    /** Кнопка «за рекламу» не из каталога Eco (x2 подарка, вращение колеса): подпись, жёсткое отключение, пока нет паузы между rewarded. */
    adRaw(act, label, off, cls) {
        return '<button type="button" class="bpm-btn ad bpm-ad ' + (cls || 'small') + '" data-act="' + act + '" data-label="' + this.esc(label) + '"' + (off ? ' data-off="1" disabled' : '') + '>' +
            this.ico('ad') + '<span class="lbl">' + this.esc(label) + '</span></button>';
    },

    /** Красные точки и таймер на кнопках меню: подарок можно забрать, есть бесплатное вращение (иначе время до него). */
    _menuBadges() {
        if (!this._inited) return;
        const set = (win, on, text, cls) => {
            const b = this.$('.bpm-qbtn[data-win="' + win + '"] .bdg');
            if (!b) return;
            b.hidden = !on;
            b.className = 'bdg' + (cls ? ' ' + cls : '');
            if (on && b.textContent !== text) b.textContent = text;
        };
        if (typeof DailyGift !== 'undefined') set('daily', DailyGift.canClaim(), '!', '');
        if (typeof Wheel !== 'undefined') {
            const st = Wheel.status();
            if (st.freeAvailable && !st.pending) set('wheel', true, '!', '');
            else { const m = Math.ceil(st.nextFreeMs / 60000); set('wheel', !st.pending && m > 0, Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'), 't'); }
        }
    },

    /** Раз в секунду: бейджи меню, таймеры и доступность кнопок в окнах подарка и колеса (перерисовка только при смене состояния). */
    _tick() {
        if (!this._inited || (typeof document !== 'undefined' && document.hidden)) return;
        if (this.s.menu) this._menuBadges();
        if (this.win === 'daily' || (this.win === 'wheel' && !(this.s.wheel && this.s.wheel.spinning))) {
            const sig = this._sysSig();
            if (sig !== this.s.sig) { this._queueRender(); return; }
            if (this.win === 'daily') { const n = this.$('#bpm-dg-next'); if (n && typeof DailyGift !== 'undefined') n.textContent = DailyGift.status().nextLabel; }
            else { const f = this.$('#bpm-wh-free .lbl'); if (f && typeof Wheel !== 'undefined') f.textContent = Wheel.status().freeLabel; }
        }
    },
    /** Подпись состояния окна подарка / колеса: меняется — окно перерисовывается. */
    _sysSig() {
        if (this.win === 'daily' && typeof DailyGift !== 'undefined') { const v = DailyGift.view(); return [v.canClaim, v.x2.enabled, v.x2.adWait > 0, v.day].join(); }
        if (this.win === 'wheel' && typeof Wheel !== 'undefined') { const s = Wheel.status(); return [s.canSpinFree, s.canSpinAd, s.adWait > 0, s.adLeft, s.banked, !!s.pending].join(); }
        return '';
    },

    /** Автопоказ подарка: окно открывается, только если подарок доступен, сегодня ещё не предлагали, туториал не идёт и другого окна нет. */
    offerDaily() {
        if (!this._inited || typeof DailyGift === 'undefined' || this.win) return false;
        if (typeof Tutorial !== 'undefined' && Tutorial.active) return false;
        if (!DailyGift.shouldOffer()) return false;
        this.openWindow('daily');
        DailyGift.markOffered();
        return true;
    },

    // --- Подарок дня -----------------------------------------------------------------------------------

    /** Части награды дня: [{ icon, text }]. */
    _rewardParts(r) {
        const out = [];
        if (r.coins > 0) out.push({ icon: r.coins >= 150 ? 'coinpile' : 'coin', text: '+' + this.num(r.coins) });
        if (r.item) { const sp = GameData.supply(r.item); out.push({ icon: sp ? sp.item : 'gift', text: sp ? '×' + sp.n : GameData.itemName(r.item) }); }
        if (r.randomItems > 0) out.push({ icon: 'gift', text: r.randomItems > 1 ? '×' + r.randomItems : this.t('daily.item') });
        return out;
    },

    _winDaily() {
        if (typeof DailyGift === 'undefined') return { body: '' };
        const v = DailyGift.view();
        let days = '';
        for (const d of v.days) {
            if (d.exclusive) continue;
            const parts = this._rewardParts(d.reward);
            days += '<div class="bpm-day ' + d.state + '"><span class="dn">' + this.esc(d.dayLabel) + '</span><div class="pts">' +
                parts.map((p) => '<span class="pt">' + this.ico(p.icon) + '<b>' + this.esc(p.text) + '</b></span>').join('') + '</div>' +
                '<span class="stt">' + (d.state === 'claimed' ? this.ico('check') : '') + this.esc(d.stateLabel) + '</span></div>';
        }
        const seven = v.days[v.days.length - 1];
        const sk = seven.skin ? GameData.skin(seven.skin) : null;
        const big = sk ? '<div class="av">' + this.avatar(sk.look, 8) + '</div><div class="tx"><span class="bpm-rar ' + sk.rarity + '">' + this.esc(this.t('skin.rarity.' + sk.rarity)) + '</span><h3>' + this.esc(GameData.itemName(sk.id)) +
            '</h3><p>' + this.esc(this.t('daily.exclusive')) + '. ' + this.esc(this.t('daily.exclusiveHint')) + '</p></div>'
            : '<div class="av">' + this.ico('coinpile') + '</div><div class="tx"><h3>' + this.esc(this.t('reward.big', { n: this.num(seven.reward.coins) })) + '</h3><p>' + this.esc(this.t('daily.allSkins')) + '</p></div>';
        let got = '';
        if (this.s.dailyGot) got = '<div class="bpm-got">' + this.ico('gift') + '<span>' + this.esc(this.t('daily.got', { what: this.s.dailyGot })) + '</span></div>';
        const body = '<p class="bpm-note">' + this.esc(this.t('daily.intro')) + '</p>' + got + '<div class="bpm-days">' + days +
            '<div class="bpm-day seven ' + seven.state + '"><span class="dn">' + this.esc(seven.dayLabel) + '</span><span class="stt">' + (seven.state === 'claimed' ? this.ico('check') : '') + this.esc(seven.stateLabel) + '</span><div class="goal">' + big + '</div></div></div>';
        let foot;
        if (v.canClaim) {
            foot = '<button type="button" class="bpm-btn big" data-act="daily-claim">' + this.ico('gift') + '<span>' + this.esc(v.claim.label) + '</span></button>' +
                (v.x2.available && Eco.adSupported() ? this.adRaw('daily-x2', v.x2.label, !v.x2.enabled && !v.x2.adWait && !v.x2.busy, 'small') : '');
        } else {
            foot = '<span class="bpm-reward timer">' + this.ico('clock') + '<span id="bpm-dg-next">' + this.esc(v.nextLabel) + '</span></span>';
        }
        return { body, foot };
    },

    /** Что получил игрок -> строка («+100 монет, Камешек ×10, Звезда бассейна»). */
    _gotText(got) {
        return (got || []).map((g) => (g.type === 'coins' ? '+' + this.num(g.amount) + ' ' + this.t('daily.coins') : GameData.itemName(g.id))).join(', ');
    },
    _dailyDone(r) {
        if (!r || !r.ok) return;
        this.s.dailyGot = this._gotText(r.got);
        for (const g of r.got) if (g.type === 'exclusive') { Eco.equipItem(g.id); if (this.h.onEquipSkin) this.h.onEquipSkin(g.id); }
        this.toast(this.t('daily.got', { what: this.s.dailyGot }), 3200);
        this._menuBadges();
        this._queueRender();
    },
    async _dailyX2() {
        if (this.s.dailyBusy) return;
        this.s.dailyBusy = true;
        let r;
        try { r = await DailyGift.claimX2(); } catch (e) { r = { ok: false, reason: 'adFailed' }; }
        this.s.dailyBusy = false;
        if (r.ok) this._dailyDone(r);
        else if (r.reason === 'cooldown') this.toast(Eco.adWaitLabel() || this.t('toast.adFail'), 1500);
        else if (r.reason === 'adFailed' || r.reason === 'adUnavailable') this.toast(this.t('toast.adFail'), 2600);
        this.refreshAds();
    },

    // --- Колесо фортуны ---------------------------------------------------------------------------------

    /** Что нарисовать в секторе: { icon, text }. */
    _sectorIcon(sc) {
        if (sc.kind === 'coins') return { icon: sc.coins >= 120 ? 'coinpile' : 'coin', text: String(sc.coins) };
        const sp = GameData.supply(sc.itemId);
        if (sp) return { icon: sp.item, text: '×' + sp.n };
        const it = GameData.item(sc.itemId);
        return { icon: it ? it.tab : 'gift', text: '' };
    },

    /** SVG диска: сектора по числу призов, значок и число вдоль радиуса. Сектор 0 — под стрелкой при угле 0, дальше по часовой. */
    _wheelSVG(secs, win) {
        const n = secs.length, step = 360 / n, R = 96;
        const pt = (deg, r) => { const a = deg * Math.PI / 180; return (Math.sin(a) * r).toFixed(2) + ' ' + (-Math.cos(a) * r).toFixed(2); };
        let w = '<circle r="99" fill="#0b3d47"/>';
        secs.forEach((sc, i) => {
            const kind = sc.kind === 'item' ? (GameData.supply(sc.itemId) ? 'sup' : 'cos') : 'coin';
            const fill = { coin: ['#ffd23f', '#ffe486'], sup: ['#5fd9d1', '#8fe8e0'], cos: ['#b08cff', '#c7a8ff'] }[kind][i % 2];
            w += '<path d="M0 0L' + pt((i - 0.5) * step, R) + 'A' + R + ' ' + R + ' 0 0 1 ' + pt((i + 0.5) * step, R) + 'Z" fill="' + fill + '" stroke="#fff" stroke-width="1.8"' + (win === i ? ' class="win"' : '') + '/>';
        });
        secs.forEach((sc, i) => {
            const ic = this._sectorIcon(sc);
            const src = GameData.RASTER[ic.icon];
            const art = src ? '<image href="' + src + '" x="-15" y="-88" width="30" height="30"/>' : '<svg x="-15" y="-88" width="30" height="30" viewBox="0 0 64 64">' + (GameData.ICONS[ic.icon] || '') + '</svg>';
            w += '<g transform="rotate(' + (i * step).toFixed(2) + ')">' + art + (ic.text ? '<text y="-50" text-anchor="middle">' + this.esc(ic.text) + '</text>' : '') + '</g>';
        });
        for (let i = 0; i < 20; i++) w += '<circle cx="' + pt(i * 18, 97.5).split(' ')[0] + '" cy="' + pt(i * 18, 97.5).split(' ')[1] + '" r="1.7" fill="#fff" opacity=".9"/>';
        w += '<circle r="15" fill="#fff" stroke="#0b3d47" stroke-width="3"/><circle r="7" fill="#ffc928" stroke="#0b3d47" stroke-width="2.5"/>';
        return '<svg viewBox="-100 -100 200 200" aria-hidden="true">' + w + '</svg>';
    },

    _winWheel() {
        if (typeof Wheel === 'undefined') return { body: '' };
        const w = this.s.wheel;
        const st = Wheel.status(), secs = Wheel.sectors();
        const spin = w.spinning || w.asking;
        const prizes = secs.map((sc, i) => {
            const ic = this._sectorIcon(sc);
            return '<div class="bpm-prize' + (w.result && w.result.sector === i ? ' win' : '') + '">' + this.ico(ic.icon) + '<span>' + this.esc(sc.label) + '</span><small>' + Math.max(1, Math.round(sc.chance)) + '%</small></div>';
        }).join('');
        let res = '';
        if (w.result && !w.spinning) res = '<div class="bpm-got win">' + this.ico('star') + '<span>' + this.esc(this.t('wheel.won', { what: w.result.label })) + '</span></div>';
        let btns = '<button type="button" class="bpm-btn big' + (!st.canSpinFree && !spin ? ' ghost' : '') + '" id="bpm-wh-free" data-act="wheel-free"' + (st.canSpinFree && !spin ? '' : ' disabled') + '>' + this.ico('wheel') + '<span class="lbl">' + this.esc(st.freeLabel) + '</span></button>';
        if (Eco.adSupported()) btns += this.adRaw('wheel-ad', st.adLabel, spin || (!st.canSpinAd && !st.adWait && !st.busy), 'small block');
        const body = '<div class="bpm-wheel-grid"><div class="bpm-wheel-box"><div class="bpm-wheel"><div class="bpm-wheel-ptr"></div><div class="bpm-wheel-disc" id="bpm-wdisc" style="transform:rotate(' + w.angle + 'deg)">' +
            this._wheelSVG(secs, w.result ? w.result.sector : -1) + '</div></div></div><div class="bpm-wheel-side"><p class="bpm-note">' + this.esc(this.t('wheel.intro')) + '</p>' + res +
            '<div class="bpm-wheel-btns">' + btns + (st.hint ? '<p class="bpm-note hint">' + this.esc(st.hint) + '</p>' : '') + '</div>' +
            '<h2 class="bpm-h2">' + this.esc(this.t('wheel.prizes')) + '</h2><div class="bpm-prizes">' + prizes + '</div></div></div>';
        return { body };
    },

    /** Окно открыто: вращение, оборванное закрытием окна или перезагрузкой, доигрывается (или выдаётся сразу, если анимация давно кончилась). */
    _wheelOpen() {
        const w = this.s.wheel;
        w.result = null;
        if (typeof Wheel === 'undefined') return;
        const p = Wheel.pendingSpin();
        if (!p || w.spinning) return;
        if (p.stale) { this._wheelDone(); return; }
        w.spinning = true;
        w.resume = p;
        w.go = { res: p, ms: Math.max(300, p.durationMs - p.elapsedMs) };      // доиграть оставшееся время анимации
        clearTimeout(w.timer);
        w.timer = setTimeout(() => this._wheelDone(), Math.max(0, p.durationMs - p.elapsedMs) + 80);
    },

    /** После отрисовки окна: запустить анимацию (новое вращение или возобновлённое). */
    _wheelKick() {
        const w = this.s.wheel;
        if (!w.go) return;
        const go = w.go;
        w.go = null;
        const disc = this.$('#bpm-wdisc');
        if (!disc) return;
        const target = Wheel.angleFrom(w.angle, go.res);
        disc.style.transition = 'none';
        disc.style.transform = 'rotate(' + w.angle + 'deg)';
        void disc.offsetWidth;
        disc.style.transition = 'transform ' + (go.ms / 1000).toFixed(2) + 's cubic-bezier(.12,.62,.1,1)';
        disc.style.transform = 'rotate(' + target + 'deg)';
        w.angle = target;
    },

    async _wheelSpin(kind) {
        const w = this.s.wheel;
        if (w.spinning || w.asking || typeof Wheel === 'undefined') return;
        w.asking = true;
        let r;
        if (kind === 'free') r = Wheel.spinFree();
        else { this._queueRender(); try { r = await Wheel.spinAd(); } catch (e) { r = { ok: false, reason: 'adFailed' }; } }
        w.asking = false;
        if (!r || !r.ok) {
            if (r && r.reason === 'cooldown') this.toast(Eco.adWaitLabel() || this.t('toast.adFail'), 1500);
            else if (r && (r.reason === 'adFailed' || r.reason === 'adUnavailable')) this.toast(this.t('toast.adFail'), 2600);
            else if (r && r.reason === 'limit') this.toast(this.t('wheel.noSpins'), 2200);
            this._queueRender();
            return;
        }
        w.result = null;
        w.spinning = true;
        w.go = { res: r, ms: r.durationMs };
        if (typeof GameAudio !== 'undefined') GameAudio.wheelTicks(r.durationMs);
        clearTimeout(w.timer);
        w.timer = setTimeout(() => this._wheelDone(), r.durationMs + 80);
        this._renderWin();
    },

    /** Анимация кончилась (таймер идёт и при закрытом окне): приз начисляется один раз. */
    _wheelDone() {
        const w = this.s.wheel;
        clearTimeout(w.timer);
        w.spinning = false;
        w.resume = null;
        const r = typeof Wheel !== 'undefined' ? Wheel.finish() : null;
        if (r && r.ok) {
            w.result = r;
            this.toast(this.t('wheel.won', { what: r.label }), 3200);
            if (typeof GameAudio !== 'undefined') GameAudio.play('prize');
        }
        this._menuBadges();
        if (this.win === 'wheel') this._renderWin();
    },

    // --- Рекорды ---------------------------------------------------------------------------------------

    /** Показывать кнопку «Рекорды» только там, где площадка отдаёт таблицу (Platform.leaderboard() -> массив). */
    async _probeBoard(force) {
        if (!this._inited || typeof Platform === 'undefined' || typeof Platform.leaderboard !== 'function') return;
        const now = Date.now();
        if (!force && this.s.probeAt && now - this.s.probeAt < 60000) return;
        this.s.probeAt = now;
        let rows = null;
        try { rows = await Platform.leaderboard(); } catch (e) { rows = null; }
        this.s.hasBoard = Array.isArray(rows);
        for (const b of this.$$('[data-win="records"]')) /** @type {HTMLButtonElement} */ (b).hidden = !this.s.hasBoard;
        if (typeof HudLayout !== 'undefined') HudLayout.schedule();
    },

    /** Лучший результат игрока для окна рекордов («Мой рекорд: N»). null — не показывать. */
    setBestScore(n) {
        this.s.best = n == null || !isFinite(Number(n)) ? null : Math.max(0, Math.floor(Number(n)));
        const el = this.$('#bpm-rec-best');
        if (el) el.textContent = this.t('rec.best', { n: this.num(this.s.best || 0) });
        else if (this.win === 'records') this._queueRender();
    },

    async _loadBoard() {
        const b = this.s.board;
        b.state = 'loading';
        const my = ++b.seq;
        let rows = null;
        try { rows = typeof Platform !== 'undefined' && typeof Platform.leaderboard === 'function' ? await Platform.leaderboard({ avatarSize: 'medium' }) : null; } catch (e) { rows = null; }
        if (my !== b.seq) return;
        b.state = Array.isArray(rows) ? 'ok' : 'error';
        b.rows = Array.isArray(rows) ? rows : [];
        if (this.win === 'records') this._renderWin();
    },

    _initials(name) {
        const w = String(name || '').trim().split(/\s+/).filter(Boolean);
        const ch = (s) => (Array.from(s)[0] || '');
        return ((w.length > 1 ? ch(w[0]) + ch(w[1]) : Array.from(w[0] || '').slice(0, 2).join('')) || '?').toUpperCase();
    },

    _winRecords() {
        const b = this.s.board;
        const canLogin = typeof Platform !== 'undefined' && typeof Platform.canLogin === 'function' && Platform.canLogin() && typeof Platform.authorized === 'function' && !Platform.authorized();
        let h = '';
        if (this.s.best != null) h += '<div class="bpm-rec-best">' + this.ico('records') + '<span id="bpm-rec-best">' + this.esc(this.t('rec.best', { n: this.num(this.s.best) })) + '</span></div>';
        if (canLogin) h += '<button type="button" class="bpm-btn teal block" data-act="rec-login"' + (b.logging ? ' disabled' : '') + '><span>' + this.esc(this.t('rec.signin')) + '</span></button>';
        if (b.state === 'loading') h += '<p class="bpm-note bpm-rec-empty">' + this.esc(this.t('rec.loading')) + '</p>';
        else if (!b.rows.length) h += '<p class="bpm-note bpm-rec-empty">' + this.esc(this.t('rec.empty')) + '</p>';
        else {
            h += '<div class="bpm-rec-list">';
            b.rows.forEach((r, i) => {
                const rank = Number(r.rank) > 0 ? Number(r.rank) : i + 1;
                const nm = r.name == null || r.name === '' ? '—' : String(r.name);
                const av = r.avatar ? '<img src="' + this.esc(r.avatar) + '" alt="" draggable="false" referrerpolicy="no-referrer" loading="lazy" data-ini="' + this.esc(this._initials(nm)) + '">' : this._initials(nm);
                h += '<div class="bpm-rec-row' + (r.me ? ' me' : '') + (rank <= 3 ? ' top' + rank : '') + '"><b class="rk">' + rank + '</b><span class="av">' + av + '</span><span class="nm">' + this.esc(nm) + '</span><b class="sc">' + this.num(r.score) + '</b></div>';
            });
            h += '</div>';
        }
        return { body: h };
    },

    async _login() {
        const b = this.s.board;
        if (b.logging || typeof Platform === 'undefined' || typeof Platform.login !== 'function') return;
        b.logging = true;
        this._renderWin();
        let ok = false;
        try { ok = !!(await Platform.login()); } catch (e) { ok = false; }
        b.logging = false;
        if (ok) { if (this.h.onLogin) await this.h.onLogin(); this._probeBoard(true); await this._loadBoard(); }
        else if (this.win === 'records') this._renderWin();
    },
};
