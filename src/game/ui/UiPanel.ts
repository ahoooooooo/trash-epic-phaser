import { Scene } from 'phaser';

// 共用 overlay 場景 header — 鏽帶 + 標題 + 兩端鉚釘 + 底部橙 accent
// 對齊 in-game HUD 鏽蝕質感;各 overlay 場景(Shop/Gacha/Talent…)沿用
export function drawSceneHeader(scene: Scene, title: string, width: number, opts?: { y?: number; height?: number }): void {
    const y = opts?.y ?? 0;
    const h = opts?.height ?? 96;
    // header 鏽帶(深底 + 鏽橙邊)
    scene.add.rectangle(0, y, width, h, 0x140f0c, 0.94)
        .setOrigin(0, 0).setStrokeStyle(3, 0x8b6020, 0.85).setDepth(50);
    // 上沿亮帶(金屬反光)
    scene.add.rectangle(0, y + 3, width, h * 0.22, 0x3a342c, 0.4).setOrigin(0, 0).setDepth(51);
    // 底部橙 accent 線
    scene.add.rectangle(0, y + h, width, 3, 0xff8830, 0.7).setOrigin(0, 0).setDepth(51);
    // 標題
    scene.add.text(width / 2, y + h / 2, title, {
        fontFamily: 'sans-serif', fontSize: 50, color: '#ff8830', fontStyle: 'bold',
        stroke: '#1a1612', strokeThickness: 6
    }).setOrigin(0.5).setDepth(52);
    // 兩端鉚釘
    const rivet = (rx: number) =>
        scene.add.circle(rx, y + h / 2, 5, 0xa05a30).setStrokeStyle(1, 0x1a1612).setDepth(52);
    rivet(30); rivet(width - 30);
}
