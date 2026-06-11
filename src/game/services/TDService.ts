// TD 養成層共用定義(pivot v2 2026-06-12):14 守軍塔屬性 + 6 關卡表。
// 養成公式:戰力 = 基礎 × (1 + 0.15 × (Lv-1)),Lv 永久存 SaveService.familiarLevels。

export interface TowerStat {
    famId: string;          // 對齊 GachaService FAMILIAR_POOL id
    cost: number;           // 場內部署費(🔩)
    range: number;
    rateMs: number;
    dmg: number;
    color: number;          // 投射物色
    splash?: number;        // 濺射半徑
    slowPct?: number;       // 緩速(0-1)
    slowMs?: number;
    bonusScrapPct?: number; // 擊殺 🔩 加成(黑市狐)
    desc: string;
}

export const TOWER_STATS: TowerStat[] = [
    // R — 便宜基本盤
    { famId: 'fam_pip', cost: 100, range: 260, rateMs: 420, dmg: 12, color: 0xffe0c0, desc: '快射' },
    { famId: 'fam_mira', cost: 120, range: 250, rateMs: 760, dmg: 9, color: 0x9be060, slowPct: 0.35, slowMs: 1200, desc: '緩速' },
    { famId: 'fam_grub', cost: 140, range: 220, rateMs: 1300, dmg: 34, color: 0xa05a30, desc: '重擊' },
    { famId: 'fam_zix', cost: 90, range: 240, rateMs: 380, dmg: 9, color: 0xc0a0ff, desc: '速刺' },
    { famId: 'fam_neek', cost: 140, range: 330, rateMs: 1000, dmg: 16, color: 0xff8830, desc: '遠燈' },
    { famId: 'fam_dorl', cost: 150, range: 220, rateMs: 1100, dmg: 14, color: 0xd0c0a0, splash: 70, desc: '潑鍋' },
    // SR — 特化
    { famId: 'fam_fire_imp', cost: 180, range: 235, rateMs: 900, dmg: 20, color: 0xff8830, splash: 95, desc: '濺射' },
    { famId: 'fam_ironguard', cost: 200, range: 260, rateMs: 1500, dmg: 55, color: 0x8b3a1f, desc: '重砲' },
    { famId: 'fam_frost_witch', cost: 220, range: 290, rateMs: 1100, dmg: 24, color: 0x66ccee, slowPct: 0.55, slowMs: 1500, desc: '重緩' },
    { famId: 'fam_axe_brothers', cost: 210, range: 240, rateMs: 520, dmg: 18, color: 0xff6050, desc: '連斬' },
    // SSR — 強力
    { famId: 'fam_blackmarket_fox', cost: 250, range: 270, rateMs: 700, dmg: 30, color: 0xffc040, bonusScrapPct: 0.5, desc: '生財' },
    { famId: 'fam_wasteland_prophet', cost: 260, range: 330, rateMs: 1200, dmg: 40, color: 0xc060ff, slowPct: 0.3, slowMs: 1200, desc: '預言' },
    { famId: 'fam_shadow_hunter', cost: 240, range: 280, rateMs: 650, dmg: 38, color: 0x9050e0, desc: '暗殺' },
    // UR — 全能
    { famId: 'fam_appraisal_queen', cost: 300, range: 320, rateMs: 800, dmg: 55, color: 0xffd040, splash: 80, slowPct: 0.25, slowMs: 1000, desc: '君臨' }
];

export function towerStatOf(famId: string): TowerStat | undefined {
    return TOWER_STATS.find(t => t.famId === famId);
}

// 守軍永久等級 → 戰力倍率
export function famLevelMult(level: number): number {
    return 1 + 0.15 * (level - 1);
}

export interface StageDef {
    id: string;
    nameZH: string;
    bgKey: string;          // 地圖 texture key(Preloader 已載)
    waveCount: number;      // 取 WAVES 前 N 波
    hpMult: number;
    spdMult: number;
    clearGold: number;      // 首通金幣
    repeatGoldPct: number;  // 重複通關 = clearGold × 此值
    firstClearCrystal: number;
    hasBoss: boolean;       // 最後一波換酸主
}

export const STAGES: StageDef[] = [
    { id: 'st1', nameZH: '廢土外圍', bgKey: 'map_wasteland_topdown', waveCount: 8, hpMult: 1.0, spdMult: 1.0, clearGold: 300, repeatGoldPct: 0.4, firstClearCrystal: 20, hasBoss: false },
    { id: 'st2', nameZH: '毒花谷', bgKey: 'map_creeper_vale_topdown', waveCount: 10, hpMult: 1.6, spdMult: 1.0, clearGold: 480, repeatGoldPct: 0.4, firstClearCrystal: 25, hasBoss: false },
    { id: 'st3', nameZH: '乾井路', bgKey: 'map_dry_well_road_topdown', waveCount: 11, hpMult: 2.4, spdMult: 1.05, clearGold: 700, repeatGoldPct: 0.4, firstClearCrystal: 30, hasBoss: false },
    { id: 'st4', nameZH: '鏽蝕沙坑', bgKey: 'map_sand_pit_topdown', waveCount: 12, hpMult: 3.4, spdMult: 1.1, clearGold: 980, repeatGoldPct: 0.4, firstClearCrystal: 35, hasBoss: false },
    { id: 'st5', nameZH: '鏽蝕巷', bgKey: 'map_rust_alley_topdown', waveCount: 13, hpMult: 4.8, spdMult: 1.15, clearGold: 1350, repeatGoldPct: 0.4, firstClearCrystal: 45, hasBoss: false },
    { id: 'st6', nameZH: '爐心門 — 酸主巢穴', bgKey: 'map_core_gate_topdown', waveCount: 15, hpMult: 6.5, spdMult: 1.2, clearGold: 2000, repeatGoldPct: 0.4, firstClearCrystal: 80, hasBoss: true }
];

export function stageOf(id: string): StageDef { return STAGES.find(s => s.id === id) ?? STAGES[0]; }
