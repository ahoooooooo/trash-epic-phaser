import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;

// Phase 4b-5 天賦 tab — Phase 4b-9 完整天賦樹實裝
export class Talent extends Scene {
    constructor() { super('Talent'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.92).setOrigin(0, 0);

        this.add.text(W / 2, 80, '🌳 天賦', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        const save = SaveService.instance.get();
        this.add.text(W / 2, 180, `Lv ${save.level}  |  暫無 talent point`, {
            fontFamily: 'monospace', fontSize: 26, color: '#ffe0c0'
        }).setOrigin(0.5);

        this.add.text(W / 2, H / 2 - 100, '天賦樹建構中', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#6a5a4a'
        }).setOrigin(0.5);

        // 3 路線雛形
        const lines = [
            { name: '⚔ 進攻 — 暴擊 / 傷害 / 攻速', color: '#ff4040' },
            { name: '🛡 防禦 — 生命 / 護甲 / 回血', color: '#4080ff' },
            { name: '✨ 輔助 — 移動 / 拾取 / 經驗', color: '#80ff80' }
        ];
        lines.forEach((l, i) => {
            this.add.text(W / 2, H / 2 + i * 70, l.name, {
                fontFamily: 'sans-serif', fontSize: 28, color: l.color, fontStyle: 'bold'
            }).setOrigin(0.5);
        });

        this.add.text(W / 2, H / 2 + 280, 'Phase 4b-9 完整實作', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
        }).setOrigin(0.5);

        const back = this.add.text(W / 2, H - 130, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 50, y: 22 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.close());
        this.input.keyboard?.on('keydown-ESC', () => this.close());
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
