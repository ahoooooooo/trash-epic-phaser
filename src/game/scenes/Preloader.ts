import { Scene } from 'phaser';
import { AccountService } from '../services/AccountService';

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
        this.load.image('player_portrait', 'characters/player_scavver_portrait.png');  // 正面全身立繪(登入/選單/裝備頁用,地圖才側視)
        // 走路 5 distinct 幀(contact-R / 中間 / passing / 中間 / contact-L,RIFE 補中間幀統一 canvas+腳底對齊)
        // 8 幀 palindrome cycle + 垂直 bob + lean → 楓谷風順暢走路
        for (let i = 0; i < 5; i++) this.load.image(`player_walk_${i}`, `characters/player_scavver_walk_${i}.png`);
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
        this.load.image('mob_mutant_creeper', 'mobs/mob_mutant_creeper.png');  // Phase 4c-19 變異食人花
        this.load.image('mob_rust_scorpion', 'mobs/mob_rust_scorpion.png');  // Phase 4c-20 廢土巨蠍
        this.load.image('mob_acidsire', 'mobs/mob_acidsire.png');  // acidsire 蝕骨蜈蚣巢母 boss sprite(先當強 mob)
        this.load.image('mob_kraz', 'mobs/mob_kraz.png');  // 哥布林戰酋 克拉茲·黑鐵 boss sprite(GPT-4o+BiRefNet)
        this.load.image('mob_arbiter', 'mobs/mob_arbiter.png');  // 銹蝕審判官 隱藏 boss sprite(GPT-4o+BiRefNet)
        this.load.image('npc_clerk', 'characters/npc_quest_clerk_greenscarf.png');
        this.load.image('skin_blackrain', 'skins/skin_blackrain.png');  // Phase 4c-4 SR 角色 skin 黑雨巡者(GPT-4o+BiRefNet)— 商店縮圖 + 裝備換立繪

        // Phase 4c-11:14 隻 gacha 立繪(~28MB)移到 Gacha 場景 lazy-load,不在開機 Preloader
        // 拖慢 4G 開機載入(原 47MB 開機 → 卡在載入頁)。立繪只有開抽卡才需要。

        // Phase 4b-9 painted 廢土 backgrounds — GPT-4o top-down painted maps(楓谷風)
        this.load.image('map_wasteland_topdown', 'maps/zone1/map_wasteland_topdown.png');
        this.load.image('map_guild_hall_topdown', 'maps/zone1/map_guild_hall_topdown.png');
        // Phase 4c-5:6 張各圖專屬 painted 底(GPT-4o,取代純色/共用底)
        this.load.image('map_scrap_town_topdown', 'maps/zone1/map_scrap_town_topdown.png');
        this.load.image('map_creeper_vale_topdown', 'maps/zone1/map_creeper_vale_topdown.png');
        this.load.image('map_dry_well_road_topdown', 'maps/zone1/map_dry_well_road_topdown.png');
        this.load.image('map_sand_pit_topdown', 'maps/zone1/map_sand_pit_topdown.png');
        this.load.image('map_rust_alley_topdown', 'maps/zone1/map_rust_alley_topdown.png');
        this.load.image('map_core_gate_topdown', 'maps/zone1/map_core_gate_topdown.png');
    }

    create ()
    {
        // 已登入(含訪客)→ 直接進主選單;否則先過登入頁
        this.scene.start(AccountService.isLoggedIn() ? 'MainMenu' : 'Login');
    }
}
