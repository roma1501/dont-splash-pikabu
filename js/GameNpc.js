// GameNpc.js — продавцы в лобби: стоят за лавками (и у колеса фортуны, у подарка дня), поворачиваются к игроку, машут,
// говорят реплики над головой и прощаются, когда он уходит. Места берутся из объектов карты лобби (модели лавок,
// колеса и подарка в Maps.js): двинули лавку в редакторе — продавец переедет вместе с ней. Вид — тот же блочный герой
// (assets/models/hero.glb) со своим скином; физика не считается, только поза и поворот.
//
//   await GameNpc.build(app, tags);   // в prepare лобби (на уровнях — убирает продавцов)
//   GameNpc.update(dt, hero);         // каждый кадр в лобби

const NPC_DEFS = {
    equipment: {
        name: { ru: 'Кладовщик Гоша', en: 'Gosha the Keeper' },
        look: { skin: 0xd9a47c, shirt: 0x2bb3a3, pants: 0x3b4a6b, shoes: 0x2e2e3a, hair: 'short', hairColor: 0x2a1d14, hat: 'cap', hatColor: 0xf06b4f, acc: ['backpack'] },
        hi: { ru: ['Эй, пловец! Камешки, бутылки, утки — всё тут!', 'Без снаряжения в бассейн не суйся!', 'Утка на заводе — лучший друг беглеца.'],
            en: ['Hey, swimmer! Pebbles, bottles, ducks — all here!', "Don't hit the pool without gear!", "A wind-up duck is a runner's best friend."] },
        bye: { ru: ['Заходи ещё!', 'Береги уши монстра... то есть свои!'], en: ['Come back soon!', 'Stay quiet out there!'] },
    },
    upgrades: {
        name: { ru: 'Мастер Винт', en: 'Master Bolt' },
        look: { skin: 0xf2c7a0, shirt: 0xffc93c, pants: 0x58507a, shoes: 0x3d8bff, hair: 'spiky', hairColor: 0x9b5a2c, hat: 'none', acc: ['goggles'] },
        hi: { ru: ['Прокачаю бросок — монстр уплывёт на край зала!', 'Чем дальше бросок, тем тише жизнь.', 'Фальшфейер поярче? Это ко мне.'],
            en: ['Upgrade your throw — send it to the far wall!', 'Longer throws, quieter life.', 'Brighter flare? I got you.'] },
        bye: { ru: ['Удачного заплыва!', 'Возвращайся за улучшениями!'], en: ['Good luck out there!', 'Come back for upgrades!'] },
    },
    shop: {
        name: { ru: 'Тётя Монетка', en: 'Auntie Penny' },
        look: { skin: 0xb67a52, shirt: 0x7a5cff, pants: 0x2e2e3a, shoes: 0xffc93c, hair: 'bun', hairColor: 0x2c4b8a, hat: 'none', acc: ['scarf'] },
        hi: { ru: ['Монетки, круги, толчки — заглядывай!', 'Спасательный круг ещё никому не мешал.', 'Сегодня всё по рекламе, дорогуша!'],
            en: ['Coins, lifebuoys, pushes — take a look!', 'A lifebuoy never hurt anyone.', 'Everything for ads today, sweetie!'] },
        bye: { ru: ['Не промокни!', 'Жду с монетками!'], en: ["Don't get wet!", 'See you with coins!'] },
    },
    skins: {
        name: { ru: 'Стилист Лёва', en: 'Leo the Stylist' },
        look: { skin: 0xf6d2b4, shirt: 0xff6fae, pants: 0xd9d2c0, shoes: 0xfafafa, hair: 'long', hairColor: 0xe0c068, hat: 'bucket', hatColor: 0xfafafa, acc: ['headphones'] },
        hi: { ru: ['Тебе бы новую причёску, дорогой!', 'Монстр слепой, но ты всё равно должен выглядеть шикарно!', 'Есть шапочка под твои глаза.'],
            en: ['You need a new hairdo, darling!', "The monster's blind, but you should still look fabulous!", 'I have a cap that matches your eyes.'] },
        bye: { ru: ['Блистай!', 'Возвращайся за образом!'], en: ['Shine on!', 'Come back for a new look!'] },
    },
    wheel: {
        name: { ru: 'Ведущий Крутило', en: 'Spinny the Host' },
        look: { skin: 0x8a5636, shirt: 0xf06b4f, pants: 0x1f6b5c, shoes: 0xfafafa, hair: 'curly', hairColor: 0x16110c, hat: 'none', acc: ['ring'] },
        hi: { ru: ['Крути колесо — удача ждёт!', 'Бесплатное вращение каждый день!', 'Сектор приз на барабане!'],
            en: ['Spin the wheel — luck is waiting!', 'A free spin every day!', 'Big prize on the wheel!'] },
        bye: { ru: ['Завтра новое вращение!', 'Удачи!'], en: ['New spin tomorrow!', 'Good luck!'] },
    },
    daily: {
        name: { ru: 'Почтальон Пак', en: 'Puck the Postman' },
        look: { skin: 0xf2c7a0, shirt: 0x3d8bff, pants: 0x3b4a6b, shoes: 0x6b4a3b, hair: 'short', hairColor: 0x4a2f1f, hat: 'cap', hatColor: 0x3d8bff, acc: ['backpack'] },
        hi: { ru: ['Тебе посылка! Забери подарок дня!', 'Каждый день — новый подарок!', 'Седьмой день — особенный сюрприз!'],
            en: ["Package for you! Grab today's gift!", 'A new gift every day!', 'Day seven is a special surprise!'] },
        bye: { ru: ['До завтра!', 'Не забудь вернуться!'], en: ['See you tomorrow!', "Don't forget to come back!"] },
    },
};

/** @satisfies {Record<string, any>} */
const GameNpc = {
    /** @type {any[]} */ list: [],
    /** @type {any} */ tags: null,

    clear() {
        for (const n of this.list) {
            try { n.actor.dispose(); } catch (e) { /* сцена */ }
            if (this.tags) this.tags.remove(n.id);
        }
        this.list = [];
    },

    async build(app, tags) {
        this.clear();
        this.tags = tags;
        if (app.location.map.id !== 'lobby') return;
        const view = app.location.view, code = Lang.code === 'ru' ? 'ru' : 'en';
        let id = 9001;
        for (const rec of app.location.objects) {
            const model = String(rec.def && rec.def.model || '');
            const m = /stall_(\w+)\.glb$/.exec(model);
            const kind = m ? m[1] : /fortune_wheel/.test(model) ? 'wheel' : /gift_stand/.test(model) ? 'daily' : null;
            const def = kind && NPC_DEFS[kind];
            if (!def) continue;
            const hd = (Array.isArray(rec.def.rot) ? Number(rec.def.rot[1]) || 0 : 0) * Math.PI / 180;
            const fx = Math.cos(hd), fz = Math.sin(hd), sx = -fz, sz = fx;
            // за прилавком лавки; у колеса и подарка — сбоку и чуть впереди
            const off = m ? { f: -25, s: 0 } : { f: 70, s: kind === 'wheel' ? 150 : 120 };
            const x = rec.def.x + fx * off.f + sx * off.s, z = rec.def.y + fz * off.f + sz * off.s, y = Number(rec.def.h) || 260;
            const actor = await PoolHero.create(ObbyCourse, view, { look: def.look, who: 'npc-' + kind });
            actor.place(x, y, z, hd);
            actor.pose('idle', 0);
            const n = { id: id++, kind, def, actor, baseYaw: hd, near: false, talkT: 4 + Math.random() * 6, code };
            if (tags) tags.add(n.id, def.name[code]);
            this.list.push(n);
        }
    },

    _say(n, which) {
        const arr = n.def[which][n.code];
        if (this.tags && arr && arr.length) this.tags.say(n.id, arr[Math.floor(Math.random() * arr.length)], 3.4);
    },

    update(dt, hero) {
        for (const n of this.list) {
            const a = n.actor, dx = hero.x - a.x, dz = hero.z - a.z, d = Math.hypot(dx, dz);
            // поворот к игроку, когда он рядом; иначе — к залу
            const want = d < 700 ? Math.atan2(dz, dx) : n.baseYaw;
            let dy = want - a.yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            a.yaw += dy * Math.min(1, dt * 4);
            a.sync();
            a.pose('idle', dt);
            if (d < 480 && !n.near) {
                n.near = true;
                a.gesture('wave');
                this._say(n, 'hi');
                n.talkT = 7 + Math.random() * 5;
                if (typeof Game !== 'undefined' && Game.sfx) Game.sfxAt('npc', a.x, a.z);
            } else if (d > 760 && n.near) {
                n.near = false;
                if (Math.random() < 0.7) this._say(n, 'bye');
            } else if (n.near) {
                n.talkT -= dt;
                if (n.talkT <= 0) { n.talkT = 8 + Math.random() * 6; this._say(n, 'hi'); }
            }
            if (this.tags) this.tags.place(n.id, a.x, a.y + a.height + 40, a.z, d < 2600);
        }
    },
};
