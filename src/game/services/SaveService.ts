// 永久存檔 — localStorage(Phase 4a MVP,Phase 4d 再接 Firebase Cloud Save)
// per GAME_SPEC_V3 §4.4 「死掉不歸零,進度 Save」

import type { EquipSlot, ArmorDef } from './ArmorService';
import { effectiveDefense } from './ArmorService';
import type { SkinSlot } from './SkinService';

const STORAGE_KEY = 'trash-epic-save-v1';
const SAVE_VERSION = 1;

// 週挑戰參數(HUD 進度條與結算共用,避免漂移;WEEK_MS 在下方既有宣告)
const WEEK_GOAL = 300, WEEK_CRYSTAL = 30;

// Phase 4c 設計修正:maxMp 隨等級成長(每級 +5)
function computeMaxMp(level: number): number { return 50 + (level - 1) * 5; }

interface SaveData {
    version: number;
    level: number;
    exp: number;
    gold: number;
    totalKills: number;
    killMilestoneIdx: number;       // 已領取的擊殺里程碑數(留存)
    weekKills: number;              // 本週擊殺數(週挑戰,每週重置)
    weekBucket: number;             // 當前週桶 floor(now/7d),變動即重置
    weekRewardClaimed: boolean;     // 本週挑戰獎勵已領
    playtimeSec: number;
    lastSavedAt: number;
    // Phase 4a-16 新增
    currentWeaponId: string;
    weaponEnh: Record<string, number>;
    // Phase 4a-19 quest 狀態
    questProgress: Record<string, number>;  // questId → 當前進度
    questCompleted: Record<string, boolean>; // questId → 已領獎
    // Phase 4a-20 gacha
    gachaCollection: Record<string, number>; // familiar id → owned count
    gachaPullsSinceSSR: number;
    gachaTotalPulls: number;
    activeFamiliarId: string | null;          // 出戰夥伴 id(null = 未出戰),其 effect 摺進 computeTalentBuff
    // Phase 4b-3 地圖
    currentMapId: string;
    mapEnterX?: number;
    mapEnterY?: number;
    // Phase 4b-6 MP + 藥水
    mp: number;
    maxMp: number;
    hpPotions: number;
    mpPotions: number;
    // Phase 4b-7 掉落物
    materials: Record<string, number>; // 'strengthen_stone' → count
    droppedWeapons: { id: string; data: string }[]; // 已掉但未裝備武器(stringified)
    // Phase 4b-15 天賦樹
    talentPoints: number; // 未花費 TP
    talentLevels: Record<string, number>; // node id → 已點等級
    // Phase 4b-16 夥伴碎片
    familiarShards: Record<string, number>; // familiar id → shard count
    // Phase 4c-F 防具
    ownedArmor: { id: string; data: string }[];        // 已得防具(stringified ArmorDef)
    equippedArmor: Partial<Record<EquipSlot, string>>; // paper doll 格位 → ownedArmor wrapper id
    armorEnh: Record<string, number>;                  // ownedArmor id → 強化等級
    // Phase 4c-2 楓谷藥水
    potions: Record<string, number>;                   // potionId → 持有數
    potionHotbar: (string | null)[];                   // 快捷列 4 格 → potionId
    autoPot: { enabled: boolean; hpThresholdPct: number; mpThresholdPct: number; hpPotionId: string | null; mpPotionId: string | null };
    // Phase 4c-4 商店 skin(純外觀)
    ownedSkinIds: string[];
    equippedSkins: Partial<Record<SkinSlot, string>>;
    // TD 養成(pivot 2026-06-12):守軍永久等級 + 關卡星數
    familiarLevels: Record<string, number>;   // familiar id → Lv(預設 1)
    tdStageStars: Record<string, number>;     // stageId → 最佳星數(1-3,通關才有)
    // Phase 4c-6 變現:廢土晶體(付費幣)+ 禮包 + 月卡 + 每日領取
    crystal: number;
    purchasedPacks: Record<string, number>;  // packId → 累計購買次數(限購用)
    packLastBuyAt: Record<string, number>;    // packId → 上次購買 timestamp(daily/weekly 冷卻)
    monthCardExpiry: number;                   // 月卡到期 timestamp(0 = 無)
    monthCardClaimedAt: number;                // 月卡每日領取日期 timestamp
    dailyCrystalClaimedAt: number;             // 免費每日登入領取日期 timestamp
    // Phase 4c-7 新手引導 FTUE 是否看過
    tutorialDone: boolean;
    // Phase 4c-16 每日登入簽到
    loginStreak: number;       // 連續登入天數(領取時累進)
    lastLoginClaimAt: number;  // 上次領取登入獎勵 timestamp
}

// 以本地日曆日為單位的整數天數(連續登入判定)
function dayNumber(t: number): number {
    const d = new Date(t);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// 同一日曆日判定(每日領取/每日限購用)
function isSameDay(a: number, b: number): boolean {
    if (!a || !b) return false;
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// per Codex review:nested object 必須 deep clone,不能 spread(weaponEnh 會共用 reference)
function makeDefaultSave(): SaveData {
    return {
        version: SAVE_VERSION,
        level: 1,
        exp: 0,
        gold: 0,
        totalKills: 0,
        killMilestoneIdx: 0,
        weekKills: 0,
        weekBucket: 0,
        weekRewardClaimed: false,
        playtimeSec: 0,
        lastSavedAt: 0,
        currentWeaponId: 'weapon_wood_stick',
        weaponEnh: {
            weapon_wood_stick: 0,
            weapon_scrap_knife: 0,
            weapon_rebar_club: 0,
            weapon_pebble_sling: 0,
            weapon_hand_rag: 0
        },
        questProgress: {},
        questCompleted: {},
        gachaCollection: {},
        gachaPullsSinceSSR: 0,
        gachaTotalPulls: 0,
        activeFamiliarId: null,
        currentMapId: 'wasteland_outskirts',
        mp: 50,
        maxMp: 50,
        hpPotions: 3,
        mpPotions: 3,
        materials: {},
        droppedWeapons: [],
        talentPoints: 0,
        talentLevels: {},
        familiarShards: {},
        ownedArmor: [],
        equippedArmor: {},
        armorEnh: {},
        potions: { rust_water: 5, dry_cell: 5 },
        potionHotbar: ['rust_water', 'dry_cell', null, null],
        autoPot: { enabled: false, hpThresholdPct: 0.4, mpThresholdPct: 0.3, hpPotionId: 'rust_water', mpPotionId: 'dry_cell' },
        ownedSkinIds: [],
        equippedSkins: {},
        familiarLevels: {},
        tdStageStars: {},
        crystal: 0,
        purchasedPacks: {},
        packLastBuyAt: {},
        monthCardExpiry: 0,
        monthCardClaimedAt: 0,
        dailyCrystalClaimedAt: 0,
        tutorialDone: false,
        loginStreak: 0,
        lastLoginClaimAt: 0
    };
}

export class SaveService {
    private static _instance: SaveService | null = null;
    private data: SaveData = makeDefaultSave();

    static get instance(): SaveService {
        if (!this._instance) {
            this._instance = new SaveService();
            this._instance.load();
        }
        return this._instance;
    }

    get(): Readonly<SaveData> { return this.data; }

    load(): Readonly<SaveData> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                this.data = makeDefaultSave();
                return this.data;
            }
            const parsed = JSON.parse(raw) as Partial<SaveData>;
            if (parsed.version !== SAVE_VERSION) {
                console.warn('[Save] version mismatch — reset');
                this.data = makeDefaultSave();
                return this.data;
            }
            // merge:default deep clone 為基底,parsed 覆蓋頂層欄位
            // weaponEnh 額外 merge 避免新增的 weapon id 在舊 save 沒有 key
            const merged = makeDefaultSave();
            Object.assign(merged, parsed);
            merged.weaponEnh = { ...makeDefaultSave().weaponEnh, ...(parsed.weaponEnh ?? {}) };
            merged.questProgress = { ...(parsed.questProgress ?? {}) };
            merged.questCompleted = { ...(parsed.questCompleted ?? {}) };
            merged.gachaCollection = { ...(parsed.gachaCollection ?? {}) };
            // Phase 4c 夥伴出戰 forward-compat:舊 save 沒此欄 → null(未出戰)
            merged.activeFamiliarId = typeof parsed.activeFamiliarId === 'string' ? parsed.activeFamiliarId : null;
            // Phase 4b-6 forward-compat:舊 save 沒 mp/potion → 用 default
            if (typeof parsed.mp !== 'number') merged.mp = makeDefaultSave().mp;
            if (typeof parsed.maxMp !== 'number') merged.maxMp = makeDefaultSave().maxMp;
            if (typeof parsed.hpPotions !== 'number') merged.hpPotions = makeDefaultSave().hpPotions;
            if (typeof parsed.mpPotions !== 'number') merged.mpPotions = makeDefaultSave().mpPotions;
            merged.materials = { ...(parsed.materials ?? {}) };
            merged.droppedWeapons = Array.isArray(parsed.droppedWeapons) ? [...parsed.droppedWeapons] : [];
            // Phase 4b-15/4b-16 forward-compat + 既有存檔 talent migration
            merged.talentLevels = { ...(parsed.talentLevels ?? {}) };
            if (typeof parsed.talentPoints !== 'number') {
                // 既有玩家 retroactive:每升 1 級 1 TP,扣掉已花
                const spent = Object.values(merged.talentLevels).reduce((a, b) => a + (b ?? 0), 0);
                merged.talentPoints = Math.max(0, merged.level - 1 - spent);
            } else {
                merged.talentPoints = parsed.talentPoints;
            }
            merged.familiarShards = { ...(parsed.familiarShards ?? {}) };
            // Phase 4c-F forward-compat:舊 save 沒防具欄位
            merged.ownedArmor = Array.isArray(parsed.ownedArmor) ? [...parsed.ownedArmor] : [];
            merged.equippedArmor = { ...(parsed.equippedArmor ?? {}) };
            merged.armorEnh = { ...(parsed.armorEnh ?? {}) };
            // Phase 4c-2 forward-compat:有 typed 藥水就用;舊 save 沒 → 把 legacy hpPotions/mpPotions 折算成鏽水瓶/乾電池液
            if (parsed.potions) {
                merged.potions = { ...makeDefaultSave().potions, ...parsed.potions };
            } else {
                merged.potions = {
                    rust_water: typeof parsed.hpPotions === 'number' ? parsed.hpPotions : makeDefaultSave().potions.rust_water,
                    dry_cell: typeof parsed.mpPotions === 'number' ? parsed.mpPotions : makeDefaultSave().potions.dry_cell
                };
            }
            merged.potionHotbar = Array.isArray(parsed.potionHotbar) ? [...parsed.potionHotbar] : makeDefaultSave().potionHotbar;
            merged.autoPot = { ...makeDefaultSave().autoPot, ...(parsed.autoPot ?? {}) };
            // Phase 4c 設計修正:maxMp 隨等級衍生(舊存檔也修正),mp 夾住
            merged.maxMp = computeMaxMp(merged.level);
            merged.mp = Math.min(merged.mp, merged.maxMp);
            // Phase 4c-4 skin forward-compat
            merged.ownedSkinIds = Array.isArray(parsed.ownedSkinIds) ? [...parsed.ownedSkinIds] : [];
            merged.equippedSkins = { ...(parsed.equippedSkins ?? {}) };
            // TD 養成 forward-compat
            merged.familiarLevels = { ...(parsed.familiarLevels ?? {}) };
            merged.tdStageStars = { ...(parsed.tdStageStars ?? {}) };
            // Phase 4c-6 變現 forward-compat
            merged.crystal = typeof parsed.crystal === 'number' ? parsed.crystal : 0;
            merged.purchasedPacks = { ...(parsed.purchasedPacks ?? {}) };
            merged.packLastBuyAt = { ...(parsed.packLastBuyAt ?? {}) };
            merged.monthCardExpiry = typeof parsed.monthCardExpiry === 'number' ? parsed.monthCardExpiry : 0;
            merged.monthCardClaimedAt = typeof parsed.monthCardClaimedAt === 'number' ? parsed.monthCardClaimedAt : 0;
            merged.dailyCrystalClaimedAt = typeof parsed.dailyCrystalClaimedAt === 'number' ? parsed.dailyCrystalClaimedAt : 0;
            // Phase 4c-7 FTUE:既有玩家(已升級/有擊殺)視為看過,不打擾;全新存檔才跑引導
            merged.tutorialDone = typeof parsed.tutorialDone === 'boolean'
                ? parsed.tutorialDone
                : (merged.lastSavedAt > 0 || merged.level > 1 || merged.totalKills > 0);
            // Phase 4c-16 每日登入 forward-compat
            merged.loginStreak = typeof parsed.loginStreak === 'number' ? parsed.loginStreak : 0;
            merged.lastLoginClaimAt = typeof parsed.lastLoginClaimAt === 'number' ? parsed.lastLoginClaimAt : 0;
            merged.killMilestoneIdx = typeof parsed.killMilestoneIdx === 'number' ? parsed.killMilestoneIdx : 0;
            merged.weekKills = typeof parsed.weekKills === 'number' ? parsed.weekKills : 0;
            merged.weekBucket = typeof parsed.weekBucket === 'number' ? parsed.weekBucket : 0;
            merged.weekRewardClaimed = typeof parsed.weekRewardClaimed === 'boolean' ? parsed.weekRewardClaimed : false;
            this.data = merged;
        } catch (e) {
            console.warn('[Save] load failed', e);
            this.data = makeDefaultSave();
        }
        return this.data;
    }

    save(): void {
        this.data.lastSavedAt = Date.now();
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[Save] write failed', e);
        }
    }

    // progression_v1 §2 簡化版:expToNext = floor(5 × level^1.4)
    // Lv1→2: 5, Lv5→6: 14, Lv10→11: 33, Lv20→21: 86, Lv50→51: 313
    expToNext(): number {
        return Math.floor(5 * Math.pow(this.data.level, 1.4));
    }

    // 加 exp,可能跨級。回傳是否升級 + 新等級。每升 1 級送 1 TP(per 4b-15)
    addExp(amount: number): { leveled: boolean; newLevel: number; levelsGained: number } {
        this.data.exp += amount;
        let levelsGained = 0;
        let next = this.expToNext();
        while (this.data.exp >= next) {
            this.data.exp -= next;
            this.data.level++;
            this.data.talentPoints++;
            levelsGained++;
            next = this.expToNext();
        }
        if (levelsGained > 0) {
            // Phase 4c 設計修正:升級長魔力上限 + 回滿
            this.data.maxMp = computeMaxMp(this.data.level);
            this.data.mp = this.data.maxMp;
        }
        return { leveled: levelsGained > 0, newLevel: this.data.level, levelsGained };
    }

    addGold(amount: number): void { this.data.gold += amount; }
    spendGold(amount: number): boolean {
        if (this.data.gold < amount) return false;
        this.data.gold -= amount;
        return true;
    }
    addKill(): void { this.data.totalKills++; }

    // 擊殺里程碑(留存鉤子):累積擊殺跨門檻領晶體,一次結算所有積欠(舊存檔升級也補發)
    claimKillMilestones(): { kills: number; crystal: number } | null {
        const M = [
            { kills: 100, crystal: 5 }, { kills: 500, crystal: 12 }, { kills: 1000, crystal: 25 },
            { kills: 2500, crystal: 40 }, { kills: 5000, crystal: 70 }, { kills: 10000, crystal: 120 },
            { kills: 25000, crystal: 250 }, { kills: 50000, crystal: 500 }
        ];
        // 防禦:存檔篡改/損壞 → idx 夾成合法整數 0..M.length(避免 M[idx] undefined crash 或永久跳過補發)
        this.data.killMilestoneIdx = Math.max(0, Math.min(M.length, Math.floor(this.data.killMilestoneIdx || 0)));
        let totalCrystal = 0, lastKills = 0, claimed = false;
        while (this.data.killMilestoneIdx < M.length && this.data.totalKills >= M[this.data.killMilestoneIdx].kills) {
            totalCrystal += M[this.data.killMilestoneIdx].crystal;
            lastKills = M[this.data.killMilestoneIdx].kills;
            this.data.killMilestoneIdx++;
            claimed = true;
        }
        if (!claimed) return null;
        this.addCrystal(totalCrystal);
        return { kills: lastKills, crystal: totalCrystal };
    }

    // 週挑戰(recurring 留存):本週擊殺達標領晶體,每 7 天桶重置。每殺呼叫一次。
    tickWeeklyChallenge(): { goal: number; crystal: number } | null {
        const bucket = Math.floor(Date.now() / WEEK_MS); // 7 天一桶
        if (bucket !== this.data.weekBucket) {
            this.data.weekBucket = bucket;
            this.data.weekKills = 0;
            this.data.weekRewardClaimed = false;
        }
        this.data.weekKills++;
        if (!this.data.weekRewardClaimed && this.data.weekKills >= WEEK_GOAL) {
            this.data.weekRewardClaimed = true;
            this.addCrystal(WEEK_CRYSTAL);
            return { goal: WEEK_GOAL, crystal: WEEK_CRYSTAL };
        }
        return null;
    }
    // 週挑戰 read-only 狀態(HUD 進度條用,不 mutate;跨週時回報已重置的 0/未領)
    getWeekStatus(): { kills: number; goal: number; claimed: boolean } {
        const bucket = Math.floor(Date.now() / WEEK_MS);
        const fresh = bucket !== this.data.weekBucket;
        return {
            kills: fresh ? 0 : this.data.weekKills,
            goal: WEEK_GOAL,
            claimed: fresh ? false : this.data.weekRewardClaimed
        };
    }
    addPlaytimeSec(sec: number): void { this.data.playtimeSec += sec; }

    // 武器
    getCurrentWeaponId(): string { return this.data.currentWeaponId; }
    setCurrentWeaponId(id: string): void { this.data.currentWeaponId = id; }
    getWeaponEnh(id: string): number {
        return this.data.weaponEnh[id] ?? 0;
    }
    addWeaponEnh(id: string): void {
        this.data.weaponEnh[id] = (this.data.weaponEnh[id] ?? 0) + 1;
    }

    // Quest
    getQuestProgress(id: string): number { return this.data.questProgress[id] ?? 0; }
    addQuestProgress(id: string, n: number = 1): number {
        const cur = (this.data.questProgress[id] ?? 0) + n;
        this.data.questProgress[id] = cur;
        return cur;
    }
    isQuestCompleted(id: string): boolean { return !!this.data.questCompleted[id]; }
    markQuestCompleted(id: string): void { this.data.questCompleted[id] = true; }

    // 死亡:per Phase 4b-4 規則,等級保留 / 經驗條歸零
    resetExpKeepLevel(): void {
        this.data.exp = 0;
    }

    // Gacha
    getGachaPity(): { pullsSinceSSR: number } {
        return { pullsSinceSSR: this.data.gachaPullsSinceSSR };
    }
    setGachaPity(pullsSinceSSR: number): void {
        this.data.gachaPullsSinceSSR = pullsSinceSSR;
    }
    addGachaPulls(n: number): void { this.data.gachaTotalPulls += n; }
    addFamiliar(id: string): void {
        this.data.gachaCollection[id] = (this.data.gachaCollection[id] ?? 0) + 1;
    }
    getCollectionCount(): number {
        return Object.keys(this.data.gachaCollection).length;
    }
    getOwnedCount(id: string): number {
        return this.data.gachaCollection[id] ?? 0;
    }

    // ── TD 養成:守軍永久等級(金幣升級,戰力 = 基礎 × (1 + 0.15×(Lv-1)))──
    getFamiliarLevel(id: string): number { return this.data.familiarLevels[id] ?? 1; }
    // 升級費:100 × 1.35^(Lv-1),四捨五入到 10
    familiarLevelUpCost(id: string): number {
        const lv = this.getFamiliarLevel(id);
        return Math.round(100 * Math.pow(1.35, lv - 1) / 10) * 10;
    }
    // 花金幣升 1 級;守門:必須擁有。回傳是否成功
    levelUpFamiliar(id: string): boolean {
        if ((this.data.gachaCollection[id] ?? 0) <= 0) return false;
        const cost = this.familiarLevelUpCost(id);
        if (this.data.gold < cost) return false;
        this.data.gold -= cost;
        this.data.familiarLevels[id] = this.getFamiliarLevel(id) + 1;
        return true;
    }
    // ── TD 關卡星數 ──
    getStageStars(stageId: string): number { return this.data.tdStageStars[stageId] ?? 0; }
    setStageStars(stageId: string, stars: number): void {
        if (stars > this.getStageStars(stageId)) this.data.tdStageStars[stageId] = stars;
    }

    // 出戰夥伴 — effect 由 computeTalentBuff 摺進 buff
    getActiveFamiliar(): string | null { return this.data.activeFamiliarId; }
    // 只允許設成已擁有(count>0)的 familiar;傳 null 卸下。回傳是否成功
    setActiveFamiliar(id: string | null): boolean {
        if (id === null) {
            this.data.activeFamiliarId = null;
            return true;
        }
        if ((this.data.gachaCollection[id] ?? 0) <= 0) return false;
        this.data.activeFamiliarId = id;
        return true;
    }

    // Phase 4b-3 地圖
    getCurrentMapId(): string { return this.data.currentMapId; }
    setCurrentMap(mapId: string, enterX?: number, enterY?: number): void {
        this.data.currentMapId = mapId;
        this.data.mapEnterX = enterX;
        this.data.mapEnterY = enterY;
    }
    consumeMapEnterPos(): { x?: number; y?: number } {
        const r = { x: this.data.mapEnterX, y: this.data.mapEnterY };
        this.data.mapEnterX = undefined;
        this.data.mapEnterY = undefined;
        return r;
    }

    // Phase 4b-6 MP / 藥水
    getMp(): number { return this.data.mp; }
    getMaxMp(): number { return this.data.maxMp; }
    setMp(v: number): void { this.data.mp = Math.max(0, Math.min(this.data.maxMp, v)); }
    spendMp(n: number): boolean {
        if (this.data.mp < n) return false;
        this.data.mp -= n;
        return true;
    }
    getHpPotions(): number { return this.data.hpPotions; }
    getMpPotions(): number { return this.data.mpPotions; }
    useHpPotion(): boolean {
        if (this.data.hpPotions <= 0) return false;
        this.data.hpPotions--;
        return true;
    }
    useMpPotion(): boolean {
        if (this.data.mpPotions <= 0) return false;
        this.data.mpPotions--;
        return true;
    }
    addHpPotions(n: number): void { this.data.hpPotions += n; }
    addMpPotions(n: number): void { this.data.mpPotions += n; }

    // Phase 4b-7 掉落物
    addMaterial(id: string, n: number = 1): void {
        this.data.materials[id] = (this.data.materials[id] ?? 0) + n;
    }
    getMaterial(id: string): number { return this.data.materials[id] ?? 0; }
    getAllMaterials(): Record<string, number> { return { ...this.data.materials }; }
    // 戰利品兌換:把指定 boss 戰利品(全清)換成強化石(每個 stonePerTrophy);回傳獲得的強化石數(0=無戰利品)
    exchangeBossTrophies(trophyIds: string[], stonePerTrophy: number): number {
        let total = 0;
        for (const id of trophyIds) {
            const c = this.data.materials[id] ?? 0;
            if (c > 0) { total += c; delete this.data.materials[id]; }
        }
        if (total > 0) {
            this.data.materials['strengthen_stone'] = (this.data.materials['strengthen_stone'] ?? 0) + total * stonePerTrophy;
            this.save();
        }
        return total * stonePerTrophy;
    }
    addDroppedWeapon(w: object): void {
        const id = Math.random().toString(36).slice(2, 10);
        this.data.droppedWeapons.push({ id, data: JSON.stringify(w) });
    }
    getDroppedWeapons(): Array<{ id: string; data: string }> { return [...this.data.droppedWeapons]; }

    // Phase 4b-15 talent
    getTalentPoints(): number { return this.data.talentPoints; }
    addTalentPoints(n: number): void { this.data.talentPoints += n; }
    getTalentLevel(nodeId: string): number { return this.data.talentLevels[nodeId] ?? 0; }
    // raw 寫入 — TalentService 已驗證,SaveService 不再二次檢查 max/prereq(per Codex review)
    rawApplyTalentSpend(nodeId: string): void {
        this.data.talentPoints--;
        this.data.talentLevels[nodeId] = (this.data.talentLevels[nodeId] ?? 0) + 1;
    }
    resetTalents(): void {
        // 重置歸還所有 TP
        let refund = 0;
        for (const k in this.data.talentLevels) refund += this.data.talentLevels[k];
        this.data.talentLevels = {};
        this.data.talentPoints += refund;
    }

    // Phase 4b-16 familiar shards
    addFamiliarShard(familiarId: string, n: number = 1): void {
        this.data.familiarShards[familiarId] = (this.data.familiarShards[familiarId] ?? 0) + n;
    }
    getFamiliarShard(familiarId: string): number {
        return this.data.familiarShards[familiarId] ?? 0;
    }
    getAllFamiliarShards(): Record<string, number> {
        return { ...this.data.familiarShards };
    }
    consumeFamiliarShards(familiarId: string, n: number): boolean {
        const cur = this.data.familiarShards[familiarId] ?? 0;
        if (cur < n) return false;
        this.data.familiarShards[familiarId] = cur - n;
        return true;
    }

    // Phase 4c-F 防具
    addOwnedArmor(a: object): string {
        const id = Math.random().toString(36).slice(2, 10);
        this.data.ownedArmor.push({ id, data: JSON.stringify(a) });
        return id;
    }
    getOwnedArmor(): Array<{ id: string; data: string }> { return [...this.data.ownedArmor]; }
    getEquippedArmor(): Partial<Record<EquipSlot, string>> { return { ...this.data.equippedArmor }; }
    getEquippedArmorId(slot: EquipSlot): string | undefined { return this.data.equippedArmor[slot]; }
    equipArmor(slot: EquipSlot, ownedId: string): void {
        // 同一件防具不可同時佔兩格(尤其飾品 I/II);先從其他格移除
        for (const key in this.data.equippedArmor) {
            if (this.data.equippedArmor[key as EquipSlot] === ownedId) {
                delete this.data.equippedArmor[key as EquipSlot];
            }
        }
        this.data.equippedArmor[slot] = ownedId;
    }
    unequipArmor(slot: EquipSlot): void { delete this.data.equippedArmor[slot]; }
    getArmorEnh(ownedId: string): number { return this.data.armorEnh[ownedId] ?? 0; }
    addArmorEnh(ownedId: string): void { this.data.armorEnh[ownedId] = (this.data.armorEnh[ownedId] ?? 0) + 1; }
    // 裝備中防具總防禦(含強化 effectiveDefense,takeDamage 減傷用)
    getTotalArmorDefense(): number {
        let def = 0;
        for (const key in this.data.equippedArmor) {
            const wid = this.data.equippedArmor[key as EquipSlot];
            if (!wid) continue;
            const entry = this.data.ownedArmor.find(o => o.id === wid);
            if (!entry) continue;
            try {
                const a = JSON.parse(entry.data) as ArmorDef;
                def += effectiveDefense(a, this.data.armorEnh[wid] ?? 0);
            } catch { /* 壞資料跳過 */ }
        }
        return def;
    }

    // Phase 4c-2 楓谷藥水
    getPotionCount(id: string): number { return this.data.potions[id] ?? 0; }
    getAllPotions(): Record<string, number> { return { ...this.data.potions }; }
    addPotion(id: string, n: number = 1): void {
        this.data.potions[id] = (this.data.potions[id] ?? 0) + n;
    }
    consumePotion(id: string): boolean {
        const cur = this.data.potions[id] ?? 0;
        if (cur <= 0) return false;
        this.data.potions[id] = cur - 1;
        return true;
    }
    getPotionHotbar(): (string | null)[] { return [...this.data.potionHotbar]; }
    setPotionHotbarSlot(slot: number, id: string | null): void {
        if (slot >= 0 && slot < this.data.potionHotbar.length) this.data.potionHotbar[slot] = id;
    }
    getAutoPot(): Readonly<SaveData['autoPot']> { return this.data.autoPot; }
    setAutoPot(cfg: Partial<SaveData['autoPot']>): void {
        this.data.autoPot = { ...this.data.autoPot, ...cfg };
    }

    // Phase 4c-4 skin
    getOwnedSkinIds(): string[] { return [...this.data.ownedSkinIds]; }
    hasSkin(id: string): boolean { return this.data.ownedSkinIds.includes(id); }
    addSkin(id: string): void { if (!this.data.ownedSkinIds.includes(id)) this.data.ownedSkinIds.push(id); }
    getEquippedSkin(slot: SkinSlot): string | undefined { return this.data.equippedSkins[slot]; }
    equipSkin(slot: SkinSlot, id: string): void { this.data.equippedSkins[slot] = id; }

    // Phase 4c-6 變現:廢土晶體(付費幣)— 邊界守門,負值/非有限不可動付費幣
    getCrystal(): number { return this.data.crystal; }
    addCrystal(n: number): void {
        if (!Number.isFinite(n) || n <= 0) return;
        this.data.crystal += n;
    }
    spendCrystal(n: number): boolean {
        if (!Number.isFinite(n) || n <= 0) return false;
        if (this.data.crystal < n) return false;
        this.data.crystal -= n;
        return true;
    }

    // 禮包限購判定(once/daily/weekly/monthcard)
    getPurchasedPackCount(id: string): number { return this.data.purchasedPacks[id] ?? 0; }
    canBuyPack(id: string, limit: 'once' | 'daily' | 'weekly' | 'monthcard'): boolean {
        const now = Date.now();
        const last = this.data.packLastBuyAt[id] ?? 0;
        switch (limit) {
            case 'once': return (this.data.purchasedPacks[id] ?? 0) < 1;
            case 'daily': return !isSameDay(now, last);
            case 'weekly': return now - last >= WEEK_MS;
            case 'monthcard': return true;  // 月卡可重複購買(疊加到期)
        }
    }
    recordPackPurchase(id: string): void {
        this.data.purchasedPacks[id] = (this.data.purchasedPacks[id] ?? 0) + 1;
        this.data.packLastBuyAt[id] = Date.now();
    }

    // 月卡:購買延長到期 + 期間每日領晶體
    getMonthCardExpiry(): number { return this.data.monthCardExpiry; }
    isMonthCardActive(): boolean { return this.data.monthCardExpiry > Date.now(); }
    extendMonthCard(days: number): void {
        if (!Number.isFinite(days) || days <= 0) return;
        const now = Date.now();
        const base = this.data.monthCardExpiry > now ? this.data.monthCardExpiry : now;
        this.data.monthCardExpiry = base + days * 24 * 60 * 60 * 1000;
    }
    canClaimMonthCardDaily(): boolean {
        return this.isMonthCardActive() && !isSameDay(Date.now(), this.data.monthCardClaimedAt);
    }
    claimMonthCardDaily(amount: number): boolean {
        if (!Number.isFinite(amount) || amount <= 0) return false;
        if (!this.canClaimMonthCardDaily()) return false;
        this.data.monthCardClaimedAt = Date.now();
        this.data.crystal += amount;
        return true;
    }

    // 免費每日登入領晶體
    canClaimDailyCrystal(): boolean { return !isSameDay(Date.now(), this.data.dailyCrystalClaimedAt); }
    claimDailyCrystal(amount: number): boolean {
        if (!Number.isFinite(amount) || amount <= 0) return false;
        if (!this.canClaimDailyCrystal()) return false;
        this.data.dailyCrystalClaimedAt = Date.now();
        this.data.crystal += amount;
        return true;
    }

    // Phase 4c-7 新手引導 FTUE
    isTutorialDone(): boolean { return this.data.tutorialDone; }
    markTutorialDone(): void { this.data.tutorialDone = true; }

    // Phase 4c-16 每日登入簽到
    getLoginStreak(): number { return this.data.loginStreak; }
    canClaimDailyLogin(): boolean { return dayNumber(Date.now()) !== dayNumber(this.data.lastLoginClaimAt) || this.data.lastLoginClaimAt === 0; }
    // 非破壞性預覽:本次領取「會」變成的 streak / cycle 日(與 claimDailyLogin 同邏輯,給彈窗顯示用)
    getNextDailyLoginPreview(): { streak: number; cycleDay: number } {
        const now = Date.now();
        const last = this.data.lastLoginClaimAt;
        const nextStreak = (last !== 0 && dayNumber(now) - dayNumber(last) === 1) ? this.data.loginStreak + 1 : 1;
        return { streak: nextStreak, cycleDay: ((nextStreak - 1) % 7) + 1 };
    }
    // 領取登入獎勵,回傳本次簽到的 cycle 日(1-7);若今日已領回 0
    claimDailyLogin(): number {
        const now = Date.now();
        if (this.data.lastLoginClaimAt !== 0 && dayNumber(now) === dayNumber(this.data.lastLoginClaimAt)) return 0;
        // 上次領取是昨天 → 連續 +1;否則(中斷或首次)重置為 1
        if (this.data.lastLoginClaimAt !== 0 && dayNumber(now) - dayNumber(this.data.lastLoginClaimAt) === 1) {
            this.data.loginStreak += 1;
        } else {
            this.data.loginStreak = 1;
        }
        this.data.lastLoginClaimAt = now;
        return ((this.data.loginStreak - 1) % 7) + 1;  // 7 天循環
    }

    reset(): void {
        this.data = makeDefaultSave();
        // 不 save() — 留 lastSavedAt = 0 讓登入頁辨識為新角色
        // 把舊 localStorage 也清掉,下次 load() 從零開始
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    }
}
