import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';
import { VirtualJoystick } from '../services/VirtualJoystick';
import { SaveService } from '../services/SaveService';
import { effectiveDamage, getWeapon, WeaponDef } from '../services/WeaponService';
import { QUESTS, QuestDef } from '../services/QuestService';
import { getMap, MapConfig, NpcSpec, PortalSpec } from '../services/MapService';

// 視窗尺寸(Phaser config 內固定 1080×1920 portrait)
const VIEW_W = 1080;
const VIEW_H = 1920;
// 大地圖尺寸(camera follow player,UI 用 scrollFactor(0) 固定)— 荒野亂鬥風
const MAP_W = 2400;
const MAP_H = 3200;
// alias 保留 — 玩家邊界 / 內容定位用 MAP 尺寸
const W = MAP_W;
const H = MAP_H;
const _CX = W / 2;
const _CY = H / 2;
void _CX;
void _CY;

// 楓谷 cycle spawn(per project-v2-gameplay-lock §2)
// max kill/hour = 3600 / 7.56 × spawn_point_count
const RESPAWN_CYCLE_MS = 7560;

// Phaser 4 TintModes.FILL enum value(production build 無 Phaser global namespace,hardcode 1)
const TINT_FILL = 1;

interface SpawnPoint {
    x: number;
    y: number;
    mob: Phaser.GameObjects.Image | null;
    nextSpawnAt: number;
    blueprintIdx: number; // 該 spawn point 固定生哪種 mob
}

type MobState = 'wander' | 'chase';

// per weapons_v1 §4 mob resist matrix:Rat / Mutant / Robot / Plant / Insect / BossArmored
type MobType = 'Rat' | 'Insect' | 'Robot';

interface MobBlueprint {
    id: string;
    type: MobType;
    spriteKey: string;
    tint?: number;
    scale: number;
    hp: number;
    speedChase: number;
    speedWander: number;
    contactDamage: number;
    expReward: number;
    goldReward: number;
    isBoss?: boolean;       // boss 不從 spawn point 生,死掉不 cycle 重生
    rageThreshold?: number; // HP 百分比 < 觸發 rage(boss only)
}

// Phase 4a 3 種怪
const MOB_BLUEPRINTS: MobBlueprint[] = [
    {
        id: 'giantrat', type: 'Rat',
        spriteKey: 'mob_giantrat', scale: 0.18,
        hp: 50, speedChase: 0.10, speedWander: 0.04,
        contactDamage: 8, expReward: 5, goldReward: 3
    },
    {
        id: 'centipede', type: 'Insect',
        spriteKey: 'mob_centipede', scale: 0.14,
        hp: 80, speedChase: 0.07, speedWander: 0.03,
        contactDamage: 12, expReward: 8, goldReward: 5
    },
    {
        id: 'scrap_drone', type: 'Robot',
        spriteKey: 'mob_giantrat', scale: 0.16, tint: 0x8090a0,
        hp: 35, speedChase: 0.14, speedWander: 0.05,
        contactDamage: 6, expReward: 6, goldReward: 4
    }
];

// Phase 4a-18:1 隻 boss(廢料巨鼠 boss 版),殺夠 50 隻普通 mob 後 trigger
const BOSS_GIANTRAT: MobBlueprint = {
    id: 'boss_giantrat',
    type: 'Rat',
    spriteKey: 'mob_giantrat',
    scale: 0.40,           // boss 是普通 mob 2× 大
    tint: 0xff6020,        // 紅 fill(blood-soaked giant)
    hp: 600,
    speedChase: 0.09,      // 比 normal rat 稍慢(boss 有距離壓力但不會追到)
    speedWander: 0,        // boss 從不 wander
    contactDamage: 25,
    expReward: 200,
    goldReward: 100,
    isBoss: true,
    rageThreshold: 0.5     // HP < 50% 進入 rage
};

const BOSS_TRIGGER_KILLS = 50; // 殺 50 mob 觸發 boss

interface MobData {
    blueprint: MobBlueprint;
    hp: number;
    spawnPoint: SpawnPoint | null; // boss = null(不 cycle)
    lastContactMs: number;
    state: MobState;
    wanderTargetX: number;
    wanderTargetY: number;
    nextWanderAt: number;
    isRaging?: boolean;
}

export class Game extends Scene
{
    private player!: Phaser.GameObjects.Image;
    private playerHP = 100;
    private playerInvulnUntilMs = 0;
    private isGameOver = false;
    private spawnPoints: SpawnPoint[] = [];
    private mobs: Phaser.GameObjects.Image[] = [];
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
    private joystick!: VirtualJoystick;
    private attackCooldownMs = 0;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private hpText!: Phaser.GameObjects.Text;
    private expBarFill!: Phaser.GameObjects.Rectangle;
    private levelText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private weaponText!: Phaser.GameObjects.Text;
    private mpBarFill!: Phaser.GameObjects.Rectangle;
    private mpText!: Phaser.GameObjects.Text;
    private hpPotionText!: Phaser.GameObjects.Text;
    private mpPotionText!: Phaser.GameObjects.Text;
    private sessionStartMs = 0;
    private lastPersistMs = 0;
    private pageHideHandler?: () => void;
    private sessionKills = 0;
    private bossActive = false;
    private npcClerk?: Phaser.GameObjects.Image;
    private npcBangMark?: Phaser.GameObjects.Text;
    private questDialogOpen = false;
    private mapConfig!: MapConfig;
    private portals: Phaser.GameObjects.GameObject[] = [];
    // 主角動作 state machine — 楓谷風:不同武器類別不同 attack 動作
    private playerAnimState: 'idle' | 'walking' = 'idle';
    private playerStateTween?: Phaser.Tweens.Tween;
    private playerAttackTween?: Phaser.Tweens.TweenChain;

    private static readonly PERSIST_THROTTLE_MS = 3000; // per Codex review

    // Attack range / interval / damage 改 per-weapon(WeaponService),這裡只留 crit
    private static readonly CRIT_CHANCE = 0.15;
    private static readonly CRIT_MULT = 1.5;
    private static readonly MOVE_SPEED = 0.4;        // 玩家 px/ms
    // 怪 speed 改 per-blueprint;以下參數仍 global
    private static readonly MOB_AGGRO_RANGE = 350;
    private static readonly MOB_LOST_RANGE = 500;
    private static readonly MOB_WANDER_RADIUS = 200;
    private static readonly MOB_WANDER_INTERVAL_MS = 2500;
    private static readonly MOB_CONTACT_RANGE = 65;  // 圓形碰撞半徑
    private static readonly MOB_CONTACT_COOLDOWN_MS = 800; // 怪 0.8s 才能再打一次同一玩家
    private static readonly PLAYER_INVULN_MS = 500;
    private static readonly PLAYER_MAX_HP = 100;
    private static readonly HP_BAR_WIDTH = 400;
    private static readonly HP_BAR_HEIGHT = 24;

    constructor () { super('Game'); }

    create ()
    {
        this.playerHP = Game.PLAYER_MAX_HP;
        this.playerInvulnUntilMs = 0;
        this.attackCooldownMs = 0;
        this.isGameOver = false;
        this.sessionKills = 0;
        this.bossActive = false;
        this.mobs = [];
        this.portals = [];
        this.npcClerk = undefined;
        this.npcBangMark = undefined;

        // Phase 4b-3:讀 current map config
        this.mapConfig = getMap(SaveService.instance.getCurrentMapId());
        const mapW = this.mapConfig.width;
        const mapH = this.mapConfig.height;

        this.cameras.main.setBackgroundColor(this.mapConfig.bgColor);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        // 地面網格(整張地圖)
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x4a5d3a, 0.3);
        for (let x = 0; x <= mapW; x += 120) { grid.moveTo(x, 0); grid.lineTo(x, mapH); }
        for (let y = 0; y <= mapH; y += 120) { grid.moveTo(0, y); grid.lineTo(mapW, y); }
        grid.strokePath();

        // 地圖邊框(廢墟柵欄)
        this.add.rectangle(mapW / 2, mapH / 2, mapW, mapH, 0, 0)
            .setStrokeStyle(8, 0x8b3a1f, 0.5);

        // 玩家出生點:從 SaveService(若有 portal enter pos)或 mapConfig.playerStart
        const enterPos = SaveService.instance.consumeMapEnterPos();
        const startX = enterPos.x ?? this.mapConfig.playerStartX;
        const startY = enterPos.y ?? this.mapConfig.playerStartY;
        this.player = this.add.image(startX, startY, 'player_scavver').setScale(0.3);
        this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
        // 開始 idle 動畫(state machine 控制 idle/walk/attack 切換,force first start)
        this.setPlayerAnimState('idle', true);

        // NPC 從 mapConfig.npcs(Phase 4b-3:NPC 移到公會地圖)
        this.mapConfig.npcs.forEach((npc: NpcSpec) => {
            if (npc.type === 'clerk') {
                this.npcClerk = this.add.image(npc.x, npc.y, npc.spriteKey).setScale(npc.scale);
                this.npcClerk.setInteractive({ useHandCursor: true });
                this.npcClerk.on('pointerdown', () => {
                    if (!this.npcClerk) return;
                    const d = Math.hypot(this.player.x - this.npcClerk.x, this.player.y - this.npcClerk.y);
                    if (d > 160) return;
                    this.joystick.cancel();
                    this.openQuestDialog();
                });
            }
        });
        // Portals 從 mapConfig.portals(傳送門)
        this.mapConfig.portals.forEach((p: PortalSpec) => this.spawnPortal(p));
        // NPC clerk 的 ! 漂浮提示(若有 clerk on map)
        const clerk = this.npcClerk as Phaser.GameObjects.Image | undefined;
        if (clerk) {
            const clerkX = clerk.x;
            const clerkY = clerk.y;
            this.npcBangMark = this.add.text(clerkX, clerkY - 130, '!', {
                fontFamily: 'sans-serif', fontSize: 64, color: '#ffe060', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 6
            }).setOrigin(0.5).setDepth(500);
            this.tweens.add({
                targets: this.npcBangMark,
                y: clerkY - 140, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
        }

        HitStopService.instance.attach(this);

        // Spawn points 從 mapConfig(Phase 4b-3)
        this.spawnPoints = this.mapConfig.spawnPoints.map(p => ({
            x: p.x, y: p.y, mob: null, nextSpawnAt: 0, blueprintIdx: p.blueprintIdx
        }));

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
        // 手機虛擬搖桿(bottom-left)— Dash 暫移除,等下次設計
        // Joystick 用 VIEW 尺寸(scrollFactor 0 跟著 camera 不動)
        this.joystick = new VirtualJoystick(this, { x: 220, y: VIEW_H - 280, radius: 130 });

        // Save 載入
        const save = SaveService.instance.get();
        this.sessionStartMs = this.time.now;
        this.lastPersistMs = 0;

        // pagehide flush(per Codex review):mobile 切後台 / tab 關閉前最後寫入
        this.pageHideHandler = () => {
            SaveService.instance.addPlaytimeSec(Math.floor((this.time.now - this.sessionStartMs) / 1000));
            SaveService.instance.save();
            this.sessionStartMs = this.time.now; // reset 避免重複計算
        };
        window.addEventListener('pagehide', this.pageHideHandler);
        // Phaser scene shutdown 時移除 listener
        this.events.once('shutdown', () => {
            if (this.pageHideHandler) window.removeEventListener('pagehide', this.pageHideHandler);
        });

        // HUD 全部 scrollFactor(0):camera 移動時 UI 不跟著動
        const barX = (VIEW_W - Game.HP_BAR_WIDTH) / 2;
        const barY = 50;
        this.add.rectangle(barX, barY, Game.HP_BAR_WIDTH, Game.HP_BAR_HEIGHT, 0x2a1010)
            .setOrigin(0, 0).setStrokeStyle(2, 0x8b3a1f).setDepth(1000).setScrollFactor(0);
        this.hpBarFill = this.add.rectangle(barX + 2, barY + 2, Game.HP_BAR_WIDTH - 4, Game.HP_BAR_HEIGHT - 4, 0xc23a1a)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.hpText = this.add.text(VIEW_W / 2, barY + Game.HP_BAR_HEIGHT / 2, `${this.playerHP} / ${Game.PLAYER_MAX_HP}`, {
            fontFamily: 'monospace', fontSize: 18, color: '#ffe0c0'
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        // MP bar(HP bar 正下方,藍色)
        const mpBarY = barY + Game.HP_BAR_HEIGHT + 6;
        const mpBarH = 18;
        this.add.rectangle(barX, mpBarY, Game.HP_BAR_WIDTH, mpBarH, 0x10202a)
            .setOrigin(0, 0).setStrokeStyle(2, 0x4080ff).setDepth(1000).setScrollFactor(0);
        const mpRatio = save.mp / save.maxMp;
        this.mpBarFill = this.add.rectangle(barX + 2, mpBarY + 2, (Game.HP_BAR_WIDTH - 4) * mpRatio, mpBarH - 4, 0x4080ff)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.mpText = this.add.text(VIEW_W / 2, mpBarY + mpBarH / 2, `MP ${save.mp} / ${save.maxMp}`, {
            fontFamily: 'monospace', fontSize: 14, color: '#ffe0c0'
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        const expBarY = mpBarY + mpBarH + 8;
        const expBarH = 14;
        this.add.rectangle(barX, expBarY, Game.HP_BAR_WIDTH, expBarH, 0x2a2010)
            .setOrigin(0, 0).setStrokeStyle(2, 0x4a5d3a).setDepth(1000).setScrollFactor(0);
        const expRatio = save.exp / SaveService.instance.expToNext();
        this.expBarFill = this.add.rectangle(barX + 2, expBarY + 2, (Game.HP_BAR_WIDTH - 4) * expRatio, expBarH - 4, 0xb08850)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);

        this.levelText = this.add.text(barX, barY - 8, `Lv ${save.level}`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ff8830', fontStyle: 'bold'
        }).setOrigin(0, 1).setDepth(1002).setScrollFactor(0);
        this.goldText = this.add.text(barX + Game.HP_BAR_WIDTH, barY - 8, `💰 ${save.gold}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#ffe0c0'
        }).setOrigin(1, 1).setDepth(1002).setScrollFactor(0);

        const w0 = getWeapon(save.currentWeaponId);
        const enh0 = SaveService.instance.getWeaponEnh(save.currentWeaponId);
        this.weaponText = this.add.text(barX, expBarY + expBarH + 6, this.formatWeaponLabel(w0, enh0), {
            fontFamily: 'monospace', fontSize: 18, color: '#b08850'
        }).setOrigin(0, 0).setDepth(1002).setScrollFactor(0);
        this.refreshWeaponText();

        // HP / MP 藥水 quick button(HUD 右上)
        this.hpPotionText = this.add.text(VIEW_W - 30, 90, `🧪${save.hpPotions}`, {
            fontFamily: 'monospace', fontSize: 30, color: '#ff4040', fontStyle: 'bold',
            backgroundColor: '#2a1010', padding: { x: 12, y: 6 }
        }).setOrigin(1, 0).setDepth(1002).setScrollFactor(0).setInteractive({ useHandCursor: true });
        this.hpPotionText.on('pointerdown', () => this.useHpPotion());
        this.input.keyboard?.on('keydown-Q', () => this.useHpPotion());

        this.mpPotionText = this.add.text(VIEW_W - 30, 150, `🔮${save.mpPotions}`, {
            fontFamily: 'monospace', fontSize: 30, color: '#4080ff', fontStyle: 'bold',
            backgroundColor: '#102030', padding: { x: 12, y: 6 }
        }).setOrigin(1, 0).setDepth(1002).setScrollFactor(0).setInteractive({ useHandCursor: true });
        this.mpPotionText.on('pointerdown', () => this.useMpPotion());
        this.input.keyboard?.on('keydown-E', () => this.useMpPotion());

        // 底部 5 tab UI 取代右上 ⚒ / 🎰 button(Phase 4b-5)
        this.buildBottomTabs();
    }

    private useHpPotion() {
        if (this.isGameOver) return;
        if (!SaveService.instance.useHpPotion()) {
            this.flashHudMessage('🧪 沒有藥水', 0xff4040);
            return;
        }
        const heal = 50;
        this.playerHP = Math.min(Game.PLAYER_MAX_HP, this.playerHP + heal);
        this.hpBarFill.width = (Game.HP_BAR_WIDTH - 4) * (this.playerHP / Game.PLAYER_MAX_HP);
        this.hpText.setText(`${this.playerHP} / ${Game.PLAYER_MAX_HP}`);
        this.hpPotionText.setText(`🧪${SaveService.instance.getHpPotions()}`);
        this.flashHudMessage(`+${heal} HP`, 0xff4040);
        SaveService.instance.save();
    }

    private useMpPotion() {
        if (this.isGameOver) return;
        if (!SaveService.instance.useMpPotion()) {
            this.flashHudMessage('🔮 沒有藥水', 0x4080ff);
            return;
        }
        const restore = 30;
        const save = SaveService.instance;
        save.setMp(save.getMp() + restore);
        const cur = save.get();
        this.mpBarFill.width = (Game.HP_BAR_WIDTH - 4) * (cur.mp / cur.maxMp);
        this.mpText.setText(`MP ${cur.mp} / ${cur.maxMp}`);
        this.mpPotionText.setText(`🔮${save.getMpPotions()}`);
        this.flashHudMessage(`+${restore} MP`, 0x4080ff);
        save.save();
    }

    private flashHudMessage(msg: string, color: number) {
        const t = this.add.text(VIEW_W / 2, 220, msg, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5).setDepth(2000).setScrollFactor(0);
        t.setTint(color);
        this.tweens.add({
            targets: t, y: t.y - 50, alpha: 0, duration: 800,
            onComplete: () => t.destroy()
        });
    }


    private buildBottomTabs() {
        const tabH = 90;
        const tabY = VIEW_H - tabH / 2 - 10;
        const tabs = [
            { icon: '📦', label: '倉庫', scene: 'Storage', key: 'B' },
            { icon: '⚒', label: '裝備', scene: 'Inventory', key: 'I' },
            { icon: '🎰', label: '夥伴', scene: 'Gacha', key: 'G' },
            { icon: '🛒', label: '商店', scene: 'Shop', key: 'M' },
            { icon: '🌳', label: '天賦', scene: 'Talent', key: 'T' }
        ];
        const tabW = VIEW_W / tabs.length;

        // 底部 bar bg
        this.add.rectangle(0, tabY - tabH / 2, VIEW_W, tabH, 0x1a1612, 0.92)
            .setOrigin(0, 0).setDepth(1000).setScrollFactor(0)
            .setStrokeStyle(2, 0xff8830, 0.6);

        tabs.forEach((t, i) => {
            const cx = tabW * (i + 0.5);
            const c = this.add.container(cx, tabY).setDepth(1001).setScrollFactor(0);
            const bg = this.add.rectangle(0, 0, tabW - 8, tabH - 12, 0x2a2520, 0.7)
                .setStrokeStyle(1, 0x4a3a30);
            const icon = this.add.text(0, -18, t.icon, {
                fontFamily: 'sans-serif', fontSize: 28, color: '#ff8830'
            }).setOrigin(0.5);
            const label = this.add.text(0, 22, t.label, {
                fontFamily: 'sans-serif', fontSize: 18, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5);
            c.add([bg, icon, label]);
            c.setSize(tabW - 8, tabH - 12);
            c.setInteractive({ useHandCursor: true });
            c.on('pointerdown', () => this.openTabScene(t.scene));
            this.input.keyboard?.on(`keydown-${t.key}`, () => this.openTabScene(t.scene));
        });

        // hint 文字往上推(blocked by tab bar)
        this.add.text(20, tabY - tabH / 2 - 30, '搖桿移動 / WASD / 方向鍵', {
            fontFamily: 'sans-serif', fontSize: 18, color: '#a05a30'
        }).setDepth(1000).setScrollFactor(0);
    }

    private openTabScene(sceneKey: string) {
        if (this.isGameOver) return;
        if (this.scene.isActive(sceneKey)) return;
        // 任一 tab 開啟時關閉其他 active tab(避免重疊)
        ['Storage', 'Inventory', 'Gacha', 'Shop', 'Talent'].forEach(k => {
            if (k !== sceneKey && this.scene.isActive(k)) this.scene.stop(k);
        });
        this.joystick.cancel();
        this.scene.launch(sceneKey);
        this.scene.pause();
    }


    update (time: number, delta: number)
    {
        if (this.isGameOver) return;
        if (this.questDialogOpen) return;
        this.handleMovement(delta);
        this.handleSpawn(time);
        this.trySpawnBoss(time);
        this.handleMobAI(time, delta);
        this.handleMobContactDamage(time);
        if (this.isGameOver) return;
        this.handleAutoAttack(time, delta);
        this.updateNpcBangVisibility();
    }

    // 當前可接 / 可領的 quest(prereq 完成 + 自己未領)
    private getCurrentQuest(): QuestDef | null {
        const save = SaveService.instance;
        for (const q of QUESTS) {
            if (save.isQuestCompleted(q.id)) continue;
            if (q.prereqQuestId && !save.isQuestCompleted(q.prereqQuestId)) continue;
            return q;
        }
        return null;
    }

    private updateNpcBangVisibility()
    {
        // 任務可領取(progress >= target)→ 黃 ! 變紅 !!
        if (!this.npcBangMark) return;
        const q = this.getCurrentQuest();
        if (!q) {
            this.npcBangMark.setVisible(false);
            return;
        }
        this.npcBangMark.setVisible(true);
        const progress = SaveService.instance.getQuestProgress(q.id);
        if (progress >= q.targetCount) {
            this.npcBangMark.setText('!!').setColor('#ff4040');
        } else {
            this.npcBangMark.setText('!').setColor('#ffe060');
        }
    }

    private openQuestDialog()
    {
        if (this.questDialogOpen) return;
        const q = this.getCurrentQuest();
        if (!q) return;
        this.questDialogOpen = true;
        const save = SaveService.instance;
        const progress = save.getQuestProgress(q.id);
        const isReady = progress >= q.targetCount;

        // Quest dialog viewport-fixed(per Codex review:VIEW_W/H + scrollFactor 0)
        const bg = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W - 80, 700, 0x1a1612, 0.97)
            .setStrokeStyle(4, 0xff8830).setDepth(2000).setScrollFactor(0);
        const title = this.add.text(VIEW_W / 2, VIEW_H / 2 - 280, `📜 ${q.nameZH}`, {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2001).setScrollFactor(0);
        const desc = this.add.text(VIEW_W / 2, VIEW_H / 2 - 160, q.descZH, {
            fontFamily: 'sans-serif', fontSize: 28, color: '#ffe0c0',
            wordWrap: { width: VIEW_W - 160 }, align: 'center'
        }).setOrigin(0.5).setDepth(2001).setScrollFactor(0);
        const prog = this.add.text(VIEW_W / 2, VIEW_H / 2 - 30,
            `進度:${progress} / ${q.targetCount}`, {
            fontFamily: 'monospace', fontSize: 36,
            color: isReady ? '#4a5d3a' : '#b08850'
        }).setOrigin(0.5).setDepth(2001).setScrollFactor(0);
        const reward = this.add.text(VIEW_W / 2, VIEW_H / 2 + 60,
            `獎勵:💰 ${q.rewardGold} + ${q.rewardExp} EXP`, {
            fontFamily: 'monospace', fontSize: 28, color: '#ffe060'
        }).setOrigin(0.5).setDepth(2001).setScrollFactor(0);

        // 按鈕:領獎 / 接受 / 關閉
        let actionBtnLabel: string;
        let actionFn: () => void;
        if (isReady) {
            actionBtnLabel = '✓ 領取獎勵';
            actionFn = () => this.claimQuestReward(q);
        } else {
            actionBtnLabel = '接受任務';
            actionFn = () => this.closeQuestDialog([bg, title, desc, prog, reward, action, close]);
        }
        const action = this.add.text(VIEW_W / 2 - 130, VIEW_H / 2 + 200, actionBtnLabel, {
            fontFamily: 'sans-serif', fontSize: 32, color: '#1a1612', fontStyle: 'bold',
            backgroundColor: isReady ? '#4a5d3a' : '#ff8830', padding: { x: 24, y: 14 }
        }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setInteractive({ useHandCursor: true });
        action.on('pointerdown', () => {
            actionFn();
            if (isReady) {
                // refresh dialog 內容(進入 next quest 或關閉)
                [bg, title, desc, prog, reward, action, close].forEach(o => o.destroy());
                this.questDialogOpen = false;
                this.time.delayedCall(100, () => {
                    if (this.getCurrentQuest()) this.openQuestDialog();
                });
            }
        });

        const close = this.add.text(VIEW_W / 2 + 130, VIEW_H / 2 + 200, '✕ 關閉', {
            fontFamily: 'sans-serif', fontSize: 32, color: '#ffe0c0',
            backgroundColor: '#4a3a30', padding: { x: 24, y: 14 }
        }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setInteractive({ useHandCursor: true });
        close.on('pointerdown', () => this.closeQuestDialog([bg, title, desc, prog, reward, action, close]));
    }

    private closeQuestDialog(objs: Phaser.GameObjects.GameObject[])
    {
        objs.forEach(o => o.destroy());
        this.questDialogOpen = false;
    }

    private claimQuestReward(q: QuestDef)
    {
        const save = SaveService.instance;
        save.addGold(q.rewardGold);
        const res = save.addExp(q.rewardExp);
        save.markQuestCompleted(q.id);
        save.save();
        this.goldText.setText(`💰 ${save.get().gold}`);
        if (res.leveled) {
            this.levelText.setText(`Lv ${save.get().level}`);
            this.spawnLevelUpEffect(res.levelsGained);
        }
        // 完成 popup
        const t = this.add.text(VIEW_W / 2, VIEW_H / 2 - 350, `任務完成!+${q.rewardGold}💰 +${q.rewardExp} EXP`, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#ffe060', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5).setDepth(3000).setScrollFactor(0);
        this.tweens.add({
            targets: t, y: t.y - 80, alpha: 0, duration: 1500,
            onComplete: () => t.destroy()
        });
    }

    public refreshWeaponText() {
        const id = SaveService.instance.getCurrentWeaponId();
        const w = getWeapon(id);
        const enh = SaveService.instance.getWeaponEnh(id);
        this.weaponText.setText(this.formatWeaponLabel(w, enh));
    }

    private formatWeaponLabel(w: WeaponDef, enh: number): string {
        const dmg = effectiveDamage(w, enh);
        return enh > 0 ? `⚔ ${w.nameZH} +${enh} [${dmg}]` : `⚔ ${w.nameZH} [${dmg}]`;
    }

    private spawnPortal(p: PortalSpec) {
        // 傳送門:廢土橙圓形 + label,tap 切地圖
        const ring = this.add.circle(p.x, p.y, 60, 0xff8830, 0.35)
            .setStrokeStyle(4, 0xffe0c0, 0.9);
        ring.setInteractive({ useHandCursor: true });
        // 漂浮動畫
        this.tweens.add({
            targets: ring, scale: 1.15, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
        const label = this.add.text(p.x, p.y - 90, p.label, {
            fontFamily: 'sans-serif', fontSize: 24, color: '#ffe0c0', fontStyle: 'bold',
            backgroundColor: '#1a1612', padding: { x: 14, y: 6 },
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setDepth(500);
        ring.on('pointerdown', () => {
            // 必須玩家在 160px 內才能用
            const d = Math.hypot(this.player.x - p.x, this.player.y - p.y);
            if (d > 160) return;
            this.joystick.cancel();
            this.switchMap(p.targetMapId, p.targetX, p.targetY);
        });
        this.portals.push(ring, label);
    }

    private switchMap(targetMapId: string, targetX: number, targetY: number) {
        SaveService.instance.setCurrentMap(targetMapId, targetX, targetY);
        SaveService.instance.save();
        this.scene.restart();
    }

    // 楓谷風 state machine:idle / walking / attacking(by weapon)
    private setPlayerAnimState(state: 'idle' | 'walking', force = false) {
        if (!force && this.playerAnimState === state) return;
        this.playerAnimState = state;
        if (this.playerStateTween) this.playerStateTween.stop();
        // 重置 transform(attack 後可能殘留)
        this.player.angle = 0;
        this.player.setScale(0.3);
        if (state === 'idle') {
            // 站立:輕微呼吸 scaleY
            this.playerStateTween = this.tweens.add({
                targets: this.player, scaleY: 0.31,
                duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
        } else {
            // 走路:垂直彈跳 + 輕度搖晃
            this.playerStateTween = this.tweens.add({
                targets: this.player, scaleY: 0.28,
                duration: 180, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
        }
    }

    // 攻擊動畫 — 5 武器類別各不同(楓谷風)
    private playWeaponAttackAnim(weapon: WeaponDef, targetX: number, _targetY: number) {
        if (this.playerAttackTween?.isPlaying()) this.playerAttackTween.stop();
        // 攻擊期間 stop 走路/idle tween 避免衝突
        if (this.playerStateTween) this.playerStateTween.stop();
        this.player.setScale(0.3);
        // 朝 target 方向 face
        if (targetX < this.player.x) this.player.setFlipX(true);
        else this.player.setFlipX(false);
        const flip = this.player.flipX ? -1 : 1;

        const restoreState = () => {
            // 攻擊結束:回復 state machine 動畫
            const s = this.playerAnimState;
            // force re-enter same state to restart tween
            this.playerAnimState = s === 'idle' ? 'walking' : 'idle';
            this.setPlayerAnimState(s);
        };

        switch (weapon.category) {
            case 'Stick': {
                // 木棍:橫向大揮 ±30°
                this.playerAttackTween = this.tweens.chain({
                    targets: this.player,
                    tweens: [
                        { angle: -28 * flip, duration: 60, ease: 'Quad.out' },
                        { angle: 28 * flip, duration: 110, ease: 'Quad.in' },
                        { angle: 0, duration: 90, ease: 'Quad.out' }
                    ],
                    onComplete: restoreState
                });
                break;
            }
            case 'Blade': {
                // 刀:快速 lunge stretch(不動 player.x,改 scaleX 拉伸暗示 — per Codex review)
                void flip;
                this.playerAttackTween = this.tweens.chain({
                    targets: this.player,
                    tweens: [
                        { scaleX: 0.38, scaleY: 0.28, duration: 60, ease: 'Cubic.out' },
                        { scaleX: 0.30, scaleY: 0.30, duration: 100, ease: 'Cubic.in' }
                    ],
                    onComplete: restoreState
                });
                break;
            }
            case 'Hammer': {
                // 鋼筋棒:慢重 overhead 揮(scale grow + 大 rotation)
                this.playerAttackTween = this.tweens.chain({
                    targets: this.player,
                    tweens: [
                        { angle: -55 * flip, scale: 0.33, duration: 160, ease: 'Sine.in' },
                        { angle: 50 * flip, duration: 180, ease: 'Quad.in' },
                        { angle: 0, scale: 0.30, duration: 100, ease: 'Sine.out' }
                    ],
                    onComplete: restoreState
                });
                break;
            }
            case 'Ranged': {
                // 彈弓:壓縮拉弓 → 釋放(不動 player.x,per Codex review)
                this.playerAttackTween = this.tweens.chain({
                    targets: this.player,
                    tweens: [
                        { scaleX: 0.26, scaleY: 0.33, duration: 140, ease: 'Quad.out' },
                        { scaleX: 0.34, scaleY: 0.28, duration: 70, ease: 'Cubic.in' },
                        { scaleX: 0.30, scaleY: 0.30, duration: 80, ease: 'Sine.out' }
                    ],
                    onComplete: restoreState
                });
                break;
            }
            case 'Special': {
                // 手套:快速 4-pulse combo
                this.playerAttackTween = this.tweens.chain({
                    targets: this.player,
                    tweens: [
                        { scale: 0.33, angle: 5 * flip, duration: 45 },
                        { scale: 0.30, angle: -5 * flip, duration: 45 },
                        { scale: 0.33, angle: 5 * flip, duration: 45 },
                        { scale: 0.30, angle: 0, duration: 45 }
                    ],
                    onComplete: restoreState
                });
                break;
            }
            default: {
                restoreState();
            }
        }
    }

    private spawnSwingEffect(targetX: number, targetY: number, isCrit: boolean)
    {
        const angle = Math.atan2(targetY - this.player.y, targetX - this.player.x);
        const arcR = isCrit ? 210 : 180;
        const halfSpread = Math.PI / 6; // 60° 弧
        const startA = angle - halfSpread;
        const endA = angle + halfSpread;
        const g = this.add.graphics();
        // 外弧(粗,廢土橙;crit 紅)
        g.lineStyle(10, isCrit ? 0xff4040 : 0xff8830, 0.9);
        g.beginPath();
        g.arc(this.player.x, this.player.y, arcR, startA, endA);
        g.strokePath();
        // 內弧 highlight(白)
        g.lineStyle(3, 0xffffff, 0.7);
        g.beginPath();
        g.arc(this.player.x, this.player.y, arcR - 6, startA + 0.05, endA - 0.05);
        g.strokePath();
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: isCrit ? 200 : 130,
            onComplete: () => g.destroy()
        });
    }

    private handleMovement(delta: number)
    {
        let dx = 0, dy = 0;
        if (this.joystick.active) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        } else {
            if (this.cursors.left.isDown || this.wasd.A.isDown)  dx -= 1;
            if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
            if (this.cursors.up.isDown    || this.wasd.W.isDown) dy -= 1;
            if (this.cursors.down.isDown  || this.wasd.S.isDown) dy += 1;
        }
        const mag = Math.hypot(dx, dy);
        if (mag < 0.01) {
            // 靜止 — 切回 idle(若不是 attack 中)
            if (this.playerAnimState !== 'idle' && !this.playerAttackTween?.isPlaying()) {
                this.setPlayerAnimState('idle');
            }
            return;
        }
        const normDx = mag > 1 ? dx / mag : dx;
        const normDy = mag > 1 ? dy / mag : dy;
        const nx = this.player.x + normDx * Game.MOVE_SPEED * delta;
        const ny = this.player.y + normDy * Game.MOVE_SPEED * delta;
        this.player.x = Math.max(60, Math.min(this.mapConfig.width - 60, nx));
        this.player.y = Math.max(60, Math.min(this.mapConfig.height - 60, ny));
        if (Math.abs(normDx) > 0.1) this.player.setFlipX(normDx < 0);
        // state machine:走路時切 walking,讓 walk tween 跑
        if (this.playerAnimState !== 'walking' && !this.playerAttackTween?.isPlaying()) {
            this.setPlayerAnimState('walking');
        }
    }

    private handleSpawn(time: number)
    {
        for (const sp of this.spawnPoints) {
            if (sp.mob === null && time >= sp.nextSpawnAt) {
                const bp = MOB_BLUEPRINTS[sp.blueprintIdx];
                const mob = this.add.image(sp.x, sp.y, bp.spriteKey).setScale(bp.scale);
                if (bp.tint !== undefined) {
                    mob.setTint(bp.tint).setTintMode(TINT_FILL);
                }
                const data: MobData = {
                    blueprint: bp,
                    hp: bp.hp,
                    spawnPoint: sp,
                    lastContactMs: -Infinity,
                    state: 'wander',
                    wanderTargetX: sp.x,
                    wanderTargetY: sp.y,
                    nextWanderAt: 0
                };
                mob.setData('mob', data);
                sp.mob = mob;
                this.mobs.push(mob);
            }
        }
    }

    private handleMobAI(time: number, delta: number)
    {
        for (const m of this.mobs) {
            if (!m.active) continue;
            const data = m.getData('mob') as MobData;

            // 距離 player
            const pdx = this.player.x - m.x;
            const pdy = this.player.y - m.y;
            const pd = Math.hypot(pdx, pdy);

            // state transition(hysteresis 防抖)
            if (data.state === 'wander' && pd < Game.MOB_AGGRO_RANGE) {
                data.state = 'chase';
            } else if (data.state === 'chase' && pd > Game.MOB_LOST_RANGE) {
                data.state = 'wander';
                data.nextWanderAt = 0; // 立刻換 wander target
            }

            if (data.state === 'chase') {
                if (pd < 1) continue;
                m.x += (pdx / pd) * data.blueprint.speedChase * delta;
                m.y += (pdy / pd) * data.blueprint.speedChase * delta;
                if (Math.abs(pdx) > 1) m.setFlipX(pdx < 0);
            } else {
                // wander:boss 沒 spawnPoint,直接跳過 wander(boss state 永遠 chase)
                if (!data.spawnPoint) continue;
                if (time >= data.nextWanderAt) {
                    const a = Math.random() * Math.PI * 2;
                    const r = Math.random() * Game.MOB_WANDER_RADIUS;
                    data.wanderTargetX = data.spawnPoint.x + Math.cos(a) * r;
                    data.wanderTargetY = data.spawnPoint.y + Math.sin(a) * r;
                    data.nextWanderAt = time + Game.MOB_WANDER_INTERVAL_MS;
                }
                const wdx = data.wanderTargetX - m.x;
                const wdy = data.wanderTargetY - m.y;
                const wd = Math.hypot(wdx, wdy);
                if (wd < 5) continue; // 已到 target,等下次換
                m.x += (wdx / wd) * data.blueprint.speedWander * delta;
                m.y += (wdy / wd) * data.blueprint.speedWander * delta;
                if (Math.abs(wdx) > 1) m.setFlipX(wdx < 0);
            }
        }
    }

    private handleMobContactDamage(time: number)
    {
        if (time < this.playerInvulnUntilMs) return;
        for (const m of this.mobs) {
            if (!m.active) continue;
            const data = m.getData('mob') as MobData;
            if (time - data.lastContactMs < Game.MOB_CONTACT_COOLDOWN_MS) continue;
            const d = Math.hypot(this.player.x - m.x, this.player.y - m.y);
            if (d < Game.MOB_CONTACT_RANGE) {
                data.lastContactMs = time;
                this.takeDamage(data.blueprint.contactDamage, time);
                return; // 一個 frame 只扣一次,不疊
            }
        }
    }

    private takeDamage(amount: number, time: number)
    {
        if (this.isGameOver) return; // per Codex review
        this.playerHP = Math.max(0, this.playerHP - amount);
        this.playerInvulnUntilMs = time + Game.PLAYER_INVULN_MS;

        // 血條 + 文字
        const ratio = this.playerHP / Game.PLAYER_MAX_HP;
        this.hpBarFill.width = (Game.HP_BAR_WIDTH - 4) * ratio;
        this.hpText.setText(`${this.playerHP} / ${Game.PLAYER_MAX_HP}`);

        // HP=0 → GameOver 早退,不放 flash 否則 clearTint 會蓋掉死亡 tint
        if (this.playerHP <= 0) {
            this.handleGameOver();
            return;
        }

        // 受擊 flash + shake(只在還活著時)
        this.player.setTint(0xff4040).setTintMode(TINT_FILL);
        this.time.delayedCall(120, () => {
            if (!this.isGameOver && this.player.active) this.player.clearTint();
        });
        this.cameras.main.shake(150, 0.012);

        const text = this.add.text(this.player.x, this.player.y - 60, `-${amount}`, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#ff4040',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);
        this.tweens.add({
            targets: text, y: text.y - 80, alpha: 0,
            duration: 600, onComplete: () => text.destroy()
        });
    }

    private handleGameOver()
    {
        if (this.isGameOver) return;
        this.isGameOver = true;
        // per Phase 4b-4:死亡 → 等級保留 / 經驗條歸零(金幣等其他 stat 不動)
        SaveService.instance.addPlaytimeSec(Math.floor((this.time.now - this.sessionStartMs) / 1000));
        SaveService.instance.resetExpKeepLevel();
        SaveService.instance.save();
        this.player.setTint(0x8b3a1f).setTintMode(TINT_FILL);
        this.cameras.main.shake(400, 0.025);
        this.time.delayedCall(800, () => {
            if (this.scene.isActive()) this.scene.start('GameOver');
        });
    }

    private handleAutoAttack(time: number, delta: number)
    {
        if (this.isGameOver) return;
        this.attackCooldownMs -= delta;
        if (this.attackCooldownMs > 0) return;

        // 用當前武器 spec(per WeaponService)
        const weapon = getWeapon(SaveService.instance.getCurrentWeaponId());
        const enh = SaveService.instance.getWeaponEnh(weapon.id);
        const baseDmg = effectiveDamage(weapon, enh);

        let nearest: Phaser.GameObjects.Image | null = null;
        let nearestDist = weapon.range;
        for (const m of this.mobs) {
            if (!m.active) continue;
            const d = Math.hypot(this.player.x - m.x, this.player.y - m.y);
            if (d < nearestDist) { nearestDist = d; nearest = m; }
        }
        if (!nearest) return;

        this.attackCooldownMs = weapon.attackIntervalMs;
        const target = nearest;
        const isCrit = Math.random() < Game.CRIT_CHANCE;
        const dmg = Math.round(baseDmg * (isCrit ? Game.CRIT_MULT : 1));

        // Hand Rag recovery — 命中回血 0.5% × baseDmg
        if (weapon.recoveryPercent && this.playerHP < Game.PLAYER_MAX_HP) {
            const heal = Math.max(1, Math.round(baseDmg * weapon.recoveryPercent * 100));
            this.playerHP = Math.min(Game.PLAYER_MAX_HP, this.playerHP + heal);
            this.hpBarFill.width = (Game.HP_BAR_WIDTH - 4) * (this.playerHP / Game.PLAYER_MAX_HP);
            this.hpText.setText(`${this.playerHP} / ${Game.PLAYER_MAX_HP}`);
        }
        // Pebble Sling knockback — mob 朝玩家反方向位移 + 邊界 clamp(per Codex review)
        if (weapon.knockbackPx && nearest.active) {
            const dx = nearest.x - this.player.x;
            const dy = nearest.y - this.player.y;
            const len = Math.hypot(dx, dy) || 1;
            nearest.x = Math.max(60, Math.min(this.mapConfig.width - 60, nearest.x + (dx / len) * weapon.knockbackPx));
            nearest.y = Math.max(60, Math.min(this.mapConfig.height - 60, nearest.y + (dy / len) * weapon.knockbackPx));
        }

        const data = target.getData('mob') as MobData;
        data.hp -= dmg;

        // 武器類別專屬玩家動作(楓谷風)
        this.playWeaponAttackAnim(weapon, target.x, target.y);

        // 木棍揮砍視覺(廢土橙弧線從 player 朝 target 揮 60°)
        this.spawnSwingEffect(target.x, target.y, isCrit);

        // Hit flash + 還原:rage boss 用 0xff2020,普通 用 blueprint.tint(per Codex review)
        target.setTint(0xffffff).setTintMode(TINT_FILL);
        this.time.delayedCall(100, () => {
            if (!target.active) return;
            const tData = target.getData('mob') as MobData | undefined;
            if (!tData) { target.clearTint(); return; }
            if (tData.isRaging) {
                target.setTint(0xff2020).setTintMode(TINT_FILL);
            } else if (tData.blueprint.tint !== undefined) {
                target.setTint(tData.blueprint.tint).setTintMode(TINT_FILL);
            } else {
                target.clearTint();
            }
        });

        // Damage popup(crit 紅大 / 普通橘小)
        const dmgText = this.add.text(target.x, target.y - 50, isCrit ? `${dmg}!` : `${dmg}`, {
            fontFamily: 'sans-serif',
            fontSize: isCrit ? 56 : 32,
            color: isCrit ? '#ff4040' : '#ff8830',
            stroke: '#1a1612', strokeThickness: isCrit ? 6 : 4,
            fontStyle: isCrit ? 'bold' : 'normal'
        }).setOrigin(0.5);
        this.tweens.add({
            targets: dmgText,
            y: dmgText.y - (isCrit ? 110 : 80),
            alpha: 0,
            scale: isCrit ? 1.2 : 1,
            duration: isCrit ? 800 : 600,
            onComplete: () => dmgText.destroy()
        });

        // per Codex review:shake 必須在 HitStop 之前,否則 shake duration 被 timescale 拉長變黏膩
        this.cameras.main.shake(isCrit ? 120 : 50, isCrit ? 0.012 : 0.005);
        HitStopService.instance.trigger(isCrit ? 100 : 60, isCrit ? 0.03 : 0.05);

        // Boss rage transition(HP < threshold,只在還活著時觸發 per Codex review)
        if (data.hp > 0 && data.blueprint.isBoss && data.blueprint.rageThreshold && !data.isRaging) {
            if (data.hp / data.blueprint.hp < data.blueprint.rageThreshold) {
                data.isRaging = true;
                // rage 視覺 + 加速 30%
                target.setTint(0xff2020).setTintMode(TINT_FILL);
                this.cameras.main.shake(300, 0.018);
                this.spawnRageEffect(target.x, target.y);
            }
        }

        // 死亡 + cycle 重生(boss 不 cycle)+ reward
        if (data.hp <= 0) {
            const sp = data.spawnPoint;
            if (sp) {
                sp.mob = null;
                sp.nextSpawnAt = time + RESPAWN_CYCLE_MS;
            }
            this.mobs = this.mobs.filter(m => m !== target);
            this.spawnGoldDrop(target.x, target.y, data.blueprint.goldReward);
            this.grantKillReward(target.x, target.y, data.blueprint);
            if (data.blueprint.isBoss) {
                this.handleBossDefeated(target.x, target.y);
            }
            target.destroy();
        }
    }

    private handleBossDefeated(x: number, y: number)
    {
        this.bossActive = false;
        this.sessionKills = 0; // 下隻 boss 重數
        this.cameras.main.shake(500, 0.025);
        // 大號 BOSS DEFEATED popup
        const popup = this.add.text(VIEW_W / 2, VIEW_H / 2, 'BOSS 擊破!', {
            fontFamily: 'sans-serif', fontSize: 84, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#8b3a1f', strokeThickness: 10
        }).setOrigin(0.5).setDepth(3000).setScale(0.3).setScrollFactor(0);
        this.tweens.add({
            targets: popup, scale: 1.3, alpha: 0,
            duration: 1500, ease: 'Back.out',
            onComplete: () => popup.destroy()
        });
        // 大金幣 burst(8 個)
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const cx = x + Math.cos(a) * 120;
            const cy = y + Math.sin(a) * 120;
            this.spawnGoldDrop(cx, cy, 0);
        }
    }

    private spawnRageEffect(x: number, y: number)
    {
        // 鮮紅光環擴散
        const ring = this.add.circle(x, y, 40, 0xff2020, 0)
            .setStrokeStyle(8, 0xff2020, 1).setDepth(500);
        this.tweens.add({
            targets: ring, radius: 300, alpha: 0, duration: 700,
            onComplete: () => ring.destroy()
        });
        const txt = this.add.text(x, y - 100, '狂暴!', {
            fontFamily: 'sans-serif', fontSize: 48, color: '#ff2020', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5).setDepth(2500);
        this.tweens.add({
            targets: txt, y: txt.y - 70, alpha: 0, scale: 1.3, duration: 1000,
            onComplete: () => txt.destroy()
        });
    }

    private trySpawnBoss(time: number)
    {
        if (!this.mapConfig.bossEnabled) return; // 公會地圖無 boss
        if (this.bossActive) return;
        if (this.sessionKills < BOSS_TRIGGER_KILLS) return;
        this.bossActive = true;
        // Boss 出現:離 player ≥ 400px,角落補償(per Codex review,防角落 clamp 後太近)
        const MIN_DIST = 400;
        let bx = this.player.x, by = this.player.y;
        for (let tries = 0; tries < 16; tries++) {
            const angle = (tries / 16) * Math.PI * 2 + Math.random() * 0.2;
            bx = Math.max(120, Math.min(W - 120, this.player.x + Math.cos(angle) * 600));
            by = Math.max(120, Math.min(H - 120, this.player.y + Math.sin(angle) * 600));
            if (Math.hypot(bx - this.player.x, by - this.player.y) >= MIN_DIST) break;
        }
        const mob = this.add.image(bx, by, BOSS_GIANTRAT.spriteKey).setScale(BOSS_GIANTRAT.scale);
        if (BOSS_GIANTRAT.tint !== undefined) {
            mob.setTint(BOSS_GIANTRAT.tint).setTintMode(TINT_FILL);
        }
        const data: MobData = {
            blueprint: BOSS_GIANTRAT,
            hp: BOSS_GIANTRAT.hp,
            spawnPoint: null,
            lastContactMs: -Infinity,
            state: 'chase', // boss 永遠 chase
            wanderTargetX: bx,
            wanderTargetY: by,
            nextWanderAt: 0,
            isRaging: false
        };
        mob.setData('mob', data);
        this.mobs.push(mob);

        // Boss spawn 視覺
        this.cameras.main.shake(400, 0.020);
        const warn = this.add.text(VIEW_W / 2, VIEW_H / 2 - 200, '⚠ BOSS 出現!', {
            fontFamily: 'sans-serif', fontSize: 64, color: '#ff4040', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 8
        }).setOrigin(0.5).setDepth(3000).setScrollFactor(0);
        this.tweens.add({
            targets: warn, alpha: 0, scale: 1.5, duration: 1500,
            onComplete: () => warn.destroy()
        });
        void time;
    }

    private grantKillReward(x: number, y: number, bp: MobBlueprint)
    {
        const save = SaveService.instance;
        save.addKill();
        save.addGold(bp.goldReward);
        this.goldText.setText(`💰 ${save.get().gold}`);
        if (!bp.isBoss) this.sessionKills++;

        // Quest progress(自動 track 殺怪)
        const currentQuest = this.getCurrentQuest();
        if (currentQuest) {
            const isMatch =
                (currentQuest.objective === 'kill_mob' && currentQuest.targetMobId === bp.id) ||
                (currentQuest.objective === 'kill_boss' && currentQuest.targetMobId === bp.id && bp.isBoss);
            if (isMatch) {
                save.addQuestProgress(currentQuest.id, 1);
            }
        }

        const expGain = bp.expReward;
        const result = save.addExp(expGain);
        const expText = this.add.text(x, y - 80, `+${expGain} EXP`, {
            fontFamily: 'monospace', fontSize: 22, color: '#4a5d3a', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({
            targets: expText, y: expText.y - 60, alpha: 0,
            duration: 700, onComplete: () => expText.destroy()
        });

        // Update exp bar
        const cur = save.get();
        const ratio = cur.exp / save.expToNext();
        this.expBarFill.width = (Game.HP_BAR_WIDTH - 4) * ratio;

        if (result.leveled) {
            this.levelText.setText(`Lv ${cur.level}`);
            this.spawnLevelUpEffect(result.levelsGained);
            save.save(); // 升級立刻 persist
            this.lastPersistMs = Date.now();
        } else {
            // 普通殺怪 3s throttle persist(per Codex review:防 tab close 丟 exp/gold)
            this.saveProgressSoon();
        }
    }

    private saveProgressSoon()
    {
        const now = Date.now();
        if (now - this.lastPersistMs < Game.PERSIST_THROTTLE_MS) return;
        this.lastPersistMs = now;
        SaveService.instance.save();
    }

    private spawnLevelUpEffect(levelsGained: number)
    {
        const txt = levelsGained > 1 ? `LEVEL UP ×${levelsGained}!` : 'LEVEL UP!';
        const popup = this.add.text(this.player.x, this.player.y - 100, txt, {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#ff8830', strokeThickness: 6
        }).setOrigin(0.5).setDepth(2000).setScale(0.3);
        this.tweens.add({
            targets: popup, scale: 1.2, alpha: 0,
            y: popup.y - 120, duration: 1200,
            ease: 'Back.out',
            onComplete: () => popup.destroy()
        });
        // 廢土橙光環
        const ring = this.add.circle(this.player.x, this.player.y, 50, 0xff8830, 0)
            .setStrokeStyle(6, 0xff8830, 0.9).setDepth(500);
        this.tweens.add({
            targets: ring, radius: 220, alpha: 0, duration: 900,
            onComplete: () => ring.destroy()
        });
        this.cameras.main.shake(200, 0.008);
    }

    private spawnGoldDrop(x: number, y: number, amount: number)
    {
        // 簡易視覺:小金圓圈 + tween 飛向 player
        const coin = this.add.circle(x, y, 14, 0xffe060, 1)
            .setStrokeStyle(2, 0x8b6020).setDepth(400);
        this.tweens.add({
            targets: coin,
            x: this.player.x + (Math.random() - 0.5) * 30,
            y: this.player.y + (Math.random() - 0.5) * 30,
            duration: 400,
            ease: 'Cubic.in',
            onComplete: () => coin.destroy()
        });
        // amount 不視覺顯示(避免畫面亂),直接寫進 gold count
        void amount;
    }
}
