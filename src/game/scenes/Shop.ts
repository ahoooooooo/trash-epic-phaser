import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { SKINS, skinRarityColor, skinSlotLabel, SkinConfig } from '../services/SkinService';

const W = 1080;
const H = 1920;
const SCROLL_TOP = 200;
const SCROLL_BOTTOM = H - 150;

// Phase 4c-4 商店改賣 skin(純外觀,不給攻防;藥水改各地商販賣)
export class Shop extends Scene {
    private goldDisplay?: Phaser.GameObjects.Text;
    private content?: Phaser.GameObjects.Container;
    private maskGfx?: Phaser.GameObjects.Graphics;
    private scrollMinY = SCROLL_TOP;
    private dragStartY = 0;
    private dragOriginY = SCROLL_TOP;
    private draggingList = false;
    private clampScroll(v: number): number { return Math.max(this.scrollMinY, Math.min(SCROLL_TOP, v)); }

    constructor() { super('Shop'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.97).setOrigin(0, 0);

        this.add.text(W / 2, 70, '◤  外觀商店  ◢', {
            fontFamily: 'sans-serif', fontSize: 52, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);
        this.add.text(W / 2, 124, '純外觀 · 不影響數值 · 藥水請找各地商販', {
            fontFamily: 'sans-serif', fontSize: 20, color: '#6a5a4a'
        }).setOrigin(0.5);
        this.renderGoldText();
        this.renderList();
        // scroll input 只綁一次(操作當前 this.content,避免 renderList 重綁累積)
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

    private renderGoldText() {
        const text = `💰 ${SaveService.instance.get().gold}`;
        if (this.goldDisplay) this.goldDisplay.setText(text);
        else this.goldDisplay = this.add.text(W / 2, 162, text, {
            fontFamily: 'monospace', fontSize: 28, color: '#ffe060', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5);
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
            layer.add(this.add.text(560, y, `💰 ${skin.priceGold}`, {
                fontFamily: 'monospace', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
            }).setOrigin(0, 0.5));

            // 右側狀態按鈕
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
                btn.on('pointerdown', () => owned ? this.equip(skin) : this.buy(skin));
            }
        });

        // 捲動範圍(input handler 在 create() 綁一次,操作 this.content)
        const totalH = 30 + SKINS.length * rowH + 40;
        this.scrollMinY = SCROLL_TOP - Math.max(0, totalH - scrollH);
        layer.y = this.clampScroll(SCROLL_TOP);
    }

    private buy(skin: SkinConfig) {
        const save = SaveService.instance;
        if (!save.spendGold(skin.priceGold)) { this.flashMsg('💰 金幣不足', 0x8b3a1f); return; }
        save.addSkin(skin.id);
        save.equipSkin(skin.slot, skin.id);  // 買了直接裝上
        save.save();
        this.renderGoldText();
        this.renderList();
        this.flashMsg(`入手 ${skin.nameZH}`, 0x4a5d3a);
    }

    private equip(skin: SkinConfig) {
        const save = SaveService.instance;
        save.equipSkin(skin.slot, skin.id);
        save.save();
        this.renderList();
        this.flashMsg(`裝備 ${skin.nameZH}`, 0x8b6020);
    }

    private drawBackButton() {
        const by = H - 90;
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
