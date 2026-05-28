// Gacha banner — Phase 4a 簡化版
// 機率公開(per [[reference-gacha-law-china-mirror-arch]] 強制):
//   R 75% / SR 19% / SSR 5% / UR 1%
//   Soft pity:50 抽無 SSR+,從第 51 抽起 SSR+ 機率每抽 +5%
//   Hard pity:80 抽必 SSR+

export type Rarity = 'R' | 'SR' | 'SSR' | 'UR';

export interface FamiliarDef {
    id: string;
    nameZH: string;
    rarity: Rarity;
    spriteKey: string;
}

export const FAMILIAR_POOL: FamiliarDef[] = [
    // 6 R
    { id: 'fam_pip',  nameZH: '廢料童子 皮普',     rarity: 'R',  spriteKey: 'fam_pip' },
    { id: 'fam_mira', nameZH: '採集鼠 米拉',       rarity: 'R',  spriteKey: 'fam_mira' },
    { id: 'fam_grub', nameZH: '哥布林小跟班 古布弟', rarity: 'R',  spriteKey: 'fam_grub' },
    { id: 'fam_zix',  nameZH: '扒手哥布林 茲克斯',  rarity: 'R',  spriteKey: 'fam_zix' },
    { id: 'fam_neek', nameZH: '油燈點燈娘 奈克',    rarity: 'R',  spriteKey: 'fam_neek' },
    { id: 'fam_dorl', nameZH: '鍋爐刷碗工 多爾',    rarity: 'R',  spriteKey: 'fam_dorl' },
    // 4 SR
    { id: 'fam_fire_imp',     nameZH: '火焰小鬼',     rarity: 'SR', spriteKey: 'fam_fire_imp' },
    { id: 'fam_ironguard',    nameZH: '鐵殼守衛',     rarity: 'SR', spriteKey: 'fam_ironguard' },
    { id: 'fam_frost_witch',  nameZH: '霜舌巫師',     rarity: 'SR', spriteKey: 'fam_frost_witch' },
    { id: 'fam_axe_brothers', nameZH: '斧頭兄弟',     rarity: 'SR', spriteKey: 'fam_axe_brothers' },
    // 3 SSR(原 design 2 + shadow_hunter 已生)
    { id: 'fam_blackmarket_fox', nameZH: '黑市狐',     rarity: 'SSR', spriteKey: 'fam_blackmarket_fox' },
    { id: 'fam_wasteland_prophet', nameZH: '廢界先知', rarity: 'SSR', spriteKey: 'fam_wasteland_prophet' },
    { id: 'fam_shadow_hunter',   nameZH: '影獵手',     rarity: 'SSR', spriteKey: 'fam_shadow_hunter' },
    // 1 UR
    { id: 'fam_appraisal_queen', nameZH: '鑑定女王',   rarity: 'UR',  spriteKey: 'fam_appraisal_queen' }
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
