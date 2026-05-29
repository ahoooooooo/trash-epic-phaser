import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { SKINS, skinRarityColor, skinSlotLabel, skinPrice, SkinConfig } from '../services/SkinService';
import { TOPUP_TIERS, GIFT_PACKS, packLimitLabel, TopupTier, PackConfig, DAILY_FREE_CRYSTAL } from '../services/PackService';

const W = 1080;
const H = 1920;
const SCROLL_TOP = 290;
const SCROLL_BOTTOM = H - 150;

type ShopTab = 'skin' | 'pack' | 'topup';

// Phase 4c-6 變現:外觀(雙幣)/ 禮包 / 儲值(廢土晶體 placeholder,不接真實金流)
export class Shop extends Scene {
    private goldDisplay?: Phaser.GameObjects.Text;
    private crystalDisplay?: Phaser.GameObjects.Text;
    private dailyBtn?: Phaser.GameObjects.Rectangle;
    private dailyBtnText?: Phaser.GameObjects.Text;
    private content?: Phaser.GameObjects.Container;
    private maskGfx?: Phaser.GameObjects.Graphics;
    private tabBtns: { tab: ShopTab; bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text }[] = [];
    private tab: ShopTab = 'skin';
    private scrollMinY = SCROLL_TOP;
    private dragStartY = 0;
    private dragOriginY = SCROLL_TOP;
    private draggingList = false;
    private clampScroll(v: number): number { return Math.max(this.scrollMinY, Math.min(SCROLL_TOP, v)); }

    constructor() { super('Shop'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.97).setOrigin(0, 0);

        this.add.text(W / 2, 52, '◤  廢土商店  ◢', {
            fontFamily: 'sans-serif', fontSize: 50, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        // 貨幣列:金幣(左) + 廢土晶體(右)
        this.goldDisplay = this.add.text(60, 110, '', {
            fontFamily: 'monospace', fontSize: 30, color: '#ffe060', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0, 0.5);
        this.crystalDisplay = this.add.text(W - 60, 110, '', {
            fontFamily: 'monospace', fontSize: 30, color: '#7fd8ff', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(1, 0.5);

        // 每日免費領晶體按鈕
        this.dailyBtn = this.add.rectangle(W / 2, 168, 520, 64, 0x4a5d3a, 1).setStrokeStyle(3, 0x1a1612);
        this.dailyBtnText = this.add.text(W / 2, 168, '', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.dailyBtn.setInteractive({ useHandCursor: true });
        this.dailyBtn.on('pointerdown', () => this.claimDaily());

        this.refreshCurrency();

        // 分頁鈕
        const tabs: { tab: ShopTab; label: string }[] = [
            { tab: 'skin', label: '外觀' }, { tab: 'pack', label: '禮包' }, { tab: 'topup', label: '儲值' }
        ];
        const tabW = 300, gap = 18, totalW = tabs.length * tabW + (tabs.length - 1) * gap;
        const startX = W / 2 - totalW / 2 + tabW / 2;
        tabs.forEach((t, i) => {
            const x = startX + i * (tabW + gap);
            const bg = this.add.rectangle(x, 244, tabW, 70, 0x2a2520, 1).setStrokeStyle(3, 0x5a4a38);
            const txt = this.add.text(x, 244, t.label, {
                fontFamily: 'sans-serif', fontSize: 34, color: '#a89878', fontStyle: 'bold'
            }).setOrigin(0.5);
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this.switchTab(t.tab));
            this.tabBtns.push({ tab: t.tab, bg, txt });
        });
        this.highlightTab();

        this.renderList();

        // scroll input 綁一次,操作當前 this.content
        this.input.on('wheel', (_p: unknown, _g: unknown, _dx: number, dy: number) => {
            if (this.content) this.content.y = this.clampScroll(this.content.y - dy * 0.8);
        });
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.y > SCROLL_TOP && p.y < SCROLL_BOTTOM) { this.dragStartY = p.y; this.dragOriginY = this.content?.y ?? SCROLL_TOP; this.draggingList = true; }
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (this.draggingList && p.isDown && this.content) this.content.y = this.clampScroll(this.dragOriginY + (p.y - this.dragStartY));
        });
        this.input.on('pointerup', () => { this.draggingList = false; });

        this.drawBackButton();
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.input.keyboard?.on('keydown-M', () => this.close());
    }

    private refreshCurrency() {
        const save = SaveService.instance.get();
        this.goldDisplay?.setText(`💰 ${save.gold}`);
        this.crystalDisplay?.setText(`💎 ${save.crystal}`);
        const s = SaveService.instance;
        const canFree = s.canClaimDailyCrystal();
        const canMc = s.canClaimMonthCardDaily();
        if (canFree || canMc) {
            const parts: string[] = [];
            if (canFree) parts.push(`登入 +${DAILY_FREE_CRYSTAL}`);
            if (canMc) parts.push('月卡 +3');
            this.dailyBtnText?.setText(`🎁 領每日晶體(${parts.join(' / ')})`);
            this.dailyBtn?.setFillStyle(0x4a5d3a, 1);
        } else {
            this.dailyBtnText?.setText('✓ 今日晶體已領取');
            this.dailyBtn?.setFillStyle(0x2a2520, 1);
        }
    }

    private claimDaily() {
        const s = SaveService.instance;
        let got = 0;
        if (s.claimDailyCrystal(DAILY_FREE_CRYSTAL)) got += DAILY_FREE_CRYSTAL;
        if (s.claimMonthCardDaily(3)) got += 3;
        if (got > 0) {
            s.save();
            this.refreshCurrency();
            this.flashMsg(`💎 +${got} 廢土晶體`, 0x4a5d3a);
        } else {
            this.flashMsg('今日已領取', 0x8b6020);
        }
    }

    private switchTab(t: ShopTab) {
        if (this.tab === t) return;
        this.tab = t;
        this.highlightTab();
        this.renderList();
    }

    private highlightTab() {
        this.tabBtns.forEach(b => {
            const on = b.tab === this.tab;
            b.bg.setFillStyle(on ? 0xff8830 : 0x2a2520, 1).setStrokeStyle(3, on ? 0x1a1612 : 0x5a4a38);
            b.txt.setColor(on ? '#1a1612' : '#a89878');
        });
    }

    private renderList() {
        if (this.content) this.content.destroy();
        if (this.maskGfx) this.maskGfx.destroy();
        const scrollH = SCROLL_BOTTOM - SCROLL_TOP;
        this.maskGfx = this.make.graphics({});
        this.maskGfx.fillStyle(0xffffff);
        this.maskGfx.fillRect(0, SCROLL_TOP, W, scrollH);
        const layer = this.add.container(0, SCROLL_TOP).setMask(this.maskGfx.createGeometryMask());
        this.content = layer;

        let totalH = 40;
        if (this.tab === 'skin') totalH = this.renderSkins(layer);
        else if (this.tab === 'pack') totalH = this.renderPacks(layer);
        else totalH = this.renderTopups(layer);

        this.scrollMinY = SCROLL_TOP - Math.max(0, totalH - scrollH);
        layer.y = this.clampScroll(SCROLL_TOP);
    }

    private renderSkins(layer: Phaser.GameObjects.Container): number {
        const save = SaveService.instance;
        const rowH = 110;
        SKINS.forEach((skin, i) => {
            const y = 30 + i * rowH;
            const rc = skinRarityColor(skin.rarity);
            layer.add(this.add.rectangle(W / 2, y, W - 80, rowH - 12, 0x2a2520, 0.95).setStrokeStyle(3, rc, 0.95));
            layer.add(this.add.text(80, y - 22, skin.nameZH, {
                fontFamily: 'sans-serif', fontSize: 30, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0, 0.5));
            layer.add(this.add.text(80, y + 22, `${skinSlotLabel(skin.slot)} · ${skin.rarity}`, {
                fontFamily: 'sans-serif', fontSize: 20, color: '#a05a30'
            }).setOrigin(0, 0.5));
            const price = skinPrice(skin);
            const priceStr = price.currency === 'crystal' ? `💎 ${price.amount}` : `💰 ${price.amount}`;
            layer.add(this.add.text(540, y, priceStr, {
                fontFamily: 'monospace', fontSize: 24, color: price.currency === 'crystal' ? '#7fd8ff' : '#ffe060', fontStyle: 'bold'
            }).setOrigin(0, 0.5));

            const owned = save.hasSkin(skin.id);
            const equipped = save.getEquippedSkin(skin.slot) === skin.id;
            const btnX = W - 150;
            let label: string, fill: number, txtColor: string, active: boolean;
            if (equipped) { label = '✓ 已裝備'; fill = 0x3a3028; txtColor = '#7a9a5a'; active = false; }
            else if (owned) { label = '裝備'; fill = 0x8b6020; txtColor = '#ffe0c0'; active = true; }
            else { label = '購買'; fill = 0xff8830; txtColor = '#1a1612'; active = true; }
            const btn = this.add.rectangle(btnX, y, 180, 72, fill, 1).setStrokeStyle(3, active ? 0x1a1612 : 0x5a4a38);
            layer.add(btn);
            layer.add(this.add.text(btnX, y, label, {
                fontFamily: 'sans-serif', fontSize: 28, color: txtColor, fontStyle: 'bold'
            }).setOrigin(0.5));
            if (active) {
                btn.setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => owned ? this.equipSkin(skin) : this.buySkin(skin));
            }
        });
        return 30 + SKINS.length * rowH + 40;
    }

    private renderPacks(layer: Phaser.GameObjects.Container): number {
        const save = SaveService.instance;
        const rowH = 156;
        GIFT_PACKS.forEach((pack, i) => {
            const y = 40 + i * rowH;
            layer.add(this.add.rectangle(W / 2, y, W - 80, rowH - 14, 0x2a2520, 0.95).setStrokeStyle(3, 0xff8830, 0.9));
            layer.add(this.add.text(70, y - 50, pack.nameZH, {
                fontFamily: 'sans-serif', fontSize: 32, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0, 0.5));
            layer.add(this.add.text(70, y - 6, pack.descZH, {
                fontFamily: 'sans-serif', fontSize: 20, color: '#a89878', wordWrap: { width: W - 200 }
            }).setOrigin(0, 0.5));
            layer.add(this.add.text(70, y + 48, packLimitLabel(pack.limit), {
                fontFamily: 'sans-serif', fontSize: 20, color: '#a05a30'
            }).setOrigin(0, 0.5));

            const canBuy = save.canBuyPack(pack.id, pack.limit);
            const btnX = W - 160, btnY = y + 40;
            let label: string, fill: number, txtColor: string;
            if (pack.limit === 'monthcard' && save.isMonthCardActive()) {
                label = `續購 ${pack.priceLabel}`; fill = 0xff8830; txtColor = '#1a1612';
            } else if (canBuy) {
                label = `購買 ${pack.priceLabel}`; fill = 0xff8830; txtColor = '#1a1612';
            } else {
                label = pack.limit === 'once' ? '已購買' : '已達上限'; fill = 0x3a3028; txtColor = '#7a6a5a';
            }
            const buyable = canBuy || (pack.limit === 'monthcard');
            const btn = this.add.rectangle(btnX, btnY, 280, 70, fill, 1).setStrokeStyle(3, buyable ? 0x1a1612 : 0x5a4a38);
            layer.add(btn);
            layer.add(this.add.text(btnX, btnY, label, {
                fontFamily: 'sans-serif', fontSize: 26, color: txtColor, fontStyle: 'bold'
            }).setOrigin(0.5));
            if (buyable) {
                btn.setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => this.buyPack(pack));
            }
        });
        return 40 + GIFT_PACKS.length * rowH + 40;
    }

    private renderTopups(layer: Phaser.GameObjects.Container): number {
        const rowH = 128;
        layer.add(this.add.text(W / 2, 24, '※ 模擬儲值 · 不接真實金流 · 按下直接入帳', {
            fontFamily: 'sans-serif', fontSize: 20, color: '#6a5a4a'
        }).setOrigin(0.5));
        TOPUP_TIERS.forEach((tier, i) => {
            const y = 90 + i * rowH;
            layer.add(this.add.rectangle(W / 2, y, W - 80, rowH - 16, 0x2a2520, 0.95).setStrokeStyle(3, 0x7fd8ff, 0.85));
            layer.add(this.add.text(80, y - 18, `💎 ${tier.crystal} 廢土晶體`, {
                fontFamily: 'monospace', fontSize: 34, color: '#7fd8ff', fontStyle: 'bold'
            }).setOrigin(0, 0.5));
            if (tier.bonusPct > 0) {
                layer.add(this.add.text(80, y + 26, `加贈 +${Math.round(tier.bonusPct * 100)}%`, {
                    fontFamily: 'sans-serif', fontSize: 22, color: '#7a9a5a', fontStyle: 'bold'
                }).setOrigin(0, 0.5));
            }
            const btnX = W - 160;
            const btn = this.add.rectangle(btnX, y, 260, 80, 0xff8830, 1).setStrokeStyle(3, 0x1a1612);
            layer.add(btn);
            layer.add(this.add.text(btnX, y, tier.priceLabel, {
                fontFamily: 'sans-serif', fontSize: 32, color: '#1a1612', fontStyle: 'bold'
            }).setOrigin(0.5));
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => this.buyTopup(tier));
        });
        return 90 + TOPUP_TIERS.length * rowH + 40;
    }

    private buySkin(skin: SkinConfig) {
        const save = SaveService.instance;
        const price = skinPrice(skin);
        if (price.currency === 'crystal') {
            if (!save.spendCrystal(price.amount)) { this.flashMsg('💎 晶體不足,請至儲值', 0x8b3a1f); return; }
        } else {
            if (!save.spendGold(price.amount)) { this.flashMsg('💰 金幣不足', 0x8b3a1f); return; }
        }
        save.addSkin(skin.id);
        save.equipSkin(skin.slot, skin.id);
        save.save();
        this.refreshCurrency();
        this.renderList();
        this.flashMsg(`入手 ${skin.nameZH}`, 0x4a5d3a);
    }

    private equipSkin(skin: SkinConfig) {
        const save = SaveService.instance;
        save.equipSkin(skin.slot, skin.id);
        save.save();
        this.renderList();
        this.flashMsg(`裝備 ${skin.nameZH}`, 0x8b6020);
    }

    private buyPack(pack: PackConfig) {
        const save = SaveService.instance;
        if (!save.canBuyPack(pack.id, pack.limit)) { this.flashMsg('此禮包已達購買上限', 0x8b3a1f); return; }
        const r = pack.reward;
        if (r.crystal) save.addCrystal(r.crystal);
        if (r.gold) save.addGold(r.gold);
        if (r.materials) save.addMaterial('strengthen_stone', r.materials);
        if (r.skinId) save.addSkin(r.skinId);
        if (r.monthCardDays) save.extendMonthCard(r.monthCardDays);
        save.recordPackPurchase(pack.id);
        save.save();
        this.refreshCurrency();
        this.renderList();
        this.flashMsg(`已開啟 ${pack.nameZH}`, 0x4a5d3a);
    }

    private buyTopup(tier: TopupTier) {
        const save = SaveService.instance;
        save.addCrystal(tier.crystal);
        save.save();
        this.refreshCurrency();
        this.flashMsg(`💎 +${tier.crystal} 廢土晶體(模擬)`, 0x4a5d3a);
    }

    private drawBackButton() {
        const by = H - 80;
        const bg = this.add.rectangle(W / 2, by, 360, 84, 0xff8830, 1).setStrokeStyle(4, 0x1a1612, 1);
        this.add.text(W / 2, by, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => { this.tweens.add({ targets: bg, scaleX: 0.94, scaleY: 0.94, duration: 80, yoyo: true }); this.close(); });
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }

    private flashMsg(msg: string, color: number) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 44, color: '#ffe0c0', fontStyle: 'bold',
            backgroundColor: '#1a1612', padding: { x: 30, y: 16 }
        }).setOrigin(0.5).setDepth(3000);
        t.setTint(color).setTintMode(1);
        this.tweens.add({ targets: t, alpha: 0, y: t.y - 50, duration: 1000, onComplete: () => t.destroy() });
    }
}
