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

    constructor() { super('Talent'); }

    create(data?: { openNode?: string; scrollY?: number }) {
        this.add.rectangle(0, 0, W, H, 0x140f0c, 1).setOrigin(0, 0);

        // 標題 + TP(固定 header)
        this.add.rectangle(0, 0, W, HEADER_BOTTOM, 0x1a1612, 0.96).setOrigin(0, 0)
            .setStrokeStyle(2, 0x8b6020, 0.6);
        this.add.text(W / 2, 50, '🌳 廢土天賦樹', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);
        const save = SaveService.instance.get();
        this.add.text(W / 2, 108, `Lv ${save.level}    ★ ${save.talentPoints} TP 可分配    ↕ 上下滑`, {
            fontFamily: 'monospace', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.renderTree(data?.scrollY ?? HEADER_BOTTOM);
        this.drawHeaderButtons();

        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-T', () => this.close());

        if (data?.openNode) {
            const n = TALENT_NODES.find(x => x.id === data.openNode);
            if (n) this.openDetail(n);
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
        const g = this.add.graphics();
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
        layer.add(g);

        // tier 區塊標籤
        const tierName = ['', '生存', '岔路', '專精', '深化', '蛻變', '終極', '神話'];
        for (let tier = 1; tier <= 7; tier++) {
            const ty = TREE_TOP + (tier - 1) * TIER_VGAP;
            const lbl = this.add.text(60, ty, `◢ ${tierName[tier]}`, {
                fontFamily: 'sans-serif', fontSize: 22, color: '#6a5a4a', fontStyle: 'bold'
            }).setOrigin(0, 0.5);
            layer.add(lbl);
        }

        // 節點
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

        // keystone 外光暈 + 角鉚釘
        if (key) {
            const glow = this.add.circle(x, y, r + 10, 0x000000, 0).setStrokeStyle(3, trunk ? 0xffe060 : baseColor, locked ? 0.3 : 0.6);
            layer.add(glow);
            const d = r * 0.72;
            [[-d, -d], [d, -d], [-d, d], [d, d]].forEach(([dx, dy]) => {
                layer.add(this.add.circle(x + dx, y + dy, 5, 0x6a5a3a, locked ? 0.4 : 0.9));
            });
        }

        const c = this.add.circle(x, y, r, fill, 0.97).setStrokeStyle(key ? 6 : 4, ring, locked ? 0.55 : 1);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => this.openDetail(node));
        layer.add(c);

        // 圈內:locked 鎖 / 否則 route glyph(keystone)或 level
        if (locked) {
            layer.add(this.add.text(x, y, '🔒', { fontFamily: 'sans-serif', fontSize: key ? 32 : 22 }).setOrigin(0.5));
        } else {
            if (key) {
                layer.add(this.add.text(x, y - 10, trunk ? '★' : ROUTE_GLYPH[node.route], {
                    fontFamily: 'sans-serif', fontSize: 30
                }).setOrigin(0.5));
            }
            layer.add(this.add.text(x, y + (key ? 20 : 0), `${lvl}/${node.maxLevel}`, {
                fontFamily: 'monospace', fontSize: key ? 20 : 18,
                color: maxed ? '#ffe060' : '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5));
        }

        // 名稱(節點下)
        const nm = this.add.text(x, y + r + 8, `${node.nameZH}${node.wired ? '' : ' ▪'}`, {
            fontFamily: 'sans-serif', fontSize: key ? 20 : 16,
            color: locked ? '#5a4a38' : trunk ? '#ffe060' : '#c8a878', fontStyle: 'bold',
            align: 'center', wordWrap: { width: 220 }, stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5, 0);
        layer.add(nm);

        if (spendable && !maxed) {
            layer.add(this.add.text(x + r - 8, y - r + 8, '+', {
                fontFamily: 'sans-serif', fontSize: key ? 32 : 26, color: '#ffe060', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5));
        }
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
        const panelH = 430;
        const cy = H - panelH / 2;
        const layer = this.add.container(0, 0).setDepth(2000);
        this.detail = layer;

        layer.add(this.add.rectangle(W / 2, cy, W, panelH, 0x241c16, 0.99).setOrigin(0.5)
            .setStrokeStyle(4, accent, 1).setInteractive());

        const kindTag = node.kind === 'keystone' ? '◆ 關鍵天賦' : '· 一般天賦';
        layer.add(this.add.text(48, H - panelH + 28, kindTag, {
            fontFamily: 'sans-serif', fontSize: 20, color: accentHex
        }).setOrigin(0, 0));
        layer.add(this.add.text(48, H - panelH + 56, `${node.nameZH}${node.wired ? '' : '  ▪預覽'}`, {
            fontFamily: 'sans-serif', fontSize: 38, color: accentHex, fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0, 0));
        layer.add(this.add.text(W - 48, H - panelH + 60, `Lv ${lvl} / ${node.maxLevel}`, {
            fontFamily: 'monospace', fontSize: 30, color: maxed ? '#ffe060' : '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(1, 0));

        const curDesc = lvl > 0 ? `現在:${node.descZH(lvl)}` : '尚未投入';
        const nextDesc = maxed ? '★ 已滿級' : `下一級:${node.descZH(lvl + 1)}`;
        layer.add(this.add.text(48, H - panelH + 118, curDesc, {
            fontFamily: 'monospace', fontSize: 22, color: '#b08850', wordWrap: { width: W - 96 }
        }).setOrigin(0, 0));
        layer.add(this.add.text(48, H - panelH + 156, nextDesc, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe060', wordWrap: { width: W - 96 }
        }).setOrigin(0, 0));

        // 前置需求
        let reqY = H - panelH + 208;
        for (const req of node.requires) {
            const rn = TALENT_NODES.find(x => x.id === req.nodeId);
            if (!rn) continue;
            const met = save.getTalentLevel(req.nodeId) >= req.minLevel;
            layer.add(this.add.text(48, reqY, `${met ? '✓' : '✗'} 需 ${rn.nameZH} Lv${req.minLevel}`, {
                fontFamily: 'sans-serif', fontSize: 20, color: met ? '#7a9a5a' : '#e2542a'
            }).setOrigin(0, 0));
            reqY += 30;
        }

        const btnY = H - 70;
        const canBtn = spendable && save.getTalentPoints() > 0;
        const btn = this.add.rectangle(W / 2 - 130, btnY, 360, 84, canBtn ? 0xff8830 : 0x3a3028, 1)
            .setStrokeStyle(3, canBtn ? 0x1a1612 : 0x5a4a38);
        layer.add(btn);
        layer.add(this.add.text(W / 2 - 130, btnY, maxed ? '已滿級' : canBtn ? '＋ 投入 1 點' : '無法投入', {
            fontFamily: 'sans-serif', fontSize: 30, color: canBtn ? '#1a1612' : '#6a5a4a', fontStyle: 'bold'
        }).setOrigin(0.5));
        if (canBtn) {
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                const r = spendTalentPoint(node.id);
                if (!r.ok) { this.flashMsg(r.reason ?? '無法投入', '#e2542a'); return; }
                SaveService.instance.save();
                this.scene.restart({ openNode: node.id, scrollY: this.content?.y ?? HEADER_BOTTOM });
            });
        }

        const close = this.add.rectangle(W / 2 + 200, btnY, 200, 84, 0x8b6020, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true });
        layer.add(close);
        layer.add(this.add.text(W / 2 + 200, btnY, '關閉', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5));
        close.on('pointerdown', () => { layer.destroy(); this.detail = undefined; });
    }

    private drawHeaderButtons() {
        const resetBtn = this.add.rectangle(140, 50, 170, 60, 0x8b3a1f, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true }).setDepth(10);
        this.add.text(140, 50, '↺ 重置', {
            fontFamily: 'sans-serif', fontSize: 24, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        resetBtn.on('pointerdown', () => this.confirmReset());

        const back = this.add.rectangle(W - 120, 50, 190, 60, 0xff8830, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true }).setDepth(10);
        this.add.text(W - 120, 50, '◀ 返回', {
            fontFamily: 'sans-serif', fontSize: 26, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);
        back.on('pointerdown', () => this.close());
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
