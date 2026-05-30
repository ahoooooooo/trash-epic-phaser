import { Scene } from 'phaser';

// 手機虛擬搖桿 — bottom-left 半透明圓 + 廢土風 dpad 環飾
// 輸出 normalized {dx, dy} in [-1, 1] for Game movement
export class VirtualJoystick {
    private base!: Phaser.GameObjects.Arc;
    private stick!: Phaser.GameObjects.Arc;
    private stickHi!: Phaser.GameObjects.Arc;
    private deco!: Phaser.GameObjects.Graphics;
    private pointerId: number | null = null;
    private baseX: number;
    private baseY: number;
    private radius: number;

    private _dx = 0;
    private _dy = 0;

    constructor(
        private scene: Scene,
        opts: { x: number; y: number; radius?: number } = { x: 180, y: 1700 }
    ) {
        this.baseX = opts.x;
        this.baseY = opts.y;
        this.radius = opts.radius ?? 110;
        this.create();
        this.attach();
    }

    get dx(): number { return this._dx; }
    get dy(): number { return this._dy; }
    get active(): boolean { return this.pointerId !== null; }

    private create() {
        // UI depth = 1000+(高於 mob sprite 預設 0)+ scrollFactor 0(camera follow 不動)
        this.deco = this.scene.add.graphics().setDepth(999).setScrollFactor(0);
        this.base = this.scene.add.circle(this.baseX, this.baseY, this.radius, 0xff8830, 0.18)
            .setStrokeStyle(3, 0xff8830, 0.6)
            .setDepth(1000).setScrollFactor(0);
        this.stick = this.scene.add.circle(this.baseX, this.baseY, this.radius * 0.42, 0xff8830, 0.55)
            .setStrokeStyle(2, 0xffffff, 0.4)
            .setDepth(1001).setScrollFactor(0);
        // 搖桿頭高光(偏上,給 3D 旋鈕感)
        this.stickHi = this.scene.add.circle(this.baseX, this.baseY - this.radius * 0.12, this.radius * 0.16, 0xffe0c0, 0.45)
            .setDepth(1002).setScrollFactor(0);
        this.drawDeco();
    }

    // 環飾:外暗環 + 內圈 + 4 方向短刻度(dpad 感)。base 移動時重畫
    private drawDeco() {
        const g = this.deco;
        const x = this.baseX, y = this.baseY, r = this.radius;
        g.clear();
        g.lineStyle(2, 0x1a1612, 0.5);
        g.strokeCircle(x, y, r + 4);
        g.lineStyle(1, 0xff8830, 0.3);
        g.strokeCircle(x, y, r * 0.7);
        g.lineStyle(3, 0xffe0c0, 0.45);
        const t = r * 0.18;
        g.lineBetween(x, y - r + 6, x, y - r + 6 + t);   // N
        g.lineBetween(x, y + r - 6, x, y + r - 6 - t);   // S
        g.lineBetween(x - r + 6, y, x - r + 6 + t, y);   // W
        g.lineBetween(x + r - 6, y, x + r - 6 - t, y);   // E
    }

    private setStickPos(x: number, y: number) {
        this.stick.setPosition(x, y);
        this.stickHi.setPosition(x, y - this.radius * 0.12);
    }

    private attach() {
        const scene = this.scene;
        scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            // joystick 限定「下半屏 + 左半屏」(bottom-left 區),右半留給 Dash button
            if (this.pointerId !== null) return;
            if (p.y < scene.scale.height * 0.5) return;
            if (p.x > scene.scale.width * 0.5) return;
            if (p.y > scene.scale.height - 200) return; // 排除底部 tab bar 區,避免點左側 tab 誤觸搖桿
            this.pointerId = p.id;
            // joystick 是 UI(scrollFactor 0),要用 camera 內 screen coord 不是 world coord
            // Phaser 4:pointer.x/y 已是 viewport 座標(screen pixel)
            this.baseX = p.x;
            this.baseY = p.y;
            this.base.setPosition(this.baseX, this.baseY);
            this.setStickPos(this.baseX, this.baseY);
            this.drawDeco();
            this.base.setAlpha(0.35);
        });

        scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (this.pointerId !== p.id) return;
            this.updateStick(p.x, p.y);
        });

        const release = (p: Phaser.Input.Pointer) => {
            if (this.pointerId !== p.id) return;
            this.pointerId = null;
            this._dx = 0;
            this._dy = 0;
            this.setStickPos(this.baseX, this.baseY);
            this.base.setAlpha(0.18);
        };
        scene.input.on('pointerup', release);
        scene.input.on('pointerupoutside', release);
    }

    private updateStick(px: number, py: number) {
        const dx = px - this.baseX;
        const dy = py - this.baseY;
        const d = Math.hypot(dx, dy);
        const max = this.radius;
        if (d <= max) {
            this.setStickPos(this.baseX + dx, this.baseY + dy);
            this._dx = dx / max;
            this._dy = dy / max;
        } else {
            const k = max / d;
            this.setStickPos(this.baseX + dx * k, this.baseY + dy * k);
            this._dx = dx / d; // 已 normalized
            this._dy = dy / d;
        }
    }

    // per Codex review:Inventory 開啟前呼叫,避免 pause 期間 dx/dy 殘留
    cancel() {
        this.pointerId = null;
        this._dx = 0;
        this._dy = 0;
        this.setStickPos(this.baseX, this.baseY);
        this.base.setAlpha(0.18);
    }

    destroy() {
        this.deco.destroy();
        this.base.destroy();
        this.stick.destroy();
        this.stickHi.destroy();
    }
}
