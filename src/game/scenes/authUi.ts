import { Scene } from 'phaser';

// 廢土登入/註冊頁共用視覺 helper(純 Phaser 4 instance API,無 new Phaser / Geom / Math)
// palette: 炭黑 #1a1612 / 髒黃 #b08850 / 灰橙 #a05a30 / 暖橙 #ff8830 / 鏽紅 #8b3a1f / 深綠 #4a5d3a

export const PAL = {
    char: 0x1a1612,
    dirtYellow: 0xb08850,
    grayOrange: 0xa05a30,
    warmOrange: 0xff8830,
    rust: 0x8b3a1f,
    green: 0x4a5d3a,
    beige: 0xffe0c0,
    metalLight: 0x6b5234,
    metalDark: 0x120f0c
};

// 共用 DOM input 樣式(rust focus glow 由 JS 加)
export const INPUT_CSS =
    'width:560px;height:88px;font-size:36px;padding:0 24px;border:2px solid #6b5234;' +
    'border-radius:8px;background:linear-gradient(#19140f,#241c14);color:#ffe0c0;' +
    'box-sizing:border-box;outline:none;font-family:sans-serif;letter-spacing:1px;' +
    'box-shadow:inset 0 3px 8px rgba(0,0,0,0.6);transition:border-color .15s,box-shadow .15s;';

// input focus 質感:鏽橙邊 + 外發光
export function wireInputFocus(el: HTMLInputElement): void {
    el.addEventListener('focus', () => {
        el.style.borderColor = '#ff8830';
        el.style.boxShadow = 'inset 0 3px 8px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,136,48,0.35)';
    });
    el.addEventListener('blur', () => {
        el.style.borderColor = '#6b5234';
        el.style.boxShadow = 'inset 0 3px 8px rgba(0,0,0,0.6)';
    });
}

// 背景:painted 廢土圖 + 暗角 vignette + 頂/底漸層壓暗 + 油燈暖光點
export function buildBackground(scene: Scene, W: number, H: number): void {
    const bg = scene.add.image(W / 2, H / 2, 'map_wasteland_topdown');
    bg.setDisplaySize(W, H);
    bg.setAlpha(0.62);
    bg.setTint(0x9a8460); // 暖化 painted map,壓掉雜訊

    // 整體壓暗讓前景跳出
    scene.add.rectangle(W / 2, H / 2, W, H, PAL.char, 0.38);

    // 頂部暖光暈(油燈氛圍)— 暖橙→透明 漸層,模擬上方光源
    const topGlow = scene.add.graphics();
    topGlow.fillGradientStyle(0x6b3a14, 0x6b3a14, 0x6b3a14, 0x6b3a14, 0.5, 0.5, 0, 0);
    topGlow.fillRect(0, 0, W, 640);

    // 底部漸層壓暗
    const botGrad = scene.add.graphics();
    botGrad.fillGradientStyle(PAL.char, PAL.char, PAL.char, PAL.char, 0, 0, 0.9, 0.9);
    botGrad.fillRect(0, H - 520, W, 520);

    // 四角 vignette — 上下左右暗邊用 gradient rect 疊
    const vTop = scene.add.graphics();
    vTop.fillGradientStyle(PAL.metalDark, PAL.metalDark, PAL.metalDark, PAL.metalDark, 0.9, 0.9, 0, 0);
    vTop.fillRect(0, 0, W, 260);
    const vBot = scene.add.graphics();
    vBot.fillGradientStyle(PAL.metalDark, PAL.metalDark, PAL.metalDark, PAL.metalDark, 0, 0, 0.9, 0.9);
    vBot.fillRect(0, H - 260, W, 260);
    const vL = scene.add.graphics();
    vL.fillGradientStyle(PAL.metalDark, PAL.metalDark, PAL.metalDark, PAL.metalDark, 0.85, 0, 0.85, 0);
    vL.fillRect(0, 0, 200, H);
    const vR = scene.add.graphics();
    vR.fillGradientStyle(PAL.metalDark, PAL.metalDark, PAL.metalDark, PAL.metalDark, 0, 0.85, 0, 0.85);
    vR.fillRect(W - 200, 0, 200, H);
}

// 廢土裝飾:刮痕 + 鏽漬條 + 危險條紋角標 + 鏽蝕浮水印(讓背景不空)
export function buildDecals(scene: Scene, W: number): void {
    // 細刮痕(對角淡線)
    const scr = scene.add.graphics();
    const scratches: [number, number, number, number, number][] = [
        [80, 470, 320, 560, 0.10],
        [760, 520, 1010, 470, 0.08],
        [120, 1640, 360, 1700, 0.09],
        [700, 1700, 980, 1630, 0.07]
    ];
    for (const [x1, y1, x2, y2, a] of scratches) {
        scr.lineStyle(2, 0xd9b48a, a);
        scr.lineBetween(x1, y1, x2, y2);
    }

    // 鏽漬條(垂直漸層淡橙)
    const rustMarks: [number, number, number][] = [[150, 430, 0.12], [930, 480, 0.10], [90, 1560, 0.10]];
    for (const [x, y, a] of rustMarks) {
        const rg = scene.add.graphics();
        rg.fillGradientStyle(PAL.rust, PAL.rust, PAL.rust, PAL.rust, a, a, 0, 0);
        rg.fillRect(x, y, 30, 150);
    }

    // 左上危險斜紋角標
    const hz = scene.add.graphics();
    hz.fillStyle(0xc8901e, 0.16);
    for (let i = 0; i < 5; i++) {
        const ox = 60 + i * 46;
        hz.fillTriangle(ox, 420, ox + 24, 420, ox - 30, 480);
    }

    // 右側鏽蝕浮水印文字(stencil 風)
    scene.add.text(W - 40, 700, 'WASTELAND', {
        fontFamily: 'monospace', fontSize: 26, color: '#5a4326', fontStyle: 'bold'
    }).setOrigin(1, 0.5).setAngle(90).setAlpha(0.5);

    // 危險警示小三角(角落點綴)
    const warn = scene.add.graphics();
    warn.fillStyle(0xc8901e, 0.2);
    warn.fillTriangle(W - 90, 1640, W - 50, 1640, W - 70, 1600);
    warn.fillStyle(PAL.char, 0.5);
    warn.fillRect(W - 72, 1614, 4, 16);
    warn.fillCircle(W - 70, 1634, 2.5);
}

// 標題「破爛史詩」厚重多層 + 微呼吸 + 副標
export function buildTitle(scene: Scene, W: number, cy: number, fontSize: number): void {
    // 後方鏽紅暈影(深度)
    scene.add.text(W / 2, cy + 6, '破爛史詩', {
        fontFamily: 'sans-serif', fontSize, color: '#3a1505', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.85);

    const title = scene.add.text(W / 2, cy, '破爛史詩', {
        fontFamily: 'sans-serif', fontSize, color: '#d99a4e', fontStyle: 'bold',
        stroke: '#140d06', strokeThickness: 14
    }).setOrigin(0.5);
    title.setShadow(0, 8, '#000000', 18, true, true);

    // 上緣高光(暖橙)疊一層淡 emissive
    const hi = scene.add.text(W / 2, cy - 3, '破爛史詩', {
        fontFamily: 'sans-serif', fontSize, color: '#ffcf8a', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.28);

    // 微呼吸
    scene.tweens.add({
        targets: [title, hi],
        scale: 1.025,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // 副標 + 上下鏽橙細線
    scene.add.text(W / 2, cy + fontSize * 0.62, 'T R A S H   E P I C', {
        fontFamily: 'sans-serif', fontSize: Math.round(fontSize * 0.28), color: '#a05a30',
        fontStyle: 'bold'
    }).setOrigin(0.5);

    const ln = scene.add.graphics();
    ln.lineStyle(3, PAL.rust, 0.8);
    const ly = cy + fontSize * 0.62;
    ln.lineBetween(W / 2 - 240, ly, W / 2 - 130, ly);
    ln.lineBetween(W / 2 + 130, ly, W / 2 + 240, ly);
    ln.fillStyle(PAL.warmOrange, 0.9);
    ln.fillCircle(W / 2 - 120, ly, 4);
    ln.fillCircle(W / 2 + 120, ly, 4);
}

// 鏽蝕金屬面板:外厚邊 + 內陷漸層 + 四角鉚釘 + 頂部鏽漬
export function buildPanel(scene: Scene, cx: number, cy: number, w: number, h: number): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const g = scene.add.graphics();

    // 外陰影
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x - 6, y + 10, w + 12, h + 12, 22);

    // 金屬外框(亮上→暗下漸層模擬受光)
    g.fillGradientStyle(PAL.metalLight, PAL.metalLight, PAL.metalDark, PAL.metalDark, 1, 1, 1, 1);
    g.fillRoundedRect(x, y, w, h, 20);

    // 鏽紅描邊
    g.lineStyle(3, PAL.rust, 0.85);
    g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 18);

    // 內陷暗底(帳密區)
    const ix = x + 14, iy = y + 14, iw = w - 28, ih = h - 28;
    g.fillGradientStyle(0x100c08, 0x100c08, 0x1c1610, 0x1c1610, 1, 1, 1, 1);
    g.fillRoundedRect(ix, iy, iw, ih, 14);
    // 內框細鏽黃線
    g.lineStyle(2, PAL.dirtYellow, 0.5);
    g.strokeRoundedRect(ix, iy, iw, ih, 14);

    // 四角鉚釘
    const rivets: [number, number][] = [
        [x + 26, y + 26], [x + w - 26, y + 26],
        [x + 26, y + h - 26], [x + w - 26, y + h - 26]
    ];
    for (const [rx, ry] of rivets) {
        g.fillStyle(PAL.metalDark, 1);
        g.fillCircle(rx, ry, 11);
        g.fillStyle(0x8a6a40, 1);
        g.fillCircle(rx, ry, 8);
        g.fillStyle(0xc69a5a, 1);
        g.fillCircle(rx - 2, ry - 2, 3);
    }
}

// 區段標題小牌(panel 內 header,鏽橙底 + 邊)
export function buildHeader(scene: Scene, cx: number, y: number, label: string): void {
    const g = scene.add.graphics();
    // 牌底陰影
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(cx - 170, y - 30, 340, 68, 12);
    // 鏽橙漸層牌面
    g.fillGradientStyle(0xa84a18, 0xa84a18, 0x6e2c0e, 0x6e2c0e, 1, 1, 1, 1);
    g.fillRoundedRect(cx - 170, y - 34, 340, 68, 12);
    g.lineStyle(2, PAL.warmOrange, 0.85);
    g.strokeRoundedRect(cx - 170, y - 34, 340, 68, 12);
    // 兩端鉚釘
    for (const rx of [cx - 150, cx + 150]) {
        g.fillStyle(0x2a1608, 1); g.fillCircle(rx, y, 6);
        g.fillStyle(0xd9a45a, 1); g.fillCircle(rx - 1, y - 1, 2.5);
    }
    scene.add.text(cx, y, label, {
        fontFamily: 'sans-serif', fontSize: 44, color: '#ffe6c8', fontStyle: 'bold',
        stroke: '#140d06', strokeThickness: 5
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, false, true);
    // 牌下金線
    const ln = scene.add.graphics();
    ln.fillStyle(PAL.warmOrange, 0.7);
    ln.fillRect(cx - 130, y + 44, 260, 2);
    ln.fillStyle(PAL.warmOrange, 0.9);
    ln.fillCircle(cx, y + 45, 3);
}

// 欄位 label
export function fieldLabel(scene: Scene, x: number, y: number, label: string): void {
    scene.add.text(x, y, label, {
        fontFamily: 'sans-serif', fontSize: 28, color: '#c79a5e', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
}

export type ButtonStyle = 'primary' | 'secondary' | 'ghost';

// 有層次的按鈕:漸層底 + 上高光 + 下陰影 + 邊框 + hover/press scale + 質感文字
export function buildButton(
    scene: Scene,
    x: number, y: number, w: number, h: number,
    label: string, style: ButtonStyle, onClick: () => void
): void {
    const cont = scene.add.container(x, y);
    const g = scene.add.graphics();

    let topC: number, botC: number, edge: number, txtColor: string, txtSize: number;
    if (style === 'primary') {
        topC = 0xffb05a; botC = 0xe06a1a; edge = 0x7a3408;
        txtColor = '#1a0f04'; txtSize = Math.round(h * 0.4);
    } else if (style === 'secondary') {
        topC = 0x5a6e44; botC = 0x37452a; edge = 0x222d18;
        txtColor = '#ffe0c0'; txtSize = Math.round(h * 0.42);
    } else {
        topC = 0x342a1e; botC = 0x1c1610; edge = 0x6b5234;
        txtColor = '#c79a5e'; txtSize = Math.round(h * 0.42);
    }

    const hw = w / 2, hh = h / 2;
    // primary CTA 外發光(多層淡橙暈,讓主按鈕成焦點)
    if (style === 'primary') {
        const glow = scene.add.graphics();
        const layers: [number, number][] = [[18, 0.10], [11, 0.16], [5, 0.22]];
        for (const [pad, a] of layers) {
            glow.fillStyle(PAL.warmOrange, a);
            glow.fillRoundedRect(-hw - pad, -hh - pad, w + pad * 2, h + pad * 2, 16 + pad);
        }
        cont.add(glow);
    }
    // 落地陰影
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-hw, -hh + 7, w, h, 14);
    // 主體漸層
    g.fillGradientStyle(topC, topC, botC, botC, 1, 1, 1, 1);
    g.fillRoundedRect(-hw, -hh, w, h, 14);
    // 上緣高光條
    g.fillStyle(0xffffff, style === 'primary' ? 0.28 : 0.16);
    g.fillRoundedRect(-hw + 6, -hh + 5, w - 12, h * 0.32, 10);
    // 邊框
    g.lineStyle(3, edge, 1);
    g.strokeRoundedRect(-hw, -hh, w, h, 14);
    // 內側細亮邊
    g.lineStyle(1, 0xffd9a0, style === 'primary' ? 0.4 : 0.2);
    g.strokeRoundedRect(-hw + 3, -hh + 3, w - 6, h - 6, 11);

    const txt = scene.add.text(0, 0, label, {
        fontFamily: 'sans-serif', fontSize: txtSize, color: txtColor, fontStyle: 'bold'
    }).setOrigin(0.5);
    if (style === 'primary') txt.setShadow(0, 2, '#ffe9c0', 4, false, true);
    else txt.setShadow(0, 2, '#000000', 4, false, true);

    // 透明 rectangle 當 hit area(避免 Phaser text/graphics padding quirk)
    const hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });

    cont.add([g, txt, hit]);
    cont.setSize(w, h);

    hit.on('pointerover', () => scene.tweens.add({ targets: cont, scale: 1.04, duration: 90, ease: 'Quad.easeOut' }));
    hit.on('pointerout', () => scene.tweens.add({ targets: cont, scale: 1.0, duration: 110, ease: 'Quad.easeOut' }));
    hit.on('pointerdown', () => cont.setScale(0.96));
    hit.on('pointerup', () => {
        scene.tweens.add({ targets: cont, scale: 1.04, duration: 80, ease: 'Quad.easeOut' });
        onClick();
    });

    // primary 按鈕緩慢 pulse 文字暈光
    if (style === 'primary') {
        scene.tweens.add({
            targets: txt,
            alpha: 0.82,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
}
