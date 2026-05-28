import { Scene } from 'phaser';
import { HitStopService } from '../services/HitStopService';

const W = 1080;
const H = 1920;
const CX = W / 2;
const CY = H / 2;

// 楓谷 cycle spawn(per project-v2-gameplay-lock §2 + reference-character-anim-mob-spawn-patterns)
// max kill/hour = 3600 / 7.56 × spawn_point_count
const RESPAWN_CYCLE_MS = 7560;

interface SpawnPoint {
    x: number;
    y: number;
    mob: Phaser.GameObjects.Image | null;
    nextSpawnAt: number;
}

export class Game extends Scene
{
    private player!: Phaser.GameObjects.Image;
    private spawnPoints: SpawnPoint[] = [];
    private mobs: Phaser.GameObjects.Image[] = [];
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
    private attackCooldownMs = 0;

    private static readonly ATTACK_RANGE = 220;
    private static readonly ATTACK_INTERVAL_MS = 600;
    private static readonly ATTACK_DAMAGE = 25;
    private static readonly MOVE_SPEED = 0.4; // px per ms

    constructor () { super('Game'); }

    create ()
    {
        this.cameras.main.setBackgroundColor('#2a2520'); // 廢土地面深褐

        // 廢墟地面網格
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x4a5d3a, 0.3);
        for (let x = 0; x <= W; x += 90) { grid.moveTo(x, 0); grid.lineTo(x, H); }
        for (let y = 0; y <= H; y += 90) { grid.moveTo(0, y); grid.lineTo(W, y); }
        grid.strokePath();

        // Player 中央
        this.player = this.add.image(CX, CY, 'player_scavver').setScale(0.3);

        HitStopService.instance.attach(this);

        // 8 個固定 spawn point(per memory 楓谷刷怪)
        const points = [
            { x: 200, y: 400 }, { x: 880, y: 400 },
            { x: 200, y: 1000 }, { x: 880, y: 1000 },
            { x: 200, y: 1500 }, { x: 880, y: 1500 },
            { x: 540, y: 250 }, { x: 540, y: 1700 }
        ];
        this.spawnPoints = points.map(p => ({ x: p.x, y: p.y, mob: null, nextSpawnAt: 0 }));

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;

        this.add.text(20, 20, '破爛史詩 — Phase 4a MVP  |  自動攻擊', {
            fontFamily: 'monospace', fontSize: 24, color: '#b08850'
        });
        this.add.text(20, H - 60, 'WASD / 方向鍵移動', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
        });
    }

    update (time: number, delta: number)
    {
        this.handleMovement(delta);
        this.handleSpawn(time);
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
                mob.setData('hp', 50);
                mob.setData('spawnPoint', sp);
                sp.mob = mob;
                this.mobs.push(mob);
            }
        }
    }

    private handleAutoAttack(time: number, delta: number)
    {
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
        const hp = (target.getData('hp') as number) - Game.ATTACK_DAMAGE;
        target.setData('hp', hp);

        // Hit flash
        // per Codex review:Phaser 4 預設 multiply tint mode 看不見白閃,要 FILL
        target.setTint(0xffffff).setTintFill();
        this.time.delayedCall(100, () => target.active && target.clearTint());

        // Damage popup
        const dmgText = this.add.text(target.x, target.y - 50, `${Game.ATTACK_DAMAGE}`, {
            fontFamily: 'sans-serif', fontSize: 32, color: '#ff8830',
            stroke: '#1a1612', strokeThickness: 4
        }).setOrigin(0.5);
        this.tweens.add({
            targets: dmgText,
            y: dmgText.y - 80,
            alpha: 0,
            duration: 600,
            onComplete: () => dmgText.destroy()
        });

        // HitStop 楓谷凍幀
        HitStopService.instance.trigger(60, 0.05);

        // 死亡 + cycle 重生
        if (hp <= 0) {
            const sp = target.getData('spawnPoint') as SpawnPoint;
            sp.mob = null;
            sp.nextSpawnAt = time + RESPAWN_CYCLE_MS;
            this.mobs = this.mobs.filter(m => m !== target);
            target.destroy();
        }
    }
}
