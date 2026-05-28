import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { WEAPONS, effectiveDamage, enhanceCost, WeaponDef } from '../services/WeaponService';

const W = 1080;
const H = 1920;
const TINT_FILL = 1;

// 武器強化 + 切換 UI(Pause overlay over Game scene)
export class Inventory extends Scene {
    // 全部 UI 在 scene.restart() 時重建,不需 instance state

    constructor() { super('Inventory'); }

    create() {
        // 暫停 Game scene(背景仍可見)
        if (this.scene.isActive('Game')) this.scene.pause('Game');

        // 半透明 backdrop
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.85).setOrigin(0, 0);

        // 標題
        this.add.text(W / 2, 80, '⚒ 武器強化', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(W / 2, 160, `💰 ${SaveService.instance.get().gold}`, {
            fontFamily: 'monospace', fontSize: 32, color: '#ffe0c0'
        }).setOrigin(0.5);

        // 5 把武器 row
        const startY = 250;
        const rowH = 220;
        const currentId = SaveService.instance.getCurrentWeaponId();
        WEAPONS.forEach((w, idx) => {
            const y = startY + idx * rowH;
            this.createRow(w, y, w.id === currentId);
        });

        // 返回 button(底部)
        const back = this.add.text(W / 2, H - 130, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 50, y: 22 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.closeInventory());

        // ESC 鍵也可關閉
        this.input.keyboard?.on('keydown-ESC', () => this.closeInventory());
        this.input.keyboard?.on('keydown-I', () => this.closeInventory());
    }

    private createRow(def: WeaponDef, y: number, isEquipped: boolean) {
        const enh = SaveService.instance.getWeaponEnh(def.id);
        const dmg = effectiveDamage(def, enh);

        this.add.rectangle(W / 2, y + 90, W - 80, 200, 0x2a2520, 0.8)
            .setStrokeStyle(2, isEquipped ? 0xff8830 : 0x4a3a30);

        const enhSuffix = enh > 0 ? ` +${enh}` : '';
        this.add.text(60, y + 20, `${def.nameZH}${enhSuffix}`, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#b08850', fontStyle: 'bold'
        });

        const stats = `傷害 ${dmg}  |  攻速 ${(1000 / def.attackIntervalMs).toFixed(2)}/s  |  射程 ${def.range}`;
        this.add.text(60, y + 80, stats, {
            fontFamily: 'monospace', fontSize: 22, color: '#a05a30'
        });

        // 只顯示 Phase 4a 已實裝的 mechanic;bleed/stagger 是 Phase 4b 標 「未實裝」
        const active: string[] = [];
        const pending: string[] = [];
        if (def.knockbackPx) active.push(`擊退 ${def.knockbackPx}px`);
        if (def.recoveryPercent) active.push(`命中回血`);
        if (def.bleed) pending.push(`流血(Phase 4b)`);
        if (def.stagger) pending.push(`Stagger(Phase 4b)`);
        if (active.length) {
            this.add.text(60, y + 115, active.join('  '), {
                fontFamily: 'monospace', fontSize: 18, color: '#4a5d3a'
            });
        }
        if (pending.length) {
            this.add.text(60, y + 145, pending.join('  '), {
                fontFamily: 'monospace', fontSize: 14, color: '#6a5a4a'
            });
        }

        const enhCost = enhanceCost(enh);
        this.makeButton(W - 280, y + 90, `強化 +1\n💰 ${enhCost}`, () => this.tryEnhance(def, enh));
        const equipLabel = isEquipped ? '✓ 裝備中' : '裝備';
        const equipColor = isEquipped ? 0x4a5d3a : 0x8b6020;
        this.makeButton(W - 110, y + 90, equipLabel, () => this.equipWeapon(def.id), equipColor);
    }

    private makeButton(x: number, y: number, label: string, onClick: () => void, fillColor: number = 0xff8830) {
        const c = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 140, 100, fillColor, 0.85).setStrokeStyle(2, 0xffe0c0);
        const txt = this.add.text(0, 0, label, {
            fontFamily: 'sans-serif', fontSize: 20, color: '#1a1612', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5);
        c.add([bg, txt]);
        c.setSize(140, 100);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', onClick);
        return c;
    }

    private tryEnhance(def: WeaponDef, currentEnh: number) {
        const cost = enhanceCost(currentEnh);
        if (!SaveService.instance.spendGold(cost)) {
            this.flashMessage('💰 金幣不足');
            return;
        }
        SaveService.instance.addWeaponEnh(def.id);
        SaveService.instance.save();
        this.scene.restart(); // refresh UI
    }

    private equipWeapon(id: string) {
        SaveService.instance.setCurrentWeaponId(id);
        SaveService.instance.save();
        this.scene.restart();
    }

    private closeInventory() {
        // 切回 Game scene + refresh weapon HUD
        const gameScene = this.scene.get('Game') as Phaser.Scene & { refreshWeaponText?: () => void };
        if (gameScene.refreshWeaponText) gameScene.refreshWeaponText();
        this.scene.resume('Game');
        this.scene.stop();
    }

    private flashMessage(msg: string) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ff4040', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6,
            backgroundColor: '#000000', padding: { x: 30, y: 16 }
        }).setOrigin(0.5).setDepth(3000);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50, duration: 800,
            onComplete: () => t.destroy()
        });
    }
}

// 避免 unused TINT_FILL warning(暫無使用,Phase 4b 可能用)
void TINT_FILL;
