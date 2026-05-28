import { Scene } from 'phaser';
import { getMap } from '../services/MapService';
import { SaveService } from '../services/SaveService';

const W = 1080;
const H = 1920;

// Phase 4c-1 楓谷風世界地圖 — 點小地圖開啟,看整個廢土世界 + 自己位置
// per user 2026-05-29「按小地圖會出現大地圖 整個世界的地圖」
// 純檢視(不直接傳送,保留楓谷走過去機制)

interface WorldNode {
    mapId: string;
    x: number;
    y: number;
}

// 6 地圖節點手排布局(廢土世界俯瞰)
const NODES: WorldNode[] = [
    { mapId: 'guild_hall', x: 540, y: 340 },
    { mapId: 'scrap_town', x: 540, y: 640 },
    { mapId: 'wasteland_outskirts', x: 280, y: 940 },
    { mapId: 'dry_well_road', x: 280, y: 1290 },
    { mapId: 'rust_alley', x: 680, y: 1120 },
    { mapId: 'core_gate', x: 840, y: 1440 }
];

// 連線(雙向 portal 關係)
const EDGES: [string, string][] = [
    ['guild_hall', 'scrap_town'],
    ['scrap_town', 'wasteland_outskirts'],
    ['scrap_town', 'rust_alley'],
    ['wasteland_outskirts', 'dry_well_road'],
    ['dry_well_road', 'rust_alley'],
    ['rust_alley', 'core_gate']
];

const TYPE_ICON: Record<string, string> = { town: '🏚', field: '⚔', boss: '☢' };

export class WorldMap extends Scene {
    constructor() { super('WorldMap'); }

    create() {
        if (this.scene.isActive('Game')) this.scene.pause('Game');
        this.add.rectangle(0, 0, W, H, 0x120c0a, 0.97).setOrigin(0, 0);

        // 標題
        this.add.text(W / 2, 110, '◤ 廢土全圖 ◢', {
            fontFamily: 'sans-serif', fontSize: 56, color: '#ff8830', fontStyle: 'bold',
            stroke: '#1a1612', strokeThickness: 6
        }).setOrigin(0.5);
        this.add.text(W / 2, 170, '— Wasteland World Map —', {
            fontFamily: 'monospace', fontSize: 22, color: '#6a5a4a'
        }).setOrigin(0.5);

        const curId = SaveService.instance.getCurrentMapId();
        const nodePos = (id: string) => NODES.find(n => n.mapId === id);

        // 先畫連線(在節點下層)
        const g = this.add.graphics();
        g.lineStyle(4, 0x8b6020, 0.7);
        for (const [a, b] of EDGES) {
            const pa = nodePos(a), pb = nodePos(b);
            if (!pa || !pb) continue;
            g.beginPath();
            g.moveTo(pa.x, pa.y);
            g.lineTo(pb.x, pb.y);
            g.strokePath();
        }

        // 畫節點
        for (const node of NODES) {
            const cfg = getMap(node.mapId);
            const isCurrent = node.mapId === curId;
            const icon = TYPE_ICON[cfg.mapType] ?? '◆';
            const nodeColor = cfg.mapType === 'town' ? 0x4a5d3a
                : cfg.mapType === 'boss' ? 0x8b3a1f : 0xa05a30;

            // 節點圓盤
            const r = isCurrent ? 56 : 46;
            this.add.circle(node.x, node.y, r + 4, 0x1a1612, 0.95)
                .setStrokeStyle(3, isCurrent ? 0xff8830 : 0x8b6020, isCurrent ? 1 : 0.8);
            this.add.circle(node.x, node.y, r, nodeColor, 0.85)
                .setStrokeStyle(2, 0xffe0c0, 0.5);
            this.add.text(node.x, node.y - 4, icon, {
                fontFamily: 'sans-serif', fontSize: isCurrent ? 40 : 32
            }).setOrigin(0.5);

            // 地圖名
            this.add.text(node.x, node.y + r + 18, cfg.nameZH, {
                fontFamily: 'sans-serif', fontSize: 22, color: isCurrent ? '#ffe0c0' : '#b08850',
                fontStyle: 'bold', stroke: '#1a1612', strokeThickness: 3
            }).setOrigin(0.5);

            // 等級範圍
            if (cfg.levelRange) {
                this.add.text(node.x, node.y + r + 44, `Lv ${cfg.levelRange[0]}-${cfg.levelRange[1]}`, {
                    fontFamily: 'monospace', fontSize: 16, color: '#6a5a4a'
                }).setOrigin(0.5);
            }

            // 「你在這」標記
            if (isCurrent) {
                const tag = this.add.text(node.x, node.y - r - 26, '◉ 你在這', {
                    fontFamily: 'sans-serif', fontSize: 22, color: '#ff8830', fontStyle: 'bold',
                    stroke: '#1a1612', strokeThickness: 4
                }).setOrigin(0.5);
                this.tweens.add({ targets: tag, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
            }
        }

        // 圖例
        this.add.text(W / 2, H - 230, '🏚 村莊(商販)   ⚔ 獵場(刷怪)   ☢ Boss 區', {
            fontFamily: 'sans-serif', fontSize: 22, color: '#a05a30'
        }).setOrigin(0.5);
        this.add.text(W / 2, H - 195, '走傳送門前往各地 · 村莊買藥水', {
            fontFamily: 'monospace', fontSize: 18, color: '#6a5a4a'
        }).setOrigin(0.5);

        // 返回 button(rectangle hit area)
        const btnY = H - 110;
        const back = this.add.rectangle(W / 2, btnY, 360, 90, 0xff8830)
            .setStrokeStyle(4, 0x1a1612).setInteractive({ useHandCursor: true });
        this.add.text(W / 2, btnY, '◀ 返回', {
            fontFamily: 'sans-serif', fontSize: 44, color: '#1a1612', fontStyle: 'bold'
        }).setOrigin(0.5);
        back.on('pointerdown', () => this.close());
        this.input.keyboard?.once('keydown-ESC', () => this.close());
        this.input.keyboard?.once('keydown-M', () => this.close());
    }

    private close() {
        this.scene.resume('Game');
        this.scene.stop();
    }
}
