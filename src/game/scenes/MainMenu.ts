import { Scene } from 'phaser';

const CX = 540;
const CY = 960;

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor('#1a1612');

        // 主角立繪正中央上方
        this.add.image(CX, CY - 300, 'player_scavver').setScale(0.45);

        // Title 廢土風
        this.add.text(CX, CY + 80, '破爛史詩', {
            fontFamily: 'sans-serif', fontSize: 96, color: '#b08850',
            stroke: '#1a1612', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(CX, CY + 180, 'Trash Epic', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#a05a30',
            align: 'center'
        }).setOrigin(0.5);

        // Start button(暖橙)
        const startBtn = this.add.text(CX, CY + 360, '▶ 開始刷怪', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830',
            backgroundColor: '#2a2520', padding: { x: 40, y: 20 },
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        startBtn.on('pointerover', () => startBtn.setColor('#ffaa50'));
        startBtn.on('pointerout', () => startBtn.setColor('#ff8830'));
        startBtn.on('pointerdown', () => this.scene.start('Game'));

        // 版本標示
        this.add.text(CX, CY + 700, 'v0.0.1 Phase 4a MVP', {
            fontFamily: 'monospace', fontSize: 18, color: '#4a5d3a'
        }).setOrigin(0.5);
    }
}
