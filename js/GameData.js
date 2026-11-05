// GameData.js — каталог игры (Don’t Splash): инструменты, припасы, улучшения, предложения магазина, скины, уровни, иконки.
// ТОЛЬКО ДАННЫЕ и чистые функции над ними (без состояния игрока): состояние — Eco (GameEconomy.js), экраны — GameUI (GameUI.js).
// Все цены и числа баланса — здесь, правятся без трогания логики. Тексты каталога ({ ru, en }) при загрузке попадают в
// LANG_STRINGS под ключами `<вид>.<id>` / `<вид>.<id>.d`, в интерфейсе — только Lang.t(ключ).
//
// ИДЕНТИФИКАТОРЫ ПРЕДЛОЖЕНИЙ «ЗА РЕКЛАМУ» (Eco.adProgress / Eco.watchAd), прогресс хранится по ним:
//   shop:<offer>       предложение магазина (повторяемое; пропуска — один раз)     тип Platform.rewarded 'shop-offer'
//   refill:<tool>      «+N за рекламу» к инструменту (повторяемое)                 'shop-offer'
//   unlock:<tool>      открыть инструмент в «Снаряжении»                           'unlock-tool'
//   up:<id>:<level>    уровень улучшения 1..3 (строго по порядку)                  'upgrade'
//   level:<n>          открыть уровень n (2..10) без прохождения предыдущего       'unlock-level'
//   skin:<id>          образ (вкладка «Образы»)                                      'skin'
//   cos:<id>           причёска / головной убор / аксессуар / след / победа          'cosmetic'
//
// ИКОНКИ. Сейчас — встроенный SVG (viewBox 0 0 64 64, ICONS). Когда Codex нарисует растр (docs/CODEX-IMAGEGEN-PROMPT.md,
// файлы assets/ui/<id>.webp), достаточно дописать id и путь В ОДНУ карту RASTER ниже (путь — строковым литералом, иначе
// сборщик не увидит файл); GameData.icon(id) сам отдаст <img> вместо SVG. Закомментированных литералов с кавычками
// в этом файле не держим: сканер ассетов читает и комментарии.

// ---------------------------------------------------------------------------------------------------------------
// КОСМЕТИКА: вкладки Причёски / Головные уборы / Аксессуары / Следы / Победа + эксклюзивные образы Daily Gift.
// Образы (вкладка outfit) — GameData.SKINS ниже. Предмет: { id, tab, rarity, price: { coins } | { ads }, name, look? | fx? }.
//   look  — часть вида героя, которую предмет перекрывает (hair+hairColor / hat+hatColor[+hair] / acc[]);
//   fx    — id эффекта GameFx (след или победа); glyph + c1/c2 — картинка карточки.
// Цена в таблицах одним числом: >= 100 — монеты, 1..7 — просмотры рекламы (чем ценнее, тем больше).
// Строка таблицы: [id, ru, en, редкость, цена, ...поля вида].
// ---------------------------------------------------------------------------------------------------------------
const GD_PRICE = (n) => (n >= 100 ? { coins: n } : { ads: n });
/** Таблица строк -> предметы вкладки tab с id pre + строка[0]. */
const GD_ROWS = (tab, pre, rows, fn) => rows.map((r) => Object.assign({ id: pre + r[0], tab, rarity: r[3], price: GD_PRICE(r[4]), name: { ru: r[1], en: r[2] } }, fn(r)));
/** Бесплатный «пустой» предмет вкладки: у игрока с начала, не надет по умолчанию (снимает деталь образа). */
const GD_FREE = (tab, id, ru, en, look) => ({ id, tab, rarity: 'common', free: true, name: { ru, en }, look });

const GD_HAIR = [GD_FREE('hair', 'hair.none', 'Без причёски', 'No hair', { hair: 'none', hairColor: 0x222222 })].concat(GD_ROWS('hair', 'hair.', [
    // за монеты (8)
    ['brownShort', 'Каштановая классика', 'Classic Brown', 'common', 150, 'short', 0x4a2f1f],
    ['curlyBlack', 'Чёрные кудри', 'Black Curls', 'common', 250, 'curly', 0x1d1d1d],
    ['bunBlond', 'Пучок-блонд', 'Blond Bun', 'common', 350, 'bun', 0xe8d28a],
    ['longGinger', 'Рыжая грива', 'Ginger Mane', 'rare', 600, 'long', 0xc4561f],
    ['spikyBlue', 'Синие шипы', 'Blue Spikes', 'rare', 800, 'spiky', 0x3a7bff],
    ['mohawkRed', 'Красный ирокез', 'Red Mohawk', 'epic', 1300, 'mohawk', 0xe5383b],
    ['longPink', 'Розовые локоны', 'Pink Locks', 'epic', 1800, 'long', 0xff7fb5],
    ['curlyTeal', 'Бирюзовые кудри', 'Teal Curls', 'legendary', 3000, 'curly', 0x2fe0c0],
    // за рекламу (16)
    ['shortGinger', 'Рыжик', 'Ginger', 'common', 1, 'short', 0xc4561f],
    ['spikyBlack', 'Чёрный ёж', 'Hedgehog', 'common', 1, 'spiky', 0x1d1d1d],
    ['bunBrown', 'Пучок', 'Topknot', 'common', 2, 'bun', 0x4a2f1f],
    ['shortBlond', 'Блондин', 'Blond', 'common', 2, 'short', 0xe8d28a],
    ['longBlack', 'Чёрный водопад', 'Black Waterfall', 'rare', 3, 'long', 0x1d1d1d],
    ['curlyGinger', 'Рыжие кудри', 'Ginger Curls', 'rare', 3, 'curly', 0xc4561f],
    ['mohawkBlack', 'Панк', 'Punk', 'rare', 4, 'mohawk', 0x1d1d1d],
    ['shortGrey', 'Седина', 'Silver Fox', 'rare', 4, 'short', 0x9aa7b5],
    ['spikyGreen', 'Зелёные шипы', 'Green Spikes', 'epic', 5, 'spiky', 0x46d977],
    ['bunPurple', 'Фиолетовый пучок', 'Violet Bun', 'epic', 5, 'bun', 0x8a4fe0],
    ['mohawkTeal', 'Бирюзовый ирокез', 'Teal Mohawk', 'epic', 6, 'mohawk', 0x2fe0c0],
    ['longBlue', 'Синий шёлк', 'Blue Silk', 'epic', 6, 'long', 0x3a7bff],
    ['curlyGold', 'Золотые кудри', 'Golden Curls', 'legendary', 7, 'curly', 0xffc233],
    ['spikyWhite', 'Белые иглы', 'White Quills', 'legendary', 7, 'spiky', 0xf1f1f1],
    ['mohawkNeon', 'Неоновый гребень', 'Neon Crest', 'legendary', 7, 'mohawk', 0xf7ff3a],
    ['longMyth', 'Мифическая грива', 'Mythic Mane', 'mythic', 7, 'long', 0xb26bff],
], (r) => ({ look: { hair: r[5], hairColor: r[6] } })));

const GD_HAT = [GD_FREE('hat', 'hat.none', 'Без головного убора', 'No hat', { hat: 'none' })].concat(GD_ROWS('hat', 'hat.', [
    // за монеты (8); у короны цвет не меняется — варианты короны несут свою причёску
    ['capRed', 'Красная кепка', 'Red Cap', 'common', 150, 'cap', 0xe5383b],
    ['bucketSand', 'Панама', 'Sand Bucket Hat', 'common', 250, 'bucket', 0xe8c66a],
    ['swimcapBlue', 'Синяя шапочка', 'Blue Swim Cap', 'common', 350, 'swimcap', 0x2f86d6],
    ['beanieViolet', 'Фиолетовая шапка', 'Violet Beanie', 'rare', 600, 'beanie', 0x8d5cf0],
    ['capBlack', 'Чёрная кепка', 'Black Cap', 'rare', 800, 'cap', 0x23272f],
    ['bucketPink', 'Розовая панама', 'Pink Bucket Hat', 'epic', 1300, 'bucket', 0xff8fa3],
    ['crownBrown', 'Корона', 'Crown', 'epic', 2000, 'crown', 0xffd23f, 'short', 0x5a3a22],
    ['crownQueen', 'Королева бассейна', 'Pool Queen', 'legendary', 3500, 'crown', 0xffd23f, 'long', 0xc4561f],
    // за рекламу (16)
    ['beanieRed', 'Красная шапка', 'Red Beanie', 'common', 1, 'beanie', 0xe5383b],
    ['capWhite', 'Белая кепка', 'White Cap', 'common', 1, 'cap', 0xf5f1e8],
    ['swimcapRed', 'Красная шапочка', 'Red Swim Cap', 'common', 2, 'swimcap', 0xe23d3d],
    ['bucketGreen', 'Зелёная панама', 'Green Bucket Hat', 'common', 2, 'bucket', 0x46d977],
    ['capTeal', 'Бирюзовая кепка', 'Teal Cap', 'rare', 3, 'cap', 0x14a5ac],
    ['beanieYellow', 'Жёлтая шапка', 'Yellow Beanie', 'rare', 3, 'beanie', 0xffd23f],
    ['swimcapPink', 'Розовая шапочка', 'Pink Swim Cap', 'rare', 4, 'swimcap', 0xff7fb5],
    ['bucketBlue', 'Синяя панама', 'Blue Bucket Hat', 'rare', 4, 'bucket', 0x3a7bff],
    ['beanieBlack', 'Чёрная шапка', 'Black Beanie', 'epic', 5, 'beanie', 0x23272f],
    ['capGold', 'Золотая кепка', 'Golden Cap', 'epic', 5, 'cap', 0xffc233],
    ['swimcapNeon', 'Неоновая шапочка', 'Neon Swim Cap', 'epic', 6, 'swimcap', 0x2ee6d6],
    ['bucketPurple', 'Фиолетовая панама', 'Violet Bucket Hat', 'epic', 6, 'bucket', 0x8a4fe0],
    ['crownPunk', 'Панк-король', 'Punk King', 'legendary', 7, 'crown', 0xffd23f, 'mohawk', 0xe5383b],
    ['crownCurly', 'Король кудрей', 'Curly King', 'legendary', 7, 'crown', 0xffd23f, 'curly', 0x1d1d1d],
    ['crownFrost', 'Ледяной король', 'Frost King', 'legendary', 7, 'crown', 0xffd23f, 'spiky', 0x9fd8ff],
    ['crownMyth', 'Корона мифов', 'Mythic Crown', 'mythic', 7, 'crown', 0xffd23f, 'long', 0xb26bff],
], (r) => ({ look: r[7] ? { hat: r[5], hatColor: r[6], hair: r[7], hairColor: r[8] } : { hat: r[5], hatColor: r[6] } })));

const GD_ACC = [GD_FREE('acc', 'acc.none', 'Без аксессуаров', 'No accessories', { acc: [] })].concat(GD_ROWS('acc', 'acc.', [
    // у аксессуаров фиксированные цвета, поэтому разнообразие — в наборах
    ['goggles', 'Очки пловца', 'Swim Goggles', 'common', 150, ['goggles']],
    ['headphones', 'Наушники', 'Headphones', 'common', 250, ['headphones']],
    ['scarf', 'Шарф', 'Scarf', 'common', 300, ['scarf']],
    ['floaties', 'Нарукавники', 'Arm Floaties', 'common', 400, ['floaties']],
    ['diverSet', 'Дайвер-сет', 'Diver Set', 'rare', 700, ['goggles', 'snorkel']],
    ['djSet', 'Диджей-сет', 'DJ Set', 'rare', 900, ['headphones', 'goggles']],
    ['floatKing', 'Король поплавка', 'Float King', 'epic', 1600, ['floaties', 'ring']],
    ['explorer', 'Экспедиция', 'Expedition', 'legendary', 3200, ['backpack', 'goggles', 'snorkel']],
    ['snorkel', 'Трубка', 'Snorkel', 'common', 1, ['snorkel']],
    ['backpack', 'Рюкзак', 'Backpack', 'common', 1, ['backpack']],
    ['ring', 'Спасательный круг', 'Lifebuoy', 'common', 2, ['ring']],
    ['swimKid', 'Юный пловец', 'Young Swimmer', 'common', 2, ['goggles', 'floaties']],
    ['tourist', 'Турист', 'Tourist', 'rare', 3, ['backpack', 'headphones']],
    ['coldDj', 'Зимний диджей', 'Winter DJ', 'rare', 3, ['scarf', 'headphones']],
    ['guard', 'Дежурный', 'On Duty', 'rare', 4, ['ring', 'scarf']],
    ['beachKit', 'Пляжный набор', 'Beach Kit', 'rare', 4, ['snorkel', 'floaties']],
    ['hiker', 'Путешественник', 'Traveller', 'epic', 5, ['backpack', 'scarf', 'headphones']],
    ['ringDiver', 'Спасатель-дайвер', 'Rescue Diver', 'epic', 5, ['ring', 'goggles', 'snorkel']],
    ['partyPool', 'Бассейн-пати', 'Pool Party', 'epic', 6, ['floaties', 'ring', 'headphones']],
    ['arctic', 'Полярник', 'Polar Explorer', 'epic', 6, ['scarf', 'goggles', 'backpack']],
    ['divePro', 'Профи-дайвер', 'Pro Diver', 'legendary', 7, ['goggles', 'snorkel', 'floaties', 'backpack']],
    ['lifeSaver', 'Старший спасатель', 'Head Lifeguard', 'legendary', 7, ['ring', 'floaties', 'goggles', 'scarf']],
    ['partyKing', 'Король вечеринки', 'Party King', 'legendary', 7, ['headphones', 'goggles', 'ring', 'floaties']],
    ['everything', 'Всё сразу', 'All of It', 'mythic', 7, ['goggles', 'snorkel', 'floaties', 'backpack', 'scarf', 'ring', 'headphones']],
], (r) => ({ look: { acc: r[5] } })));

// Следы и победы: [fx, ru, en, редкость, цена, glyph, c1, c2]; fx — id эффекта в GameFx
const GD_FX = (tab, pre, rows) => GD_ROWS(tab, pre, rows, (r) => ({ fx: r[0], glyph: r[5], c1: r[6], c2: r[7] }));

const GD_TRAIL = GD_FX('trail', 'trail.', [
    ['bubbles', 'Пузырьки', 'Bubbles', 'common', 150, 'bubble', '#bfefff', '#ffffff'],
    ['droplets', 'Капли', 'Droplets', 'common', 200, 'drop', '#4ab8ff', '#bfe8ff'],
    ['leaves', 'Листья', 'Leaves', 'common', 250, 'leaf', '#5fd35f', '#2c8f3a'],
    ['petals', 'Лепестки', 'Petals', 'common', 300, 'petal', '#ff9fc2', '#ffd6e6'],
    ['sparkle', 'Блёстки', 'Glitter', 'rare', 600, 'spark', '#ffd23f', '#ffffff'],
    ['hearts', 'Сердечки', 'Hearts', 'rare', 800, 'heart', '#ff5c8a', '#ffc2d6'],
    ['flame', 'Огненный след', 'Fire Trail', 'epic', 1500, 'flame', '#ff7a1a', '#ffd23f'],
    ['rainbow', 'Радуга', 'Rainbow', 'epic', 2000, 'dot', '#ff4f4f', '#4f9fff'],
    ['goldstream', 'Золотой поток', 'Gold Stream', 'legendary', 3500, 'spark', '#ffc928', '#fff3a6'],
    ['foam', 'Пена', 'Foam', 'common', 1, 'puff', '#ffffff', '#cfeff5'],
    ['dust', 'Пыль', 'Dust', 'common', 1, 'dot', '#e8d9b0', '#fff6dc'],
    ['snow', 'Снежинки', 'Snowflakes', 'common', 2, 'snow', '#e8f6ff', '#ffffff'],
    ['sparks', 'Искры', 'Sparks', 'common', 2, 'spark', '#ff9a2e', '#ffe08a'],
    ['confetti', 'Конфетти', 'Confetti', 'rare', 3, 'square', '#ff5c8a', '#4ab8ff'],
    ['stars', 'Звёздочки', 'Little Stars', 'rare', 3, 'star', '#ffd23f', '#fff3a6'],
    ['notes', 'Нотки', 'Music Notes', 'rare', 4, 'note', '#8d5cf0', '#4ab8ff'],
    ['ducks', 'Уточки', 'Ducklings', 'rare', 4, 'duck', '#ffd84a', '#ff9a2e'],
    ['clover', 'Клевер удачи', 'Lucky Clover', 'rare', 4, 'clover', '#46d977', '#bfffd0'],
    ['ice', 'Ледяной след', 'Ice Trail', 'epic', 5, 'crystal', '#8fd8ff', '#ffffff'],
    ['ghost', 'Призраки', 'Ghosts', 'epic', 5, 'ghost', '#dff7ea', '#6fd0a8'],
    ['coins', 'Монетный дождь', 'Coin Trail', 'epic', 6, 'coin', '#ffc928', '#b97500'],
    ['lightning', 'Молнии', 'Lightning', 'epic', 6, 'bolt', '#9fd8ff', '#ffffff'],
    ['aurora', 'Северное сияние', 'Aurora', 'legendary', 7, 'puff', '#46f0b0', '#a36bf2'],
    ['galaxy', 'Галактика', 'Galaxy', 'legendary', 7, 'star', '#b78bff', '#6fb4ff'],
    ['phoenix', 'Феникс', 'Phoenix', 'mythic', 7, 'flame', '#ffb02e', '#e5383b'],
    ['abyss', 'Бездна', 'Abyss', 'mythic', 7, 'puff', '#1d3d6e', '#44ffd4'],
]);

const GD_VICTORY = GD_FX('victory', 'win.', [
    ['confetti', 'Хлопушка', 'Party Popper', 'common', 150, 'square', '#ff5c8a', '#ffd23f'],
    ['fountain', 'Фонтан пузырей', 'Bubble Fountain', 'common', 250, 'bubble', '#bfefff', '#ffffff'],
    ['splash', 'Большой всплеск', 'Big Splash', 'common', 350, 'drop', '#4ab8ff', '#bfe8ff'],
    ['streamers', 'Серпантин', 'Streamers', 'common', 450, 'ribbon', '#ff5c8a', '#4ab8ff'],
    ['balloons', 'Воздушные шары', 'Balloons', 'rare', 700, 'balloon', '#ff5c8a', '#ffd23f'],
    ['coinrain', 'Дождь монет', 'Coin Rain', 'rare', 900, 'coin', '#ffc928', '#b97500'],
    ['golden', 'Золотое сияние', 'Golden Glow', 'epic', 1600, 'spark', '#ffd23f', '#fff3a6'],
    ['fireworks', 'Салют', 'Fireworks', 'epic', 2000, 'spark', '#ff5c8a', '#4ab8ff'],
    ['petals', 'Дождь лепестков', 'Petal Rain', 'common', 1, 'petal', '#ff9fc2', '#ffd6e6'],
    ['snowfall', 'Снегопад', 'Snowfall', 'common', 2, 'snow', '#e8f6ff', '#ffffff'],
    ['hearts', 'Сердечный залп', 'Heart Salvo', 'rare', 3, 'heart', '#ff5c8a', '#ffc2d6'],
    ['ducks', 'Резиновые уточки', 'Rubber Ducks', 'rare', 3, 'duck', '#ffd84a', '#ff9a2e'],
    ['stars', 'Звездопад', 'Starfall', 'rare', 4, 'star', '#ffd23f', '#fff3a6'],
    ['rainbow', 'Радужная дуга', 'Rainbow Arc', 'epic', 5, 'dot', '#ff4f4f', '#4f9fff'],
    ['lightning', 'Грозовой удар', 'Thunder Strike', 'epic', 5, 'bolt', '#9fd8ff', '#ffffff'],
    ['iceburst', 'Ледяной взрыв', 'Ice Burst', 'epic', 6, 'crystal', '#8fd8ff', '#ffffff'],
    ['flames', 'Огненный фонтан', 'Fire Fountain', 'epic', 6, 'flame', '#ff7a1a', '#ffd23f'],
    ['ghosts', 'Хоровод призраков', 'Ghost Round Dance', 'epic', 6, 'ghost', '#dff7ea', '#6fd0a8'],
    ['aurora', 'Сияние', 'Aurora Show', 'legendary', 7, 'puff', '#46f0b0', '#a36bf2'],
    ['megafire', 'Грандиозный салют', 'Grand Finale', 'legendary', 7, 'spark', '#ffd23f', '#ff5c8a'],
    ['phoenixrise', 'Взлёт феникса', 'Phoenix Rise', 'mythic', 7, 'flame', '#ffb02e', '#e5383b'],
    ['abyss', 'Зов бездны', 'Call of the Deep', 'mythic', 7, 'puff', '#1d3d6e', '#44ffd4'],
]);

// Эксклюзивные образы Daily Gift (день 7; в магазине и на колесе их нет): по одному за круг, потом — крупная награда монетами
const GD_DAILY_SKINS = [
    { id: 'star', rarity: 'epic', name: { ru: 'Звезда бассейна', en: 'Pool Star' },
        look: { skin: 0xf1c9a5, shirt: 0xffd23f, pants: 0x6a3fe0, shoes: 0xffd23f, hair: 'spiky', hairColor: 0xfff3a0, hat: 'none', acc: ['goggles', 'scarf'] } },
    { id: 'moon', rarity: 'legendary', name: { ru: 'Лунный пловец', en: 'Moon Swimmer' },
        look: { skin: 0xcfd8ff, shirt: 0x2a2f6b, pants: 0x1a1d45, shoes: 0xcfd8ff, hair: 'long', hairColor: 0xe8ecff, hat: 'none', acc: ['headphones', 'scarf'] } },
    { id: 'champ', rarity: 'mythic', name: { ru: 'Золотой чемпион', en: 'Golden Champion' },
        look: { skin: 0xe6b48a, shirt: 0xffc233, pants: 0xffc233, shoes: 0xffffff, hair: 'short', hairColor: 0x1d1d1d, hat: 'crown', acc: ['ring', 'goggles', 'floaties'] } },
].map((s) => Object.assign({ tab: 'outfit', exclusive: 'daily' }, s));

/** Глифы карточек следов и побед (viewBox 0 0 24 24): основной цвет — currentColor, акцент — класс a (заливка) / s (обводка). */
const GD_GLYPHS = {
    bubble: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="8.6" cy="8.6" r="2.3" class="a"/>',
    drop: '<path d="M12 1.5C12 1.5 4.5 10 4.5 15.2a7.5 7.5 0 0 0 15 0C19.5 10 12 1.5 12 1.5z" fill="currentColor"/><circle cx="9" cy="14.5" r="2.2" class="a"/>',
    leaf: '<path d="M3 21C3 10 10 3 22 3c0 11-6 18-19 18z" fill="currentColor"/><path d="M5 19L16 8" class="s" fill="none" stroke-width="2" stroke-linecap="round"/>',
    petal: '<path d="M12 2C20 8 20 16 12 22 4 16 4 8 12 2z" fill="currentColor"/><path d="M12 7v10" class="s" fill="none" stroke-width="1.8" stroke-linecap="round"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" class="a"/>',
    spark: '<path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="currentColor"/><circle cx="12" cy="12" r="2.2" class="a"/>',
    heart: '<path d="M12 21C3 14.5 1.8 9.5 4.8 6.2 7.6 3.2 11 4.6 12 7.6 13 4.6 16.4 3.2 19.2 6.2c3 3.3 1.8 8.3-7.2 14.8z" fill="currentColor"/><circle cx="7.6" cy="8.2" r="1.7" class="a"/>',
    square: '<g transform="rotate(20 12 12)"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/><rect x="12" y="5" width="7" height="14" rx="2" class="a"/></g>',
    ribbon: '<path d="M2 8c5-6 7 6 10 0s6-5 10 0v5c-4-5-7-5-10 0s-5 6-10 0z" fill="currentColor"/><path d="M4 10c3-3 5 3 8 0" class="s" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
    star: '<path d="M12 1.5l3 6.8 7.4.7-5.6 4.9 1.7 7.3L12 17.4 5.5 21.2l1.7-7.3L1.6 9l7.4-.7z" fill="currentColor"/>',
    note: '<path d="M9 18.5V5l11-2.5v13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="6.5" cy="18.5" rx="3.5" ry="2.8" fill="currentColor"/><ellipse cx="17.5" cy="15.5" rx="3.5" ry="2.8" fill="currentColor"/>',
    duck: '<ellipse cx="11" cy="16" rx="8.5" ry="5.5" fill="currentColor"/><circle cx="16" cy="8.5" r="4.8" fill="currentColor"/><path d="M19.5 8.5L24 10l-4.5 2z" class="a"/><circle cx="17" cy="7.5" r="1.1" fill="#0b3d47"/>',
    clover: '<g fill="currentColor"><circle cx="8" cy="8" r="5"/><circle cx="16" cy="8" r="5"/><circle cx="8" cy="16" r="5"/><circle cx="16" cy="16" r="5"/></g><circle cx="12" cy="12" r="2.2" class="a"/>',
    flame: '<path d="M12 1.5c1.5 5 7 7.5 7 13.5a7 7 0 0 1-14 0c0-4 3-5 3.5-9 1.5 1.5 2.5 1.5 3.5-4.5z" fill="currentColor"/><path d="M12 22a3.8 3.8 0 0 1-3.8-4c0-2.3 2.3-3.3 3.8-6 1.5 2.7 3.8 3.7 3.8 6A3.8 3.8 0 0 1 12 22z" class="a"/>',
    crystal: '<path d="M12 1l7 7-7 15L5 8z" fill="currentColor"/><path d="M12 1l2.5 7L12 23 9.5 8z" class="a"/>',
    ghost: '<path d="M4 22V11a8 8 0 0 1 16 0v11l-3-2.5-2.3 2.5L12 19.5 9.3 22 7 19.5z" fill="currentColor"/><circle cx="9" cy="11" r="1.7" class="a"/><circle cx="15" cy="11" r="1.7" class="a"/>',
    coin: '<circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6.5" fill="none" class="s" stroke-width="2"/>',
    bolt: '<path d="M14 1L4 14h7l-2 9 11-14h-7z" fill="currentColor"/><path d="M13 5l-5 8h5" class="s" fill="none" stroke-width="1.4" stroke-linecap="round"/>',
    puff: '<circle cx="8" cy="14" r="6" fill="currentColor"/><circle cx="16" cy="14" r="6" fill="currentColor"/><circle cx="12" cy="9" r="6.5" fill="currentColor"/><circle cx="10" cy="8" r="2.5" class="a"/>',
    dot: '<circle cx="12" cy="12" r="8" fill="currentColor"/><circle cx="9.5" cy="9.5" r="2.5" class="a"/>',
    balloon: '<ellipse cx="12" cy="9.5" rx="7" ry="8.5" fill="currentColor"/><path d="M10.5 18l1.5 2.5 1.5-2.5z" fill="currentColor"/><path d="M12 20.5q-2 2 0 3" class="s" fill="none" stroke-width="1.5"/><ellipse cx="9" cy="6" rx="1.8" ry="2.8" class="a" transform="rotate(20 9 6)"/>',
};

/** @satisfies {Record<string, any>} */
const GameData = {
    VERSION: 1,
    /** Слотов инструментов в забеге. */
    MAX_SLOTS: 3,
    /** Свободных использований при открытии инструмента в «Снаряжении». */
    UNLOCK_USES: 3,
    /** Боты 0..MAX_BOTS, монстры 1..MAX_MONSTERS в окне «Новый забег». */
    MAX_BOTS: 6,
    MAX_MONSTERS: 3,
    /** Множитель награды за число монстров (индекс = монстров − 1). */
    MONSTER_MULT: [1, 1.5, 2],

    /** Старт нового игрока. */
    START: { coins: 75, items: { pebble: 10, rescue: 1, push: 3 }, bots: 3, monsters: 1 },

    /** Предел стопки припаса (лишнее не начисляется). */
    CAP: { pebble: 999, bottle: 99, toy: 99, flare: 99, rope: 99, push: 99, superpush: 99, rescue: 99 },

    /**
     * Инструменты (слоты забега). free — открыт сразу. unlock — цена открытия в «Снаряжении».
     * refills — пополнение: { n, coins } за монеты или { n, ads } за рекламу (ads просмотров, повторяемо).
     * upgrades — какие улучшения усиливают инструмент (для подсказки в карточке).
     */
    TOOLS: [
        { id: 'pebble', free: true, upgrades: ['throwRange', 'skips'],
            refills: [{ n: 1, coins: 5 }, { n: 5, coins: 25 }, { n: 10, ads: 1 }] },
        { id: 'bottle', unlock: { coins: 150, ads: 2 }, upgrades: ['throwRange'],
            refills: [{ n: 1, coins: 15 }, { n: 5, coins: 70 }, { n: 4, ads: 1 }] },
        { id: 'toy', unlock: { coins: 300, ads: 3 }, upgrades: ['toyBattery'],
            refills: [{ n: 1, coins: 30 }, { n: 3, coins: 85 }, { n: 2, ads: 2 }] },
        { id: 'flare', unlock: { coins: 450, ads: 4 }, upgrades: ['flareRadius'],
            refills: [{ n: 1, coins: 40 }, { n: 3, coins: 110 }, { n: 2, ads: 2 }] },
        { id: 'rope', unlock: { coins: 600, ads: 5 }, upgrades: ['ropeReach'],
            refills: [{ n: 1, coins: 50 }, { n: 3, coins: 140 }, { n: 2, ads: 2 }] },
    ],
    /** Припасы вне слотов: отдельные кнопки забега. */
    EXTRA_ITEMS: ['push', 'superpush', 'rescue'],

    /**
     * Улучшения, уровни 0..3. need — инструмент, без которого улучшение закрыто (null — не нужен; pebble открыт всегда).
     * values — значение на уровне 0..3 (px/с/штуки как в DESIGN.md); unit/div — как показывать (px→м: div 100).
     */
    UPGRADES: [
        { id: 'throwRange', need: null, unit: 'm', div: 100, values: [900, 1000, 1100, 1250] },
        { id: 'skips', need: 'pebble', unit: 'n', div: 1, values: [3, 4, 5, 6] },
        { id: 'toyBattery', need: 'toy', unit: 's', div: 1, values: [6, 7, 8, 10] },
        { id: 'flareRadius', need: 'flare', unit: 'm', div: 100, values: [600, 700, 800, 950] },
        { id: 'ropeReach', need: 'rope', unit: 'm', div: 100, values: [500, 600, 700, 850] },
        { id: 'swimSpeed', need: null, unit: 'mps', div: 100, values: [230, 255, 280, 310] },
    ],
    /** Цена уровня улучшения 1..3: монетами и просмотрами рекламы. */
    UPGRADE_COST: { coins: [100, 250, 500], ads: [2, 4, 6] },

    /** Вкладки магазина (всё — за рекламу). */
    SHOP_TABS: ['coins', 'supplies', 'rescue', 'push', 'pass'],
    /**
     * Предложения магазина. ads — просмотров (1..7). give: coins, items { id: n }, unlock [tool], pass 'x2'|'maxed'|'rope'.
     * Выдача инструментов пачкой открывает их (стопка без инструмента бесполезна), без бесплатных использований.
     */
    OFFERS: [
        { id: 'coins150', tab: 'coins', ads: 1, icon: 'coinpile', give: { coins: 150 } },
        { id: 'coins600', tab: 'coins', ads: 3, icon: 'coinpile', give: { coins: 600 } },
        { id: 'coins2000', tab: 'coins', ads: 7, icon: 'coinpile', give: { coins: 2000 } },
        { id: 'pebble20', tab: 'supplies', ads: 1, icon: 'pebble', give: { items: { pebble: 20 } } },
        { id: 'bottle8', tab: 'supplies', ads: 2, icon: 'bottle', give: { items: { bottle: 8 }, unlock: ['bottle'] } },
        { id: 'toy5', tab: 'supplies', ads: 3, icon: 'toy', give: { items: { toy: 5 }, unlock: ['toy'] } },
        { id: 'flare4', tab: 'supplies', ads: 3, icon: 'flare', give: { items: { flare: 4 }, unlock: ['flare'] } },
        { id: 'rope4', tab: 'supplies', ads: 4, icon: 'rope', give: { items: { rope: 4 }, unlock: ['rope'] } },
        { id: 'starter', tab: 'supplies', ads: 5, icon: 'gift',
            give: { coins: 300, items: { rescue: 1, pebble: 20, bottle: 3, toy: 2 }, unlock: ['bottle', 'toy'] } },
        { id: 'rescue1', tab: 'rescue', ads: 1, icon: 'rescue', give: { items: { rescue: 1 } } },
        { id: 'rescue3', tab: 'rescue', ads: 2, icon: 'rescue', give: { items: { rescue: 3 } } },
        { id: 'rescue10', tab: 'rescue', ads: 6, icon: 'rescue', give: { items: { rescue: 10 } } },
        { id: 'push3', tab: 'push', ads: 1, icon: 'push', give: { items: { push: 3 } } },
        { id: 'push10', tab: 'push', ads: 3, icon: 'push', give: { items: { push: 10 } } },
        { id: 'super2', tab: 'push', ads: 2, icon: 'superpush', give: { items: { superpush: 2 } } },
        { id: 'passX2', tab: 'pass', ads: 7, icon: 'x2', give: { pass: 'x2' }, once: true },
        { id: 'passMax', tab: 'pass', ads: 7, icon: 'maxed', give: { pass: 'maxed', unlock: ['toy', 'flare', 'rope'] }, once: true },
        { id: 'passRope', tab: 'pass', ads: 6, icon: 'infinity', give: { pass: 'rope', unlock: ['rope'] }, once: true },
    ],

    /** Уровни 1..10: карта pool-N, названия ru/en. */
    LEVELS: [
        { n: 1, map: 'pool-1', name: { ru: 'Мелководье', en: 'Shallow Hall' } },
        { n: 2, map: 'pool-2', name: { ru: 'Колонный зал', en: 'Pillar Hall' } },
        { n: 3, map: 'pool-3', name: { ru: 'Лабиринт дорожек', en: 'Walkway Maze' } },
        { n: 4, map: 'pool-4', name: { ru: 'Плавучие плиты', en: 'Drifting Slabs' } },
        { n: 5, map: 'pool-5', name: { ru: 'Горки и ступени', en: 'Slides & Stairs' } },
        { n: 6, map: 'pool-6', name: { ru: 'Плитки-кочки', en: 'Stepping Tiles' } },
        { n: 7, map: 'pool-7', name: { ru: 'Крошащийся пол', en: 'Crumbling Floor' } },
        { n: 8, map: 'pool-8', name: { ru: 'Двойные залы', en: 'Twin Halls' } },
        { n: 9, map: 'pool-9', name: { ru: 'Бесконечный зал', en: 'Endless Hall' } },
        { n: 10, map: 'pool-10', name: { ru: 'Глубина', en: 'The Deep' } },
    ],

    /** Редкости скинов по возрастанию; ads — диапазон просмотров. */
    RARITIES: ['common', 'rare', 'epic', 'legendary', 'mythic'],
    /** Вес редкости при случайной выдаче предмета (Daily Gift, колесо): обычное выпадает чаще. */
    RARITY_WEIGHT: { common: 8, rare: 4, epic: 1.5, legendary: 0.6, mythic: 0.25 },

    /**
     * Скины (24). look — вид героя как в DESIGN.md: цвета 0xRRGGBB, hair: short spiky long bun mohawk curly none,
     * hat: none cap swimcap beanie bucket crown, acc: goggles snorkel floaties backpack scarf ring headphones.
     * price: { coins } | { ads } | отсутствует (бесплатный).
     */
    SKINS: [
        { id: 'visitor', rarity: 'common', default: true, name: { ru: 'Посетитель', en: 'Visitor' },
            look: { skin: 0xf0c6a0, shirt: 0x4fc3c7, pants: 0xf3efe2, shoes: 0x3f6f8f, hair: 'short', hairColor: 0x2b2f3a, hat: 'none', acc: [] } },
        // --- за монеты (8) ---
        { id: 'swimmer', rarity: 'common', price: { coins: 200 }, name: { ru: 'Пловец', en: 'Swimmer' },
            look: { skin: 0xd9a273, shirt: 0x2f86d6, pants: 0x2f86d6, shoes: 0xf3efe2, hair: 'none', hairColor: 0x222222, hat: 'swimcap', acc: ['goggles'] } },
        { id: 'beach', rarity: 'common', price: { coins: 300 }, name: { ru: 'Пляжник', en: 'Beachgoer' },
            look: { skin: 0xf2c19b, shirt: 0xff7a5c, pants: 0xf5e6a8, shoes: 0xd96b4f, hair: 'curly', hairColor: 0x5a3320, hat: 'bucket', acc: [] } },
        { id: 'lifeguard', rarity: 'common', price: { coins: 400 }, name: { ru: 'Спасатель', en: 'Lifeguard' },
            look: { skin: 0xc98d63, shirt: 0xf5f1e8, pants: 0xdc3b3b, shoes: 0xdc3b3b, hair: 'short', hairColor: 0x1d1d1d, hat: 'cap', acc: ['ring'] } },
        { id: 'diver', rarity: 'rare', price: { coins: 600 }, name: { ru: 'Дайвер', en: 'Diver' },
            look: { skin: 0x8d5a3b, shirt: 0x23272f, pants: 0x23272f, shoes: 0xffc233, hair: 'none', hairColor: 0x111111, hat: 'none', acc: ['goggles', 'snorkel'] } },
        { id: 'tourist', rarity: 'rare', price: { coins: 800 }, name: { ru: 'Турист', en: 'Tourist' },
            look: { skin: 0xf4cfa8, shirt: 0x7bd0a4, pants: 0xe9e2c9, shoes: 0x8a6d4d, hair: 'bun', hairColor: 0x3d2a1e, hat: 'none', acc: ['backpack', 'headphones'] } },
        { id: 'dj', rarity: 'rare', price: { coins: 1000 }, name: { ru: 'Диджей', en: 'Pool DJ' },
            look: { skin: 0xc08460, shirt: 0x7a3fe0, pants: 0x22202e, shoes: 0xff4fa3, hair: 'mohawk', hairColor: 0x2ee6d6, hat: 'none', acc: ['headphones', 'goggles'] } },
        { id: 'snorkeler', rarity: 'epic', price: { coins: 1250 }, name: { ru: 'Любитель маски', en: 'Snorkeler' },
            look: { skin: 0xe6b48a, shirt: 0xffd23f, pants: 0x15a3a0, shoes: 0x15a3a0, hair: 'spiky', hairColor: 0x1b3b5a, hat: 'none', acc: ['snorkel', 'goggles', 'floaties'] } },
        { id: 'captain', rarity: 'epic', price: { coins: 1500 }, name: { ru: 'Капитан бассейна', en: 'Pool Captain' },
            look: { skin: 0xf1c9a5, shirt: 0xf4f1e8, pants: 0x1a3a63, shoes: 0x1a1a1a, hair: 'long', hairColor: 0x9aa7b5, hat: 'cap', acc: ['scarf'] } },
        // --- за рекламу: обычные 1–2 ---
        { id: 'duckling', rarity: 'common', price: { ads: 1 }, name: { ru: 'Утёнок', en: 'Duckling' },
            look: { skin: 0xf0c79f, shirt: 0xffd84a, pants: 0xffd84a, shoes: 0xff9a2e, hair: 'none', hairColor: 0x222222, hat: 'none', acc: ['floaties'] } },
        { id: 'mint', rarity: 'common', price: { ads: 1 }, name: { ru: 'Мятный', en: 'Minty' },
            look: { skin: 0xdca67a, shirt: 0x7fe3c3, pants: 0xfbfbf0, shoes: 0x2a8f86, hair: 'curly', hairColor: 0x2a1f1a, hat: 'none', acc: [] } },
        { id: 'sporty', rarity: 'common', price: { ads: 2 }, name: { ru: 'Спортсмен', en: 'Athlete' },
            look: { skin: 0x8d5a3b, shirt: 0xff5a6e, pants: 0x2c3342, shoes: 0xffffff, hair: 'short', hairColor: 0x111111, hat: 'cap', acc: ['headphones'] } },
        { id: 'bubble', rarity: 'common', price: { ads: 2 }, name: { ru: 'Пузырь', en: 'Bubble' },
            look: { skin: 0xf3d0b0, shirt: 0xb8e6ff, pants: 0xa5d8f7, shoes: 0xffffff, hair: 'bun', hairColor: 0x6a4cc7, hat: 'none', acc: ['goggles'] } },
        { id: 'sunhat', rarity: 'common', price: { ads: 2 }, name: { ru: 'Соломенная шляпа', en: 'Sun Hat' },
            look: { skin: 0xe2b48b, shirt: 0xfff1c9, pants: 0xff8fa3, shoes: 0xf2c14e, hair: 'long', hairColor: 0x4a2f1f, hat: 'bucket', acc: [] } },
        // --- редкие 3–4 ---
        { id: 'surfer', rarity: 'rare', price: { ads: 3 }, name: { ru: 'Сёрфер', en: 'Surfer' },
            look: { skin: 0xd9a273, shirt: 0x16c1c9, pants: 0xf26b4f, shoes: 0xf4efe0, hair: 'spiky', hairColor: 0xe8d28a, hat: 'none', acc: ['goggles'] } },
        { id: 'retro', rarity: 'rare', price: { ads: 3 }, name: { ru: 'Ретро-пловец', en: 'Retro Swimmer' },
            look: { skin: 0xf0c6a0, shirt: 0xe23d3d, pants: 0xf6f1e4, shoes: 0xe23d3d, hair: 'none', hairColor: 0x222222, hat: 'swimcap', acc: ['goggles'] } },
        { id: 'frost', rarity: 'rare', price: { ads: 3 }, name: { ru: 'Ледяной', en: 'Frosty' },
            look: { skin: 0xcfe9f7, shirt: 0x4aa8ff, pants: 0xe8f6ff, shoes: 0x9fd8ff, hair: 'spiky', hairColor: 0x9fd8ff, hat: 'beanie', acc: ['scarf'] } },
        { id: 'pirate', rarity: 'rare', price: { ads: 4 }, name: { ru: 'Пират бассейна', en: 'Pool Pirate' },
            look: { skin: 0xc58d5f, shirt: 0x2b2b3a, pants: 0x6b2f2f, shoes: 0x1c1c1c, hair: 'long', hairColor: 0x1a1a1a, hat: 'beanie', acc: ['scarf'] } },
        { id: 'coral', rarity: 'rare', price: { ads: 4 }, name: { ru: 'Коралл', en: 'Coral' },
            look: { skin: 0xf7b2a0, shirt: 0xff6f91, pants: 0x2bb3a3, shoes: 0x2bb3a3, hair: 'curly', hairColor: 0xff9acd, hat: 'none', acc: ['floaties', 'goggles'] } },
        // --- эпические 5–6 ---
        { id: 'neon', rarity: 'epic', price: { ads: 5 }, name: { ru: 'Неон', en: 'Neon' },
            look: { skin: 0xd5a98a, shirt: 0x1f1b3a, pants: 0x1f1b3a, shoes: 0x2ef2d0, hair: 'mohawk', hairColor: 0xff3fa4, hat: 'none', acc: ['goggles', 'headphones'] } },
        { id: 'mer', rarity: 'epic', price: { ads: 5 }, name: { ru: 'Русал', en: 'Merfolk' },
            look: { skin: 0xbfe8d9, shirt: 0x20b2aa, pants: 0x7a4bd1, shoes: 0x20b2aa, hair: 'long', hairColor: 0x2fe0c0, hat: 'none', acc: ['scarf'] } },
        { id: 'bot', rarity: 'epic', price: { ads: 6 }, name: { ru: 'Робот-чистильщик', en: 'Cleaner Bot' },
            look: { skin: 0xaeb8c4, shirt: 0x5d6b7a, pants: 0x3b4655, shoes: 0xffc233, hair: 'none', hairColor: 0x222222, hat: 'bucket', acc: ['backpack', 'goggles'] } },
        // --- легендарные 7 ---
        { id: 'king', rarity: 'legendary', price: { ads: 7 }, name: { ru: 'Король бассейна', en: 'Pool King' },
            look: { skin: 0xf0c49c, shirt: 0xffc233, pants: 0x1a9fa6, shoes: 0xfff3c4, hair: 'curly', hairColor: 0x5a3a22, hat: 'crown', acc: ['ring', 'scarf'] } },
        { id: 'abyss', rarity: 'legendary', price: { ads: 7 }, name: { ru: 'Повелитель глубин', en: 'Abyss Lord' },
            look: { skin: 0x6fd1d1, shirt: 0x0e4c6e, pants: 0x08324a, shoes: 0xffd24a, hair: 'spiky', hairColor: 0x44ffd4, hat: 'crown', acc: ['goggles', 'snorkel', 'backpack'] } },
    ],

    // ------------------------------------------------------------------------------------------------
    // Косметика (магазин «Скины»): 6 вкладок. Образы — SKINS (+ эксклюзивы Daily Gift), остальное — GD_* выше.
    // ------------------------------------------------------------------------------------------------
    /** Вкладки: образ — основа вида, остальные перекрывают его части; следы и победы — отдельные слоты. */
    COSMETIC_TABS: ['outfit', 'hair', 'hat', 'acc', 'trail', 'victory'],
    /** Слоты, которые можно снять (образ снять нельзя — он основа). */
    OPT_SLOTS: ['hair', 'hat', 'acc', 'trail', 'victory'],
    /** Предметы вкладок кроме образов. */
    COSMETICS: [].concat(GD_HAIR, GD_HAT, GD_ACC, GD_TRAIL, GD_VICTORY),
    /** Эксклюзивные образы дня 7 Daily Gift (очередь по кругам). */
    DAILY_SKINS: GD_DAILY_SKINS,
    /** Глифы карточек следов и побед. */
    GLYPHS: GD_GLYPHS,
    /** Кэш реестра предметов (allItems). @type {any} */
    _cache: null,

    /**
     * Daily Gift: награды дней 1–6 (coins > 0 у каждого — иначе нет «x2 за рекламу»), день 7 — эксклюзивный образ из очереди
     * exclusive, потом крупная награда монетами (DAILY_FALLBACK_COINS в Constants.js). item 'sup.*' — припасы (SUPPLY_PACKS).
     */
    DAILY: {
        rewards: [
            { coins: 50 },
            { coins: 80, item: 'sup.pebble.10' },
            { coins: 120, item: 'sup.bottle.3' },
            { coins: 160, randomItems: 1, maxRarity: 'rare' },
            { coins: 220, item: 'sup.rescue.2' },
            { coins: 320, randomItems: 1, maxRarity: 'epic' },
        ],
        exclusive: ['star', 'moon', 'champ'],
    },

    /** Колесо фортуны: 10 секторов (вес = шанс), монеты и припасы, редко — предмет магазина (randomItem: выбирается раз в сутки). */
    WHEEL: [
        { coins: 30, weight: 22, icon: 'coin' },
        { item: 'sup.pebble.10', weight: 12 },
        { coins: 60, weight: 18, icon: 'coin' },
        { item: 'sup.bottle.3', weight: 9 },
        { coins: 120, weight: 12, icon: 'coinpile' },
        { item: 'sup.rescue.1', weight: 8 },
        { coins: 250, weight: 6, icon: 'coinpile' },
        { randomItem: true, maxRarity: 'epic', weight: 4, icon: 'gift' },
        { item: 'sup.toy.2', weight: 6 },
        { coins: 500, weight: 2, icon: 'coinpile' },
    ],

    /** Припасы как «предметы» наград Daily Gift и колеса: id -> { item: id припаса, n }. */
    SUPPLY_PACKS: {
        'sup.pebble.10': { item: 'pebble', n: 10 },
        'sup.bottle.3': { item: 'bottle', n: 3 },
        'sup.toy.2': { item: 'toy', n: 2 },
        'sup.rescue.1': { item: 'rescue', n: 1 },
        'sup.rescue.2': { item: 'rescue', n: 2 },
    },

    // ------------------------------------------------------------------------------------------------
    // Тексты каталога: { ru, en } под ключами для Lang (регистрируются ниже, при загрузке файла)
    // ------------------------------------------------------------------------------------------------
    TEXT: {
        'tool.pebble': ['Камешек', 'Pebble'], 'tool.pebble.d': ['Бросок вперёд. На воде «блинчики» — серия всплесков уводит монстра.', 'Thrown ahead. It skips on the water: a chain of splashes lures the monster away.'],
        'tool.bottle': ['Бутылка', 'Bottle'], 'tool.bottle.d': ['Один громкий всплеск далеко: монстр плывёт на звук издалека.', 'One loud splash far away: the monster swims to it from afar.'],
        'tool.toy': ['Заводная утка', 'Wind-up duck'], 'tool.toy.d': ['Плывёт по воде и шумит: монстр гонится за ней.', 'Swims along and quacks: the monster chases it.'],
        'tool.flare': ['Фальшфейер', 'Flare'], 'tool.flare.d': ['Горит в руке 10 секунд: монстр не подходит ближе.', 'Burns in your hand for 10 s: the monster keeps its distance.'],
        'tool.rope': ['Верёвка', 'Rope'], 'tool.rope.d': ['В воде вытаскивает на ближайшую платформу.', 'In the water it pulls you onto the nearest platform.'],
        'tool.push': ['Толчок', 'Push'], 'tool.push.d': ['Толкает бота перед собой на 3 м.', 'Shoves a bot ahead of you by 3 m.'],
        'tool.superpush': ['Супертолчок', 'Super push'], 'tool.superpush.d': ['Толкает бота на 5 м, и он падает в воду.', 'Launches a bot 5 m, straight into the water.'],
        'tool.rescue': ['Спасательный круг', 'Lifebuoy'], 'tool.rescue.d': ['Спасает, когда монстр схватил.', 'Saves you when the monster grabs you.'],

        'up.throwRange': ['Дальность броска', 'Throw range'], 'up.throwRange.d': ['Камешек и бутылка летят дальше.', 'Pebbles and bottles fly farther.'],
        'up.skips': ['Блинчики', 'Skips'], 'up.skips.d': ['Больше отскоков камешка по воде.', 'More pebble skips on the water.'],
        'up.toyBattery': ['Завод утки', 'Duck battery'], 'up.toyBattery.d': ['Утка плывёт и шумит дольше.', 'The duck swims and quacks longer.'],
        'up.flareRadius': ['Радиус фальшфейера', 'Flare radius'], 'up.flareRadius.d': ['Монстр держится дальше от тебя.', 'The monster stays farther away.'],
        'up.ropeReach': ['Длина верёвки', 'Rope reach'], 'up.ropeReach.d': ['Верёвка достаёт до дальних платформ.', 'The rope reaches farther platforms.'],
        'up.swimSpeed': ['Скорость плавания', 'Swim speed'], 'up.swimSpeed.d': ['Быстрее выбираешься из воды.', 'You get out of the water faster.'],

        'offer.coins150': ['+150 монет', '+150 coins'], 'offer.coins150.d': ['Горсть монет в карман.', 'A handful of coins.'],
        'offer.coins600': ['+600 монет', '+600 coins'], 'offer.coins600.d': ['Хватит на пару инструментов.', 'Enough for a couple of tools.'],
        'offer.coins2000': ['+2000 монет', '+2000 coins'], 'offer.coins2000.d': ['Целый сундук монет.', 'A whole chest of coins.'],
        'offer.pebble20': ['20 камешков', '20 pebbles'], 'offer.pebble20.d': ['Запас на много бросков.', 'Plenty of throws.'],
        'offer.bottle8': ['8 бутылок', '8 bottles'], 'offer.bottle8.d': ['Открывает бутылку, если её нет.', 'Also unlocks the bottle.'],
        'offer.toy5': ['5 заводных уток', '5 wind-up ducks'], 'offer.toy5.d': ['Открывает утку, если её нет.', 'Also unlocks the duck.'],
        'offer.flare4': ['4 фальшфейера', '4 flares'], 'offer.flare4.d': ['Открывает фальшфейер, если его нет.', 'Also unlocks the flare.'],
        'offer.rope4': ['4 верёвки', '4 ropes'], 'offer.rope4.d': ['Открывает верёвку, если её нет.', 'Also unlocks the rope.'],
        'offer.starter': ['Стартовый набор', 'Starter pack'], 'offer.starter.d': ['300 монет, круг, 20 камешков, 3 бутылки, 2 утки.', '300 coins, a lifebuoy, 20 pebbles, 3 bottles, 2 ducks.'],
        'offer.rescue1': ['Спасательный круг', 'Lifebuoy'], 'offer.rescue1.d': ['Один круг на чёрный день.', 'One lifebuoy for a rainy day.'],
        'offer.rescue3': ['3 круга', '3 lifebuoys'], 'offer.rescue3.d': ['Три спасения от монстра.', 'Three rescues from the monster.'],
        'offer.rescue10': ['10 кругов', '10 lifebuoys'], 'offer.rescue10.d': ['Можно не бояться глубины.', 'No fear of the deep.'],
        'offer.push3': ['3 толчка', '3 pushes'], 'offer.push3.d': ['Столкни бота на ходу.', 'Shove a bot on the run.'],
        'offer.push10': ['10 толчков', '10 pushes'], 'offer.push10.d': ['Запас для целого забега.', 'Enough for a whole run.'],
        'offer.super2': ['2 супертолчка', '2 super pushes'], 'offer.super2.d': ['Бот летит прямо в воду.', 'The bot flies straight into the water.'],
        'offer.passX2': ['Монеты ×2 навсегда', 'Coins ×2 forever'], 'offer.passX2.d': ['Все монеты за забеги удваиваются.', 'All coins from runs are doubled.'],
        'offer.passMax': ['Все улучшения на максимум', 'All upgrades maxed'], 'offer.passMax.d': ['Навсегда. Открывает утку, фальшфейер и верёвку.', 'Forever. Also unlocks duck, flare and rope.'],
        'offer.passRope': ['Бесконечная верёвка', 'Endless rope'], 'offer.passRope.d': ['Верёвка не кончается. Открывает верёвку.', 'The rope never runs out. Also unlocks the rope.'],

        'skin.rarity.common': ['Обычный', 'Common'], 'skin.rarity.rare': ['Редкий', 'Rare'],
        'skin.rarity.epic': ['Эпический', 'Epic'], 'skin.rarity.legendary': ['Легендарный', 'Legendary'], 'skin.rarity.mythic': ['Мифический', 'Mythic'],
    },

    // ------------------------------------------------------------------------------------------------
    // Чистые функции над данными
    // ------------------------------------------------------------------------------------------------

    /** Инструмент по id или null. */
    tool(id) { return this.TOOLS.find((t) => t.id === id) || null; },
    /** Улучшение по id или null. */
    upgrade(id) { return this.UPGRADES.find((u) => u.id === id) || null; },
    /** Образ (вкладка outfit) по id или null: магазинные SKINS и эксклюзивы Daily Gift. */
    skin(id) { return this.SKINS.find((s) => s.id === id) || this.DAILY_SKINS.find((s) => s.id === id) || null; },
    /** Все предметы всех вкладок (образы с tab: 'outfit', затем остальные), кэш. */
    allItems() {
        if (!this._cache) {
            /** @type {any[]} */
            const all = [].concat(/** @type {any} */ (this.SKINS.map((s) => Object.assign({ tab: 'outfit' }, s))), /** @type {any} */ (this.DAILY_SKINS), /** @type {any} */ (this.COSMETICS));
            const by = new Map();
            for (const it of all) by.set(it.id, it);
            this._cache = { all, by };
        }
        return this._cache.all;
    },
    /** Предмет любой вкладки по id или null. */
    item(id) { this.allItems(); return this._cache.by.get(id) || null; },
    /** Предметы вкладки в порядке каталога. */
    itemsOf(tab) { return this.allItems().filter((it) => it.tab === tab); },
    /** id образов (магазинные + эксклюзивы). */
    outfitIds() { return this.itemsOf('outfit').map((it) => it.id); },
    /** Припас-награда по id 'sup.*' или null. */
    supply(id) { return Object.prototype.hasOwnProperty.call(this.SUPPLY_PACKS, id) ? this.SUPPLY_PACKS[id] : null; },
    /** Цена предмета в монетах / просмотрах рекламы (0 — нет такой цены). */
    coinPrice(it) { return (it && it.price && it.price.coins) | 0; },
    adPrice(it) { return (it && it.price && it.price.ads) | 0; },
    /** Идентификатор «за рекламу» для предмета: образы — skin:<id>, остальное — cos:<id>. */
    adIdOf(id) { const it = this.item(id); return it ? (it.tab === 'outfit' ? 'skin:' : 'cos:') + id : ''; },
    /** Название предмета на языке игры. */
    itemName(id) {
        const it = this.item(id);
        if (it) return this.tr((it.tab === 'outfit' ? 'skin.' : 'cos.') + id, it.name);
        const sp = this.supply(id);
        return sp ? this.tr('tool.' + sp.item) + ' ×' + sp.n : String(id);
    },
    /**
     * Каталог в форме Shop.validate (js/Shop.js): { tabs, items }. Бесплатные «пустые» предметы идут как default (не считаются в долях),
     * эксклюзивы Daily Gift — exclusive. Лимит рекламы у Shop.validate 1..5 (SHOP_ADS_MAX), у этой игры 1..7: проверяет Eco.validateCatalog().
     */
    catalog() {
        return {
            tabs: this.COSMETIC_TABS.map((id) => ({ id })),
            items: this.allItems().map((it) => Object.assign({}, it, it.free || it.default ? { default: true } : null)),
        };
    },
    /** Предложение магазина по id или null. */
    offer(id) { return this.OFFERS.find((o) => o.id === id) || null; },
    /** Уровень 1..10 или null. */
    level(n) { return this.LEVELS.find((l) => l.n === (n | 0)) || null; },
    /** Id всех припасов (инструменты + толчки + круг). */
    itemIds() { return this.TOOLS.map((t) => t.id).concat(this.EXTRA_ITEMS); },
    /** Название уровня на языке игры. */
    levelName(n) { return this.tr('level.' + (n | 0), (this.level(n) || { name: { ru: '', en: '' } }).name); },
    /** Карта уровня ('pool-3') или ''. */
    mapId(n) { const l = this.level(n); return l ? l.map : ''; },

    /** Базовая награда уровня: 40 + 15·N монет. */
    levelReward(n) { return 40 + 15 * Math.max(1, n | 0); },
    /** Множитель за число монстров (1 / 1.5 / 2). */
    monsterMult(monsters) { return this.MONSTER_MULT[Math.max(1, Math.min(this.MAX_MONSTERS, monsters | 0 || 1)) - 1]; },
    /** Награда за прохождение с учётом монстров. */
    runReward(n, monsters) { return Math.round(this.levelReward(n) * this.monsterMult(monsters)); },
    /** Просмотров рекламы, чтобы открыть уровень n без прохождения предыдущего: max(1, min(7, n−2)); уровень 1 открыт всегда. */
    levelAds(n) { return n <= 1 ? 0 : Math.max(1, Math.min(7, n - 2)); },

    /** Цена открытия инструмента { coins, ads } или null (открыт сразу). */
    unlockCost(toolId) { const t = this.tool(toolId); return t && t.unlock ? t.unlock : null; },
    /** Рекламное пополнение инструмента { n, ads } или null. */
    adRefill(toolId) { const t = this.tool(toolId); return t ? (t.refills.find((r) => r.ads) || null) : null; },
    /** Пополнения за монеты (в порядке цен). */
    coinRefills(toolId) { const t = this.tool(toolId); return t ? t.refills.filter((r) => r.coins) : []; },
    /** Значение улучшения на уровне. */
    upValue(id, level) { const u = this.upgrade(id); return u ? u.values[Math.max(0, Math.min(3, level | 0))] : 0; },
    /** Показываемое значение (м, с, штуки). */
    upShown(id, level) {
        const u = this.upgrade(id);
        if (!u) return 0;
        const v = u.values[Math.max(0, Math.min(3, level | 0))] / u.div;
        return Math.round(v * 100) / 100;
    },

    /** Все id предложений «за рекламу» (для проверки сохранений). */
    adOfferIds() {
        const out = [];
        for (const o of this.OFFERS) out.push('shop:' + o.id);
        for (const t of this.TOOLS) {
            if (t.unlock) out.push('unlock:' + t.id);
            if (this.adRefill(t.id)) out.push('refill:' + t.id);
        }
        for (const u of this.UPGRADES) for (let l = 1; l <= 3; l++) out.push('up:' + u.id + ':' + l);
        for (let n = 2; n <= this.LEVELS.length; n++) out.push('level:' + n);
        for (const it of this.allItems()) if (this.adPrice(it) && !it.exclusive) out.push(this.adIdOf(it.id));
        return out;
    },

    /**
     * Описание предложения «за рекламу» по id: { id, kind, need, type, repeat, ... } или null.
     * kind: shop | refill | unlock | up | level | skin; type — для Platform.rewarded.
     */
    adOffer(id) {
        const p = String(id || '').split(':');
        const kind = p[0], a = p[1];
        if (kind === 'shop') {
            const o = this.offer(a);
            return o ? { id, kind, type: 'shop-offer', need: o.ads, repeat: !o.once, offer: o } : null;
        }
        if (kind === 'refill') {
            const r = this.adRefill(a);
            return r ? { id, kind, type: 'shop-offer', need: r.ads, repeat: true, tool: a, n: r.n } : null;
        }
        if (kind === 'unlock') {
            const c = this.unlockCost(a);
            return c ? { id, kind, type: 'unlock-tool', need: c.ads, repeat: false, tool: a } : null;
        }
        if (kind === 'up') {
            const u = this.upgrade(a), lvl = Number(p[2]) | 0;
            return u && lvl >= 1 && lvl <= 3 ? { id, kind, type: 'upgrade', need: this.UPGRADE_COST.ads[lvl - 1], repeat: false, up: a, level: lvl } : null;
        }
        if (kind === 'level') {
            const n = Number(a) | 0;
            return n >= 2 && n <= this.LEVELS.length ? { id, kind, type: 'unlock-level', need: this.levelAds(n), repeat: false, n } : null;
        }
        if (kind === 'skin') {
            const s = this.skin(a);
            return s && s.price && s.price.ads && !s.exclusive ? { id, kind, type: 'skin', need: s.price.ads, repeat: false, skin: a } : null;
        }
        if (kind === 'cos') {
            const it = this.item(a);
            return it && it.tab !== 'outfit' && this.adPrice(it) && !it.exclusive ? { id, kind, type: 'cosmetic', need: it.price.ads, repeat: false, cos: a } : null;
        }
        return null;
    },

    // ------------------------------------------------------------------------------------------------
    // Тексты
    // ------------------------------------------------------------------------------------------------

    /** Строка каталога на языке игры: ключ Lang (если есть), иначе { ru, en }. */
    tr(key, fallback) {
        if (typeof Lang !== 'undefined' && Lang.has(key)) return Lang.t(key);
        if (fallback) return fallback[(typeof Lang !== 'undefined' && Lang.code) || 'ru'] || fallback.en || '';
        return key;
    },

    // ------------------------------------------------------------------------------------------------
    // Иконки
    // ------------------------------------------------------------------------------------------------

    /**
     * Растровые иконки: id -> путь. ПУСТО, пока Codex не нарисовал assets/ui/*.webp: добавляй пары по мере появления
     * файлов (путь — строковым литералом). Для id из этой карты icon() отдаёт картинку вместо встроенного SVG.
     * @type {Record<string, string>}
     */
    RASTER: {},

    /** HTML иконки: <img> из RASTER или встроенный SVG. cls — класс корня. */
    icon(id, cls) {
        const c = 'bpm-ico' + (cls ? ' ' + cls : '');
        const src = this.RASTER[id];
        if (src) return '<img class="' + c + '" src="' + src + '" alt="" draggable="false">';
        const body = this.ICONS[id];
        if (!body) return '<span class="' + c + '"></span>';
        return '<svg class="' + c + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + body + '</svg>';
    },

    /** Встроенные SVG (содержимое, viewBox 0 0 64 64): контур чернильный, заливки в палитре «бассейна». */
    ICONS: (() => {
        const k = '#0b3d47';
        const s = (w) => 'stroke="' + k + '" stroke-width="' + (w || 3) + '" stroke-linejoin="round" stroke-linecap="round"';
        const line = (c, w) => 'fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
        // Ладонь: общий контур (толстая тёмная обводка по объединению форм), поверх — заливка и подробности
        const palmShapes = [[15.5, 14], [22.8, 9], [30.1, 12], [37.4, 19]].map((f) => '<rect x="' + f[0] + '" y="' + f[1] + '" width="6.6" height="' + (40 - f[1]) + '" rx="3.3"/>').join('') +
            '<rect x="14" y="30" width="31" height="26" rx="10"/><rect x="39.5" y="26" width="7.4" height="26" rx="3.7" transform="rotate(46 43 46)"/>';
        const palm = (fill, shade) => '<g fill="none" stroke="' + k + '" stroke-width="6.5" stroke-linejoin="round">' + palmShapes + '</g><g fill="' + fill + '">' + palmShapes + '</g>' +
            '<path d="M22.1 22v14M29.4 17v19M36.7 24v12M20 44q0 6 6 8" fill="none" stroke="' + shade + '" stroke-width="1.8" stroke-linecap="round"/>';
        const whoosh = '<path d="M3 20h8M1 31h10M4 42h7" ' + line(k, 7.5) + '/><path d="M3 20h8M1 31h10M4 42h7" ' + line('#2fc4cf', 3.5) + '/>';
        const gl = (name, x, y, sc, c) => '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')" color="' + c + '">' + GD_GLYPHS[name] + '</g>';
        const wheelWedges = (() => {
            const cols = ['#ffd23f', '#ff6f91', '#4fc3f7', '#46d977'];
            let w = '';
            for (let i = 0; i < 8; i++) {
                const a0 = (i / 8) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / 8) * 2 * Math.PI - Math.PI / 2, r = 24;
                w += '<path d="M32 34L' + (32 + r * Math.cos(a0)).toFixed(1) + ' ' + (34 + r * Math.sin(a0)).toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + (32 + r * Math.cos(a1)).toFixed(1) + ' ' + (34 + r * Math.sin(a1)).toFixed(1) + 'z" fill="' + cols[i % 4] + '"/>';
            }
            return w;
        })();
        const coin = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#ffd23f" ' + s(3) + '/><circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.6) + '" fill="none" stroke="#d98f00" stroke-width="2.4"/>';
        return {
            coin: '<circle cx="32" cy="32" r="25" fill="#ffd23f" ' + s(3.5) + '/><circle cx="32" cy="32" r="17" fill="#ffc021" stroke="#d98f00" stroke-width="2.5"/>' +
                '<path d="M23 34q4.5-7 9 0t9 0" ' + line('#b97500', 3.2) + '/><path d="M16 24a19 19 0 0 1 9-9" ' + line('#fff', 3.2) + ' opacity=".85"/>',
            coinpile: coin(21, 40, 15) + coin(43, 41, 14) + coin(32, 22, 15),
            pebble: '<path d="M8 40c0-11 10-19 24-19 15 0 24 8 24 19 0 10-10 15-24 15S8 50 8 40z" fill="#c7d0d5" ' + s(3.5) + '/>' +
                '<path d="M16 37c3-7 10-11 18-11" ' + line('#fff', 3.5) + ' opacity=".85"/><path d="M18 47c8 4 20 4 30-1" ' + line('#9aa8b0', 3) + '/>' +
                '<path d="M4 59q6-4 12 0t12 0 12 0 12 0 12 0" ' + line('#2fc4cf', 3) + '/>',
            bottle: '<rect x="26" y="4" width="12" height="9" rx="2.5" fill="#d9a15a" ' + s(3) + '/>' +
                '<path d="M27 13h10v9c0 4 9 6 9 15v15a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V37c0-9 9-11 9-15z" fill="#8fe8e0" ' + s(3.5) + '/>' +
                '<rect x="25" y="33" width="14" height="15" rx="2" fill="#fff6dc" stroke="' + k + '" stroke-width="2.5"/><path d="M28 39h8M28 43h6" ' + line('#c98a4b', 2) + '/>' +
                '<path d="M22 31v19" ' + line('#fff', 3) + ' opacity=".85"/>',
            toy: '<ellipse cx="29" cy="43" rx="22" ry="14" fill="#ffd23f" ' + s(3.5) + '/><circle cx="43" cy="22" r="12" fill="#ffd23f" ' + s(3.5) + '/>' +
                '<path d="M53 20l9 3-9 5z" fill="#ff8a1f" ' + s(2.5) + '/><circle cx="45" cy="19" r="2.4" fill="' + k + '"/>' +
                '<path d="M15 41c5 6 14 6 20 0" ' + line('#e0a800', 3) + '/><path d="M8 38l-3-8" ' + s(3) + '/><circle cx="4.5" cy="25" r="4.5" fill="none" stroke="#8a98a0" stroke-width="3"/>',
            flare: '<path d="M32 2c7 9 11 14 6 22-3 4-10 4-12 0-4-7 0-11 6-22z" fill="#ffae2b" ' + s(3) + '/>' +
                '<path d="M32 12c4 6 5 8 2.5 12s-6 1.5-6-1.5 1.5-5.500 3.500-10.500z" fill="#fff3a6"/>' +
                '<rect x="24" y="26" width="16" height="34" rx="4" fill="#e5383b" ' + s(3.5) + '/><rect x="24" y="37" width="16" height="7" fill="#fff" stroke="' + k + '" stroke-width="2"/>' +
                '<path d="M11 18l-5-3M53 17l5-3M9 29l-6 0M55 29l6 0" ' + line('#ffb02e', 3) + '/>',
            rope: '<circle cx="29" cy="36" r="19" fill="none" stroke="' + k + '" stroke-width="13"/><circle cx="29" cy="36" r="19" fill="none" stroke="#ead29a" stroke-width="8"/>' +
                '<circle cx="29" cy="36" r="19" fill="none" stroke="#b9873f" stroke-width="8" stroke-dasharray="3.4 6.1"/>' +
                '<path d="M45 20c5-5 9-9 14-12" ' + line(k, 9) + '/><path d="M45 20c5-5 9-9 14-12" ' + line('#ead29a', 5) + '/>',
            push: whoosh + palm('#ffd9ad', '#e0a27a'),
            superpush: '<path d="M46 3l3.5 7 8-2.5-2.5 8 7 3.5-7.5 4.5 4 7.5-8-.5-1 8-6-5.5-6 5.5-1-8-8 .5 4-7.5-7.5-4.5 7-3.5-2.5-8 8 2.5z" fill="#ffd23f" ' + s(2.5) + ' transform="translate(-6 -4) scale(1.05)"/>' +
                '<g transform="translate(0 4) scale(.94)">' + whoosh + palm('#ff9a85', '#d9644d') + '</g>',
            daily: '<rect x="8" y="12" width="48" height="46" rx="9" fill="#fffaf0" ' + s(3.5) + '/><path d="M8 28v-7a9 9 0 0 1 9-9h30a9 9 0 0 1 9 9v7z" fill="#e5383b" ' + s(3.5) + '/>' +
                '<path d="M21 5v14M43 5v14" ' + line(k, 8) + '/><path d="M21 5v14M43 5v14" ' + line('#fff', 3.5) + '/>' +
                '<path d="M32 33l3.6 7.4 8 .9-6 5.4 1.7 8L32 50.6l-7.3 4.1 1.7-8-6-5.4 8-.9z" fill="#ffd23f" ' + s(2.5) + '/>',
            wheel: '<circle cx="32" cy="34" r="28" fill="' + k + '"/>' + wheelWedges + '<circle cx="32" cy="34" r="24" fill="none" stroke="#fff" stroke-width="2.5"/>' +
                '<circle cx="32" cy="34" r="6.5" fill="#fff" ' + s(3) + '/><path d="M32 2l-7 12h14z" fill="#e5383b" ' + s(3) + '/>',
            records: '<path d="M20 8h24v15a12 12 0 0 1-24 0z" fill="#ffd23f" ' + s(3.5) + '/><path d="M20 12h-7q-2 11 8 14M44 12h7q2 11-8 14" ' + line(k, 6) + '/><path d="M20 12h-7q-2 11 8 14M44 12h7q2 11-8 14" ' + line('#ffc233', 2.5) + '/>' +
                '<path d="M32 35v10" ' + line(k, 8) + '/><path d="M32 35v10" ' + line('#ffc233', 4) + '/><rect x="21" y="45" width="22" height="10" rx="3.5" fill="#e89a00" ' + s(3.5) + '/>' +
                '<path d="M32 13l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.400-.6z" fill="#fff" opacity=".9"/>',
            hair: '<rect x="17" y="22" width="30" height="32" rx="13" fill="#ffd9ad" ' + s(3.5) + '/><path d="M13 36C10 14 22 5 32 5s22 9 19 31c-3-8-5-12-7-14-6 4-18 4-24 0-2 2-4 6-7 14z" fill="#8a4a2b" ' + s(3.5) + '/>' +
                '<circle cx="26" cy="38" r="2.4" fill="' + k + '"/><circle cx="38" cy="38" r="2.4" fill="' + k + '"/><path d="M19 12q4-4 8-4" ' + line('#c98a5d', 3) + '/>',
            hat: '<path d="M10 40c0-15 9-24 22-24s22 9 22 24z" fill="#4fc3f7" ' + s(3.5) + '/><path d="M14 40h40c6 0 8 4 8 6s-2 3-6 3H14z" fill="#2c86e0" ' + s(3.5) + '/><circle cx="32" cy="14" r="4" fill="#fff" ' + s(3) + '/>' +
                '<path d="M20 26q4-5 10-5" ' + line('#fff', 3.5) + ' opacity=".7"/>',
            acc: '<path d="M2 32h60" ' + line(k, 9) + '/><path d="M2 32h60" ' + line('#2b2f3a', 5) + '/><circle cx="19" cy="32" r="14" fill="#aef0ff" ' + s(3.5) + '/><circle cx="45" cy="32" r="14" fill="#aef0ff" ' + s(3.5) + '/>' +
                '<path d="M11 27q4-5 9-4M37 27q4-5 9-4" ' + line('#fff', 3.5) + '/>',
            trail: '<path d="M4 54C14 52 28 44 38 30" ' + line(k, 12) + '/><path d="M4 54C14 52 28 44 38 30" ' + line('#7fe3dc', 7) + '/><path d="M14 56C22 52 30 48 36 40" ' + line('#fff', 3) + ' opacity=".8"/>' +
                '<g transform="translate(34 4) scale(1.15)" stroke="' + k + '" stroke-width="2.2" stroke-linejoin="round" color="#ffd23f">' + GD_GLYPHS.spark + '</g>' + gl('spark', 6, 24, .5, '#fff'),
            victory: '<path d="M32 3l5 12 13-5-5 13 13 4-12 6 9 10-13-2 0 13-8-11-8 11 0-13-13 2 9-10-12-6 13-4-5-13 13 5z" fill="#ffd23f" ' + s(3) + '/><circle cx="32" cy="32" r="8" fill="#ff6f91" ' + s(3) + '/>' +
                '<circle cx="9" cy="9" r="3" fill="#4fc3f7"/><circle cx="56" cy="8" r="3" fill="#46d977"/><circle cx="7" cy="54" r="3" fill="#ff6f91"/><circle cx="57" cy="55" r="3" fill="#8d5cf0"/>',
            outfit: '<path d="M22 7L5 15l6 13 8-4v33h26V24l8 4 6-13-17-8c-1 4-5 7-10 7s-9-3-10-7z" fill="#ff6f91" ' + s(3.5) + '/><path d="M22 7c1 4 5 7 10 7s9-3 10-7" ' + line(k, 3) + '/>',
            rescue: '<circle cx="32" cy="32" r="22" fill="none" stroke="' + k + '" stroke-width="19"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-width="13"/>' +
                '<circle cx="32" cy="32" r="22" fill="none" stroke="#e5383b" stroke-width="13" stroke-dasharray="17.27 17.27" transform="rotate(-22.5 32 32)"/>' +
                '<circle cx="32" cy="32" r="15" fill="none" stroke="' + k + '" stroke-width="2.500"/>',
            ad: '<circle cx="32" cy="32" r="26" fill="#8d5cf0" ' + s(3.5) + '/><path d="M26 20l18 12-18 12z" fill="#fff" ' + s(2.500) + '/>',
            lock: '<path d="M21 29v-8a11 11 0 0 1 22 0v8" fill="none" ' + s(5.500) + '/><path d="M21 29v-8a11 11 0 0 1 22 0v8" ' + line('#c9d3d8', 2.500) + '/>' +
                '<rect x="14" y="28" width="36" height="28" rx="7" fill="#ffc233" ' + s(3.500) + '/><circle cx="32" cy="41" r="4" fill="' + k + '"/><path d="M32 43v6" ' + line(k, 3.500) + '/>',
            check: '<circle cx="32" cy="32" r="26" fill="#3ccf6e" ' + s(3.500) + '/><path d="M19 33l9 9 17-19" ' + line(k, 10) + '/><path d="M19 33l9 9 17-19" ' + line('#fff', 6) + '/>',
            close: '<path d="M18 18l28 28M46 18L18 46" ' + line(k, 12) + '/><path d="M18 18l28 28M46 18L18 46" ' + line('#fff', 7) + '/>',
            calm: '<path d="M8 38q24 22 48 0" ' + line(k, 10) + '/><path d="M8 38q24 22 48 0" ' + line('#bff3ee', 5) + '/>' +
                '<path d="M14 47l-3 6M32 53v7M50 47l3 6" ' + line(k, 4) + '/><path d="M40 10h10l-10 11h10" ' + line(k, 6) + '/><path d="M40 10h10l-10 11h10" ' + line('#fff', 2.500) + '/>',
            listening: '<path d="M24 56c-6 0-9-4-9-9" ' + line(k, 12) + '/><path d="M24 56c-6 0-9-4-9-9 0-6 5-8 5-14V26c0-9 7-16 16-16s14 6 14 14c0 6-4 9-6 13-1 2-1 4 0 6" ' + line(k, 12) + '/>' +
                '<path d="M24 56c-6 0-9-4-9-9 0-6 5-8 5-14V26c0-9 7-16 16-16s14 6 14 14c0 6-4 9-6 13-1 2-1 4 0 6" fill="#ffd9ad" stroke="#ffd9ad" stroke-width="6" stroke-linejoin="round"/>' +
                '<path d="M28 20c5-4 12-1 12 6 0 5-5 6-5 11" ' + line('#e0a27a', 4) + '/><path d="M50 44q5-3 6-9M54 50q8-5 8-14" ' + line('#ffc233', 3.500) + '/>',
            rushing: '<path d="M10 48C18 44 24 26 34 6c2 14 4 28 20 42z" fill="#37506b" ' + s(3.500) + '/><path d="M30 14c-2 9-5 17-9 24" ' + line('#6d8aa8', 3.500) + '/>' +
                '<path d="M2 52q7-7 15 0t15 0 15 0 15 0v12H2z" fill="#2fc4cf" ' + s(3.500) + '/>',
            near: '<path d="M4 32c10-22 46-22 56 0v4c-6 20-50 20-56 0z" fill="#b21f3a" ' + s(3.500) + '/><path d="M12 29l5 10 5-10 5 10 5-10 5 10 5-10 5 10 5-10" fill="#fff" ' + s(2.500) + '/>' +
                '<ellipse cx="32" cy="45" rx="9" ry="4" fill="#ff6f7f" opacity=".85"/>',
            arrow: '<path d="M32 3l23 27H41v30H23V30H9z" fill="#ff4d4f" ' + s(4) + '/><path d="M32 12l11 13" ' + line('#fff', 3.500) + ' opacity=".7"/>',
            throwRange: '<path d="M6 52Q28 -2 56 44" ' + line(k, 8) + '/><path d="M6 52Q28 -2 56 44" fill="none" stroke="#fff" stroke-width="3.500" stroke-linecap="round" stroke-dasharray="1 7"/>' +
                '<circle cx="10" cy="49" r="6" fill="#c7d0d5" ' + s(3) + '/><ellipse cx="54" cy="50" rx="8" ry="3.500" fill="none" stroke="#2fc4cf" stroke-width="3"/>',
            skips: '<ellipse cx="13" cy="52" rx="9" ry="3.500" ' + line('#2fc4cf', 3) + '/><ellipse cx="32" cy="46" rx="8" ry="3.200" ' + line('#2fc4cf', 3) + '/><ellipse cx="50" cy="40" rx="7" ry="3" ' + line('#2fc4cf', 3) + '/>' +
                '<path d="M10 40Q16 20 24 36M28 33Q34 15 42 30M46 27Q50 12 58 22" ' + line(k, 3) + ' stroke-dasharray="1 6"/><circle cx="10" cy="40" r="5" fill="#c7d0d5" ' + s(3) + '/>',
            toyBattery: '<rect x="6" y="18" width="46" height="28" rx="7" fill="#7ee08a" ' + s(3.500) + '/><rect x="52" y="27" width="7" height="10" rx="2" fill="' + k + '"/>' +
                '<path d="M32 22l-9 12h8l-3 10 12-14h-8z" fill="#ffd23f" ' + s(2.500) + '/>',
            flareRadius: '<circle cx="32" cy="32" r="26" fill="none" ' + s(3.500) + ' stroke-dasharray="1 7"/><circle cx="32" cy="32" r="26" fill="none" stroke="#ffae2b" stroke-width="3.500" stroke-dasharray="1 7" stroke-linecap="round"/>' +
                '<path d="M32 16c5 7 8 10 4 16-2 3-7 3-9 0-3-5 0-8 5-16z" fill="#ffae2b" ' + s(3) + '/><path d="M32 40v14" ' + line(k, 9) + '/><path d="M32 40v14" ' + line('#e5383b', 5) + '/>',
            ropeReach: '<path d="M6 50h52" ' + line(k, 3) + '/><path d="M6 44v12M58 44v12" ' + line(k, 3) + '/><path d="M12 34q10-18 20-4t20-16" ' + line(k, 9) + '/><path d="M12 34q10-18 20-4t20-16" ' + line('#ead29a', 5) + '/>' +
                '<circle cx="52" cy="14" r="6" fill="none" ' + s(3.500) + '/>',
            swimSpeed: '<path d="M2 50q7-7 15 0t15 0 15 0 15 0" ' + line('#2fc4cf', 4) + '/><path d="M2 58q7-7 15 0t15 0 15 0 15 0" ' + line('#7fe3dc', 3.500) + '/>' +
                '<path d="M14 16l14 14-14 14M32 16l14 14-14 14" ' + line(k, 11) + '/><path d="M14 16l14 14-14 14M32 16l14 14-14 14" ' + line('#ffd23f', 6) + '/>',
            play: '<path d="M18 10l36 22-36 22z" fill="#fff" ' + s(5) + '/>',
            lobby: '<path d="M7 31L32 8l25 23v26H7z" fill="#fff4cf" ' + s(3.500) + '/><path d="M3 33L32 5l29 28" ' + line(k, 8) + '/><path d="M3 33L32 5l29 28" ' + line('#e5383b', 4) + '/>' +
                '<rect x="25" y="37" width="14" height="20" rx="4" fill="#2fc4cf" ' + s(3) + '/><circle cx="35" cy="48" r="1.800" fill="' + k + '"/>',
            shop: '<rect x="9" y="29" width="46" height="28" rx="4" fill="#f6e7b8" ' + s(3.500) + '/>' +
                '<path d="M6 30L11 8h42l5 22c-3 6-9 6-13 0-3 6-9 6-13 0-3 6-9 6-13 0-4 6-10 6-13 0z" fill="#e5383b" ' + s(3.500) + '/>' +
                '<path d="M24 9l-3 21M40 9l3 21" ' + line('#fff', 5) + '/>' + coin(32, 45, 7),
            equipment: '<path d="M21 22v-6a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v6" fill="none" ' + s(4) + '/><rect x="6" y="21" width="52" height="36" rx="8" fill="#ff9a3d" ' + s(3.500) + '/>' +
                '<path d="M6 35h52" ' + line(k, 3.500) + '/><rect x="26" y="31" width="12" height="9" rx="2.500" fill="#ffd23f" ' + s(3) + '/>',
            upgrades: '<path d="M32 5l22 26H41v26H23V31H10z" fill="#3ccf6e" ' + s(4) + '/><path d="M32 13l11 14" ' + line('#fff', 3.500) + ' opacity=".7"/><path d="M13 58h38" ' + line(k, 4) + '/>',
            skins: '<path d="M22 7L5 15l6 13 8-4v33h26V24l8 4 6-13-17-8c-1 4-5 7-10 7s-9-3-10-7z" fill="#4fc3f7" ' + s(3.500) + '/><path d="M22 7c1 4 5 7 10 7s9-3 10-7" ' + line(k, 3) + '/>' +
                '<path d="M19 40h26" ' + line('#fff', 4) + ' opacity=".7"/>',
            inventory: '<path d="M23 17v-3a9 9 0 0 1 18 0v3" fill="none" ' + s(4) + '/><rect x="12" y="16" width="40" height="44" rx="13" fill="#8d6cf0" ' + s(3.500) + '/>' +
                '<rect x="21" y="38" width="22" height="15" rx="5" fill="#b9a8ff" ' + s(3) + '/><path d="M32 38v-4" ' + line(k, 3) + '/><path d="M18 27h28" ' + line('#fff', 3) + ' opacity=".5"/>',
            howto: '<circle cx="32" cy="32" r="26" fill="#ffd23f" ' + s(3.500) + '/><path d="M23 25c0-6 4-9 9-9s9 3 9 8c0 7-9 7-9 15" ' + line(k, 10) + '/><path d="M23 25c0-6 4-9 9-9s9 3 9 8c0 7-9 7-9 15" ' + line('#fff', 5) + '/><circle cx="32" cy="50" r="3.500" fill="' + k + '"/>',
            sound: '<path d="M8 24h10l14-12v40L18 40H8z" fill="#fff" ' + s(3.500) + '/><path d="M40 22q8 10 0 20M47 15q15 17 0 34" ' + line(k, 8) + '/><path d="M40 22q8 10 0 20M47 15q15 17 0 34" ' + line('#fff', 4) + '/>',
            mute: '<path d="M8 24h10l14-12v40L18 40H8z" fill="#fff" ' + s(3.500) + '/><path d="M40 24l16 16M56 24L40 40" ' + line(k, 9) + '/><path d="M40 24l16 16M56 24L40 40" ' + line('#ff6f7f', 4.500) + '/>',
            pause: '<rect x="14" y="10" width="12" height="44" rx="5" fill="#fff" ' + s(4) + '/><rect x="38" y="10" width="12" height="44" rx="5" fill="#fff" ' + s(4) + '/>',
            gift: '<rect x="8" y="26" width="48" height="32" rx="5" fill="#ff6f91" ' + s(3.500) + '/><rect x="5" y="17" width="54" height="13" rx="4" fill="#ff8fa9" ' + s(3.500) + '/>' +
                '<path d="M32 17v41" ' + line(k, 11) + '/><path d="M32 17v41" ' + line('#ffd23f', 6) + '/><path d="M32 17c-4-12-17-10-14-3 2 4 9 3 14 3zM32 17c4-12 17-10 14-3-2 4-9 3-14 3z" fill="#ffd23f" ' + s(3) + '/>',
            x2: '<circle cx="32" cy="32" r="26" fill="#ffd23f" ' + s(3.500) + '/><circle cx="32" cy="32" r="19" fill="none" stroke="#d98f00" stroke-width="2.500"/>' +
                '<path d="M17 24l12 16M29 24L17 40M36 40q0-7 7-8t7-7q0-5-7-5t-7 6M36 40h14" ' + line(k, 5) + '/>',
            maxed: '<path d="M32 4l8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 23l19-2z" fill="#ffd23f" ' + s(3.500) + '/><path d="M32 14l4 9" ' + line('#fff', 3.500) + ' opacity=".8"/>' +
                '<path d="M35 24l-9 13h6l-2 11 10-14h-6z" fill="#fff" ' + s(2.500) + '/>',
            infinity: '<path d="M32 32c-5-10-10-14-16-14C9 18 5 24 5 32s4 14 11 14c6 0 11-4 16-14s10-14 16-14c7 0 11 6 11 14s-4 14-11 14c-6 0-11-4-16-14z" ' + line(k, 12) + '/>' +
                '<path d="M32 32c-5-10-10-14-16-14C9 18 5 24 5 32s4 14 11 14c6 0 11-4 16-14s10-14 16-14c7 0 11 6 11 14s-4 14-11 14c-6 0-11-4-16-14z" ' + line('#ead29a', 7) + '/>',
            star: '<path d="M32 4l8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 23l19-2z" fill="#ffd23f" ' + s(3.500) + '/><path d="M32 14l4 9" ' + line('#fff', 3.500) + ' opacity=".8"/>',
            clock: '<circle cx="32" cy="34" r="24" fill="#fff" ' + s(3.500) + '/><path d="M32 20v15l10 6" ' + line(k, 5) + '/><path d="M26 6h12" ' + line(k, 5) + '/>',
            bot: '<rect x="18" y="8" width="28" height="22" rx="8" fill="#ffd9ad" ' + s(3.500) + '/><circle cx="26" cy="19" r="2.600" fill="' + k + '"/><circle cx="38" cy="19" r="2.600" fill="' + k + '"/>' +
                '<rect x="14" y="33" width="36" height="22" rx="7" fill="#4fc3f7" ' + s(3.500) + '/>',
            flag: '<path d="M14 6v54" ' + line(k, 5) + '/><path d="M14 8h34l-7 11 7 11H14z" fill="#e5383b" ' + s(3.500) + '/>',
            monster: '<path d="M4 32c10-22 46-22 56 0v4c-6 20-50 20-56 0z" fill="#b21f3a" ' + s(3.500) + '/><path d="M12 29l5 10 5-10 5 10 5-10 5 10 5-10 5 10 5-10" fill="#fff" ' + s(2.500) + '/>',
        };
    })(),
};

// Тексты каталога -> LANG_STRINGS (ключи `<вид>.<id>` и `.d`) и названия уровней / скинов
(() => {
    const dict = /** @type {Record<string, Record<string, string>>} */ (LANG_STRINGS);
    const put = (key, ru, en) => { dict.ru[key] = ru; dict.en[key] = en; };
    for (const key of Object.keys(GameData.TEXT)) put(key, GameData.TEXT[key][0], GameData.TEXT[key][1]);
    for (const l of GameData.LEVELS) put('level.' + l.n, l.name.ru, l.name.en);
    for (const s of GameData.SKINS) put('skin.' + s.id, s.name.ru, s.name.en);
    for (const s of GameData.DAILY_SKINS) put('skin.' + s.id, s.name.ru, s.name.en);
    for (const c of GameData.COSMETICS) put('cos.' + c.id, c.name.ru, c.name.en);
})();

// ---------------------------------------------------------------------------------------------------------------
// Глобалы для кода игры (Game.js, GameHero.js, ...): те же данные в плоском виде. Менять каталог — выше, в GameData.
// ---------------------------------------------------------------------------------------------------------------

/** Уровни: [{ id: 'pool-1', n, name: { ru, en }, reward }] — reward = базовая награда 40 + 15·N. */
const GAME_LEVELS = GameData.LEVELS.map((l) => ({ id: l.map, n: l.n, name: { ru: l.name.ru, en: l.name.en }, reward: GameData.levelReward(l.n) }));

/** Скины: [{ id, name, rarity, price: { coins } | { ads }, look, default? }] — look в формате DESIGN.md. */
const GAME_SKINS = GameData.SKINS.map((s) => {
    /** @type {any} */
    const e = { id: s.id, name: { ru: s.name.ru, en: s.name.en }, rarity: s.rarity, price: s.price ? Object.assign({}, s.price) : { coins: 0 }, look: s.look };
    if (s.default) e.default = true;
    return e;
});

/** Инструменты слотов: [{ id, name, desc, free?, unlock?, refills }] — pebble bottle toy flare rope. */
const GAME_TOOLS = GameData.TOOLS.map((t) => ({
    id: t.id,
    name: { ru: GameData.TEXT['tool.' + t.id][0], en: GameData.TEXT['tool.' + t.id][1] },
    desc: { ru: GameData.TEXT['tool.' + t.id + '.d'][0], en: GameData.TEXT['tool.' + t.id + '.d'][1] },
    free: !!t.free,
    unlock: t.unlock || null,
    refills: t.refills,
}));
