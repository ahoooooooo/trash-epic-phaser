import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { DAILY_REWARDS, grantDailyReward } from '../services/DailyService';

const W = 1080;
const H = 1920;

// Phase 4c-16 每日登入簽到(留存)— 進 Game 時若今日未領則彈出,7 天循環
export class DailyReward extends Scene {
    constructor() { super('DailyReward'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x120c0a, 0.92).setOrigin(0, 0).setInteractive();

        const panelH = 1080;
        const panel = this.add.rectangle(W / 2, H / 2, W - 110, panelH, 0x241c16, 0.99).setStrokeStyle(4, 0xff8830, 0.95);
        const top = panel.y - panelH / 2;

        this.add.text(W / 2, top + 60, '◤  每日登入  ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance;
        // 預覽本次領取的 streak / cycle 日(與 claim 同邏輯,中斷會重置→顯示與實得一致)
        const preview = save.getNextDailyLoginPreview();
        const todayCycle = preview.cycleDay;
        this.add.text(W / 2, top + 118, `連續登入第 ${preview.streak} 天`, {
            fontFamily: 'sans-serif', fontSize: 28, color: '#b08850'
        }).setOrigin(0.5);

        // 7 格日曆(2 列:1-4 / 5-7)
        const cellW = 210, cellH = 200, gap = 24;
        const drawRow = (days: number[], cy: number) => {
            const totalW = days.length * cellW + (days.length - 1) * gap;
            const startX = W / 2 - totalW / 2 + cellW / 2;
            days.forEach((day, i) => {
                const r = DAILY_REWARDS[day - 1];
                const cx = startX + i * (cellW + gap);
                const isToday = day === todayCycle;
                const cell = this.add.rectangle(cx, cy, cellW, cellH, isToday ? 0x4a5d3a : 0x2a2520, 0.95)
                    .setStrokeStyle(isToday ? 5 : 3, isToday ? 0xffe060 : 0x5a4a38);
                if (isToday) this.tweens.add({ targets: cell, scaleX: 1.04, scaleY: 1.04, duration: 600, yoyo: true, repeat: -1 });
                this.add.text(cx, cy - cellH / 2 + 32, `第 ${day} 天`, {
                    fontFamily: 'sans-serif', fontSize: 26, color: isToday ? '#ffe060' : '#a89878', fontStyle: 'bold'
                }).setOrigin(0.5);
                this.add.text(cx, cy + 12, r.label, {
                    fontFamily: 'sans-serif', fontSize: 22, color: '#ffe0c0', align: 'center', wordWrap: { width: cellW - 24 }
                }).setOrigin(0.5);
            });
        };
        drawRow([1, 2, 3, 4], top + 320);
        drawRow([5, 6, 7], top + 560);

        // 領取按鈕
        const btnY = top + panelH - 90;
        const btn = this.add.rectangle(W / 2, btnY, 420, 96, 0xff8830, 1).setStrokeStyle(4, 0x1a1612);
        const btnTxt = this.add.text(W / 2, btnY, '🎁 領取', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
            const day = save.claimDailyLogin();
            if (day <= 0) { this.close(); return; }   // 防重複(理論上不會走到)
            const r = grantDailyReward(day);
            save.save();
            btnTxt.setText('✓ 已領取');
            btn.disableInteractive().setFillStyle(0x3a3028, 1);
            this.add.text(W / 2, btnY - 130, `獲得:${r.label}`, {
                fontFamily: 'sans-serif', fontSize: 36, color: '#ffe060', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 5
            }).setOrigin(0.5);
            this.time.delayedCall(900, () => this.close());
        });

        this.input.keyboard?.on('keydown-ESC', () => this.close());
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
