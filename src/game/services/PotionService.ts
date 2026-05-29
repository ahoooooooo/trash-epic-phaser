// Phase 4c-2 楓谷藥水系統 — 16 種分級補血/補魔/全恢復/HoT/Buff
// per docs/design/v2/maplestory_systems_v2.md。id 對齊 MapService shopNpcs 已配的 vendor。
// 規則:一般 CD 0.8s / 全恢復 CD 5s / buff 同 stat 不疊只刷新 / percent 有 cap 避免高等失效。

export type PotionTarget = 'hp' | 'mp' | 'both';
export type RecoveryKind = 'fixed' | 'percent' | 'full' | 'hot' | 'buff';
export type PotionRarity = 'C' | 'U' | 'R' | 'SR';
export type BuffStat = 'atk' | 'def';

export interface PotionConfig {
    id: string;
    nameZH: string;
    target: PotionTarget;
    kind: RecoveryKind;
    amount?: number;        // fixed:固定回復量
    percent?: number;       // percent/full/hot:佔最大值比例(full=1)
    cap?: number;           // percent 單次回復上限
    perSec?: number;        // hot:每秒回復比例
    durationMs?: number;    // hot 持續 / buff 持續
    buffStat?: BuffStat;    // buff:加哪個屬性
    cooldownMs: number;
    priceGold?: number;
    rarity: PotionRarity;
    vendorIds: string[];
}

export const POTIONS: PotionConfig[] = [
    // HP
    { id: 'rust_water', nameZH: '鏽水瓶', target: 'hp', kind: 'fixed', amount: 60, cooldownMs: 800, priceGold: 40, rarity: 'C', vendorIds: ['scrap_vendor'] },
    { id: 'murky_pouch', nameZH: '濁泉袋', target: 'hp', kind: 'fixed', amount: 180, cooldownMs: 800, priceGold: 120, rarity: 'C', vendorIds: ['scrap_vendor', 'rust_vendor'] },
    { id: 'clean_jug', nameZH: '淨水罐', target: 'hp', kind: 'fixed', amount: 650, cooldownMs: 800, priceGold: 420, rarity: 'U', vendorIds: ['rust_vendor'] },
    { id: 'staunch_foam', nameZH: '止血泡沫', target: 'hp', kind: 'percent', percent: 0.15, cap: 2500, cooldownMs: 800, priceGold: 900, rarity: 'U', vendorIds: ['rust_vendor'] },
    { id: 'adrenaline', nameZH: '腎上腺素針', target: 'hp', kind: 'percent', percent: 0.35, cap: 8000, cooldownMs: 800, priceGold: 2200, rarity: 'R', vendorIds: [] },
    { id: 'field_transfusion', nameZH: '戰地輸血包', target: 'hp', kind: 'full', percent: 1, cooldownMs: 5000, rarity: 'SR', vendorIds: [] },
    // MP
    { id: 'dry_cell', nameZH: '乾電池液', target: 'mp', kind: 'fixed', amount: 40, cooldownMs: 800, priceGold: 35, rarity: 'C', vendorIds: ['scrap_vendor'] },
    { id: 'electrolyte_tube', nameZH: '電解管', target: 'mp', kind: 'fixed', amount: 140, cooldownMs: 800, priceGold: 110, rarity: 'C', vendorIds: ['scrap_vendor', 'rust_vendor'] },
    { id: 'neuro_cell', nameZH: '神經電池', target: 'mp', kind: 'fixed', amount: 520, cooldownMs: 800, priceGold: 380, rarity: 'U', vendorIds: ['rust_vendor'] },
    { id: 'lucid_ampoule', nameZH: '清醒安瓿', target: 'mp', kind: 'percent', percent: 0.15, cap: 1800, cooldownMs: 800, priceGold: 820, rarity: 'U', vendorIds: [] },
    { id: 'black_salt', nameZH: '黑鹽溶劑', target: 'mp', kind: 'percent', percent: 0.35, cap: 6500, cooldownMs: 800, priceGold: 2000, rarity: 'R', vendorIds: [] },
    // 全恢復
    { id: 'ash_elixir', nameZH: '灰燼靈藥', target: 'both', kind: 'percent', percent: 0.5, cooldownMs: 1500, priceGold: 4000, rarity: 'R', vendorIds: [] },
    { id: 'zero_kit', nameZH: '零號急救包', target: 'both', kind: 'full', percent: 1, cooldownMs: 5000, rarity: 'SR', vendorIds: [] },
    // HoT
    { id: 'slow_gel', nameZH: '緩釋凝膠', target: 'hp', kind: 'hot', perSec: 0.04, durationMs: 8000, cooldownMs: 1500, priceGold: 1800, rarity: 'R', vendorIds: [] },
    // Buff(同 stat 不疊只刷新)
    { id: 'iron_lung', nameZH: '鐵肺針', target: 'hp', kind: 'buff', buffStat: 'def', percent: 0.08, durationMs: 90000, cooldownMs: 1500, priceGold: 1500, rarity: 'U', vendorIds: [] },
    { id: 'powder_cap', nameZH: '火藥膠囊', target: 'hp', kind: 'buff', buffStat: 'atk', percent: 0.06, durationMs: 90000, cooldownMs: 1500, priceGold: 2400, rarity: 'R', vendorIds: [] }
];

const RARITY_COLOR: Record<PotionRarity, number> = { C: 0xa0a0a0, U: 0x5db04a, R: 0xc88a2f, SR: 0xc060ff };

export function getPotion(id: string): PotionConfig | undefined {
    return POTIONS.find(p => p.id === id);
}

export function potionRarityColor(r: PotionRarity): number {
    return RARITY_COLOR[r];
}

export interface PotionEffect {
    hpHeal: number;
    mpRestore: number;
    hot?: { perSec: number; durationMs: number };      // 每秒回 maxHp×perSec,持續 durationMs
    buff?: { stat: BuffStat; pct: number; durationMs: number };
}

// 算一瓶藥水的即時效果(不含 HoT/buff 的持續部分,那交給 Game 計時)
export function computePotionEffect(p: PotionConfig, maxHp: number, maxMp: number): PotionEffect {
    const eff: PotionEffect = { hpHeal: 0, mpRestore: 0 };
    const healHp = () => {
        if (p.kind === 'fixed') return p.amount ?? 0;
        if (p.kind === 'percent') return Math.min(Math.round(maxHp * (p.percent ?? 0)), p.cap ?? Infinity);
        if (p.kind === 'full') return maxHp;
        return 0;
    };
    const healMp = () => {
        if (p.kind === 'fixed') return p.amount ?? 0;
        if (p.kind === 'percent') return Math.min(Math.round(maxMp * (p.percent ?? 0)), p.cap ?? Infinity);
        if (p.kind === 'full') return maxMp;
        return 0;
    };
    if (p.kind === 'hot') {
        eff.hot = { perSec: p.perSec ?? 0, durationMs: p.durationMs ?? 0 };
        return eff;
    }
    if (p.kind === 'buff') {
        eff.buff = { stat: p.buffStat ?? 'atk', pct: p.percent ?? 0, durationMs: p.durationMs ?? 0 };
        return eff;
    }
    if (p.target === 'hp' || p.target === 'both') eff.hpHeal = healHp();
    if (p.target === 'mp' || p.target === 'both') eff.mpRestore = healMp();
    return eff;
}
