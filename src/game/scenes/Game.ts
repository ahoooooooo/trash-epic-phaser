import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';
import { VirtualJoystick } from '../services/VirtualJoystick';
import { SaveService } from '../services/SaveService';
import { effectiveDamage, getWeapon, WeaponDef } from '../services/WeaponService';
import { computeTalentBuff } from '../services/TalentService';
import { QUESTS, QuestDef } from '../services/QuestService';
import { getMap, MapConfig, NpcSpec, PortalSpec } from '../services/MapService';
import { generateRandomWeapon, weaponDisplayName, rarityColor } from '../services/WeaponGenerator';

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
    mob: Phaser.GameObjects.Sprite | null;
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
        spriteKey: 'mob_giantrat_run_a', scale: 0.18,
        hp: 50, speedChase: 0.10, speedWander: 0.04,
        contactDamage: 8, expReward: 5, goldReward: 3
    },
    {
        id: 'centipede', type: 'Insect',
        spriteKey: 'mob_centipede_wave_a', scale: 0.14,
        hp: 80, speedChase: 0.07, speedWander: 0.03,
        contactDamage: 12, expReward: 8, goldReward: 5
    },
    {
        // Phase 4b-13:scrap_drone 暫用 centipede 染冷藍 + 大小縮(機械感),全灰看起來像 bug 已 fix
        // 4b-14 將生真機械無人機 sprite 取代
        id: 'scrap_drone', type: 'Robot',
        spriteKey: 'mob_centipede_wave_a', scale: 0.10, tint: 0x4080a0,
        hp: 35, speedChase: 0.14, speedWander: 0.05,
        contactDamage: 6, expReward: 6, goldReward: 4
    }
];

// Phase 4a-18:1 隻 boss(廢料巨鼠 boss 版),殺夠 50 隻普通 mob 後 trigger
const BOSS_GIANTRAT: MobBlueprint = {
    id: 'boss_giantrat',
    type: 'Rat',
    spriteKey: 'mob_giantrat_run_a',
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
    private player!: Phaser.GameObjects.Sprite;
    private playerHP = 100;
    private playerInvulnUntilMs = 0;
    private isGameOver = false;
    private spawnPoints: SpawnPoint[] = [];
    private mobs: Phaser.GameObjects.Sprite[] = [];
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
    private joystick!: VirtualJoystick;
    private attackCooldownMs = 0;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private hpText!: Phaser.GameObjects.Text;
    private expBarFill!: Phaser.GameObjects.Rectangle;
    private expText!: Phaser.GameObjects.Text;
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
    // Phase 4b-14 player action lock — 'attacking' / 'hurt' 期間禁切 idle/walking
    private playerActionAnim: 'attacking' | 'hurt' | null = null;
    // Phase 4b-12 (B) 掉落物磁吸 — pending pickups
    private pendingPickups: { obj: Phaser.GameObjects.GameObject & { x: number; y: number; destroy: () => void }; collect: () => void }[] = [];
    // Phase 4b-13 小地圖 — graphics overlay 左上角
    private minimap!: Phaser.GameObjects.Graphics;
    private static readonly MINIMAP_SIZE = 220;
    private static readonly MINIMAP_PAD = 18;
    private npcClerk?: Phaser.GameObjects.Image;
    private npcBangMark?: Phaser.GameObjects.Text;
    private questDialogOpen = false;
    private mapConfig!: MapConfig;
    private portals: Phaser.GameObjects.GameObject[] = [];
    // 主角動作 state machine — 楓谷風:不同武器類別不同 attack 動作
    private playerAnimState: 'idle' | 'walking' = 'idle';
    private playerStateTween?: Phaser.Tweens.Tween;

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
    private static readonly HP_BAR_WIDTH = 700;
    private static readonly HP_BAR_HEIGHT = 42;

    constructor () { super('Game'); }

    create ()
    {
        console.log('[Game] create() entered');
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
        // Phase 4b-12 reset transient state for scene.restart()
        this.pendingPickups = [];
        this.playerActionAnim = null;
        // Phase 4b-16 fix:per Codex audit,questDialogOpen 沒 reset 會卡死 update()
        // user 報「死後重進不了」根因 — 死亡時若 quest dialog 開,scene restart 後 update 永遠早退
        this.questDialogOpen = false;

        // Phase 4b-3:讀 current map config
        this.mapConfig = getMap(SaveService.instance.getCurrentMapId());
        const mapW = this.mapConfig.width;
        const mapH = this.mapConfig.height;

        this.cameras.main.setBackgroundColor(this.mapConfig.bgColor);
        this.cameras.main.setBounds(0, 0, mapW, mapH);

        // Phase 4b-9 — GPT-4o painted top-down 廢土地圖(楓谷風,單張 opaque 全鋪滿)
        const bgKey = this.mapConfig.id === 'guild_hall' ? 'map_guild_hall_topdown' : 'map_wasteland_topdown';
        const bg = this.add.image(mapW / 2, mapH / 2, bgKey);
        bg.setDisplaySize(mapW, mapH);
        bg.setDepth(-100);

        // 玩家出生點:從 SaveService(若有 portal enter pos)或 mapConfig.playerStart
        const enterPos = SaveService.instance.consumeMapEnterPos();
        const startX = enterPos.x ?? this.mapConfig.playerStartX;
        const startY = enterPos.y ?? this.mapConfig.playerStartY;
        this.player = this.add.sprite(startX, startY, 'player_idle').setScale(0.3);
        // Phase 4b-10 register walk anim 一次性 — frames 跨不同 texture key
        if (!this.anims.exists('player_walk')) {
            this.anims.create({
                key: 'player_walk',
                frames: [
                    { key: 'player_walk_r' },
                    { key: 'player_walk_l' }
                ],
                frameRate: 6,
                repeat: -1
            });
        }
        // Phase 4b-14 attack 2-frame + hurt single frame
        if (!this.anims.exists('player_attack')) {
            this.anims.create({
                key: 'player_attack',
                frames: [
                    { key: 'player_atk_windup' },
                    { key: 'player_atk_impact' }
                ],
                frameRate: 12,
                repeat: 0  // 1 cycle 完就停
            });
        }
        if (!this.anims.exists('player_hurt')) {
            this.anims.create({
                key: 'player_hurt',
                frames: [{ key: 'player_hurt' }],
                frameRate: 4,
                repeat: 0,
                duration: 250
            });
        }
        // Phase 4b-11 mob anims(2-frame loops,scene-scope)
        if (!this.anims.exists('giantrat_run')) {
            this.anims.create({
                key: 'giantrat_run',
                frames: [{ key: 'mob_giantrat_run_a' }, { key: 'mob_giantrat_run_b' }],
                frameRate: 8,
                repeat: -1
            });
        }
        if (!this.anims.exists('centipede_wave')) {
            this.anims.create({
                key: 'centipede_wave',
                frames: [{ key: 'mob_centipede_wave_a' }, { key: 'mob_centipede_wave_b' }],
                frameRate: 6,
                repeat: -1
            });
        }
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
        // Phase 4b-13:barY 下移 50→260,避開左上角 minimap(18..238)
        const barX = (VIEW_W - Game.HP_BAR_WIDTH) / 2;
        const barY = 260;
        this.add.rectangle(barX, barY, Game.HP_BAR_WIDTH, Game.HP_BAR_HEIGHT, 0x2a1010)
            .setOrigin(0, 0).setStrokeStyle(2, 0x8b3a1f).setDepth(1000).setScrollFactor(0);
        this.hpBarFill = this.add.rectangle(barX + 2, barY + 2, Game.HP_BAR_WIDTH - 4, Game.HP_BAR_HEIGHT - 4, 0xc23a1a)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.hpText = this.add.text(VIEW_W / 2, barY + Game.HP_BAR_HEIGHT / 2, `${this.playerHP} / ${Game.PLAYER_MAX_HP}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        // MP bar(HP bar 正下方,藍色)— 放大
        const mpBarY = barY + Game.HP_BAR_HEIGHT + 10;
        const mpBarH = 30;
        this.add.rectangle(barX, mpBarY, Game.HP_BAR_WIDTH, mpBarH, 0x10202a)
            .setOrigin(0, 0).setStrokeStyle(2, 0x4080ff).setDepth(1000).setScrollFactor(0);
        const mpRatio = save.mp / save.maxMp;
        this.mpBarFill = this.add.rectangle(barX + 2, mpBarY + 2, (Game.HP_BAR_WIDTH - 4) * mpRatio, mpBarH - 4, 0x4080ff)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.mpText = this.add.text(VIEW_W / 2, mpBarY + mpBarH / 2, `MP ${save.mp} / ${save.maxMp}`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        const expBarY = mpBarY + mpBarH + 10;
        const expBarH = 24;
        this.add.rectangle(barX, expBarY, Game.HP_BAR_WIDTH, expBarH, 0x2a2010)
            .setOrigin(0, 0).setStrokeStyle(2, 0x4a5d3a).setDepth(1000).setScrollFactor(0);
        const expRatio = save.exp / SaveService.instance.expToNext();
        this.expBarFill = this.add.rectangle(barX + 2, expBarY + 2, (Game.HP_BAR_WIDTH - 4) * expRatio, expBarH - 4, 0xb08850)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        // Phase 4b-12 EXP HUD 數字 — 看得到目前 exp / next + %
        this.expText = this.add.text(VIEW_W / 2, expBarY + expBarH / 2, `EXP ${save.exp} / ${SaveService.instance.expToNext()} (${Math.floor(expRatio * 100)}%)`, {
            fontFamily: 'monospace', fontSize: 18, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 2
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        this.levelText = this.add.text(barX, barY - 12, `Lv ${save.level}`, {
            fontFamily: 'monospace', fontSize: 36, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0, 1).setDepth(1002).setScrollFactor(0);
        this.goldText = this.add.text(barX + Game.HP_BAR_WIDTH, barY - 12, `💰 ${save.gold}`, {
            fontFamily: 'monospace', fontSize: 30, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(1, 1).setDepth(1002).setScrollFactor(0);

        const w0 = getWeapon(save.currentWeaponId);
        const enh0 = SaveService.instance.getWeaponEnh(save.currentWeaponId);
        this.weaponText = this.add.text(barX, expBarY + expBarH + 6, this.formatWeaponLabel(w0, enh0), {
            fontFamily: 'monospace', fontSize: 18, color: '#b08850'
        }).setOrigin(0, 0).setDepth(1002).setScrollFactor(0);
        this.refreshWeaponText();

        // Phase 4b-13 小地圖 — 左上角 220x220,顯示玩家(綠)+ 普通怪(紅)+ boss(橙)+ NPC(藍)
        const mmSize = Game.MINIMAP_SIZE;
        const mmPad = Game.MINIMAP_PAD;
        // bg + border
        this.add.rectangle(mmPad, mmPad, mmSize, mmSize, 0x1a1612, 0.78)
            .setOrigin(0, 0).setStrokeStyle(3, 0x8b6020, 0.9)
            .setDepth(1000).setScrollFactor(0);
        this.add.text(mmPad + mmSize / 2, mmPad + 8, '◤ MINI-MAP ◢', {
            fontFamily: 'monospace', fontSize: 14, color: '#b08850'
        }).setOrigin(0.5, 0).setDepth(1003).setScrollFactor(0);
        this.minimap = this.add.graphics().setDepth(1002).setScrollFactor(0);

        // HP / MP 藥水 quick button(HUD 右上,避開 minimap 改下移)
        this.hpPotionText = this.add.text(VIEW_W - 30, 30, `🧪${save.hpPotions}`, {
            fontFamily: 'monospace', fontSize: 30, color: '#ff4040', fontStyle: 'bold',
            backgroundColor: '#2a1010', padding: { x: 12, y: 6 }
        }).setOrigin(1, 0).setDepth(1002).setScrollFactor(0).setInteractive({ useHandCursor: true });
        this.hpPotionText.on('pointerdown', () => this.useHpPotion());
        this.input.keyboard?.on('keydown-Q', () => this.useHpPotion());

        this.mpPotionText = this.add.text(VIEW_W - 30, 90, `🔮${save.mpPotions}`, {
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
        const tabH = 180;
        const tabY = VIEW_H - tabH / 2 - 12;
        const tabs = [
            { icon: '📦', label: '倉庫', scene: 'Storage', key: 'B' },
            { icon: '⚒', label: '裝備', scene: 'Inventory', key: 'I' },
            { icon: '🎰', label: '夥伴', scene: 'Gacha', key: 'G' },
            { icon: '🛒', label: '商店', scene: 'Shop', key: 'M' },
            { icon: '🌳', label: '天賦', scene: 'Talent', key: 'T' }
        ];
        const tabW = VIEW_W / tabs.length;

        // 底部 bar bg + 廢土橙頂線
        this.add.rectangle(0, tabY - tabH / 2, VIEW_W, tabH, 0x1a1210, 0.95)
            .setOrigin(0, 0).setDepth(1000).setScrollFactor(0)
            .setStrokeStyle(3, 0xff8830, 0.8);

        tabs.forEach((t, i) => {
            const cx = tabW * (i + 0.5);
            const c = this.add.container(cx, tabY).setDepth(1001).setScrollFactor(0);
            const bg = this.add.rectangle(0, 0, tabW - 12, tabH - 18, 0x2a2520, 0.85)
                .setStrokeStyle(2, 0x4a3a30);
            const icon = this.add.text(0, -35, t.icon, {
                fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830'
            }).setOrigin(0.5);
            const label = this.add.text(0, 45, t.label, {
                fontFamily: 'sans-serif', fontSize: 32, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5);
            c.add([bg, icon, label]);
            c.setSize(tabW - 12, tabH - 18);
            c.setInteractive({ useHandCursor: true });
            c.on('pointerdown', () => this.openTabScene(t.scene));
            this.input.keyboard?.on(`keydown-${t.key}`, () => this.openTabScene(t.scene));
        });

        // hint 文字往上推
        this.add.text(20, tabY - tabH / 2 - 30, '搖桿 / WASD — 自動攻擊', {
            fontFamily: 'sans-serif', fontSize: 20, color: '#a05a30'
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
        // Phase 4b-12 (B) 掉落物磁吸
        this.updateMagnet();
        // Phase 4b-13 小地圖 refresh
        this.updateMinimap();
    }

    // Phase 4b-13 小地圖 render — 等比例縮放整張 map,每 mob / player 一個圓點
    private updateMinimap() {
        if (!this.minimap || !this.player) return;
        const mmSize = Game.MINIMAP_SIZE;
        const mmPad = Game.MINIMAP_PAD;
        const innerPad = 14;
        const drawSize = mmSize - innerPad * 2;
        const mapW = this.mapConfig.width, mapH = this.mapConfig.height;
        const scale = Math.min(drawSize / mapW, drawSize / mapH);
        const mapDrawW = mapW * scale, mapDrawH = mapH * scale;
        const ox = mmPad + (mmSize - mapDrawW) / 2;
        const oy = mmPad + (mmSize - mapDrawH) / 2;
        const px = (x: number) => ox + x * scale;
        const py = (y: number) => oy + y * scale;
        this.minimap.clear();
        // map outline
        this.minimap.lineStyle(2, 0x4a3018, 0.85);
        this.minimap.strokeRect(ox, oy, mapDrawW, mapDrawH);
        // mobs
        for (const m of this.mobs) {
            if (!m.active) continue;
            const md = m.getData('mob') as MobData | undefined;
            if (!md) continue;
            const color = md.blueprint.isBoss ? 0xff8830 : 0xc23a1a;
            const r = md.blueprint.isBoss ? 6 : 3;
            this.minimap.fillStyle(color, 1);
            this.minimap.fillCircle(px(m.x), py(m.y), r);
        }
        // NPC clerk
        if (this.npcClerk) {
            this.minimap.fillStyle(0x4080ff, 1);
            this.minimap.fillCircle(px(this.npcClerk.x), py(this.npcClerk.y), 4);
        }
        // portal(廢土橙環)— per Codex Phase 4a #99 fix:production build 無 global Phaser
        // 不能用 instanceof Phaser.GameObjects.Arc。用 setData('isPortalRing') 標記
        for (const p of this.portals) {
            const pp = p as unknown as { x: number; y: number; getData?: (key: string) => unknown };
            if (pp.getData && pp.getData('isPortalRing')) {
                this.minimap.lineStyle(2, 0xff8830, 0.9);
                this.minimap.strokeCircle(px(pp.x), py(pp.y), 4);
            }
        }
        // player(綠廢土,大一點)
        this.minimap.fillStyle(0x4a5d3a, 1);
        this.minimap.fillCircle(px(this.player.x), py(this.player.y), 5);
        this.minimap.lineStyle(1.5, 0xffe0c0, 1);
        this.minimap.strokeCircle(px(this.player.x), py(this.player.y), 5);
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
        ring.setData('isPortalRing', true); // per Phaser 4 prod build no global Phaser fix
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

    // Phase 4b-10 state machine:真 frame anim,idle 靜態 / walking 跑 2-frame loop
    private setPlayerAnimState(state: 'idle' | 'walking', force = false) {
        if (!force && this.playerAnimState === state) return;
        this.playerAnimState = state;
        if (this.playerStateTween) this.playerStateTween.stop();
        this.player.angle = 0;
        this.player.setScale(0.3);
        if (state === 'idle') {
            this.player.anims.stop();
            this.player.setTexture('player_idle');
        } else {
            this.player.play('player_walk', true);
        }
    }

    // Phase 4b-14:真 frame anim 揮擊。action lock 期間 handleMovement 不切 anim,
    // 防 once listener 累積:每次 play 前 off 同 event 然後 once。
    private playWeaponAttackAnim(weapon: WeaponDef, targetX: number, _targetY: number) {
        void weapon;
        if (targetX < this.player.x) this.player.setFlipX(true);
        else this.player.setFlipX(false);
        this.player.off('animationcomplete-player_attack');
        this.playerActionAnim = 'attacking';
        this.player.play('player_attack', true);
        this.player.once('animationcomplete-player_attack', () => {
            this.playerActionAnim = null;
            const s = this.playerAnimState;
            this.playerAnimState = s === 'idle' ? 'walking' : 'idle';
            this.setPlayerAnimState(s, true);
        });
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
            // 靜止 — 切回 idle(若不在 action anim 中)
            if (this.playerAnimState !== 'idle' && !this.playerActionAnim) {
                this.setPlayerAnimState('idle');
            }
            return;
        }
        const normDx = mag > 1 ? dx / mag : dx;
        const normDy = mag > 1 ? dy / mag : dy;
        // Phase 4b-15 talent: move speed buff
        const buff = computeTalentBuff();
        const speed = Game.MOVE_SPEED * (1 + buff.moveSpeedPct);
        const nx = this.player.x + normDx * speed * delta;
        const ny = this.player.y + normDy * speed * delta;
        this.player.x = Math.max(60, Math.min(this.mapConfig.width - 60, nx));
        this.player.y = Math.max(60, Math.min(this.mapConfig.height - 60, ny));
        if (Math.abs(normDx) > 0.1) this.player.setFlipX(normDx < 0);
        // state machine:走路時切 walking(若不在 action anim 中)
        if (this.playerAnimState !== 'walking' && !this.playerActionAnim) {
            this.setPlayerAnimState('walking');
        }
    }

    private handleSpawn(time: number)
    {
        for (const sp of this.spawnPoints) {
            if (sp.mob === null && time >= sp.nextSpawnAt) {
                const bp = MOB_BLUEPRINTS[sp.blueprintIdx];
                const mob = this.add.sprite(sp.x, sp.y, bp.spriteKey).setScale(bp.scale);
                if (bp.tint !== undefined) {
                    // Phase 4b-13:multiply mode 保留紋路(避免全灰 fill 看起來像 bug)
                    mob.setTint(bp.tint);
                }
                // Phase 4b-11 play frame anim by blueprint id
                if (bp.id === 'centipede' || bp.id === 'scrap_drone') mob.play('centipede_wave');
                else mob.play('giantrat_run'); // giantrat 用 4-leg gallop
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

        // Phase 4b-14 真 frame hurt anim — sprite 切到 hurt frame 250ms
        this.player.off('animationcomplete-player_hurt');
        this.playerActionAnim = 'hurt';
        this.player.play('player_hurt', true);
        this.player.once('animationcomplete-player_hurt', () => {
            this.playerActionAnim = null;
            const s = this.playerAnimState;
            this.playerAnimState = s === 'idle' ? 'walking' : 'idle';
            this.setPlayerAnimState(s, true);
        });
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
        // per Codex audit:死亡時若 overlay scene 在開,要 stop 否則 leak
        ['Inventory', 'Storage', 'Shop', 'Gacha', 'Talent'].forEach(k => {
            if (this.scene.isActive(k)) this.scene.stop(k);
        });
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
        // Phase 4b-15 talent buff apply
        const buff = computeTalentBuff();

        let nearest: Phaser.GameObjects.Image | null = null;
        let nearestDist = weapon.range;
        for (const m of this.mobs) {
            if (!m.active) continue;
            const d = Math.hypot(this.player.x - m.x, this.player.y - m.y);
            if (d < nearestDist) { nearestDist = d; nearest = m; }
        }
        if (!nearest) return;

        // Talent: 攻擊速度 → 縮短 cooldown
        this.attackCooldownMs = weapon.attackIntervalMs / (1 + buff.atkSpeedPct);
        const target = nearest;
        // Talent: critRate / critDmg / dmgPct buff
        const isCrit = Math.random() < (Game.CRIT_CHANCE + buff.critRatePct);
        const totalDmgMult = (1 + buff.dmgPct) * (isCrit ? (Game.CRIT_MULT + buff.critDmgPct) : 1);
        const dmg = Math.round(baseDmg * totalDmgMult);

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
                // multiply mode 保留紋路(per user 全灰怪 bug fix)
                target.setTint(tData.blueprint.tint);
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
        // Phase 4b-12 (F) HitStop tweak — 0.05 too frozen, 0.10 feels more "snap"
        // Phase 4b-12 (C) 暴擊增強 — bigger shake + camera red flash
        this.cameras.main.shake(isCrit ? 180 : 50, isCrit ? 0.018 : 0.005);
        HitStopService.instance.trigger(isCrit ? 120 : 80, isCrit ? 0.05 : 0.10);
        if (isCrit) this.cameras.main.flash(80, 220, 40, 40, false);

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
            // Phase 4b-7 掉落物 roll
            this.rollMobDrops(target.x, target.y, data.blueprint.isBoss === true);
            if (data.blueprint.isBoss) {
                this.handleBossDefeated(target.x, target.y);
            }
            // Phase 4b-12 (A) 死亡爆碎屑 + sprite 膨脹消失
            this.spawnDeathBurst(target.x, target.y, data.blueprint.isBoss === true);
            this.tweens.add({
                targets: target, scale: target.scaleX * 1.4, alpha: 0,
                duration: 180, ease: 'Quad.out',
                onComplete: () => target.destroy()
            });
        }
    }

    // Phase 4b-7 掉落系統
    private rollMobDrops(x: number, y: number, isBoss: boolean) {
        const save = SaveService.instance;
        // 強化石(50% / boss 100%)
        if (isBoss || Math.random() < 0.5) {
            save.addMaterial('strengthen_stone', isBoss ? 5 : 1);
            this.spawnFloatingLabel(x, y - 40, isBoss ? '+5 強化石' : '+1 強化石', '#b08850');
        }
        // 武器掉落(5% / boss 50%)
        if (isBoss || Math.random() < 0.05) {
            const w = generateRandomWeapon();
            save.addDroppedWeapon(w);
            this.spawnFloatingLabel(x, y - 80, `掉落:${weaponDisplayName(w)} [${w.tier}]`, '#ff8830');
            // 視覺 tier color drop circle
            const circ = this.add.circle(x, y, 30, rarityColor(w.tier), 0.85)
                .setStrokeStyle(3, 0xffe0c0);
            this.tweens.add({
                targets: circ, scale: 1.6, alpha: 0, duration: 800,
                onComplete: () => circ.destroy()
            });
        }
    }

    private spawnFloatingLabel(x: number, y: number, text: string, color: string) {
        const t = this.add.text(x, y, text, {
            fontFamily: 'monospace', fontSize: 22, color, fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(700);
        this.tweens.add({
            targets: t, y: t.y - 70, alpha: 0, duration: 1000,
            onComplete: () => t.destroy()
        });
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
        const mob = this.add.sprite(bx, by, BOSS_GIANTRAT.spriteKey).setScale(BOSS_GIANTRAT.scale);
        if (BOSS_GIANTRAT.tint !== undefined) {
            mob.setTint(BOSS_GIANTRAT.tint); // multiply mode 保留紋路
        }
        mob.play('giantrat_run');
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
        const buff = computeTalentBuff();
        save.addKill();
        // Phase 4b-15 talent: gold buff
        save.addGold(Math.round(bp.goldReward * (1 + buff.goldGainPct)));
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

        // Phase 4b-15 talent: exp buff(buff 已在上面 compute)
        const expGain = Math.round(bp.expReward * (1 + buff.expGainPct));
        const result = save.addExp(expGain);
        const expText = this.add.text(x, y - 80, `+${expGain} EXP`, {
            fontFamily: 'monospace', fontSize: 22, color: '#4a5d3a', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({
            targets: expText, y: expText.y - 60, alpha: 0,
            duration: 700, onComplete: () => expText.destroy()
        });

        // Update exp bar + text
        const cur = save.get();
        const ratio = cur.exp / save.expToNext();
        this.expBarFill.width = (Game.HP_BAR_WIDTH - 4) * ratio;
        this.expText.setText(`EXP ${cur.exp} / ${save.expToNext()} (${Math.floor(ratio * 100)}%)`);

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

    // Phase 4b-12 (B) 掉落物磁吸 — < 300px lerp player,< 60px auto-pickup
    private static readonly MAGNET_RANGE = 300;
    private static readonly PICKUP_RANGE = 60;
    private static readonly MAGNET_LERP = 0.08;
    private updateMagnet() {
        if (!this.player) return;
        const px = this.player.x, py = this.player.y;
        for (let i = this.pendingPickups.length - 1; i >= 0; i--) {
            const e = this.pendingPickups[i];
            if (!e.obj.active) { this.pendingPickups.splice(i, 1); continue; }
            const dx = px - e.obj.x, dy = py - e.obj.y;
            const dist = Math.hypot(dx, dy);
            if (dist < Game.PICKUP_RANGE) {
                e.collect();
                e.obj.destroy();
                this.pendingPickups.splice(i, 1);
            } else if (dist < Game.MAGNET_RANGE) {
                e.obj.x += dx * Game.MAGNET_LERP;
                e.obj.y += dy * Game.MAGNET_LERP;
            }
        }
    }

    // Phase 4b-12 (A) 怪死亡爆碎屑 — 廢土碎屑粒子 8-12 顆飛濺
    private spawnDeathBurst(x: number, y: number, isBoss: boolean) {
        const count = isBoss ? 24 : 10;
        const palette = [0x4a3018, 0x8b3a1f, 0xb08850, 0x2a2520, 0xa05a30];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = isBoss ? 60 + Math.random() * 180 : 40 + Math.random() * 110;
            const size = 2 + Math.random() * (isBoss ? 6 : 4);
            const color = palette[Math.floor(Math.random() * palette.length)];
            const p = this.add.rectangle(x, y, size, size, color, 0.95).setDepth(420);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist + 30,
                alpha: 0,
                angle: (Math.random() - 0.5) * 540,
                duration: 500 + Math.random() * 300,
                ease: 'Cubic.out',
                onComplete: () => p.destroy()
            });
        }
    }

    // Phase 4b-12 (D) Level Up 大特效 — 全屏橙閃 + 大字停 1.5s + HP/MP 全回滿
    private spawnLevelUpEffect(levelsGained: number)
    {
        // 全屏橙白 flash
        this.cameras.main.flash(220, 255, 200, 80, false);
        this.cameras.main.shake(300, 0.012);

        // HP / MP 全滿 + bar + text flash
        this.playerHP = Game.PLAYER_MAX_HP;
        this.hpBarFill.width = Game.HP_BAR_WIDTH - 4;
        this.hpText.setText(`${Game.PLAYER_MAX_HP} / ${Game.PLAYER_MAX_HP}`);
        const maxMp = SaveService.instance.getMaxMp();
        SaveService.instance.setMp(maxMp);
        this.mpBarFill.width = Game.HP_BAR_WIDTH - 4;
        this.mpText.setText(`MP ${maxMp} / ${maxMp}`);

        // 大字「LEVEL UP!」中央停 1.5s
        const txt = levelsGained > 1 ? `LEVEL UP ×${levelsGained}!` : 'LEVEL UP!';
        const popup = this.add.text(this.player.x, this.player.y - 120, txt, {
            fontFamily: 'sans-serif', fontSize: 96, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#ff8830', strokeThickness: 10
        }).setOrigin(0.5).setDepth(2000).setScale(0.2);
        this.tweens.chain({
            targets: popup,
            tweens: [
                { scale: 1.4, duration: 250, ease: 'Back.out' },
                { scale: 1.2, duration: 80 },
                { alpha: 0, y: popup.y - 80, duration: 700, delay: 600 }
            ],
            onComplete: () => popup.destroy()
        });

        // 三道金色光環擴散
        for (let i = 0; i < 3; i++) {
            const ring = this.add.circle(this.player.x, this.player.y, 60, 0xff8830, 0)
                .setStrokeStyle(8, 0xffe060, 0.95).setDepth(500);
            this.tweens.add({
                targets: ring, radius: 320, alpha: 0,
                duration: 1100, delay: i * 180,
                onComplete: () => ring.destroy()
            });
        }
    }

    // Phase 4b-12 (B) 金幣 啵跳 + 閃光環 + 加進磁吸 queue
    private spawnGoldDrop(x: number, y: number, amount: number)
    {
        void amount; // 不視覺顯示
        const dropX = x + (Math.random() - 0.5) * 30;
        const dropY = y + (Math.random() - 0.5) * 30;
        const coin = this.add.circle(dropX, dropY - 40, 14, 0xffe060, 1)
            .setStrokeStyle(2, 0x8b6020).setDepth(400);
        // 啵跳 — 上升再落下
        this.tweens.chain({
            targets: coin,
            tweens: [
                { y: dropY - 80, duration: 180, ease: 'Quad.out' },
                { y: dropY, duration: 200, ease: 'Bounce.out' }
            ]
        });
        // 閃光環
        const ring = this.add.circle(dropX, dropY, 20, 0xffe060, 0)
            .setStrokeStyle(3, 0xffe060, 0.8).setDepth(399);
        this.tweens.add({
            targets: ring, radius: 60, alpha: 0, duration: 400,
            onComplete: () => ring.destroy()
        });
        // 加進磁吸 queue,player 靠近自動拾取
        this.pendingPickups.push({
            obj: coin,
            collect: () => {} // gold 已在 grantKillReward 加進 save,coin 視覺到手即消
        });
    }

    // Phase 4b-12 (B) 通用 dropped item spawn(武器 / 素材)— 啵跳 + 閃環 + 磁吸
    spawnDropPickup(x: number, y: number, color: number, label: string, onCollect: () => void) {
        const dropX = x + (Math.random() - 0.5) * 60;
        const dropY = y + (Math.random() - 0.5) * 30;
        const icon = this.add.rectangle(dropX, dropY - 40, 24, 24, color, 1)
            .setStrokeStyle(2, 0xffe0c0, 0.9).setDepth(400);
        this.tweens.chain({
            targets: icon,
            tweens: [
                { y: dropY - 80, duration: 180, ease: 'Quad.out' },
                { y: dropY, duration: 220, ease: 'Bounce.out' }
            ]
        });
        const ring = this.add.circle(dropX, dropY, 24, color, 0)
            .setStrokeStyle(3, color, 0.8).setDepth(399);
        this.tweens.add({
            targets: ring, radius: 80, alpha: 0, duration: 500,
            onComplete: () => ring.destroy()
        });
        const tag = this.add.text(dropX, dropY - 32, label, {
            fontFamily: 'sans-serif', fontSize: 16, color: '#ffe0c0',
            stroke: '#1a1612', strokeThickness: 2
        }).setOrigin(0.5).setDepth(401);
        this.tweens.add({
            targets: tag, alpha: 0, duration: 600, delay: 800,
            onComplete: () => tag.destroy()
        });
        this.pendingPickups.push({
            obj: icon,
            collect: onCollect
        });
    }
}
