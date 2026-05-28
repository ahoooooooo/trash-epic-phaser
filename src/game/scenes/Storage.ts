import { Scene } from 'phaser';

const W = 1080;
const H = 1920;

// Phase 4b-5 倉庫 tab — Phase 4b-7 掉落系統實裝後顯示玩家物品
export class Storage extends Scene {
    constructor() { super('Storage'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.92).setOrigin(0, 0);

        this.add.text(W / 2, 80, '📦 倉庫', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(W / 2, H / 2 - 80, '空空如也', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#6a5a4a'
        }).setOrigin(0.5);

        this.add.text(W / 2, H / 2 + 20,
            '掉落系統(Phase 4b-7)實裝後,殺怪掉的素材 / 武器 / 防具會放這', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30',
            wordWrap: { width: W - 200 }, align: 'center'
        }).setOrigin(0.5);

        this.makeClose();
    }

    private makeClose() {
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
