import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import {
    rollOne, rollTen, GachaResult,
    COST_PER_PULL, COST_TEN_PULL,
    FAMILIAR_POOL, RARITY_COLOR, RARITY_LABEL
} from '../services/GachaService';

const W = 1080;
const H = 1920;

// Phase 4a-20 抽卡 banner UI
export class Gacha extends Scene {
    constructor() { super('Gacha'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 0.95).setOrigin(0, 0);

        // Title
        this.add.text(W / 2, 80, '🎰 廢墟同盟 招募', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);

        // 鑽石(暫用金幣)+ pity
        const save = SaveService.instance.get();
        this.add.text(W / 2, 150, `💰 ${save.gold}  |  自上次 SSR:${save.gachaPullsSinceSSR}  |  總抽:${save.gachaTotalPulls}`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe0c0'
        }).setOrigin(0.5);

        // 機率公開(per 法規強制)
        this.add.text(W / 2, 200, '機率:UR 1% / SSR 5% / SR 19% / R 75%  (50抽後 SSR↑,80抽必 SSR+)', {
            fontFamily: 'monospace', fontSize: 16, color: '#a05a30'
        }).setOrigin(0.5);

        // 收藏進度
        const owned = SaveService.instance.getCollectionCount();
        this.add.text(W / 2, 240, `收藏:${owned} / ${FAMILIAR_POOL.length}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#b08850'
        }).setOrigin(0.5);

        // 抽卡 button
        this.makePullButton(W / 2 - 200, H / 2 - 100, '🎴 單抽', COST_PER_PULL, () => this.doPull(1));
        this.makePullButton(W / 2 + 200, H / 2 - 100, '🎴 十連', COST_TEN_PULL, () => this.doPull(10));

        // 返回 button
        const back = this.add.text(W / 2, H - 130, '◀ 返回戰鬥', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 50, y: 22 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.closeGacha());

        this.input.keyboard?.on('keydown-ESC', () => this.closeGacha());
        this.input.keyboard?.on('keydown-G', () => this.closeGacha());
    }

    private makePullButton(x: number, y: number, label: string, cost: number, onClick: () => void) {
        const c = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 300, 160, 0xff8830, 0.85).setStrokeStyle(3, 0xffe0c0);
        const txt1 = this.add.text(0, -30, label, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        const txt2 = this.add.text(0, 30, `💰 ${cost}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#1a1612'
        }).setOrigin(0.5);
        c.add([bg, txt1, txt2]);
        c.setSize(300, 160);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', onClick);
    }

    private doPull(times: number) {
        const cost = times === 1 ? COST_PER_PULL : COST_TEN_PULL;
        const save = SaveService.instance;
        if (!save.spendGold(cost)) {
            this.flashMsg('💰 金幣不足');
            return;
        }
        const pity = save.getGachaPity();
        const results: GachaResult[] = times === 1 ? [rollOne(pity)] : rollTen(pity);
        save.setGachaPity(pity.pullsSinceSSR);
        save.addGachaPulls(times);
        for (const r of results) save.addFamiliar(r.familiar.id);
        save.save();
        this.showResults(results);
    }

    private showResults(results: GachaResult[]) {
        // 蒙層 — 接住 pointer 避免穿透到後面 pull button(per Codex review)
        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0, 0).setDepth(2000);
        overlay.setInteractive();

        // grid layout(10 連 = 2 row × 5 col,1 抽 = 1 個)
        const cols = results.length === 1 ? 1 : 5;
        const rows = Math.ceil(results.length / cols);
        const cardW = results.length === 1 ? 400 : 180;
        const cardH = results.length === 1 ? 500 : 220;
        const gap = 16;
        const totalW = cols * cardW + (cols - 1) * gap;
        const totalH = rows * cardH + (rows - 1) * gap;
        const startX = (W - totalW) / 2 + cardW / 2;
        const startY = (H - totalH) / 2 + cardH / 2;

        const cardObjs: Phaser.GameObjects.GameObject[] = [];

        results.forEach((r, i) => {
            const cx = startX + (i % cols) * (cardW + gap);
            const cy = startY + Math.floor(i / cols) * (cardH + gap);
            const color = RARITY_COLOR[r.rarity];
            const bg = this.add.rectangle(cx, cy, cardW, cardH, color, 0.25)
                .setStrokeStyle(4, color, 1).setDepth(2001);
            const sprite = this.add.image(cx, cy - 30, r.familiar.spriteKey)
                .setScale(results.length === 1 ? 0.5 : 0.18).setDepth(2002);
            const rarLabel = this.add.text(cx, cy + cardH / 2 - 60, RARITY_LABEL[r.rarity], {
                fontFamily: 'sans-serif', fontSize: results.length === 1 ? 36 : 22,
                color: '#ffffff', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 4
            }).setOrigin(0.5).setDepth(2003);
            const nameText = this.add.text(cx, cy + cardH / 2 - 24, r.familiar.nameZH, {
                fontFamily: 'monospace', fontSize: results.length === 1 ? 22 : 14,
                color: '#ffe0c0', align: 'center', wordWrap: { width: cardW - 10 }
            }).setOrigin(0.5).setDepth(2003);
            cardObjs.push(bg, sprite, rarLabel, nameText);
        });

        // 關閉 button
        const closeBtn = this.add.text(W / 2, H - 100, '繼續抽卡', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 40, y: 18 }
        }).setOrigin(0.5).setDepth(2003).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => {
            [overlay, closeBtn, ...cardObjs].forEach(o => o.destroy());
            this.scene.restart(); // refresh top UI(金幣 / 收藏進度)
        });
    }

    private closeGacha() {
        this.scene.resume('Game');
        this.scene.stop();
    }

    private flashMsg(msg: string) {
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
