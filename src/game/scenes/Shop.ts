import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;
const HP_POTION_COST = 30;
const MP_POTION_COST = 20;
const HP_BUNDLE_COUNT = 10;
const MP_BUNDLE_COUNT = 10;

// Phase 4b-6 商店 — 藥水買賣
export class Shop extends Scene {
    constructor() { super('Shop'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.95).setOrigin(0, 0);

        this.add.text(W / 2, 80, '🛒 商店', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        this.renderGoldText();

        // 4 商品 row
        const items = [
            { name: '🧪 補血藥水', desc: '+50 HP', cost: HP_POTION_COST, count: 1, color: 0xc23a1a, action: 'buyHp' },
            { name: '🧪 補血藥水 x10', desc: '+50 HP × 10', cost: HP_POTION_COST * HP_BUNDLE_COUNT * 0.9, count: HP_BUNDLE_COUNT, color: 0xc23a1a, action: 'buyHpBundle' },
            { name: '🔮 補魔藥水', desc: '+30 MP', cost: MP_POTION_COST, count: 1, color: 0x4080ff, action: 'buyMp' },
            { name: '🔮 補魔藥水 x10', desc: '+30 MP × 10', cost: MP_POTION_COST * MP_BUNDLE_COUNT * 0.9, count: MP_BUNDLE_COUNT, color: 0x4080ff, action: 'buyMpBundle' }
        ];

        const startY = 280;
        const rowH = 200;
        items.forEach((item, i) => {
            const y = startY + i * rowH;
            this.add.rectangle(W / 2, y + 80, W - 80, 170, 0x2a2520, 0.85)
                .setStrokeStyle(2, item.color, 0.7);

            this.add.text(80, y + 30, item.name, {
                fontFamily: 'sans-serif', fontSize: 36, color: '#ffe0c0', fontStyle: 'bold'
            });
            this.add.text(80, y + 80, item.desc, {
                fontFamily: 'monospace', fontSize: 22, color: '#a05a30'
            });
            this.add.text(80, y + 115, `💰 ${Math.floor(item.cost)}`, {
                fontFamily: 'monospace', fontSize: 28, color: '#ffe060', fontStyle: 'bold'
            });

            const buyBtn = this.add.text(W - 100, y + 80, '購買', {
                fontFamily: 'sans-serif', fontSize: 32, color: '#1a1612', fontStyle: 'bold',
                backgroundColor: '#ff8830', padding: { x: 28, y: 16 }
            }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
            buyBtn.on('pointerdown', () => this.tryBuy(item.action, item.cost, item.count));
        });

        const back = this.add.text(W / 2, H - 130, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 50, y: 22 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.close());
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-M', () => this.close());
    }

    private goldDisplay?: Phaser.GameObjects.Text;
    private renderGoldText() {
        const save = SaveService.instance.get();
        const text = `💰 ${save.gold}   |   🧪 ${save.hpPotions}   |   🔮 ${save.mpPotions}`;
        if (this.goldDisplay) {
            this.goldDisplay.setText(text);
        } else {
            this.goldDisplay = this.add.text(W / 2, 170, text, {
                fontFamily: 'monospace', fontSize: 26, color: '#ffe0c0'
            }).setOrigin(0.5);
        }
    }

    private tryBuy(action: string, cost: number, count: number) {
        const save = SaveService.instance;
        const c = Math.floor(cost);
        if (!save.spendGold(c)) {
            this.flashMsg('💰 金幣不足', 0xff4040);
            return;
        }
        if (action.startsWith('buyHp')) save.addHpPotions(count);
        else if (action.startsWith('buyMp')) save.addMpPotions(count);
        save.save();
        this.renderGoldText();
        this.flashMsg(`+${count} 入手`, 0x4a5d3a);
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
        t.setTint(color);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50, duration: 1000,
            onComplete: () => t.destroy()
        });
    }
}
