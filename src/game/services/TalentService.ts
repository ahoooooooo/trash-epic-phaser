// Phase 4b-15 完整天賦樹 — 60 節點 × 3 路線 × 5 Tier
// per Codex 2026-05-29 deep design council。
// Tier gate: T1=0 / T2=5 / T3=15 / T4=30 / T5=50 per route。
// per memory [[feedback-secret-upper-limits]] 武器強化上限不在 talent 顯示。

import { SaveService } from './SaveService';

export type TalentRoute = 'attack' | 'defense' | 'support';

export interface TalentRequirement {
    nodeId: string;
    minLevel: number;
}

export interface TalentHiddenCondition {
    type: 'boss_kill' | 'combo_kill' | 'hp_lost_total';
    value: number;
}

export interface TalentNode {
    id: string;
    route: TalentRoute;
    tier: 1 | 2 | 3 | 4 | 5;
    nameZH: string;
    maxLevel: number;
    requires: TalentRequirement[];
    tierGateReq: number;
    hidden?: TalentHiddenCondition;
    descZH: (lv: number) => string;
    // wirable 標記:Phase 4b 已接的 stat / 'preview' = 未接
    wired: boolean;
}

// per Codex 60-node table:命名都是廢土風(per [[feedback-behavior-physics]] 命名冷峻生存感)
export const TALENT_NODES: TalentNode[] = [
    // === attack route ===
    // T1
    { id: 'rusty_edge', route: 'attack', tier: 1, nameZH: '鏽刃強化', maxLevel: 10, requires: [], tierGateReq: 0,
      descZH: l => `傷害 +${(l * 1.5).toFixed(1)}%`, wired: true },
    { id: 'ash_focus', route: 'attack', tier: 1, nameZH: '灰燼專注', maxLevel: 5, requires: [{nodeId:'rusty_edge', minLevel:3}], tierGateReq: 0,
      descZH: l => `攻速 +${l}%`, wired: true },
    { id: 'scrap_crit', route: 'attack', tier: 1, nameZH: '碎鐵暴擊', maxLevel: 5, requires: [{nodeId:'rusty_edge', minLevel:2}], tierGateReq: 0,
      descZH: l => `暴擊率 +${(l * 0.4).toFixed(1)}%`, wired: true },
    { id: 'bone_rhythm', route: 'attack', tier: 1, nameZH: '骨節節奏', maxLevel: 5, requires: [{nodeId:'ash_focus', minLevel:2}], tierGateReq: 0,
      descZH: l => `連擊傷害 +${l * 2}%`, wired: false },
    // T2
    { id: 'scorched_impact', route: 'attack', tier: 2, nameZH: '焦土重擊', maxLevel: 10, requires: [{nodeId:'rusty_edge', minLevel:5}], tierGateReq: 5,
      descZH: l => `技能傷害 +${(l * 1.8).toFixed(1)}%`, wired: false },
    { id: 'jagged_teeth', route: 'attack', tier: 2, nameZH: '鋸齒開膛', maxLevel: 5, requires: [{nodeId:'scrap_crit', minLevel:3}], tierGateReq: 5,
      descZH: l => `流血機率 +${l}%`, wired: false },
    { id: 'dirty_finish', route: 'attack', tier: 2, nameZH: '髒手收尾', maxLevel: 1, requires: [{nodeId:'jagged_teeth', minLevel:3}], tierGateReq: 5,
      descZH: () => `對 HP < 15% 敵人 傷害 +25%`, wired: false },
    { id: 'oil_spark', route: 'attack', tier: 2, nameZH: '油火星', maxLevel: 5, requires: [{nodeId:'scorched_impact', minLevel:3}], tierGateReq: 5,
      descZH: l => `燃燒傷害 +${l * 3}%`, wired: false },
    // T3
    { id: 'wasteland_fury', route: 'attack', tier: 3, nameZH: '荒原狂怒', maxLevel: 10, requires: [{nodeId:'bone_rhythm', minLevel:4}], tierGateReq: 15,
      descZH: l => `傷害 +${l}% + 移速 +${(l * 0.5).toFixed(1)}%`, wired: true },
    { id: 'cracked_scope', route: 'attack', tier: 3, nameZH: '裂鏡瞄準', maxLevel: 5, requires: [{nodeId:'scrap_crit', minLevel:5}], tierGateReq: 15,
      descZH: l => `暴擊傷害 +${l * 3}%`, wired: true },
    { id: 'furnace_vein', route: 'attack', tier: 3, nameZH: '爐心血脈', maxLevel: 5, requires: [{nodeId:'oil_spark', minLevel:3}], tierGateReq: 15,
      descZH: l => `燃燒機率 +${l}% / 技能傷害 +${l}%`, wired: false },
    { id: 'cannibal_combo', route: 'attack', tier: 3, nameZH: '吞傷連段', maxLevel: 1, requires: [{nodeId:'dirty_finish', minLevel:1}], tierGateReq: 15,
      descZH: () => `擊殺後連擊窗口 +3s`, wired: false },
    // T4
    { id: 'redline_strike', route: 'attack', tier: 4, nameZH: '紅線突刺', maxLevel: 10, requires: [{nodeId:'scorched_impact', minLevel:7}], tierGateReq: 30,
      descZH: l => `boss 傷害 +${(l * 1.5).toFixed(1)}%`, wired: false },
    { id: 'broken_limit', route: 'attack', tier: 4, nameZH: '破限神經', maxLevel: 5, requires: [{nodeId:'wasteland_fury', minLevel:6}], tierGateReq: 30,
      descZH: l => `HP < 35% 時 傷害 +${l * 4}%`, wired: false },
    { id: 'scrap_storm', route: 'attack', tier: 4, nameZH: '廢鐵風暴', maxLevel: 5, requires: [{nodeId:'cracked_scope', minLevel:3}], tierGateReq: 30,
      descZH: l => `AOE 傷害 +${l * 2}% + 範圍 +${l}%`, wired: false },
    { id: 'survival_predator', route: 'attack', tier: 4, nameZH: '生存掠食者', maxLevel: 1, requires: [{nodeId:'iron_skin', minLevel:5}], tierGateReq: 30,
      descZH: () => `[跨線] 吸血 +2% / 擊殺回血 +1% (需防禦 iron_skin)`, wired: false },
    // T5
    { id: 'ruin_executioner', route: 'attack', tier: 5, nameZH: '廢墟處刑者', maxLevel: 10, requires: [{nodeId:'redline_strike', minLevel:5}], tierGateReq: 50,
      descZH: l => `處決傷害 +${l * 3}% / 暴擊傷害 +${l}%`, wired: false },
    { id: 'black_smoke_chain', route: 'attack', tier: 5, nameZH: '黑煙連鎖', maxLevel: 5, requires: [{nodeId:'scrap_storm', minLevel:4}], tierGateReq: 50, hidden: {type:'combo_kill', value:300},
      descZH: l => `暴擊連鎖 +${l * 8}%`, wired: false },
    { id: 'last_spark', route: 'attack', tier: 5, nameZH: '最後火星', maxLevel: 1, requires: [{nodeId:'broken_limit', minLevel:5}], tierGateReq: 50,
      descZH: () => `瀕死 6s 內 傷害 +40% / cd 120s`, wired: false },
    { id: 'ash_crown', route: 'attack', tier: 5, nameZH: '灰冠 (capstone)', maxLevel: 1, requires: [{nodeId:'ruin_executioner', minLevel:7},{nodeId:'black_smoke_chain', minLevel:3}], tierGateReq: 50,
      descZH: () => `暴擊擊殺 20% 機率刷新技能 + 全傷 +10%`, wired: false },

    // === defense route ===
    // T1
    { id: 'junk_plate', route: 'defense', tier: 1, nameZH: '廢甲護身', maxLevel: 10, requires: [], tierGateReq: 0,
      descZH: l => `護甲 +${l * 8}`, wired: false },
    { id: 'tough_breath', route: 'defense', tier: 1, nameZH: '硬肺', maxLevel: 10, requires: [{nodeId:'junk_plate', minLevel:2}], tierGateReq: 0,
      descZH: l => `最大 HP +${l * 35}`, wired: false },
    { id: 'cracked_guard', route: 'defense', tier: 1, nameZH: '裂盾格擋', maxLevel: 5, requires: [{nodeId:'junk_plate', minLevel:3}], tierGateReq: 0,
      descZH: l => `格擋率 +${(l * 0.6).toFixed(1)}%`, wired: false },
    { id: 'pain_memory', route: 'defense', tier: 1, nameZH: '痛覺記憶', maxLevel: 5, requires: [{nodeId:'tough_breath', minLevel:3}], tierGateReq: 0,
      descZH: l => `減傷 +${(l * 0.6).toFixed(1)}%`, wired: false },
    // T2
    { id: 'iron_skin', route: 'defense', tier: 2, nameZH: '鐵皮', maxLevel: 10, requires: [{nodeId:'junk_plate', minLevel:5}], tierGateReq: 5,
      descZH: l => `護甲百分比 +${(l * 1.2).toFixed(1)}%`, wired: false },
    { id: 'stitched_wound', route: 'defense', tier: 2, nameZH: '粗縫傷口', maxLevel: 5, requires: [{nodeId:'tough_breath', minLevel:5}], tierGateReq: 5,
      descZH: l => `每秒回血 +${l}`, wired: false },
    { id: 'dust_step', route: 'defense', tier: 2, nameZH: '塵步', maxLevel: 5, requires: [{nodeId:'cracked_guard', minLevel:3}], tierGateReq: 5,
      descZH: l => `閃避 +${(l * 0.5).toFixed(1)}%`, wired: false },
    { id: 'brace_impact', route: 'defense', tier: 2, nameZH: '撐住衝擊', maxLevel: 1, requires: [{nodeId:'pain_memory', minLevel:4}], tierGateReq: 5,
      descZH: () => `擊退抗性 +60% / 暈眩抗性 +30%`, wired: false },
    // T3
    { id: 'rust_barrier', route: 'defense', tier: 3, nameZH: '鏽壁', maxLevel: 10, requires: [{nodeId:'iron_skin', minLevel:6}], tierGateReq: 15,
      descZH: l => `護盾上限 +${l}%`, wired: false },
    { id: 'second_pulse', route: 'defense', tier: 3, nameZH: '第二脈搏', maxLevel: 5, requires: [{nodeId:'stitched_wound', minLevel:3}], tierGateReq: 15,
      descZH: l => `受到治療 +${l * 2}%`, wired: false },
    { id: 'toxic_tolerance', route: 'defense', tier: 3, nameZH: '毒土耐性', maxLevel: 5, requires: [{nodeId:'pain_memory', minLevel:5}], tierGateReq: 15,
      descZH: l => `承受 DoT -${l * 3}%`, wired: false },
    { id: 'bunker_habit', route: 'defense', tier: 3, nameZH: '碉堡習慣', maxLevel: 1, requires: [{nodeId:'cracked_guard', minLevel:5}], tierGateReq: 15,
      descZH: () => `靜止 2s 後 受傷 -12%`, wired: false },
    // T4
    { id: 'grit_overflow', route: 'defense', tier: 4, nameZH: '韌性溢出', maxLevel: 10, requires: [{nodeId:'rust_barrier', minLevel:5}], tierGateReq: 30,
      descZH: l => `HP +${l}% / 護甲 +${l * 4}`, wired: false },
    { id: 'shell_rebound', route: 'defense', tier: 4, nameZH: '甲殼反震', maxLevel: 5, requires: [{nodeId:'iron_skin', minLevel:8}], tierGateReq: 30,
      descZH: l => `反傷 +${l * 4}%`, wired: false },
    { id: 'emergency_patch', route: 'defense', tier: 4, nameZH: '緊急補片', maxLevel: 5, requires: [{nodeId:'second_pulse', minLevel:3}], tierGateReq: 30,
      descZH: l => `HP < 30% 時 每秒回 +${(l * 0.4).toFixed(1)}% HP`, wired: false },
    { id: 'scavenger_bulwark', route: 'defense', tier: 4, nameZH: '拾荒壁壘', maxLevel: 1, requires: [{nodeId:'scavenger_eye', minLevel:5}], tierGateReq: 30,
      descZH: () => `[跨線] 撿物獲 5% 護盾 (需輔助 scavenger_eye)`, wired: false },
    // T5
    { id: 'dead_city_wall', route: 'defense', tier: 5, nameZH: '死城高牆', maxLevel: 10, requires: [{nodeId:'grit_overflow', minLevel:7}], tierGateReq: 50,
      descZH: l => `減傷 +${(l * 0.8).toFixed(1)}%`, wired: false },
    { id: 'blood_rivet', route: 'defense', tier: 5, nameZH: '血鉚釘', maxLevel: 5, requires: [{nodeId:'emergency_patch', minLevel:4}], tierGateReq: 50, hidden: {type:'hp_lost_total', value:1000000},
      descZH: l => `最大 HP × ${(l * 0.4).toFixed(1)}% 轉護甲`, wired: false },
    { id: 'refuse_to_fall', route: 'defense', tier: 5, nameZH: '不准倒下', maxLevel: 1, requires: [{nodeId:'dead_city_wall', minLevel:5}], tierGateReq: 50,
      descZH: () => `致死時 留 20% HP 無敵 2s / cd 180s`, wired: false },
    { id: 'bunker_king', route: 'defense', tier: 5, nameZH: '碉堡王 (capstone)', maxLevel: 1, requires: [{nodeId:'dead_city_wall', minLevel:7},{nodeId:'blood_rivet', minLevel:3}], tierGateReq: 50,
      descZH: () => `脫戰護盾 +8% / 全減傷 +10%`, wired: false },

    // === support route ===
    // T1
    { id: 'scavenger_eye', route: 'support', tier: 1, nameZH: '拾荒之眼', maxLevel: 10, requires: [], tierGateReq: 0,
      descZH: l => `掉落 +${l}%`, wired: true },
    { id: 'street_math', route: 'support', tier: 1, nameZH: '街頭算計', maxLevel: 10, requires: [{nodeId:'scavenger_eye', minLevel:2}], tierGateReq: 0,
      descZH: l => `EXP +${(l * 0.8).toFixed(1)}%`, wired: true },
    { id: 'quick_hands', route: 'support', tier: 1, nameZH: '快手拆解', maxLevel: 5, requires: [{nodeId:'scavenger_eye', minLevel:3}], tierGateReq: 0,
      descZH: l => `拾取範圍 +${l * 4}%`, wired: false },
    { id: 'spare_wire', route: 'support', tier: 1, nameZH: '備用銅線', maxLevel: 5, requires: [{nodeId:'street_math', minLevel:3}], tierGateReq: 0,
      descZH: l => `冷卻 -${(l * 0.6).toFixed(1)}%`, wired: false },
    // T2
    { id: 'scrap_cache', route: 'support', tier: 2, nameZH: '藏破爛', maxLevel: 10, requires: [{nodeId:'scavenger_eye', minLevel:5}], tierGateReq: 5,
      descZH: l => `金幣 +${l}%`, wired: true },
    { id: 'field_tinker', route: 'support', tier: 2, nameZH: '野修匠', maxLevel: 5, requires: [{nodeId:'spare_wire', minLevel:2}], tierGateReq: 5,
      descZH: l => `藥水效果 +${l * 3}%`, wired: false },
    { id: 'signal_whistle', route: 'support', tier: 2, nameZH: '信號哨', maxLevel: 5, requires: [{nodeId:'quick_hands', minLevel:3}], tierGateReq: 5,
      descZH: l => `召喚物傷害 +${l * 2}%`, wired: false },
    { id: 'dirty_shortcut', route: 'support', tier: 2, nameZH: '髒路捷徑', maxLevel: 1, requires: [{nodeId:'street_math', minLevel:5}], tierGateReq: 5,
      descZH: () => `移速 +6% / 菁英怪率 +3%`, wired: false },
    // T3
    { id: 'grease_cycle', route: 'support', tier: 3, nameZH: '油脂循環', maxLevel: 10, requires: [{nodeId:'spare_wire', minLevel:5}], tierGateReq: 15,
      descZH: l => `冷卻 -${(l * 0.7).toFixed(1)}%`, wired: false },
    { id: 'junk_drone', route: 'support', tier: 3, nameZH: '破爛無人機', maxLevel: 5, requires: [{nodeId:'signal_whistle', minLevel:3}], tierGateReq: 15,
      descZH: l => `召喚物 HP +${l * 4}% / 傷害 +${l * 2}%`, wired: false },
    { id: 'lucky_filter', route: 'support', tier: 3, nameZH: '幸運濾網', maxLevel: 5, requires: [{nodeId:'scrap_cache', minLevel:5}], tierGateReq: 15,
      descZH: l => `稀有掉落 +${(l * 0.5).toFixed(1)}%`, wired: false },
    { id: 'corpse_map', route: 'support', tier: 3, nameZH: '屍路地圖', maxLevel: 1, requires: [{nodeId:'dirty_shortcut', minLevel:1}], tierGateReq: 15,
      descZH: () => `小地圖標示菁英 + 掉落提示`, wired: false },
    // T4
    { id: 'overclock_junk', route: 'support', tier: 4, nameZH: '廢機超頻', maxLevel: 10, requires: [{nodeId:'junk_drone', minLevel:4}], tierGateReq: 30,
      descZH: l => `召喚物攻速 +${l * 2}% / 冷卻 -${(l * 0.3).toFixed(1)}%`, wired: false },
    { id: 'mentor_scars', route: 'support', tier: 4, nameZH: '傷疤教訓', maxLevel: 5, requires: [{nodeId:'street_math', minLevel:8}], tierGateReq: 30,
      descZH: l => `EXP +${(l * 1.5).toFixed(1)}%`, wired: true },
    { id: 'scavenged_momentum', route: 'support', tier: 4, nameZH: '撿拾動能', maxLevel: 5, requires: [{nodeId:'quick_hands', minLevel:5}], tierGateReq: 30,
      descZH: l => `撿物後 4s 內 移速 +${l * 2}%`, wired: false },
    { id: 'ember_accounting', route: 'support', tier: 4, nameZH: '餘燼帳本', maxLevel: 1, requires: [{nodeId:'scorched_impact', minLevel:5}], tierGateReq: 30,
      descZH: () => `[跨線] 用技能後 暴擊率 +8% (需進攻 scorched_impact)`, wired: false },
    // T5
    { id: 'king_of_scrap', route: 'support', tier: 5, nameZH: '破爛王', maxLevel: 10, requires: [{nodeId:'lucky_filter', minLevel:4}], tierGateReq: 50,
      descZH: l => `掉落 +${(l * 0.8).toFixed(1)}%`, wired: true },
    { id: 'ghost_vendor', route: 'support', tier: 5, nameZH: '鬼市門路', maxLevel: 5, requires: [{nodeId:'corpse_map', minLevel:1}], tierGateReq: 50, hidden: {type:'boss_kill', value:100},
      descZH: l => `稀有掉落 +${(l * 0.8).toFixed(1)}% / 金幣 +${l * 2}%`, wired: false },
    { id: 'machine_prayer', route: 'support', tier: 5, nameZH: '機械祈禱', maxLevel: 1, requires: [{nodeId:'overclock_junk', minLevel:7}], tierGateReq: 50,
      descZH: () => `召喚物死亡 35% 機率復活 / cd 60s`, wired: false },
    { id: 'wasteland_oracle', route: 'support', tier: 5, nameZH: '荒原先知 (capstone)', maxLevel: 1, requires: [{nodeId:'king_of_scrap', minLevel:7},{nodeId:'ghost_vendor', minLevel:3}], tierGateReq: 50,
      descZH: () => `冷卻 -10% / 稀有掉落 +3% / EXP +5%`, wired: false }
];

// === buff 計算 ===
export interface TalentBuff {
    // attack wired
    dmgPct: number;
    critRatePct: number;
    critDmgPct: number;
    atkSpeedPct: number;
    // defense wired
    maxHpFlat: number;
    damageReductionPct: number;
    hpRegenPerSec: number;
    dodgePct: number;
    thornPct: number;
    // support wired
    moveSpeedPct: number;
    pickupRangePct: number;
    expGainPct: number;
    goldGainPct: number;
    materialGainPct: number;
    dropRatePct: number;
}

// per Codex review:wired:false 節點不貢獻 buff(誠實 wired)
function wiredLv(id: string): number {
    const node = TALENT_NODES.find(n => n.id === id);
    if (!node || !node.wired) return 0;
    return SaveService.instance.getTalentLevel(id);
}

export function computeTalentBuff(): TalentBuff {
    return {
        // attack — wired 全 OK
        dmgPct: wiredLv('rusty_edge') * 0.015 + wiredLv('wasteland_fury') * 0.01,
        critRatePct: wiredLv('scrap_crit') * 0.004,
        critDmgPct: wiredLv('cracked_scope') * 0.03,
        atkSpeedPct: wiredLv('ash_focus') * 0.01,
        // defense — 全 wired:false 目前(4c 才接)
        maxHpFlat: 0,
        damageReductionPct: 0,
        hpRegenPerSec: 0,
        dodgePct: 0,
        thornPct: 0,
        // support
        moveSpeedPct: wiredLv('wasteland_fury') * 0.005,
        pickupRangePct: 0,
        expGainPct: wiredLv('street_math') * 0.008 + wiredLv('mentor_scars') * 0.015,
        goldGainPct: wiredLv('scrap_cache') * 0.01,
        materialGainPct: 0,
        dropRatePct: wiredLv('scavenger_eye') * 0.01 + wiredLv('king_of_scrap') * 0.008
    };
}

// 計算 route 投入點數(for tier gate check)
export function getRouteSpent(route: TalentRoute): number {
    let sum = 0;
    for (const n of TALENT_NODES) {
        if (n.route === route) sum += SaveService.instance.getTalentLevel(n.id);
    }
    return sum;
}

// 檢查 hidden 解鎖
function isHiddenUnlocked(node: TalentNode): boolean {
    if (!node.hidden) return true;
    const save = SaveService.instance.get();
    switch (node.hidden.type) {
        case 'boss_kill':
            // 用 totalKills 近似(沒分 boss/普通,先 placeholder)
            return save.totalKills >= node.hidden.value;
        case 'combo_kill':
            return save.totalKills >= node.hidden.value;
        case 'hp_lost_total':
            return false; // 沒追蹤,永遠 hidden 直到 Phase 4c 加 counter
    }
}

export function isVisible(node: TalentNode): boolean {
    return isHiddenUnlocked(node);
}

// per Codex review:service-layer 集中 gate,scene 不再傳 maxLevel/prereq
export function spendTalentPoint(nodeId: string): { ok: boolean; reason?: string } {
    const node = TALENT_NODES.find(n => n.id === nodeId);
    if (!node) return { ok: false, reason: 'unknown node' };
    const save = SaveService.instance;
    if (save.getTalentPoints() <= 0) return { ok: false, reason: 'no TP' };
    if (!canSpend(node)) return { ok: false, reason: 'cant spend (locked/maxed/gate)' };
    save.rawApplyTalentSpend(nodeId);
    return { ok: true };
}

export function canSpend(node: TalentNode): boolean {
    const save = SaveService.instance;
    if (save.getTalentLevel(node.id) >= node.maxLevel) return false;
    // Tier gate
    if (getRouteSpent(node.route) < node.tierGateReq) return false;
    // prereq
    for (const req of node.requires) {
        if (save.getTalentLevel(req.nodeId) < req.minLevel) return false;
    }
    return true;
}
