// 永久存檔 — localStorage(Phase 4a MVP,Phase 4d 再接 Firebase Cloud Save)
// per GAME_SPEC_V3 §4.4 「死掉不歸零,進度 Save」

const STORAGE_KEY = 'trash-epic-save-v1';
const SAVE_VERSION = 1;

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
        hpPotions: 3,  // 初始送 3 個
        mpPotions: 3
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

    // 加 exp,可能跨級。回傳是否升級 + 新等級
    addExp(amount: number): { leveled: boolean; newLevel: number; levelsGained: number } {
        this.data.exp += amount;
        let levelsGained = 0;
        let next = this.expToNext();
        while (this.data.exp >= next) {
            this.data.exp -= next;
            this.data.level++;
            levelsGained++;
            next = this.expToNext();
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

    reset(): void {
        this.data = makeDefaultSave();
        this.save();
    }
}
