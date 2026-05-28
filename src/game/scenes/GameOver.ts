import { Scene } from 'phaser';

const CX = 540;
const CY = 960;

export class GameOver extends Scene
{
    constructor () { super('GameOver'); }

    create ()
    {
        this.cameras.main.setBackgroundColor('#1a1612');

        this.add.text(CX, CY - 100, '你陣亡了', {
            fontFamily: 'sans-serif', fontSize: 96, color: '#8b3a1f',
            stroke: '#1a1612', strokeThickness: 8
        }).setOrigin(0.5);

        this.add.text(CX, CY + 20, '廢墟吞噬了你...', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#a05a30'
        }).setOrigin(0.5);

        this.add.text(CX, CY + 220, '▶ 再來一次', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830',
            backgroundColor: '#2a2520', padding: { x: 40, y: 20 }
        }).setOrigin(0.5);

        this.add.text(CX, CY + 340, '(點螢幕任何地方回主選單)', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
        }).setOrigin(0.5);

        // 整個 scene 接 pointer + keyboard,3 重保險
        let restarted = false;
        const restart = () => {
            if (restarted) return;
            restarted = true;
            this.scene.start('MainMenu');
        };
        this.input.on('pointerdown', restart);
        this.input.on('pointerup', restart);
        this.input.keyboard?.on('keydown', restart);
    }
}
