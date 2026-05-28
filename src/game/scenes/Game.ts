import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';
import { VirtualJoystick } from '../services/VirtualJoystick';
import { DashButton } from '../services/DashButton';

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
}

type MobState = 'wander' | 'chase';

interface MobData {
    hp: number;
    spawnPoint: SpawnPoint;
    lastContactMs: number;
    state: MobState;
    wanderTargetX: number;
    wanderTargetY: number;
    nextWanderAt: number; // ms 換 wander target 的下次 timestamp
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
    private dashButton!: DashButton;
    private dashUntilMs = 0;
    private lastDirX = 0;
    private lastDirY = -1; // 預設朝上(初次按 Dash 沒 input 時的 fallback)
    private attackCooldownMs = 0;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private hpText!: Phaser.GameObjects.Text;

    private static readonly ATTACK_RANGE = 220;
    private static readonly ATTACK_INTERVAL_MS = 600;
    private static readonly ATTACK_DAMAGE = 25;
    private static readonly CRIT_CHANCE = 0.15;
    private static readonly CRIT_MULT = 1.5;
    private static readonly MOVE_SPEED = 0.4;        // 玩家 px/ms
    private static readonly DASH_DURATION_MS = 400;  // 楓谷風 dash 0.4s
    private static readonly DASH_SPEED_MULT = 3;     // dash 速度 ×3(280px 位移約等於楓谷一段)
    private static readonly DASH_CD_MS = 2500;       // dash CD
    private static readonly MOB_SPEED_CHASE = 0.10;  // 怪追擊 px/ms
    private static readonly MOB_SPEED_WANDER = 0.04; // 怪漫遊 px/ms(慢)
    private static readonly MOB_AGGRO_RANGE = 350;   // < 進入 chase
    private static readonly MOB_LOST_RANGE = 500;    // > 退出 chase(hysteresis 防抖)
    private static readonly MOB_WANDER_RADIUS = 200; // wander target 範圍(spawn point 周圍)
    private static readonly MOB_WANDER_INTERVAL_MS = 2500; // 換 wander target 週期
    private static readonly MOB_CONTACT_RANGE = 65;  // 圓形碰撞半徑(player 中心 vs mob 中心)
    private static readonly MOB_CONTACT_DAMAGE = 8;
    private static readonly MOB_CONTACT_COOLDOWN_MS = 800; // 怪 0.8s 才能再打一次
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

        const points = [
            { x: 200, y: 400 }, { x: 880, y: 400 },
            { x: 200, y: 1000 }, { x: 880, y: 1000 },
            { x: 200, y: 1500 }, { x: 880, y: 1500 },
            { x: 540, y: 250 }, { x: 540, y: 1700 }
        ];
        this.spawnPoints = points.map(p => ({ x: p.x, y: p.y, mob: null, nextSpawnAt: 0 }));

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
        // 手機虛擬搖桿(bottom-left)
        this.joystick = new VirtualJoystick(this, { x: 220, y: H - 280, radius: 130 });
        // Dash 閃招按鈕(bottom-right)
        this.dashButton = new DashButton(
            this,
            { x: W - 220, y: H - 280, radius: 110, cdMs: Game.DASH_CD_MS },
            () => this.triggerDash()
        );

        // HUD — 血條(畫面頂端)
        const barX = (W - Game.HP_BAR_WIDTH) / 2;
        const barY = 50;
        this.add.rectangle(barX, barY, Game.HP_BAR_WIDTH, Game.HP_BAR_HEIGHT, 0x2a1010)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x8b3a1f);
        this.hpBarFill = this.add.rectangle(barX + 2, barY + 2, Game.HP_BAR_WIDTH - 4, Game.HP_BAR_HEIGHT - 4, 0xc23a1a)
            .setOrigin(0, 0);
        this.hpText = this.add.text(W / 2, barY + Game.HP_BAR_HEIGHT / 2, `${this.playerHP} / ${Game.PLAYER_MAX_HP}`, {
            fontFamily: 'monospace', fontSize: 18, color: '#ffe0c0'
        }).setOrigin(0.5);

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
        this.dashButton.update();
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

    private triggerDash()
    {
        const now = this.time.now;
        if (now < this.dashUntilMs) return; // 正在 dash
        this.dashUntilMs = now + Game.DASH_DURATION_MS;
        // i-frame 跟 dash 同步(per 楓谷 Hayato/Phantom dash 0.4s 無敵)
        this.playerInvulnUntilMs = Math.max(this.playerInvulnUntilMs, this.dashUntilMs);
        // Ghost trail(每 50ms 留一個 fading ghost)
        const step = 50;
        const steps = Math.floor(Game.DASH_DURATION_MS / step);
        for (let i = 0; i < steps; i++) {
            this.time.delayedCall(i * step, () => {
                if (this.isGameOver || !this.player.active) return;
                const ghost = this.add.image(this.player.x, this.player.y, 'player_scavver')
                    .setScale(0.3).setAlpha(0.5);
                ghost.setTint(0xff8830).setTintMode(TINT_FILL);
                if (this.player.flipX) ghost.setFlipX(true);
                this.tweens.add({
                    targets: ghost, alpha: 0, duration: 300,
                    onComplete: () => ghost.destroy()
                });
            });
        }
    }

    private handleMovement(delta: number)
    {
        const isDashing = this.time.now < this.dashUntilMs;
        let dx = 0, dy = 0;
        // 優先吃搖桿(手機),沒搖桿才吃鍵盤(電腦)
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
        let normDx: number, normDy: number;
        if (mag < 0.01) {
            // 沒輸入時,dash 期間照樣按最後方向衝
            if (!isDashing) return;
            normDx = this.lastDirX;
            normDy = this.lastDirY;
        } else {
            normDx = mag > 1 ? dx / mag : dx;
            normDy = mag > 1 ? dy / mag : dy;
            // 記住方向給下次 dash 用
            const dirMag = Math.hypot(normDx, normDy);
            if (dirMag > 0.05) {
                this.lastDirX = normDx / dirMag;
                this.lastDirY = normDy / dirMag;
            }
        }
        const speed = Game.MOVE_SPEED * (isDashing ? Game.DASH_SPEED_MULT : 1);
        const nx = this.player.x + normDx * speed * delta;
        const ny = this.player.y + normDy * speed * delta;
        this.player.x = Math.max(60, Math.min(W - 60, nx));
        this.player.y = Math.max(60, Math.min(H - 60, ny));
        if (Math.abs(normDx) > 0.1) this.player.setFlipX(normDx < 0);
    }

    private handleSpawn(time: number)
    {
        for (const sp of this.spawnPoints) {
            if (sp.mob === null && time >= sp.nextSpawnAt) {
                const mob = this.add.image(sp.x, sp.y, 'mob_giantrat').setScale(0.18);
                const data: MobData = {
                    hp: 50,
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
                m.x += (pdx / pd) * Game.MOB_SPEED_CHASE * delta;
                m.y += (pdy / pd) * Game.MOB_SPEED_CHASE * delta;
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
                m.x += (wdx / wd) * Game.MOB_SPEED_WANDER * delta;
                m.y += (wdy / wd) * Game.MOB_SPEED_WANDER * delta;
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
                this.takeDamage(Game.MOB_CONTACT_DAMAGE, time);
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
        if (this.isGameOver) return; // idempotent
        this.isGameOver = true;
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

        // Hit flash(白色 fill mode)
        target.setTint(0xffffff).setTintMode(TINT_FILL);
        this.time.delayedCall(100, () => target.active && target.clearTint());

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

        // 死亡 + cycle 重生
        if (data.hp <= 0) {
            const sp = data.spawnPoint;
            sp.mob = null;
            sp.nextSpawnAt = time + RESPAWN_CYCLE_MS;
            this.mobs = this.mobs.filter(m => m !== target);
            target.destroy();
        }
    }
}
