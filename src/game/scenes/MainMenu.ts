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

        // Start 提示(整個畫面點哪都能進,button 是裝飾不是 hit target)
        this.add.text(CX, CY + 360, '▶ 開始刷怪', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830',
            backgroundColor: '#2a2520', padding: { x: 40, y: 20 },
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(CX, CY + 480, '(點螢幕任何地方開始)', {
            fontFamily: 'sans-serif', fontSize: 24, color: '#a05a30'
        }).setOrigin(0.5);

        // 整個 scene 接 pointer + keyboard,3 重保險(Phaser 4 pointer events 不同環境表現不同)
        let started = false;
        const start = () => {
            if (started) return;
            started = true;
            this.scene.start('Game');
        };
        this.input.on('pointerdown', start);
        this.input.on('pointerup', start);
        this.input.keyboard?.on('keydown', start);

        // 版本標示
        this.add.text(CX, CY + 700, 'v0.0.1 Phase 4a MVP', {
            fontFamily: 'monospace', fontSize: 18, color: '#4a5d3a'
        }).setOrigin(0.5);
    }
}
