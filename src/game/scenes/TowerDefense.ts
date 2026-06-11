import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';
import { FAMILIAR_POOL } from '../services/GachaService';
import { TowerStat, towerStatOf, famLevelMult, stageOf, StageDef } from '../services/TDService';

// 廢土塔防 — 養成版(pivot v2 2026-06-12 user「這樣不是養成系」):
// 塔防是戰鬥外殼,養成是本體 — 部署名單=抽卡擁有、守軍永久 Lv 吃進戰力、打關入帳金幣/晶體回頭升級抽卡。
// 設計約束:零人形幀動畫(守軍=靜態立繪,怪=既有 2-frame/wobble),全 tween 特效。
const W = 1080;
const H = 1920;

const FAM_FILES: Record<string, string> = {
    fam_pip: 'familiar_r_scavver_kid_pip', fam_mira: 'familiar_r_gather_rat_mira',
    fam_grub: 'familiar_r_goblin_underling_grub', fam_zix: 'familiar_r_pickpocket_goblin_zix',
    fam_neek: 'familiar_r_oilamp_lighter_neek', fam_dorl: 'familiar_r_pot_dishwasher_dorl',
    fam_fire_imp: 'familiar_sr_fire_imp', fam_ironguard: 'familiar_sr_ironguard_portrait',
    fam_frost_witch: 'familiar_sr_frost_tongue_witch', fam_axe_brothers: 'familiar_sr_axe_brothers',
    fam_blackmarket_fox: 'familiar_ssr_blackmarket_fox', fam_wasteland_prophet: 'familiar_ssr_wasteland_prophet',
    fam_shadow_hunter: 'familiar_ssr_shadow_hunter_portrait', fam_appraisal_queen: 'familiar_ur_appraisal_queen'
};

// 怪物行進路徑(S 形,上進下出,單螢幕棋盤)
const PATH: { x: number; y: number }[] = [
    { x: 150, y: -80 }, { x: 150, y: 400 }, { x: 820, y: 400 }, { x: 820, y: 900 },
    { x: 260, y: 900 }, { x: 260, y: 1400 }, { x: 760, y: 1400 }, { x: 760, y: 2000 }
];

// 建塔點(路徑彎角附近)
const PADS: { x: number; y: number }[] = [
    { x: 360, y: 250 }, { x: 640, y: 560 }, { x: 420, y: 740 }, { x: 960, y: 700 },
    { x: 110, y: 1120 }, { x: 520, y: 1140 }, { x: 940, y: 1260 }, { x: 460, y: 1620 }
];

// 部署候選 = FAMILIAR_POOL × TOWER_STATS(TDService),沒抽到的不出現在面板

const UPGRADE_DMG_MULT = 1.6;
const UPGRADE_RANGE_MULT = 1.1;
const UPGRADE_COST_PCT = 0.7;   // 升級費 = 基礎費 × 70%
const SELL_REFUND_PCT = 0.7;

interface WaveDef { key: string; count: number; hp: number; spd: number; gapMs: number; scrap: number; anim?: string; scale: number; boss?: boolean }

// 15 波:鼠 → 蜈蚣 → 蜘蛛 → 食人花 → 蠍 → 機甲蟲 → 混波 → 酸主 boss
const WAVES: WaveDef[] = [
    { key: 'mob_giantrat_run_a', anim: 'giantrat_run', count: 8, hp: 40, spd: 0.085, gapMs: 900, scrap: 12, scale: 0.13 },
    { key: 'mob_giantrat_run_a', anim: 'giantrat_run', count: 10, hp: 55, spd: 0.09, gapMs: 800, scrap: 12, scale: 0.13 },
    { key: 'mob_centipede_wave_a', anim: 'centipede_wave', count: 10, hp: 75, spd: 0.075, gapMs: 850, scrap: 14, scale: 0.14 },
    { key: 'mob_rust_spider', count: 9, hp: 110, spd: 0.08, gapMs: 900, scrap: 16, scale: 0.115 },
    { key: 'mob_giantrat_run_a', anim: 'giantrat_run', count: 14, hp: 90, spd: 0.105, gapMs: 600, scrap: 13, scale: 0.13 },
    { key: 'mob_mutant_creeper', count: 8, hp: 200, spd: 0.06, gapMs: 1100, scrap: 22, scale: 0.12 },
    { key: 'mob_centipede_wave_a', anim: 'centipede_wave', count: 13, hp: 150, spd: 0.085, gapMs: 700, scrap: 16, scale: 0.14 },
    { key: 'mob_rust_scorpion', count: 10, hp: 240, spd: 0.07, gapMs: 900, scrap: 22, scale: 0.12 },
    { key: 'mob_rust_spider', count: 14, hp: 210, spd: 0.09, gapMs: 650, scrap: 18, scale: 0.115 },
    { key: 'mob_reactor_crawler', count: 9, hp: 380, spd: 0.06, gapMs: 1000, scrap: 30, scale: 0.1 },
    { key: 'mob_giantrat_run_a', anim: 'giantrat_run', count: 18, hp: 180, spd: 0.12, gapMs: 480, scrap: 15, scale: 0.13 },
    { key: 'mob_rust_scorpion', count: 13, hp: 380, spd: 0.075, gapMs: 750, scrap: 24, scale: 0.12 },
    { key: 'mob_mutant_creeper', count: 12, hp: 480, spd: 0.065, gapMs: 800, scrap: 28, scale: 0.12 },
    { key: 'mob_reactor_crawler', count: 12, hp: 560, spd: 0.07, gapMs: 750, scrap: 32, scale: 0.1 },
    { key: 'mob_acidsire', count: 1, hp: 6500, spd: 0.038, gapMs: 0, scrap: 600, scale: 0.42, boss: true }
];

const START_SCRAP = 260;
const START_LIVES = 10;
const WAVE_CLEAR_BONUS = 50;

interface Creep {
    obj: Phaser.GameObjects.Sprite;
    hp: number;
    maxHp: number;
    spd: number;
    wpIdx: number;          // 下一個 waypoint
    progress: number;       // 總行進距離(targeting 用)
    scrap: number;
    slowUntil: number;
    slowMult: number;
    flashUntil: number;     // 受擊白閃到期(統一用 update 的 time,不混 scene clock)
    hpBar: Phaser.GameObjects.Rectangle;
    hpBarBg: Phaser.GameObjects.Rectangle;
    squashing: boolean;
    baseScale: number;
    boss: boolean;
}

interface Tower {
    stat: TowerStat;
    famLv: number;       // 永久養成等級(進場時快照)
    level: number;       // 場內升級 1-3
    invested: number;
    padIdx: number;
    obj: Phaser.GameObjects.Image;
    pips: Phaser.GameObjects.Arc[];
    nextFireAt: number;
}

export class TowerDefense extends Scene {
    private scrap = START_SCRAP;
    private lives = START_LIVES;
    private waveIdx = 0;            // 已完成波數
    private waveActive = false;
    private spawnQueue = 0;
    private nextSpawnAt = 0;
    private creeps: Creep[] = [];
    private towers: Tower[] = [];
    private gameEnded = false;
    private nowMs = 0;   // update-loop 最新 time(投射物延遲命中時用,不混 scene clock)

    private scrapText!: Phaser.GameObjects.Text;
    private livesText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private waveBtn!: Phaser.GameObjects.Text;
    private panel?: Phaser.GameObjects.Container;
    private rangeCircle?: Phaser.GameObjects.Arc;
    private stage!: StageDef;
    private stageWaves: WaveDef[] = [];
    private buildPage = 0;   // 部署面板分頁(每頁 4 隻)

    constructor() { super('TowerDefense'); }

    init(data: { stageId?: string }) {
        this.stage = stageOf(data?.stageId ?? 'st1');
    }

    preload() {
        this.load.setPath('assets');
        const save = SaveService.instance;
        for (const fam of FAMILIAR_POOL) {
            if (save.getOwnedCount(fam.id) > 0 && !this.textures.exists(fam.spriteKey)) {
                this.load.image(fam.spriteKey, `familiars/${FAM_FILES[fam.id]}.png`);
            }
        }
    }

    create() {
        // 重入 reset(scene.restart)
        this.scrap = START_SCRAP; this.lives = START_LIVES; this.waveIdx = 0;
        this.waveActive = false; this.spawnQueue = 0; this.creeps = []; this.towers = [];
        this.gameEnded = false; this.buildPage = 0;
        this.panel = undefined; this.rangeCircle = undefined;

        // 關卡波次:取前 N 波 × 難度倍率(stage 6 的第 15 波天然是酸主 boss)
        this.stageWaves = WAVES.slice(0, this.stage.waveCount).map(w => ({
            ...w,
            hp: Math.round(w.hp * this.stage.hpMult),
            spd: w.spd * this.stage.spdMult,
            scrap: Math.round(w.scrap * (1 + (this.stage.hpMult - 1) * 0.35))
        }));

        // 棋盤背景 = 關卡地圖(cover crop 置中)
        const bg = this.add.image(W / 2, H / 2, this.stage.bgKey);
        const cover = Math.max(W / bg.width, H / bg.height);
        bg.setScale(cover).setDepth(0);

        this.drawPath();
        this.drawPads();
        this.createHud();
    }

    private drawPath() {
        const g = this.add.graphics().setDepth(5);
        // 路基(寬,半透明深土)
        g.lineStyle(86, 0x2a2520, 0.40);
        g.beginPath(); g.moveTo(PATH[0].x, PATH[0].y);
        for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
        g.strokePath();
        // 路面(亮土色)
        g.lineStyle(64, 0xb08850, 0.30);
        g.beginPath(); g.moveTo(PATH[0].x, PATH[0].y);
        for (let i = 1; i < PATH.length; i++) g.lineTo(PATH[i].x, PATH[i].y);
        g.strokePath();
        // 入口/出口標記
        this.add.text(PATH[0].x, 36, '⚠ 入侵方向', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#ff8830', stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5).setDepth(6);
        this.add.text(PATH[PATH.length - 1].x, H - 130, '🏠 防線', {
            fontFamily: 'sans-serif', fontSize: 30, color: '#ffe0c0', stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5).setDepth(6);
    }

    private drawPads() {
        PADS.forEach((p, i) => {
            const pad = this.add.circle(p.x, p.y, 52, 0x2a2520, 0.78)
                .setStrokeStyle(4, 0xa05a30, 0.9).setDepth(10)
                .setInteractive({ useHandCursor: true });
            this.add.circle(p.x, p.y, 38, 0x4a3a30, 0.5).setDepth(10);
            this.add.text(p.x, p.y, '+', {
                fontFamily: 'sans-serif', fontSize: 44, color: '#b08850', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(11).setName(`padplus_${i}`);
            pad.on('pointerdown', () => this.onPadTap(i, p.x, p.y));
        });
    }

    private createHud() {
        this.add.rectangle(W / 2, 56, W, 112, 0x1a1612, 0.92).setDepth(900);
        this.livesText = this.add.text(40, 36, '', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#ff6050', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 4
        }).setDepth(901);
        this.scrapText = this.add.text(330, 36, '', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#ffe0c0', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 4
        }).setDepth(901);
        this.waveText = this.add.text(700, 36, '', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#b08850', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 4
        }).setDepth(901);

        this.waveBtn = this.add.text(W / 2, H - 64, '▶ 開始下一波', {
            fontFamily: 'sans-serif', fontSize: 46, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 36, y: 14 }
        }).setOrigin(0.5).setDepth(901).setInteractive({ useHandCursor: true });
        this.waveBtn.on('pointerdown', () => this.startWave());
        this.tweens.add({ targets: this.waveBtn, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

        // 關卡名 + 撤退(回防線基地,不結算獎勵)
        this.add.text(W / 2, 132, this.stage.nameZH, {
            fontFamily: 'sans-serif', fontSize: 28, color: '#6a5a48'
        }).setOrigin(0.5).setDepth(901);
        const quit = this.add.text(W - 50, 36, '✕', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#b08850', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(901).setInteractive({ useHandCursor: true });
        quit.on('pointerdown', () => this.scene.start('StageSelect'));

        this.refreshHud();
    }

    private refreshHud() {
        this.livesText.setText(`❤ ${this.lives}`);
        this.scrapText.setText(`🔩 ${this.scrap}`);
        this.waveText.setText(`波 ${Math.min(this.waveIdx + (this.waveActive ? 1 : 0), this.stageWaves.length)}/${this.stageWaves.length}`);
    }

    private startWave() {
        if (this.waveActive || this.gameEnded || this.waveIdx >= this.stageWaves.length) return;
        this.waveActive = true;
        this.spawnQueue = this.stageWaves[this.waveIdx].count;
        this.nextSpawnAt = 0;
        this.waveBtn.setVisible(false);
        if (this.stageWaves[this.waveIdx].boss) {
            const warn = this.add.text(W / 2, H / 2 - 240, '⚠ 蝕骨蜈蚣巢母 來襲!', {
                fontFamily: 'sans-serif', fontSize: 58, color: '#9be060', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 8
            }).setOrigin(0.5).setDepth(950);
            this.tweens.add({ targets: warn, alpha: 0, scale: 1.4, duration: 1800, onComplete: () => warn.destroy() });
            this.cameras.main.shake(350, 0.012);
        }
        this.refreshHud();
    }

    private spawnCreep(wave: WaveDef) {
        const obj = this.add.sprite(PATH[0].x, PATH[0].y, wave.key).setScale(wave.scale).setDepth(20);
        if (wave.anim && this.anims.exists(wave.anim)) obj.play(wave.anim);
        const barW = wave.boss ? 150 : 64;
        const hpBarBg = this.add.rectangle(obj.x, obj.y - 60, barW, 9, 0x1a1612, 0.85).setDepth(21);
        const hpBar = this.add.rectangle(obj.x, obj.y - 60, barW - 2, 7, 0x9be060, 1).setDepth(22);
        this.creeps.push({
            obj, hp: wave.hp, maxHp: wave.hp, spd: wave.spd, wpIdx: 1, progress: 0,
            scrap: wave.scrap, slowUntil: 0, slowMult: 1, flashUntil: 0, hpBar, hpBarBg,
            squashing: false, baseScale: wave.scale, boss: wave.boss === true
        });
    }

    private onPadTap(idx: number, px: number, py: number) {
        if (this.gameEnded) return;
        const existing = this.towers.find(t => t.padIdx === idx);
        if (existing) { this.showTowerPanel(existing); return; }
        this.showBuildPanel(idx, px, py);
    }

    private closePanel() {
        this.panel?.destroy(); this.panel = undefined;
        this.rangeCircle?.destroy(); this.rangeCircle = undefined;
    }

    private showBuildPanel(padIdx: number, px: number, py: number) {
        this.closePanel();
        const c = this.add.container(0, 0).setDepth(1000);
        const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive();
        dim.on('pointerdown', () => this.closePanel());
        c.add(dim);
        const panelY = H - 420;
        c.add(this.add.rectangle(W / 2, panelY + 150, W - 40, 360, 0x2a2520, 0.97).setStrokeStyle(3, 0xa05a30));
        c.add(this.add.text(W / 2, panelY - 4, '◤ 部署守軍 ◢', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5));
        // 部署名單 = 抽卡擁有(養成核心:沒抽到不能上場),每頁 4 隻
        const save = SaveService.instance;
        const roster = FAMILIAR_POOL.filter(f => save.getOwnedCount(f.id) > 0 && towerStatOf(f.id));
        const pages = Math.max(1, Math.ceil(roster.length / 4));
        this.buildPage = Math.min(this.buildPage, pages - 1);
        const pageRoster = roster.slice(this.buildPage * 4, this.buildPage * 4 + 4);
        pageRoster.forEach((fam, i) => {
            const stat = towerStatOf(fam.id);
            if (!stat) return;
            const cx = 150 + i * 260;
            const cy = panelY + 170;
            const lv = save.getFamiliarLevel(fam.id);
            const afford = this.scrap >= stat.cost;
            const card = this.add.rectangle(cx, cy, 235, 270, afford ? 0x3a342c : 0x241f1a, 1)
                .setStrokeStyle(3, afford ? 0xff8830 : 0x4a3a30).setInteractive({ useHandCursor: afford });
            if (this.textures.exists(fam.spriteKey)) {
                const img = this.add.image(cx, cy - 36, fam.spriteKey);
                img.setScale(150 / img.height);
                if (!afford) img.setAlpha(0.4);
                c.add(img);
            }
            const label = this.add.text(cx, cy + 64, `${fam.nameZH.split(' ')[0]} Lv.${lv}`, {
                fontFamily: 'sans-serif', fontSize: 24, color: afford ? '#ffe0c0' : '#6a5a48'
            }).setOrigin(0.5);
            const cost = this.add.text(cx, cy + 104, `🔩 ${stat.cost} · ${stat.desc}`, {
                fontFamily: 'sans-serif', fontSize: 25, color: afford ? '#ffe060' : '#6a5a48', fontStyle: 'bold'
            }).setOrigin(0.5);
            card.on('pointerdown', () => { if (afford) this.buildTower(fam.id, stat, padIdx, px, py); });
            c.add([card, label, cost]);
        });
        // 分頁(擁有 >4 隻)
        if (pages > 1) {
            const pageTxt = this.add.text(W / 2, panelY + 322, `${this.buildPage + 1}/${pages}`, {
                fontFamily: 'sans-serif', fontSize: 28, color: '#b08850'
            }).setOrigin(0.5);
            const prev = this.add.text(W / 2 - 110, panelY + 322, '◀', {
                fontFamily: 'sans-serif', fontSize: 40, color: '#ffe0c0'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            const next = this.add.text(W / 2 + 110, panelY + 322, '▶', {
                fontFamily: 'sans-serif', fontSize: 40, color: '#ffe0c0'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            prev.on('pointerdown', () => { this.buildPage = (this.buildPage + pages - 1) % pages; this.showBuildPanel(padIdx, px, py); });
            next.on('pointerdown', () => { this.buildPage = (this.buildPage + 1) % pages; this.showBuildPanel(padIdx, px, py); });
            c.add([pageTxt, prev, next]);
        }
        this.panel = c;
    }

    private buildTower(famId: string, stat: TowerStat, padIdx: number, px: number, py: number) {
        // tap 當下重驗(面板開著時戰況持續,開板時的 afford 可能過期 — Codex review fix)
        if (this.scrap < stat.cost || this.towers.some(t => t.padIdx === padIdx)) { this.closePanel(); return; }
        this.scrap -= stat.cost;
        const plus = this.children.getByName(`padplus_${padIdx}`);
        plus?.destroy();
        const fam = FAMILIAR_POOL.find(f => f.id === famId);
        const texKey = fam?.spriteKey ?? 'fam_pip';
        const obj = this.add.image(px, py - 34, texKey).setDepth(30).setInteractive({ useHandCursor: true });
        obj.setScale(128 / obj.height);
        obj.on('pointerdown', () => {
            const t = this.towers.find(tt => tt.padIdx === padIdx);
            if (t) this.showTowerPanel(t);
        });
        // 部署登場 pop
        obj.setAlpha(0); obj.y -= 26;
        this.tweens.add({ targets: obj, alpha: 1, y: py - 34, duration: 260, ease: 'Back.out' });
        const tower: Tower = {
            stat, famLv: SaveService.instance.getFamiliarLevel(famId),
            level: 1, invested: stat.cost, padIdx, obj, pips: [], nextFireAt: 0
        };
        this.drawLevelPips(tower, px, py);
        this.towers.push(tower);
        this.closePanel();
        this.refreshHud();
    }

    private drawLevelPips(t: Tower, px: number, py: number) {
        t.pips.forEach(p => p.destroy());
        t.pips = [];
        for (let i = 0; i < t.level; i++) {
            t.pips.push(this.add.circle(px - 14 + i * 14, py + 44, 5, 0xffe060, 1).setStrokeStyle(1, 0x1a1612).setDepth(31));
        }
    }

    // 戰力 = 基礎 × 永久 Lv 倍率 × 場內升級倍率(養成直接吃進傷害)
    private towerDmg(t: Tower) { return Math.round(t.stat.dmg * famLevelMult(t.famLv) * Math.pow(UPGRADE_DMG_MULT, t.level - 1)); }
    private towerRange(t: Tower) { return t.stat.range * Math.pow(UPGRADE_RANGE_MULT, t.level - 1); }
    private towerName(t: Tower) {
        return FAMILIAR_POOL.find(f => f.id === t.stat.famId)?.nameZH ?? t.stat.famId;
    }

    private showTowerPanel(t: Tower) {
        this.closePanel();
        const pad = PADS[t.padIdx];
        this.rangeCircle = this.add.circle(pad.x, pad.y, this.towerRange(t), t.stat.color, 0.10)
            .setStrokeStyle(2, t.stat.color, 0.6).setDepth(15);
        const c = this.add.container(0, 0).setDepth(1000);
        const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35).setInteractive();
        dim.on('pointerdown', () => this.closePanel());
        c.add(dim);
        const py = H - 380;
        c.add(this.add.rectangle(W / 2, py + 110, W - 40, 290, 0x2a2520, 0.97).setStrokeStyle(3, 0xa05a30));
        c.add(this.add.text(W / 2, py - 18, `${this.towerName(t)}  養成Lv.${t.famLv} · 場內Lv.${t.level}`, {
            fontFamily: 'sans-serif', fontSize: 38, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, py + 40, `傷害 ${this.towerDmg(t)} · 射程 ${Math.round(this.towerRange(t))}` +
            (t.stat.splash ? ' · 濺射' : '') + (t.stat.slowPct ? ' · 緩速' : '') + (t.stat.bonusScrapPct ? ' · 生財' : ''), {
            fontFamily: 'sans-serif', fontSize: 28, color: '#b08850'
        }).setOrigin(0.5));
        const upCost = Math.round(t.stat.cost * UPGRADE_COST_PCT * t.level);
        const maxed = t.level >= 3;
        const canUp = !maxed && this.scrap >= upCost;
        const upBtn = this.add.text(W / 2 - 200, py + 140, maxed ? '已滿級' : `⬆ 升級 🔩${upCost}`, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: canUp ? '#9be060' : '#5a5248', padding: { x: 26, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: canUp });
        upBtn.on('pointerdown', () => {
            // tap 當下重驗 maxed / 餘額(Codex review fix)
            if (t.level >= 3 || this.scrap < upCost) return;
            this.scrap -= upCost; t.invested += upCost; t.level += 1;
            this.drawLevelPips(t, pad.x, pad.y);
            this.refreshHud(); this.closePanel();
        });
        const refund = Math.round(t.invested * SELL_REFUND_PCT);
        const sellBtn = this.add.text(W / 2 + 200, py + 140, `♻ 拆除 +🔩${refund}`, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ff8830', padding: { x: 26, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        sellBtn.on('pointerdown', () => {
            this.scrap += refund;
            t.obj.destroy(); t.pips.forEach(p => p.destroy());
            this.towers = this.towers.filter(tt => tt !== t);
            // 還原 pad 的 +
            this.add.text(pad.x, pad.y, '+', {
                fontFamily: 'sans-serif', fontSize: 44, color: '#b08850', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(11).setName(`padplus_${t.padIdx}`);
            this.refreshHud(); this.closePanel();
        });
        c.add([upBtn, sellBtn]);
        this.panel = c;
    }

    update(time: number, delta: number) {
        this.nowMs = time;
        if (this.gameEnded) return;
        // spawn
        if (this.waveActive && this.spawnQueue > 0 && time >= this.nextSpawnAt) {
            const wave = this.stageWaves[this.waveIdx];
            this.spawnCreep(wave);
            this.spawnQueue -= 1;
            this.nextSpawnAt = time + wave.gapMs;
        }
        // creep 移動
        for (const c of [...this.creeps]) {
            if (!c.obj.active) continue;
            const slow = time < c.slowUntil ? c.slowMult : 1;
            let move = c.spd * delta * slow;
            while (move > 0 && c.wpIdx < PATH.length) {
                const wp = PATH[c.wpIdx];
                const dx = wp.x - c.obj.x, dy = wp.y - c.obj.y;
                const d = Math.hypot(dx, dy);
                if (d <= move) {
                    c.obj.x = wp.x; c.obj.y = wp.y; c.wpIdx += 1; move -= d; c.progress += d;
                } else {
                    c.obj.x += (dx / d) * move; c.obj.y += (dy / d) * move; c.progress += move;
                    if (Math.abs(dx) > Math.abs(dy)) c.obj.setFlipX(dx < 0);
                    move = 0;
                }
            }
            c.hpBarBg.setPosition(c.obj.x, c.obj.y - (c.boss ? 130 : 60));
            c.hpBar.setPosition(c.obj.x - (c.hpBarBg.width - 2) * (1 - c.hp / c.maxHp) / 2, c.hpBarBg.y);
            c.hpBar.width = (c.hpBarBg.width - 2) * Math.max(0, c.hp / c.maxHp);
            // 染色優先序:受擊白閃 > 緩速藍 > 還原(全部用 update 的 time,不混 scene clock)
            if (time < c.flashUntil) c.obj.setTint(0xffffff);
            else if (time < c.slowUntil) c.obj.setTint(0x88ccee);
            else c.obj.clearTint();
            // 到終點 = 漏怪;boss 突破防線 = 直接敗北(不能漏王還算贏)
            if (c.wpIdx >= PATH.length) {
                const wasBoss = c.boss;
                this.removeCreep(c);
                this.lives -= wasBoss ? 3 : 1;
                this.cameras.main.shake(180, 0.008);
                this.refreshHud();
                if (wasBoss || this.lives <= 0) { this.endGame(false); return; }
            }
        }
        // 塔射擊
        for (const t of this.towers) {
            if (time < t.nextFireAt) continue;
            const pad = PADS[t.padIdx];
            const range = this.towerRange(t);
            let best: Creep | null = null;
            for (const c of this.creeps) {
                if (!c.obj.active) continue;
                if (Math.hypot(c.obj.x - pad.x, c.obj.y - pad.y) > range) continue;
                if (!best || c.progress > best.progress) best = c;
            }
            if (best) {
                t.nextFireAt = time + t.stat.rateMs;
                this.fireProjectile(t, pad.x, pad.y - 40, best);
            }
        }
        // 波次結束判定
        if (this.waveActive && this.spawnQueue === 0 && this.creeps.length === 0) {
            this.waveActive = false;
            this.waveIdx += 1;
            this.scrap += WAVE_CLEAR_BONUS;
            this.refreshHud();
            if (this.waveIdx >= this.stageWaves.length) { this.endGame(true); return; }
            this.waveBtn.setVisible(true);
        }
    }

    private fireProjectile(t: Tower, sx: number, sy: number, target: Creep) {
        // 攻擊瞬間塔 recoil(打擊感)
        this.tweens.add({ targets: t.obj, scaleX: t.obj.scaleX * 1.08, scaleY: t.obj.scaleY * 0.92, duration: 70, yoyo: true });
        const p = this.add.circle(sx, sy, t.stat.splash ? 11 : 7, t.stat.color, 1)
            .setStrokeStyle(2, 0x1a1612, 0.8).setDepth(40);
        this.tweens.add({
            targets: p, x: target.obj.x, y: target.obj.y, duration: 130, ease: 'Quad.in',
            onUpdate: () => { if (target.obj.active) { /* 簡單追蹤:每 tick 不重算,MVP 直線即可 */ } },
            onComplete: () => {
                p.destroy();
                if (!target.obj.active) return;
                const impact = this.add.circle(target.obj.x, target.obj.y, t.stat.splash ?? 16, t.stat.color, t.stat.splash ? 0.25 : 0)
                    .setStrokeStyle(3, t.stat.color, 0.9).setDepth(41);
                this.tweens.add({ targets: impact, scale: 1.6, alpha: 0, duration: 180, onComplete: () => impact.destroy() });
                if (t.stat.splash) {
                    for (const c of [...this.creeps]) {
                        if (!c.obj.active) continue;
                        if (Math.hypot(c.obj.x - target.obj.x, c.obj.y - target.obj.y) <= t.stat.splash) {
                            this.damageCreep(c, this.towerDmg(t), t);
                        }
                    }
                } else {
                    this.damageCreep(target, this.towerDmg(t), t);
                }
            }
        });
    }

    private damageCreep(c: Creep, dmg: number, t: Tower) {
        // 投射物 130ms 後才命中,開火當下的 time 已過期 → 用 update-loop 維護的 nowMs(Codex review fix)
        const time = this.nowMs;
        c.hp -= dmg;
        if (t.stat.slowPct) { c.slowUntil = time + (t.stat.slowMs ?? 1000); c.slowMult = 1 - t.stat.slowPct; }
        // hit flash(update 的染色優先序負責還原)+ squash
        c.flashUntil = time + 70;
        c.obj.setTint(0xffffff);
        if (!c.squashing) {
            c.squashing = true;
            this.tweens.add({
                targets: c.obj, scaleX: c.baseScale * 1.15, scaleY: c.baseScale * 0.85,
                duration: 55, yoyo: true,
                onComplete: () => { c.squashing = false; if (c.obj.active) c.obj.setScale(c.baseScale); }
            });
        }
        const txt = this.add.text(c.obj.x + (Math.random() - 0.5) * 30, c.obj.y - 70, `${dmg}`, {
            fontFamily: 'sans-serif', fontSize: 30, color: '#ffe0c0', fontStyle: 'bold', stroke: '#8b3a1f', strokeThickness: 4
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: txt, y: txt.y - 46, alpha: 0, duration: 480, onComplete: () => txt.destroy() });
        if (c.hp <= 0) this.killCreep(c, t.stat.bonusScrapPct ?? 0);
    }

    private killCreep(c: Creep, bonusScrapPct = 0) {
        this.scrap += Math.round(c.scrap * (1 + bonusScrapPct));
        const reward = this.add.text(c.obj.x, c.obj.y - 40, `+🔩${c.scrap}`, {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ffe060', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: reward, y: reward.y - 56, alpha: 0, duration: 600, onComplete: () => reward.destroy() });
        const obj = c.obj;
        this.removeCreep(c, true);
        this.tweens.add({
            targets: obj, scale: obj.scaleX * 1.35, alpha: 0, duration: 160, ease: 'Quad.out',
            onComplete: () => obj.destroy()
        });
        this.refreshHud();
    }

    private removeCreep(c: Creep, keepObjForTween = false) {
        this.creeps = this.creeps.filter(x => x !== c);
        c.hpBar.destroy(); c.hpBarBg.destroy();
        this.tweens.killTweensOf(c.obj);
        if (!keepObjForTween) c.obj.destroy();
        else c.obj.setActive(false);
    }

    // 結算 = 養成資源入帳:勝利首通 clearGold+晶體、重複通關 40%、敗北按撐過波數補貼
    private endGame(victory: boolean) {
        this.gameEnded = true;
        const save = SaveService.instance;
        let goldGain = 0;
        let crystalGain = 0;
        let stars = 0;
        if (victory) {
            stars = this.lives >= 9 ? 3 : this.lives >= 5 ? 2 : 1;
            const firstClear = save.getStageStars(this.stage.id) === 0;
            goldGain = firstClear ? this.stage.clearGold : Math.round(this.stage.clearGold * this.stage.repeatGoldPct);
            if (firstClear) crystalGain = this.stage.firstClearCrystal;
            save.setStageStars(this.stage.id, stars);
        } else {
            goldGain = this.waveIdx * 30;   // 敗北補貼:撐過的波數 ×30
        }
        save.addGold(goldGain);
        if (crystalGain > 0) save.addCrystal(crystalGain);
        save.save();

        const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(2000).setInteractive();
        void dim;
        this.add.text(W / 2, H / 2 - 240, victory ? '🏆 防線守住了!' : '💀 防線陷落……', {
            fontFamily: 'sans-serif', fontSize: 76, color: victory ? '#ffe060' : '#ff6050', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 10
        }).setOrigin(0.5).setDepth(2001);
        if (victory) {
            this.add.text(W / 2, H / 2 - 140, '★'.repeat(stars) + '☆'.repeat(3 - stars), {
                fontFamily: 'sans-serif', fontSize: 64, color: '#ffe060'
            }).setOrigin(0.5).setDepth(2001);
        }
        this.add.text(W / 2, H / 2 - 50,
            (victory ? `${this.stage.nameZH} 全清 · 剩餘 ❤ ${this.lives}` : `${this.stage.nameZH} · 撐到第 ${this.waveIdx + 1} 波`) +
            `\n獲得 💰${goldGain}` + (crystalGain > 0 ? ` + 💎${crystalGain}(首通)` : ''), {
            fontFamily: 'sans-serif', fontSize: 40, color: '#ffe0c0', stroke: '#1a1612', strokeThickness: 5, align: 'center'
        }).setOrigin(0.5).setDepth(2001);
        const back = this.add.text(W / 2, H / 2 + 140, '⛺ 回防線基地', {
            fontFamily: 'sans-serif', fontSize: 50, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: '#ffc040', padding: { x: 44, y: 18 }
        }).setOrigin(0.5).setDepth(2001).setInteractive({ useHandCursor: true });
        back.on('pointerdown', () => this.scene.start('StageSelect'));
        const retry = this.add.text(W / 2, H / 2 + 268, '↻ 再戰本關', {
            fontFamily: 'sans-serif', fontSize: 40, color: '#b08850',
            backgroundColor: '#2a2520', padding: { x: 34, y: 14 }
        }).setOrigin(0.5).setDepth(2001).setInteractive({ useHandCursor: true });
        retry.on('pointerdown', () => this.scene.restart());
    }
}
