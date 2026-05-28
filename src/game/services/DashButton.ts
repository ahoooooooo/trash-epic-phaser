import { Scene } from 'phaser';

// 楓谷風 Dash 閃招按鈕 — bottom-right 圓鈕
// 按下 → 觸發 Game 的 dash(0.4s 無敵 + 位移)
// CD 期間 radial mask 顯示剩餘
export class DashButton {
    private base!: Phaser.GameObjects.Arc;
    private icon!: Phaser.GameObjects.Text;
    private cdOverlay!: Phaser.GameObjects.Graphics;
    private label!: Phaser.GameObjects.Text;
    private cx: number;
    private cy: number;
    private radius: number;
    private cdEndsAt = 0;
    private cdMs: number;

    constructor(
        private scene: Scene,
        opts: { x: number; y: number; radius?: number; cdMs?: number },
        private onDash: () => void
    ) {
        this.cx = opts.x;
        this.cy = opts.y;
        this.radius = opts.radius ?? 90;
        this.cdMs = opts.cdMs ?? 2500;
        this.create();
        this.attach();
    }

    private create() {
        // base 圓(廢土暖橙)
        this.base = this.scene.add.circle(this.cx, this.cy, this.radius, 0xff8830, 0.55)
            .setStrokeStyle(3, 0xffe0c0, 0.8);
        // icon
        this.icon = this.scene.add.text(this.cx, this.cy, '⟪', {
            fontFamily: 'sans-serif', fontSize: this.radius * 1.1, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.label = this.scene.add.text(this.cx, this.cy + this.radius * 0.62, '閃', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        // CD overlay(deep mask,radial fill 顯示 cooldown)
        this.cdOverlay = this.scene.add.graphics();
    }

    private attach() {
        // hit area = default(circle bounds = square,行動裝置按鈕略寬 OK)
        // per Codex lesson:不用 Phaser.Geom.Circle(production build 無 global Phaser)
        this.base.setInteractive({ useHandCursor: true });
        const press = () => {
            const now = this.scene.time.now;
            if (now < this.cdEndsAt) return;
            this.cdEndsAt = now + this.cdMs;
            this.onDash();
        };
        this.base.on('pointerdown', press);
    }

    update() {
        const now = this.scene.time.now;
        const remaining = Math.max(0, this.cdEndsAt - now);
        const ratio = this.cdMs > 0 ? remaining / this.cdMs : 0;
        this.cdOverlay.clear();
        if (ratio > 0) {
            // 灰 mask + radial arc(順時針從上 12 點)
            this.cdOverlay.fillStyle(0x000000, 0.55);
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + Math.PI * 2 * ratio;
            this.cdOverlay.beginPath();
            this.cdOverlay.moveTo(this.cx, this.cy);
            this.cdOverlay.arc(this.cx, this.cy, this.radius, startAngle, endAngle);
            this.cdOverlay.closePath();
            this.cdOverlay.fillPath();
            this.icon.setAlpha(0.4);
            this.label.setAlpha(0.4);
        } else {
            this.icon.setAlpha(1);
            this.label.setAlpha(1);
        }
    }

    get onCooldown(): boolean { return this.scene.time.now < this.cdEndsAt; }
}
