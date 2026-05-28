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
        this.load.image('npc_clerk', 'characters/npc_quest_clerk_greenscarf.png');

        // Phase 4a-20 Gacha familiar pool(13 隻全載)
        const fams = [
            'pip', 'mira', 'grub', 'zix', 'neek', 'dorl',
            'fire_imp', 'ironguard', 'frost_witch', 'axe_brothers',
            'blackmarket_fox', 'wasteland_prophet', 'shadow_hunter',
            'appraisal_queen'
        ];
        const famFiles: Record<string, string> = {
            pip: 'familiar_r_scavver_kid_pip',
            mira: 'familiar_r_gather_rat_mira',
            grub: 'familiar_r_goblin_underling_grub',
            zix: 'familiar_r_pickpocket_goblin_zix',
            neek: 'familiar_r_oilamp_lighter_neek',
            dorl: 'familiar_r_pot_dishwasher_dorl',
            fire_imp: 'familiar_sr_fire_imp',
            ironguard: 'familiar_sr_ironguard_portrait',
            frost_witch: 'familiar_sr_frost_tongue_witch',
            axe_brothers: 'familiar_sr_axe_brothers',
            blackmarket_fox: 'familiar_ssr_blackmarket_fox',
            wasteland_prophet: 'familiar_ssr_wasteland_prophet',
            shadow_hunter: 'familiar_ssr_shadow_hunter_portrait',
            appraisal_queen: 'familiar_ur_appraisal_queen'
        };
        fams.forEach(f => this.load.image(`fam_${f}`, `familiars/${famFiles[f]}.png`));

        // Phase 4b-9 painted 廢土 backgrounds — GPT-4o top-down painted maps(楓谷風)
        this.load.image('map_wasteland_topdown', 'maps/zone1/map_wasteland_topdown.png');
        this.load.image('map_guild_hall_topdown', 'maps/zone1/map_guild_hall_topdown.png');
    }

    create ()
    {
        this.scene.start('MainMenu');
    }
}
