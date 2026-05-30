import { Scene } from 'phaser';

// 手機虛擬搖桿 — bottom-left 半透明圓
// 輸出 normalized {dx, dy} in [-1, 1] for Game movement
export class VirtualJoystick {
    private base!: Phaser.GameObjects.Arc;
    private stick!: Phaser.GameObjects.Arc;
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
        this.base = this.scene.add.circle(this.baseX, this.baseY, this.radius, 0xff8830, 0.18)
            .setStrokeStyle(3, 0xff8830, 0.6)
            .setDepth(1000).setScrollFactor(0);
        this.stick = this.scene.add.circle(this.baseX, this.baseY, this.radius * 0.42, 0xff8830, 0.55)
            .setStrokeStyle(2, 0xffffff, 0.4)
            .setDepth(1001).setScrollFactor(0);
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
            this.stick.setPosition(this.baseX, this.baseY);
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
            this.stick.setPosition(this.baseX, this.baseY);
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
            this.stick.setPosition(this.baseX + dx, this.baseY + dy);
            this._dx = dx / max;
            this._dy = dy / max;
        } else {
            const k = max / d;
            this.stick.setPosition(this.baseX + dx * k, this.baseY + dy * k);
            this._dx = dx / d; // 已 normalized
            this._dy = dy / d;
        }
    }

    // per Codex review:Inventory 開啟前呼叫,避免 pause 期間 dx/dy 殘留
    cancel() {
        this.pointerId = null;
        this._dx = 0;
        this._dy = 0;
        this.stick.setPosition(this.baseX, this.baseY);
        this.base.setAlpha(0.18);
    }

    destroy() {
        this.base.destroy();
        this.stick.destroy();
    }
}
