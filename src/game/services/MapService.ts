// 地圖系統(Phase 4b-3)— 多地圖 + 傳送門 + 公會地圖
// Phase 4b 從 1 張固定戰鬥場 → 多張地圖切換

export type NpcType = 'clerk' | 'shopkeeper';

export interface NpcSpec {
    type: NpcType;
    x: number;
    y: number;
    spriteKey: string;
    scale: number;
}

export interface PortalSpec {
    x: number;
    y: number;
    targetMapId: string;
    targetX: number;  // 進入新地圖後玩家出生點
    targetY: number;
    label: string;    // 「← 公會大廳」
}

export interface SpawnPointSpec {
    x: number;
    y: number;
    blueprintIdx: number;
}

export interface MapConfig {
    id: string;
    nameZH: string;
    width: number;
    height: number;
    bgColor: string;
    spawnPoints: SpawnPointSpec[];
    npcs: NpcSpec[];
    portals: PortalSpec[];
    bossEnabled: boolean;
    playerStartX: number; // 預設玩家進地圖位置(若沒指定 targetX/Y)
    playerStartY: number;
}

const MAPS: Record<string, MapConfig> = {
    wasteland_outskirts: {
        id: 'wasteland_outskirts',
        nameZH: '廢墟外圍',
        width: 2400, height: 3200,
        bgColor: '#2a2520',
        spawnPoints: [
            { x: 400, y: 600, blueprintIdx: 0 },   { x: 1200, y: 700, blueprintIdx: 1 },
            { x: 1800, y: 600, blueprintIdx: 0 },  { x: 2100, y: 800, blueprintIdx: 2 },
            { x: 300, y: 1400, blueprintIdx: 1 },  { x: 800, y: 1500, blueprintIdx: 0 },
            { x: 1700, y: 1400, blueprintIdx: 2 }, { x: 2200, y: 1600, blueprintIdx: 0 },
            { x: 400, y: 2000, blueprintIdx: 0 },  { x: 1100, y: 2100, blueprintIdx: 2 },
            { x: 1800, y: 2000, blueprintIdx: 1 }, { x: 2200, y: 2200, blueprintIdx: 1 },
            { x: 500, y: 2700, blueprintIdx: 2 },  { x: 1200, y: 2800, blueprintIdx: 1 },
            { x: 1700, y: 2700, blueprintIdx: 0 }, { x: 2100, y: 2900, blueprintIdx: 1 }
        ],
        npcs: [],  // NPC 移到公會地圖
        portals: [
            { x: 1200, y: 200, targetMapId: 'guild_hall', targetX: 600, targetY: 1100, label: '← 公會大廳' }
        ],
        bossEnabled: true,
        playerStartX: 1200, playerStartY: 1600
    },
    guild_hall: {
        id: 'guild_hall',
        nameZH: '廢墟同盟公會大廳',
        width: 1200, height: 1400,
        bgColor: '#1a1612',
        spawnPoints: [],
        npcs: [
            { type: 'clerk', x: 300, y: 600, spriteKey: 'npc_clerk', scale: 0.4 }
        ],
        portals: [
            { x: 600, y: 1300, targetMapId: 'wasteland_outskirts', targetX: 1200, targetY: 300, label: '廢墟外圍 →' }
        ],
        bossEnabled: false,
        playerStartX: 600, playerStartY: 1100
    }
};

export function getMap(id: string): MapConfig {
    return MAPS[id] ?? MAPS.wasteland_outskirts;
}

export function listMaps(): string[] {
    return Object.keys(MAPS);
}
