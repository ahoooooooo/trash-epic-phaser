import { Scene } from 'phaser';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;

type Highlight =
    | { kind: 'none' }
    | { kind: 'circle'; x: number; y: number; r: number }
    | { kind: 'rect'; x: number; y: number; w: number; h: number };

interface Step {
    title: string;
    body: string;
    highlight: Highlight;
}

// Phase 4c-7 新手引導 FTUE — 全新存檔首次進 Game 時跑一次,看完寫旗標不再打擾
// (QA 高優先:新手引導缺,無階段教學/視覺指示)
export class Coachmark extends Scene {
    private steps: Step[] = [
        {
            title: '歡迎來到廢土',
            body: '你是拾荒少年。走近敵人會\n【自動攻擊】,專心生存、變強。',
            highlight: { kind: 'circle', x: W / 2, y: H * 0.42, r: 200 }
        },
        {
            title: '移動',
            body: '拖曳左下角的【虛擬搖桿】移動\n(電腦可用 WASD)。',
            highlight: { kind: 'circle', x: 220, y: H - 280, r: 175 }
        },
        {
            title: '介面分頁',
            body: '底部五個分頁:\n倉庫 · 裝備 · 夥伴 · 商店 · 天賦。',
            highlight: { kind: 'rect', x: W / 2, y: H - 102, w: W - 16, h: 184 }
        },
        {
            title: '變強之路',
            body: '升級自動長血魔。打開【天賦樹】\n分配天賦點,選你的流派。\n祝你在廢土活得久!',
            highlight: { kind: 'none' }
        }
    ];
    private idx = 0;
    private layer?: Phaser.GameObjects.Container;

    constructor() { super('Coachmark'); }

    create() {
        this.idx = 0;  // scene instance 復用,每次重開必歸零(否則同 session 砍角重練讀 steps[4] 會炸)
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.renderStep();
    }

    private renderStep() {
        if (this.layer) {
            this.tweens.killTweensOf(this.layer.list);  // 換步前殺脈動 tween,避免 destroyed target 還被更新
            this.layer.destroy();
        }
        const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(5000);
        this.layer = layer;
        const step = this.steps[this.idx];
        const last = this.idx === this.steps.length - 1;

        // 變暗遮罩(點任意處 → 下一步)
        const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0, 0).setInteractive();
        dim.on('pointerdown', () => this.next());
        layer.add(dim);

        // 高亮目標(脈動)
        if (step.highlight.kind === 'circle') {
            const c = this.add.circle(step.highlight.x, step.highlight.y, step.highlight.r)
                .setStrokeStyle(6, 0xff8830, 1);
            layer.add(c);
            this.tweens.add({ targets: c, scaleX: 1.08, scaleY: 1.08, duration: 620, yoyo: true, repeat: -1 });
        } else if (step.highlight.kind === 'rect') {
            const r = this.add.rectangle(step.highlight.x, step.highlight.y, step.highlight.w, step.highlight.h)
                .setStrokeStyle(6, 0xff8830, 1);
            layer.add(r);
            this.tweens.add({ targets: r, alpha: 0.4, duration: 620, yoyo: true, repeat: -1 });
        }

        // 文字面板(置上方,不擋下方高亮)
        const panelY = H * 0.30;
        layer.add(this.add.rectangle(W / 2, panelY, W - 140, 360, 0x241c16, 0.98)
            .setStrokeStyle(4, 0xff8830, 0.9));
        layer.add(this.add.text(W / 2, panelY - 120, `${this.idx + 1} / ${this.steps.length}`, {
            fontFamily: 'monospace', fontSize: 28, color: '#a05a30', fontStyle: 'bold'
        }).setOrigin(0.5));
        layer.add(this.add.text(W / 2, panelY - 56, step.title, {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 5
        }).setOrigin(0.5));
        layer.add(this.add.text(W / 2, panelY + 60, step.body, {
            fontFamily: 'sans-serif', fontSize: 36, color: '#ffe0c0', align: 'center', lineSpacing: 14
        }).setOrigin(0.5));

        // 按鈕
        const btnY = panelY + 250;
        const btn = this.add.rectangle(W / 2, btnY, 420, 96, 0xff8830, 1).setStrokeStyle(4, 0x1a1612);
        layer.add(btn);
        layer.add(this.add.text(W / 2, btnY, last ? '▶ 開始冒險' : '下一步 ▶', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5));
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => { this.tweens.add({ targets: btn, scaleX: 0.94, scaleY: 0.94, duration: 80, yoyo: true }); this.next(); });

        // 跳過
        if (!last) {
            const skip = this.add.text(W - 40, 60, '跳過 ✕', {
                fontFamily: 'sans-serif', fontSize: 32, color: '#a89878'
            }).setOrigin(1, 0.5);
            skip.setInteractive({ useHandCursor: true });
            skip.on('pointerdown', () => this.finish());
            layer.add(skip);
        }
    }

    private next() {
        this.idx++;
        if (this.idx >= this.steps.length) { this.finish(); return; }
        this.renderStep();
    }

    private finish() {
        SaveService.instance.markTutorialDone();
        SaveService.instance.save();
        this.scene.resume('Game');
        this.scene.stop();
    }
}
