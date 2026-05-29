// Phase 4c-6 變現:儲值貨幣(廢土晶體)+ 禮包系統
// per docs/design/v2/monetization_v1.md(經濟企劃 via 免費 LLM)
// 紅線:不 pay-to-win(禮包只給外觀+資源+便利,不給攻防上限)、武器強化上限保密、
//       不接真實金流(儲值/禮包 = placeholder 系統,按下直接發貨,不串 Apple/Google IAP)

export interface TopupTier {
    id: string;
    priceLabel: string;   // 顯示價(placeholder,不接金流)
    crystal: number;      // 給的廢土晶體
    bonusPct: number;     // 加成顯示用(倍率-1)
}

// 越大包 CP 值越高(常見手游階梯)
export const TOPUP_TIERS: TopupTier[] = [
    { id: 'tc1', priceLabel: 'NT$30',  crystal: 30,  bonusPct: 0 },
    { id: 'tc2', priceLabel: 'NT$80',  crystal: 100, bonusPct: 0.25 },
    { id: 'tc3', priceLabel: 'NT$150', crystal: 210, bonusPct: 0.40 },
    { id: 'tc4', priceLabel: 'NT$300', crystal: 460, bonusPct: 0.53 },
    { id: 'tc5', priceLabel: 'NT$580', crystal: 950, bonusPct: 0.64 }
];

export type PackLimit = 'once' | 'daily' | 'weekly' | 'monthcard';

export interface PackReward {
    crystal?: number;
    gold?: number;
    materials?: number;       // 通用素材(strengthen_stone)數量
    skinId?: string;          // 附贈外觀
    monthCardDays?: number;   // 月卡天數(配合 dailyCrystal)
    dailyCrystal?: number;    // 月卡有效期間每日可領晶體
}

export interface PackConfig {
    id: string;
    nameZH: string;
    descZH: string;
    priceLabel: string;
    limit: PackLimit;
    reward: PackReward;
}

export const GIFT_PACKS: PackConfig[] = [
    {
        id: 'pk_newbie', nameZH: '新手禮包', descZH: '晶體30 + 金幣1萬 + 素材5 + 防塵長衣外觀',
        priceLabel: 'NT$30', limit: 'once',
        reward: { crystal: 30, gold: 10000, materials: 5, skinId: 'skin_dust_coat' }
    },
    {
        id: 'pk_daily', nameZH: '每日特惠', descZH: '晶體10 + 金幣5千 + 素材3(每日限購)',
        priceLabel: 'NT$15', limit: 'daily',
        reward: { crystal: 10, gold: 5000, materials: 3 }
    },
    {
        id: 'pk_week', nameZH: '週特惠包', descZH: '晶體50 + 金幣3萬 + 素材3 + 軍用綠幕外觀(每週限購)',
        priceLabel: 'NT$70', limit: 'weekly',
        reward: { crystal: 50, gold: 30000, materials: 3, skinId: 'skin_mil_green' }
    },
    {
        id: 'pk_month', nameZH: '廢土月卡', descZH: '即得晶體120 + 金幣8萬 + 素材5 + 黑匣介面,並 30 天每日領 3 晶體',
        priceLabel: 'NT$250', limit: 'monthcard',
        reward: { crystal: 120, gold: 80000, materials: 5, skinId: 'skin_black_box', monthCardDays: 30, dailyCrystal: 3 }
    },
    {
        id: 'pk_fest1', nameZH: '節慶禮包 I', descZH: '晶體80 + 金幣5萬 + 素材4 + 裂面呼吸罩外觀(限購1)',
        priceLabel: 'NT$180', limit: 'once',
        reward: { crystal: 80, gold: 50000, materials: 4, skinId: 'skin_crack_mask' }
    },
    {
        id: 'pk_fest2', nameZH: '節慶禮包 II', descZH: '晶體120 + 金幣8萬 + 素材6 + 黑雨巡者外觀(限購1)',
        priceLabel: 'NT$300', limit: 'once',
        reward: { crystal: 120, gold: 80000, materials: 6, skinId: 'skin_blackrain' }
    }
];

const LIMIT_LABEL: Record<PackLimit, string> = {
    once: '限購 1 次', daily: '每日限購', weekly: '每週限購', monthcard: '月卡'
};
export function packLimitLabel(l: PackLimit): string { return LIMIT_LABEL[l]; }

export function getPack(id: string): PackConfig | undefined { return GIFT_PACKS.find(p => p.id === id); }
export function getTopupTier(id: string): TopupTier | undefined { return TOPUP_TIERS.find(t => t.id === id); }

// 免費每日登入領晶體量
export const DAILY_FREE_CRYSTAL = 3;
