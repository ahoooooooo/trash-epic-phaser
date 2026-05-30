import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { getWeapon, effectiveDamage, enhanceCost } from '../services/WeaponService';
import {
    ArmorDef, EquipSlot, equipSlotLabel,
    armorSlotForEquipSlot, armorDisplayName, armorRarityColor
} from '../services/ArmorService';

const W = 1080;
const H = 1920;

// Phase 4c-E 裝備頁 paper doll:角色置中 + 周圍 7 裝備框,點框列該部位防具一鍵裝/卸
// per user 2026-05-29「角色 skin 中間 + 周圍裝備框,點框出現倉庫對應部位裝備一鍵裝上」
interface SlotPos { slot: EquipSlot; x: number; y: number; }

const FRAME = 150;
// 左欄(頭/胸/腕)+ 右欄(腿/靴/飾I/飾II),角色置中
const SLOT_LAYOUT: SlotPos[] = [
    { slot: 'helmet', x: 200, y: 470 },
    { slot: 'chest', x: 200, y: 660 },
    { slot: 'bracers', x: 200, y: 850 },
    { slot: 'legs', x: W - 200, y: 470 },
    { slot: 'boots', x: W - 200, y: 660 },
    { slot: 'accessory1', x: W - 200, y: 850 },
    { slot: 'accessory2', x: W - 200, y: 1040 }
];

export class Inventory extends Scene {
    private pickerLayer?: Phaser.GameObjects.Container;

    constructor() { super('Inventory'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.96).setOrigin(0, 0);

        this.add.text(W / 2, 84, '◤  裝備  ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        this.drawPaperDoll();
        this.drawSummary();

        this.drawBackButton();
        this.input.keyboard?.on('keydown-ESC', () => this.closeInventory());
        this.input.keyboard?.on('keydown-I', () => this.closeInventory());
    }

    // ── 角色 skin 置中 + 周圍裝備框 ──
    private drawPaperDoll() {
        // 角色 skin(複用 player_idle texture,鎖固定顯示高度)
        const doll = this.add.sprite(W / 2, 700, 'player_idle');
        if (doll.height > 0) doll.setScale(520 / doll.height);

        for (const sp of SLOT_LAYOUT) {
            this.drawEquipFrame(sp);
        }
    }

    private equippedDef(slot: EquipSlot): ArmorDef | null {
        const wid = SaveService.instance.getEquippedArmorId(slot);
        if (!wid) return null;
        const entry = SaveService.instance.getOwnedArmor().find(o => o.id === wid);
        if (!entry) return null;
        try { return JSON.parse(entry.data) as ArmorDef; } catch { return null; }
    }

    private drawEquipFrame(sp: SlotPos) {
        const eq = this.equippedDef(sp.slot);
        const border = eq ? armorRarityColor(eq.tier) : 0x8b6020;
        const frame = this.add.rectangle(sp.x, sp.y, FRAME, FRAME, 0x2a2520, 0.95)
            .setStrokeStyle(eq ? 4 : 2, border, eq ? 1 : 0.8);
        this.drawRivets(sp.x, sp.y, FRAME, FRAME);

        // 部位名(框上緣)
        this.add.text(sp.x, sp.y - FRAME / 2 - 18, equipSlotLabel(sp.slot), {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30', fontStyle: 'bold'
        }).setOrigin(0.5);

        if (eq) {
            this.add.text(sp.x, sp.y - 16, armorDisplayName(eq), {
                fontFamily: 'sans-serif', fontSize: 18, color: '#ffe0c0',
                align: 'center', wordWrap: { width: FRAME - 16 }
            }).setOrigin(0.5);
            this.add.text(sp.x, sp.y + 38, `防 ${eq.defense}  [${eq.tier}]`, {
                fontFamily: 'monospace', fontSize: 18, color: '#ffe060', fontStyle: 'bold'
            }).setOrigin(0.5);
        } else {
            this.add.text(sp.x, sp.y, '空', {
                fontFamily: 'sans-serif', fontSize: 30, color: '#6a5a4a'
            }).setOrigin(0.5);
        }

        frame.setInteractive({ useHandCursor: true });
        frame.on('pointerdown', () => {
            this.tweens.add({ targets: frame, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true });
            this.openSlotPicker(sp.slot);
        });
    }

    // ── 點裝備框 → 列出該部位倉庫防具,一鍵裝 / 卸 ──
    private openSlotPicker(slot: EquipSlot) {
        if (this.pickerLayer) this.pickerLayer.destroy();
        const layer = this.add.container(0, 0).setDepth(2000);
        this.pickerLayer = layer;

        const bg = this.add.rectangle(0, 0, W, H, 0x120c0a, 0.92).setOrigin(0, 0)
            .setInteractive();
        bg.on('pointerdown', () => this.closePicker());
        layer.add(bg);

        const wantSlot = armorSlotForEquipSlot(slot);
        const matches = SaveService.instance.getOwnedArmor()
            .map(o => { try { return { id: o.id, def: JSON.parse(o.data) as ArmorDef }; } catch { return null; } })
            .filter((x): x is { id: string; def: ArmorDef } => !!x && x.def.slot === wantSlot)
            .sort((a, b) => b.def.defense - a.def.defense);

        const panel = this.add.rectangle(W / 2, H / 2, W - 100, H - 360, 0x2a2520, 0.98)
            .setStrokeStyle(4, 0xff8830, 1).setInteractive(); // 吸收點擊,避免穿透 bg 關閉
        layer.add(panel);
        const title = this.add.text(W / 2, 320, `選擇 ${equipSlotLabel(slot)}`, {
            fontFamily: 'sans-serif', fontSize: 42, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5);
        layer.add(title);

        let rowY = 430;
        // 卸下(若已裝)
        if (SaveService.instance.getEquippedArmorId(slot)) {
            this.addPickerRow(layer, rowY, '✕ 卸下', '#ff6040', () => {
                SaveService.instance.unequipArmor(slot);
                SaveService.instance.save();
                this.refreshAfterEquip();
            });
            rowY += 110;
        }

        if (matches.length === 0) {
            const t = this.add.text(W / 2, rowY + 40, '倉庫沒有此部位防具\n打怪掉落取得', {
                fontFamily: 'sans-serif', fontSize: 26, color: '#6a5a4a', align: 'center'
            }).setOrigin(0.5);
            layer.add(t);
        } else {
            // 上限顯示 8 件(避免溢出),已按防禦排序
            const shown = matches.slice(0, 8);
            for (const m of shown) {
                const label = `${armorDisplayName(m.def)}  防${m.def.defense} [${m.def.tier}]`;
                const color = '#ffe0c0';
                this.addPickerRow(layer, rowY, label, color, () => {
                    SaveService.instance.equipArmor(slot, m.id);
                    SaveService.instance.save();
                    this.refreshAfterEquip();
                }, armorRarityColor(m.def.tier));
                rowY += 110;
            }
            if (matches.length > shown.length) {
                const more = this.add.text(W / 2, rowY + 10, `…還有 ${matches.length - shown.length} 件(防禦較低)`, {
                    fontFamily: 'sans-serif', fontSize: 20, color: '#6a5a4a'
                }).setOrigin(0.5);
                layer.add(more);
                rowY += 60;
            }
        }

        // 關閉
        const closeBtn = this.add.rectangle(W / 2, H - 230, 300, 80, 0x8b6020, 1)
            .setStrokeStyle(3, 0x1a1612).setInteractive({ useHandCursor: true });
        const closeT = this.add.text(W / 2, H - 230, '關閉', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        closeBtn.on('pointerdown', () => this.closePicker());
        layer.add(closeBtn);
        layer.add(closeT);
    }

    private addPickerRow(layer: Phaser.GameObjects.Container, y: number, text: string,
                         color: string, onTap: () => void, borderColor = 0x8b6020) {
        const row = this.add.rectangle(W / 2, y, W - 180, 92, 0x1a1612, 0.95)
            .setStrokeStyle(3, borderColor, 0.95).setInteractive({ useHandCursor: true });
        const t = this.add.text(W / 2, y, text, {
            fontFamily: 'sans-serif', fontSize: 26, color, fontStyle: 'bold',
            align: 'center', wordWrap: { width: W - 220 }
        }).setOrigin(0.5);
        row.on('pointerdown', () => {
            this.tweens.add({ targets: row, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true });
            onTap();
        });
        layer.add(row);
        layer.add(t);
    }

    private closePicker() {
        if (this.pickerLayer) { this.pickerLayer.destroy(); this.pickerLayer = undefined; }
    }

    // 裝/卸後重建整頁(最簡:重啟 scene 不行會閃,改重繪 — 直接 restart 場景)
    private refreshAfterEquip() {
        this.closePicker();
        this.scene.restart();
    }

    // ── 武器 + 總防禦摘要 ──
    private drawSummary() {
        const save = SaveService.instance.get();
        const w = getWeapon(save.currentWeaponId);
        const enh = SaveService.instance.getWeaponEnh(w.id);
        const dmg = effectiveDamage(w, enh);
        const totalDef = SaveService.instance.getTotalArmorDefense();

        const top = H - 430;
        const h = 200;
        this.add.rectangle(W / 2, top + h / 2, W - 120, h, 0x2a2520, 0.92)
            .setStrokeStyle(3, 0xa05a30, 0.9);
        this.drawRivets(W / 2, top + h / 2, W - 120, h);

        const nameSuffix = enh > 0 ? ` +${enh}` : '';
        this.add.text(W / 2, top + 40, `⚔ ${w.nameZH}${nameSuffix}`, {
            fontFamily: 'sans-serif', fontSize: 30, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);

        this.drawSummaryChip(W / 2 - 200, top + 130, '攻擊', `${dmg}`, '#ffe060');
        this.drawSummaryChip(W / 2, top + 130, '總防禦', `${totalDef}`, '#80c0ff');
        this.drawSummaryChip(W / 2 + 200, top + 130, 'Lv', `${save.level}`, '#ffe0c0');

        this.drawEnhanceButton();
    }

    // 武器強化按鈕(花金幣 +1,無上限,成功 restart 重繪;不足彈訊息)
    private drawEnhanceButton() {
        const save = SaveService.instance;
        const wid = save.getCurrentWeaponId();
        const enh = save.getWeaponEnh(wid);
        const cost = enhanceCost(enh);
        const gold = save.get().gold;
        const can = gold >= cost;
        const by = H - 205;
        const bg = this.add.rectangle(W / 2, by, 470, 56, can ? 0xff8830 : 0x2a2520, 1)
            .setStrokeStyle(3, can ? 0x1a1612 : 0x5a4a38, 1)
            .setInteractive({ useHandCursor: true });
        this.add.text(W / 2, by - 12, `⚒ 強化武器  +${enh} → +${enh + 1}`, {
            fontFamily: 'sans-serif', fontSize: 26, color: can ? '#1a1612' : '#8a7a68', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(W / 2, by + 16, `花費 ${cost} 金  (持有 ${gold})`, {
            fontFamily: 'monospace', fontSize: 20, color: can ? '#1a1612' : '#8a7a68'
        }).setOrigin(0.5);
        bg.on('pointerdown', () => {
            const s = SaveService.instance;
            const id = s.getCurrentWeaponId();
            const c = enhanceCost(s.getWeaponEnh(id));
            if (s.spendGold(c)) {
                s.addWeaponEnh(id);
                s.save();
                this.scene.restart();   // 重繪:武器 +N / 攻擊上升 / 新花費
            } else {
                this.flashMsg('金幣不足', '#c23a1a');
            }
        });
    }

    private flashMsg(msg: string, color: string) {
        const t = this.add.text(W / 2, H / 2 - 100, msg, {
            fontFamily: 'sans-serif', fontSize: 44, color, fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5).setDepth(3000);
        this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }

    private drawSummaryChip(cx: number, cy: number, label: string, value: string, vColor: string) {
        this.add.rectangle(cx, cy, 180, 84, 0x1a1612, 0.85)
            .setStrokeStyle(2, 0x8b6020, 0.9);
        this.add.text(cx, cy - 18, label, {
            fontFamily: 'sans-serif', fontSize: 20, color: '#a05a30'
        }).setOrigin(0.5);
        this.add.text(cx, cy + 16, value, {
            fontFamily: 'monospace', fontSize: 34, color: vColor, fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private drawRivets(cx: number, cy: number, w: number, h: number) {
        const hx = w / 2 - 14;
        const hy = h / 2 - 14;
        [[-hx, -hy], [hx, -hy], [-hx, hy], [hx, hy]].forEach(([dx, dy]) => {
            this.add.circle(cx + dx, cy + dy, 5, 0x4a3a30).setStrokeStyle(1, 0x1a1612);
        });
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
            this.closeInventory();
        });
    }

    private closeInventory() {
        const gameScene = this.scene.get('Game') as Phaser.Scene & { refreshWeaponText?: () => void };
        if (gameScene.refreshWeaponText) gameScene.refreshWeaponText();
        this.scene.resume('Game');
        this.scene.stop();
    }
}
