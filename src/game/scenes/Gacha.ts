import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import {
    rollOne, rollTen, GachaResult, Rarity,
    COST_PER_PULL, COST_TEN_PULL,
    FAMILIAR_POOL, RARITY_LABEL
} from '../services/GachaService';

const W = 1080;
const H = 1920;

// 廢土稀有度視覺語言(只動視覺,不動 GachaService roll logic)
// R 鏽橙 / SR 紫 / SSR 金 / UR 金光爆
const TIER_COLOR: Record<Rarity, number> = {
    R:   0xa05a30,  // 鏽橙
    SR:  0xc060ff,  // 紫
    SSR: 0xffc040,  // 金
    UR:  0xffd040   // 金(光爆另加)
};

// glow halo 半徑倍率 / 光暈強度
const TIER_GLOW_ALPHA: Record<Rarity, number> = {
    R: 0.18, SR: 0.3, SSR: 0.45, UR: 0.6
};

// Phase 4a-20 抽卡 banner UI(Phase 4b-17 視覺升級)
// 14 隻立繪檔名(Phase 4c-11:從 Preloader 移來,只在開抽卡時 lazy-load 省開機 28MB)
const FAM_FILES: Record<string, string> = {
    fam_pip: 'familiar_r_scavver_kid_pip',
    fam_mira: 'familiar_r_gather_rat_mira',
    fam_grub: 'familiar_r_goblin_underling_grub',
    fam_zix: 'familiar_r_pickpocket_goblin_zix',
    fam_neek: 'familiar_r_oilamp_lighter_neek',
    fam_dorl: 'familiar_r_pot_dishwasher_dorl',
    fam_fire_imp: 'familiar_sr_fire_imp',
    fam_ironguard: 'familiar_sr_ironguard_portrait',
    fam_frost_witch: 'familiar_sr_frost_tongue_witch',
    fam_axe_brothers: 'familiar_sr_axe_brothers',
    fam_blackmarket_fox: 'familiar_ssr_blackmarket_fox',
    fam_wasteland_prophet: 'familiar_ssr_wasteland_prophet',
    fam_shadow_hunter: 'familiar_ssr_shadow_hunter_portrait',
    fam_appraisal_queen: 'familiar_ur_appraisal_queen'
};

// Phase 4a-20 抽卡 banner UI(Phase 4b-17 視覺升級)
export class Gacha extends Scene {
    constructor() { super('Gacha'); }

    init() {
        // preload 期間(首次開抽卡 lazy-load 立繪)的載入提示,避免黑屏
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x1a1612, 1).setOrigin(0, 0);
        this.add.text(W / 2, H / 2, '招募名冊載入中…', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    preload() {
        // 立繪只在尚未載入時抓(Phaser 已快取則秒過)
        this.load.setPath('assets');
        for (const key in FAM_FILES) {
            if (!this.textures.exists(key)) this.load.image(key, `familiars/${FAM_FILES[key]}.png`);
        }
    }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');

        // 廢土底:炭黑(不透明,避免底層 scene 透出)+ 暗角 vignette
        this.add.rectangle(0, 0, W, H, 0x1a1612, 1).setOrigin(0, 0);
        this.addVignette();

        const save = SaveService.instance.get();

        // ── 頂部 header panel ──
        const headerPanel = this.add.rectangle(W / 2, 150, W - 80, 220, 0x2a2520, 0.92)
            .setStrokeStyle(3, 0xa05a30, 0.9);
        this.addRivets(headerPanel.x, headerPanel.y, headerPanel.width, headerPanel.height);

        // Title
        this.add.text(W / 2, 80, '◤ 廢墟同盟 招募 ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#b08850', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 8
        }).setOrigin(0.5);

        // 金幣 + pity 一行(數字鏽金)
        this.add.text(W / 2, 150, `素材 ${save.gold}`, {
            fontFamily: 'monospace', fontSize: 30, color: '#ffe060', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(W / 2, 195, `自上次 SSR ${save.gachaPullsSinceSSR}   ·   總招募 ${save.gachaTotalPulls}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#a05a30'
        }).setOrigin(0.5);

        // 收藏進度
        const owned = SaveService.instance.getCollectionCount();
        this.add.text(W / 2, 232, `圖鑑收藏  ${owned} / ${FAMILIAR_POOL.length}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#b08850'
        }).setOrigin(0.5);

        // ── 機率公開 panel(法規強制,排版美化）──
        const ratePanel = this.add.rectangle(W / 2, 320, W - 120, 110, 0x2a2520, 0.85)
            .setStrokeStyle(2, 0x8b6020, 0.7);
        this.add.text(W / 2, 290, '招募機率公示', {
            fontFamily: 'sans-serif', fontSize: 20, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(W / 2, 322, 'UR 1%   ·   SSR 5%   ·   SR 19%   ·   R 75%', {
            fontFamily: 'monospace', fontSize: 20, color: '#ffe0c0'
        }).setOrigin(0.5);
        this.add.text(W / 2, 350, '50 招募後 SSR 機率漸升,80 招募保底 SSR 以上', {
            fontFamily: 'monospace', fontSize: 16, color: '#a05a30'
        }).setOrigin(0.5);
        void ratePanel;

        // ── 抽卡 button(鏽板 CTA)──
        this.makePullButton(W / 2 - 200, H / 2 + 80, '單次招募', COST_PER_PULL, () => this.doPull(1));
        this.makePullButton(W / 2 + 200, H / 2 + 80, '十次招募', COST_TEN_PULL, () => this.doPull(10), true);

        // ── 返回 button(次按鈕)──
        this.makeBackButton(W / 2, H - 130, '◀ 返回戰鬥', () => this.closeGacha());

        this.input.keyboard?.on('keydown-ESC', () => this.closeGacha());
        this.input.keyboard?.on('keydown-G', () => this.closeGacha());
    }

    private addVignette() {
        // 四邊暗角:用半透明黑長條暗示 vignette(廉價但有氛圍)
        const dark = 0x000000;
        this.add.rectangle(W / 2, 0, W, 220, dark, 0.4).setOrigin(0.5, 0);
        this.add.rectangle(W / 2, H, W, 260, dark, 0.45).setOrigin(0.5, 1);
        this.add.rectangle(0, H / 2, 100, H, dark, 0.28).setOrigin(0, 0.5);
        this.add.rectangle(W, H / 2, 100, H, dark, 0.28).setOrigin(1, 0.5);
    }

    private addRivets(cx: number, cy: number, w: number, h: number, depth = 0) {
        const inset = 22;
        const corners: [number, number][] = [
            [cx - w / 2 + inset, cy - h / 2 + inset],
            [cx + w / 2 - inset, cy - h / 2 + inset],
            [cx - w / 2 + inset, cy + h / 2 - inset],
            [cx + w / 2 - inset, cy + h / 2 - inset]
        ];
        for (const [rx, ry] of corners) {
            this.add.circle(rx, ry, 5, 0x4a3a30).setStrokeStyle(1, 0x1a1612).setDepth(depth);
        }
    }

    private makePullButton(x: number, y: number, label: string, cost: number, onClick: () => void, hot = false) {
        const c = this.add.container(x, y);
        const baseColor = hot ? 0xff8830 : 0xb08850;
        const bg = this.add.rectangle(0, 0, 300, 170, baseColor, 0.95)
            .setStrokeStyle(4, 0x1a1612, 1);
        const inner = this.add.rectangle(0, 0, 290, 160, 0x000000, 0)
            .setStrokeStyle(2, 0xffe0c0, 0.4);
        const txt1 = this.add.text(0, -34, label, {
            fontFamily: 'sans-serif', fontSize: 40, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        const div = this.add.rectangle(0, 4, 200, 2, 0x1a1612, 0.5);
        const txt2 = this.add.text(0, 36, `素材 ${cost}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        c.add([bg, inner, txt1, div, txt2]);
        c.setSize(300, 170);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => {
            this.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
            onClick();
        });
    }

    private makeBackButton(x: number, y: number, label: string, onClick: () => void) {
        const c = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 320, 76, 0x2a2520, 0.95)
            .setStrokeStyle(3, 0xa05a30, 0.9);
        const txt = this.add.text(0, 0, label, {
            fontFamily: 'sans-serif', fontSize: 40, color: '#a05a30', fontStyle: 'bold'
        }).setOrigin(0.5);
        c.add([bg, txt]);
        c.setSize(320, 76);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => {
            this.tweens.add({ targets: c, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
            onClick();
        });
    }

    private doPull(times: number) {
        const cost = times === 1 ? COST_PER_PULL : COST_TEN_PULL;
        const save = SaveService.instance;
        if (!save.spendGold(cost)) {
            this.flashMsg('素材不足');
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
        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0, 0).setDepth(2000);
        overlay.setInteractive();

        // 最高稀有度決定全屏氛圍(UR/SSR 金光爆)
        const order: Record<Rarity, number> = { R: 0, SR: 1, SSR: 2, UR: 3 };
        let best: Rarity = 'R';
        for (const r of results) if (order[r.rarity] > order[best]) best = r.rarity;

        const burstObjs: Phaser.GameObjects.GameObject[] = [];
        if (best === 'SSR' || best === 'UR') {
            const burst = this.add.rectangle(W / 2, H / 2, W, H, TIER_COLOR[best], 0)
                .setDepth(2000);
            this.tweens.add({
                targets: burst, alpha: best === 'UR' ? 0.28 : 0.16,
                duration: 240, yoyo: true, hold: 120
            });
            burstObjs.push(burst);
        }

        // grid layout(10 連 = 2 row × 5 col,1 抽 = 1 個)
        const cols = results.length === 1 ? 1 : 5;
        const rows = Math.ceil(results.length / cols);
        const cardW = results.length === 1 ? 420 : 184;
        const cardH = results.length === 1 ? 520 : 230;
        const gap = 16;
        const totalW = cols * cardW + (cols - 1) * gap;
        const totalH = rows * cardH + (rows - 1) * gap;
        const startX = (W - totalW) / 2 + cardW / 2;
        const startY = (H - totalH) / 2 + cardH / 2;
        const single = results.length === 1;

        const cardObjs: Phaser.GameObjects.GameObject[] = [];

        results.forEach((r, i) => {
            const cx = startX + (i % cols) * (cardW + gap);
            const cy = startY + Math.floor(i / cols) * (cardH + gap);
            const tier = TIER_COLOR[r.rarity];

            // tier glow halo（卡後光暈)
            const glow = this.add.rectangle(cx, cy, cardW + 24, cardH + 24, tier, TIER_GLOW_ALPHA[r.rarity])
                .setDepth(2001);

            // 鏽板卡底
            const bg = this.add.rectangle(cx, cy, cardW, cardH, 0x2a2520, 0.96)
                .setStrokeStyle(single ? 6 : 4, tier, 1).setDepth(2002);

            // 頂部 tier 色條
            const topBar = this.add.rectangle(cx, cy - cardH / 2 + (single ? 6 : 4), cardW - 8, single ? 12 : 8, tier, 0.9)
                .setDepth(2003);

            // tier label(用 tier 色,不再純白)
            const rarLabel = this.add.text(cx, cy + cardH / 2 - (single ? 70 : 52), RARITY_LABEL[r.rarity], {
                fontFamily: 'sans-serif', fontSize: single ? 44 : 26,
                color: this.hex(tier), fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: single ? 6 : 4
            }).setOrigin(0.5).setDepth(2004);

            // 名稱(米色)
            const nameText = this.add.text(cx, cy + cardH / 2 - (single ? 28 : 22), r.familiar.nameZH, {
                fontFamily: 'sans-serif', fontSize: single ? 24 : 15,
                color: '#ffe0c0', align: 'center', wordWrap: { width: cardW - 16 }
            }).setOrigin(0.5).setDepth(2004);

            cardObjs.push(glow, bg, topBar, rarLabel, nameText);

            // 翻牌進場:scale 0.2 → final,依序錯開
            const delay = i * (single ? 0 : 55);
            const unitTargets: Phaser.GameObjects.GameObject[] = [glow, bg, topBar, rarLabel, nameText];

            // 角色 sprite — 4G 逾時掉圖 guard:有貼圖才畫立繪;缺圖用 rarity 色塊 + ? placeholder(不綠框、不擋夥伴發放)
            const spriteScale = single ? 0.55 : 0.2;
            if (this.textures.exists(r.familiar.spriteKey)) {
                const sprite = this.add.image(cx, cy - (single ? 50 : 36), r.familiar.spriteKey)
                    .setScale(spriteScale * 0.2).setDepth(2003);
                cardObjs.push(sprite);
                this.tweens.add({
                    targets: sprite, scaleX: spriteScale, scaleY: spriteScale,
                    delay, duration: 280, ease: 'Back.easeOut'
                });
            } else {
                const ph = this.add.rectangle(cx, cy - (single ? 50 : 36), single ? 200 : 84, single ? 280 : 116, tier, 0.22)
                    .setStrokeStyle(3, tier, 0.85).setDepth(2003);
                const q = this.add.text(cx, cy - (single ? 50 : 36), '?', {
                    fontFamily: 'sans-serif', fontSize: single ? 96 : 42, color: this.hex(tier), fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(2004);
                cardObjs.push(ph, q);
                unitTargets.push(ph, q);
            }

            for (const o of unitTargets) {
                (o as unknown as { setScale: (n: number) => void }).setScale(0.2);
            }
            this.tweens.add({
                targets: unitTargets, scaleX: 1, scaleY: 1,
                delay, duration: 280, ease: 'Back.easeOut'
            });

            // SSR/UR 卡:光暈呼吸閃
            if (r.rarity === 'SSR' || r.rarity === 'UR') {
                this.tweens.add({
                    targets: glow, alpha: TIER_GLOW_ALPHA[r.rarity] + 0.2,
                    duration: 600, yoyo: true, repeat: -1
                });
            }
        });

        // 關閉 button
        const closeC = this.add.container(W / 2, H - 100).setDepth(2004);
        const closeBg = this.add.rectangle(0, 0, 300, 72, 0xff8830, 0.95)
            .setStrokeStyle(4, 0x1a1612, 1);
        const closeTxt = this.add.text(0, 0, '繼續招募', {
            fontFamily: 'sans-serif', fontSize: 38, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        closeC.add([closeBg, closeTxt]);
        closeC.setSize(300, 72);
        closeC.setInteractive({ useHandCursor: true });
        closeC.on('pointerdown', () => {
            [overlay, closeC, ...burstObjs, ...cardObjs].forEach(o => o.destroy());
            this.scene.restart(); // refresh top UI(金幣 / 收藏進度)
        });
    }

    private hex(color: number): string {
        return '#' + color.toString(16).padStart(6, '0');
    }

    private closeGacha() {
        this.scene.resume('Game');
        this.scene.stop();
    }

    private flashMsg(msg: string) {
        const t = this.add.text(W / 2, H / 2, msg, {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6,
            backgroundColor: '#1a1612', padding: { x: 30, y: 16 }
        }).setOrigin(0.5).setDepth(3000);
        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50, duration: 800,
            onComplete: () => t.destroy()
        });
    }
}
