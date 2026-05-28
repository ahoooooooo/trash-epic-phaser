import { Scene } from 'phaser';

// 螢幕中心 — 1080x1920 portrait
const CX = 540;
const CY = 960;

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        // 純色廢土背景(per palette #1a1612 炭黑)+ 進度條
        this.cameras.main.setBackgroundColor('#1a1612');

        this.add.text(CX, CY - 80, '破爛史詩', {
            fontFamily: 'sans-serif', fontSize: 64, color: '#b08850', // 髒黃
            align: 'center'
        }).setOrigin(0.5);

        // Progress bar outline
        this.add.rectangle(CX, CY + 40, 600, 24).setStrokeStyle(2, 0xb08850);
        const bar = this.add.rectangle(CX - 295, CY + 40, 4, 20, 0xff8830); // 暖橙油燈光

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (590 * progress);
        });
    }

    preload ()
    {
        this.load.setPath('assets');

        // V1 主角 + Phase 4a 第一隻怪
        this.load.image('player_scavver', 'characters/player_scavver_portrait.png');
        this.load.image('mob_giantrat', 'mobs/boss_wasteland_giantrat_portrait.png');
    }

    create ()
    {
        this.scene.start('MainMenu');
    }
}
