import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { FAMILIAR_POOL } from '../services/GachaService';
import { towerStatOf, famLevelMult } from '../services/TDService';

const W = 1080;
const H = 1920;

const FAM_FILES: Record<string, string> = {
    fam_pip: 'familiar_r_scavver_kid_pip', fam_mira: 'familiar_r_gather_rat_mira',
    fam_grub: 'familiar_r_goblin_underling_grub', fam_zix: 'familiar_r_pickpocket_goblin_zix',
    fam_neek: 'familiar_r_oilamp_lighter_neek', fam_dorl: 'familiar_r_pot_dishwasher_dorl',
    fam_fire_imp: 'familiar_sr_fire_imp', fam_ironguard: 'familiar_sr_ironguard_portrait',
    fam_frost_witch: 'familiar_sr_frost_tongue_witch', fam_axe_brothers: 'familiar_sr_axe_brothers',
    fam_blackmarket_fox: 'familiar_ssr_blackmarket_fox', fam_wasteland_prophet: 'familiar_ssr_wasteland_prophet',
    fam_shadow_hunter: 'familiar_ssr_shadow_hunter_portrait', fam_appraisal_queen: 'familiar_ur_appraisal_queen'
};

// 守軍營:擁有守軍清單 + 金幣永久升級(TD 養成核心頁)
export class Barracks extends Scene {
    private goldText!: Phaser.GameObjects.Text;

    constructor() { super('Barracks'); }

    preload() {
        this.load.setPath('assets');
        const save = SaveService.instance;
        for (const fam of FAMILIAR_POOL) {
            if (save.getOwnedCount(fam.id) > 0 && !this.textures.exists(fam.spriteKey)) {
                this.load.image(fam.spriteKey, `familiars/${FAM_FILES[fam.id]}.png`);
            }
        }
    }

    create() {
        const save = SaveService.instance;
        this.add.rectangle(W / 2, H / 2, W, H, 0x1a1612, 1);
        this.add.text(W / 2, 100, '◤ 守軍營 ◢', {
            fontFamily: 'sans-serif', fontSize: 64, color: '#ffe0c0', fontStyle: 'bold', stroke: '#8b3a1f', strokeThickness: 8
        }).setOrigin(0.5);
        this.goldText = this.add.text(W / 2, 180, '', {
            fontFamily: 'sans-serif', fontSize: 38, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.refreshGold();

        const owned = FAMILIAR_POOL.filter(f => save.getOwnedCount(f.id) > 0);
        if (owned.length === 0) {
            this.add.text(W / 2, H / 2, '還沒有守軍 — 去招募吧!', {
                fontFamily: 'sans-serif', fontSize: 40, color: '#b08850'
            }).setOrigin(0.5);
        }
        owned.forEach((fam, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const cx = 290 + col * 500;
            const cy = 400 + row * 210;
            const stat = towerStatOf(fam.id);
            const panel = this.add.rectangle(cx, cy, 470, 188, 0x2a2520, 1).setStrokeStyle(3, 0xa05a30);
            void panel;
            if (this.textures.exists(fam.spriteKey)) {
                const img = this.add.image(cx - 175, cy, fam.spriteKey);
                img.setScale(150 / img.height);
            }
            const lv = save.getFamiliarLevel(fam.id);
            const dmg = stat ? Math.round(stat.dmg * famLevelMult(lv)) : 0;
            this.add.text(cx - 90, cy - 60, `${fam.nameZH}`, {
                fontFamily: 'sans-serif', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0, 0.5);
            const lvText = this.add.text(cx - 90, cy - 14, `Lv.${lv} · 傷害 ${dmg} · ${stat?.desc ?? ''}`, {
                fontFamily: 'sans-serif', fontSize: 26, color: '#b08850'
            }).setOrigin(0, 0.5);
            const cost = save.familiarLevelUpCost(fam.id);
            const upBtn = this.add.text(cx + 60, cy + 48, `⬆ 升級 💰${cost}`, {
                fontFamily: 'sans-serif', fontSize: 30, color: '#1a1612', fontStyle: 'bold',
                backgroundColor: '#9be060', padding: { x: 20, y: 8 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            upBtn.on('pointerdown', () => {
                if (!save.levelUpFamiliar(fam.id)) return;
                save.save();
                const nlv = save.getFamiliarLevel(fam.id);
                const ndmg = stat ? Math.round(stat.dmg * famLevelMult(nlv)) : 0;
                lvText.setText(`Lv.${nlv} · 傷害 ${ndmg} · ${stat?.desc ?? ''}`);
                upBtn.setText(`⬆ 升級 💰${save.familiarLevelUpCost(fam.id)}`);
                this.refreshGold();
                // 升級 pop
                this.tweens.add({ targets: upBtn, scale: 1.12, duration: 90, yoyo: true });
            });
        });

        const back = this.add.text(W / 2, H - 110, '◀ 回防線', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 40, y: 14 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.scene.start('StageSelect'));
    }

    private refreshGold() {
        this.goldText.setText(`💰 ${SaveService.instance.get().gold}`);
    }
}
