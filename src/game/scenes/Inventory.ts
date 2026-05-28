import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { getWeapon, effectiveDamage } from '../services/WeaponService';

const W = 1080;
const H = 1920;

// Phase 4b-4 裝備頁 display only — Phase 4b-17 鏽板視覺升級
export class Inventory extends Scene {
    constructor() { super('Inventory'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.96).setOrigin(0, 0);

        this.add.text(W / 2, 84, '◤  裝備  ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance.get();
        const w = getWeapon(save.currentWeaponId);
        const enh = SaveService.instance.getWeaponEnh(w.id);
        const dmg = effectiveDamage(w, enh);

        // ── 當前武器裝備卡 ──
        const cardCx = W / 2;
        const cardCy = 520;
        const cardW = W - 120;
        const cardH = 460;
        this.add.rectangle(cardCx, cardCy, cardW, cardH, 0x2a2520, 0.95)
            .setStrokeStyle(4, 0xff8830, 1);
        this.drawRivets(cardCx, cardCy, cardW, cardH);

        // 卡標籤
        this.add.text(cardCx, cardCy - cardH / 2 + 40, '⚔ 當前武器', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#a05a30', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 武器名 H2
        const nameSuffix = enh > 0 ? ` +${enh}` : '';
        this.add.text(cardCx, cardCy - cardH / 2 + 100, `${w.nameZH}${nameSuffix}`, {
            fontFamily: 'sans-serif', fontSize: 48, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);

        // 傷害大字
        this.add.text(cardCx, cardCy - 30, '傷害', {
            fontFamily: 'sans-serif', fontSize: 26, color: '#a05a30'
        }).setOrigin(0.5);
        this.add.text(cardCx, cardCy + 20, `${dmg}`, {
            fontFamily: 'monospace', fontSize: 72, color: '#ffe060', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5);

        // 攻速 / 射程 stat row
        this.drawStatChip(cardCx - 130, cardCy + 110, '攻速', `${(1000 / w.attackIntervalMs).toFixed(2)}/秒`);
        this.drawStatChip(cardCx + 130, cardCy + 110, '射程', `${w.range}`);

        this.add.text(cardCx, cardCy + cardH / 2 - 32,
            '武器強化、防具/飾品在 Phase 4b-5 重做', {
            fontFamily: 'sans-serif', fontSize: 18, color: '#6a5a4a',
            wordWrap: { width: cardW - 80 }, align: 'center'
        }).setOrigin(0.5);

        // ── 玩家屬性 panel ──
        const statTop = H - 440;
        const statH = 220;
        this.add.rectangle(W / 2, statTop + statH / 2, W - 120, statH, 0x2a2520, 0.92)
            .setStrokeStyle(3, 0xa05a30, 0.9);
        this.drawRivets(W / 2, statTop + statH / 2, W - 120, statH);

        this.add.text(W / 2, statTop + 36, '玩家屬性', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);

        this.drawStatRow(statTop + 96, 'Lv', `${save.level}`, '經驗', `${save.exp} / ${SaveService.instance.expToNext()}`);
        this.drawStatRow(statTop + 152, '金幣', `${save.gold}`, '擊殺', `${save.totalKills}`);

        this.drawBackButton();
        this.input.keyboard?.on('keydown-ESC', () => this.closeInventory());
        this.input.keyboard?.on('keydown-I', () => this.closeInventory());
    }

    private drawStatChip(cx: number, cy: number, label: string, value: string) {
        this.add.rectangle(cx, cy, 220, 70, 0x1a1612, 0.85)
            .setStrokeStyle(2, 0x8b6020, 0.9);
        this.add.text(cx, cy - 14, label, {
            fontFamily: 'sans-serif', fontSize: 18, color: '#a05a30'
        }).setOrigin(0.5);
        this.add.text(cx, cy + 14, value, {
            fontFamily: 'monospace', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private drawStatRow(y: number, l1: string, v1: string, l2: string, v2: string) {
        const leftX = 110;
        const midX = W / 2 + 30;
        this.add.text(leftX, y, l1, {
            fontFamily: 'sans-serif', fontSize: 24, color: '#a05a30'
        }).setOrigin(0, 0.5);
        this.add.text(leftX + 110, y, v1, {
            fontFamily: 'monospace', fontSize: 26, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        this.add.text(midX, y, l2, {
            fontFamily: 'sans-serif', fontSize: 24, color: '#a05a30'
        }).setOrigin(0, 0.5);
        this.add.text(midX + 110, y, v2, {
            fontFamily: 'monospace', fontSize: 26, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0, 0.5);
    }

    private drawRivets(cx: number, cy: number, w: number, h: number) {
        const hx = w / 2 - 16;
        const hy = h / 2 - 16;
        [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]].forEach(([dx, dy]) => {
            this.add.circle(cx + dx, cy + dy, 5, 0x4a3a30).setStrokeStyle(1, 0x1a1612);
        });
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
            this.closeInventory();
        });
    }

    private closeInventory() {
        const gameScene = this.scene.get('Game') as Phaser.Scene & { refreshWeaponText?: () => void };
        if (gameScene.refreshWeaponText) gameScene.refreshWeaponText();
        this.scene.resume('Game');
        this.scene.stop();
    }
}
