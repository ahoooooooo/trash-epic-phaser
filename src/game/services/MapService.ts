// 地圖系統 — Phase 4c-1 楓谷化多地圖(6 張試水溫)
// town(安全區/商販)/ field(獵場刷怪)/ boss(王區)分類 + 傳送門網路 + 等級分區
// per docs/design/v2/maplestory_systems_v2.md

export type NpcType = 'clerk' | 'shopkeeper';
export type MapType = 'town' | 'field' | 'boss';

export interface NpcSpec {
    type: NpcType;
    x: number;
    y: number;
    spriteKey: string;
    scale: number;
}

// Phase 4c-3 各地商販(村莊賣對應藥水)
export interface ShopNpcSpec {
    id: string;
    nameZH: string;
    x: number;
    y: number;
    shopType: 'potion' | 'skin';
    sellsPotionIds?: string[];  // shopType=potion 時賣哪些藥水(PotionService id)
}

export interface PortalSpec {
    x: number;
    y: number;
    targetMapId: string;
    targetX: number;
    targetY: number;
    label: string;
}

export interface SpawnPointSpec {
    x: number;
    y: number;
    blueprintIdx: number;
}

export interface MapConfig {
    id: string;
    nameZH: string;
    mapType: MapType;
    levelRange?: [number, number];
    regionId: string;
    width: number;
    height: number;
    bgColor: string;
    bgKey?: string;
    spawnPoints: SpawnPointSpec[];
    npcs: NpcSpec[];
    shopNpcs: ShopNpcSpec[];
    portals: PortalSpec[];
    bossEnabled: boolean;
    bossId?: string;          // 該地圖觸發的 boss(BOSS_DEFS key);省略 = giantrat
    playerStartX: number;
    playerStartY: number;
}

// field 獵場 spawn 群。每張圖用「專屬 signature 怪」(per user 2026-05-29「每張圖一種怪物」):
//   廢土外圍(起始)=巨鼠+蜈蚣(idx0,1,支援新手 q1/q2 任務)/ 乾井路=鏽蜈蚣(idx4 橙蟲)/ 爐心門=輻射巨鼠(idx6 綠大)
//   → 各圖剪影/色/大小各異,玩家一眼分辨。真‧獨立新怪 sprite 之後跑 pipeline 生。
function fieldSpawns(w: number, h: number, count: number, idxs: number[]): SpawnPointSpec[] {
    const pts: SpawnPointSpec[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    for (let i = 0; i < count; i++) {
        const cx = (i % cols + 0.5) / cols;
        const cy = (Math.floor(i / cols) + 0.5) / rows;
        pts.push({
            x: Math.round(w * (0.12 + cx * 0.76)),
            y: Math.round(h * (0.14 + cy * 0.72)),
            blueprintIdx: idxs[i % idxs.length]
        });
    }
    return pts;
}

const MAPS: Record<string, MapConfig> = {
    // === 公會大廳(town,起點,只賣 skin)===
    guild_hall: {
        id: 'guild_hall', nameZH: '廢墟同盟公會', mapType: 'town', regionId: 'hub',
        width: 1200, height: 1400, bgColor: '#1a1612', bgKey: 'map_guild_hall_topdown',
        spawnPoints: [],
        npcs: [{ type: 'clerk', x: 300, y: 600, spriteKey: 'npc_clerk', scale: 0.4 }],
        shopNpcs: [],
        portals: [
            { x: 600, y: 1300, targetMapId: 'scrap_town', targetX: 600, targetY: 300, label: '廢料鎮 →' }
        ],
        bossEnabled: false,
        playerStartX: 600, playerStartY: 1100
    },
    // === 廢料鎮(town,新手村,賣低階藥)===
    scrap_town: {
        id: 'scrap_town', nameZH: '廢料鎮', mapType: 'town', levelRange: [1, 80], regionId: 'scrap',
        width: 1400, height: 1600, bgColor: '#2a2218', bgKey: 'map_scrap_town_topdown',
        spawnPoints: [],
        npcs: [],
        shopNpcs: [
            { id: 'scrap_vendor', nameZH: '廢料商販 老咳', x: 400, y: 500, shopType: 'potion',
              sellsPotionIds: ['rust_water', 'murky_pouch', 'dry_cell', 'electrolyte_tube'] }
        ],
        portals: [
            { x: 600, y: 200, targetMapId: 'guild_hall', targetX: 600, targetY: 1200, label: '← 公會' },
            { x: 200, y: 1400, targetMapId: 'wasteland_outskirts', targetX: 1200, targetY: 300, label: '廢土外圍 ↓' },
            { x: 1200, y: 1400, targetMapId: 'rust_alley', targetX: 700, targetY: 300, label: '鏽蝕巷 →' }
        ],
        bossEnabled: false,
        playerStartX: 700, playerStartY: 800
    },
    // === 廢土外圍(field 1-40,新手獵場)===
    wasteland_outskirts: {
        id: 'wasteland_outskirts', nameZH: '廢土外圍', mapType: 'field', levelRange: [1, 40], regionId: 'scrap',
        width: 2400, height: 3200, bgColor: '#2a2520', bgKey: 'map_wasteland_topdown',
        spawnPoints: fieldSpawns(2400, 3200, 16, [0]),  // 一圖一怪:廢土外圍 = 廢料巨鼠 only(q1)
        npcs: [],
        shopNpcs: [],
        portals: [
            { x: 1200, y: 200, targetMapId: 'scrap_town', targetX: 600, targetY: 1300, label: '← 廢料鎮' },
            { x: 300, y: 1600, targetMapId: 'creeper_vale', targetX: 1000, targetY: 400, label: '毒花谷 →' },
            { x: 1200, y: 3000, targetMapId: 'dry_well_road', targetX: 900, targetY: 300, label: '乾井路 ↓' }
        ],
        bossEnabled: true,
        playerStartX: 1200, playerStartY: 1600
    },
    // === 毒花谷(field 1-40,食人花獵場 — 一圖一怪)===
    creeper_vale: {
        id: 'creeper_vale', nameZH: '毒花谷', mapType: 'field', levelRange: [1, 40], regionId: 'scrap',
        width: 2000, height: 2800, bgColor: '#26301f', bgKey: 'map_creeper_vale_topdown',
        spawnPoints: fieldSpawns(2000, 2800, 14, [11]),  // 一圖一怪:毒花谷 = 變異食人花 only(q2/q6)
        npcs: [],
        shopNpcs: [],
        portals: [
            { x: 1000, y: 200, targetMapId: 'wasteland_outskirts', targetX: 300, targetY: 1700, label: '← 廢土外圍' }
        ],
        bossEnabled: false,
        playerStartX: 1000, playerStartY: 1400
    },
    // === 乾井路(field 40-90,進階獵場)===
    dry_well_road: {
        id: 'dry_well_road', nameZH: '乾井路', mapType: 'field', levelRange: [40, 90], regionId: 'scrap',
        width: 1800, height: 2800, bgColor: '#33291c', bgKey: 'map_dry_well_road_topdown',
        spawnPoints: fieldSpawns(1800, 2800, 14, [9]),  // 乾井路 = 鏽蝕機械蜘蛛(真‧獨立新 sprite,非換色)
        npcs: [],
        shopNpcs: [],
        portals: [
            { x: 900, y: 200, targetMapId: 'wasteland_outskirts', targetX: 1200, targetY: 2900, label: '← 廢土外圍' },
            { x: 900, y: 2600, targetMapId: 'rust_alley', targetX: 700, targetY: 1400, label: '鏽蝕巷 ↓' },
            { x: 300, y: 1400, targetMapId: 'sand_pit', targetX: 1000, targetY: 400, label: '鏽蝕沙坑 →' }
        ],
        bossEnabled: true,
        playerStartX: 900, playerStartY: 1400
    },
    // === 鏽蝕沙坑(field 40-90,廢土巨蠍獵場 — 一圖一怪)===
    sand_pit: {
        id: 'sand_pit', nameZH: '鏽蝕沙坑', mapType: 'field', levelRange: [40, 90], regionId: 'scrap',
        width: 2000, height: 2800, bgColor: '#33291c', bgKey: 'map_sand_pit_topdown',
        spawnPoints: fieldSpawns(2000, 2800, 14, [12]),  // 一圖一怪:鏽蝕沙坑 = 廢土巨蠍 only
        npcs: [],
        shopNpcs: [],
        portals: [
            { x: 1000, y: 200, targetMapId: 'dry_well_road', targetX: 300, targetY: 1500, label: '← 乾井路' },
            { x: 200, y: 1400, targetMapId: 'acid_brood', targetX: 900, targetY: 300, label: '蝕骨蜈蚣巢 →' }
        ],
        bossEnabled: false,
        playerStartX: 1000, playerStartY: 1400
    },
    // === 蝕骨蜈蚣巢(field 90-180,蝕骨蜈蚣獵場 — 一圖一怪;殺 50 隻召喚 acidsire 巢母 boss)===
    acid_brood: {
        id: 'acid_brood', nameZH: '蝕骨蜈蚣巢', mapType: 'field', levelRange: [90, 180], regionId: 'scrap',
        width: 1800, height: 2600, bgColor: '#1a2515',
        spawnPoints: fieldSpawns(1800, 2600, 8, [13]),  // 一圖一怪:蝕骨蜈蚣巢 = 蝕骨蜈蚣 only
        npcs: [],
        shopNpcs: [],
        portals: [
            { x: 900, y: 200, targetMapId: 'sand_pit', targetX: 200, targetY: 1500, label: '← 鏽蝕沙坑' }
        ],
        bossEnabled: true, bossId: 'acidsire',
        playerStartX: 900, playerStartY: 1300
    },
    // === 鏽蝕巷(town 80-180,中繼村,賣中低階藥)===
    rust_alley: {
        id: 'rust_alley', nameZH: '鏽蝕巷', mapType: 'town', levelRange: [80, 180], regionId: 'rust',
        width: 1500, height: 1600, bgColor: '#2e221a', bgKey: 'map_rust_alley_topdown',
        spawnPoints: [],
        npcs: [],
        shopNpcs: [
            { id: 'rust_vendor', nameZH: '鏽巷藥師 鐵手', x: 450, y: 500, shopType: 'potion',
              sellsPotionIds: ['murky_pouch', 'clean_jug', 'neuro_cell', 'staunch_foam'] }
        ],
        portals: [
            { x: 700, y: 200, targetMapId: 'scrap_town', targetX: 1200, targetY: 1300, label: '← 廢料鎮' },
            { x: 200, y: 1400, targetMapId: 'dry_well_road', targetX: 900, targetY: 2500, label: '← 乾井路' },
            { x: 1300, y: 1400, targetMapId: 'core_gate', targetX: 1200, targetY: 400, label: '☢ 爐心門' }
        ],
        bossEnabled: false,
        playerStartX: 700, playerStartY: 800
    },
    // === 爐心門(boss 區)===
    core_gate: {
        id: 'core_gate', nameZH: '爐心門', mapType: 'boss', levelRange: [180, 300], regionId: 'reactor',
        width: 2000, height: 2400, bgColor: '#241a16', bgKey: 'map_core_gate_topdown',
        spawnPoints: fieldSpawns(2000, 2400, 6, [10]),  // 爐心門 = 輻射機甲蟲(真‧獨立新 sprite)
        npcs: [],
        shopNpcs: [],
        portals: [
            { x: 1200, y: 200, targetMapId: 'rust_alley', targetX: 1300, targetY: 1300, label: '← 鏽蝕巷' }
        ],
        bossEnabled: true,
        playerStartX: 1000, playerStartY: 1800
    }
};

export function getMap(id: string): MapConfig {
    return MAPS[id] ?? MAPS.wasteland_outskirts;
}

export function listMaps(): string[] {
    return Object.keys(MAPS);
}
