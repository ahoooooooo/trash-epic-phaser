import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';
import { VirtualJoystick } from '../services/VirtualJoystick';
import { SaveService } from '../services/SaveService';
import { effectiveDamage, getWeapon, WeaponDef } from '../services/WeaponService';
import { computeTalentBuff } from '../services/TalentService';
import { QUESTS, QuestDef } from '../services/QuestService';
import { getMap, MapConfig, NpcSpec, PortalSpec, ShopNpcSpec } from '../services/MapService';
import { generateRandomWeapon, weaponDisplayName, rarityColor } from '../services/WeaponGenerator';
import { generateRandomArmor, armorDisplayName, armorRarityColor } from '../services/ArmorService';
import { getPotion, computePotionEffect } from '../services/PotionService';

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
// 精英怪(掛機策略小目標):偶發強化怪,更大 / 金黃 tint / 更肉 / 大獎勵
const ELITE_CHANCE = 0.08;
const ELITE_HP_MULT = 3.5;
const ELITE_SCALE_MULT = 1.5;
const ELITE_REWARD_MULT = 4;
const ELITE_DMG_MULT = 1.6;
const ELITE_TINT = 0xffd040;
// Phase 4c C-fix:玩家各 frame PNG 尺寸不一(BiRefNet crop bbox 852~1209 寬 1043~1254 高),
// fixed setScale(0.3) 讓 render 高度脈動(頭忽大忽小)。改鎖固定 display 高度,scale 依 frame 動態算。
const PLAYER_DISPLAY_H = 376;

interface SpawnPoint {
    x: number;
    y: number;
    mob: Phaser.GameObjects.Sprite | null;
    nextSpawnAt: number;
    blueprintIdx: number; // 該 spawn point 固定生哪種 mob
}

type MobState = 'wander' | 'chase';

// per weapons_v1 §4 mob resist matrix:Rat / Mutant / Robot / Plant / Insect / BossArmored
type MobType = 'Rat' | 'Insect' | 'Robot' | 'Plant';

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
        // Phase 4b-13:scrap_drone 暫用 centipede 染冷藍 + 大小縮(機械感)
        id: 'scrap_drone', type: 'Robot',
        spriteKey: 'mob_centipede_wave_a', scale: 0.10, tint: 0x4080a0,
        hp: 35, speedChase: 0.14, speedWander: 0.05,
        contactDamage: 6, expReward: 6, goldReward: 4
    },
    // Phase 4c-1 乾井路 進階廢土怪(idx 3-5,先 tint 變體,真 sprite Phase 4c-5 生)
    {
        id: 'feral_rat', type: 'Rat', spriteKey: 'mob_giantrat_run_a', scale: 0.20, tint: 0xc08850,
        hp: 140, speedChase: 0.11, speedWander: 0.04, contactDamage: 18, expReward: 14, goldReward: 9
    },
    {
        id: 'rust_centipede', type: 'Insect', spriteKey: 'mob_centipede_wave_a', scale: 0.16, tint: 0xa05030,
        hp: 200, speedChase: 0.08, speedWander: 0.03, contactDamage: 24, expReward: 20, goldReward: 13
    },
    {
        id: 'sentry_drone', type: 'Robot', spriteKey: 'mob_centipede_wave_a', scale: 0.12, tint: 0x6080a0,
        hp: 110, speedChase: 0.15, speedWander: 0.05, contactDamage: 15, expReward: 16, goldReward: 11
    },
    // Phase 4c-1 爐心門 輻射怪(idx 6-8)
    {
        id: 'rad_rat', type: 'Rat', spriteKey: 'mob_giantrat_run_a', scale: 0.24, tint: 0x6a9a40,
        hp: 420, speedChase: 0.12, speedWander: 0.04, contactDamage: 40, expReward: 55, goldReward: 30
    },
    {
        id: 'rad_worm', type: 'Insect', spriteKey: 'mob_centipede_wave_a', scale: 0.20, tint: 0x80b050,
        hp: 560, speedChase: 0.09, speedWander: 0.03, contactDamage: 52, expReward: 70, goldReward: 40
    },
    {
        id: 'core_drone', type: 'Robot', spriteKey: 'mob_centipede_wave_a', scale: 0.15, tint: 0x40a060,
        hp: 340, speedChase: 0.17, speedWander: 0.05, contactDamage: 34, expReward: 60, goldReward: 35
    },
    // Phase 4c-17 真‧獨立新怪 sprite(GPT-4o+BiRefNet 鏽蝕機械蜘蛛,非換色)— idx 9,乾井路 signature
    {
        id: 'rust_spider', type: 'Insect', spriteKey: 'mob_rust_spider', scale: 0.13,
        hp: 200, speedChase: 0.09, speedWander: 0.03, contactDamage: 24, expReward: 22, goldReward: 14
    },
    // Phase 4c-18 真‧獨立新怪(輻射機甲蟲)— idx 10,爐心門 signature(lv180-300 難度)
    {
        id: 'reactor_crawler', type: 'Robot', spriteKey: 'mob_reactor_crawler', scale: 0.16,
        hp: 420, speedChase: 0.10, speedWander: 0.03, contactDamage: 40, expReward: 55, goldReward: 30
    },
    // Phase 4c-19 真‧獨立新怪(變異食人花)— idx 11,廢土外圍 signature(取代舊 centipede,q2 任務目標)
    {
        id: 'mutant_creeper', type: 'Plant', spriteKey: 'mob_mutant_creeper', scale: 0.13,
        hp: 80, speedChase: 0.06, speedWander: 0.02, contactDamage: 12, expReward: 8, goldReward: 5
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
    isElite?: boolean;
}

export class Game extends Scene
{
    private player!: Phaser.GameObjects.Sprite;
    private playerHP = 100;
    private playerInvulnUntilMs = 0;
    private spawnGraceArmed = false;  // ④ 出生無敵在首個 update tick(FTUE resume 後)才 arm,用 update 的 global time
    private immortalReadyAt = 0;      // 不朽之軀 cheatDeath 下次可用(180s CD)
    private hpRegenCarry = 0;         // 疤痕組織 每秒回血累積(不足 1 點累進)
    private skillReadyAt = 0;         // ⑤ 主動技能下次可用時間(update 的 global time 基準)
    private skillRequested = false;   // 按鈕/F 設旗標,update 用同一 time 處理(CD 判定與視覺同源)
    private skillBtnBg!: Phaser.GameObjects.Rectangle;
    private skillCdText!: Phaser.GameObjects.Text;
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
    private mpBarFill!: Phaser.GameObjects.Rectangle;
    private mpText!: Phaser.GameObjects.Text;
    // 週挑戰 HUD 進度條(minimap 下方,可視化本週擊殺進度)
    private weekBarFill!: Phaser.GameObjects.Rectangle;
    private weekBarText!: Phaser.GameObjects.Text;
    private weekBarInnerW: number = 0;
    // R-LAYOUT:layout 動態算的 bar 寬,給 update path 用(避免 hard-coded HP_BAR_WIDTH)
    private hudPlateBarW: number = 700;
    private hudExpBarW: number = 1080;
    private sessionStartMs = 0;
    private lastPersistMs = 0;
    private pageHideHandler?: () => void;
    private sessionKills = 0;
    private bossActive = false;
    // Phase 4b-14 player action lock — 'attacking' / 'hurt' 期間禁切 idle/walking
    private playerActionAnim: 'attacking' | 'hurt' | null = null;
    // Phase 4c B fix:攻擊後此時間內 flipX 鎖朝目標怪,handleMovement 不覆蓋(防往後走背打)
    private combatFaceUntilMs = 0;
    // Phase 4c-2 楓谷藥水:CD / HoT / buff 計時
    private potionCdUntilMs = 0;
    private hotUntilMs = 0;
    private hotPerSec = 0;
    private hotLastTickMs = 0;
    private buffAtkUntilMs = 0;
    private buffAtkPct = 0;
    private buffDefUntilMs = 0;
    private buffDefPct = 0;
    private potionSlotCountTexts: Phaser.GameObjects.Text[] = [];
    // Phase 4b-12 (B) 掉落物磁吸 — pending pickups
    private pendingPickups: { obj: Phaser.GameObjects.GameObject & { x: number; y: number; destroy: () => void }; collect: () => void }[] = [];
    // Phase 4b-13 小地圖 — graphics overlay 左上角
    private minimap!: Phaser.GameObjects.Graphics;
    private static readonly MINIMAP_SIZE = 320;
    private static readonly MINIMAP_PAD = 18;
    private npcClerk?: Phaser.GameObjects.Image;
    private npcBangMark?: Phaser.GameObjects.Text;
    private questDialogOpen = false;
    private vendorShopOpen = false;
    private mapConfig!: MapConfig;
    private portals: Phaser.GameObjects.GameObject[] = [];
    // 主角動作 state machine — 楓谷風:不同武器類別不同 attack 動作
    private playerAnimState: 'idle' | 'walking' = 'idle';
    private playerStateTween?: Phaser.Tweens.Tween;
    // VFX-A:腳下落地陰影(半透明黑橢圓,跟隨移動增立體感)
    private playerShadow!: Phaser.GameObjects.Ellipse;

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
    private static readonly SPAWN_GRACE_MS = 2500;   // 進場/復活後無敵緩衝(防新手一進場被圍毆秒死)
    private static readonly SPAWN_SAFE_RADIUS = 240; // 怪不在玩家此半徑內 spawn(避免點臉刷出)
    // ⑤ 戰鬥深度:主動技能「廢土震波」(AoE,耗 MP,CD)
    private static readonly SKILL_MP_COST = 25;
    private static readonly SKILL_CD_MS = 5000;
    private static readonly SKILL_RADIUS = 320;
    private static readonly SKILL_DMG_MULT = 2.4;   // 對範圍內每怪 = 武器有效傷害 × 此倍率
    private static readonly SKILL_KNOCKBACK = 90;
    // Phase 4c 設計修正:maxHP 隨等級成長(每級 +20)+ 天賦厚皮硬骨
    private playerMaxHp = 100;
    private computeMaxHp(level: number): number {
        return 100 + (level - 1) * 20 + computeTalentBuff().maxHpFlat;
    }

    // 重算 maxHP(天賦 thick_hide 改變 / resume 時);maxHP 升不自動補血,只更新上限 + 條
    private refreshMaxHp() {
        if (!this.hpBarFill) return;
        const newMax = this.computeMaxHp(SaveService.instance.get().level);
        if (newMax === this.playerMaxHp) return;
        this.playerMaxHp = newMax;
        this.playerHP = Math.min(this.playerHP, this.playerMaxHp);
        this.hpBarFill.width = (this.hudPlateBarW - 4) * (this.playerHP / this.playerMaxHp);
        this.hpText.setText(`HP  ${this.playerHP} / ${this.playerMaxHp}`);
    }

    constructor () { super('Game'); }

    create ()
    {
        console.log('[Game] create() entered');
        this.playerMaxHp = this.computeMaxHp(SaveService.instance.get().level);
        this.playerHP = this.playerMaxHp;
        // Phase 4c 設計修正:從天賦/裝備頁 resume 回來時重算 maxHP(thick_hide 等即時反映)
        this.events.on('resume', () => this.refreshMaxHp());
        this.playerInvulnUntilMs = 0;
        this.spawnGraceArmed = false;
        this.immortalReadyAt = 0;
        this.hpRegenCarry = 0;
        this.skillReadyAt = 0;
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
        this.combatFaceUntilMs = 0;
        // Phase 4b-16 fix:per Codex audit,questDialogOpen 沒 reset 會卡死 update()
        // user 報「死後重進不了」根因 — 死亡時若 quest dialog 開,scene restart 後 update 永遠早退
        this.questDialogOpen = false;
        this.vendorShopOpen = false;

        // Phase 4b-3:讀 current map config
        this.mapConfig = getMap(SaveService.instance.getCurrentMapId());
        const mapW = this.mapConfig.width;
        const mapH = this.mapConfig.height;

        this.cameras.main.setBackgroundColor(this.mapConfig.bgColor);
        // camera bounds 上下各延伸 HUD 高度(全地圖一致):地圖頂落在血條下(y≈116)、底落在經驗條上(y≈1690),
        // 角色走到地圖邊緣時不會被頂部血條 / 底部經驗條遮。Phaser bounds<viewport 時 scrollY pin 到 boundsTop=-116,
        // 角色仍渲染在 HUD 下(y≈176),小地圖一樣安全。
        const TOP_HUD = 116, BOTTOM_HUD = 230;
        const camTop = -TOP_HUD;
        const camH = mapH + TOP_HUD + BOTTOM_HUD;
        this.cameras.main.setBounds(0, camTop, mapW, camH);

        // Phase 4b-9 — GPT-4o painted top-down 廢土地圖(楓谷風,單張 opaque 全鋪滿)
        // Phase 4c-1:town(公會/廢料鎮/鏽蝕巷)用室內 bg,field/boss 用廢土 bg(先復用,4c-5 各生 painted)
        const bgKey = this.mapConfig.mapType === 'town' ? 'map_guild_hall_topdown' : 'map_wasteland_topdown';
        // bg 鋪滿 camera 可視範圍:延伸帶 + 比螢幕小的地圖也補滿到 viewport,任何角度都不露 flat bgColor
        const bgH = Math.max(camH, VIEW_H);
        const bg = this.add.image(mapW / 2, camTop + bgH / 2, bgKey);
        bg.setDisplaySize(mapW, bgH);
        bg.setDepth(-100);

        // 玩家出生點:從 SaveService(若有 portal enter pos)或 mapConfig.playerStart
        const enterPos = SaveService.instance.consumeMapEnterPos();
        const startX = enterPos.x ?? this.mapConfig.playerStartX;
        const startY = enterPos.y ?? this.mapConfig.playerStartY;
        // VFX-A:玩家落地陰影(在 player 下方,depth -10 蓋在地圖上、躲在 sprite 下)
        this.playerShadow = this.makeGroundShadow(startX, startY, 70);
        this.player = this.add.sprite(startX, startY, 'player_idle');
        this.lockPlayerScale();
        // 跨 texture 動畫(walk/attack/hurt)每 frame 尺寸不同,逐 frame 重鎖 display 高度
        this.player.on('animationupdate', () => this.lockPlayerScale());
        // Phase 4b-10 register walk anim 一次性 — frames 跨不同 texture key
        if (!this.anims.exists('player_walk')) {
            this.anims.create({
                key: 'player_walk',
                frames: [
                    { key: 'player_walk_r' },
                    { key: 'player_walk_l' }
                ],
                frameRate: 8,
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
        // Phase 4c-3 各地商販:town 地圖的 potion vendor 攤位
        this.mapConfig.shopNpcs.forEach((v: ShopNpcSpec) => {
            if (v.shopType !== 'potion') return; // skin vendor 留 4c-4
            this.add.rectangle(v.x, v.y, 96, 96, 0x4a3a2a, 0.96).setStrokeStyle(3, 0x8b6020).setDepth(5);
            const stall = this.add.rectangle(v.x, v.y, 96, 96, 0xffffff, 0.001).setDepth(8)
                .setInteractive({ useHandCursor: true });
            this.add.text(v.x, v.y, '🧪', { fontFamily: 'sans-serif', fontSize: 46 }).setOrigin(0.5).setDepth(6);
            this.add.text(v.x, v.y + 66, v.nameZH, {
                fontFamily: 'sans-serif', fontSize: 22, color: '#ffe0c0', fontStyle: 'bold',
                stroke: '#1a1612', strokeThickness: 4, align: 'center', wordWrap: { width: 240 }
            }).setOrigin(0.5, 0).setDepth(6);
            const bang = this.add.text(v.x, v.y - 72, '🛒', { fontFamily: 'sans-serif', fontSize: 30 }).setOrigin(0.5).setDepth(7);
            this.tweens.add({ targets: bang, y: v.y - 82, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            stall.on('pointerdown', () => {
                const d = Math.hypot(this.player.x - v.x, this.player.y - v.y);
                if (d > 140) { this.flashHudMessage('走近商販才能買', 0xb08850); return; }
                this.joystick.cancel();
                this.openVendorShop(v);
            });
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

        // === HUD R-LAYOUT v3 (2026-05-29 user 大改) ===
        //   - 左上 minimap 放大(320),pad 18 不變
        //   - HP + MP 等寬,頂部對齊 minimap 頂 (y=MM_PAD),在 minimap 右側
        //   - 移除:金幣 / 武器名 / 藥水 顯示(右上清空,藥水機制 B 階段楓谷化)
        //   - Lv 移到底部跟 EXP bar 一起(EXP bar 左端徽章)
        //   - EXP bar 亮金黃 fill(取代土色,明顯)
        const HUD_BAR_BG = 0x2a2520;
        const HUD_BAR_STROKE = 0xa05a30;
        const MM = Game.MINIMAP_SIZE;
        const MM_PAD = Game.MINIMAP_PAD;

        // --- 左上 minimap(放大,雙層鏽板框)---
        this.add.rectangle(MM_PAD - 4, MM_PAD - 4, MM + 8, MM + 8, 0x1a1612, 0.95)
            .setOrigin(0, 0).setStrokeStyle(2, 0x8b6020, 0.9).setDepth(999).setScrollFactor(0);
        this.add.rectangle(MM_PAD, MM_PAD, MM, MM, 0x2a2520, 0.85)
            .setOrigin(0, 0).setStrokeStyle(2, 0xa05a30, 0.95).setDepth(1000).setScrollFactor(0);
        this.add.text(MM_PAD + MM / 2, MM_PAD + 8, '◤ 廢墟 ◢', {
            fontFamily: 'monospace', fontSize: 18, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 2
        }).setOrigin(0.5, 0).setDepth(1003).setScrollFactor(0);
        this.minimap = this.add.graphics().setDepth(1002).setScrollFactor(0);
        // Phase 4c-1:點 minimap 開楓谷風世界全圖(per user)
        this.add.rectangle(MM_PAD, MM_PAD, MM, MM, 0xffffff, 0.001)
            .setOrigin(0, 0).setDepth(1004).setScrollFactor(0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => { this.scene.launch('WorldMap'); });
        this.add.text(MM_PAD + MM / 2, MM_PAD + MM - 22, '🔍 點開全圖', {
            fontFamily: 'monospace', fontSize: 15, color: '#b08850'
        }).setOrigin(0.5).setDepth(1004).setScrollFactor(0);

        // --- minimap 下方:週挑戰進度條(可視化本週擊殺,取代純 toast)---
        const wbY = MM_PAD + MM + 12, wbH = 26, wbX = MM_PAD;
        this.add.rectangle(wbX - 4, wbY - 4, MM + 8, wbH + 8, 0x1a1612, 0.92)
            .setOrigin(0, 0).setStrokeStyle(2, 0x8b6020, 0.9).setDepth(999).setScrollFactor(0);
        this.add.rectangle(wbX, wbY, MM, wbH, 0x2a2520)
            .setOrigin(0, 0).setStrokeStyle(2, 0xa05a30, 0.95).setDepth(1000).setScrollFactor(0);
        this.weekBarInnerW = MM - 4;
        this.weekBarFill = this.add.rectangle(wbX + 2, wbY + 2, 0, wbH - 4, 0x9bd0ff)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.weekBarText = this.add.text(wbX + MM / 2, wbY + wbH / 2, '', {
            fontFamily: 'monospace', fontSize: 16, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);
        this.updateWeekChallengeBar();

        // --- HP + MP 等寬 bar,在 minimap 右側,頂部對齊 minimap 頂 ---
        const barX = MM_PAD + MM + 24;
        const barW = VIEW_W - barX - 24;
        this.hudPlateBarW = barW;
        const hpH = 48, mpH = 38, barGap = 12;
        const hpY = MM_PAD;                 // 對齊 minimap 頂
        const mpY = hpY + hpH + barGap;

        // plate wrap(HP + MP)
        const plateY = hpY - 8;
        const plateH = hpH + barGap + mpH + 16;
        this.add.rectangle(barX - 10, plateY, barW + 20, plateH, 0x1a1612, 0.88)
            .setOrigin(0, 0).setStrokeStyle(3, 0x8b6020, 0.9).setDepth(999).setScrollFactor(0);

        // HP bar(鏽紅)
        this.add.rectangle(barX, hpY, barW, hpH, HUD_BAR_BG)
            .setOrigin(0, 0).setStrokeStyle(2, HUD_BAR_STROKE).setDepth(1000).setScrollFactor(0);
        this.hpBarFill = this.add.rectangle(barX + 2, hpY + 2, barW - 4, hpH - 4, 0xc23a1a)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.add.rectangle(barX + 2, hpY + 2, barW - 4, 7, 0xffe0c0, 0.18)
            .setOrigin(0, 0).setDepth(1002).setScrollFactor(0);
        this.hpText = this.add.text(barX + barW / 2, hpY + hpH / 2, `HP  ${this.playerHP} / ${this.playerMaxHp}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        // MP bar(能量綠)— 等寬
        this.add.rectangle(barX, mpY, barW, mpH, HUD_BAR_BG)
            .setOrigin(0, 0).setStrokeStyle(2, HUD_BAR_STROKE).setDepth(1000).setScrollFactor(0);
        const mpRatio = save.mp / save.maxMp;
        this.mpBarFill = this.add.rectangle(barX + 2, mpY + 2, (barW - 4) * mpRatio, mpH - 4, 0x4a5d3a)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.add.rectangle(barX + 2, mpY + 2, barW - 4, 5, 0xffe0c0, 0.16)
            .setOrigin(0, 0).setDepth(1002).setScrollFactor(0);
        this.mpText = this.add.text(barX + barW / 2, mpY + mpH / 2, `MP  ${save.mp} / ${save.maxMp}`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 3
        }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

        // Phase 4c-2 手機藥水快捷列(右側 3 格,tap 用藥)
        this.drawPotionHotbar();
        this.drawSkillButton();

        // plate 四角鉚釘
        const plateBottom = plateY + plateH;
        for (const [rx, ry] of [[barX - 6, plateY + 4], [barX + barW + 6, plateY + 4], [barX - 6, plateBottom - 4], [barX + barW + 6, plateBottom - 4]]) {
            this.add.circle(rx, ry, 5, 0xa05a30).setDepth(1003).setScrollFactor(0);
            this.add.circle(rx, ry, 2, 0x4a3a30).setDepth(1004).setScrollFactor(0);
        }

        // --- 底部 EXP bar 全寬 + Lv 左端徽章(亮金黃 fill,楓谷風)---
        const expBarH = 34;
        const expBarY = VIEW_H - 180 - 12 - expBarH - 4;
        const expBarW = VIEW_W;
        this.hudExpBarW = expBarW;
        this.add.rectangle(0, expBarY - 4, expBarW, expBarH + 8, 0x1a1612, 0.92)
            .setOrigin(0, 0).setStrokeStyle(2, 0x8b6020, 0.9).setDepth(999).setScrollFactor(0);
        this.add.rectangle(0, expBarY, expBarW, expBarH, HUD_BAR_BG)
            .setOrigin(0, 0).setStrokeStyle(2, HUD_BAR_STROKE).setDepth(1000).setScrollFactor(0);
        const expRatio = save.exp / SaveService.instance.expToNext();
        // 亮金黃 fill — 明顯(取代土色)
        this.expBarFill = this.add.rectangle(2, expBarY + 2, (expBarW - 4) * expRatio, expBarH - 4, 0xffc024)
            .setOrigin(0, 0).setDepth(1001).setScrollFactor(0);
        this.add.rectangle(2, expBarY + 2, expBarW - 4, 7, 0xffffff, 0.28)
            .setOrigin(0, 0).setDepth(1002).setScrollFactor(0);
        // Lv 徽章在 EXP bar 左端
        this.add.rectangle(0, expBarY - 4, 150, expBarH + 8, 0x1a1612, 0.95)
            .setOrigin(0, 0).setStrokeStyle(2, 0xff8830, 1).setDepth(1003).setScrollFactor(0);
        this.levelText = this.add.text(75, expBarY + expBarH / 2, `Lv ${save.level}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setDepth(1004).setScrollFactor(0);
        // EXP text 中央
        this.add.rectangle(VIEW_W / 2, expBarY + expBarH / 2, 340, expBarH - 6, 0x1a1612, 0.5)
            .setOrigin(0.5).setDepth(1002).setScrollFactor(0);
        this.expText = this.add.text(VIEW_W / 2, expBarY + expBarH / 2, `EXP ${save.exp} / ${SaveService.instance.expToNext()} (${Math.floor(expRatio * 100)}%)`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setDepth(1003).setScrollFactor(0);

        // 藥水快捷 keyboard 保留(B 階段楓谷藥水機制重做 UI);右上不顯示 button
        this.input.keyboard?.on('keydown-Q', () => this.useHpPotion());
        this.input.keyboard?.on('keydown-E', () => this.useMpPotion());

        // 底部 5 tab UI
        this.buildBottomTabs();

        // Phase 4c-7 新手引導 FTUE — 全新存檔首次進 Game 跑一次(看完寫旗標)
        // Phase 4c-16 每日登入簽到 — 既有玩家(已過 FTUE)進場且今日未領則彈出(避免與 FTUE 同場衝突)
        if (!SaveService.instance.isTutorialDone()) {
            this.scene.launch('Coachmark');
            this.scene.pause();
        } else if (SaveService.instance.canClaimDailyLogin()) {
            this.scene.launch('DailyReward');
            this.scene.pause();
        }
    }

    // Phase 4c-2 Q/E → 用快捷列第一個補血/補魔藥水
    private useHpPotion() { this.usePotionFromHotbar('hp'); }
    private useMpPotion() { this.usePotionFromHotbar('mp'); }

    private usePotionFromHotbar(target: 'hp' | 'mp') {
        for (const id of SaveService.instance.getPotionHotbar()) {
            if (!id) continue;
            const p = getPotion(id);
            if (!p) continue;
            const m = target === 'hp' ? (p.target === 'hp' || p.target === 'both') : (p.target === 'mp' || p.target === 'both');
            if (m && SaveService.instance.getPotionCount(id) > 0) { this.usePotion(id); return; }
        }
        this.flashHudMessage(target === 'hp' ? '🧪 沒有補血藥水' : '🔮 沒有補魔藥水', target === 'hp' ? 0xc23a1a : 0x4a5d3a);
    }

    // 用一瓶藥水(isAuto = auto-pot 觸發,不顯示提示音)
    private usePotion(id: string, isAuto = false): boolean {
        if (this.isGameOver) return false;
        const p = getPotion(id);
        if (!p) return false;
        if (this.time.now < this.potionCdUntilMs) { if (!isAuto) this.flashHudMessage('藥水冷卻中', 0xb08850); return false; }
        if (!SaveService.instance.consumePotion(id)) { if (!isAuto) this.flashHudMessage('🧪 沒有藥水', 0xc23a1a); return false; }
        const save = SaveService.instance;
        const eff = computePotionEffect(p, this.playerMaxHp, save.getMaxMp());
        if (eff.hpHeal > 0) {
            this.playerHP = Math.min(this.playerMaxHp, this.playerHP + eff.hpHeal);
            this.hpBarFill.width = (this.hudPlateBarW - 4) * (this.playerHP / this.playerMaxHp);
            this.hpText.setText(`HP  ${this.playerHP} / ${this.playerMaxHp}`);
        }
        if (eff.mpRestore > 0) {
            save.setMp(save.getMp() + eff.mpRestore);
            const c = save.get();
            this.mpBarFill.width = (this.hudPlateBarW - 4) * (c.mp / c.maxMp);
            this.mpText.setText(`MP  ${c.mp} / ${c.maxMp}`);
        }
        if (eff.hot) { this.hotUntilMs = this.time.now + eff.hot.durationMs; this.hotPerSec = eff.hot.perSec; this.hotLastTickMs = this.time.now; }
        if (eff.buff) {
            if (eff.buff.stat === 'atk') { this.buffAtkUntilMs = this.time.now + eff.buff.durationMs; this.buffAtkPct = eff.buff.pct; }
            else { this.buffDefUntilMs = this.time.now + eff.buff.durationMs; this.buffDefPct = eff.buff.pct; }
        }
        this.potionCdUntilMs = this.time.now + p.cooldownMs;
        this.flashHudMessage(p.nameZH, 0xffe060);
        save.save();
        this.refreshPotionHotbar();
        return true;
    }

    // Phase 4c-2 手機藥水快捷列(右側 3 格)
    // ⑤ 主動技能按鈕(右側,藥水快捷列下方)
    private drawSkillButton() {
        const size = 116;
        const x = VIEW_W - 46 - size / 2;   // 右緣留 46px margin,避免貼邊誤觸
        const y = 1230;
        this.skillBtnBg = this.add.rectangle(x, y, size, size, 0x8b3a1f, 0.95)
            .setStrokeStyle(4, 0xff8830, 1).setDepth(1100).setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        this.add.text(x, y - 22, '震波', {
            fontFamily: 'sans-serif', fontSize: 32, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1101).setScrollFactor(0);
        this.add.text(x, y + 20, `${Game.SKILL_MP_COST} MP`, {
            fontFamily: 'monospace', fontSize: 20, color: '#9bd0ff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1101).setScrollFactor(0);
        // CD 倒數覆蓋文字(grace 時顯示秒數)
        this.skillCdText = this.add.text(x, y, '', {
            fontFamily: 'monospace', fontSize: 40, color: '#ffe060', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5).setDepth(1102).setScrollFactor(0);
        this.skillBtnBg.on('pointerdown', () => { this.skillRequested = true; });
        this.input.keyboard?.on('keydown-F', () => { this.skillRequested = true; });
    }

    // 技能按鈕 CD 視覺(update 每 tick 刷)
    private refreshSkillButton(time: number) {
        if (!this.skillBtnBg) return;
        const remain = this.skillReadyAt - time;
        if (remain > 0) {
            this.skillBtnBg.setFillStyle(0x2a2520, 0.92).setStrokeStyle(4, 0x5a4a38, 1);
            this.skillCdText.setText(Math.ceil(remain / 1000).toString());
        } else {
            this.skillBtnBg.setFillStyle(0x8b3a1f, 0.95).setStrokeStyle(4, 0xff8830, 1);
            this.skillCdText.setText('');
        }
    }

    // ⑤ 廢土震波:範圍 AoE,耗 MP,CD。給玩家主動操作層(緩解純掛機)
    private useSkill(time: number) {
        if (this.isGameOver) return;
        if (time < this.skillReadyAt) { this.flashHudMessage('技能冷卻中', 0xb08850); return; }
        const save = SaveService.instance;
        if (!save.spendMp(Game.SKILL_MP_COST)) { this.flashHudMessage('MP 不足', 0x8b3a1f); return; }
        this.skillReadyAt = time + Game.SKILL_CD_MS;
        // MP HUD 同步
        const c = save.get();
        this.mpBarFill.width = (this.hudPlateBarW - 4) * (c.mp / c.maxMp);
        this.mpText.setText(`MP  ${c.mp} / ${c.maxMp}`);

        // 傷害:武器有效傷害 × 倍率 × 天賦
        const weapon = getWeapon(save.getCurrentWeaponId());
        const buff = computeTalentBuff();
        const skillDmg = Math.max(1, Math.round(
            effectiveDamage(weapon, save.getWeaponEnh(weapon.id)) * Game.SKILL_DMG_MULT * (1 + buff.dmgPct + this.potionAtkPct())
        ));

        // 震波視覺:橙環擴張到 SKILL_RADIUS
        const wave = this.add.circle(this.player.x, this.player.y, Game.SKILL_RADIUS, 0xff8830, 0.16)
            .setStrokeStyle(8, 0xffe060, 0.9).setDepth(450).setScale(0.12);
        this.tweens.add({
            targets: wave, scale: 1, alpha: 0,
            duration: 360, ease: 'Quad.out', onComplete: () => wave.destroy()
        });
        this.cameras.main.shake(160, 0.012);
        HitStopService.instance.trigger(90, 0.08);

        // 對範圍內每隻怪施加傷害 + 擊退
        for (const m of [...this.mobs]) {
            if (!m.active) continue;
            const dx = m.x - this.player.x;
            const dy = m.y - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d > Game.SKILL_RADIUS) continue;
            const data = m.getData('mob') as MobData;
            data.hp -= skillDmg;
            // 擊退
            const len = d || 1;
            m.x = Math.max(60, Math.min(this.mapConfig.width - 60, m.x + (dx / len) * Game.SKILL_KNOCKBACK));
            m.y = Math.max(60, Math.min(this.mapConfig.height - 60, m.y + (dy / len) * Game.SKILL_KNOCKBACK));
            // hit flash
            m.setTint(0xffffff).setTintMode(TINT_FILL);
            this.time.delayedCall(100, () => {
                if (!m.active) return;
                const td = m.getData('mob') as MobData | undefined;
                if (!td) { m.clearTint(); return; }
                if (td.isRaging) m.setTint(0xff2020).setTintMode(TINT_FILL);              // 暴怒怪保留紅 fill
                else if (td.blueprint.tint !== undefined) m.setTint(td.blueprint.tint).setTintMode(0);  // multiply 保留紋路
                else m.clearTint();
            });
            // 傷害數字
            const t = this.add.text(m.x, m.y - 54, `${skillDmg}`, {
                fontFamily: 'sans-serif', fontSize: 44, color: '#ffe060',
                stroke: '#8b3a1f', strokeThickness: 6, fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(460);
            this.tweens.add({ targets: t, y: t.y - 90, alpha: 0, duration: 620, ease: 'Quad.out', onComplete: () => t.destroy() });
            if (data.hp <= 0) this.killMob(m, time);
        }
    }

    private drawPotionHotbar() {
        const hotbar = SaveService.instance.getPotionHotbar();
        const size = 92;
        const x = VIEW_W - 46 - size / 2;   // 右緣 46px margin(與技能鈕同右邊界)
        const gap = 16;
        const startY = 700;
        this.potionSlotCountTexts = [];
        for (let i = 0; i < 3; i++) {
            const id = hotbar[i];
            const y = startY + i * (size + gap);
            const bg = this.add.rectangle(x, y, size, size, 0x2a2520, 0.92)
                .setStrokeStyle(3, id ? 0x8b6020 : 0x4a3a30, id ? 1 : 0.5)
                .setDepth(1100).setScrollFactor(0);
            const p = id ? getPotion(id) : undefined;
            this.add.text(x, y - 14, p ? p.nameZH.slice(0, 2) : '—', {
                fontFamily: 'sans-serif', fontSize: 26, color: id ? '#ffe0c0' : '#5a4a38', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(1101).setScrollFactor(0);
            const cnt = this.add.text(x, y + 22, id ? `×${SaveService.instance.getPotionCount(id)}` : '', {
                fontFamily: 'monospace', fontSize: 22, color: '#ffe060', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(1101).setScrollFactor(0);
            this.potionSlotCountTexts[i] = cnt;
            if (id) {
                bg.setInteractive({ useHandCursor: true });
                bg.on('pointerdown', () => { this.usePotion(id); });
            }
        }
        // Phase 4c-2 補:auto-pot 開關(快捷列下方)
        const ay = startY + 3 * (size + gap);
        const ap0 = SaveService.instance.getAutoPot();
        const autoBg = this.add.rectangle(x, ay, size, size, ap0.enabled ? 0x4a5d3a : 0x2a2520, 0.92)
            .setStrokeStyle(3, ap0.enabled ? 0x7a9a5a : 0x4a3a30, ap0.enabled ? 1 : 0.6)
            .setDepth(1100).setScrollFactor(0).setInteractive({ useHandCursor: true });
        this.add.text(x, ay - 16, '自動', {
            fontFamily: 'sans-serif', fontSize: 24, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1101).setScrollFactor(0);
        const autoState = this.add.text(x, ay + 20, ap0.enabled ? 'ON' : 'OFF', {
            fontFamily: 'monospace', fontSize: 22, color: ap0.enabled ? '#9bd07a' : '#6a5a4a', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1101).setScrollFactor(0);
        autoBg.on('pointerdown', () => {
            const next = !SaveService.instance.getAutoPot().enabled;
            SaveService.instance.setAutoPot({ enabled: next });
            SaveService.instance.save();
            autoBg.setFillStyle(next ? 0x4a5d3a : 0x2a2520, 0.92).setStrokeStyle(3, next ? 0x7a9a5a : 0x4a3a30, next ? 1 : 0.6);
            autoState.setText(next ? 'ON' : 'OFF').setColor(next ? '#9bd07a' : '#6a5a4a');
            this.flashHudMessage(next ? '自動喝藥 開' : '自動喝藥 關', next ? 0x4a5d3a : 0xb08850);
        });
    }

    private refreshPotionHotbar() {
        const hotbar = SaveService.instance.getPotionHotbar();
        for (let i = 0; i < this.potionSlotCountTexts.length; i++) {
            const id = hotbar[i];
            const t = this.potionSlotCountTexts[i];
            if (t && id) t.setText(`×${SaveService.instance.getPotionCount(id)}`);
        }
    }

    // Phase 4c-3 各地商販藥水購買面板
    private openVendorShop(v: ShopNpcSpec) {
        if (this.vendorShopOpen) return;
        this.vendorShopOpen = true;
        const ids = v.sellsPotionIds ?? [];
        const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);
        layer.add(this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x120c0a, 0.92).setOrigin(0, 0).setInteractive());
        const panelH = 390 + ids.length * 130;
        layer.add(this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W - 110, panelH, 0x241c16, 0.99)
            .setStrokeStyle(4, 0x8b6020).setInteractive());
        const top = (VIEW_H - panelH) / 2;
        layer.add(this.add.text(VIEW_W / 2, top + 42, `🧪 ${v.nameZH}`, {
            fontFamily: 'sans-serif', fontSize: 40, color: '#ffe060', fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5));
        const goldT = this.add.text(VIEW_W / 2, top + 96, `💰 ${SaveService.instance.get().gold}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#ffe0c0', fontStyle: 'bold'
        }).setOrigin(0.5);
        layer.add(goldT);
        // 面板內 feedback(在 modal 之上,避免 flashHudMessage depth 2000 被 3000 面板蓋住)
        const fb = this.add.text(VIEW_W / 2, top + 128, '', {
            fontFamily: 'sans-serif', fontSize: 24, color: '#ffe060', fontStyle: 'bold'
        }).setOrigin(0.5);
        layer.add(fb);
        let y = top + 220;
        for (const id of ids) {
            const p = getPotion(id);
            if (!p) continue;
            const price = p.priceGold ?? 0;
            const eff = p.kind === 'fixed' ? `${p.target === 'mp' ? 'MP' : 'HP'} +${p.amount}`
                : p.kind === 'percent' ? `${p.target === 'mp' ? 'MP' : p.target === 'both' ? 'HP/MP' : 'HP'} +${Math.round((p.percent ?? 0) * 100)}%`
                : p.kind === 'full' ? '全恢復' : p.kind === 'hot' ? '持續回血' : 'Buff';
            const row = this.add.rectangle(VIEW_W / 2, y, VIEW_W - 200, 108, 0x1a1612, 0.95)
                .setStrokeStyle(3, 0x8b6020).setInteractive({ useHandCursor: true });
            const t = this.add.text(VIEW_W / 2, y, `${p.nameZH}  (${eff})    💰 ${price}`, {
                fontFamily: 'sans-serif', fontSize: 26, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5);
            row.on('pointerdown', () => {
                if (!SaveService.instance.spendGold(price)) { fb.setText('💰 金幣不足').setColor('#e2542a'); return; }
                SaveService.instance.addPotion(id, 1);
                SaveService.instance.save();
                goldT.setText(`💰 ${SaveService.instance.get().gold}`);
                this.refreshPotionHotbar();
                fb.setText(`+1 ${p.nameZH}  (持有 ×${SaveService.instance.getPotionCount(id)})`).setColor('#ffe060');
            });
            layer.add([row, t]);
            y += 130;
        }
        const closeY = VIEW_H / 2 + panelH / 2 - 66;
        const closeBtn = this.add.rectangle(VIEW_W / 2, closeY, 320, 84, 0xff8830)
            .setStrokeStyle(4, 0x1a1612).setInteractive({ useHandCursor: true });
        layer.add(closeBtn);
        layer.add(this.add.text(VIEW_W / 2, closeY, '關閉', {
            fontFamily: 'sans-serif', fontSize: 36, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5));
        closeBtn.on('pointerdown', () => { layer.destroy(); this.vendorShopOpen = false; });
    }

    // auto-pot + HoT tick(update 每幀呼叫)
    private updatePotions(time: number) {
        if (time < this.hotUntilMs && time - this.hotLastTickMs >= 1000 && this.playerHP > 0) {
            this.hotLastTickMs = time;
            this.playerHP = Math.min(this.playerMaxHp, this.playerHP + Math.round(this.playerMaxHp * this.hotPerSec));
            this.hpBarFill.width = (this.hudPlateBarW - 4) * (this.playerHP / this.playerMaxHp);
            this.hpText.setText(`HP  ${this.playerHP} / ${this.playerMaxHp}`);
        }
        const ap = SaveService.instance.getAutoPot();
        if (ap.enabled && time >= this.potionCdUntilMs && this.playerHP > 0) {
            if (ap.hpPotionId && this.playerHP / this.playerMaxHp <= ap.hpThresholdPct && SaveService.instance.getPotionCount(ap.hpPotionId) > 0) {
                this.usePotion(ap.hpPotionId, true);
            } else if (ap.mpPotionId) {
                const c = SaveService.instance.get();
                if (c.mp / c.maxMp <= ap.mpThresholdPct && SaveService.instance.getPotionCount(ap.mpPotionId) > 0) this.usePotion(ap.mpPotionId, true);
            }
        }
    }

    private potionAtkPct(): number { return this.time.now < this.buffAtkUntilMs ? this.buffAtkPct : 0; }
    private potionDefPct(): number { return this.time.now < this.buffDefUntilMs ? this.buffDefPct : 0; }

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
            const bg = this.add.rectangle(0, 0, tabW - 24, tabH - 18, 0x2a2520, 0.85)
                .setStrokeStyle(2, 0x4a3a30);
            const icon = this.add.text(0, -35, t.icon, {
                fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830'
            }).setOrigin(0.5);
            const label = this.add.text(0, 45, t.label, {
                fontFamily: 'sans-serif', fontSize: 32, color: '#ffe0c0', fontStyle: 'bold'
            }).setOrigin(0.5);
            c.add([bg, icon, label]);
            c.setSize(tabW - 24, tabH - 18);
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
        if (this.vendorShopOpen) return;
        // ④ 出生無敵:首個真正 gameplay tick(FTUE pause→resume 後才跑到這)才 arm,用 update 的 global time 與傷害判定同源
        if (!this.spawnGraceArmed) { this.spawnGraceArmed = true; this.startSpawnGrace(time); }
        if (this.skillRequested) { this.skillRequested = false; this.useSkill(time); }
        this.refreshSkillButton(time);
        // VFX-A:玩家陰影跟腳(origin 中心,腳在下方 ~ displayHeight*0.42)
        if (this.playerShadow) {
            this.playerShadow.x = this.player.x;
            this.playerShadow.y = this.player.y + this.player.displayHeight * 0.42;
        }
        this.handleMovement(delta);
        this.handleSpawn(time);
        this.trySpawnBoss(time);
        this.handleMobAI(time, delta);
        this.handleMobContactDamage(time);
        if (this.isGameOver) return;
        this.handleAutoAttack(time, delta);
        this.updatePotions(time);
        this.updateHpRegen(delta);
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
            const color = md.blueprint.isBoss ? 0xff8830 : md.isElite ? ELITE_TINT : 0xc23a1a;
            const r = md.blueprint.isBoss ? 6 : md.isElite ? 5 : 3;
            this.minimap.fillStyle(color, 1);
            this.minimap.fillCircle(px(m.x), py(m.y), r);
        }
        // NPC clerk
        if (this.npcClerk) {
            this.minimap.fillStyle(0xb08850, 1);
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
    // Phase 4c C-fix:依當前 frame 原始高度反推 scale,讓 render 高度恆為 PLAYER_DISPLAY_H
    private lockPlayerScale() {
        const h = this.player.height;
        if (h > 0) this.player.setScale(PLAYER_DISPLAY_H / h);
    }

    private setPlayerAnimState(state: 'idle' | 'walking', force = false) {
        if (!force && this.playerAnimState === state) return;
        this.playerAnimState = state;
        if (this.playerStateTween) this.playerStateTween.stop();
        this.player.angle = 0;
        if (state === 'idle') {
            this.player.anims.stop();
            this.player.setTexture('player_idle');
        } else {
            this.player.play('player_walk', true);
        }
        this.lockPlayerScale();
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
        this.lockPlayerScale();  // animationupdate 不觸發首 frame,手動鎖一次
        this.player.once('animationcomplete-player_attack', () => {
            this.playerActionAnim = null;
            const s = this.playerAnimState;
            this.playerAnimState = s === 'idle' ? 'walking' : 'idle';
            this.setPlayerAnimState(s, true);
        });
    }
    // VFX-A:建立腳下落地陰影橢圓(扁圓 + 柔和暗影色,depth -10 躲在 sprite 下、蓋在地圖上)
    private makeGroundShadow(x: number, y: number, radiusX: number): Phaser.GameObjects.Ellipse {
        const sh = this.add.ellipse(x, y, radiusX, radiusX * 0.42, 0x0f0c0a, 0.34);
        sh.setDepth(-10);
        return sh;
    }

    private spawnSwingEffect(targetX: number, targetY: number, isCrit: boolean)
    {
        const px = this.player.x, py = this.player.y;
        const angle = Math.atan2(targetY - py, targetX - px);
        const arcR = isCrit ? 220 : 188;
        const halfSpread = isCrit ? Math.PI / 4.5 : Math.PI / 6; // crit 弧更開
        const startA = angle - halfSpread;
        const endA = angle + halfSpread;
        const g = this.add.graphics();
        g.setDepth(450);
        // 外弧(最粗,廢土橙;crit 鏽紅)— 飽滿底層
        g.lineStyle(isCrit ? 18 : 13, isCrit ? 0x8b3a1f : 0xa05a30, 0.55);
        g.beginPath();
        g.arc(px, py, arcR, startA, endA);
        g.strokePath();
        // 中弧(主色暖橙 / crit 亮紅)— 弧的本體
        g.lineStyle(isCrit ? 10 : 8, isCrit ? 0xff4040 : 0xff8830, 0.95);
        g.beginPath();
        g.arc(px, py, arcR, startA + 0.03, endA - 0.03);
        g.strokePath();
        // 內弧高光(米白)— 銳利刀刃光
        g.lineStyle(isCrit ? 4 : 3, 0xffe0c0, 0.85);
        g.beginPath();
        g.arc(px, py, arcR - (isCrit ? 9 : 7), startA + 0.08, endA - 0.08);
        g.strokePath();
        // 揮砍掃過 — 微微旋轉 + 縮放 + 淡出(更有「掃」的動感)
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: isCrit ? 220 : 140,
            onComplete: () => g.destroy()
        });
        // 末端火花 spark(弧的尾端,朝外噴小碎光)
        const tipX = px + Math.cos(endA) * arcR;
        const tipY = py + Math.sin(endA) * arcR;
        const sparkN = isCrit ? 7 : 4;
        for (let i = 0; i < sparkN; i++) {
            const sa = endA + (Math.random() - 0.5) * 1.2;
            const sd = (isCrit ? 36 : 22) + Math.random() * (isCrit ? 40 : 24);
            const spark = this.add.circle(tipX, tipY, isCrit ? 4 : 3, isCrit ? 0xffe060 : 0xffe0c0, 0.95).setDepth(451);
            this.tweens.add({
                targets: spark,
                x: tipX + Math.cos(sa) * sd,
                y: tipY + Math.sin(sa) * sd,
                alpha: 0, scale: 0.2,
                duration: isCrit ? 240 : 170, ease: 'Quad.out',
                onComplete: () => spark.destroy()
            });
        }
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
        // Phase 4c B fix:戰鬥朝向期間(剛攻擊過)不用移動方向覆蓋 flipX,避免往後走背打
        if (Math.abs(normDx) > 0.1 && this.time.now > this.combatFaceUntilMs) {
            this.player.setFlipX(normDx < 0);
        }
        // state machine:走路時切 walking(若不在 action anim 中)
        if (this.playerAnimState !== 'walking' && !this.playerActionAnim) {
            this.setPlayerAnimState('walking');
        }
    }

    private handleSpawn(time: number)
    {
        for (const sp of this.spawnPoints) {
            if (sp.mob === null && time >= sp.nextSpawnAt) {
                // ④ 安全半徑:玩家就在 spawn point 旁時不點臉刷出,延後 0.8s 重試(楓谷 cycle 仍維持)
                if (Math.hypot(sp.x - this.player.x, sp.y - this.player.y) < Game.SPAWN_SAFE_RADIUS) {
                    sp.nextSpawnAt = time + 800;
                    continue;
                }
                const bp = MOB_BLUEPRINTS[sp.blueprintIdx];
                const isElite = Math.random() < ELITE_CHANCE;        // 偶發精英怪(掛機狩獵小目標)
                const mScale = isElite ? bp.scale * ELITE_SCALE_MULT : bp.scale;
                const mob = this.add.sprite(sp.x, sp.y, bp.spriteKey).setScale(mScale);
                if (isElite) {
                    mob.setTint(ELITE_TINT);                          // 金黃 multiply,蓋過 bp.tint(精英標識)
                } else if (bp.tint !== undefined) {
                    // Phase 4b-13:multiply mode 保留紋路(避免全灰 fill 看起來像 bug)
                    mob.setTint(bp.tint);
                }
                // Phase 4b-11 play frame anim by blueprint id
                // 真‧獨立新怪是單張 sprite(無 run frames)→ 不 play frame anim(否則會換到 giantrat/centipede 貼圖),改腳步輕微縮放抖動
                if (bp.spriteKey === 'mob_rust_spider' || bp.spriteKey === 'mob_reactor_crawler' || bp.spriteKey === 'mob_mutant_creeper') {
                    this.tweens.add({ targets: mob, scaleX: mScale * 1.06, scaleY: mScale * 0.96, duration: 380, yoyo: true, repeat: -1 });
                } else if (bp.id === 'centipede' || bp.id === 'scrap_drone') {
                    mob.play('centipede_wave');
                } else {
                    mob.play('giantrat_run'); // giantrat 用 4-leg gallop
                }
                const data: MobData = {
                    blueprint: bp,
                    hp: isElite ? Math.round(bp.hp * ELITE_HP_MULT) : bp.hp,
                    spawnPoint: sp,
                    lastContactMs: -Infinity,
                    state: 'wander',
                    wanderTargetX: sp.x,
                    wanderTargetY: sp.y,
                    nextWanderAt: 0,
                    isElite
                };
                mob.setData('mob', data);
                if (isElite) {
                    // 精英登場:金環爆 + 公告
                    this.flashHudMessage('⚠ 精英怪出現!', ELITE_TINT);
                    const eRing = this.add.circle(mob.x, mob.y, 30, ELITE_TINT, 0)
                        .setStrokeStyle(6, ELITE_TINT, 1).setDepth(450);
                    this.tweens.add({ targets: eRing, radius: 180, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => eRing.destroy() });
                }
                // VFX-A:怪落地陰影(依 mob displayWidth 縮放)
                mob.setData('shadow', this.makeGroundShadow(mob.x, mob.y, Math.max(36, mob.displayWidth * 0.7)));
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

            // VFX-A:怪陰影跟腳(在任何 continue 前先同步)
            const sh = m.getData('shadow') as Phaser.GameObjects.Ellipse | undefined;
            if (sh) {
                sh.x = m.x;
                sh.y = m.y + m.displayHeight * 0.42;
            }

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
                this.takeDamage(Math.round(data.blueprint.contactDamage * (data.isElite ? ELITE_DMG_MULT : 1)), time);
                return; // 一個 frame 只扣一次,不疊
            }
        }
    }

    // ④ 出生無敵緩衝:防新手一進場/復活被圍毆秒死。now 用 update 的 global time(與 takeDamage 同源)
    private startSpawnGrace(now: number)
    {
        this.playerInvulnUntilMs = now + Game.SPAWN_GRACE_MS;
        const blink = this.tweens.add({ targets: this.player, alpha: 0.45, duration: 200, yoyo: true, repeat: -1 });
        this.time.delayedCall(Game.SPAWN_GRACE_MS, () => {
            blink.stop();
            if (this.player.active) this.player.setAlpha(1);
        });
    }

    private takeDamage(amount: number, time: number)
    {
        if (this.isGameOver) return; // per Codex review
        const buff = computeTalentBuff();
        // Phase 4c-F 防具減傷:dmg × 100/(100+def),最低 1
        const def = SaveService.instance.getTotalArmorDefense();
        amount = def > 0 ? Math.max(1, Math.round(amount * 100 / (100 + def))) : amount;
        // 天賦減傷(鐵壁/廢土之神 正;玻璃炮 負)+ 背水一戰(HP<30% 額外減傷),上限 80%
        let drPct = buff.damageReductionPct + this.potionDefPct();
        if (this.playerHP / this.playerMaxHp < 0.30) drPct += buff.lowHpDrBonus;
        if (drPct !== 0) amount = Math.max(1, Math.round(amount * Math.max(0.2, 1 - drPct)));
        this.playerHP = Math.max(0, this.playerHP - amount);
        this.playerInvulnUntilMs = time + Game.PLAYER_INVULN_MS;

        // 鏽刺反甲 / 鋼鐵壁壘:反彈傷害給最近的怪
        if (buff.thornPct > 0) this.reflectThorns(Math.max(1, Math.round(amount * buff.thornPct)), time);

        // 血條 + 文字
        const ratio = this.playerHP / this.playerMaxHp;
        this.hpBarFill.width = (this.hudPlateBarW - 4) * ratio;
        this.hpText.setText(`HP  ${this.playerHP} / ${this.playerMaxHp}`);

        // HP=0 → 不朽之軀(CD 內)留 1HP + 無敵 2s;否則 GameOver
        if (this.playerHP <= 0) {
            if (buff.cheatDeath && time >= this.immortalReadyAt) {
                this.playerHP = 1;
                this.immortalReadyAt = time + 180000;
                this.playerInvulnUntilMs = time + 2000;
                this.hpBarFill.width = (this.hudPlateBarW - 4) * (1 / this.playerMaxHp);
                this.hpText.setText(`HP  1 / ${this.playerMaxHp}`);
                this.flashHudMessage('不朽之軀!留 1 HP', 0xffe060);
                return;
            }
            this.handleGameOver();
            return;
        }

        // Phase 4b-14 真 frame hurt anim — sprite 切到 hurt frame 250ms
        this.player.off('animationcomplete-player_hurt');
        this.playerActionAnim = 'hurt';
        this.player.play('player_hurt', true);
        this.lockPlayerScale();  // hurt 單 frame,animationupdate 永不觸發,必手動鎖
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
        this.cameras.main.shake(90, 0.006);  // 視覺暈感修正:玩家受擊在怪群中很頻繁,降震幅防暈(紅閃 tint 仍提示)

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
        // 嗜血狂亂:HP 越低額外傷害(滿血+0 → 瀕死 +berserkLowHpDmg)
        const berserkBonus = buff.berserkLowHpDmg * (1 - this.playerHP / this.playerMaxHp);
        const totalDmgMult = (1 + buff.dmgPct + this.potionAtkPct() + berserkBonus) * (isCrit ? (Game.CRIT_MULT + buff.critDmgPct) : 1);
        const dmg = Math.round(baseDmg * totalDmgMult);

        // Hand Rag recovery — 命中回血 0.5% × baseDmg
        if (weapon.recoveryPercent && this.playerHP < this.playerMaxHp) {
            const heal = Math.max(1, Math.round(baseDmg * weapon.recoveryPercent * 100));
            this.playerHP = Math.min(this.playerMaxHp, this.playerHP + heal);
            this.hpBarFill.width = (this.hudPlateBarW - 4) * (this.playerHP / this.playerMaxHp);
            this.hpText.setText(`HP  ${this.playerHP} / ${this.playerMaxHp}`);
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
        // 死神鐮刀:殘血(< executeThreshold)非 boss 直接處決
        if (buff.executeThreshold > 0 && data.hp > 0 && !data.blueprint.isBoss && data.hp < data.blueprint.hp * buff.executeThreshold) {
            data.hp = 0;
        }

        // 武器類別專屬玩家動作(楓谷風)
        this.playWeaponAttackAnim(weapon, target.x, target.y);
        // Phase 4c B fix:攻擊後 flipX 保持朝怪到下次攻擊(cooldown + 100ms 緩衝),
        // 涵蓋慢武器(per Codex:用 attackCooldownMs 而非固定 900,所有武器都嚴格連續面怪)
        this.combatFaceUntilMs = time + this.attackCooldownMs + 100;

        // 木棍揮砍視覺(廢土橙弧線從 player 朝 target 揮 60°)
        this.spawnSwingEffect(target.x, target.y, isCrit);

        // VFX-A:命中點衝擊環 — 白橙細環瞬間擴張淡出(增打擊質感,不碰 mob scale 避免與死亡 tween 衝突)
        const impactRing = this.add.circle(target.x, target.y, isCrit ? 18 : 12, 0xffe0c0, 0)
            .setStrokeStyle(isCrit ? 5 : 3, isCrit ? 0xffe060 : 0xffe0c0, 0.95).setDepth(455);
        this.tweens.add({
            targets: impactRing, scale: isCrit ? 3.2 : 2.2, alpha: 0,
            duration: isCrit ? 240 : 160, ease: 'Quad.out',
            onComplete: () => impactRing.destroy()
        });

        // Hit flash + 還原:rage boss 用 0xff2020,普通 用 blueprint.tint(per Codex review)
        target.setTint(0xffffff).setTintMode(TINT_FILL);
        this.time.delayedCall(100, () => {
            if (!target.active) return;
            const tData = target.getData('mob') as MobData | undefined;
            if (!tData) { target.clearTint(); return; }
            if (tData.isRaging) {
                target.setTint(0xff2020).setTintMode(TINT_FILL);
            } else if (tData.isElite) {
                target.setTint(ELITE_TINT).setTintMode(0);
            } else if (tData.blueprint.tint !== undefined) {
                // multiply mode 保留紋路 — 必須 setTintMode(0) 切回 multiply,否則白閃的 fill mode 殘留→怪變純色剪影失去紋路(user 報「打擊後失去顏色」)
                target.setTint(tData.blueprint.tint).setTintMode(0);
            } else {
                target.clearTint();
            }
        });

        // Damage popup — crit:大、亮黃紅、彈跳重擊感;普通:小、暖橙、輕飄
        const jitterX = (Math.random() - 0.5) * 40;
        const dmgText = this.add.text(target.x + jitterX, target.y - 56, isCrit ? `${dmg}!` : `${dmg}`, {
            fontFamily: 'sans-serif',
            fontSize: isCrit ? 78 : 36,
            color: isCrit ? '#ffe060' : '#ff8830',
            stroke: isCrit ? '#8b3a1f' : '#1a1612', strokeThickness: isCrit ? 10 : 4,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(460);
        if (isCrit) {
            // crit:從大砸下 → 回彈 → 飄升淡出(重擊震感)
            dmgText.setScale(1.9).setAngle((Math.random() - 0.5) * 16);
            this.tweens.chain({
                targets: dmgText,
                tweens: [
                    { scale: 1.1, angle: 0, duration: 130, ease: 'Back.out' },
                    { y: dmgText.y - 120, alpha: 0, scale: 1.25, duration: 620, delay: 90, ease: 'Quad.out' }
                ],
                onComplete: () => dmgText.destroy()
            });
        } else {
            dmgText.setScale(0.7);
            this.tweens.chain({
                targets: dmgText,
                tweens: [
                    { scale: 1, duration: 90, ease: 'Back.out' },
                    { y: dmgText.y - 78, alpha: 0, duration: 540, ease: 'Quad.out' }
                ],
                onComplete: () => dmgText.destroy()
            });
        }

        // per Codex review:shake 必須在 HitStop 之前,否則 shake duration 被 timescale 拉長變黏膩
        // 視覺暈感修正(user 報):普通命中不 shake(連打螢幕一直晃會暈),只暴擊輕震;移除暴擊全螢幕紅閃(連續閃最暈)。
        // 打擊感改靠 HitStop(lock)+ hit flash + damage popup,不靠晃螢幕。
        if (isCrit) this.cameras.main.shake(110, 0.009);
        HitStopService.instance.trigger(isCrit ? 120 : 80, isCrit ? 0.05 : 0.10);

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
            this.killMob(target, time);
        }
    }

    // 怪死亡處理(cycle 重生 + reward + 掉落 + 死亡 VFX)— handleAutoAttack 與主動技能共用
    private killMob(target: Phaser.GameObjects.Image, time: number) {
        const data = target.getData('mob') as MobData;
        const sp = data.spawnPoint;
        if (sp) {
            sp.mob = null;
            sp.nextSpawnAt = time + RESPAWN_CYCLE_MS;
        }
        this.mobs = this.mobs.filter(m => m !== target);
        this.spawnGoldDrop(target.x, target.y, data.blueprint.goldReward * (data.isElite ? ELITE_REWARD_MULT : 1));
        this.grantKillReward(target.x, target.y, data.blueprint, data.isElite === true);
        this.rollMobDrops(target.x, target.y, data.blueprint.isBoss === true, data.isElite === true);
        if (data.isElite) {
            this.flashHudMessage('★ 精英擊破!', ELITE_TINT);
            this.cameras.main.shake(140, 0.01);
        }
        if (data.blueprint.isBoss) {
            this.handleBossDefeated(target.x, target.y);
        }
        this.spawnDeathBurst(target.x, target.y, data.blueprint.isBoss === true);
        const deadShadow = target.getData('shadow') as Phaser.GameObjects.Ellipse | undefined;
        if (deadShadow) {
            this.tweens.add({
                targets: deadShadow, alpha: 0, scaleX: 1.3, scaleY: 1.3,
                duration: 180, onComplete: () => deadShadow.destroy()
            });
        }
        this.tweens.killTweensOf(target);  // 清掉殘留 idle tween(如鏽蜘蛛 wobble repeat:-1),避免洩漏 + 與死亡 tween 衝突
        this.tweens.add({
            targets: target, scale: target.scaleX * 1.4, alpha: 0,
            duration: 180, ease: 'Quad.out',
            onComplete: () => target.destroy()
        });
    }

    // Phase 4b-7 掉落系統
    private rollMobDrops(x: number, y: number, isBoss: boolean, isElite = false) {
        const save = SaveService.instance;
        // Phase 4c-D3 天賦掉落率加成(拾荒者之心/幸運拾荒/囤積之王)+ 精英怪 ×3 掉落機率
        const buff = computeTalentBuff();
        const dropMult = (1 + buff.dropRatePct) * (isElite ? 3 : 1);
        // 強化石(50% / boss 100%)+ 廢土煉金:doubleMatChance 機率翻倍
        if (isBoss || Math.random() < 0.5 * dropMult) {
            let mat = isBoss ? 5 : 1;
            if (buff.doubleMatChance > 0 && Math.random() < buff.doubleMatChance) mat *= 2;
            save.addMaterial('strengthen_stone', mat);
            this.spawnFloatingLabel(x, y - 40, `+${mat} 強化石`, '#b08850');
        }
        // 武器掉落(5% / boss 50%)
        if (isBoss || Math.random() < 0.05 * dropMult) {
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
        // Phase 4c-F 防具掉落(8% / boss 60%)
        if (Math.random() < (isBoss ? 0.60 : 0.08 * dropMult)) {
            const a = generateRandomArmor();
            save.addOwnedArmor(a);
            this.spawnFloatingLabel(x, y - 120, `防具:${armorDisplayName(a)} [${a.tier}]`, '#80c0ff');
            const ac = this.add.circle(x, y, 26, armorRarityColor(a.tier), 0.8)
                .setStrokeStyle(3, 0xffe0c0);
            this.tweens.add({
                targets: ac, scale: 1.5, alpha: 0, duration: 800,
                onComplete: () => ac.destroy()
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
        // VFX-A:boss 大陰影
        mob.setData('shadow', this.makeGroundShadow(mob.x, mob.y, Math.max(80, mob.displayWidth * 0.7)));
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

    private grantKillReward(x: number, y: number, bp: MobBlueprint, isElite = false)
    {
        const save = SaveService.instance;
        const buff = computeTalentBuff();
        const eliteMult = isElite ? ELITE_REWARD_MULT : 1;
        save.addKill();
        // 擊殺里程碑(留存):跨門檻給晶體 + 慶祝 toast
        const milestone = save.claimKillMilestones();
        if (milestone) this.flashHudMessage(`擊殺 ${milestone.kills} 達成! +${milestone.crystal} 晶體`, 0xffe060);
        // 週挑戰(recurring 留存):本週擊殺達標領晶體
        const weekly = save.tickWeeklyChallenge();
        if (weekly) this.flashHudMessage(`週挑戰達成! 本週擊殺 ${weekly.goal}  +${weekly.crystal} 晶體`, 0x9bd0ff);
        this.updateWeekChallengeBar();
        // Phase 4b-15 talent: gold buff(金幣不再 HUD 顯示,各 scene 內看)+ 精英怪 ×倍
        save.addGold(Math.round(bp.goldReward * (1 + buff.goldGainPct) * eliteMult));
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
        const expGain = Math.round(bp.expReward * (1 + buff.expGainPct) * eliteMult);
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
        this.expBarFill.width = (this.hudExpBarW - 4) * ratio;
        this.expText.setText(`EXP ${cur.exp} / ${save.expToNext()} (${Math.floor(ratio * 100)}%)`);

        if (result.leveled) {
            this.levelText.setText(`Lv ${cur.level}`);
            this.spawnLevelUpEffect(result.levelsGained);
        }
        if (result.leveled || milestone || weekly) {
            // 升級 / 擊殺里程碑 / 週挑戰(晶體獎勵)立刻 persist —— 含本次 gold/exp/quest 一起落盤
            save.save();
            this.lastPersistMs = Date.now();
        } else {
            // 普通殺怪 3s throttle persist(per Codex review:防 tab close 丟 exp/gold)
            this.saveProgressSoon();
        }
    }

    // 週挑戰 HUD 進度條:每殺後刷新本週進度(達標顯示金黃「已達成」)
    private updateWeekChallengeBar(): void {
        if (!this.weekBarFill) return;
        const w = SaveService.instance.getWeekStatus();
        const ratio = Math.max(0, Math.min(1, w.kills / w.goal));
        this.weekBarFill.width = this.weekBarInnerW * ratio;
        if (w.claimed) {
            this.weekBarFill.fillColor = 0xffd040;
            this.weekBarFill.width = this.weekBarInnerW;
            this.weekBarText.setText(`週挑戰 已達成 ★`);
        } else {
            this.weekBarFill.fillColor = 0x9bd0ff;
            this.weekBarText.setText(`週挑戰 ${w.kills}/${w.goal}`);
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
        // 天賦:快手拆解(撿取範圍 +)/ 廢料磁吸(全螢幕自動吸)
        const buff = computeTalentBuff();
        const pickupR = Game.PICKUP_RANGE * (1 + buff.pickupRangePct);
        const magnetR = buff.autoMagnetAll ? 99999 : Game.MAGNET_RANGE * (1 + buff.pickupRangePct);
        const lerp = buff.autoMagnetAll ? 0.16 : Game.MAGNET_LERP;
        const px = this.player.x, py = this.player.y;
        for (let i = this.pendingPickups.length - 1; i >= 0; i--) {
            const e = this.pendingPickups[i];
            if (!e.obj.active) { this.pendingPickups.splice(i, 1); continue; }
            const dx = px - e.obj.x, dy = py - e.obj.y;
            const dist = Math.hypot(dx, dy);
            if (dist < pickupR) {
                e.collect();
                e.obj.destroy();
                this.pendingPickups.splice(i, 1);
            } else if (dist < magnetR) {
                e.obj.x += dx * lerp;
                e.obj.y += dy * lerp;
            }
        }
    }

    // 疤痕組織:每秒回血(不足 1 點累進 hpRegenCarry)
    private updateHpRegen(delta: number) {
        if (this.isGameOver) return;
        const rps = computeTalentBuff().hpRegenPerSec;
        if (rps <= 0 || this.playerHP >= this.playerMaxHp) { this.hpRegenCarry = 0; return; }
        this.hpRegenCarry += rps * (delta / 1000);
        if (this.hpRegenCarry >= 1) {
            const heal = Math.floor(this.hpRegenCarry);
            this.hpRegenCarry -= heal;
            this.playerHP = Math.min(this.playerMaxHp, this.playerHP + heal);
            this.hpBarFill.width = (this.hudPlateBarW - 4) * (this.playerHP / this.playerMaxHp);
            this.hpText.setText(`HP  ${this.playerHP} / ${this.playerMaxHp}`);
        }
    }

    // 鏽刺反甲 / 鋼鐵壁壘:受擊反彈傷害給最近的怪
    private reflectThorns(dmg: number, time: number) {
        if (dmg <= 0) return;
        let nearest: Phaser.GameObjects.Sprite | null = null;
        let nd = 360;  // 反彈只打附近的怪
        for (const m of this.mobs) {
            if (!m.active) continue;
            const d = Math.hypot(this.player.x - m.x, this.player.y - m.y);
            if (d < nd) { nd = d; nearest = m; }
        }
        if (!nearest) return;
        const data = nearest.getData('mob') as MobData;
        data.hp -= dmg;
        const t = this.add.text(nearest.x, nearest.y - 50, `${dmg}`, {
            fontFamily: 'sans-serif', fontSize: 30, color: '#9bd0ff', stroke: '#1a1612', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(460);
        this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        if (data.hp <= 0) this.killMob(nearest, time);
    }

    // Phase 4b-12 (A) 怪死亡爆碎屑 — 廢土碎屑粒子 8-12 顆飛濺
    private spawnDeathBurst(x: number, y: number, isBoss: boolean) {
        // 1) 瞬間白閃核心 — 死亡那一下的高光點
        const flash = this.add.circle(x, y, isBoss ? 50 : 30, 0xffe0c0, 0.9).setDepth(424);
        this.tweens.add({
            targets: flash, scale: isBoss ? 2.4 : 1.8, alpha: 0,
            duration: isBoss ? 220 : 150, ease: 'Quad.out',
            onComplete: () => flash.destroy()
        });
        // 2) 灰塵環 — 沿地面散開淡化(per boss-effects 規則:散開非縮小)
        const dust = this.add.circle(x, y + 20, isBoss ? 30 : 20, 0x4a3018, 0)
            .setStrokeStyle(isBoss ? 8 : 5, 0xb08850, 0.6).setDepth(421);
        this.tweens.add({
            targets: dust, scale: isBoss ? 5 : 3.4, alpha: 0,
            duration: isBoss ? 560 : 420, ease: 'Cubic.out',
            onComplete: () => dust.destroy()
        });
        // 3) 碎屑爆射 — 比原本更猛(數量↑、距離↑、加重力下墜感)
        const count = isBoss ? 40 : 18;
        const palette = [0x4a3018, 0x8b3a1f, 0xb08850, 0x2a2520, 0xa05a30, 0x8b6020];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = isBoss ? 90 + Math.random() * 230 : 55 + Math.random() * 150;
            const size = 2 + Math.random() * (isBoss ? 8 : 5);
            const color = palette[Math.floor(Math.random() * palette.length)];
            const p = this.add.rectangle(x, y, size, size, color, 0.96).setDepth(422);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist + (isBoss ? 70 : 45), // 重力下墜
                alpha: 0,
                scale: 0.4,
                angle: (Math.random() - 0.5) * 720,
                duration: 480 + Math.random() * 360,
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

        // Phase 4c 設計修正:升級後重算 maxHP(等級成長)再回滿
        this.playerMaxHp = this.computeMaxHp(SaveService.instance.get().level);
        // HP / MP 全滿 + bar + text flash
        this.playerHP = this.playerMaxHp;
        this.hpBarFill.width = this.hudPlateBarW - 4;
        this.hpText.setText(`HP  ${this.playerMaxHp} / ${this.playerMaxHp}`);
        const maxMp = SaveService.instance.getMaxMp();
        SaveService.instance.setMp(maxMp);
        this.mpBarFill.width = this.hudPlateBarW - 4;
        this.mpText.setText(`MP  ${maxMp} / ${maxMp}`);

        // 全屏暖橙光暈 — 螢幕固定的徑向 glow,從中央炸開淡化(壯觀感)
        const glow = this.add.circle(VIEW_W / 2, VIEW_H / 2, 120, 0xff8830, 0.55)
            .setDepth(1900).setScrollFactor(0);
        this.tweens.add({
            targets: glow, scale: 9, alpha: 0,
            duration: 700, ease: 'Quad.out',
            onComplete: () => glow.destroy()
        });

        // 大字「LEVEL UP!」中央停 1.5s — 帶金色描邊 + 重彈
        const txt = levelsGained > 1 ? `LEVEL UP ×${levelsGained}!` : 'LEVEL UP!';
        const popup = this.add.text(this.player.x, this.player.y - 120, txt, {
            fontFamily: 'sans-serif', fontSize: 104, color: '#ffe0c0', fontStyle: 'bold',
            stroke: '#ff8830', strokeThickness: 12
        }).setOrigin(0.5).setDepth(2000).setScale(0.1);
        this.tweens.chain({
            targets: popup,
            tweens: [
                { scale: 1.5, duration: 260, ease: 'Back.out' },
                { scale: 1.25, duration: 90, ease: 'Sine.inOut' },
                { alpha: 0, y: popup.y - 90, duration: 700, delay: 600 }
            ],
            onComplete: () => popup.destroy()
        });

        // 多層金環擴散 — 4 道,粗細與顏色交錯
        for (let i = 0; i < 4; i++) {
            const ring = this.add.circle(this.player.x, this.player.y, 50, 0xff8830, 0)
                .setStrokeStyle(i % 2 === 0 ? 9 : 5, i % 2 === 0 ? 0xffe060 : 0xff8830, 0.95)
                .setDepth(500);
            this.tweens.add({
                targets: ring, radius: 360, alpha: 0,
                duration: 1150, delay: i * 150, ease: 'Cubic.out',
                onComplete: () => ring.destroy()
            });
        }

        // 升騰金色光點 — 從玩家腳下往上飄(升級的「提升」意象)
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 70;
            const sx = this.player.x + Math.cos(a) * r;
            const sy = this.player.y + 40 + Math.random() * 30;
            const mote = this.add.circle(sx, sy, 4 + Math.random() * 4, 0xffe060, 0.95).setDepth(501);
            this.tweens.add({
                targets: mote,
                y: sy - 200 - Math.random() * 120,
                alpha: 0, scale: 0.2,
                duration: 800 + Math.random() * 400, delay: Math.random() * 200,
                ease: 'Quad.out',
                onComplete: () => mote.destroy()
            });
        }
    }

    // Phase 4b-12 (B) 金幣 啵跳 + 閃光環 + 加進磁吸 queue
    private spawnGoldDrop(x: number, y: number, amount: number)
    {
        // 金幣枚數隨金額(boss/精英多枚噴發,更爽)— cap 6 避免磁吸 queue 爆量
        const coinCount = Math.max(1, Math.min(6, Math.round(amount / 12)));
        for (let c = 0; c < coinCount; c++) {
            const dropX = x + (Math.random() - 0.5) * (30 + coinCount * 8);
            const dropY = y + (Math.random() - 0.5) * 30;
            // 金幣本體(更亮的金 + 較粗鏽金邊,立體幣感)
            const coin = this.add.circle(dropX, dropY - 40, 15, 0xffe060, 1)
                .setStrokeStyle(3, 0x8b6020).setDepth(400);
            // 起跳瞬間的高光點 — 快速淡出(在磁吸前消失,不需跟隨)
            const glint = this.add.circle(dropX - 4, dropY - 44, 4, 0xfff6d0, 0.95).setDepth(401);
            this.tweens.add({
                targets: glint, alpha: 0, scale: 0.3, duration: 280, ease: 'Quad.out',
                onComplete: () => glint.destroy()
            });
            // 啵跳 — 上升再彈落(多枚錯開時序)
            this.tweens.chain({
                targets: coin,
                tweens: [
                    { y: dropY - 84, duration: 180, delay: c * 40, ease: 'Quad.out' },
                    { y: dropY, duration: 220, ease: 'Bounce.out' }
                ]
            });
            // 加進磁吸 queue,player 靠近自動拾取
            this.pendingPickups.push({
                obj: coin,
                collect: () => {} // gold 已在 grantKillReward 加進 save,coin 視覺到手即消
            });
        }
        // 落地閃光環 ×2(交錯擴散,枚數多時環更大)
        for (let i = 0; i < 2; i++) {
            const ring = this.add.circle(x, y, 18, 0xffe060, 0)
                .setStrokeStyle(3, 0xffe060, 0.8).setDepth(399);
            this.tweens.add({
                targets: ring, radius: 64 + coinCount * 8, alpha: 0, duration: 440, delay: i * 130,
                onComplete: () => ring.destroy()
            });
        }
    }

    // Phase 4b-12 (B) 通用 dropped item spawn(武器 / 素材)— 啵跳 + 閃環 + 磁吸
    spawnDropPickup(x: number, y: number, color: number, label: string, onCollect: () => void) {
        const dropX = x + (Math.random() - 0.5) * 60;
        const dropY = y + (Math.random() - 0.5) * 30;
        const icon = this.add.rectangle(dropX, dropY - 40, 26, 26, color, 1)
            .setStrokeStyle(3, 0xffe0c0, 0.95).setDepth(400).setAngle(45);
        // 起跳高光點(快速淡出)
        const glint = this.add.circle(dropX - 5, dropY - 46, 4, 0xffffff, 0.85).setDepth(401);
        this.tweens.add({
            targets: glint, alpha: 0, scale: 0.3, duration: 300, ease: 'Quad.out',
            onComplete: () => glint.destroy()
        });
        // 啵跳 + 邊旋轉落地(更有「掉寶」感)
        this.tweens.chain({
            targets: icon,
            tweens: [
                { y: dropY - 84, angle: 0, duration: 180, ease: 'Quad.out' },
                { y: dropY, duration: 240, ease: 'Bounce.out' }
            ]
        });
        // 稀有度雙環擴散(用 item 顏色)
        for (let i = 0; i < 2; i++) {
            const ring = this.add.circle(dropX, dropY, 24, color, 0)
                .setStrokeStyle(3, color, 0.85).setDepth(399);
            this.tweens.add({
                targets: ring, radius: 88, alpha: 0, duration: 520, delay: i * 140,
                onComplete: () => ring.destroy()
            });
        }
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
