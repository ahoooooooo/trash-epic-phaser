import { Scene } from 'phaser';

const W = 1080;
const H = 1920;
const CX = 540;
const CY = 960;

export class GameOver extends Scene
{
    constructor () { super('GameOver'); }

    create ()
    {
        this.cameras.main.setBackgroundColor('#120c0a');

        // ── 暗紅死亡氛圍:中央暗紅漫染 + 四邊暗角 vignette ──
        this.add.rectangle(CX, CY, W, H, 0x3a0f08, 0.35);
        // 暗角
        this.add.rectangle(CX, 0, W, 360, 0x000000, 0.55).setOrigin(0.5, 0);
        this.add.rectangle(CX, H, W, 420, 0x000000, 0.6).setOrigin(0.5, 1);
        this.add.rectangle(0, CY, 160, H, 0x000000, 0.45).setOrigin(0, 0.5);
        this.add.rectangle(W, CY, 160, H, 0x000000, 0.45).setOrigin(1, 0.5);

        // 鏽紅分隔線(標題上下)
        this.add.rectangle(CX, CY - 230, 520, 3, 0x8b3a1f, 0.7);
        this.add.rectangle(CX, CY - 10, 520, 3, 0x8b3a1f, 0.5);

        // ── 大字「你陣亡了」鏽紅 ──
        const title = this.add.text(CX, CY - 130, '你 陣 亡 了', {
            fontFamily: 'sans-serif', fontSize: 110, color: '#8b3a1f', fontStyle: 'bold',
            stroke: '#0f0c0a', strokeThickness: 12
        }).setOrigin(0.5);
        // 緩慢搏動,死亡沉重感
        this.tweens.add({
            targets: title, alpha: 0.78, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // 副標
        this.add.text(CX, CY - 50, '廢墟吞噬了你的一切……', {
            fontFamily: 'sans-serif', fontSize: 34, color: '#a05a30', fontStyle: 'bold',
            stroke: '#0f0c0a', strokeThickness: 4
        }).setOrigin(0.5);

        // ── 重生 CTA 橙底按鈕 ──
        const btn = this.add.container(CX, CY + 180);
        const btnBg = this.add.rectangle(0, 0, 420, 110, 0xff8830, 0.96)
            .setStrokeStyle(4, 0x0f0c0a, 1);
        const btnInner = this.add.rectangle(0, 0, 406, 96, 0x000000, 0)
            .setStrokeStyle(2, 0xffe0c0, 0.4);
        const btnTxt = this.add.text(0, 0, '▶ 重新踏入廢土', {
            fontFamily: 'sans-serif', fontSize: 46, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        btn.add([btnBg, btnInner, btnTxt]);
        // CTA 召喚 pulse
        this.tweens.add({
            targets: btn, scaleX: 1.04, scaleY: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        this.add.text(CX, CY + 300, '點按鈕或螢幕任何地方回主選單', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
        }).setOrigin(0.5);

        // 整個 scene 接 pointer + keyboard,3 重保險(per Codex review:用 once 避免 listener 累積)
        let restarted = false;
        const restart = () => {
            if (restarted) return;
            restarted = true;
            this.scene.start('MainMenu');
        };
        // 按鈕本身可點(rectangle hit area,per prod-build 禁忌)
        btn.setSize(420, 110);
        btn.setInteractive({ useHandCursor: true });
        btn.once('pointerdown', restart);
        this.input.once('pointerdown', restart);
        this.input.once('pointerup', restart);
        this.input.keyboard?.once('keydown', restart);
    }
}
