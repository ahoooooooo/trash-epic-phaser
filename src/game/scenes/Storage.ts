import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { weaponDisplayName, rarityColor, GeneratedWeapon } from '../services/WeaponGenerator';

const W = 1080;
const H = 1920;

// Phase 4b-5/4b-7 倉庫:顯示素材 + 掉落武器 — Phase 4b-17 鏽板視覺升級
export class Storage extends Scene {
    constructor() { super('Storage'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.96).setOrigin(0, 0);

        // 標題 H1 + ◤ ◢ 裝飾
        this.add.text(W / 2, 84, '◤  倉庫  ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance;

        // ── 素材 panel ──
        const materials = save.getAllMaterials();
        const matNames: Record<string, string> = {
            strengthen_stone: '🔨 強化石'
        };
        const matEntries = Object.entries(materials);
        const matPanelTop = 160;
        const matPanelH = 150;
        this.drawPanel(W / 2, matPanelTop + matPanelH / 2, W - 100, matPanelH);
        this.drawSectionLabel(80, matPanelTop + 16, '素材');

        if (matEntries.length === 0) {
            this.add.text(W / 2, matPanelTop + 95, '(空)殺怪掉素材', {
                fontFamily: 'monospace', fontSize: 22, color: '#6a5a4a'
            }).setOrigin(0.5);
        } else {
            matEntries.forEach(([id, count], i) => {
                const cx = 200 + (i % 3) * 280;
                const cy = matPanelTop + 90 + Math.floor(i / 3) * 50;
                this.add.text(cx, cy, matNames[id] ?? id, {
                    fontFamily: 'sans-serif', fontSize: 24, color: '#ffe0c0', fontStyle: 'bold'
                }).setOrigin(0, 0.5);
                this.add.text(cx + 150, cy, `×${count}`, {
                    fontFamily: 'monospace', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
                }).setOrigin(0, 0.5);
            });
        }

        // ── 武器 grid ──
        const weapons = save.getDroppedWeapons();
        const weaponTitleY = matPanelTop + matPanelH + 36;
        this.drawSectionLabel(80, weaponTitleY, `武器  (${weapons.length})`);

        const gridTop = weaponTitleY + 56;
        const maxShow = 8;
        if (weapons.length === 0) {
            this.drawPanel(W / 2, gridTop + 70, W - 100, 130);
            this.add.text(W / 2, gridTop + 70, '(空)殺怪 5% 掉武器,boss 50%', {
                fontFamily: 'monospace', fontSize: 22, color: '#6a5a4a'
            }).setOrigin(0.5);
        } else {
            const cardW = (W - 100 - 24) / 2; // 2 col grid
            const cardH = 150;
            const gapX = 24;
            const gapY = 18;
            weapons.slice(0, maxShow).forEach((entry, i) => {
                try {
                    const w: GeneratedWeapon = JSON.parse(entry.data);
                    const col = i % 2;
                    const row = Math.floor(i / 2);
                    const cx = 50 + cardW / 2 + col * (cardW + gapX);
                    const cy = gridTop + cardH / 2 + row * (cardH + gapY);
                    this.drawWeaponCard(cx, cy, cardW, cardH, w);
                } catch { /* skip corrupt */ }
            });
            if (weapons.length > maxShow) {
                const rows = Math.ceil(maxShow / 2);
                const moreY = gridTop + rows * (cardH + gapY) + 12;
                this.add.text(W / 2, moreY, `... 還有 ${weapons.length - maxShow} 把`, {
                    fontFamily: 'monospace', fontSize: 20, color: '#8b6020'
                }).setOrigin(0.5);
            }
        }

        this.drawBackButton();
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-B', () => this.close());
    }

    private drawWeaponCard(cx: number, cy: number, w: number, h: number, weapon: GeneratedWeapon) {
        const color = rarityColor(weapon.tier);
        const equipped = weapon.id === SaveService.instance.getCurrentWeaponId();
        const bg = this.add.rectangle(cx, cy, w, h, equipped ? 0x33402a : 0x2a2520, 0.92)
            .setStrokeStyle(equipped ? 4 : 3, equipped ? 0x9be060 : color, equipped ? 1 : 0.95);
        // tier 邊框左側色條
        this.add.rectangle(cx - w / 2 + 6, cy, 8, h - 14, color, 0.9).setOrigin(0.5);

        // 裝備狀態:已裝備=綠勾標記;否則整卡可點裝備
        if (equipped) {
            this.add.text(cx + w / 2 - 16, cy + h / 2 - 18, '✓ 已裝備', {
                fontFamily: 'sans-serif', fontSize: 18, color: '#9be060', fontStyle: 'bold'
            }).setOrigin(1, 0.5);
        } else {
            bg.setInteractive({ useHandCursor: true });
            this.add.text(cx + w / 2 - 16, cy + h / 2 - 18, '點擊裝備', {
                fontFamily: 'sans-serif', fontSize: 18, color: '#ff8830'
            }).setOrigin(1, 0.5);
            bg.on('pointerdown', () => {
                this.tweens.add({ targets: bg, scaleX: 0.97, scaleY: 0.97, duration: 70, yoyo: true });
                SaveService.instance.setCurrentWeaponId(weapon.id);
                SaveService.instance.save();
                this.scene.restart();
            });
        }

        const left = cx - w / 2 + 24;
        this.add.text(left, cy - 44, weaponDisplayName(weapon), {
            fontFamily: 'sans-serif', fontSize: 24, color: '#ffe0c0', fontStyle: 'bold',
            wordWrap: { width: w - 44 }
        }).setOrigin(0, 0.5);
        this.add.text(left, cy + 4, `${weapon.category} · ${weapon.element}`, {
            fontFamily: 'sans-serif', fontSize: 18, color: '#a05a30'
        }).setOrigin(0, 0.5);
        this.add.text(left, cy + 38, '傷害', {
            fontFamily: 'sans-serif', fontSize: 18, color: '#a05a30'
        }).setOrigin(0, 0.5);
        this.add.text(left + 64, cy + 38, `${weapon.baseDamage}`, {
            fontFamily: 'monospace', fontSize: 26, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        // tier badge 右上
        const badgeX = cx + w / 2 - 40;
        const badgeY = cy - h / 2 + 24;
        this.add.rectangle(badgeX, badgeY, 64, 34, color, 0.92)
            .setStrokeStyle(2, 0x1a1612, 0.9);
        this.add.text(badgeX, badgeY, weapon.tier, {
            fontFamily: 'monospace', fontSize: 22, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    // ── 共用鏽板 helper ──
    private drawPanel(cx: number, cy: number, w: number, h: number) {
        this.add.rectangle(cx, cy, w, h, 0x2a2520, 0.92)
            .setStrokeStyle(3, 0xa05a30, 0.9);
        this.drawRivets(cx, cy, w, h);
    }

    private drawRivets(cx: number, cy: number, w: number, h: number) {
        const hx = w / 2 - 16;
        const hy = h / 2 - 16;
        [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]].forEach(([dx, dy]) => {
            this.add.circle(cx + dx, cy + dy, 5, 0x4a3a30).setStrokeStyle(1, 0x1a1612);
        });
    }

    private drawSectionLabel(x: number, y: number, text: string) {
        this.add.text(x, y, text, {
            fontFamily: 'sans-serif', fontSize: 32, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0, 0.5);
    }

    private drawBackButton() {
        const bw = 360;
        const bh = 84;
        const by = H - 130;
        const bg = this.add.rectangle(W / 2, by, bw, bh, 0xff8830, 1)
            .setStrokeStyle(4, 0x1a1612, 1);
        this.add.text(W / 2, by, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
            this.tweens.add({ targets: bg, scaleX: 0.94, scaleY: 0.94, duration: 80, yoyo: true });
            this.close();
        });
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
