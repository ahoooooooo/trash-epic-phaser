// Phase 4b-8 隨機武器生成 — base × prefix × suffix × element × tier ≈ 6400 種
// 每把 weapon 唯一 id,stats 動態算

import { WeaponCategory, ElementType, WeaponDef } from './WeaponService';

export type WeaponTier = 'N' | 'R' | 'SR' | 'SSR';

export interface GeneratedWeapon {
    id: string;           // unique 8-char
    base: string;         // 木棍 / 廢鋁刀 / 鋼筋棒 / 拼接彈弓 / 髒手套
    category: WeaponCategory;
    prefix: string;       // 鋒銳 / 沉重 / 迅捷 / 火焰...
    suffix: string;       // 屠戮 / 守護 / 暴擊 / 連擊...
    element: ElementType;
    tier: WeaponTier;
    baseDamage: number;
    attackIntervalMs: number;
    range: number;
}

interface BaseWeapon {
    name: string;
    category: WeaponCategory;
    baseDamage: number;
    attackIntervalMs: number;
    range: number;
}

const BASE_WEAPONS: BaseWeapon[] = [
    { name: '木棍', category: 'Stick', baseDamage: 10, attackIntervalMs: 700, range: 220 },
    { name: '廢鋁刀', category: 'Blade', baseDamage: 12, attackIntervalMs: 600, range: 200 },
    { name: '鋼筋棒', category: 'Hammer', baseDamage: 16, attackIntervalMs: 1100, range: 230 },
    { name: '拼接彈弓', category: 'Ranged', baseDamage: 8, attackIntervalMs: 850, range: 400 },
    { name: '髒手套', category: 'Special', baseDamage: 6, attackIntervalMs: 500, range: 180 }
];

const PREFIXES = [
    '鋒銳', '沉重', '迅捷', '火焰', '冰封', '雷鳴', '腐蝕', '潔淨',
    '殘破', '失修', '焦黑', '銹蝕', '油漬', '尖刺', '鏽蝕', '炙熱'
];

const SUFFIXES = [
    '屠戮', '守護', '暴擊', '連擊', '吸血', '破甲', '麻痺', '撕裂',
    '焦灼', '冷凝', '電擊', '溶解', '榴彈', '突刺', '迴旋', '重擊'
];

const ELEMENTS: ElementType[] = ['Physical', 'Fire', 'Acid', 'Shock', 'Toxin'];

const TIER_MULT: Record<WeaponTier, number> = {
    N: 1.0, R: 1.4, SR: 1.9, SSR: 2.6
};

const TIER_RATES: Array<{ tier: WeaponTier; rate: number }> = [
    { tier: 'N', rate: 0.70 },
    { tier: 'R', rate: 0.22 },
    { tier: 'SR', rate: 0.07 },
    { tier: 'SSR', rate: 0.01 }
];

function pickTier(): WeaponTier {
    const r = Math.random();
    let acc = 0;
    for (const t of TIER_RATES) {
        acc += t.rate;
        if (r < acc) return t.tier;
    }
    return 'N';
}

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

// per Phase 4b-7 mob drop:level 影響 tier 機率(高等怪掉 SR 機率高)
export function generateRandomWeapon(_levelHint = 1): GeneratedWeapon {
    const base = BASE_WEAPONS[Math.floor(Math.random() * BASE_WEAPONS.length)];
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    const tier = pickTier();
    const mult = TIER_MULT[tier];

    return {
        id: genId(),
        base: base.name,
        category: base.category,
        prefix,
        suffix,
        element,
        tier,
        baseDamage: Math.round(base.baseDamage * mult),
        attackIntervalMs: base.attackIntervalMs,
        range: base.range
    };
}

export function weaponDisplayName(w: GeneratedWeapon): string {
    return `${w.prefix} ${w.base} ${w.suffix}`;
}

// 掉落武器 → 戰鬥用 WeaponDef(mechanic flag 留空,generated 是純數值+元素武器)
export function generatedWeaponToDef(w: GeneratedWeapon): WeaponDef {
    return {
        id: w.id,
        nameZH: weaponDisplayName(w),
        nameEN: w.id,
        category: w.category,
        element: w.element,
        baseDamage: w.baseDamage,
        attackIntervalMs: w.attackIntervalMs,
        range: w.range
    };
}

export function rarityColor(tier: WeaponTier): number {
    switch (tier) {
        case 'N': return 0xa0a0a0;
        case 'R': return 0x5080ff;
        case 'SR': return 0xc060ff;
        case 'SSR': return 0xffd040;
    }
}
