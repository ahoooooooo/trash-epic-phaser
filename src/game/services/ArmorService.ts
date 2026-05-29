// 防具系統 — Phase 4c F:大量隨機防具 + 7 裝備槽 + 防禦減傷
// per user 2026-05-29「設計很多防具 越多越好 遊戲豐富度」。仿 WeaponGenerator pattern。
// 主屬性只有 defense(避免動 maxHP HUD);豐富度靠 部位 base × prefix × suffix × tier 組合。

// 物品部位(掉落/生成用)
export type ArmorSlot = 'helmet' | 'chest' | 'bracers' | 'legs' | 'boots' | 'accessory';
// 裝備頁 paper doll 格位(飾品兩格)
export type EquipSlot = 'helmet' | 'chest' | 'bracers' | 'legs' | 'boots' | 'accessory1' | 'accessory2';
export type ArmorTier = 'N' | 'R' | 'SR' | 'SSR';

export interface ArmorDef {
    slot: ArmorSlot;
    base: string;
    prefix: string;
    suffix: string;
    tier: ArmorTier;
    defense: number;
}

const SLOT_LABEL: Record<ArmorSlot, string> = {
    helmet: '頭盔', chest: '胸甲', bracers: '護腕', legs: '護腿', boots: '戰靴', accessory: '飾品'
};

const EQUIP_LABEL: Record<EquipSlot, string> = {
    helmet: '頭盔', chest: '胸甲', bracers: '護腕', legs: '護腿', boots: '戰靴',
    accessory1: '飾品 I', accessory2: '飾品 II'
};

// 各部位基礎名(廢土風,越多越雜)
const SLOT_BASES: Record<ArmorSlot, string[]> = {
    helmet: ['破布頭巾', '鏽鐵盔', '防毒面殼', '廢墟兜帽', '焊工面罩'],
    chest: ['廢布外衣', '鏽甲背心', '輪胎護胸', '防化服', '鋼板胸甲'],
    bracers: ['纏布護腕', '鐵皮護臂', '鉚釘腕甲', '管線護手'],
    legs: ['補丁長褲', '鏽片護腿', '輪胎護膝', '鋼絲綁腿'],
    boots: ['破膠靴', '鏽鐵戰靴', '輪胎涼鞋', '防滑工靴'],
    accessory: ['廢牌項鍊', '齒輪戒', '彈殼吊墜', '輻射徽章', '骨製護符']
};

// 各部位基礎防禦(胸甲最高,飾品最低)
const SLOT_BASE_DEF: Record<ArmorSlot, number> = {
    helmet: 8, chest: 14, bracers: 5, legs: 9, boots: 5, accessory: 3
};

const PREFIXES = [
    '鏽蝕', '堅固', '厚重', '輕量', '強化', '破舊', '軍規', '鉛襯',
    '防腐', '緻密', '焊接', '復古', '反應', '鉚接', '抗酸', '廢核'
];
const SUFFIXES = [
    '之守', '之壁', '抗性', '庇護', '堅毅', '緩衝', '韌性', '屏障',
    '鎮魂', '守夜', '殘響', '餘燼', '鋼魂', '塵盾', '鏽誓', '不朽'
];

const ALL_SLOTS: ArmorSlot[] = ['helmet', 'chest', 'bracers', 'legs', 'boots', 'accessory'];

const TIER_MULT: Record<ArmorTier, number> = { N: 1.0, R: 1.4, SR: 1.9, SSR: 2.6 };
const TIER_COLOR: Record<ArmorTier, number> = { N: 0xa0a0a0, R: 0x5080ff, SR: 0xc060ff, SSR: 0xffd040 };

function pickTier(): ArmorTier {
    const r = Math.random();
    if (r < 0.01) return 'SSR';
    if (r < 0.08) return 'SR';
    if (r < 0.30) return 'R';
    return 'N';
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomArmor(slot?: ArmorSlot): ArmorDef {
    const s = slot ?? pick(ALL_SLOTS);
    const tier = pickTier();
    const mult = TIER_MULT[tier];
    return {
        slot: s,
        base: pick(SLOT_BASES[s]),
        prefix: pick(PREFIXES),
        suffix: pick(SUFFIXES),
        tier,
        defense: Math.round(SLOT_BASE_DEF[s] * mult)
    };
}

export function armorDisplayName(a: ArmorDef): string {
    return `${a.prefix}${a.base}${a.suffix}`;
}

export function armorRarityColor(tier: ArmorTier): number {
    return TIER_COLOR[tier];
}

export function armorSlotLabel(slot: ArmorSlot): string {
    return SLOT_LABEL[slot];
}

export function equipSlotLabel(slot: EquipSlot): string {
    return EQUIP_LABEL[slot];
}

// 裝備頁 paper doll 所有格位(固定順序,給 E 排版用)
export function allEquipSlots(): EquipSlot[] {
    return ['helmet', 'chest', 'bracers', 'legs', 'boots', 'accessory1', 'accessory2'];
}

// 某 equip 格位接受哪個物品部位(飾品兩格都收 accessory)
export function armorSlotForEquipSlot(eq: EquipSlot): ArmorSlot {
    return eq === 'accessory1' || eq === 'accessory2' ? 'accessory' : eq;
}
