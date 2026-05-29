import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { TALENT_NODES, TalentNode, TalentRoute, canSpend, isVisible, getRouteSpent, spendTalentPoint } from '../services/TalentService';

const W = 1080;
const H = 1920;

// Phase 4c-D2 天賦樹手機重設計(per user「節點太小難看 + 參考楓谷分頁繁雜」)
// 路線分頁(一次顯示一路線)→ 節點放大 r52 + requires 連線(樹根感)+ 點節點開底部詳情面板升級
const TREE_TOP = 78;
const TIER_VGAP = 250;
const NODE_R = 52;
const CAP_R = 62;            // capstone 較大
const SCROLL_TOP = 250;
const SCROLL_BOTTOM = H - 150;
const TIER_GATE = [0, 5, 15, 30, 50];

const ROUTE_META: Record<TalentRoute, { name: string; color: number; hex: string }> = {
    attack:  { name: '⚔ 進攻', color: 0xc23a1a, hex: '#e2542a' },
    defense: { name: '🛡 防禦', color: 0x8b6020, hex: '#c8902f' },  // 鏽金(避開禁用鮮藍)
    support: { name: '✨ 輔助', color: 0x4a5d3a, hex: '#7a9a5a' }
};
const ROUTE_ORDER: TalentRoute[] = ['attack', 'defense', 'support'];

export class Talent extends Scene {
    private activeRoute: TalentRoute = 'attack';
    private content?: Phaser.GameObjects.Container;
    private detail?: Phaser.GameObjects.Container;

    constructor() { super('Talent'); }

    create(data?: { route?: TalentRoute; openNode?: string }) {
        this.activeRoute = data?.route ?? 'attack';
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.97).setOrigin(0, 0);

        this.add.text(W / 2, 52, '🌳 天賦樹', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance.get();
        this.add.text(W / 2, 104, `Lv ${save.level}   ★ ${save.talentPoints} TP 可分配`, {
            fontFamily: 'monospace', fontSize: 26, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.drawRouteTabs();
        this.renderRoute();
        this.drawChromeButtons();

        // 提示
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-T', () => this.close());

        if (data?.openNode) {
            const n = TALENT_NODES.find(x => x.id === data.openNode);
            if (n) this.openDetail(n);
        }
    }

    // ── 頂部 3 路線分頁 ──
    private drawRouteTabs() {
        const tabW = 320;
        const tabH = 76;
        const y = 178;
        ROUTE_ORDER.forEach((r, i) => {
            const m = ROUTE_META[r];
            const x = 180 + i * 360;
            const active = r === this.activeRoute;
            const spent = getRouteSpent(r);
            const bg = this.add.rectangle(x, y, tabW, tabH, active ? m.color : 0x2a2520, active ? 0.95 : 0.7)
                .setStrokeStyle(active ? 4 : 2, active ? 0xffe0c0 : m.color, active ? 1 : 0.6)
                .setInteractive({ useHandCursor: true });
            this.add.text(x, y - 12, m.name, {
                fontFamily: 'sans-serif', fontSize: 28, color: active ? '#ffe0c0' : m.hex, fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5);
            this.add.text(x, y + 20, `投入 ${spent} 點`, {
                fontFamily: 'monospace', fontSize: 17, color: active ? '#ffe0c0' : '#8b6020'
            }).setOrigin(0.5);
            if (!active) bg.on('pointerdown', () => this.scene.restart({ route: r }));
        });
    }

    // ── 渲染當前路線:連線 + 節點(可捲動)──
    private renderRoute() {
        if (this.content) this.content.destroy();
        const scrollH = SCROLL_BOTTOM - SCROLL_TOP;

        // mask
        const maskGeo = this.make.graphics({});
        maskGeo.fillStyle(0xffffff);
        maskGeo.fillRect(0, SCROLL_TOP, W, scrollH);
        const geomask = maskGeo.createGeometryMask();

        const layer = this.add.container(0, SCROLL_TOP).setMask(geomask);
        this.content = layer;

        const positions = this.buildPositions();
        const save = SaveService.instance;

        // tier 分隔線 + label
        for (let tier = 1; tier <= 5; tier++) {
            const ty = TREE_TOP + (tier - 1) * TIER_VGAP;
            const lbl = this.add.text(W / 2, ty - 86,
                `── Tier ${tier}  (需本路線 ${TIER_GATE[tier - 1]} 點) ──`, {
                fontFamily: 'monospace', fontSize: 19, color: '#8b6020'
            }).setOrigin(0.5);
            layer.add(lbl);
        }

        // requires 連線(同路線才畫線;跨路線在詳情面板顯示)
        const g = this.add.graphics();
        for (const node of TALENT_NODES) {
            if (node.route !== this.activeRoute || !isVisible(node)) continue;
            const b = positions.get(node.id);
            if (!b) continue;
            for (const req of node.requires) {
                const a = positions.get(req.nodeId);
                if (!a) continue; // 跨路線前置 → 不在此視圖
                const met = save.getTalentLevel(req.nodeId) >= req.minLevel;
                g.lineStyle(met ? 6 : 4, met ? 0xffc024 : 0x5a4a38, met ? 0.9 : 0.45);
                g.beginPath();
                g.moveTo(a.x, a.y);
                g.lineTo(b.x, b.y);
                g.strokePath();
            }
        }
        layer.add(g);

        // 節點
        for (const node of TALENT_NODES) {
            if (node.route !== this.activeRoute || !isVisible(node)) continue;
            const p = positions.get(node.id);
            if (!p) continue;
            this.drawNode(node, p.x, p.y, layer);
        }

        // 捲動(內容超過可視才捲)
        const totalH = TREE_TOP + 4 * TIER_VGAP + 200;
        const minY = SCROLL_TOP - Math.max(0, totalH - scrollH);
        this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
            layer.y = Math.max(minY, Math.min(SCROLL_TOP, layer.y - dy * 0.8));
        });
        let dragStartY = 0, dragOriginY = 0, dragging = false;
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.y > SCROLL_TOP && p.y < SCROLL_BOTTOM) {
                dragStartY = p.y; dragOriginY = layer.y; dragging = true;
            }
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!dragging || !p.isDown) return;
            layer.y = Math.max(minY, Math.min(SCROLL_TOP, dragOriginY + (p.y - dragStartY)));
        });
        this.input.on('pointerup', () => { dragging = false; });
    }

    // 當前路線節點座標(tier→y,tier 內水平分支)
    private buildPositions(): Map<string, { x: number; y: number }> {
        const pos = new Map<string, { x: number; y: number }>();
        for (let tier = 1; tier <= 5; tier++) {
            const nodes = TALENT_NODES.filter(n => n.route === this.activeRoute && n.tier === tier && isVisible(n));
            const n = nodes.length;
            const step = Math.min(250, 760 / Math.max(1, n));
            nodes.forEach((node, i) => {
                pos.set(node.id, {
                    x: W / 2 + (i - (n - 1) / 2) * step,
                    y: TREE_TOP + (tier - 1) * TIER_VGAP
                });
            });
        }
        return pos;
    }

    private isCapstone(node: TalentNode): boolean {
        return node.tier === 5 && node.requires.length >= 2;
    }

    // ── 大節點圓 ──
    private drawNode(node: TalentNode, x: number, y: number, layer: Phaser.GameObjects.Container) {
        const save = SaveService.instance;
        const lvl = save.getTalentLevel(node.id);
        const spendable = canSpend(node);
        const locked = !spendable && lvl === 0;
        const maxed = lvl >= node.maxLevel;
        const cap = this.isCapstone(node);
        const r = cap ? CAP_R : NODE_R;
        const routeColor = ROUTE_META[node.route].color;

        const fill = locked ? 0x1a1612 : maxed ? 0x3a2f18 : 0x2a2520;
        const ring = locked ? 0x4a3018 : maxed ? 0xffe060 : spendable ? 0xffc024 : routeColor;

        // capstone 外環光暈
        if (cap) {
            const glow = this.add.circle(x, y, r + 8, 0x000000, 0).setStrokeStyle(2, 0xffe060, 0.5);
            layer.add(glow);
        }
        const c = this.add.circle(x, y, r, fill, 0.96).setStrokeStyle(spendable || maxed ? 6 : 4, ring, locked ? 0.55 : 1);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => this.openDetail(node));

        // capstone 標記
        if (cap) {
            const star = this.add.text(x, y - r + 14, '★', {
                fontFamily: 'sans-serif', fontSize: 22, color: maxed ? '#ffe060' : '#8b6020'
            }).setOrigin(0.5);
            layer.add(star);
        }

        const lt = this.add.text(x, y + (cap ? 6 : 0), `${lvl}/${node.maxLevel}`, {
            fontFamily: 'monospace', fontSize: 24,
            color: maxed ? '#ffe060' : locked ? '#6a5a4a' : '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5);

        const wiredMark = node.wired ? '' : ' ▪';
        const nm = this.add.text(x, y + r + 8, `${node.nameZH}${wiredMark}`, {
            fontFamily: 'sans-serif', fontSize: 18, color: locked ? '#5a4a38' : '#c8a878',
            align: 'center', wordWrap: { width: 200 }, fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5, 0);

        layer.add([c, lt, nm]);

        if (spendable && !maxed) {
            const plus = this.add.text(x + r - 10, y - r + 10, '+', {
                fontFamily: 'sans-serif', fontSize: 30, color: '#ffe060', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5);
            layer.add(plus);
        }
        if (locked) {
            const lk = this.add.text(x, y, '🔒', { fontFamily: 'sans-serif', fontSize: 26 }).setOrigin(0.5);
            layer.add(lk);
            lt.setVisible(false);
        }
    }

    // ── 底部詳情面板(點節點開,可升級)──
    private openDetail(node: TalentNode) {
        if (this.detail) this.detail.destroy();
        const save = SaveService.instance;
        const lvl = save.getTalentLevel(node.id);
        const spendable = canSpend(node);
        const maxed = lvl >= node.maxLevel;
        const panelH = 420;
        const cy = H - panelH / 2;
        const layer = this.add.container(0, 0).setDepth(2000);
        this.detail = layer;

        const panel = this.add.rectangle(W / 2, cy, W, panelH, 0x241c16, 0.99).setOrigin(0.5)
            .setStrokeStyle(4, ROUTE_META[node.route].color, 1).setInteractive();
        layer.add(panel);

        // 名稱
        layer.add(this.add.text(48, H - panelH + 34, `${node.nameZH}${node.wired ? '' : '  ▪預覽'}`, {
            fontFamily: 'sans-serif', fontSize: 36, color: ROUTE_META[node.route].hex, fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0, 0));
        // 等級
        layer.add(this.add.text(W - 48, H - panelH + 38, `Lv ${lvl} / ${node.maxLevel}`, {
            fontFamily: 'monospace', fontSize: 30, color: maxed ? '#ffe060' : '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(1, 0));

        // 效果(目前 → 下一級)
        const curDesc = lvl > 0 ? `現在:${node.descZH(lvl)}` : '尚未投入';
        const nextDesc = maxed ? '★ 已滿級' : `下一級:${node.descZH(lvl + 1)}`;
        layer.add(this.add.text(48, H - panelH + 96, curDesc, {
            fontFamily: 'monospace', fontSize: 22, color: '#b08850', wordWrap: { width: W - 96 }
        }).setOrigin(0, 0));
        layer.add(this.add.text(48, H - panelH + 134, nextDesc, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe060', wordWrap: { width: W - 96 }
        }).setOrigin(0, 0));

        // 前置需求 + tier gate
        let reqY = H - panelH + 184;
        const spent = getRouteSpent(node.route);
        if (spent < node.tierGateReq) {
            layer.add(this.add.text(48, reqY, `✗ 需本路線投入 ${node.tierGateReq} 點(目前 ${spent})`, {
                fontFamily: 'sans-serif', fontSize: 20, color: '#e2542a'
            }).setOrigin(0, 0));
            reqY += 32;
        }
        for (const req of node.requires) {
            const rn = TALENT_NODES.find(x => x.id === req.nodeId);
            if (!rn) continue;
            const met = save.getTalentLevel(req.nodeId) >= req.minLevel;
            const cross = rn.route !== node.route ? `[${ROUTE_META[rn.route].name.slice(2)}] ` : '';
            layer.add(this.add.text(48, reqY, `${met ? '✓' : '✗'} 需 ${cross}${rn.nameZH} Lv${req.minLevel}`, {
                fontFamily: 'sans-serif', fontSize: 20, color: met ? '#7a9a5a' : '#e2542a'
            }).setOrigin(0, 0));
            reqY += 32;
        }

        // 投入按鈕
        const btnY = H - 70;
        const canBtn = spendable && save.getTalentPoints() > 0;
        const btn = this.add.rectangle(W / 2 - 130, btnY, 360, 84, canBtn ? 0xff8830 : 0x3a3028, 1)
            .setStrokeStyle(3, canBtn ? 0x1a1612 : 0x5a4a38);
        layer.add(btn);
        layer.add(this.add.text(W / 2 - 130, btnY, maxed ? '已滿級' : canBtn ? '＋ 投入 1 點' : '無法投入', {
            fontFamily: 'sans-serif', fontSize: 30, color: canBtn ? '#1a1612' : '#6a5a4a', fontStyle: 'bold'
        }).setOrigin(0.5));
        // 只有可投入時按鈕才 interactive(per Codex review:disabled 不可點)
        if (canBtn) {
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                const r = spendTalentPoint(node.id);
                if (!r.ok) { this.flashMsg(r.reason ?? '無法投入', '#e2542a'); return; }
                SaveService.instance.save();
                this.scene.restart({ route: this.activeRoute, openNode: node.id });
            });
        }

        // 關閉
        const close = this.add.rectangle(W / 2 + 200, btnY, 200, 84, 0x8b6020, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true });
        layer.add(close);
        layer.add(this.add.text(W / 2 + 200, btnY, '關閉', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5));
        close.on('pointerdown', () => { layer.destroy(); this.detail = undefined; });
    }

    private drawChromeButtons() {
        const resetBtn = this.add.rectangle(150, 60, 180, 64, 0x8b3a1f, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true });
        this.add.text(150, 60, '↺ 重置', {
            fontFamily: 'sans-serif', fontSize: 26, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5);
        resetBtn.on('pointerdown', () => this.confirmReset());

        const back = this.add.rectangle(W - 130, 60, 200, 64, 0xff8830, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true });
        this.add.text(W - 130, 60, '◀ 返回', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        back.on('pointerdown', () => this.close());
    }

    private confirmReset() {
        const modal = this.add.container(W / 2, H / 2).setDepth(3000);
        const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setInteractive();
        const box = this.add.rectangle(0, 0, W - 200, 380, 0x2a2520, 0.98)
            .setStrokeStyle(3, 0xc23a1a, 0.9);
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
            this.scene.restart({ route: this.activeRoute });
        });
        no.on('pointerdown', () => modal.destroy());
    }

    private flashMsg(msg: string, color: string) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 34, color, fontStyle: 'bold',
            backgroundColor: '#1a1612', padding: { x: 22, y: 10 }
        }).setOrigin(0.5).setDepth(2500);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50, duration: 900,
            onComplete: () => t.destroy()
        });
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
