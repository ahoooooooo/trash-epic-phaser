import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { formatStat } from '../services/StatFormat';
import {
    rollOne, rollTen, GachaResult, Rarity,
    COST_PER_PULL, COST_TEN_PULL,
    FAMILIAR_POOL, RARITY_LABEL, FamiliarDef
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
    // 追蹤 repeat:-1 tween 避免洩漏
    private loopTweens: Phaser.Tweens.Tween[] = [];

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
        this.loopTweens = [];

        // 廢土底:深炭黑 + 層次感
        this.add.rectangle(0, 0, W, H, 0x100d0a, 1).setOrigin(0, 0);
        this.addVignette();

        // 頂部橙 accent 線
        const topAccent = this.add.rectangle(0, 0, W, 4, 0xff8830, 0.8).setOrigin(0, 0);
        const ta = this.tweens.add({ targets: topAccent, alpha: 0.3, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.loopTweens.push(ta);

        const save = SaveService.instance.get();

        // ── 頂部 header panel — 金屬鏽板質感 ──
        const headerPanel = this.add.rectangle(W / 2, 155, W - 60, 230, 0x1e1a16, 0.97)
            .setStrokeStyle(3, 0xa05a30, 0.9).setAlpha(0);
        // header 上沿亮帶(金屬反光)
        const headerSheen = this.add.rectangle(W / 2, 47, W - 60, 28, 0x3a342c, 0.45).setAlpha(0);
        // header 底部橙分隔線
        const headerDiv = this.add.rectangle(W / 2, 270, W - 60, 2, 0xa05a30, 0.6).setAlpha(0);
        this.addRivets(headerPanel.x, headerPanel.y, headerPanel.width, headerPanel.height);

        // Title — 進場上滑淡入
        const titleTxt = this.add.text(W / 2, 88, '◤ 廢墟同盟 招募 ◢', {
            fontFamily: 'sans-serif', fontSize: 52, color: '#c89050', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0).setY(100);

        // 金幣
        const goldTxt = this.add.text(W / 2, 152, `素材 ${formatStat(save.gold)}`, {
            fontFamily: 'monospace', fontSize: 32, color: '#ffe060', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0);

        const pityTxt = this.add.text(W / 2, 198, `自上次 SSR ${save.gachaPullsSinceSSR}   ·   總招募 ${save.gachaTotalPulls}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#a05a30'
        }).setOrigin(0.5).setAlpha(0);

        // 收藏進度
        const owned = SaveService.instance.getCollectionCount();
        const collTxt = this.add.text(W / 2, 234, `圖鑑收藏  ${owned} / ${FAMILIAR_POOL.length}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#b08850'
        }).setOrigin(0.5).setAlpha(0);

        // header 進場動畫
        this.tweens.add({ targets: [headerPanel, headerSheen, headerDiv], alpha: 1, duration: 280 });
        this.tweens.add({ targets: titleTxt, alpha: 1, y: 88, duration: 300, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: [goldTxt, pityTxt, collTxt], alpha: 1, duration: 260, delay: 120 });

        // ── 機率公開 panel(法規強制)──
        const ratePanel = this.add.rectangle(W / 2, 325, W - 100, 118, 0x221e1a, 0.95)
            .setStrokeStyle(2, 0x6a5020, 0.8).setAlpha(0);
        const rateTitle = this.add.text(W / 2, 293, '招募機率公示', {
            fontFamily: 'sans-serif', fontSize: 20, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);
        const rateTxt = this.add.text(W / 2, 325, 'UR 1%   ·   SSR 5%   ·   SR 19%   ·   R 75%', {
            fontFamily: 'monospace', fontSize: 20, color: '#ffe0c0'
        }).setOrigin(0.5).setAlpha(0);
        const pityHint = this.add.text(W / 2, 354, '50 招募後 SSR 機率漸升,80 招募保底 SSR 以上', {
            fontFamily: 'monospace', fontSize: 16, color: '#8a5a30'
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: [ratePanel, rateTitle, rateTxt, pityHint], alpha: 1, duration: 260, delay: 180 });

        // ── 抽卡 button(鏽板 CTA)— 進場從下滑入 ──
        this.makePullButton(W / 2 - 200, 490, '單次招募', COST_PER_PULL, () => this.doPull(1), false, 260);
        this.makePullButton(W / 2 + 200, 490, '十次招募', COST_TEN_PULL, () => this.doPull(10), true, 340);

        // ── 夥伴出戰 收藏區(已擁有可點選出戰)──
        this.buildRoster();

        // ── 返回 button(次按鈕)──
        this.makeBackButton(W / 2, H - 130, '◀ 返回戰鬥', () => this.closeGacha());

        this.input.keyboard?.on('keydown-ESC', () => this.closeGacha());
        this.input.keyboard?.on('keydown-G', () => this.closeGacha());

        // 確保 shutdown() 在 Phaser scene lifecycle 時被呼叫
        this.events.once('shutdown', this.shutdown, this);
    }

    shutdown() {
        for (const t of this.loopTweens) {
            if (t && t.isPlaying()) t.stop();
        }
        this.loopTweens = [];
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

    private makePullButton(x: number, y: number, label: string, cost: number, onClick: () => void, hot = false, enterDelay = 0) {
        const baseColor = hot ? 0xff8830 : 0x9a7840;
        const hoverColor = hot ? 0xffaa55 : 0xc09a58;
        const c = this.add.container(x, y + 30).setAlpha(0); // 從下方滑入
        const bg = this.add.rectangle(0, 0, 310, 175, baseColor, 0.96)
            .setStrokeStyle(4, 0x1a1612, 1);
        // 金屬上沿反光
        const sheen = this.add.rectangle(0, -175 / 2 + 22, 295, 28, 0xffffff, 0.07).setOrigin(0.5);
        // 內框
        const inner = this.add.rectangle(0, 0, 298, 163, 0x000000, 0)
            .setStrokeStyle(2, 0xffe0c0, hot ? 0.55 : 0.25);
        const txt1 = this.add.text(0, -36, label, {
            fontFamily: 'sans-serif', fontSize: 42, color: '#1a1612', fontStyle: 'bold',
            stroke: '#00000055', strokeThickness: 2
        }).setOrigin(0.5);
        const div = this.add.rectangle(0, 4, 210, 2, 0x1a1612, 0.5);
        const txt2 = this.add.text(0, 38, `素材 ${cost}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        c.add([bg, sheen, inner, txt1, div, txt2]);
        c.setSize(310, 175);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerover', () => { bg.setFillStyle(hoverColor); });
        c.on('pointerout', () => { bg.setFillStyle(baseColor); });
        c.on('pointerdown', () => {
            this.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
            onClick();
        });
        // 進場動畫
        this.tweens.add({ targets: c, alpha: 1, y: y, duration: 300, delay: enterDelay, ease: 'Back.easeOut' });
    }

    private makeBackButton(x: number, y: number, label: string, onClick: () => void) {
        const c = this.add.container(x, y).setAlpha(0);
        const bg = this.add.rectangle(0, 0, 340, 80, 0x221e1a, 0.97)
            .setStrokeStyle(3, 0xa05a30, 0.85);
        const txt = this.add.text(0, 0, label, {
            fontFamily: 'sans-serif', fontSize: 40, color: '#a05a30', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5);
        c.add([bg, txt]);
        c.setSize(340, 80);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerover', () => { bg.setFillStyle(0x3a3028); });
        c.on('pointerout', () => { bg.setFillStyle(0x221e1a); });
        c.on('pointerdown', () => {
            this.tweens.add({ targets: c, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true,
                onComplete: onClick });
        });
        this.tweens.add({ targets: c, alpha: 1, duration: 260, delay: 700 });
    }

    // ── 夥伴出戰收藏區 ──
    private buildRoster() {
        const save = SaveService.instance;
        const activeId = save.getActiveFamiliar();
        const activeDef = activeId ? FAMILIAR_POOL.find(f => f.id === activeId) ?? null : null;

        const panelY = 628;
        const panel = this.add.rectangle(W / 2, panelY, W - 70, 96, 0x201c18, 0.96)
            .setStrokeStyle(3, 0xff8830, 0.85).setAlpha(0);
        // panel 進場
        this.tweens.add({ targets: panel, alpha: 1, duration: 260, delay: 420 });

        const rosterTitle = this.add.text(W / 2, panelY - 24, '◤ 出戰夥伴 ◢', {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0);

        const statusTxt = activeDef
            ? `${activeDef.nameZH}  ·  ${activeDef.effect.label}`
            : '未出戰 — 點下方已擁有夥伴出戰';
        const statusText = this.add.text(W / 2 - 80, panelY + 20, statusTxt, {
            fontFamily: 'monospace', fontSize: 22, color: activeDef ? '#ffe060' : '#a05a30',
            align: 'center', wordWrap: { width: W - 320 }
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: [rosterTitle, statusText], alpha: 1, duration: 260, delay: 480 });

        // 卸下 button(僅在有出戰時可按)
        if (activeDef) {
            const dc = this.add.container(W / 2 + 380, panelY + 18).setAlpha(0);
            const dbg = this.add.rectangle(0, 0, 155, 60, 0x4a3a30, 0.95).setStrokeStyle(2, 0xa05a30, 0.9);
            const dtxt = this.add.text(0, 0, '卸下', {
                fontFamily: 'sans-serif', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5);
            dc.add([dbg, dtxt]);
            dc.setSize(155, 60);
            dc.setInteractive({ useHandCursor: true });
            dc.on('pointerover', () => { dbg.setFillStyle(0x6a5040); });
            dc.on('pointerout', () => { dbg.setFillStyle(0x4a3a30); });
            dc.on('pointerdown', () => {
                this.tweens.add({ targets: dc, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
                this.setActive(null);
            });
            this.tweens.add({ targets: dc, alpha: 1, duration: 260, delay: 480 });
        }

        // 收藏格子標題
        const gridTitle = this.add.text(W / 2, 730, '全部夥伴', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#6a5a4a', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: gridTitle, alpha: 1, duration: 200, delay: 540 });

        // 格子網格:5 col,行依數量。已擁有可點;未擁有 dim + 鎖
        const cols = 5;
        const cellW = 188, cellH = 140, gap = 14;
        const gridW = cols * cellW + (cols - 1) * gap;
        const startX = (W - gridW) / 2 + cellW / 2;
        const startY = 768;

        FAMILIAR_POOL.forEach((fam, i) => {
            const cx = startX + (i % cols) * (cellW + gap);
            const cy = startY + Math.floor(i / cols) * (cellH + gap);
            const rowDelay = 560 + Math.floor(i / cols) * 60 + (i % cols) * 20;
            this.makeRosterCell(fam, cx, cy, cellW, cellH, rowDelay);
        });
    }

    private makeRosterCell(fam: FamiliarDef, cx: number, cy: number, w: number, h: number, enterDelay = 0) {
        const save = SaveService.instance;
        const owned = save.getOwnedCount(fam.id) > 0;
        const isActive = save.getActiveFamiliar() === fam.id;
        const tier = TIER_COLOR[fam.rarity];
        const isHighRarity = fam.rarity === 'SSR' || fam.rarity === 'UR';

        const c = this.add.container(cx, cy).setAlpha(0).setScale(0.8);
        const objs: Phaser.GameObjects.GameObject[] = [];

        // SSR/UR: 外層光暈
        if (isHighRarity && owned) {
            const halo = this.add.rectangle(0, 0, w + 16, h + 16, tier, 0)
                .setStrokeStyle(3, tier, 0.5);
            objs.push(halo);
            const ht = this.tweens.add({
                targets: halo, alpha: 0.6,
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: enterDelay + 400
            });
            this.loopTweens.push(ht);
        }

        // 主卡底:SSR/UR 擁有時稍微亮一些
        const bgAlpha = owned ? (isHighRarity ? 0.98 : 0.94) : 0.48;
        const bgColor = owned ? (isHighRarity ? 0x2e2820 : 0x2a2520) : 0x1a1612;
        const bg = this.add.rectangle(0, 0, w, h, bgColor, bgAlpha)
            .setStrokeStyle(isActive ? 5 : (isHighRarity && owned ? 4 : 2),
                isActive ? 0xff8830 : tier,
                owned ? (isHighRarity ? 0.95 : 0.75) : 0.35);
        objs.push(bg);

        // 上沿 tier 色條(owned only)
        if (owned) {
            const topBar = this.add.rectangle(0, -h / 2 + 5, w - 8, 8, tier, 0.8);
            objs.push(topBar);
        }

        // 立繪 or placeholder
        if (owned && this.textures.exists(fam.spriteKey)) {
            const img = this.add.image(0, -12, fam.spriteKey).setScale(0.088);
            objs.push(img);
        } else {
            const ph = this.add.rectangle(0, -12, 60, 72, tier, owned ? 0.20 : 0.10)
                .setStrokeStyle(2, tier, owned ? 0.55 : 0.25);
            const q = this.add.text(0, -12, owned ? '?' : '鎖', {
                fontFamily: 'sans-serif', fontSize: owned ? 38 : 26,
                color: this.hex(tier), fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(owned ? 0.9 : 0.45);
            objs.push(ph, q);
        }

        // tier 角標
        const rar = this.add.text(-w / 2 + 7, -h / 2 + 7, RARITY_LABEL[fam.rarity], {
            fontFamily: 'sans-serif', fontSize: 17, color: this.hex(tier), fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0, 0).setAlpha(owned ? 1 : 0.45);
        objs.push(rar);

        // effect label(底部)
        const lab = this.add.text(0, h / 2 - 22, owned ? fam.effect.label : '未擁有', {
            fontFamily: 'monospace', fontSize: 14, color: owned ? '#ffe0c0' : '#6a5a45',
            align: 'center', wordWrap: { width: w - 10 }
        }).setOrigin(0.5);
        objs.push(lab);

        // 出戰中標記
        if (isActive) {
            const tag = this.add.text(0, -h / 2 + 20, '出戰中', {
                fontFamily: 'sans-serif', fontSize: 16, color: '#1a1612', fontStyle: 'bold',
                backgroundColor: '#ff8830', padding: { x: 8, y: 2 }
            }).setOrigin(0.5);
            objs.push(tag);
        }

        c.add(objs);
        c.setSize(w, h);

        if (owned && !isActive) {
            c.setInteractive({ useHandCursor: true });
            c.on('pointerover', () => { bg.setStrokeStyle(4, 0xff8830, 0.9); });
            c.on('pointerout', () => { bg.setStrokeStyle(isHighRarity ? 4 : 2, tier, isHighRarity ? 0.95 : 0.75); });
            c.on('pointerdown', () => {
                this.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
                this.setActive(fam.id);
            });
        }

        // 進場動畫:scale 0.8→1 + alpha 0→1
        this.tweens.add({ targets: c, alpha: 1, scaleX: 1, scaleY: 1, duration: 220, delay: enterDelay, ease: 'Back.easeOut' });
    }

    // 設出戰並刷新 UI(SaveService 守門:只允許已擁有)
    private setActive(id: string | null) {
        const save = SaveService.instance;
        if (id !== null && save.getOwnedCount(id) <= 0) {
            this.flashMsg('尚未擁有');
            return;
        }
        save.setActiveFamiliar(id);
        save.save();
        this.scene.restart();
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

            // SSR/UR 卡:光暈呼吸閃(追蹤進 loopTweens 確保 shutdown 清除)
            if (r.rarity === 'SSR' || r.rarity === 'UR') {
                const glowTween = this.tweens.add({
                    targets: glow, alpha: TIER_GLOW_ALPHA[r.rarity] + 0.2,
                    duration: 600, yoyo: true, repeat: -1
                });
                this.loopTweens.push(glowTween);
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
