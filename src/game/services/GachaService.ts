// Gacha banner — Phase 4a 簡化版
// 機率公開(per [[reference-gacha-law-china-mirror-arch]] 強制):
//   R 75% / SR 19% / SSR 5% / UR 1%
//   Soft pity:50 抽無 SSR+,從第 51 抽起 SSR+ 機率每抽 +5%
//   Hard pity:80 抽必 SSR+

export type Rarity = 'R' | 'SR' | 'SSR' | 'UR';

// 夥伴出戰被動效果 — stat 必為 TalentService.TalentBuff 的數值欄位之一
// (computeTalentBuff 把 active 夥伴的 effect.value 摺進對應欄位,戰鬥自動吃到)
// 方向嚴格照 design 角色定位,數值 rarity 階梯 R < SR < SSR < UR。
export type FamiliarStat =
    | 'dmgPct' | 'critRatePct' | 'critDmgPct' | 'atkSpeedPct'
    | 'maxHpFlat' | 'damageReductionPct' | 'hpRegenPerSec' | 'dodgePct'
    | 'moveSpeedPct' | 'pickupRangePct' | 'expGainPct'
    | 'goldGainPct' | 'materialGainPct' | 'dropRatePct';

export interface FamiliarEffect {
    stat: FamiliarStat;
    value: number;
    label: string;
}

export interface FamiliarDef {
    id: string;
    nameZH: string;
    rarity: Rarity;
    spriteKey: string;
    effect: FamiliarEffect;
}

export const FAMILIAR_POOL: FamiliarDef[] = [
    // 6 R
    // 皮普 R/盜賊「拾取速度 +50%,機關地圖最佳」→ pickupRangePct
    { id: 'fam_pip',  nameZH: '廢料童子 皮普',     rarity: 'R',  spriteKey: 'fam_pip',
      effect: { stat: 'pickupRangePct', value: 0.15, label: '撿取範圍 +15%' } },
    // 米拉 R/盜賊「毒霧地圖找稀有植物」→ dropRatePct
    { id: 'fam_mira', nameZH: '採集鼠 米拉',       rarity: 'R',  spriteKey: 'fam_mira',
      effect: { stat: 'dropRatePct', value: 0.08, label: '掉落率 +8%' } },
    // 古布弟 R/戰士「廉價肉盾,新手送」→ maxHpFlat
    { id: 'fam_grub', nameZH: '哥布林小跟班 古布弟', rarity: 'R',  spriteKey: 'fam_grub',
      effect: { stat: 'maxHpFlat', value: 150, label: '最大 HP +150' } },
    // 茲克斯 R/商人「砍價」→ goldGainPct
    { id: 'fam_zix',  nameZH: '扒手哥布林 茲克斯',  rarity: 'R',  spriteKey: 'fam_zix',
      effect: { stat: 'goldGainPct', value: 0.10, label: '金幣 +10%' } },
    // 奈克 R/法師「黑暗地圖視野 + 火 DOT」→ dmgPct
    { id: 'fam_neek', nameZH: '油燈點燈娘 奈克',    rarity: 'R',  spriteKey: 'fam_neek',
      effect: { stat: 'dmgPct', value: 0.05, label: '傷害 +5%' } },
    // 多爾 R/戰士「嘲諷 + 破鍋盾,新手坦」→ damageReductionPct
    { id: 'fam_dorl', nameZH: '鍋爐刷碗工 多爾',    rarity: 'R',  spriteKey: 'fam_dorl',
      effect: { stat: 'damageReductionPct', value: 0.04, label: '減傷 +4%' } },
    // 4 SR
    // 火焰小鬼 SR/法師「範圍火傷」→ dmgPct
    { id: 'fam_fire_imp',     nameZH: '火焰小鬼',     rarity: 'SR', spriteKey: 'fam_fire_imp',
      effect: { stat: 'dmgPct', value: 0.10, label: '傷害 +10%' } },
    // 鐵殼守衛 SR/戰士「重盾鐵鎚」→ damageReductionPct
    { id: 'fam_ironguard',    nameZH: '鐵殼守衛',     rarity: 'SR', spriteKey: 'fam_ironguard',
      effect: { stat: 'damageReductionPct', value: 0.08, label: '減傷 +8%' } },
    // 霜舌巫師 SR/法師「凍結控場」→ critRatePct(凍結弱點 → 暴擊)
    { id: 'fam_frost_witch',  nameZH: '霜舌巫師',     rarity: 'SR', spriteKey: 'fam_frost_witch',
      effect: { stat: 'critRatePct', value: 0.06, label: '暴擊率 +6%' } },
    // 斧頭兄弟 SR/戰士「雙人組合連擊」→ atkSpeedPct
    { id: 'fam_axe_brothers', nameZH: '斧頭兄弟',     rarity: 'SR', spriteKey: 'fam_axe_brothers',
      effect: { stat: 'atkSpeedPct', value: 0.12, label: '攻速 +12%' } },
    // 3 SSR(原 design 2 + shadow_hunter 已生)
    // 黑市狐 SSR/商人「Gold + 黑市加成」→ goldGainPct
    { id: 'fam_blackmarket_fox', nameZH: '黑市狐',     rarity: 'SSR', spriteKey: 'fam_blackmarket_fox',
      effect: { stat: 'goldGainPct', value: 0.30, label: '金幣 +30%' } },
    // 廢界先知 SSR/法師「預判 + buff 全員」→ dmgPct
    { id: 'fam_wasteland_prophet', nameZH: '廢界先知', rarity: 'SSR', spriteKey: 'fam_wasteland_prophet',
      effect: { stat: 'dmgPct', value: 0.18, label: '傷害 +18%' } },
    // 影獵手 SSR/獵手(精準狙殺定位)→ critRatePct
    { id: 'fam_shadow_hunter',   nameZH: '影獵手',     rarity: 'SSR', spriteKey: 'fam_shadow_hunter',
      effect: { stat: 'critRatePct', value: 0.12, label: '暴擊率 +12%' } },
    // 1 UR
    // 鑑定女王 UR/商人「鑑定速度 + 精度 + 稀有掉率」→ dropRatePct
    { id: 'fam_appraisal_queen', nameZH: '鑑定女王',   rarity: 'UR',  spriteKey: 'fam_appraisal_queen',
      effect: { stat: 'dropRatePct', value: 0.25, label: '掉落率 +25%' } }
];

export const RARITY_COLOR: Record<Rarity, number> = {
    R:   0xa0a0a0,  // 灰
    SR:  0x5080ff,  // 藍
    SSR: 0xc060ff,  // 紫
    UR:  0xffd040   // 金
};

export const RARITY_LABEL: Record<Rarity, string> = {
    R: 'R', SR: 'SR', SSR: 'SSR', UR: 'UR'
};

// Roll 結果
export interface GachaResult {
    familiar: FamiliarDef;
    rarity: Rarity;
}

// per Phase 4a 簡化:1 抽 = 100 金幣,10 連 = 1000 金幣(保底 1 SR+)
export const COST_PER_PULL = 100;
export const COST_TEN_PULL = 1000;
export const SOFT_PITY_START = 50;
export const HARD_PITY = 80;

interface PityState {
    pullsSinceSSR: number;
}

function pickRarity(pity: PityState): Rarity {
    // Hard pity
    if (pity.pullsSinceSSR + 1 >= HARD_PITY) {
        // 80% SSR, 18% SSR, 2% UR(保證 SSR+)
        const r = Math.random();
        if (r < 0.02) return 'UR';
        return 'SSR';
    }
    // Soft pity:第 51 抽起,SSR+ 機率 5% + (n-50) × 0.05 線性上升
    // per Codex review:cap at 0.99 防超過 100%(hard pity 80 才強制 100% SSR+)
    const baseSSRPlus = 0.06;
    let ssrPlusChance = baseSSRPlus;
    if (pity.pullsSinceSSR >= SOFT_PITY_START) {
        ssrPlusChance = Math.min(0.99, ssrPlusChance + (pity.pullsSinceSSR - SOFT_PITY_START + 1) * 0.05);
    }
    const r = Math.random();
    if (r < 0.01) return 'UR';                          // 1% UR
    if (r < ssrPlusChance) return 'SSR';                // soft pity 適用
    if (r < ssrPlusChance + 0.19) return 'SR';
    return 'R';
}

function pickByRarity(rarity: Rarity): FamiliarDef {
    const pool = FAMILIAR_POOL.filter(f => f.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
}

export function rollOne(pity: PityState): GachaResult {
    const rarity = pickRarity(pity);
    const familiar = pickByRarity(rarity);
    if (rarity === 'SSR' || rarity === 'UR') {
        pity.pullsSinceSSR = 0;
    } else {
        pity.pullsSinceSSR++;
    }
    return { familiar, rarity };
}

export function rollTen(pity: PityState): GachaResult[] {
    const results: GachaResult[] = [];
    for (let i = 0; i < 10; i++) {
        results.push(rollOne(pity));
    }
    // 保底:10 連必出 1 SR+(若全 R,把最後一個改 SR)
    const hasSrPlus = results.some(r => r.rarity !== 'R');
    if (!hasSrPlus) {
        const fam = pickByRarity('SR');
        results[9] = { familiar: fam, rarity: 'SR' };
    }
    return results;
}
