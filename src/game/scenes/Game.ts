import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';
import { VirtualJoystick } from '../services/VirtualJoystick';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;
const CX = W / 2;
const CY = H / 2;

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
    tint?: number;          // 可選 fill tint(scrap drone 用)
    scale: number;
    hp: number;
    speedChase: number;     // px/ms
    speedWander: number;
    contactDamage: number;
    expReward: number;
    goldReward: number;
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
        spriteKey: 'mob_giantrat', scale: 0.16, tint: 0x8090a0, // 灰藍金屬色暫代,等獨立 sprite
        hp: 35, speedChase: 0.14, speedWander: 0.05,
        contactDamage: 6, expReward: 6, goldReward: 4
    }
];

interface MobData {
    blueprint: MobBlueprint;
    hp: number;
    spawnPoint: SpawnPoint;
    lastContactMs: number;
    state: MobState;
    wanderTargetX: number;
    wanderTargetY: number;
    nextWanderAt: number;
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
    private sessionStartMs = 0;
    private lastPersistMs = 0;
    private pageHideHandler?: () => void;

    private static readonly PERSIST_THROTTLE_MS = 3000; // per Codex review

    private static readonly ATTACK_RANGE = 220;
    private static readonly ATTACK_INTERVAL_MS = 600;
    private static readonly ATTACK_DAMAGE = 25;
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
        this.mobs = [];

        this.cameras.main.setBackgroundColor('#2a2520');

        // 廢墟地面網格
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x4a5d3a, 0.3);
        for (let x = 0; x <= W; x += 90) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y <= H; y += 90) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();

        this.player = this.add.image(CX, CY, 'player_scavver').setScale(0.3);

        HitStopService.instance.attach(this);

        // 8 spawn points,各自固定 blueprint(廢土地圖各區生不同怪)
        const points: { x: number; y: number; blueprintIdx: number }[] = [
            { x: 200, y: 400, blueprintIdx: 0 },  // giantrat
            { x: 880, y: 400, blueprintIdx: 1 },  // centipede
            { x: 200, y: 1000, blueprintIdx: 0 }, // giantrat
            { x: 880, y: 1000, blueprintIdx: 2 }, // scrap drone
            { x: 200, y: 1500, blueprintIdx: 1 }, // centipede
            { x: 880, y: 1500, blueprintIdx: 0 }, // giantrat
            { x: 540, y: 250, blueprintIdx: 2 },  // scrap drone
            { x: 540, y: 1700, blueprintIdx: 1 }  // centipede
        ];
        this.spawnPoints = points.map(p => ({
            x: p.x, y: p.y, mob: null, nextSpawnAt: 0, blueprintIdx: p.blueprintIdx
        }));

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
        // 手機虛擬搖桿(bottom-left)— Dash 暫移除,等下次設計
        this.joystick = new VirtualJoystick(this, { x: 220, y: H - 280, radius: 130 });

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

        // HUD — 血條(畫面頂端,UI depth 高於 mob 預設 0)
        const barX = (W - Game.HP_BAR_WIDTH) / 2;
        const barY = 50;
        this.add.rectangle(barX, barY, Game.HP_BAR_WIDTH, Game.HP_BAR_HEIGHT, 0x2a1010)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x8b3a1f)
            .setDepth(1000);
        this.hpBarFill = this.add.rectangle(barX + 2, barY + 2, Game.HP_BAR_WIDTH - 4, Game.HP_BAR_HEIGHT - 4, 0xc23a1a)
            .setOrigin(0, 0)
            .setDepth(1001);
        this.hpText = this.add.text(W / 2, barY + Game.HP_BAR_HEIGHT / 2, `${this.playerHP} / ${Game.PLAYER_MAX_HP}`, {
            fontFamily: 'monospace', fontSize: 18, color: '#ffe0c0'
        }).setOrigin(0.5).setDepth(1002);

        // Exp bar(HP bar 下方)
        const expBarY = barY + Game.HP_BAR_HEIGHT + 10;
        const expBarH = 14;
        this.add.rectangle(barX, expBarY, Game.HP_BAR_WIDTH, expBarH, 0x2a2010)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x4a5d3a)
            .setDepth(1000);
        const expRatio = save.exp / SaveService.instance.expToNext();
        this.expBarFill = this.add.rectangle(barX + 2, expBarY + 2, (Game.HP_BAR_WIDTH - 4) * expRatio, expBarH - 4, 0xb08850)
            .setOrigin(0, 0)
            .setDepth(1001);

        // Level + Gold 在血條上方左右
        this.levelText = this.add.text(barX, barY - 8, `Lv ${save.level}`, {
            fontFamily: 'monospace', fontSize: 22, color: '#ff8830', fontStyle: 'bold'
        }).setOrigin(0, 1).setDepth(1002);
        this.goldText = this.add.text(barX + Game.HP_BAR_WIDTH, barY - 8, `💰 ${save.gold}`, {
            fontFamily: 'monospace', fontSize: 20, color: '#ffe0c0'
        }).setOrigin(1, 1).setDepth(1002);

        this.add.text(20, H - 60, '搖桿移動 / WASD / 方向鍵 — 自動攻擊', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
        });
    }

    update (time: number, delta: number)
    {
        if (this.isGameOver) return;
        this.handleMovement(delta);
        this.handleSpawn(time);
        this.handleMobAI(time, delta);
        this.handleMobContactDamage(time);
        if (this.isGameOver) return;
        this.handleAutoAttack(time, delta);
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
        if (mag < 0.01) return;
        const normDx = mag > 1 ? dx / mag : dx;
        const normDy = mag > 1 ? dy / mag : dy;
        const nx = this.player.x + normDx * Game.MOVE_SPEED * delta;
        const ny = this.player.y + normDy * Game.MOVE_SPEED * delta;
        this.player.x = Math.max(60, Math.min(W - 60, nx));
        this.player.y = Math.max(60, Math.min(H - 60, ny));
        if (Math.abs(normDx) > 0.1) this.player.setFlipX(normDx < 0);
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
                // wander:每 MOB_WANDER_INTERVAL_MS 隨機選新 target(spawn point 周圍 MOB_WANDER_RADIUS)
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
        // 死前 persist(等級/金幣/exp 進度不歸零)
        SaveService.instance.addPlaytimeSec(Math.floor((this.time.now - this.sessionStartMs) / 1000));
        SaveService.instance.save();
        this.player.setTint(0x8b3a1f).setTintMode(TINT_FILL);
        this.cameras.main.shake(400, 0.025);
        this.time.delayedCall(800, () => {
            if (this.scene.isActive()) this.scene.start('GameOver');
        });
    }

    private handleAutoAttack(time: number, delta: number)
    {
        if (this.isGameOver) return; // defensive local guard
        this.attackCooldownMs -= delta;
        if (this.attackCooldownMs > 0) return;

        let nearest: Phaser.GameObjects.Image | null = null;
        let nearestDist = Game.ATTACK_RANGE;
        for (const m of this.mobs) {
            if (!m.active) continue;
            const d = Math.hypot(this.player.x - m.x, this.player.y - m.y);
            if (d < nearestDist) { nearestDist = d; nearest = m; }
        }
        if (!nearest) return;

        this.attackCooldownMs = Game.ATTACK_INTERVAL_MS;
        const target = nearest;

        // Crit roll
        const isCrit = Math.random() < Game.CRIT_CHANCE;
        const dmg = Math.round(Game.ATTACK_DAMAGE * (isCrit ? Game.CRIT_MULT : 1));

        const data = target.getData('mob') as MobData;
        data.hp -= dmg;

        // 木棍揮砍視覺(廢土橙弧線從 player 朝 target 揮 60°)
        this.spawnSwingEffect(target.x, target.y, isCrit);

        // Hit flash(白色 fill mode)— 還原時記得保留 blueprint tint(scrap drone 灰藍)
        target.setTint(0xffffff).setTintMode(TINT_FILL);
        this.time.delayedCall(100, () => {
            if (!target.active) return;
            const tData = target.getData('mob') as MobData | undefined;
            if (tData?.blueprint.tint !== undefined) {
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

        // 死亡 + cycle 重生 + reward(per blueprint)
        if (data.hp <= 0) {
            const sp = data.spawnPoint;
            sp.mob = null;
            sp.nextSpawnAt = time + RESPAWN_CYCLE_MS;
            this.mobs = this.mobs.filter(m => m !== target);
            this.spawnGoldDrop(target.x, target.y, data.blueprint.goldReward);
            this.grantKillReward(target.x, target.y, data.blueprint);
            target.destroy();
        }
    }

    private grantKillReward(x: number, y: number, bp: MobBlueprint)
    {
        const save = SaveService.instance;
        save.addKill();
        save.addGold(bp.goldReward);
        this.goldText.setText(`💰 ${save.get().gold}`);

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
