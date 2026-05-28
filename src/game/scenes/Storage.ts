import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { weaponDisplayName, rarityColor, GeneratedWeapon } from '../services/WeaponGenerator';

const W = 1080;
const H = 1920;

// Phase 4b-5/4b-7 倉庫:顯示素材 + 掉落武器
export class Storage extends Scene {
    constructor() { super('Storage'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.92).setOrigin(0, 0);

        this.add.text(W / 2, 80, '📦 倉庫', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        // 素材區
        const save = SaveService.instance;
        const materials = save.getAllMaterials();
        const matNames: Record<string, string> = {
            strengthen_stone: '🔨 強化石'
        };
        this.add.text(W / 2, 180, '素材', {
            fontFamily: 'sans-serif', fontSize: 32, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5);
        let matY = 230;
        if (Object.keys(materials).length === 0) {
            this.add.text(W / 2, matY, '(空)殺怪掉素材', {
                fontFamily: 'monospace', fontSize: 22, color: '#6a5a4a'
            }).setOrigin(0.5);
            matY += 50;
        } else {
            Object.entries(materials).forEach(([id, count]) => {
                this.add.text(W / 2, matY, `${matNames[id] ?? id} × ${count}`, {
                    fontFamily: 'monospace', fontSize: 26, color: '#ffe0c0'
                }).setOrigin(0.5);
                matY += 40;
            });
        }

        // 武器區
        const weapons = save.getDroppedWeapons();
        const weaponTitleY = Math.max(450, matY + 40);
        this.add.text(W / 2, weaponTitleY, `武器 (${weapons.length})`, {
            fontFamily: 'sans-serif', fontSize: 32, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5);

        const weaponStartY = weaponTitleY + 60;
        const maxShow = 8;
        if (weapons.length === 0) {
            this.add.text(W / 2, weaponStartY + 40, '(空)殺怪 5% 掉武器,boss 50%', {
                fontFamily: 'monospace', fontSize: 22, color: '#6a5a4a'
            }).setOrigin(0.5);
        } else {
            weapons.slice(0, maxShow).forEach((entry, i) => {
                try {
                    const w: GeneratedWeapon = JSON.parse(entry.data);
                    const y = weaponStartY + i * 110;
                    const color = rarityColor(w.tier);
                    this.add.rectangle(W / 2, y + 50, W - 100, 100, 0x2a2520, 0.85)
                        .setStrokeStyle(2, color);
                    this.add.text(80, y + 18, weaponDisplayName(w), {
                        fontFamily: 'sans-serif', fontSize: 26, color: '#ffe0c0', fontStyle: 'bold'
                    });
                    this.add.text(80, y + 52, `[${w.tier}] ${w.category} ${w.element}  傷害 ${w.baseDamage}`, {
                        fontFamily: 'monospace', fontSize: 18, color: '#a05a30'
                    });
                } catch { /* skip corrupt */ }
            });
            if (weapons.length > maxShow) {
                this.add.text(W / 2, weaponStartY + maxShow * 110 + 30, `... 還有 ${weapons.length - maxShow} 把`, {
                    fontFamily: 'monospace', fontSize: 20, color: '#6a5a4a'
                }).setOrigin(0.5);
            }
        }

        const back = this.add.text(W / 2, H - 130, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 50, y: 22 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.close());
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-B', () => this.close());
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
