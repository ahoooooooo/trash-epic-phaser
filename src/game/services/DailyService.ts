// Phase 4c-16 每日登入簽到獎勵(7 天循環)。留存鉤子,純發資源不 pay-to-win。
import { SaveService } from './SaveService';

export interface DailyReward {
    day: number;          // cycle 日 1-7
    label: string;
    gold?: number;
    crystal?: number;
    material?: number;    // strengthen_stone
    potionId?: string;
    potionN?: number;
}

export const DAILY_REWARDS: DailyReward[] = [
    { day: 1, label: '金幣 2000', gold: 2000 },
    { day: 2, label: '鏽水瓶 ×3', potionId: 'rust_water', potionN: 3 },
    { day: 3, label: '廢土晶體 5', crystal: 5 },
    { day: 4, label: '金幣 5000', gold: 5000 },
    { day: 5, label: '強化石 ×5', material: 5 },
    { day: 6, label: '乾電池液 ×5', potionId: 'dry_cell', potionN: 5 },
    { day: 7, label: '晶體 20 + 金幣 1萬', crystal: 20, gold: 10000 }
];

export function getDailyReward(day: number): DailyReward {
    return DAILY_REWARDS[(day - 1) % 7];
}

// 發放第 day(1-7)天獎勵到存檔(呼叫端負責 save())
export function grantDailyReward(day: number): DailyReward {
    const r = getDailyReward(day);
    const save = SaveService.instance;
    if (r.gold) save.addGold(r.gold);
    if (r.crystal) save.addCrystal(r.crystal);
    if (r.material) save.addMaterial('strengthen_stone', r.material);
    if (r.potionId && r.potionN) save.addPotion(r.potionId, r.potionN);
    return r;
}
