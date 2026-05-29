// 永久存檔 — localStorage(Phase 4a MVP,Phase 4d 再接 Firebase Cloud Save)
// per GAME_SPEC_V3 §4.4 「死掉不歸零,進度 Save」

import type { EquipSlot } from './ArmorService';

const STORAGE_KEY = 'trash-epic-save-v1';
const SAVE_VERSION = 1;

// Phase 4c 設計修正:maxMp 隨等級成長(每級 +5)
function computeMaxMp(level: number): number { return 50 + (level - 1) * 5; }

interface SaveData {
    version: number;
    level: number;
    exp: number;
    gold: number;
    totalKills: number;
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
    // Phase 4c-2 楓谷藥水
    potions: Record<string, number>;                   // potionId → 持有數
    potionHotbar: (string | null)[];                   // 快捷列 4 格 → potionId
    autoPot: { enabled: boolean; hpThresholdPct: number; mpThresholdPct: number; hpPotionId: string | null; mpPotionId: string | null };
}

// per Codex review:nested object 必須 deep clone,不能 spread(weaponEnh 會共用 reference)
function makeDefaultSave(): SaveData {
    return {
        version: SAVE_VERSION,
        level: 1,
        exp: 0,
        gold: 0,
        totalKills: 0,
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
        potions: { rust_water: 5, dry_cell: 5 },
        potionHotbar: ['rust_water', 'dry_cell', null, null],
        autoPot: { enabled: false, hpThresholdPct: 0.4, mpThresholdPct: 0.3, hpPotionId: 'rust_water', mpPotionId: 'dry_cell' }
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
    // 裝備中防具總防禦(takeDamage 減傷用)
    getTotalArmorDefense(): number {
        let def = 0;
        for (const key in this.data.equippedArmor) {
            const wid = this.data.equippedArmor[key as EquipSlot];
            const entry = this.data.ownedArmor.find(o => o.id === wid);
            if (!entry) continue;
            try {
                const a = JSON.parse(entry.data) as { defense?: number };
                def += a.defense ?? 0;
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

    reset(): void {
        this.data = makeDefaultSave();
        // 不 save() — 留 lastSavedAt = 0 讓登入頁辨識為新角色
        // 把舊 localStorage 也清掉,下次 load() 從零開始
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    }
}
