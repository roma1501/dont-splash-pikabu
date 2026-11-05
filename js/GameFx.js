// GameFx.js — эффекты косметики «Don’t Splash»: следы за героем (26), празднование победы (22) и мерцание редких
// причёсок и шляпок. Только 3D (нужен app.fx — ParticleFX); без него каждая функция — пустышка, исключений нет.
//
//   GameFx.init(app)                       app.fx — менеджер ParticleFX. Повторный вызов безопасен.
//   GameFx.setTrail(hero, id | null)       непрерывный след за героем (поля x, y — ноги, z, swimming, speed, visible).
//                                          Тот же id — ничего не пересоздаётся. null / неизвестный id — след снят.
//                                          Герой, переданный последним (даже с null), — «владелец» (игрок) для мерцания.
//   GameFx.celebrate(id | null, {x,y,z})   разовый эффект победы в точке (ноги героя на финише).
//   GameFx.update(dt)                      кадр: ставит частоту следов по скорости, ведёт таймеры многоступенчатых эффектов.
//                                          На паузе (Pause.active) ничего не делает, таймеры стоят.
//   GameFx.clear()                         смена карты: снять ВСЕ системы и таймеры (кэш спрайтов остаётся).
//   GameFx.TRAILS / GameFx.VICTORIES       списки id (заморожены), GameFx.has('trail' | 'victory', id).
//   GameFx.density()                       множитель плотности (1 или чистые 0.5), GameFx.waterY — уровень воды (по умолчанию 200).
//   GameFx.stats()                         счётчики для тестов и отладки; GameFx.spriteCanvas(имя) — отрисованный спрайт (галерея).
//
// ТЕКСТУРЫ. Файлов нет: каждый спрайт (сердце, звезда, монета, утка, нота, лист, лепесток…) рисуется на canvas при
// первом использовании, переводится в RGBA-пиксели (цвет под прозрачными пикселями заливается средним цветом спрайта —
// без тёмной каймы при фильтрации), строки переворачиваются, и из них собирается BABYLON.RawTexture с мипмапами.
// Текстура кэшируется на менеджер ParticleFX (новый менеджер — новый кэш) и подменяется у системы после fx.create:
// handle.system.particleTexture. Спрайты с несколькими клетками (монета и лист вращаются, конфетти и воздушные шары — разных
// цветов, ленты изгибаются) — атласы 64 px на клетку: эффект листания и случайный выбор клетки даёт сам Babylon (sheet).
// Спрайт нарисован светло-серым с бликами: цвет частице задаёт color / colorGradient (множитель), у «цветных» — свой.
// Нет документа, canvas или сцены — частица без спрайта (мягкая точка ParticleFX), игра не ломается.
//
// ПЛОТНОСТЬ. На телефоне (IS_MOBILE) и на уровне графики 0 (Quality.level) эффект вдвое реже: множитель умножается на
// rate, burst и ёмкость. ParticleFX на телефоне и сам режет плотность (FX_MOBILE_SCALE), поэтому наш множитель
// берётся так, чтобы ИТОГ был 0.5, а не 0.275: 0.5 / FX_MOBILE_SCALE (не больше 1).
//
// БЮДЖЕТ. След: по одной системе на слой рецепта (1–2) и одна «водяная» (пузыри у поверхности, создаётся при первом
// плавании). Победа — вспышки и струи по таймерам: одновременно живёт 3–6 систем (серия салютов — до 12), каждая сама исчезает
// по сроку жизни частиц. Системы создаются не по кадрам, а по событиям. fx.create вернул null (бюджет) — слой тихо пропускается;
// у следа неудавшийся слой пробуется заново раз в секунду.

/** @satisfies {Record<string, any>} */
const GameFx = (() => {
    'use strict';

    const TRAILS = Object.freeze(['bubbles', 'foam', 'droplets', 'leaves', 'dust', 'petals', 'snow', 'sparks', 'sparkle', 'hearts',
        'confetti', 'stars', 'notes', 'ducks', 'clover', 'flame', 'ice', 'rainbow', 'ghost', 'coins', 'lightning', 'aurora',
        'goldstream', 'galaxy', 'phoenix', 'abyss']);
    const VICTORIES = Object.freeze(['confetti', 'fountain', 'splash', 'streamers', 'petals', 'balloons', 'coinrain', 'fireworks',
        'ducks', 'hearts', 'stars', 'snowfall', 'golden', 'rainbow', 'lightning', 'iceburst', 'flames', 'ghosts', 'aurora',
        'megafire', 'phoenixrise', 'abyss']);

    const TAU = Math.PI * 2;
    const MOVE_SPEED = 60;          // px/с: медленнее — герой «стоит», след не испускается
    const CELL = 64;                // клетка атласа спрайтов, px
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const has = (obj, id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(obj, id);

    // ------------------------------------------------------------------------------------------------
    // СПРАЙТЫ (рисуются на canvas, центр клетки — (0, 0), полуразмер 32; Y вниз)
    // ------------------------------------------------------------------------------------------------
    const tone = (v, a = 1) => 'rgba(' + v + ',' + v + ',' + v + ',' + a + ')';
    function radial(c, x, y, r, stops) { const g = c.createRadialGradient(x, y, 0, x, y, r); for (const [t, col] of stops) g.addColorStop(t, col); return g; }
    function linear(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [t, col] of stops) g.addColorStop(t, col); return g; }
    function mixHex(hex, t, to) {
        const n = parseInt(hex.slice(1), 16), m = to == null ? 255 : to, ch = s => Math.round(((n >> s) & 255) * (1 - t) + m * t);
        return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
    }
    function heartPath(c) { c.beginPath(); c.moveTo(0, 24); c.bezierCurveTo(-36, 0, -22, -30, 0, -13); c.bezierCurveTo(22, -30, 36, 0, 0, 24); c.closePath(); }
    function star4(c, R, r) {
        c.beginPath(); c.moveTo(0, -R); c.quadraticCurveTo(r, -r, R, 0); c.quadraticCurveTo(r, r, 0, R);
        c.quadraticCurveTo(-r, r, -R, 0); c.quadraticCurveTo(-r, -r, 0, -R); c.closePath(); c.fill();
    }
    function starPoints(n, R, r) {
        const pts = [];
        for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, k = i % 2 ? r : R; pts.push([Math.cos(a) * k, Math.sin(a) * k]); }
        return pts;
    }
    function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    const CONFETTI_COLORS = ['#ff4d6d', '#ffd23f', '#3fa7ff', '#4ade80', '#c084fc', '#ff9f1c', '#2dd4bf', '#f4f4f4'];
    const BALLOON_COLORS = ['#ff4d5e', '#3d8bff', '#ffd23f', '#3fd07a'];

    /** Клетки: cells (по умолчанию 1), draw(c, i). */
    const SPRITES = {
        // мягкая точка с яркой сердцевиной
        dot: { draw(c) { c.fillStyle = radial(c, 0, 0, 29, [[0, tone(255)], [0.28, tone(255, 0.9)], [0.62, tone(255, 0.28)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64); } },
        // узкая искра: вытянута вверх, в режиме stretch — вдоль скорости
        spark: { draw(c) { c.scale(0.42, 1); c.fillStyle = radial(c, 0, 0, 30, [[0, tone(255)], [0.4, tone(255, 0.9)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64); } },
        // четырёхлучевой блик
        glint: { draw(c) {
            c.fillStyle = radial(c, 0, 0, 15, [[0, tone(255, 0.9)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64);
            c.fillStyle = tone(255); star4(c, 30, 3.4); c.save(); c.rotate(Math.PI / 4); star4(c, 16, 2.4); c.restore();
        } },
        // пузырь: тонкий светлый ободок, прозрачная середина, блики
        bubble: { draw(c) {
            c.fillStyle = radial(c, 0, 0, 25, [[0, 'rgba(200,228,255,.08)'], [0.7, 'rgba(220,240,255,.22)'], [1, 'rgba(235,248,255,.62)']]);
            c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.fill();
            c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.stroke();
            c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(-9, -10, 6.5, 3.6, -0.8, 0, TAU); c.fill();
            c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, 16, 0.5, 1.3); c.stroke();
        } },
        // мягкое облачко (пена, пыль, дым, туман)
        puff: { draw(c) {
            for (const [x, y, r] of [[0, 0, 19], [-10, 6, 14], [11, 5, 14], [-4, -10, 13], [7, -9, 12], [0, 12, 12]]) {
                c.fillStyle = radial(c, x, y, r, [[0, tone(255, 0.6)], [1, tone(255, 0)]]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
            }
            c.globalCompositeOperation = 'destination-in';
            c.fillStyle = radial(c, 0, 0, 30, [[0, tone(255)], [0.7, tone(255)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64);
        } },
        // капля
        drop: { draw(c) {
            c.fillStyle = linear(c, -16, 0, 16, 0, [[0, tone(200)], [0.45, tone(250)], [1, tone(208)]]);
            c.beginPath(); c.moveTo(0, -29); c.bezierCurveTo(3, -14, 17, -3, 17, 10); c.arc(0, 10, 17, 0, Math.PI, false); c.bezierCurveTo(-17, -3, -3, -14, 0, -29); c.fill();
            c.fillStyle = tone(255, 0.95); c.beginPath(); c.ellipse(-6.5, 11, 3, 5.5, 0.2, 0, TAU); c.fill();
        } },
        // лист: 4 клетки — оборот вокруг вертикали (ширина по косинусу, обратная сторона зеркальна)
        leaf: { cells: 4, draw(c, i) {
            c.scale([1, 0.62, 0.2, -0.62][i], 1);
            c.fillStyle = linear(c, -19, 0, 19, 0, [[0, tone(255)], [1, tone(196)]]);
            c.beginPath(); c.moveTo(0, -29); c.bezierCurveTo(19, -17, 19, 15, 0, 29); c.bezierCurveTo(-19, 15, -19, -17, 0, -29); c.fill();
            c.strokeStyle = tone(160); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -26); c.lineTo(0, 28); c.stroke();
            c.lineWidth = 1.2; for (const y of [-14, -4, 6, 16]) { c.beginPath(); c.moveTo(0, y + 6); c.lineTo(9, y - 3); c.moveTo(0, y + 6); c.lineTo(-9, y - 3); c.stroke(); }
        } },
        // лепесток: 4 клетки — переворот
        petal: { cells: 4, draw(c, i) {
            c.scale([1, 0.6, 0.18, -0.6][i], 1);
            c.fillStyle = linear(c, 0, -28, 0, 29, [[0, tone(255)], [1, tone(205)]]);
            c.beginPath(); c.moveTo(0, 29); c.bezierCurveTo(-13, 22, -26, 2, -20, -16); c.bezierCurveTo(-16, -27, -5, -28, 0, -20);
            c.bezierCurveTo(5, -28, 16, -27, 20, -16); c.bezierCurveTo(26, 2, 13, 22, 0, 29); c.fill();
            c.strokeStyle = tone(190); c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 26); c.lineTo(0, -16); c.stroke();
        } },
        // снежинка (с голубоватой тенью, чтобы читалась на светлом)
        snow: { draw(c) {
            c.fillStyle = radial(c, 0, 0, 20, [[0, tone(255, 0.3)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64);
            c.lineCap = 'round';
            for (const [w, col] of [[5.6, 'rgba(150,185,225,.6)'], [3, '#ffffff']]) {
                c.strokeStyle = col; c.lineWidth = w;
                for (let k = 0; k < 6; k++) {
                    c.save(); c.rotate(k * Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -25);
                    for (const y of [-13, -19]) { c.moveTo(0, y); c.lineTo(6, y - 6); c.moveTo(0, y); c.lineTo(-6, y - 6); }
                    c.stroke(); c.restore();
                }
            }
        } },
        heart: { draw(c) {
            heartPath(c); c.fillStyle = linear(c, -16, -20, 18, 24, [[0, tone(255)], [1, tone(188)]]); c.fill();
            c.fillStyle = tone(255, 0.9); c.beginPath(); c.ellipse(-12, -10, 5.5, 3.2, -0.7, 0, TAU); c.fill();
        } },
        star: { draw(c) {
            const p = starPoints(5, 29, 12.5);
            c.lineJoin = 'round'; c.fillStyle = c.strokeStyle = tone(250); c.lineWidth = 5;
            c.beginPath(); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill(); c.stroke();
            c.fillStyle = tone(208);
            for (let i = 0; i < 10; i += 2) { c.beginPath(); c.moveTo(0, 0); c.lineTo(p[i][0], p[i][1]); c.lineTo(p[(i + 1) % 10][0], p[(i + 1) % 10][1]); c.closePath(); c.fill(); }
        } },
        // ноты: 0 — восьмая, 1 — две с перекладиной
        note: { cells: 2, draw(c, i) {
            c.fillStyle = c.strokeStyle = tone(240);
            const head = (x, y) => { c.beginPath(); c.ellipse(x, y, 10.5, 7.5, -0.4, 0, TAU); c.fill(); };
            if (i === 0) {
                head(-9, 19); c.fillRect(0.5, -26, 3.6, 44);
                c.beginPath(); c.moveTo(4, -26); c.bezierCurveTo(8, -14, 21, -12, 17, 3); c.bezierCurveTo(15, -8, 10, -11, 4, -14); c.fill();
            } else {
                head(-15, 21); head(9, 15); c.fillRect(-6.5, -17, 3.4, 40); c.fillRect(17.5, -23, 3.4, 40);
                c.beginPath(); c.moveTo(-6.5, -17); c.lineTo(20.9, -23); c.lineTo(20.9, -12); c.lineTo(-6.5, -6); c.closePath(); c.fill();
            }
        } },
        // резиновая утка (смотрит влево), свои цвета
        duck: { draw(c) {
            c.lineWidth = 1.8; c.strokeStyle = '#d89400';
            const body = linear(c, 0, -2, 0, 26, [[0, '#ffe45e'], [1, '#f6b81c']]);
            c.fillStyle = body; c.beginPath(); c.ellipse(2, 11, 25, 15, 0, 0, TAU); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(21, 6); c.quadraticCurveTo(31, -2, 30, -6); c.quadraticCurveTo(26, 4, 24, 16); c.fill();
            c.fillStyle = linear(c, 0, -22, 0, 2, [[0, '#ffee7a'], [1, '#ffd23a']]); c.beginPath(); c.arc(-10, -11, 12, 0, TAU); c.fill(); c.stroke();
            c.fillStyle = '#ff8a1a'; c.strokeStyle = '#c25d00'; c.beginPath(); c.ellipse(-24, -7, 8.5, 4.4, 0.1, 0, TAU); c.fill(); c.stroke();
            c.fillStyle = '#222'; c.beginPath(); c.arc(-12, -15, 2.4, 0, TAU); c.fill();
            c.fillStyle = '#f2b21c'; c.strokeStyle = '#d89400'; c.beginPath(); c.ellipse(5, 11, 12, 7, -0.25, 0, TAU); c.fill(); c.stroke();
        } },
        // четырёхлистник
        clover: { draw(c) {
            c.strokeStyle = tone(170); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(4, 18, -1, 29); c.stroke();
            for (let k = 0; k < 4; k++) {
                c.save(); c.rotate(Math.PI / 4 + k * Math.PI / 2); c.scale(0.58, 0.58); c.translate(0, -24);
                heartPath(c); c.fillStyle = linear(c, -20, -10, 20, 22, [[0, tone(255)], [1, tone(200)]]); c.fill();
                c.strokeStyle = tone(170); c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 22); c.lineTo(0, -6); c.stroke(); c.restore();
            }
        } },
        // огонёк: мягкий язык пламени
        flame: { draw(c) {
            c.shadowColor = '#ffffff'; c.shadowBlur = 7;
            c.fillStyle = radial(c, 0, 12, 30, [[0, tone(255)], [0.55, tone(255, 0.85)], [1, tone(255, 0.3)]]);
            c.beginPath(); c.moveTo(0, 30); c.bezierCurveTo(-18, 26, -24, 8, -14, -6); c.bezierCurveTo(-11, -1, -8, 0, -7, 2);
            c.bezierCurveTo(-9, -12, -2, -22, 4, -30); c.bezierCurveTo(5, -18, 14, -12, 17, 2); c.bezierCurveTo(22, 16, 14, 28, 0, 30); c.fill();
        } },
        // ледяной осколок
        crystal: { draw(c) {
            const P = [[0, -30], [13, -13], [13, 13], [0, 30], [-13, 13], [-13, -13]];
            c.fillStyle = tone(192); c.beginPath(); P.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill();
            c.fillStyle = tone(252); c.beginPath(); c.moveTo(0, -30); c.lineTo(-13, -13); c.lineTo(-13, 13); c.lineTo(0, 30); c.closePath(); c.fill();
            c.fillStyle = tone(255, 0.95); c.beginPath(); c.moveTo(0, -22); c.lineTo(7, -11); c.lineTo(0, 0); c.lineTo(-7, -11); c.closePath(); c.fill();
            c.strokeStyle = tone(150); c.lineWidth = 1.4; c.beginPath(); P.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.stroke();
        } },
        // струйка призрачного света: голова снизу, хвост вьётся вверх
        wisp: { draw(c) {
            for (let k = 0; k <= 14; k++) {
                const t = k / 14, x = Math.sin(t * 5.2) * 9 * t, y = 18 - t * 48, r = 11 * (1 - t * 0.78) + 1.5, a = 0.62 * (1 - t) + 0.08;
                c.fillStyle = radial(c, x, y, r, [[0, tone(255, a)], [1, tone(255, 0)]]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
            }
        } },
        // привидение с вырезанными глазами и ртом
        ghost: { draw(c) {
            c.fillStyle = radial(c, 0, -6, 30, [[0, tone(255)], [1, tone(205)]]);
            c.beginPath(); c.moveTo(-20, 24); c.lineTo(-20, -4); c.arc(0, -4, 20, Math.PI, 0, false); c.lineTo(20, 24);
            for (let k = 0; k < 3; k++) c.quadraticCurveTo(20 - 13.33 * k - 6.67, 34, 20 - 13.33 * (k + 1), 24);
            c.closePath(); c.fill();
            c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
            c.beginPath(); c.ellipse(-8, -6, 4, 6, 0, 0, TAU); c.ellipse(8, -6, 4, 6, 0, 0, TAU); c.fill();
            c.beginPath(); c.ellipse(0, 9, 4.5, 3.4, 0, 0, TAU); c.fill();
        } },
        // монета: 8 клеток оборота (ширина |cos|; обратная сторона — другой чекан)
        coin: { cells: 8, draw(c, i) {
            const cs = Math.cos(i * Math.PI / 4);
            c.scale(Math.max(0.13, Math.abs(cs)), 1);
            c.fillStyle = linear(c, -22, -22, 22, 22, [[0, '#fff3a8'], [1, '#f1ac14']]); c.strokeStyle = '#b97a05'; c.lineWidth = 3.6;
            c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.fill(); c.stroke();
            c.strokeStyle = '#d89a10'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.stroke();
            c.fillStyle = 'rgba(190,125,5,.88)';
            if (cs >= 0) { const p = starPoints(5, 12, 5); c.beginPath(); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); c.fill(); } else c.fillRect(-2.6, -11, 5.2, 22);
        } },
        // конфетти: 8 цветов, разный прямоугольник
        confetti: { cells: 8, draw(c, i) {
            const w = 26 + (i * 5) % 9, h = 42 - (i * 3) % 7, col = CONFETTI_COLORS[i];
            c.rotate(((i * 37) % 30 - 15) * Math.PI / 180);
            c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h);
            c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-w / 2, -h / 2, w / 2, h);
        } },
        // воздушный шарик, 4 цвета
        balloon: { cells: 4, draw(c, i) {
            const col = BALLOON_COLORS[i];
            c.strokeStyle = 'rgba(120,120,125,.85)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 22); c.quadraticCurveTo(5, 26, -2, 31); c.stroke();
            c.fillStyle = radial(c, -6, -13, 30, [[0, mixHex(col, 0.55)], [0.45, col], [1, mixHex(col, 0.35, 0)]]);
            c.beginPath(); c.ellipse(0, -5, 18, 22, 0, 0, TAU); c.fill();
            c.fillStyle = mixHex(col, 0.3, 0); c.beginPath(); c.moveTo(-3.6, 21); c.lineTo(3.6, 21); c.lineTo(0, 16.4); c.closePath(); c.fill();
            c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-8, -14, 4, 7.5, 0.5, 0, TAU); c.fill();
        } },
        // лента серпантина: 4 фазы изгиба (листание даёт «трепет»)
        ribbon: { cells: 4, draw(c, i) {
            const ph = i * Math.PI / 2, n = 16, pt = j => { const y = -30 + 60 * j / n, tw = Math.cos(y / 5 + ph); return [9 * Math.sin(y / 7 + ph), y, 2 + 5 * Math.abs(tw), tw]; };
            for (let j = 0; j < n; j++) {
                const a = pt(j), b = pt(j + 1);
                c.fillStyle = a[3] > 0 ? tone(255) : tone(188);
                c.beginPath(); c.moveTo(a[0] - a[2], a[1]); c.lineTo(a[0] + a[2], a[1]); c.lineTo(b[0] + b[2], b[1]); c.lineTo(b[0] - b[2], b[1]); c.closePath(); c.fill();
            }
        } },
        // молния: 3 разных зигзага
        bolt: { cells: 3, draw(c, i) {
            const rnd = lcg(11 + i * 7), pts = [[0, -30]];
            let x = 0; for (let y = -20; y < 30; y += 10) { x = clamp(x + (rnd() - 0.5) * 20, -12, 12); pts.push([x, y]); }
            pts.push([clamp(x + (rnd() - 0.5) * 10, -8, 8), 30]);
            c.lineCap = c.lineJoin = 'round';
            const path = () => { c.beginPath(); pts.forEach(([px, py]) => c.lineTo(px, py)); c.stroke(); };
            c.strokeStyle = tone(255, 0.3); c.lineWidth = 8; path();
            c.strokeStyle = tone(255, 0.7); c.lineWidth = 4; path();
            c.strokeStyle = tone(255); c.lineWidth = 2.2; path();
            const m = pts[3]; c.lineWidth = 1.8; c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(m[0] + (i % 2 ? 11 : -11), m[1] + 9); c.lineTo(m[0] + (i % 2 ? 9 : -9), m[1] + 17); c.stroke();
        } },
        // мягкое кольцо (ударная волна)
        ring: { draw(c) { c.fillStyle = radial(c, 0, 0, 30, [[0, tone(255, 0)], [0.55, tone(255, 0)], [0.8, tone(255)], [0.9, tone(255, 0.55)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64); } },
        // перо
        feather: { draw(c) {
            c.fillStyle = linear(c, -16, 0, 16, 0, [[0, tone(255)], [1, tone(205)]]);
            c.beginPath(); c.moveTo(0, 30); c.bezierCurveTo(-16, 18, -18, -14, 0, -30); c.bezierCurveTo(16, -14, 14, 16, 0, 30); c.fill();
            c.strokeStyle = tone(178); c.lineWidth = 1.1;
            for (let y = -22; y <= 22; y += 5.5) { const e = 15 * Math.sin(Math.PI * (y + 30) / 60); c.beginPath(); c.moveTo(0, y + 3); c.lineTo(e, y - 6); c.moveTo(0, y + 3); c.lineTo(-e, y - 6); c.stroke(); }
            c.strokeStyle = tone(140); c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 31); c.lineTo(0, -28); c.stroke();
        } },
        // лучистая завеса северного сияния: яркий низ, мягкие края, вертикальные лучи
        curtain: { draw(c) {
            for (let x = -30; x < 30; x += 2) {
                const edge = Math.pow(Math.max(0, 1 - Math.abs(x) / 30), 1.2), a = edge * (0.55 + 0.45 * Math.sin(x * 1.7) * Math.sin(x * 0.6 + 1));
                c.fillStyle = linear(c, 0, -32, 0, 32, [[0, tone(255, 0)], [0.55, tone(255, a * 0.5)], [0.86, tone(255, a)], [1, tone(255, 0)]]);
                c.fillRect(x, -32, 2.2, 64);
            }
        } },
        // россыпь: чёткая крупинка, мягкая точка, большой и малый блики (случайная клетка)
        motes: { cells: 4, draw(c, i) {
            if (i === 0) { c.fillStyle = radial(c, 0, 0, 12, [[0, tone(255)], [0.6, tone(255, 0.95)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64); }
            else if (i === 1) { c.fillStyle = radial(c, 0, 0, 22, [[0, tone(255, 0.9)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64); }
            else { const k = i === 2 ? 1 : 0.6; c.fillStyle = radial(c, 0, 0, 14 * k, [[0, tone(255, 0.9)], [1, tone(255, 0)]]); c.fillRect(-32, -32, 64, 64); c.fillStyle = tone(255); c.save(); c.rotate(i === 3 ? 0.4 : 0); star4(c, 30 * k, 3.2); c.restore(); }
        } },
    };

    let fx = null, texFx = null, texCache = new Map();

    /** Нарисовать спрайт на canvas (атлас cells × 1 клеток) или null, если нет document / 2D-контекста. */
    function drawCanvas(name) {
        const spec = has(SPRITES, name) ? SPRITES[name] : null;
        if (!spec || typeof document === 'undefined') return null;
        const cells = spec.cells || 1, cv = document.createElement('canvas');
        cv.width = CELL * cells; cv.height = CELL;
        const c = cv.getContext('2d'); if (!c) return null;
        for (let i = 0; i < cells; i++) {
            c.save(); c.beginPath(); c.rect(i * CELL, 0, CELL, CELL); c.clip(); c.translate(i * CELL + CELL / 2, CELL / 2);
            spec.draw(c, i); c.restore();
        }
        return cv;
    }

    /** RGBA-пиксели атласа: строки перевёрнуты (v вверх), цвет прозрачных пикселей — средний цвет клетки. */
    function rasterize(name) {
        const cv = drawCanvas(name); if (!cv) return null;
        const W = cv.width, cells = W / CELL, src = cv.getContext('2d').getImageData(0, 0, W, CELL).data, out = new Uint8Array(W * CELL * 4);
        for (let i = 0; i < cells; i++) {
            let r = 0, g = 0, b = 0, sum = 0;
            for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
                const k = (y * W + i * CELL + x) * 4, a = src[k + 3]; r += src[k] * a; g += src[k + 1] * a; b += src[k + 2] * a; sum += a;
            }
            const m = sum ? [r / sum, g / sum, b / sum] : [255, 255, 255];
            for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
                const k = (y * W + i * CELL + x) * 4, o = ((CELL - 1 - y) * W + i * CELL + x) * 4, a = src[k + 3] / 255;
                out[o] = src[k] * a + m[0] * (1 - a); out[o + 1] = src[k + 1] * a + m[1] * (1 - a); out[o + 2] = src[k + 2] * a + m[2] * (1 - a); out[o + 3] = src[k + 3];
            }
        }
        return { data: out, w: W, h: CELL };
    }

    /** Текстура спрайта для текущего менеджера (кэш на менеджер) или null. */
    function spriteTexture(name) {
        if (!name || !has(SPRITES, name)) return null;
        const scene = fx && fx.scene;
        if (!scene || typeof BABYLON === 'undefined' || !BABYLON.RawTexture) return null;
        if (texFx !== fx) { texFx = fx; texCache = new Map(); }
        if (texCache.has(name)) return texCache.get(name);
        let tex = null;
        try {
            const px = rasterize(name);
            if (px) {
                tex = BABYLON.RawTexture.CreateRGBATexture(px.data, px.w, px.h, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
                tex.hasAlpha = true; tex.name = 'gamefx-' + name; tex.wrapU = tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
            }
        } catch (e) { tex = null; }
        texCache.set(name, tex);   // null тоже запоминаем: не рисуем заново каждый раз
        return tex;
    }

    // ------------------------------------------------------------------------------------------------
    // ЦВЕТОВЫЕ ГРАДИЕНТЫ ЧАСТИЦ (формат ParticleFX: [[t, '#rrggbb', alpha], …])
    // ------------------------------------------------------------------------------------------------
    /** Один цвет: плавно появляется, держится до hold, гаснет к концу жизни. */
    const fade = (c, a = 1, hold = 0.65) => [[0, c, 0], [0.1, c, a], [hold, c, a], [1, c, 0]];
    /** Два цвета: от c1 к c2. */
    const pair = (c1, c2, a = 1) => [[0, c1, 0], [0.12, c1, a], [0.65, c2, a], [1, c2, 0]];
    /** Несколько цветов равномерно по жизни; последний — с нулевой прозрачностью. */
    function ramp(cols, a = 1, fin = 0.08) {
        const n = cols.length, out = [[0, cols[0], 0]];
        cols.forEach((c, i) => out.push([n === 1 ? fin : fin + (1 - fin) * i / (n - 1), c, i === n - 1 ? 0 : a]));
        if (n === 1) { out[1][2] = a; out.push([1, cols[0], 0]); }
        return out;
    }
    const RAINBOW = ['#ff4d4d', '#ff9a3d', '#ffe14d', '#5ee06b', '#4dd2ff', '#5d7bff', '#b06bff'];
    const FLUTTER = [[0, 0.9], [0.12, 0.5], [0.25, 1], [0.38, 0.45], [0.5, 1], [0.62, 0.5], [0.75, 1], [0.88, 0.5], [1, 0.9]];   // «трепет» размера: бумажка кувыркается
    const PULSE = [[0, 0.15], [0.25, 1], [0.45, 0.45], [0.65, 1], [1, 0]];                                                        // мерцание блика
    const UP = [[-0.35, 1, -0.35], [0.35, 1, 0.35]];
    const ALL = [[-1, -1, -1], [1, 1, 1]];

    // ------------------------------------------------------------------------------------------------
    // РЕЦЕПТЫ СЛОЁВ. Поля слоя (имена — по ParticleFX, плюс свои):
    //   sprite       имя спрайта (нет — мягкая точка ParticleFX); cycles — оборотов листания за жизнь (0 + randomCell — случайная
    //                клетка без листания); rot — случайный начальный поворот; stretch — вытянуть по скорости
    //   rate / burst частиц в секунду / разом; dur — сколько секунд идёт эмиссия (rate); life, size, speed, spin, gravity
    //   dir, box     направление и объём эмиссии; emitter — ['sphere'|'hemi', r, range] | ['cone', r, угол, range (0 — кольцо)] | ['ring', r, h, разброс]
    //   szg, cg      sizeGradient (множитель) и colorGradient; color, color2, alpha — если градиента нет; blend: 'add' | 'std'
    //   vel          [[t, множитель скорости]] — торможение осколков (феерверк)
    // ------------------------------------------------------------------------------------------------
    /** Рецепт следа: layers — 1–2 слоя на суше, water — пара цветов (или градиент) для пузырей у поверхности воды. */
    const TRAIL = {
        bubbles: { water: ['#d6efff', '#ffffff'], layers: [{ sprite: 'bubble', blend: 'std', rate: 32, life: [0.8, 1.5], size: [7, 14], speed: [8, 26], dir: [[-0.5, 0.35, -0.5], [0.5, 1, 0.5]], gravity: [0, 38, 0], box: [[-14, 2, -14], [14, 16, 14]], szg: [[0, 0.4], [0.25, 1], [1, 1.15]], cg: fade('#d4ecff', 0.95, 0.6) }] },
        foam: { water: ['#ffffff', '#e8f6ff'], layers: [{ sprite: 'puff', blend: 'std', rate: 22, life: [0.55, 1], size: [16, 26], speed: [6, 22], dir: [[-1, 0.15, -1], [1, 0.6, 1]], gravity: [0, 6, 0], box: [[-12, 0, -12], [12, 10, 12]], spin: [-0.8, 0.8], rot: true, szg: [[0, 0.5], [1, 1.8]], cg: [[0, '#ffffff', 0], [0.12, '#ffffff', 0.6], [1, '#e6f6ff', 0]] }] },
        droplets: { water: ['#7fc4ff', '#4aa0f0'], layers: [{ sprite: 'drop', blend: 'std', rate: 36, life: [0.45, 0.85], size: [7, 12], speed: [110, 250], dir: [[-0.7, 0.8, -0.7], [0.7, 1.3, 0.7]], gravity: [0, -640, 0], box: [[-8, 4, -8], [8, 16, 8]], cg: [[0, '#8fd0ff', 1], [0.8, '#4aa0f0', 0.95], [1, '#4aa0f0', 0]] }] },
        leaves: { water: ['#7be25a', '#3fbf45'], layers: [{ sprite: 'leaf', cycles: 2.5, rot: true, blend: 'std', rate: 12, life: [1.3, 2.2], size: [11, 18], speed: [10, 34], dir: [[-0.7, 0.3, -0.7], [0.7, 1, 0.7]], gravity: [0, -38, 0], box: [[-18, 6, -18], [18, 40, 18]], spin: [-3, 3], cg: ramp(['#86e862', '#3fbf45', '#2c9a3a'], 1, 0.1) }] },
        dust: { water: ['#e2d3b0', '#cdbb94'], layers: [{ sprite: 'puff', blend: 'std', rate: 26, life: [0.5, 1.1], size: [14, 26], speed: [10, 34], dir: [[-1, 0.1, -1], [1, 0.45, 1]], gravity: [0, 4, 0], box: [[-14, 0, -14], [14, 6, 14]], spin: [-0.6, 0.6], rot: true, szg: [[0, 0.5], [1, 2]], cg: [[0, '#e2d3b0', 0], [0.1, '#e2d3b0', 0.55], [1, '#cdbb94', 0]] }] },
        petals: { water: ['#ffb7d2', '#ff8fba'], layers: [{ sprite: 'petal', cycles: 2, rot: true, blend: 'std', rate: 12, life: [1.6, 2.8], size: [10, 16], speed: [6, 24], dir: [[-0.8, 0.2, -0.8], [0.8, 0.8, 0.8]], gravity: [0, -14, 0], box: [[-24, 10, -24], [24, 50, 24]], spin: [-2, 2], cg: pair('#ffbdd6', '#ff8fba') }] },
        snow: { water: ['#ffffff', '#e8f2ff'], layers: [{ sprite: 'snow', blend: 'std', rate: 15, life: [2, 3.4], size: [8, 15], speed: [4, 16], dir: [[-1, 0.2, -1], [1, 0.8, 1]], gravity: [0, -14, 0], box: [[-30, 10, -30], [30, 70, 30]], spin: [-1, 1], rot: true, cg: fade('#ffffff', 0.95, 0.75) }] },
        sparks: { water: ['#ffb040', '#ff7a1a'], layers: [{ sprite: 'spark', stretch: true, blend: 'add', rate: 60, life: [0.25, 0.6], size: [9, 14], speed: [80, 200], dir: [[-1, 0.2, -1], [1, 1, 1]], gravity: [0, -280, 0], box: [[-8, 2, -8], [8, 10, 8]], cg: ramp(['#fff6c0', '#ffb040', '#ff5a1a'], 1) }] },
        sparkle: { water: ['#ffd24a', '#ffbe2e'], layers: [{ sprite: 'glint', blend: 'add', rate: 30, life: [0.6, 1.3], size: [10, 18], speed: [3, 16], dir: [[-1, 0.3, -1], [1, 1, 1]], gravity: [0, 4, 0], box: [[-28, 10, -28], [28, 90, 28]], spin: [-0.8, 0.8], szg: PULSE, cg: pair('#ffc933', '#ffe27a') }] },
        hearts: { water: ['#ff7aa8', '#ffb0cf'], layers: [{ sprite: 'heart', blend: 'std', rate: 9, life: [1, 1.7], size: [13, 24], speed: [14, 36], dir: UP, gravity: [0, 22, 0], box: [[-14, 20, -14], [14, 50, 14]], spin: [-0.7, 0.7], szg: [[0, 0.2], [0.2, 1], [0.85, 0.9], [1, 0.4]], cg: pair('#ff6fa0', '#ff9cc2') }] },
        confetti: { water: ['#ffd23f', '#3fa7ff'], layers: [{ sprite: 'confetti', cycles: 0, randomCell: true, rot: true, blend: 'std', rate: 34, life: [1, 1.8], size: [10, 15], speed: [25, 80], dir: [[-1, 0.4, -1], [1, 1.3, 1]], gravity: [0, -100, 0], box: [[-12, 10, -12], [12, 50, 12]], spin: [-9, 9], szg: FLUTTER, cg: fade('#ffffff', 1, 0.75) }] },
        stars: { water: ['#ffe14d', '#ffc400'], layers: [{ sprite: 'star', blend: 'std', rate: 10, life: [0.9, 1.6], size: [12, 22], speed: [20, 48], dir: [[-0.8, 0.8, -0.8], [0.8, 1.3, 0.8]], gravity: [0, -30, 0], box: [[-16, 20, -16], [16, 60, 16]], spin: [-2.2, 2.2], rot: true, szg: [[0, 0.2], [0.2, 1], [0.8, 1], [1, 0]], cg: pair('#ffe86a', '#ffc41f') }] },
        notes: { water: ['#6a9bff', '#b36bff'], layers: [{ sprite: 'note', cycles: 0, randomCell: true, blend: 'std', rate: 6, life: [1.1, 1.9], size: [15, 26], speed: [16, 38], dir: [[-0.5, 1, -0.5], [0.5, 1.2, 0.5]], gravity: [0, 8, 0], box: [[-16, 30, -16], [16, 60, 16]], spin: [-0.25, 0.25], cg: pair('#6a9bff', '#b36bff') }] },
        ducks: { water: ['#ffe05a', '#ffd23a'], layers: [{ sprite: 'duck', blend: 'std', rate: 6, life: [1, 1.7], size: [15, 22], speed: [20, 44], dir: [[-0.5, 1, -0.5], [0.5, 1.2, 0.5]], gravity: [0, 22, 0], box: [[-16, 20, -16], [16, 50, 16]], spin: [-0.6, 0.6], szg: [[0, 0.3], [0.2, 1], [1, 0.9]], cg: fade('#ffffff', 1, 0.7) }] },
        clover: { water: ['#46d35a', '#8dff8f'], layers: [{ sprite: 'clover', blend: 'std', rate: 8, life: [1.2, 2], size: [13, 21], speed: [10, 32], dir: [[-0.6, 0.6, -0.6], [0.6, 1.2, 0.6]], gravity: [0, 10, 0], box: [[-18, 20, -18], [18, 50, 18]], spin: [-1.5, 1.5], rot: true, szg: [[0, 0.3], [0.2, 1], [1, 0.9]], cg: pair('#46d35a', '#7dee86') }] },
        flame: { water: ['#ffb02e', '#ff5a1a'], layers: [{ sprite: 'flame', blend: 'add', rate: 32, life: [0.45, 0.9], size: [24, 36], speed: [24, 60], dir: [[-0.25, 1, -0.25], [0.25, 1.2, 0.25]], gravity: [0, 70, 0], box: [[-10, 0, -10], [10, 10, 10]], szg: [[0, 0.8], [0.3, 1], [1, 0.2]], cg: ramp(['#ffc23a', '#ff6a1a', '#c8300a'], 0.85) }] },
        ice: { water: ['#c8f0ff', '#8fd8ff'], layers: [{ sprite: 'crystal', blend: 'std', rate: 14, life: [1, 1.8], size: [12, 20], speed: [12, 36], dir: [[-0.8, 0.2, -0.8], [0.8, 1, 0.8]], gravity: [0, -60, 0], box: [[-20, 10, -20], [20, 50, 20]], spin: [-3, 3], rot: true, cg: pair('#cdf2ff', '#8fd8ff') }] },
        rainbow: { water: ramp(RAINBOW, 0.9), layers: [{ sprite: 'dot', blend: 'std', rate: 90, life: [0.8, 1.1], size: [11, 15], speed: [0, 5], dir: [[-0.5, 0, -0.5], [0.5, 0.3, 0.5]], box: [[-3, 18, -3], [3, 26, 3]], szg: [[0, 1], [0.8, 1], [1, 0.4]], cg: ramp(RAINBOW, 1, 0.04) }] },
        ghost: { water: ['#d8ffe8', '#b8f5d0'], layers: [{ sprite: 'wisp', blend: 'std', rate: 12, life: [1.2, 2], size: [22, 38], speed: [4, 12], dir: [[-0.4, 0.8, -0.4], [0.4, 1, 0.4]], gravity: [0, 16, 0], box: [[-14, 10, -14], [14, 60, 14]], spin: [-0.5, 0.5], rot: true, szg: [[0, 0.6], [1, 1.4]], cg: [[0, '#d8ffe8', 0], [0.2, '#d8ffe8', 0.7], [1, '#b8f5d0', 0]] }] },
        coins: { water: ['#ffd23a', '#ffb01f'], layers: [{ sprite: 'coin', cycles: 3, blend: 'std', rate: 9, life: [0.8, 1.4], size: [14, 20], speed: [25, 60], dir: [[-0.8, 0.8, -0.8], [0.8, 1.4, 0.8]], gravity: [0, -170, 0], box: [[-14, 30, -14], [14, 60, 14]], cg: fade('#ffffff', 1, 0.8) }] },
        lightning: { water: ['#e8f6ff', '#9fd8ff'], layers: [{ sprite: 'bolt', cycles: 0, randomCell: true, rot: true, blend: 'add', rate: 55, life: [0.14, 0.3], size: [24, 42], speed: [0, 30], dir: [[-1, -0.3, -1], [1, 0.6, 1]], box: [[-30, 10, -30], [30, 150, 30]], spin: [-6, 6], szg: [[0, 1], [0.3, 0.25], [0.55, 1], [0.8, 0.2], [1, 0]], cg: [[0, '#e8f6ff', 1], [0.5, '#9fd8ff', 1], [1, '#7fc0ff', 0]] }] },
        aurora: { water: ['#4dffb4', '#a47bff'], layers: [{ sprite: 'puff', blend: 'add', rate: 7, life: [1.5, 2.5], size: [40, 64], speed: [4, 14], dir: [[-1, 0.2, -1], [1, 0.8, 1]], gravity: [0, 5, 0], box: [[-44, 80, -44], [44, 190, 44]], spin: [-0.2, 0.2], rot: true, szg: [[0, 0.6], [1, 1.3]], cg: [[0, '#4dffb4', 0], [0.25, '#4dffb4', 0.3], [0.6, '#7ad8ff', 0.26], [0.85, '#a47bff', 0.24], [1, '#a47bff', 0]] }] },
        goldstream: { water: ['#fff3b8', '#ffb01f'], layers: [{ sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', rate: 90, life: [0.55, 1.1], size: [5, 12], speed: [4, 34], dir: [[-1, 0.2, -1], [1, 0.9, 1]], gravity: [0, -14, 0], box: [[-22, 4, -22], [22, 70, 22]], spin: [-1.5, 1.5], szg: [[0, 1], [1, 0.3]], cg: ramp(['#ffe9a0', '#ffc933', '#ff9a1f'], 1) }] },
        galaxy: { water: ['#ffffff', '#7a5cff'], orbit: { r: 34, w: 7, h: 70, v: 26 }, layers: [{ sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', rate: 70, life: [0.7, 1.3], size: [7, 14], speed: [3, 18], dir: [[-1, -0.3, -1], [1, 0.4, 1]], spin: [-1, 1], szg: [[0, 1], [1, 0.3]], cg: ramp(['#e8ecff', '#9aa8ff', '#6a48f0'], 1) }] },
        phoenix: { water: ['#ffb02e', '#ff5a1a'], layers: [
            { sprite: 'flame', blend: 'add', rate: 30, life: [0.55, 1.1], size: [38, 56], speed: [28, 70], dir: [[-0.3, 1, -0.3], [0.3, 1.2, 0.3]], gravity: [0, 80, 0], box: [[-14, 0, -14], [14, 16, 14]], szg: [[0, 0.7], [0.3, 1], [1, 0.15]], cg: ramp(['#ffd04a', '#ff8a1f', '#e03a10', '#8a1a0a'], 0.9) },
            { sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', rate: 34, life: [0.8, 1.7], size: [4, 9], speed: [30, 100], dir: [[-0.7, 0.8, -0.7], [0.7, 1.5, 0.7]], gravity: [0, 36, 0], box: [[-18, 4, -18], [18, 40, 18]], cg: ramp(['#fff3b0', '#ffc933', '#ff6a1f'], 1) }] },
        abyss: { water: ['#3ff0ff', '#0c4a8c'], layers: [
            { sprite: 'puff', blend: 'std', rate: 12, life: [1, 1.8], size: [26, 46], speed: [4, 16], dir: [[-1, 0.1, -1], [1, 0.7, 1]], gravity: [0, 8, 0], box: [[-18, 6, -18], [18, 40, 18]], spin: [-0.4, 0.4], rot: true, szg: [[0, 0.5], [1, 1.7]], cg: [[0, '#144a8c', 0], [0.15, '#144a8c', 0.62], [1, '#0a2a5a', 0]] },
            { sprite: 'glint', blend: 'add', rate: 16, life: [0.5, 1.1], size: [7, 13], speed: [10, 40], dir: [[-1, 0.2, -1], [1, 1, 1]], gravity: [0, -10, 0], box: [[-24, 8, -24], [24, 80, 24]], spin: [-1, 1], szg: PULSE, cg: pair('#7ff8ff', '#2ec8e8') }] },
    };

    /** Пузыри у поверхности воды: на плавании след любого вида — пузыри цвета этого следа. */
    function waterLayer(w) {
        return { sprite: 'bubble', blend: 'std', rate: 40, life: [0.7, 1.3], size: [7, 15], speed: [10, 34], dir: [[-0.7, 0.5, -0.7], [0.7, 1.1, 0.7]], gravity: [0, 28, 0],
            box: [[-44, -16, -44], [44, 8, 44]], szg: [[0, 0.4], [0.3, 1], [1, 1.1]], cg: Array.isArray(w[0]) ? w : pair(w[0], w[1], 0.92) };
    }

    // Мерцание редких причёсок и шляпок: тихое, 4–10 частиц/с у головы.
    const FLAIR = {
        epic: { sprite: 'glint', blend: 'add', rate: 4, life: [0.7, 1.2], size: [6, 10], speed: [2, 10], dir: ALL, box: [[-22, -14, -22], [22, 26, 22]], szg: PULSE, cg: pair('#ffd54a', '#ffe9a0') },
        legendary: { sprite: 'motes', cycles: 0, randomCell: true, blend: 'add', rate: 7, life: [0.7, 1.3], size: [6, 11], speed: [2, 12], dir: ALL, box: [[-24, -14, -24], [24, 28, 24]], szg: PULSE, color: '#ffd54a', color2: '#ffffff' },
        mythic: { sprite: 'glint', blend: 'add', rate: 10, life: [0.9, 1.5], size: [7, 12], speed: [3, 14], dir: ALL, box: [[-26, -16, -26], [26, 30, 26]], spin: [-1, 1], szg: PULSE, cg: ramp(RAINBOW, 0.95, 0.12) },
    };

    // ------------------------------------------------------------------------------------------------
    // РЕЦЕПТЫ ПОБЕД. Каждая — функция от контекста X: X.go(задержка, слой, [dx,dy,dz]) — вспышка/струя в точке,
    // X.path(задержка, слой, k => [dx,dy,dz]) — эмиттер едет по пути (k: 0..1 за слой.dur), X.at(задержка, fn) — свой таймер,
    // X.p — точка финиша, X.R — «вправо» относительно камеры (горизонтальный вектор), X.rnd() — случайное 0..1.
    // ------------------------------------------------------------------------------------------------
    /** Салют: снаряд поднимается, затем сфера искр-штрихов, блёстки и мелкий треск. pal — два цвета; big — крупнее;
     *  lean — экономный (серия мегасалюта): только штрихи без россыпи и треска — меньше систем одновременно. */
    function shell(X, delay, side, depth, h, pal, big, lean) {
        const sx = X.R[0] * side + X.R[2] * depth * -1, sz = X.R[2] * side + X.R[0] * depth, rise = 0.5, k = big ? 1.25 : 1, lf = lean ? 0.75 : 1;
        X.path(delay, { sprite: 'dot', blend: 'add', rate: 100, dur: rise, life: [0.2, 0.4], size: [6, 10], speed: [5, 24], dir: [[-1, -1, -1], [1, -0.2, 1]], gravity: [0, -70, 0], cg: ramp(['#fffbe0', '#ffc860', '#ff8a30'], 1) },
            t => [sx, h * (1 - (1 - t) * (1 - t)), sz]);
        X.at(delay + rise, () => {
            const o = [sx, h, sz];
            X.go(0, { sprite: 'dot', blend: 'add', burst: 1, life: [0.22, 0.3], size: [170 * k, 200 * k], szg: [[0, 0.4], [1, 1.2]], cg: [[0, pal[0], 0.8], [1, pal[0], 0]] }, o);
            X.go(0, { sprite: 'spark', stretch: true, blend: 'add', burst: Math.round(62 * k * (lean ? 1.3 : 1)), life: [1 * lf, 1.5 * lf], size: [11, 17], speed: [170 * k, 270 * k], emitter: ['sphere', 1, 0], gravity: [0, -110, 0], vel: [[0, 1], [0.6, 0.3], [1, 0.08]], szg: [[0, 1], [0.7, 0.7], [1, 0.2]], cg: [[0, '#ffffff', 1], [0.12, pal[0], 1], [0.7, pal[1], 0.9], [1, pal[1], 0]] }, o);
            if (!lean) X.go(0, { sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', burst: Math.round(34 * k), life: [1.1, 1.7], size: [8, 14], speed: [90, 200 * k], emitter: ['sphere', 1, 0], gravity: [0, -90, 0], vel: [[0, 1], [1, 0.15]], szg: PULSE, cg: pair('#ffffff', pal[1]) }, o);
            if (!lean) X.go(0.4, { sprite: 'glint', rot: true, blend: 'add', burst: Math.round(24 * k), life: [0.6, 1], size: [9, 14], speed: [40, 110], emitter: ['sphere', 1, 0], gravity: [0, -110, 0], vel: [[0, 1], [1, 0.2]], szg: PULSE, cg: pair('#ffffff', pal[1]) }, o);
        });
    }
    const PALETTES = [['#ffd24a', '#ff9a1f'], ['#ff6fd0', '#c43dff'], ['#6fe6ff', '#4a7bff'], ['#8dff7a', '#2fd08a'], ['#ff8a6f', '#ff3d5e'], ['#ffffff', '#9fd8ff']];

    /** Рой молний: вспышка и радиальные зигзаги. */
    function bolts(X, delay, off, color, flash) {
        X.go(delay, { sprite: 'dot', blend: 'add', burst: 2, life: [0.16, 0.26], size: flash, szg: [[0, 0.5], [1, 1.1]], cg: [[0, color[0], 0.6], [1, color[0], 0]] }, off);
        X.go(delay, { sprite: 'bolt', cycles: 0, randomCell: true, stretch: true, blend: 'add', burst: 14, life: [0.18, 0.32], size: [40, 66], speed: [260, 420], emitter: ['sphere', 1, 0], vel: [[0, 1], [1, 0.3]], cg: [[0, '#ffffff', 1], [0.5, color[0], 1], [1, color[1], 0]] }, off);
    }
    const WATER_CG = [[0, '#9ad6ff', 1], [0.8, '#4aa0f0', 0.9], [1, '#4aa0f0', 0]];

    const VICT = {
        // пушка вверх, второй залп, затем медленный дождь бумажек
        confetti(X) {
            const piece = { sprite: 'confetti', cycles: 0, randomCell: true, rot: true, blend: 'std', size: [12, 18], spin: [-10, 10], szg: FLUTTER, cg: fade('#ffffff', 1, 0.78) };
            X.go(0, { ...piece, burst: 60, life: [1.9, 2.8], speed: [170, 340], emitter: ['cone', 5, 0.9], gravity: [0, -300, 0] }, [0, 40, 0]);
            X.go(0.2, { ...piece, burst: 40, life: [1.7, 2.6], speed: [130, 280], emitter: ['cone', 5, 1.4], gravity: [0, -300, 0] }, [0, 40, 0]);
            X.go(0.5, { ...piece, rate: 34, dur: 1.4, life: [2, 2.6], speed: [40, 90], dir: [[-0.3, -1, -0.3], [0.3, -0.4, 0.3]], gravity: [0, -50, 0], box: [[-210, 0, -210], [210, 30, 210]] }, [0, 250, 0]);
        },
        // кольцо-фонтан пузырей и брызг вокруг героя, пена у основания
        fountain(X) {
            X.go(0, { sprite: 'bubble', blend: 'std', rate: 70, dur: 2.4, life: [1.2, 1.8], size: [12, 22], speed: [200, 300], emitter: ['cone', 55, 0.3, 0], gravity: [0, -330, 0], cg: fade('#d4ecff', 0.95, 0.7) }, [0, 4, 0]);
            X.go(0, { sprite: 'drop', blend: 'std', rate: 55, dur: 2.4, life: [0.9, 1.4], size: [9, 15], speed: [180, 290], emitter: ['cone', 55, 0.5, 0], gravity: [0, -520, 0], cg: WATER_CG }, [0, 4, 0]);
            const foam = { sprite: 'puff', blend: 'std', burst: 14, life: [0.8, 1.3], size: [24, 40], speed: [30, 70], emitter: ['ring', 40, 0, 0.2], spin: [-0.6, 0.6], rot: true, szg: [[0, 0.5], [1, 1.9]], cg: [[0, '#ffffff', 0], [0.15, '#ffffff', 0.6], [1, '#e6f6ff', 0]] };
            X.go(0, foam, [0, 8, 0]);
            X.go(1.2, { ...foam, burst: 10 }, [0, 8, 0]);
        },
        // корона из капель по кольцу, столб брызг и пена
        splash(X) {
            X.go(0, { sprite: 'drop', blend: 'std', burst: 70, life: [1, 1.5], size: [12, 20], speed: [130, 240], emitter: ['ring', 12, 0, 0.35], gravity: [0, -420, 0], cg: WATER_CG }, [0, 10, 0]);
            X.go(0, { sprite: 'drop', blend: 'std', burst: 40, life: [1.1, 1.6], size: [10, 17], speed: [200, 320], emitter: ['cone', 30, 0.5, 0], gravity: [0, -480, 0], cg: WATER_CG }, [0, 10, 0]);
            X.go(0, { sprite: 'puff', blend: 'std', burst: 14, life: [1.1, 1.7], size: [34, 56], speed: [25, 70], emitter: ['hemi', 20, 0], rot: true, szg: [[0, 0.5], [1, 1.8]], cg: [[0, '#ffffff', 0], [0.15, '#ffffff', 0.7], [1, '#e6f6ff', 0]] }, [0, 6, 0]);
            X.go(0.15, { sprite: 'drop', blend: 'std', burst: 36, life: [0.9, 1.3], size: [10, 16], speed: [90, 170], emitter: ['ring', 12, 0, 0.35], gravity: [0, -420, 0], cg: WATER_CG }, [0, 10, 0]);
        },
        // длинные цветные ленты веером
        streamers(X) {
            ['#ff4d6d', '#ffd23f', '#3fa7ff', '#4ade80'].forEach((col, i) => X.go(i * 0.06, { sprite: 'ribbon', cycles: 2.2, stretch: true, blend: 'std', burst: 11, life: [1.8, 2.6], size: [30, 46], speed: [200, 340], emitter: ['cone', 5, 1.3], gravity: [0, -230, 0], cg: fade(col, 1, 0.8) }, [0, 40, 0]));
        },
        // лепестки сыплются сверху
        petals(X) {
            const rain = { sprite: 'petal', cycles: 1.5, rot: true, blend: 'std', dur: 1.8, life: [2.4, 3.2], size: [14, 22], speed: [50, 90], dir: [[-0.5, -1, -0.5], [0.5, -0.5, 0.5]], gravity: [0, -22, 0], spin: [-2, 2], box: [[-220, 0, -220], [220, 30, 220]] };
            X.go(0, { ...rain, rate: 22, cg: pair('#ffb0cc', '#ff7fb0') }, [0, 250, 0]);
            X.go(0.15, { ...rain, rate: 13, size: [12, 18], cg: pair('#ffe6ef', '#ffc4d9') }, [0, 250, 0]);
        },
        // шарики поднимаются кольцом вокруг героя
        balloons(X) {
            const b = { sprite: 'balloon', cycles: 0, randomCell: true, blend: 'std', life: [3.6, 4.6], size: [34, 48], speed: [40, 75], dir: [[-0.15, 1, -0.15], [0.15, 1, 0.15]], gravity: [0, 10, 0], spin: [-0.25, 0.25], box: [[-100, 0, -100], [100, 10, 100]], cg: fade('#ffffff', 1, 0.86) };
            X.go(0, { ...b, burst: 12 }, [0, 5, 0]);
            X.go(0.5, { ...b, burst: 10 }, [0, 5, 0]);
        },
        // всплеск монет у ног и золотой дождь
        coinrain(X) {
            const coin = { sprite: 'coin', cycles: 3, blend: 'std', size: [17, 24], cg: fade('#ffffff', 1, 0.85) };
            X.go(0, { ...coin, burst: 24, life: [1.4, 2], speed: [220, 340], emitter: ['cone', 5, 0.9], gravity: [0, -480, 0] }, [0, 30, 0]);
            X.go(0.4, { ...coin, rate: 32, dur: 2, life: [1.6, 2.2], speed: [50, 110], dir: [[-0.3, -1, -0.3], [0.3, -0.5, 0.3]], gravity: [0, -240, 0], box: [[-210, 0, -210], [210, 30, 210]] }, [0, 270, 0]);
        },
        // три залпа на разной высоте: снаряд летит, затем взрыв сферой
        fireworks(X) {
            shell(X, 0, -95, 0, 190, PALETTES[0]);
            shell(X, 0.85, 90, 20, 235, PALETTES[1]);
            shell(X, 1.7, 0, -20, 205, PALETTES[2], true);
        },
        // всплеск и подскакивающие резиновые уточки
        ducks(X) {
            X.go(0, { sprite: 'drop', blend: 'std', burst: 40, life: [0.7, 1.1], size: [10, 16], speed: [120, 230], emitter: ['cone', 5, 1.7], gravity: [0, -520, 0], cg: WATER_CG }, [0, 8, 0]);
            const duck = { sprite: 'duck', blend: 'std', spin: [-1.2, 1.2], gravity: [0, -420, 0], cg: fade('#ffffff', 1, 0.85) };
            X.go(0, { ...duck, burst: 12, life: [1.7, 2.4], size: [28, 38], speed: [250, 380], emitter: ['cone', 5, 0.9] }, [0, 10, 0]);
            X.go(0.3, { ...duck, burst: 8, life: [1.5, 2.1], size: [24, 30], speed: [180, 300], emitter: ['cone', 5, 1.4] }, [0, 10, 0]);
        },
        // розовая вспышка и кольцо сердец, всплывающих вверх
        hearts(X) {
            X.go(0, { sprite: 'dot', blend: 'add', burst: 2, life: [0.5, 0.7], size: [190, 230], szg: [[0, 0.3], [0.4, 1], [1, 1.2]], cg: [[0, '#ff6fa5', 0.45], [1, '#ff6fa5', 0]] }, [0, 90, 0]);
            const heart = { sprite: 'heart', blend: 'std', gravity: [0, 30, 0], spin: [-0.5, 0.5], szg: [[0, 0.2], [0.2, 1], [0.85, 0.9], [1, 0.4]], cg: pair('#ff6fa0', '#ff9cc2') };
            X.go(0, { ...heart, burst: 24, life: [1.8, 2.6], size: [24, 38], speed: [70, 150], emitter: ['hemi', 2, 0] }, [0, 40, 0]);
            X.go(0.35, { ...heart, burst: 18, life: [1.6, 2.3], size: [16, 24], speed: [40, 90], emitter: ['hemi', 2, 0] }, [0, 40, 0]);
        },
        // звёздный дождь с блёстками
        stars(X) {
            X.go(0, { sprite: 'star', blend: 'std', rate: 28, dur: 2.2, life: [1.6, 2.2], size: [20, 30], speed: [90, 160], dir: [[-0.3, -1, -0.3], [0.3, -0.6, 0.3]], gravity: [0, -200, 0], spin: [-3, 3], rot: true, box: [[-210, 0, -210], [210, 30, 210]], szg: [[0, 0.3], [0.15, 1], [0.85, 1], [1, 0.2]], cg: pair('#ffe86a', '#ffc41f') }, [0, 270, 0]);
            X.go(0.1, { sprite: 'glint', blend: 'add', rate: 40, dur: 2.2, life: [1.4, 2], size: [10, 16], speed: [50, 100], dir: [[-0.3, -1, -0.3], [0.3, -0.6, 0.3]], gravity: [0, -120, 0], box: [[-210, 0, -210], [210, 30, 210]], szg: PULSE, cg: pair('#ffd24a', '#ffc933') }, [0, 260, 0]);
        },
        // мягкий снег двумя слоями
        snowfall(X) {
            X.go(0, { sprite: 'snow', blend: 'std', rate: 40, dur: 2.2, life: [3.2, 4], size: [11, 18], speed: [55, 95], dir: [[-0.4, -1, -0.4], [0.4, -0.6, 0.4]], gravity: [0, -4, 0], spin: [-1, 1], rot: true, box: [[-230, 0, -230], [230, 30, 230]], cg: fade('#ffffff', 0.95, 0.85) }, [0, 265, 0]);
            X.go(0, { sprite: 'puff', blend: 'std', rate: 6, dur: 2.2, life: [3.2, 4], size: [30, 46], speed: [40, 70], dir: [[-0.4, -1, -0.4], [0.4, -0.6, 0.4]], rot: true, box: [[-230, 0, -230], [230, 30, 230]], cg: [[0, '#ffffff', 0], [0.2, '#ffffff', 0.28], [0.8, '#f2f8ff', 0.24], [1, '#ffffff', 0]] }, [0, 255, 0]);
        },
        // золотое сияние: большая мягкая вспышка, кольцо, всплывающие блёстки
        golden(X) {
            X.go(0, { sprite: 'dot', blend: 'add', burst: 3, life: [1.3, 1.8], size: [180, 260], szg: [[0, 0.25], [0.35, 1], [1, 1.25]], cg: [[0, '#ffc933', 0], [0.2, '#ffc933', 0.45], [1, '#ff9a1f', 0]] }, [0, 90, 0]);
            X.go(0, { sprite: 'ring', blend: 'add', burst: 2, life: [0.9, 1.1], size: [60, 70], szg: [[0, 0.3], [1, 3.4]], cg: [[0, '#ffe27a', 1], [1, '#ffb01f', 0]] }, [0, 90, 0]);
            X.go(0, { sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', rate: 80, dur: 2.2, life: [1, 1.8], size: [8, 16], speed: [50, 130], dir: [[-0.5, 1, -0.5], [0.5, 1.4, 0.5]], gravity: [0, 20, 0], box: [[-70, 0, -70], [70, 60, 70]], cg: ramp(['#ffe9a0', '#ffc933', '#ff9a1f'], 1) }, [0, 0, 0]);
        },
        // радуга: четыре дуги цветных частиц строятся над героем лицом к камере
        rainbow(X) {
            ['#ff4d4d', '#ffc83d', '#5be06b', '#4aa8ff'].forEach((col, i) => {
                const r = 150 + i * 18;
                X.path(i * 0.04, { sprite: 'dot', blend: 'std', rate: 170, dur: 0.75, life: [1.6, 2.1], size: [15, 18], speed: [0, 2], dir: ALL, cg: fade(col, 1, 0.7) },
                    t => { const a = Math.PI * (1 - t), cx = Math.cos(a) * r; return [X.R[0] * cx, Math.sin(a) * r + 4, X.R[2] * cx]; });
            });
        },
        // вспышка и радиальные молнии тремя-четырьмя волнами
        lightning(X) {
            const blue = ['#bfe3ff', '#7fc0ff'];
            bolts(X, 0, [0, 110, 0], blue, [240, 300]);
            bolts(X, 0.4, [X.R[0] * 50, 150, X.R[2] * 50], blue, [200, 250]);
            bolts(X, 0.8, [X.R[0] * -60, 90, X.R[2] * -60], blue, [200, 250]);
            bolts(X, 1.25, [0, 120, 0], ['#ffffff', '#9fd8ff'], [300, 360]);
        },
        // взрыв ледяных осколков и иней
        iceburst(X) {
            X.go(0, { sprite: 'crystal', blend: 'std', burst: 50, rot: true, life: [1.2, 1.8], size: [17, 28], speed: [150, 300], emitter: ['sphere', 1, 0], gravity: [0, -170, 0], spin: [-6, 6], cg: pair('#cdf2ff', '#8fd8ff') }, [0, 70, 0]);
            X.go(0, { sprite: 'dot', blend: 'add', burst: 2, life: [0.35, 0.5], size: [200, 260], szg: [[0, 0.4], [1, 1.2]], cg: [[0, '#bfeaff', 0.6], [1, '#bfeaff', 0]] }, [0, 70, 0]);
            X.go(0, { sprite: 'ring', blend: 'add', burst: 1, life: [0.5, 0.6], size: [50, 50], szg: [[0, 0.3], [1, 4]], cg: [[0, '#d8f4ff', 1], [1, '#9fd8ff', 0]] }, [0, 70, 0]);
            X.go(0.1, { sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', burst: 34, life: [0.9, 1.5], size: [7, 13], speed: [60, 150], emitter: ['sphere', 1, 0], gravity: [0, -60, 0], cg: pair('#ffffff', '#9fe6ff') }, [0, 70, 0]);
        },
        // огненный фонтан вокруг героя: язычки, искры и дымок
        flames(X) {
            X.go(0, { sprite: 'flame', blend: 'add', rate: 56, dur: 2.4, life: [0.9, 1.4], size: [30, 46], speed: [130, 210], emitter: ['cone', 55, 0.5, 0], gravity: [0, -140, 0], szg: [[0, 0.9], [0.5, 1], [1, 0.2]], cg: ramp(['#ffc23a', '#ff6a1a', '#c8300a', '#6a1a0a'], 0.9) }, [0, 4, 0]);
            X.go(0, { sprite: 'spark', stretch: true, blend: 'add', rate: 60, dur: 2.4, life: [0.6, 1.1], size: [10, 16], speed: [190, 320], emitter: ['cone', 40, 0.8, 0], gravity: [0, -380, 0], cg: ramp(['#fff6c0', '#ffb040', '#ff5a1a'], 1) }, [0, 4, 0]);
            X.go(0.2, { sprite: 'puff', blend: 'std', rate: 10, dur: 2.2, life: [1.2, 1.8], size: [34, 56], speed: [10, 30], dir: UP, rot: true, spin: [-0.3, 0.3], box: [[-50, 0, -50], [50, 10, 50]], szg: [[0, 0.6], [1, 1.8]], cg: [[0, '#3a3a40', 0], [0.2, '#3a3a40', 0.22], [1, '#55555c', 0]] }, [0, 170, 0]);
        },
        // кольцо привидений поднимается спиралью
        ghosts(X) {
            const ghost = { sprite: 'ghost', blend: 'std', rate: 11, dur: 2, life: [1.6, 2.2], size: [30, 44], speed: [40, 70], dir: UP, gravity: [0, 8, 0], spin: [-0.3, 0.3], szg: [[0, 0.4], [0.2, 1], [1, 1.1]], cg: [[0, '#e0fff0', 0], [0.15, '#e0fff0', 0.85], [0.75, '#c8f5de', 0.8], [1, '#c8f5de', 0]] };
            for (let i = 0; i < 2; i++) {
                const ph = i * Math.PI;
                X.path(0, ghost, t => { const a = ph + t * 10; return [Math.cos(a) * 85, 8 + t * 50, Math.sin(a) * 85]; });
            }
            X.path(0.1, { sprite: 'wisp', blend: 'std', rate: 22, dur: 1.9, life: [1.2, 1.8], size: [30, 46], speed: [10, 30], dir: UP, gravity: [0, 14, 0], rot: true, szg: [[0, 0.6], [1, 1.4]], cg: [[0, '#d8ffe8', 0], [0.2, '#d8ffe8', 0.55], [1, '#b8f5d0', 0]] },
                t => { const a = 1.57 + t * 10; return [Math.cos(a) * 85, 8 + t * 50, Math.sin(a) * 85]; });
        },
        // три цветные завесы и блёстки плывут над героем
        aurora(X) {
            const sweep = (t, y) => [X.R[0] * (-200 + 400 * t), y + 25 * Math.sin(t * 6), X.R[2] * (-200 + 400 * t)];
            [['#4dffb4', '#7affd0', 0], ['#a47bff', '#d09bff', 0.15], ['#ff7ad9', '#7ad8ff', 0.3]].forEach(([c1, c2, d], i) =>
                X.path(d, { sprite: 'curtain', blend: 'add', rate: 4, dur: 1.8, life: [1.8, 2.6], size: [130, 210], speed: [6, 20], dir: [[-1, 0, -0.3], [1, 0.3, 0.3]], szg: [[0, 0.7], [0.4, 1], [1, 1.2]], cg: [[0, c1, 0], [0.25, c1, 0.34], [0.65, c2, 0.28], [1, c2, 0]] }, t => sweep(t, 170 + i * 22)));
            X.path(0.1, { sprite: 'glint', blend: 'add', rate: 24, dur: 1.8, life: [1.2, 1.8], size: [10, 17], speed: [5, 20], dir: ALL, szg: PULSE, cg: pair('#d8fff0', '#e6d8ff') }, t => sweep(t, 160));
        },
        // большой финал: серия салютов, затем золотой залп
        megafire(X) {
            for (let i = 0; i < 6; i++) {
                const s = i % 2 ? 1 : -1;
                shell(X, i * 0.28, s * (55 + X.rnd() * 120), (X.rnd() - 0.5) * 80, 170 + X.rnd() * 80, PALETTES[i % PALETTES.length], false, true);
            }
            X.at(2.35, () => {
                const o = [0, 215, 0], gold = PALETTES[0];
                X.go(0, { sprite: 'dot', blend: 'add', burst: 3, life: [0.3, 0.45], size: [260, 320], szg: [[0, 0.4], [1, 1.2]], cg: [[0, '#ffe27a', 0.8], [1, '#ffc933', 0]] }, o);
                X.go(0, { sprite: 'ring', blend: 'add', burst: 1, life: [0.7, 0.8], size: [60, 60], szg: [[0, 0.3], [1, 5]], cg: [[0, '#ffe9a0', 1], [1, '#ffc933', 0]] }, o);
                X.go(0, { sprite: 'spark', stretch: true, blend: 'add', burst: 90, life: [1.1, 1.6], size: [13, 20], speed: [230, 360], emitter: ['sphere', 1, 0], gravity: [0, -100, 0], vel: [[0, 1], [0.6, 0.3], [1, 0.08]], szg: [[0, 1], [0.7, 0.7], [1, 0.2]], cg: [[0, '#ffffff', 1], [0.12, gold[0], 1], [0.7, gold[1], 0.9], [1, gold[1], 0]] }, o);
                X.go(0.2, { sprite: 'glint', rot: true, blend: 'add', rate: 70, dur: 0.5, life: [0.8, 1.1], size: [9, 15], speed: [10, 40], dir: [[-0.5, -1, -0.5], [0.5, -0.3, 0.5]], gravity: [0, -90, 0], box: [[-140, 0, -140], [140, 30, 140]], szg: PULSE, cg: pair('#ffe27a', '#ffc933') }, [0, 230, 0]);
            });
        },
        // огненный вихрь вокруг героя и перья феникса
        phoenixrise(X) {
            X.go(0, { sprite: 'flame', blend: 'add', rate: 90, dur: 2.4, life: [0.9, 1.5], size: [46, 74], speed: [120, 220], emitter: ['cone', 50, 0.3, 0], gravity: [0, 60, 0], szg: [[0, 0.8], [0.35, 1.2], [1, 0.3]], cg: ramp(['#ffd04a', '#ff8a1f', '#e03a10', '#7a1a0a'], 0.8) }, [0, 4, 0]);
            X.go(0, { sprite: 'motes', cycles: 0, randomCell: true, rot: true, blend: 'add', rate: 60, dur: 2.4, life: [1.2, 2.2], size: [8, 15], speed: [80, 200], emitter: ['cone', 45, 0.9, 0], gravity: [0, 30, 0], cg: ramp(['#ffe9a0', '#ffc933', '#ff6a1f'], 1) }, [0, 4, 0]);
            X.go(0.2, { sprite: 'feather', blend: 'add', rot: true, burst: 26, life: [2.2, 3.2], size: [26, 40], speed: [90, 180], emitter: ['cone', 40, 1.5, 0], gravity: [0, -20, 0], spin: [-2, 2], cg: ramp(['#ffd04a', '#ff9a2a', '#ff5a1a'], 0.95, 0.1) }, [0, 20, 0]);
            X.go(0, { sprite: 'dot', blend: 'add', burst: 2, life: [1, 1.4], size: [200, 260], szg: [[0, 0.3], [0.4, 1], [1, 1.2]], cg: [[0, '#ff9a2a', 0.4], [1, '#ff5a1a', 0]] }, [0, 30, 0]);
        },
        // тёмный водоворот тумана и голубые молнии
        abyss(X) {
            for (let i = 0; i < 2; i++) {
                const ph = i * Math.PI;
                X.path(0, { sprite: 'puff', blend: 'std', rate: 28, dur: 2.4, life: [1.4, 2.2], size: [60, 100], speed: [20, 50], dir: UP, rot: true, spin: [-0.4, 0.4], szg: [[0, 0.5], [1, 1.6]], cg: [[0, '#144a8c', 0], [0.15, '#144a8c', 0.62], [1, '#0a2a5a', 0]] },
                    t => { const a = ph + t * 7.7; return [Math.cos(a) * 70, 6, Math.sin(a) * 70]; });
            }
            const cyan = ['#7ff8ff', '#2ec8e8'];
            [0.4, 0.9, 1.4, 1.9].forEach(t => X.at(t, () => {
                const a = X.rnd() * TAU, o = [Math.cos(a) * 110, 40 + X.rnd() * 110, Math.sin(a) * 110];
                X.go(0, { sprite: 'dot', blend: 'add', burst: 1, life: [0.18, 0.26], size: [150, 190], szg: [[0, 0.5], [1, 1.1]], cg: [[0, '#3ff0ff', 0.6], [1, '#3ff0ff', 0]] }, o);
                X.go(0, { sprite: 'bolt', cycles: 0, randomCell: true, stretch: true, blend: 'add', burst: 8, life: [0.2, 0.34], size: [36, 58], speed: [200, 340], emitter: ['sphere', 1, 0], vel: [[0, 1], [1, 0.3]], cg: [[0, '#ffffff', 1], [0.5, cyan[0], 1], [1, cyan[1], 0]] }, o);
            }));
        },
    };

    // ------------------------------------------------------------------------------------------------
    // ДВИЖОК: состояние, плотность, создание систем
    // ------------------------------------------------------------------------------------------------
    /** @type {Map<any, any>} */ const trails = new Map();   // герой -> запись следа
    /** @type {any[]} */ let jobs = [];                       // таймеры победы: { t, dur, on, run, step }
    /** @type {any[]} */ let shots = [];                      // разовые системы победы: { h, until } (сама исчезает; нужны для clear)
    /** @type {any} */ let owner = null;                      // игрок: герой, переданный в setTrail последним
    let clock = 0, dens = 1, tickLeft = 0, flairKind = null, /** @type {any} */ flair = null, warned = false;

    const ready = () => !!fx && typeof fx.create === 'function';
    const isMoving = h => !!h && h.visible !== false && !h.disposed && Number(h.speed) > MOVE_SPEED && isFinite(h.x) && isFinite(h.y) && isFinite(h.z);
    function warn(e) { if (!warned) { warned = true; console.warn('GameFx:', e); } }

    /** Множитель плотности: 1, на телефоне и уровне графики 0 — чистые 0.5 (ParticleFX на телефоне уже режет сам). */
    function density() {
        const mobile = typeof IS_MOBILE !== 'undefined' && !!IS_MOBILE;
        const low = typeof Quality !== 'undefined' && !!Quality && Quality.level === 0;
        if (!mobile && !low) return 1;
        let own = 1;
        try { const q = fx && typeof fx.cfg === 'function' ? Number(fx.cfg().quality) : 1; if (q > 0 && q < 1) own = q; } catch (e) { own = 1; }
        return Math.min(1, 0.5 / own);
    }

    /** Слой рецепта -> опции ParticleFX.create. */
    function options(L, pos, extra) {
        const life = L.life || [0.5, 1], burst = L.burst != null ? Math.max(1, Math.round(L.burst * dens)) : null;
        const rate = burst == null ? (L.rate || 0) * dens : 0;
        const cells = L.sprite && has(SPRITES, L.sprite) ? SPRITES[L.sprite].cells || 1 : 1;
        const o = {
            name: 'gamefx', position: pos, life, size: L.size || [8, 14], speed: L.speed || [10, 30], gravity: L.gravity, direction: L.dir || UP, box: L.box, spin: L.spin,
            color: L.color || '#ffffff', color2: L.color2, alpha: L.alpha, blend: L.blend === 'std' ? 'standard' : 'add', sizeGradient: L.szg, colorGradient: L.cg,
            capacity: burst != null ? burst + 2 : Math.max(6, Math.ceil(rate * life[1] * 1.15) + 3),
        };
        if (burst != null) o.burst = burst; else o.rate = extra && extra.idle ? 0 : rate;
        if (L.dur != null && burst == null) o.duration = L.dur;
        if (cells > 1) o.sheet = { width: CELL, height: CELL, start: 0, end: cells - 1, speed: L.cycles == null ? 1 : L.cycles, loop: true, randomStart: !!L.randomCell };
        if (extra && extra.follow) o.follow = extra.follow;
        return o;
    }

    /** Донастройка системы после fx.create: спрайт, эмиттер, режим billboard, начальный поворот, торможение. */
    function finish(h, L) {
        const s = h && h.system; if (!s) return;
        try {
            const tex = spriteTexture(L.sprite); if (tex) s.particleTexture = tex;
            const e = L.emitter;
            if (e) {
                if (e[0] === 'sphere' && s.createSphereEmitter) s.createSphereEmitter(e[1] || 1, e[2] == null ? 0 : e[2]);
                else if (e[0] === 'hemi' && s.createHemisphericEmitter) s.createHemisphericEmitter(e[1] || 1, e[2] == null ? 0 : e[2]);
                else if (e[0] === 'cone' && s.createConeEmitter) { const em = s.createConeEmitter(e[1] || 1, e[2] || 0.5); if (em && e[3] != null) em.radiusRange = e[3]; }
                else if (e[0] === 'ring' && s.createCylinderEmitter) s.createCylinderEmitter(e[1] || 1, e[2] || 0, 0, e[3] || 0);
            }
            if (L.stretch && typeof BABYLON !== 'undefined' && BABYLON.ParticleSystem) { s.billboardMode = BABYLON.ParticleSystem.BILLBOARDMODE_STRETCHED; s.minScaleY = 1.8; s.maxScaleY = 2.8; }
            if (L.rot) { s.minInitialRotation = 0; s.maxInitialRotation = TAU; }
            if (L.vel && s.addVelocityGradient) for (const [t, v] of L.vel) s.addVelocityGradient(t, v);
        } catch (err) { warn(err); }
    }

    /** Создать систему по слою. null — бюджет исчерпан или нет менеджера. */
    function spawn(L, pos, extra) {
        if (!ready()) return null;
        let h = null;
        try { h = fx.create(options(L, pos, extra)); } catch (err) { warn(err); h = null; }
        if (h) finish(h, L);
        return h || null;
    }

    function drop(h) { if (h) { try { h.dispose(); } catch (err) { /* уже снят */ } } }

    // ------------------------------------------------------------------------------------------------
    // СЛЕДЫ
    // ------------------------------------------------------------------------------------------------
    const finite = h => isFinite(h.x) && isFinite(h.y) && isFinite(h.z);
    function buildLayer(e, L, water) {
        const hero = e.hero, def = e.def, pos = e.pos, o = def.orbit;
        // эмиттер: ноги героя (на суше), поверхность воды (на плавании) или орбита вокруг героя (galaxy); нет координат — не двигается
        const follow = water
            ? () => { if (!finite(hero)) return null; pos.x = hero.x; pos.y = api.waterY + 2; pos.z = hero.z; return pos; }
            : o ? () => { if (!finite(hero)) return null; const a = clock * o.w; pos.x = hero.x + Math.cos(a) * o.r; pos.y = hero.y + o.h + Math.sin(a * 0.7) * o.v; pos.z = hero.z + Math.sin(a) * o.r; return pos; }
            : () => { if (!finite(hero)) return null; pos.x = hero.x; pos.y = hero.y; pos.z = hero.z; return pos; };
        const R = { L, h: null, cur: -1 };
        R.h = spawn(L, [Number(hero.x) || 0, water ? api.waterY + 2 : Number(hero.y) || 0, Number(hero.z) || 0], { follow, idle: true });
        return R;
    }
    function buildLand(e) {
        e.layers = e.def.layers.map(L => buildLayer(e, L, false));
        e.missing = e.layers.some(R => !R.h); e.retryAt = clock + 1;
    }
    function buildMissing(e) {
        e.layers = e.layers.map((R, i) => (R.h ? R : buildLayer(e, e.def.layers[i], false)));
        e.missing = e.layers.some(R => !R.h); e.retryAt = clock + 1;
    }
    function disposeTrail(e) {
        for (const R of e.layers) drop(R.h);
        if (e.water) drop(e.water.h);
        e.layers = []; e.water = null;
    }
    function setRate(R, v) {
        if (!R || !R.h) return;
        v = Math.round(v * 20) / 20;
        if (Math.abs(R.cur - v) < 0.01) return;
        R.cur = v;
        try { R.h.setRate(v); } catch (err) { warn(err); }
    }
    function driveTrail(e) {
        const h = e.hero, moving = isMoving(h), water = !!h.swimming;
        if (moving && water && !(e.water && e.water.h) && clock >= e.waterAt) {
            if (e.water) drop(e.water.h);
            e.water = buildLayer(e, waterLayer(e.def.water), true); e.waterAt = clock + 1;
        }
        if (moving && !water && e.missing && clock >= e.retryAt) buildMissing(e);
        const k = Math.round(clamp(0.55 + h.speed / 500, 0.7, 1.3) * 20) / 20;
        for (const R of e.layers) setRate(R, moving && !water ? R.L.rate * dens * k : 0);
        if (e.water) setRate(e.water, moving && water ? e.water.L.rate * dens * k : 0);
    }

    // ------------------------------------------------------------------------------------------------
    // МЕРЦАНИЕ РЕДКИХ ПРИЧЁСОК И ШЛЯП
    // ------------------------------------------------------------------------------------------------
    function readFlair() {
        if (typeof Eco === 'undefined') return null;
        try {
            const E = /** @type {any} */ (Eco);
            const v = typeof E.flair === 'function' ? E.flair() : null;
            return v === 'epic' || v === 'legendary' || v === 'mythic' ? v : null;
        } catch (err) { return null; }
    }
    function disposeFlair() { if (flair) { drop(flair.R && flair.R.h); flair = null; } }
    function driveFlair() {
        const hero = owner;
        if (!flairKind || !hero || trails.has(hero)) { disposeFlair(); return; }
        const moving = isMoving(hero);
        if (flair && flair.kind !== flairKind) disposeFlair();
        if (!flair) {
            if (!moving) return;
            const L = FLAIR[flairKind], pos = { x: 0, y: 0, z: 0 };
            const follow = () => { if (!finite(hero)) return null; pos.x = hero.x; pos.y = hero.y + 170; pos.z = hero.z; return pos; };
            flair = { kind: flairKind, R: { L, h: spawn(L, [Number(hero.x) || 0, (Number(hero.y) || 0) + 170, Number(hero.z) || 0], { follow, idle: true }), cur: -1 } };
            if (!flair.R.h) { flair = null; return; }
        }
        setRate(flair.R, moving ? flair.R.L.rate * dens : 0);
    }

    // ------------------------------------------------------------------------------------------------
    // ПОБЕДЫ: контекст, таймеры
    // ------------------------------------------------------------------------------------------------
    /** «Вправо» относительно камеры (горизонтальный единичный вектор) — для дуг и завес лицом к зрителю. */
    function cameraRight(p) {
        try {
            const cam = fx && fx.scene && fx.scene.activeCamera;
            if (cam && cam.position) {
                const dx = p.x - cam.position.x, dz = p.z - cam.position.z, len = Math.hypot(dx, dz);
                if (len > 1e-3) return [dz / len, 0, -dx / len];
            }
        } catch (err) { /* камеры нет */ }
        return [1, 0, 0];
    }
    function track(h, L, extraDelay) {
        if (h) shots.push({ h, until: clock + (extraDelay || 0) + (L.dur || 0) + (L.life ? L.life[1] : 1) + 1 });
        return h;
    }
    function makeContext(p) {
        let seed = (Math.floor(Math.abs(p.x * 31 + p.z * 17)) + Math.floor(clock * 1000)) >>> 0;
        const rnd = lcg(seed || 1);
        const abs = off => [p.x + off[0], p.y + off[1], p.z + off[2]];
        const X = {
            p, R: cameraRight(p), rnd,
            go(delay, L, off) {
                const run = () => track(spawn(L, abs(off)), L);
                if (delay <= 0) return run();
                jobs.push({ t: clock + delay, dur: 0, on: false, run });
                return null;
            },
            at(delay, fn) {
                if (delay <= 0) { fn(); return; }
                jobs.push({ t: clock + delay, dur: 0, on: false, run: fn });
            },
            path(delay, L, fn) {
                const job = { t: clock + delay, dur: Math.max(0.05, L.dur || 1), on: false, h: null,
                    run: () => { job.h = track(spawn(L, abs(fn(0))), L); },
                    step: k => { if (job.h) { try { job.h.setPosition(abs(fn(k))); } catch (err) { warn(err); } } } };
                if (delay <= 0) { job.on = true; job.run(); }
                jobs.push(job);
            },
        };
        return X;
    }
    function runJobs() {
        for (let i = 0; i < jobs.length; i++) {
            const j = jobs[i];
            if (!j.on && clock >= j.t) { j.on = true; try { j.run(); } catch (err) { warn(err); } }
            if (j.on) {
                if (j.step) { const k = clamp((clock - j.t) / j.dur, 0, 1); j.step(k); if (k >= 1) j.end = true; } else j.end = true;
            }
        }
        if (jobs.some(j => j.end)) jobs = jobs.filter(j => !j.end);
    }

    // ------------------------------------------------------------------------------------------------
    // ПУБЛИЧНЫЙ ИНТЕРФЕЙС
    // ------------------------------------------------------------------------------------------------
    function resetAll() {
        for (const e of trails.values()) disposeTrail(e);
        trails.clear();
        for (const s of shots) drop(s.h);
        shots = []; jobs = [];
        disposeFlair();
        flairKind = null; tickLeft = 0; owner = null;
    }

    const api = {
        TRAILS, VICTORIES,
        /** Уровень воды (Y поверхности), от которого идут пузыри на плавании. */
        waterY: 200,
        has(kind, id) {
            if (kind === 'trail' || kind === 'trails') return has(TRAIL, id);
            if (kind === 'victory' || kind === 'victories') return has(VICT, id);
            return false;
        },
        init(app) {
            const next = app && app.fx && typeof app.fx.create === 'function' ? app.fx : null;
            if (next !== fx) { try { resetAll(); } catch (e) { /* старый менеджер уже снят */ } fx = next; dens = density(); }
            return api;
        },
        setTrail(hero, id) {
            if (!hero || typeof hero !== 'object') return;
            owner = hero;
            const want = api.has('trail', id) ? id : null, cur = trails.get(hero);
            if (cur && cur.id === want) return;
            if (cur) { disposeTrail(cur); trails.delete(hero); }
            if (!want || !ready()) return;
            dens = density();
            const e = { id: want, hero, def: TRAIL[want], layers: [], water: null, pos: { x: Number(hero.x) || 0, y: Number(hero.y) || 0, z: Number(hero.z) || 0 }, missing: false, retryAt: 0, waterAt: 0 };
            trails.set(hero, e);
            try { buildLand(e); } catch (err) { warn(err); }
        },
        celebrate(id, at) {
            if (!api.has('victory', id) || !at || !ready()) return;
            const p = { x: Number(at.x), y: Number(at.y), z: Number(at.z) };
            if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z) || jobs.length > 160) return;
            dens = density();
            try { VICT[id](makeContext(p)); } catch (err) { warn(err); }
        },
        update(dt) {
            if (!ready()) return;
            if (typeof Pause !== 'undefined' && Pause && Pause.active) return;
            dt = clamp(Number(dt) || 0, 0, 0.1);
            clock += dt;
            try {
                tickLeft -= dt;
                if (tickLeft <= 0) { tickLeft = 0.5; dens = density(); flairKind = readFlair(); }
                runJobs();
                for (const e of trails.values()) { try { driveTrail(e); } catch (err) { warn(err); } }
                driveFlair();
                if (shots.length && shots.some(s => s.until < clock)) shots = shots.filter(s => s.until >= clock);
            } catch (err) { warn(err); }
        },
        clear() { resetAll(); },
        density,
        /** Счётчики: следов, живых систем следов, таймеров, разовых систем, вид мерцания. */
        stats() {
            let systems = 0;
            for (const e of trails.values()) { systems += e.layers.filter(R => R.h).length; if (e.water && e.water.h) systems++; }
            return { trails: trails.size, trailSystems: systems, jobs: jobs.length, shots: shots.length, flair: flair ? flair.kind : null, owner: !!owner };
        },
        /** Отрисованный спрайт (canvas) — для галереи и проверки глазом. */
        spriteCanvas: drawCanvas,
        sprites: Object.freeze(Object.keys(SPRITES)),
    };
    return api;
})();
