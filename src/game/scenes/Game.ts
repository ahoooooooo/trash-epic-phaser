import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';

const W = 1080;
const H = 1920;
const CX = W / 2;
const CY = H / 2;

// 楓谷 cycle spawn(per project-v2-gameplay-lock §2)
// max kill/hour = 3600 / 7.56 × spawn_point_count
const RESPAWN_CYCLE_MS = 7560;

interface SpawnPoint {
    x: number;
    y: number;
    mob: Phaser.GameObjects.Image | null;
    nextSpawnAt: number;
}

interface MobData {
    hp: number;
    spawnPoint: SpawnPoint;
    lastContactMs: number; // throttle 對 player 接觸傷害
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
    private attackCooldownMs = 0;
    private hpBarFill!: Phaser.GameObjects.Rectangle;
    private hpText!: Phaser.GameObjects.Text;

    private static readonly ATTACK_RANGE = 220;
    private static readonly ATTACK_INTERVAL_MS = 600;
    private static readonly ATTACK_DAMAGE = 25;
    private static readonly CRIT_CHANCE = 0.15;
    private static readonly CRIT_MULT = 1.5;
    private static readonly MOVE_SPEED = 0.4;        // 玩家 px/ms
    private static readonly MOB_SPEED = 0.08;        // 怪 px/ms(玩家 5×,可拉開)
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

        this.add.text(20, H - 60, 'WASD / 方向鍵移動,自動攻擊', {
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
        // per Codex review:contact damage 可能 trigger GameOver,這 frame 不能再 attack(會 HitStop/shake 死後畫面)
        if (this.isGameOver) return;
        this.handleAutoAttack(time, delta);
    }

    private handleMovement(delta: number)
    {
        let dx = 0, dy = 0;
        if (this.cursors.left.isDown || this.wasd.A.isDown)  dx -= 1;
        if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
        if (this.cursors.up.isDown    || this.wasd.W.isDown) dy -= 1;
        if (this.cursors.down.isDown  || this.wasd.S.isDown) dy += 1;
        if (dx === 0 && dy === 0) return;
        const norm = Math.hypot(dx, dy);
        this.player.x = Phaser.Math.Clamp(this.player.x + (dx / norm) * Game.MOVE_SPEED * delta, 60, W - 60);
        this.player.y = Phaser.Math.Clamp(this.player.y + (dy / norm) * Game.MOVE_SPEED * delta, 60, H - 60);
        this.player.setFlipX(dx < 0);
    }

    private handleSpawn(time: number)
    {
        for (const sp of this.spawnPoints) {
            if (sp.mob === null && time >= sp.nextSpawnAt) {
                const mob = this.add.image(sp.x, sp.y, 'mob_giantrat').setScale(0.18);
                const data: MobData = { hp: 50, spawnPoint: sp, lastContactMs: -Infinity };
                mob.setData('mob', data);
                sp.mob = mob;
                this.mobs.push(mob);
            }
        }
    }

    private handleMobAI(_time: number, delta: number)
    {
        for (const m of this.mobs) {
            if (!m.active) continue;
            const dx = this.player.x - m.x;
            const dy = this.player.y - m.y;
            const d = Math.hypot(dx, dy);
            if (d < 1) continue;
            m.x += (dx / d) * Game.MOB_SPEED * delta;
            m.y += (dy / d) * Game.MOB_SPEED * delta;
            m.setFlipX(dx < 0);
        }
    }

    private handleMobContactDamage(time: number)
    {
        if (time < this.playerInvulnUntilMs) return;
        for (const m of this.mobs) {
            if (!m.active) continue;
            const data = m.getData('mob') as MobData;
            if (time - data.lastContactMs < Game.MOB_CONTACT_COOLDOWN_MS) continue;
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
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
        this.player.setTint(0xff4040).setTintFill();
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
        this.player.setTint(0x8b3a1f).setTintFill();
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
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
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

        // Hit flash(白色 fill mode)
        target.setTint(0xffffff).setTintFill();
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
