// @ts-nocheck
// PikabuPacks.js — наборы за рубли в сборке Пикабу Игр (js/PikabuShop.js). Цены и названия товаров — в Студии
// (каталог CSV: coins_s 19 ₽, coins_m 49 ₽, coins_l 99 ₽, starter 29 ₽, no_ads 59 ₽), здесь — что игрок получает.
// Монеты — Eco.addCoins, косметика набора — легендарки «за рекламу» (Eco.grantItem).
PikabuShop.setup({
    colors: ['#18b6e8', '#7c4dff'],
    ready: () => !!(typeof Eco !== 'undefined' && Eco.state),
    visible: () => (Game.state === 'menu' || Game.state === 'lobby') && !(typeof GameUI !== 'undefined' && GameUI.isOpen()),
    persist: () => { if (Eco.flush) Eco.flush(); },
    button: { corner: 'tr', x: 12, y: 74 },
    packs: [
        { id: 'coins_s', type: 'consumable', icon: '🪙', name: 'Горсть монет', desc: '1 500 монет на снаряжение и наряды', grant: () => Eco.addCoins(1500, 'shop') },
        { id: 'coins_m', type: 'consumable', icon: '💰', name: 'Мешок монет', desc: '5 000 монет', grant: () => Eco.addCoins(5000, 'shop') },
        { id: 'coins_l', type: 'consumable', icon: '🏆', name: 'Сундук монет', desc: '12 000 монет — хватит на лучшие улучшения', best: true, grant: () => Eco.addCoins(12000, 'shop') },
        {
            id: 'starter', type: 'non_consumable', icon: '👑', name: 'Король бассейна', best: 'Один раз',
            desc: '2 000 монет, «Золотые кудри», корона «Ледяной король» и след «Северное сияние»',
            grant: () => Eco.addCoins(2000, 'shop'),
            apply: () => ['hair.curlyGold', 'hat.crownFrost', 'trail.aurora'].forEach((id) => { if (!Eco.itemOwned(id)) Eco.grantItem(id); }),
        },
        { id: 'no_ads', type: 'non_consumable', icon: '🚫', name: 'Без рекламы', desc: 'Убирает рекламу между заплывами навсегда. Награды за рекламу остаются', noAds: true },
    ],
});
