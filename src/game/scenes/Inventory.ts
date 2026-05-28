import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { getWeapon, effectiveDamage } from '../services/WeaponService';

const W = 1080;
const H = 1920;

// Phase 4b-4:武器頁砍掉,改成簡易「裝備頁」display only
// 完整 5-tab(倉庫/裝備/夥伴/商店/天賦)等 Phase 4b-5 重做
export class Inventory extends Scene {
    constructor() { super('Inventory'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.92).setOrigin(0, 0);

        this.add.text(W / 2, 80, '🎒 裝備', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance.get();
        const w = getWeapon(save.currentWeaponId);
        const enh = SaveService.instance.getWeaponEnh(w.id);
        const dmg = effectiveDamage(w, enh);

        // 當前裝備武器(中央卡片)
        const cardY = H / 2 - 100;
        this.add.rectangle(W / 2, cardY, W - 120, 360, 0x2a2520, 0.95)
            .setStrokeStyle(4, 0xff8830);

        this.add.text(W / 2, cardY - 130, '⚔ 當前武器', {
            fontFamily: 'monospace', fontSize: 28, color: '#a05a30'
        }).setOrigin(0.5);

        const nameSuffix = enh > 0 ? ` +${enh}` : '';
        this.add.text(W / 2, cardY - 70, `${w.nameZH}${nameSuffix}`, {
            fontFamily: 'sans-serif', fontSize: 48, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(W / 2, cardY - 10, `傷害 ${dmg}`, {
            fontFamily: 'monospace', fontSize: 32, color: '#ffe060'
        }).setOrigin(0.5);

        this.add.text(W / 2, cardY + 40,
            `攻速 ${(1000 / w.attackIntervalMs).toFixed(2)}/秒   |   射程 ${w.range}`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe0c0'
        }).setOrigin(0.5);

        this.add.text(W / 2, cardY + 110,
            '武器強化、更多裝備位置(防具/飾品)在 Phase 4b-5 重做', {
            fontFamily: 'sans-serif', fontSize: 18, color: '#6a5a4a',
            wordWrap: { width: W - 200 }, align: 'center'
        }).setOrigin(0.5);

        // Stats 區
        this.add.text(W / 2, H - 380, '玩家屬性', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#a05a30'
        }).setOrigin(0.5);
        this.add.text(W / 2, H - 320,
            `Lv ${save.level}   |   經驗 ${save.exp} / ${SaveService.instance.expToNext()}\n金幣 ${save.gold}   |   擊殺 ${save.totalKills}`, {
            fontFamily: 'monospace', fontSize: 26, color: '#ffe0c0', align: 'center'
        }).setOrigin(0.5);

        const back = this.add.text(W / 2, H - 130, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 50, y: 22 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.closeInventory());

        this.input.keyboard?.on('keydown-ESC', () => this.closeInventory());
        this.input.keyboard?.on('keydown-I', () => this.closeInventory());
    }

    private closeInventory() {
        const gameScene = this.scene.get('Game') as Phaser.Scene & { refreshWeaponText?: () => void };
        if (gameScene.refreshWeaponText) gameScene.refreshWeaponText();
        this.scene.resume('Game');
        this.scene.stop();
    }
}
