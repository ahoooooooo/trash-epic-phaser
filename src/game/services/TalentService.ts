// Phase 4c-D3 天賦樹內容重做 — 主幹+分支「廢土生存者」樹(per user「重做成有特色的節點」)
// 砍掉一堆純 +x% 填充,改:1 主幹根 → 3 分支(兇徒/鐵壁/狡徒)→ 各分支 minor + KEYSTONE → 終極
// 設計依據 GDKeys/Game Developer:keystone 改變玩法 vs minor 支撐,避免 filler。
// 23 節點 / 10 keystone / 7 depth tier。tier gate 取消(純 requires 鏈解鎖)。

import { SaveService } from './SaveService';

export type TalentRoute = 'attack' | 'defense' | 'support';
export type TalentKind = 'minor' | 'keystone';

export interface TalentRequirement {
    nodeId: string;
    minLevel: number;
}

export interface TalentHiddenCondition {
    type: 'boss_kill' | 'combo_kill' | 'hp_lost_total';
    value: number;
}

export interface TalentNode {
    id: string;
    route: TalentRoute;   // 分支(決定 x 欄 + 顏色);主幹根/終極任選一色,render 另染金
    tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;  // 深度(決定 y)
    kind: TalentKind;     // keystone = 大框節點 / minor = 小節點
    nameZH: string;
    maxLevel: number;
    requires: TalentRequirement[];
    tierGateReq: number;  // D3 取消 tier gate,全 0(純 requires 鏈)
    hidden?: TalentHiddenCondition;
    descZH: (lv: number) => string;
    wired: boolean;       // true = 實際接進 computeTalentBuff;false = 預覽(條件式效果待接戰鬥)
}

export const TALENT_NODES: TalentNode[] = [
    // ===== 主幹根 =====
    { id: 'survivor_root', route: 'defense', tier: 1, kind: 'keystone', nameZH: '拾荒者之心', maxLevel: 20, requires: [], tierGateReq: 0,
      descZH: l => `掉落率 +${l * 2}%`, wired: true },

    // ===== 分支起點(tier2)=====
    { id: 'brute_path', route: 'attack', tier: 2, kind: 'minor', nameZH: '兇徒之路', maxLevel: 100, requires: [{ nodeId: 'survivor_root', minLevel: 1 }], tierGateReq: 0,
      descZH: l => `傷害 +${l * 2}%`, wired: true },
    { id: 'iron_path', route: 'defense', tier: 2, kind: 'minor', nameZH: '鐵壁之路', maxLevel: 100, requires: [{ nodeId: 'survivor_root', minLevel: 1 }], tierGateReq: 0,
      descZH: l => `減傷 +${(l * 1.5).toFixed(1)}%`, wired: true },
    { id: 'cunning_path', route: 'support', tier: 2, kind: 'minor', nameZH: '狡徒之路', maxLevel: 100, requires: [{ nodeId: 'survivor_root', minLevel: 1 }], tierGateReq: 0,
      descZH: l => `經驗 +${(l * 1.5).toFixed(1)}%`, wired: true },

    // ===== tier3:各分支 minor + KEYSTONE =====
    { id: 'rusty_fangs', route: 'attack', tier: 3, kind: 'minor', nameZH: '鏽牙獠齒', maxLevel: 100, requires: [{ nodeId: 'brute_path', minLevel: 2 }], tierGateReq: 0,
      descZH: l => `暴擊率 +${(l * 0.8).toFixed(1)}%`, wired: true },
    { id: 'berserk', route: 'attack', tier: 3, kind: 'keystone', nameZH: '嗜血狂亂', maxLevel: 1, requires: [{ nodeId: 'brute_path', minLevel: 3 }], tierGateReq: 0,
      descZH: () => `HP 越低傷害越高(滿血 +0% → 瀕死 +30%)`, wired: true },

    { id: 'thick_hide', route: 'defense', tier: 3, kind: 'minor', nameZH: '厚皮硬骨', maxLevel: 100, requires: [{ nodeId: 'iron_path', minLevel: 2 }], tierGateReq: 0,
      descZH: l => `最大 HP +${l * 40}`, wired: true },
    { id: 'bulwark', route: 'defense', tier: 3, kind: 'keystone', nameZH: '鋼鐵壁壘', maxLevel: 1, requires: [{ nodeId: 'iron_path', minLevel: 3 }], tierGateReq: 0,
      descZH: () => `免疫擊退 + 受擊反彈 15% 傷害`, wired: true },

    { id: 'quick_fingers', route: 'support', tier: 3, kind: 'minor', nameZH: '快手拆解', maxLevel: 100, requires: [{ nodeId: 'cunning_path', minLevel: 2 }], tierGateReq: 0,
      descZH: l => `撿取範圍 +${l * 6}%`, wired: true },
    { id: 'scrap_magnet', route: 'support', tier: 3, kind: 'keystone', nameZH: '廢料磁吸', maxLevel: 1, requires: [{ nodeId: 'cunning_path', minLevel: 3 }], tierGateReq: 0,
      descZH: () => `自動吸取全螢幕掉落物`, wired: true },

    // ===== tier4:各分支 2 minor 深化 =====
    { id: 'exposed_nerve', route: 'attack', tier: 4, kind: 'minor', nameZH: '裸露神經', maxLevel: 100, requires: [{ nodeId: 'rusty_fangs', minLevel: 3 }], tierGateReq: 0,
      descZH: l => `暴擊傷害 +${l * 4}%`, wired: true },
    { id: 'carnage', route: 'attack', tier: 4, kind: 'minor', nameZH: '殺戮節奏', maxLevel: 100, requires: [{ nodeId: 'berserk', minLevel: 1 }], tierGateReq: 0,
      descZH: l => `攻速 +${(l * 1.5).toFixed(1)}%`, wired: true },

    { id: 'scar_tissue', route: 'defense', tier: 4, kind: 'minor', nameZH: '疤痕組織', maxLevel: 100, requires: [{ nodeId: 'thick_hide', minLevel: 3 }], tierGateReq: 0,
      descZH: l => `每秒回血 +${l * 2}`, wired: true },
    { id: 'rust_thorns', route: 'defense', tier: 4, kind: 'minor', nameZH: '鏽刺反甲', maxLevel: 100, requires: [{ nodeId: 'bulwark', minLevel: 1 }], tierGateReq: 0,
      descZH: l => `反傷 +${l * 3}%`, wired: true },

    { id: 'gold_tooth', route: 'support', tier: 4, kind: 'minor', nameZH: '金牙', maxLevel: 100, requires: [{ nodeId: 'quick_fingers', minLevel: 3 }], tierGateReq: 0,
      descZH: l => `金幣 +${l * 2}%`, wired: true },
    { id: 'lucky_scav', route: 'support', tier: 4, kind: 'minor', nameZH: '幸運拾荒', maxLevel: 100, requires: [{ nodeId: 'scrap_magnet', minLevel: 1 }], tierGateReq: 0,
      descZH: l => `掉落 +${(l * 1.5).toFixed(1)}%`, wired: true },

    // ===== tier5:分支 KEYSTONE =====
    { id: 'glass_cannon', route: 'attack', tier: 5, kind: 'keystone', nameZH: '玻璃炮', maxLevel: 1, requires: [{ nodeId: 'exposed_nerve', minLevel: 3 }], tierGateReq: 0,
      descZH: () => `傷害 +50%,但受到傷害 +25%`, wired: true },
    { id: 'last_stand', route: 'defense', tier: 5, kind: 'keystone', nameZH: '背水一戰', maxLevel: 1, requires: [{ nodeId: 'scar_tissue', minLevel: 3 }], tierGateReq: 0,
      descZH: () => `HP < 30% 時 減傷 +40%`, wired: true },
    { id: 'alchemist', route: 'support', tier: 5, kind: 'keystone', nameZH: '廢土煉金', maxLevel: 1, requires: [{ nodeId: 'gold_tooth', minLevel: 3 }], tierGateReq: 0,
      descZH: () => `撿到素材 25% 機率翻倍`, wired: true },

    // ===== tier6:分支終極 KEYSTONE =====
    { id: 'reaper', route: 'attack', tier: 6, kind: 'keystone', nameZH: '死神鐮刀', maxLevel: 1, requires: [{ nodeId: 'glass_cannon', minLevel: 1 }], tierGateReq: 0,
      descZH: () => `對 HP < 15% 的敵人 直接處決`, wired: true },
    { id: 'immortal', route: 'defense', tier: 6, kind: 'keystone', nameZH: '不朽之軀', maxLevel: 1, requires: [{ nodeId: 'last_stand', minLevel: 1 }], tierGateReq: 0,
      descZH: () => `致死時 留 1 HP 並無敵 2s(180s CD)`, wired: true },
    { id: 'hoarder_king', route: 'support', tier: 6, kind: 'keystone', nameZH: '囤積之王', maxLevel: 1, requires: [{ nodeId: 'alchemist', minLevel: 1 }], tierGateReq: 0,
      descZH: () => `金幣 / 掉落 / 經驗 全 +15%`, wired: true },

    // ===== tier7:全樹終極 =====
    { id: 'wasteland_god', route: 'defense', tier: 7, kind: 'keystone', nameZH: '廢土之神', maxLevel: 1,
      requires: [{ nodeId: 'reaper', minLevel: 1 }, { nodeId: 'immortal', minLevel: 1 }, { nodeId: 'hoarder_king', minLevel: 1 }], tierGateReq: 0,
      descZH: () => `全傷害 +10% / 減傷 +10% / 移速 +10%`, wired: true }
];

// === buff 計算(只算 wired:true)===
export interface TalentBuff {
    dmgPct: number;
    critRatePct: number;
    critDmgPct: number;
    atkSpeedPct: number;
    maxHpFlat: number;
    damageReductionPct: number;
    hpRegenPerSec: number;
    dodgePct: number;
    thornPct: number;
    moveSpeedPct: number;
    pickupRangePct: number;
    expGainPct: number;
    goldGainPct: number;
    materialGainPct: number;
    dropRatePct: number;
    // 特色 keystone(質變,接 Game 戰鬥邏輯)
    berserkLowHpDmg: number;   // 嗜血狂亂:HP 越低額外傷害(0→此值,線性)
    lowHpDrBonus: number;      // 背水一戰:HP<30% 額外減傷
    executeThreshold: number;  // 死神鐮刀:敵 HP 比例 < 此值直接處決(boss 無效)
    cheatDeath: boolean;       // 不朽之軀:致死留 1HP + 無敵(CD)
    autoMagnetAll: boolean;    // 廢料磁吸:全螢幕自動吸取
    doubleMatChance: number;   // 廢土煉金:撿素材翻倍機率
}

function wiredLv(id: string): number {
    const node = TALENT_NODES.find(n => n.id === id);
    if (!node || !node.wired) return 0;
    return SaveService.instance.getTalentLevel(id);
}

function has(id: string): boolean { return wiredLv(id) > 0; }

export function computeTalentBuff(): TalentBuff {
    return {
        dmgPct: wiredLv('brute_path') * 0.02 + wiredLv('glass_cannon') * 0.5 + wiredLv('wasteland_god') * 0.1,
        critRatePct: wiredLv('rusty_fangs') * 0.008,
        critDmgPct: wiredLv('exposed_nerve') * 0.04,
        atkSpeedPct: wiredLv('carnage') * 0.015,
        maxHpFlat: wiredLv('thick_hide') * 40,
        damageReductionPct: wiredLv('iron_path') * 0.015 - wiredLv('glass_cannon') * 0.25 + wiredLv('wasteland_god') * 0.1,
        hpRegenPerSec: wiredLv('scar_tissue') * 2,
        dodgePct: 0,
        thornPct: wiredLv('rust_thorns') * 0.03 + (has('bulwark') ? 0.15 : 0),
        moveSpeedPct: wiredLv('wasteland_god') * 0.1,
        pickupRangePct: wiredLv('quick_fingers') * 0.06,
        expGainPct: wiredLv('cunning_path') * 0.015 + wiredLv('hoarder_king') * 0.15,
        goldGainPct: wiredLv('gold_tooth') * 0.02 + wiredLv('hoarder_king') * 0.15,
        materialGainPct: 0,
        dropRatePct: wiredLv('survivor_root') * 0.02 + wiredLv('lucky_scav') * 0.015 + wiredLv('hoarder_king') * 0.15,
        // 特色 keystone
        berserkLowHpDmg: has('berserk') ? 0.30 : 0,
        lowHpDrBonus: has('last_stand') ? 0.40 : 0,
        executeThreshold: has('reaper') ? 0.15 : 0,
        cheatDeath: has('immortal'),
        autoMagnetAll: has('scrap_magnet'),
        doubleMatChance: has('alchemist') ? 0.25 : 0
    };
}

// route 投入點數(顯示用;D3 已無 tier gate)
export function getRouteSpent(route: TalentRoute): number {
    let sum = 0;
    for (const n of TALENT_NODES) {
        if (n.route === route) sum += SaveService.instance.getTalentLevel(n.id);
    }
    return sum;
}

function isHiddenUnlocked(node: TalentNode): boolean {
    if (!node.hidden) return true;
    const save = SaveService.instance.get();
    switch (node.hidden.type) {
        case 'boss_kill':
        case 'combo_kill':
            return save.totalKills >= node.hidden.value;
        case 'hp_lost_total':
            return false;
    }
}

export function isVisible(node: TalentNode): boolean {
    return isHiddenUnlocked(node);
}

export function spendTalentPoint(nodeId: string): { ok: boolean; reason?: string } {
    const node = TALENT_NODES.find(n => n.id === nodeId);
    if (!node) return { ok: false, reason: 'unknown node' };
    const save = SaveService.instance;
    if (save.getTalentPoints() <= 0) return { ok: false, reason: '沒有可分配的 TP' };
    if (!canSpend(node)) return { ok: false, reason: '尚未解鎖 / 已滿級' };
    save.rawApplyTalentSpend(nodeId);
    return { ok: true };
}

export function canSpend(node: TalentNode): boolean {
    const save = SaveService.instance;
    if (save.getTalentLevel(node.id) >= node.maxLevel) return false;
    if (getRouteSpent(node.route) < node.tierGateReq) return false;
    for (const req of node.requires) {
        if (save.getTalentLevel(req.nodeId) < req.minLevel) return false;
    }
    return true;
}
