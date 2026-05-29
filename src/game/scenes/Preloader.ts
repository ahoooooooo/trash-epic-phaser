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
        const pct = this.add.text(CX, CY + 90, '0%', {
            fontFamily: 'monospace', fontSize: 28, color: '#b08850'
        }).setOrigin(0.5);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (590 * progress);
            pct.setText(`${Math.round(progress * 100)}%`);
        });
    }

    preload ()
    {
        this.load.setPath('assets');

        // V1 主角 frame anim(Phase 4b-10:idle/walk + 4b-14:attack/hurt)
        this.load.image('player_idle', 'characters/player_scavver_sideview_idle.png');
        this.load.image('player_walk_r', 'characters/player_scavver_walk_right.png');
        this.load.image('player_walk_l', 'characters/player_scavver_walk_left.png');
        this.load.image('player_atk_windup', 'characters/player_scavver_attack_windup.png');
        this.load.image('player_atk_impact', 'characters/player_scavver_attack_impact.png');
        this.load.image('player_hurt', 'characters/player_scavver_hurt.png');
        // Phase 4b-11 mob frame anims(2-frame gallop / wave loop)
        this.load.image('mob_giantrat_run_a', 'mobs/mob_giantrat_run_a.png');
        this.load.image('mob_giantrat_run_b', 'mobs/mob_giantrat_run_b.png');
        this.load.image('mob_centipede_wave_a', 'mobs/mob_centipede_wave_a.png');
        this.load.image('mob_centipede_wave_b', 'mobs/mob_centipede_wave_b.png');
        this.load.image('mob_rust_spider', 'mobs/mob_rust_spider.png');  // Phase 4c-17 真‧獨立新怪(GPT-4o+BiRefNet)
        this.load.image('mob_reactor_crawler', 'mobs/mob_reactor_crawler.png');  // Phase 4c-18 輻射機甲蟲
        this.load.image('npc_clerk', 'characters/npc_quest_clerk_greenscarf.png');

        // Phase 4c-11:14 隻 gacha 立繪(~28MB)移到 Gacha 場景 lazy-load,不在開機 Preloader
        // 拖慢 4G 開機載入(原 47MB 開機 → 卡在載入頁)。立繪只有開抽卡才需要。

        // Phase 4b-9 painted 廢土 backgrounds — GPT-4o top-down painted maps(楓谷風)
        this.load.image('map_wasteland_topdown', 'maps/zone1/map_wasteland_topdown.png');
        this.load.image('map_guild_hall_topdown', 'maps/zone1/map_guild_hall_topdown.png');
    }

    create ()
    {
        this.scene.start('MainMenu');
    }
}
