import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { TALENT_NODES, TalentNode, TalentRoute, canSpend, isVisible, getRouteSpent, spendTalentPoint } from '../services/TalentService';

const W = 1080;
const H = 1920;

// Phase 4b-15 60 節點完整天賦樹 — per Codex deep design council
// 5 Tier × 3 Route grid,scrollable container
export class Talent extends Scene {
    constructor() { super('Talent'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.96).setOrigin(0, 0);

        this.add.text(W / 2, 60, '🌳 天賦樹', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance.get();
        this.add.text(W / 2, 120, `Lv ${save.level}  |  ★ ${save.talentPoints} TP 可分配`, {
            fontFamily: 'monospace', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Route headers
        const routeMeta: Record<TalentRoute, { name: string; color: number; x: number }> = {
            attack:  { name: '⚔ 進攻', color: 0xc23a1a, x: 200 },
            defense: { name: '🛡 防禦', color: 0x4080ff, x: W / 2 },
            support: { name: '✨ 輔助', color: 0x4a5d3a, x: W - 200 }
        };
        const headerY = 175;
        (Object.keys(routeMeta) as TalentRoute[]).forEach(r => {
            const m = routeMeta[r];
            const spent = getRouteSpent(r);
            this.add.text(m.x, headerY, `${m.name}  (${spent})`, {
                fontFamily: 'sans-serif', fontSize: 28, color: `#${m.color.toString(16).padStart(6, '0')}`,
                fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5);
        });

        // Scrollable scene area:600 高,內含 5 tier × 3 col × node card
        const scrollTop = 220;
        const scrollHeight = H - 320;
        const nodeW = 280;
        const nodeH = 110;
        const tierGap = 24;

        // Mask
        const mask = this.add.rectangle(W / 2, scrollTop + scrollHeight / 2, W, scrollHeight, 0xffffff, 0)
            .setVisible(false);
        const maskGeo = this.make.graphics({});
        maskGeo.fillStyle(0xffffff);
        maskGeo.fillRect(0, scrollTop, W, scrollHeight);
        const geomask = maskGeo.createGeometryMask();

        const layer = this.add.container(0, scrollTop).setMask(geomask);

        // 5 tier × 3 route grid
        for (let tier = 1 as 1; tier <= 5; tier++) {
            const tierY = (tier - 1) * (nodeH * 4 + tierGap); // 4 個 node + gap per tier(每 tier 約 3-4 個 node)
            // Tier label
            const tierLabel = this.add.text(W / 2, tierY + 20, `── Tier ${tier} (需 ${[0, 5, 15, 30, 50][tier - 1]} 點) ──`, {
                fontFamily: 'monospace', fontSize: 18, color: '#8b6020'
            }).setOrigin(0.5);
            layer.add(tierLabel);
            (Object.keys(routeMeta) as TalentRoute[]).forEach(r => {
                const colNodes = TALENT_NODES.filter(n => n.route === r && n.tier === tier);
                colNodes.forEach((node, i) => {
                    if (!isVisible(node)) return;
                    const meta = routeMeta[r];
                    const x = meta.x;
                    const y = tierY + 60 + i * (nodeH + 6);
                    const objs = this.drawNode(node, x, y, meta.color, nodeW, nodeH);
                    layer.add(objs);
                });
            });
        }

        // Total content height 估算
        const totalH = 5 * (nodeH * 4 + tierGap) + 40;
        let layerY = scrollTop;
        const minY = scrollTop - Math.max(0, totalH - scrollHeight);

        // Mouse wheel + drag scroll
        this.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
            layerY = Math.max(minY, Math.min(scrollTop, layer.y - dy * 0.8));
            layer.y = layerY;
        });
        let dragStartY = 0, dragOriginY = 0, dragging = false;
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.y > scrollTop && p.y < scrollTop + scrollHeight) {
                dragStartY = p.y; dragOriginY = layer.y; dragging = true;
            }
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!dragging || !p.isDown) return;
            layerY = Math.max(minY, Math.min(scrollTop, dragOriginY + (p.y - dragStartY)));
            layer.y = layerY;
        });
        this.input.on('pointerup', () => { dragging = false; });

        // 用 mask invisible 防止 click 透過
        void mask;

        // 重置 + 返回
        const resetBtn = this.add.text(W / 2 - 200, H - 80, '↺ 重置', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold',
            backgroundColor: '#8b3a1f', padding: { x: 22, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        resetBtn.on('pointerdown', () => this.confirmReset());

        const back = this.add.text(W / 2 + 100, H - 80, '◀ 返回', {
            fontFamily: 'sans-serif', fontSize: 32, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 32, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.close());
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-T', () => this.close());
    }

    private drawNode(node: TalentNode, x: number, y: number, color: number, w: number, h: number): Phaser.GameObjects.GameObject[] {
        const save = SaveService.instance;
        const lvl = save.getTalentLevel(node.id);
        const spendable = canSpend(node);
        const locked = !spendable && lvl === 0;

        const wiredTag = node.wired ? '' : '  [預覽]';
        const titleColor = locked ? '#4a3018' : node.wired ? '#ffe0c0' : '#8b6020';

        const bg = this.add.rectangle(x, y, w, h, locked ? 0x1a1612 : 0x2a2520, 0.92)
            .setStrokeStyle(2, locked ? 0x4a3018 : color, locked ? 0.4 : 0.95);
        if (!locked) bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.trySpend(node));

        const titleText = this.add.text(x, y - 36, `${node.nameZH}${wiredTag}`, {
            fontFamily: 'sans-serif', fontSize: 18, color: titleColor, fontStyle: 'bold'
        }).setOrigin(0.5);

        const desc = lvl > 0 ? node.descZH(lvl) : node.descZH(1);
        const descText = this.add.text(x, y - 6, desc, {
            fontFamily: 'monospace', fontSize: 13, color: locked ? '#4a3018' : '#b08850',
            align: 'center', wordWrap: { width: w - 16 }
        }).setOrigin(0.5);

        const levelText = this.add.text(x, y + 28, `${lvl} / ${node.maxLevel}`, {
            fontFamily: 'monospace', fontSize: 18, color: lvl >= node.maxLevel ? '#ffe060' : '#ffe0c0',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const objs: Phaser.GameObjects.GameObject[] = [bg, titleText, descText, levelText];
        if (locked) {
            const lock = this.add.text(x, y + 46, '🔒 未解鎖', {
                fontFamily: 'sans-serif', fontSize: 11, color: '#6a5a4a'
            }).setOrigin(0.5);
            objs.push(lock);
        }
        return objs;
    }

    private trySpend(node: TalentNode) {
        const r = spendTalentPoint(node.id);
        if (!r.ok) {
            this.flashMsg(r.reason ?? '無法點', '#c23a1a');
            return;
        }
        SaveService.instance.save();
        this.flashMsg(`+1 ${node.nameZH}`, '#ffe060');
        this.scene.restart();
    }

    private confirmReset() {
        const modal = this.add.container(W / 2, H / 2).setDepth(3000);
        const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setInteractive();
        const box = this.add.rectangle(0, 0, W - 200, 380, 0x2a2520, 0.98)
            .setStrokeStyle(3, 0xc23a1a, 0.9);
        const msg = this.add.text(0, -80, '重置天賦?', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#c23a1a', fontStyle: 'bold'
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
            this.scene.restart();
        });
        no.on('pointerdown', () => modal.destroy());
    }

    private flashMsg(msg: string, color: string) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 36, color, fontStyle: 'bold',
            backgroundColor: '#1a1612', padding: { x: 22, y: 10 },
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(2500);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50, duration: 800,
            onComplete: () => t.destroy()
        });
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
