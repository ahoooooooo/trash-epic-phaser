// per weapons_v1.md §2 Tier I N rarity 5 把(Phase 4a)
// Phase 4b 再加 Tier II/III/IV + element + 完整 mechanic

export type WeaponCategory = 'Stick' | 'Blade' | 'Hammer' | 'Ranged' | 'Special';
export type ElementType = 'Physical' | 'Fire' | 'Acid' | 'Shock' | 'Toxin';

export interface WeaponDef {
    id: string;
    nameZH: string;
    nameEN: string;
    category: WeaponCategory;
    element: ElementType;
    baseDamage: number;
    attackIntervalMs: number;
    range: number;
    // Mechanic 簡版(Phase 4a):flag + 數值,Phase 4b 改 WeaponMechanicSO
    bleed?: { chance: number; dotPerSec: number; durSec: number };
    stagger?: boolean;           // 命中略停 100ms,視覺暗示
    knockbackPx?: number;        // 命中推開 px
    recoveryPercent?: number;    // 命中回血百分比
}

export const WEAPONS: WeaponDef[] = [
    {
        id: 'weapon_wood_stick',
        nameZH: '木棍', nameEN: 'Wood Stick',
        category: 'Stick', element: 'Physical',
        baseDamage: 10, attackIntervalMs: 700, range: 220
    },
    {
        id: 'weapon_scrap_knife',
        nameZH: '廢鋁刀', nameEN: 'Scrap Knife',
        category: 'Blade', element: 'Physical',
        baseDamage: 12, attackIntervalMs: 600, range: 200,
        bleed: { chance: 0.10, dotPerSec: 0.30, durSec: 5 }
    },
    {
        id: 'weapon_rebar_club',
        nameZH: '鋼筋棒', nameEN: 'Rebar Club',
        category: 'Hammer', element: 'Physical',
        baseDamage: 16, attackIntervalMs: 1100, range: 230,
        stagger: true
    },
    {
        id: 'weapon_pebble_sling',
        nameZH: '拼接彈弓', nameEN: 'Pebble Sling',
        category: 'Ranged', element: 'Physical',
        baseDamage: 8, attackIntervalMs: 850, range: 400,
        knockbackPx: 60
    },
    {
        id: 'weapon_hand_rag',
        nameZH: '髒手套', nameEN: 'Hand Rag',
        category: 'Special', element: 'Physical',
        baseDamage: 6, attackIntervalMs: 500, range: 180,
        recoveryPercent: 0.005
    }
];

export function getWeapon(id: string): WeaponDef {
    return WEAPONS.find(w => w.id === id) ?? WEAPONS[0];
}

// per progression_v1 §2 simplified:每 +1 enh 線性 +15%,diminish pivot 100
// effectiveMult(enh) = 1 + sum_{i=1..enh}(0.15 × min(1, 100/(i+100)))
export function effectiveDamage(weapon: WeaponDef, enhLevel: number): number {
    if (enhLevel <= 0) return weapon.baseDamage;
    let mult = 1;
    for (let i = 1; i <= enhLevel; i++) {
        const dim = Math.min(1, 100 / (i + 100));
        mult += 0.15 * dim;
    }
    return Math.round(weapon.baseDamage * mult);
}

// 強化金幣消耗 — 線性遞增:cost(enh) = floor(50 × (1 + enh × 0.5))
// Lv 0→1: 50, Lv 5→6: 175, Lv 10→11: 300, Lv 50→51: 1300
export function enhanceCost(currentEnh: number): number {
    return Math.floor(50 * (1 + currentEnh * 0.5));
}
