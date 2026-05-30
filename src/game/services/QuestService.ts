// Quest 系統(Phase 4a 簡化版,Phase 4b 改 ScriptableObject-like config)

export type QuestObjectiveType = 'kill_mob' | 'kill_boss' | 'reach_level';

export interface QuestDef {
    id: string;
    nameZH: string;
    descZH: string;
    objective: QuestObjectiveType;
    targetMobId?: string;   // for kill_mob / kill_boss
    targetCount: number;
    rewardGold: number;
    rewardExp: number;
    rewardCrystal?: number; // 主線里程碑給晶體(premium 貨幣)
    prereqQuestId?: string; // 前置任務
}

export const QUESTS: QuestDef[] = [
    {
        id: 'q1_clear_rats',
        nameZH: '清理鼠患',
        descZH: '廢墟外的廢料巨鼠太多了,殺 10 隻。',
        objective: 'kill_mob', targetMobId: 'giantrat', targetCount: 10,
        rewardGold: 50, rewardExp: 50
    },
    {
        id: 'q2_centipede',
        nameZH: '剷除毒花',
        descZH: '廢土外圍長出變異食人花,會咬人,殺 5 株。',
        objective: 'kill_mob', targetMobId: 'mutant_creeper', targetCount: 5,
        rewardGold: 80, rewardExp: 80,
        prereqQuestId: 'q1_clear_rats'
    },
    {
        id: 'q3_boss',
        nameZH: '巨鼠王首級',
        descZH: '廢料巨鼠 boss 出沒,擊敗 1 隻。',
        objective: 'kill_boss', targetMobId: 'boss_giantrat', targetCount: 1,
        rewardGold: 200, rewardExp: 200, rewardCrystal: 5,
        prereqQuestId: 'q2_centipede'
    },
    // --- 廢土主線後半(2026-05-30 串接,接真新怪 zone)---
    {
        id: 'q4_spider_nest',
        nameZH: '鏽巢清剿',
        descZH: '巷弄深處,機械蜘蛛在廢料堆裡築了巢。剷掉 8 隻鏽蝕蜘蛛,別讓它們擴散。',
        objective: 'kill_mob', targetMobId: 'rust_spider', targetCount: 8,
        rewardGold: 150, rewardExp: 150,
        prereqQuestId: 'q3_boss'
    },
    {
        id: 'q5_reactor_crawl',
        nameZH: '爐心爬蟲',
        descZH: '爐心門外,反應爐爬蟲順著管線滲出來,渾身發燙。剿滅 8 隻爬蟲,堵住爐心。',
        objective: 'kill_mob', targetMobId: 'reactor_crawler', targetCount: 8,
        rewardGold: 280, rewardExp: 280, rewardCrystal: 10,
        prereqQuestId: 'q4_spider_nest'
    },
    {
        id: 'q6_creeper_purge',
        nameZH: '焦土清剿',
        descZH: '變異食人花在廢土外圍蔓延成片,擋住了通往綠洲的路。燒掉 20 株,殺出一條血路。',
        objective: 'kill_mob', targetMobId: 'mutant_creeper', targetCount: 20,
        rewardGold: 360, rewardExp: 360, rewardCrystal: 15,
        prereqQuestId: 'q5_reactor_crawl'
    },
    {
        id: 'q7_boss_rematch',
        nameZH: '終章:巨鼠王再臨',
        descZH: '廢料巨鼠王沒死透,帶著更兇的爪子回來了。再斬它 2 次,終結這場廢土惡夢。',
        objective: 'kill_boss', targetMobId: 'boss_giantrat', targetCount: 2,
        rewardGold: 800, rewardExp: 800, rewardCrystal: 30,
        prereqQuestId: 'q6_creeper_purge'
    }
];

export function getQuest(id: string): QuestDef | null {
    return QUESTS.find(q => q.id === id) ?? null;
}
