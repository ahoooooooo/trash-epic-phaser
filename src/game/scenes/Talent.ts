import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { TALENT_NODES, TalentNode, TalentRoute, canSpend, isVisible, spendTalentPoint } from '../services/TalentService';

const W = 1080;
const H = 1920;

// Phase 4c-D3 天賦樹 — 縱向長卷軸主幹樹(per user 選「縱向長卷軸主幹樹」+「有特色節點」)
// 單一主幹根 → 3 分支 fan out → keystone 大框節點穿插 minor 小節點 → 終極匯流。上下滑。
const TREE_TOP = 110;
const TIER_VGAP = 300;
const COL_X: Record<TalentRoute, number> = { attack: 250, defense: W / 2, support: W - 250 };
const HEADER_BOTTOM = 168;
const SCROLL_BOTTOM = H - 40;
const R_KEY = 58;   // keystone 半徑
const R_MIN = 38;   // minor 半徑
const ROUTE_COLOR: Record<TalentRoute, number> = { attack: 0xc23a1a, defense: 0x8b6020, support: 0x4a5d3a };
const ROUTE_GLYPH: Record<TalentRoute, string> = { attack: '⚔', defense: '🛡', support: '✨' };
const TRUNK_GOLD = 0xffc024;

function isTrunk(id: string): boolean {
    return id === 'survivor_root' || id === 'wasteland_god';
}

export class Talent extends Scene {
    private content?: Phaser.GameObjects.Container;
    private detail?: Phaser.GameObjects.Container;
    // track repeat:-1 tweens for cleanup
    private loopTweens: Phaser.Tweens.Tween[] = [];

    constructor() { super('Talent'); }

    create(data?: { openNode?: string; scrollY?: number }) {
        this.loopTweens = [];

        // 廢土底:深炭 + 微紋理感(雙層 gradient 暗影)
        this.add.rectangle(0, 0, W, H, 0x100d0a, 1).setOrigin(0, 0);
        // 左右縱向暗邊(深度感)
        this.add.rectangle(0, H / 2, 90, H, 0x000000, 0.22).setOrigin(0, 0.5);
        this.add.rectangle(W, H / 2, 90, H, 0x000000, 0.22).setOrigin(1, 0.5);

        // 浮塵粒子 — 背景環境動態(10 顆,隨機位置緩慢上浮)
        this.spawnDustParticles();

        // 標題 + TP(固定 header)— 鏽蝕質感:底框 + 上沿亮帶 + 底部橙 accent + 角落鉚釘
        const headerBg = this.add.rectangle(0, 0, W, HEADER_BOTTOM, 0x1a1612, 0.97).setOrigin(0, 0)
            .setStrokeStyle(2, 0x8b6020, 0.6);
        this.add.rectangle(0, 3, W, 24, 0x3a342c, 0.4).setOrigin(0, 0);   // 上沿金屬反光
        const accentLine = this.add.rectangle(0, HEADER_BOTTOM, W, 3, 0xff8830, 0.7).setOrigin(0, 0);
        // accent 線呼吸動畫
        const accentTween = this.tweens.add({ targets: accentLine, alpha: 0.3, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.loopTweens.push(accentTween);
        // 角落鉚釘(避開 flanking 按鈕 x=140 / W-120)
        for (const rx of [14, W - 14]) {
            this.add.circle(rx, 22, 5, 0xa05a30).setStrokeStyle(1, 0x1a1612);
            this.add.circle(rx, HEADER_BOTTOM - 14, 5, 0xa05a30).setStrokeStyle(1, 0x1a1612);
        }
        const titleText = this.add.text(W / 2, 50, '🌳 廢土天賦樹', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);
        const save = SaveService.instance.get();
        const tpText = this.add.text(W / 2, 108, `Lv ${save.level}    ★ ${save.talentPoints} TP 可分配    ↕ 上下滑`, {
            fontFamily: 'monospace', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        // header 進場動畫:title + tp 淡入上滑
        this.tweens.add({ targets: titleText, alpha: 1, y: titleText.y - 8, duration: 320, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: tpText, alpha: 1, duration: 260, delay: 80 });
        void headerBg;

        this.renderTree(data?.scrollY ?? HEADER_BOTTOM);
        this.drawHeaderButtons();

        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-T', () => this.close());

        // 確保 shutdown() 在 Phaser scene lifecycle 時被呼叫
        this.events.once('shutdown', this.shutdown, this);

        if (data?.openNode) {
            const n = TALENT_NODES.find(x => x.id === data.openNode);
            if (n) this.openDetail(n);
        }
    }

    private spawnDustParticles() {
        for (let i = 0; i < 12; i++) {
            const px = 60 + Math.random() * (W - 120);
            const py = HEADER_BOTTOM + 20 + Math.random() * (H - HEADER_BOTTOM - 60);
            const size = 1 + Math.random() * 2.5;
            const alpha = 0.04 + Math.random() * 0.10;
            const dust = this.add.circle(px, py, size, 0xb08850, alpha);
            const duration = 4000 + Math.random() * 6000;
            const t = this.tweens.add({
                targets: dust,
                y: dust.y - (30 + Math.random() * 60),
                alpha: 0,
                duration,
                delay: Math.random() * 3000,
                repeat: -1,
                repeatDelay: Math.random() * 2000,
                ease: 'Sine.easeIn',
                onRepeat: () => {
                    dust.x = 60 + Math.random() * (W - 120);
                    dust.y = HEADER_BOTTOM + 40 + Math.random() * (H - HEADER_BOTTOM - 80);
                    dust.alpha = 0.04 + Math.random() * 0.10;
                }
            });
            this.loopTweens.push(t);
        }
    }

    private renderTree(startScrollY: number) {
        if (this.content) this.content.destroy();
        const scrollH = SCROLL_BOTTOM - HEADER_BOTTOM;

        const maskGeo = this.make.graphics({});
        maskGeo.fillStyle(0xffffff);
        maskGeo.fillRect(0, HEADER_BOTTOM, W, scrollH);
        const geomask = maskGeo.createGeometryMask();

        const layer = this.add.container(0, startScrollY).setMask(geomask);
        this.content = layer;

        const positions = this.buildPositions();
        const save = SaveService.instance;

        // 連線(requires)在底層 — 鏽管風,前置達成亮金
        const g = this.add.graphics().setAlpha(0);
        for (const node of TALENT_NODES) {
            if (!isVisible(node)) continue;
            const b = positions.get(node.id);
            if (!b) continue;
            for (const req of node.requires) {
                const a = positions.get(req.nodeId);
                if (!a) continue;
                const met = save.getTalentLevel(req.nodeId) >= req.minLevel;
                g.lineStyle(met ? 9 : 6, met ? 0xffc024 : 0x4a3a2a, met ? 0.85 : 0.5);
                g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
                if (met) { // 金線內芯
                    g.lineStyle(3, 0xffe0a0, 0.9);
                    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
                }
            }
        }
        // 連線進場:稍後淡入
        this.tweens.add({ targets: g, alpha: 1, duration: 350, delay: 120 });
        layer.add(g);

        // tier 區塊標籤(帶橫線分隔感)
        const tierName = ['', '生存', '岔路', '專精', '深化', '蛻變', '終極', '神話'];
        for (let tier = 1; tier <= 7; tier++) {
            const ty = TREE_TOP + (tier - 1) * TIER_VGAP;
            // tier 橫線
            const divLine = this.add.graphics().setAlpha(0);
            divLine.lineStyle(1, 0x3a342c, 0.6);
            divLine.beginPath(); divLine.moveTo(40, ty - 30); divLine.lineTo(W - 40, ty - 30); divLine.strokePath();
            layer.add(divLine);
            const lbl = this.add.text(60, ty, `◢ ${tierName[tier]}`, {
                fontFamily: 'sans-serif', fontSize: 22, color: '#6a5a4a', fontStyle: 'bold'
            }).setOrigin(0, 0.5).setAlpha(0);
            layer.add(lbl);
            // stagger per tier
            const tierDelay = 80 + (tier - 1) * 40;
            this.tweens.add({ targets: [divLine, lbl], alpha: 1, duration: 250, delay: tierDelay });
        }

        // 節點 — 依 tier 錯開進場
        for (const node of TALENT_NODES) {
            if (!isVisible(node)) continue;
            const p = positions.get(node.id);
            if (!p) continue;
            this.drawNode(node, p.x, p.y, layer);
        }

        // 捲動
        const totalH = TREE_TOP + 6 * TIER_VGAP + 220;
        const minY = HEADER_BOTTOM - Math.max(0, totalH - scrollH);
        const clampY = (y: number) => Math.max(minY, Math.min(HEADER_BOTTOM, y));
        layer.y = clampY(startScrollY);
        this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
            layer.y = clampY(layer.y - dy * 0.8);
        });
        let dragStartY = 0, dragOriginY = 0, dragging = false;
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.y > HEADER_BOTTOM && p.y < SCROLL_BOTTOM) {
                dragStartY = p.y; dragOriginY = layer.y; dragging = true;
            }
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!dragging || !p.isDown) return;
            layer.y = clampY(dragOriginY + (p.y - dragStartY));
        });
        this.input.on('pointerup', () => { dragging = false; });
    }

    // tier→y,route→x 欄,同 (tier,route) 多節點水平微分
    private buildPositions(): Map<string, { x: number; y: number }> {
        const pos = new Map<string, { x: number; y: number }>();
        for (let tier = 1; tier <= 7; tier++) {
            (['attack', 'defense', 'support'] as TalentRoute[]).forEach(r => {
                const nodes = TALENT_NODES.filter(n => n.tier === tier && n.route === r && isVisible(n));
                const n = nodes.length;
                nodes.forEach((node, i) => {
                    pos.set(node.id, {
                        x: COL_X[r] + (i - (n - 1) / 2) * 130,
                        y: TREE_TOP + (tier - 1) * TIER_VGAP
                    });
                });
            });
        }
        return pos;
    }

    private drawNode(node: TalentNode, x: number, y: number, layer: Phaser.GameObjects.Container) {
        const save = SaveService.instance;
        const lvl = save.getTalentLevel(node.id);
        const spendable = canSpend(node);
        const locked = !spendable && lvl === 0;
        const maxed = lvl >= node.maxLevel;
        const key = node.kind === 'keystone';
        const trunk = isTrunk(node.id);
        const r = key ? R_KEY : R_MIN;
        const baseColor = trunk ? TRUNK_GOLD : ROUTE_COLOR[node.route];

        const fill = locked ? 0x1a1612 : maxed ? 0x3a2f18 : 0x2a2520;
        const ring = locked ? 0x4a3018 : maxed ? 0xffe060 : spendable ? 0xffc024 : baseColor;

        // 進場 stagger:依 tier 計算 delay
        const enterDelay = 160 + (node.tier - 1) * 55;

        // 整個節點組先設 alpha=0 / scale=0.6,進場時彈出
        const nodeObjs: Phaser.GameObjects.GameObject[] = [];

        // spendable 外脈動光暈(在圈之前,確保 z-order 在下)
        if (spendable && !maxed) {
            const pulseGlow = this.add.circle(x, y, r + 14, spendable ? 0xffc024 : baseColor, 0);
            pulseGlow.setStrokeStyle(4, 0xffc024, 0.7);
            layer.add(pulseGlow);
            nodeObjs.push(pulseGlow);
            // 持續脈動
            const pt = this.tweens.add({
                targets: pulseGlow, alpha: 0.55,
                duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: enterDelay + 200
            });
            this.loopTweens.push(pt);
        }

        // keystone 外光暈 + 角鉚釘
        if (key) {
            const glow = this.add.circle(x, y, r + 10, 0x000000, 0).setStrokeStyle(3, trunk ? 0xffe060 : baseColor, locked ? 0.3 : 0.6);
            layer.add(glow);
            nodeObjs.push(glow);
            const d = r * 0.72;
            [[-d, -d], [d, -d], [-d, d], [d, d]].forEach(([dx, dy]) => {
                const rivet = this.add.circle(x + dx, y + dy, 5, 0x6a5a3a, locked ? 0.4 : 0.9);
                layer.add(rivet);
                nodeObjs.push(rivet);
            });
            // keystone 自轉光暈
            if (!locked) {
                const spinGlow = this.add.graphics();
                spinGlow.lineStyle(2, trunk ? 0xffe060 : baseColor, 0.25);
                spinGlow.strokeEllipse(x, y, (r + 18) * 2, (r + 18) * 2);
                layer.add(spinGlow);
                nodeObjs.push(spinGlow);
            }
        }

        const c = this.add.circle(x, y, r, fill, 0.97).setStrokeStyle(key ? 6 : 4, ring, locked ? 0.55 : 1);
        c.setInteractive({ useHandCursor: true });
        // press scale feedback + 打開詳情
        c.on('pointerdown', () => {
            this.tweens.add({ targets: c, scaleX: 0.88, scaleY: 0.88, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
            this.openDetail(node);
        });
        layer.add(c);
        nodeObjs.push(c);

        // 圈內:locked 鎖 / 否則 route glyph(keystone)或 level
        if (locked) {
            const lockTxt = this.add.text(x, y, '🔒', { fontFamily: 'sans-serif', fontSize: key ? 32 : 22 }).setOrigin(0.5);
            layer.add(lockTxt);
            nodeObjs.push(lockTxt);
        } else {
            if (key) {
                const glyphTxt = this.add.text(x, y - 10, trunk ? '★' : ROUTE_GLYPH[node.route], {
                    fontFamily: 'sans-serif', fontSize: 30
                }).setOrigin(0.5);
                layer.add(glyphTxt);
                nodeObjs.push(glyphTxt);
            }
            const lvlTxt = this.add.text(x, y + (key ? 20 : 0), `${lvl}/${node.maxLevel}`, {
                fontFamily: 'monospace', fontSize: key ? 20 : 18,
                color: maxed ? '#ffe060' : '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5);
            layer.add(lvlTxt);
            nodeObjs.push(lvlTxt);
        }

        // 名稱(節點下)
        const nm = this.add.text(x, y + r + 8, `${node.nameZH}${node.wired ? '' : ' ▪'}`, {
            fontFamily: 'sans-serif', fontSize: key ? 20 : 16,
            color: locked ? '#5a4a38' : trunk ? '#ffe060' : '#c8a878', fontStyle: 'bold',
            align: 'center', wordWrap: { width: 220 }, stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5, 0);
        layer.add(nm);
        nodeObjs.push(nm);

        if (spendable && !maxed) {
            const plusTxt = this.add.text(x + r - 8, y - r + 8, '+', {
                fontFamily: 'sans-serif', fontSize: key ? 32 : 26, color: '#ffe060', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5);
            layer.add(plusTxt);
            nodeObjs.push(plusTxt);
        }

        // 進場動畫:alpha 0→1 + scale 0.5→1 (Back.easeOut 彈跳)
        for (const obj of nodeObjs) {
            const go = obj as { setAlpha?: (n: number) => void; setScale?: (n: number) => void; alpha?: number; scaleX?: number; scaleY?: number };
            if (go.setAlpha) go.setAlpha(0);
            if (go.setScale) go.setScale(0.5);
        }
        this.tweens.add({
            targets: nodeObjs,
            alpha: 1,
            scaleX: 1, scaleY: 1,
            duration: 260,
            delay: enterDelay,
            ease: 'Back.easeOut'
        });
    }

    // ── 底部詳情面板 ──
    private openDetail(node: TalentNode) {
        if (this.detail) this.detail.destroy();
        const save = SaveService.instance;
        const lvl = save.getTalentLevel(node.id);
        const spendable = canSpend(node);
        const maxed = lvl >= node.maxLevel;
        const trunk = isTrunk(node.id);
        const accent = trunk ? 0xffc024 : ROUTE_COLOR[node.route];
        const accentHex = trunk ? '#ffc024' : node.route === 'attack' ? '#e2542a' : node.route === 'defense' ? '#c8902f' : '#7a9a5a';
        const panelH = 450;
        const finalY = H - panelH / 2;
        // 從螢幕底部滑入
        const layer = this.add.container(0, H).setDepth(2000);
        this.detail = layer;

        // 背景:鏽板質感 + accent 邊框
        const panelBg = this.add.rectangle(W / 2, finalY, W, panelH, 0x1e1812, 0.99).setOrigin(0.5)
            .setStrokeStyle(0, 0, 0).setInteractive();
        // 頂部 accent 色線 + 上沿亮帶
        const panelTop = this.add.rectangle(W / 2, H - panelH, W, 4, accent, 1);
        const panelSheen = this.add.rectangle(W / 2, H - panelH + 16, W, 20, 0x3a342c, 0.3);
        layer.add([panelBg, panelTop, panelSheen]);

        const topY = H - panelH;
        const kindTag = node.kind === 'keystone' ? '◆ 關鍵天賦' : '· 一般天賦';
        layer.add(this.add.text(48, topY + 28, kindTag, {
            fontFamily: 'sans-serif', fontSize: 20, color: accentHex
        }).setOrigin(0, 0));
        layer.add(this.add.text(48, topY + 58, `${node.nameZH}${node.wired ? '' : '  ▪預覽'}`, {
            fontFamily: 'sans-serif', fontSize: 40, color: accentHex, fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0, 0));
        layer.add(this.add.text(W - 48, topY + 64, `Lv ${lvl} / ${node.maxLevel}`, {
            fontFamily: 'monospace', fontSize: 30, color: maxed ? '#ffe060' : '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(1, 0));

        // 分隔線
        layer.add(this.add.rectangle(W / 2, topY + 116, W - 80, 1, accent, 0.4));

        const curDesc = lvl > 0 ? `現在:${node.descZH(lvl)}` : '尚未投入';
        const nextDesc = maxed ? '★ 已滿級' : `下一級:${node.descZH(lvl + 1)}`;
        layer.add(this.add.text(48, topY + 126, curDesc, {
            fontFamily: 'monospace', fontSize: 22, color: '#b08850', wordWrap: { width: W - 96 }
        }).setOrigin(0, 0));
        layer.add(this.add.text(48, topY + 166, nextDesc, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe060', wordWrap: { width: W - 96 }
        }).setOrigin(0, 0));

        // 前置需求
        let reqY = topY + 218;
        for (const req of node.requires) {
            const rn = TALENT_NODES.find(x => x.id === req.nodeId);
            if (!rn) continue;
            const met = save.getTalentLevel(req.nodeId) >= req.minLevel;
            layer.add(this.add.text(48, reqY, `${met ? '✓' : '✗'} 需 ${rn.nameZH} Lv${req.minLevel}`, {
                fontFamily: 'sans-serif', fontSize: 20, color: met ? '#7a9a5a' : '#e2542a'
            }).setOrigin(0, 0));
            reqY += 30;
        }

        // 面板滑入動畫
        this.tweens.add({ targets: layer, y: 0, duration: 280, ease: 'Quad.easeOut' });

        const btnY = H - 70;
        const canBtn = spendable && save.getTalentPoints() > 0;
        const btn = this.add.rectangle(W / 2 - 130, btnY, 360, 84, canBtn ? 0xff8830 : 0x3a3028, 1)
            .setStrokeStyle(3, canBtn ? 0x1a1612 : 0x5a4a38);
        const btnTxt = this.add.text(W / 2 - 130, btnY, maxed ? '已滿級' : canBtn ? '＋ 投入 1 點' : '無法投入', {
            fontFamily: 'sans-serif', fontSize: 30, color: canBtn ? '#1a1612' : '#6a5a4a', fontStyle: 'bold'
        }).setOrigin(0.5);
        layer.add(btn);
        layer.add(btnTxt);
        if (canBtn) {
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => { btn.setFillStyle(0xffaa55); });
            btn.on('pointerout', () => { btn.setFillStyle(0xff8830); });
            btn.on('pointerdown', () => {
                this.tweens.add({ targets: [btn, btnTxt], scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
                const result = spendTalentPoint(node.id);
                if (!result.ok) { this.flashMsg(result.reason ?? '無法投入', '#e2542a'); return; }
                SaveService.instance.save();
                this.scene.restart({ openNode: node.id, scrollY: this.content?.y ?? HEADER_BOTTOM });
            });
        }

        const close = this.add.rectangle(W / 2 + 200, btnY, 200, 84, 0x8b6020, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(W / 2 + 200, btnY, '關閉', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        layer.add(close);
        layer.add(closeTxt);
        close.on('pointerover', () => { close.setFillStyle(0xc8902f); });
        close.on('pointerout', () => { close.setFillStyle(0x8b6020); });
        close.on('pointerdown', () => {
            this.tweens.add({ targets: [close, closeTxt], scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true,
                onComplete: () => { layer.destroy(); this.detail = undefined; } });
        });
    }

    private drawHeaderButtons() {
        // 重置按鈕
        const resetBtn = this.add.rectangle(140, 50, 170, 60, 0x8b3a1f, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true }).setDepth(10);
        const resetTxt = this.add.text(140, 50, '↺ 重置', {
            fontFamily: 'sans-serif', fontSize: 24, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        resetBtn.on('pointerover', () => { resetBtn.setFillStyle(0xb04828); });
        resetBtn.on('pointerout', () => { resetBtn.setFillStyle(0x8b3a1f); });
        resetBtn.on('pointerdown', () => {
            this.tweens.add({ targets: [resetBtn, resetTxt], scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
            this.confirmReset();
        });

        // 返回按鈕
        const back = this.add.rectangle(W - 120, 50, 190, 60, 0xff8830, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true }).setDepth(10);
        const backTxt = this.add.text(W - 120, 50, '◀ 返回', {
            fontFamily: 'sans-serif', fontSize: 26, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        back.on('pointerover', () => { back.setFillStyle(0xffaa55); });
        back.on('pointerout', () => { back.setFillStyle(0xff8830); });
        back.on('pointerdown', () => {
            this.tweens.add({ targets: [back, backTxt], scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true,
                onComplete: () => this.close() });
        });
    }

    shutdown() {
        // 清除 repeat:-1 tween 避免洩漏
        for (const t of this.loopTweens) {
            if (t && t.isPlaying()) t.stop();
        }
        this.loopTweens = [];
    }

    private confirmReset() {
        const modal = this.add.container(W / 2, H / 2).setDepth(3000);
        const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setInteractive();
        const box = this.add.rectangle(0, 0, W - 200, 380, 0x2a2520, 0.98).setStrokeStyle(3, 0xc23a1a, 0.9);
        const msg = this.add.text(0, -80, '重置天賦?', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#e2542a', fontStyle: 'bold'
        }).setOrigin(0.5);
        const sub = this.add.text(0, -10, '所有 TP 退還 / 需重新分配', {
            fontFamily: 'sans-serif', fontSize: 20, color: '#ffe0c0', align: 'center'
        }).setOrigin(0.5);
        const yes = this.add.text(-150, 100, '確定', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold',
            backgroundColor: '#c23a1a', padding: { x: 26, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const no = this.add.text(150, 100, '取消', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#b08850', padding: { x: 26, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        modal.add([dim, box, msg, sub, yes, no]);
        yes.on('pointerdown', () => {
            SaveService.instance.resetTalents();
            SaveService.instance.save();
            modal.destroy();
            this.scene.restart({});
        });
        no.on('pointerdown', () => modal.destroy());
    }

    private flashMsg(msg: string, color: string) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 34, color, fontStyle: 'bold',
            backgroundColor: '#1a1612', padding: { x: 22, y: 10 }
        }).setOrigin(0.5).setDepth(2500);
        this.tweens.add({ targets: t, alpha: 0, y: t.y - 50, duration: 900, onComplete: () => t.destroy() });
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
