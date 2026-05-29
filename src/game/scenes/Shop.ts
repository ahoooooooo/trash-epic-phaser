import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;
const HP_POTION_COST = 30;
const MP_POTION_COST = 20;
const HP_BUNDLE_COUNT = 10;
const MP_BUNDLE_COUNT = 10;

// Phase 4b-6 商店 — 藥水買賣 — Phase 4b-17 鏽板視覺升級
export class Shop extends Scene {
    constructor() { super('Shop'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.96).setOrigin(0, 0);

        this.add.text(W / 2, 84, '◤  商店  ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        this.renderGoldText();

        // 4 商品卡(廢土 palette:HP 鏽紅 / MP 深綠)
        const items = [
            { name: '🧪 補血藥水', desc: '+50 HP', cost: HP_POTION_COST, count: 1, color: 0x8b3a1f, action: 'buyHp' },
            { name: '🧪 補血藥水 x10', desc: '+50 HP × 10', cost: HP_POTION_COST * HP_BUNDLE_COUNT * 0.9, count: HP_BUNDLE_COUNT, color: 0x8b3a1f, action: 'buyHpBundle' },
            { name: '🔮 補魔藥水', desc: '+30 MP', cost: MP_POTION_COST, count: 1, color: 0x4a5d3a, action: 'buyMp' },
            { name: '🔮 補魔藥水 x10', desc: '+30 MP × 10', cost: MP_POTION_COST * MP_BUNDLE_COUNT * 0.9, count: MP_BUNDLE_COUNT, color: 0x4a5d3a, action: 'buyMpBundle' }
        ];

        const startY = 260;
        const rowH = 196;
        items.forEach((item, i) => {
            const cy = startY + i * rowH + 88;
            this.drawCard(W / 2, cy, W - 100, 168, item.color);

            // icon 圓底
            const iconX = 120;
            this.add.circle(iconX, cy, 48, 0x1a1612, 0.9).setStrokeStyle(3, item.color, 0.9);
            this.add.text(iconX, cy, item.name.slice(0, 2), {
                fontFamily: 'sans-serif', fontSize: 40
            }).setOrigin(0.5);

            const textX = 200;
            this.add.text(textX, cy - 44, item.name.slice(2).trim(), {
                fontFamily: 'sans-serif', fontSize: 34, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0, 0.5);
            this.add.text(textX, cy + 2, item.desc, {
                fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
            }).setOrigin(0, 0.5);
            // 價格 鏽金框
            this.add.text(textX, cy + 44, '💰', {
                fontFamily: 'sans-serif', fontSize: 24
            }).setOrigin(0, 0.5);
            this.add.text(textX + 38, cy + 44, `${Math.floor(item.cost)}`, {
                fontFamily: 'monospace', fontSize: 28, color: '#ffe060', fontStyle: 'bold'
            }).setOrigin(0, 0.5);

            // 購買 CTA(橙底 rectangle hit area)
            const btnW = 160;
            const btnH = 72;
            const btnX = W - 50 - btnW / 2;
            const buyBg = this.add.rectangle(btnX, cy, btnW, btnH, 0xff8830, 1)
                .setStrokeStyle(4, 0x1a1612, 1);
            this.add.text(btnX, cy, '購買', {
                fontFamily: 'sans-serif', fontSize: 32, color: '#1a1612', fontStyle: 'bold'
            }).setOrigin(0.5);
            buyBg.setInteractive({ useHandCursor: true });
            buyBg.on('pointerdown', () => {
                this.tweens.add({ targets: buyBg, scaleX: 0.92, scaleY: 0.92, duration: 80, yoyo: true });
                this.tryBuy(item.action, item.cost, item.count);
            });
        });

        this.drawBackButton();
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-M', () => this.close());
    }

    private drawCard(cx: number, cy: number, w: number, h: number, accent: number) {
        this.add.rectangle(cx, cy, w, h, 0x2a2520, 0.92)
            .setStrokeStyle(3, accent, 0.9);
        // 四角鉚釘
        const hx = w / 2 - 16;
        const hy = h / 2 - 16;
        [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]].forEach(([dx, dy]) => {
            this.add.circle(cx + dx, cy + dy, 5, 0x4a3a30).setStrokeStyle(1, 0x1a1612);
        });
    }

    private goldDisplay?: Phaser.GameObjects.Text;
    private renderGoldText() {
        const save = SaveService.instance.get();
        const text = `💰 ${save.gold}    🧪 ${SaveService.instance.getPotionCount('rust_water')}    🔮 ${SaveService.instance.getPotionCount('dry_cell')}`;
        if (this.goldDisplay) {
            this.goldDisplay.setText(text);
        } else {
            this.goldDisplay = this.add.text(W / 2, 168, text, {
                fontFamily: 'monospace', fontSize: 28, color: '#ffe060', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5);
        }
    }

    private tryBuy(action: string, cost: number, count: number) {
        const save = SaveService.instance;
        const c = Math.floor(cost);
        if (!save.spendGold(c)) {
            this.flashMsg('💰 金幣不足', 0x8b3a1f);
            return;
        }
        // Phase 4c-2:餵 typed 藥水系統(基礎 HP=鏽水瓶 / MP=乾電池液),非舊 legacy 計數
        if (action.startsWith('buyHp')) save.addPotion('rust_water', count);
        else if (action.startsWith('buyMp')) save.addPotion('dry_cell', count);
        save.save();
        this.renderGoldText();
        this.flashMsg(`+${count} 入手`, 0x4a5d3a);
    }

    private drawBackButton() {
        const bw = 360;
        const bh = 84;
        const by = H - 130;
        const bg = this.add.rectangle(W / 2, by, bw, bh, 0xff8830, 1)
            .setStrokeStyle(4, 0x1a1612, 1);
        this.add.text(W / 2, by, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
            this.tweens.add({ targets: bg, scaleX: 0.94, scaleY: 0.94, duration: 80, yoyo: true });
            this.close();
        });
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }

    private flashMsg(msg: string, color: number) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ffe0c0', fontStyle: 'bold',
            backgroundColor: '#1a1612', padding: { x: 30, y: 16 },
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5).setDepth(3000);
        t.setTint(color).setTintMode(1);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50, duration: 1000,
            onComplete: () => t.destroy()
        });
    }
}
