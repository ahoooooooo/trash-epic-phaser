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
        nameZH: '蝕骨清剿',
        descZH: '排水溝的蝕骨蜈蚣會啃骨頭,殺 5 隻。',
        objective: 'kill_mob', targetMobId: 'centipede', targetCount: 5,
        rewardGold: 80, rewardExp: 80,
        prereqQuestId: 'q1_clear_rats'
    },
    {
        id: 'q3_boss',
        nameZH: '巨鼠王首級',
        descZH: '廢料巨鼠 boss 出沒,擊敗 1 隻。',
        objective: 'kill_boss', targetMobId: 'boss_giantrat', targetCount: 1,
        rewardGold: 200, rewardExp: 200,
        prereqQuestId: 'q2_centipede'
    }
];

export function getQuest(id: string): QuestDef | null {
    return QUESTS.find(q => q.id === id) ?? null;
}
