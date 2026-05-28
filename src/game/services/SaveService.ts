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
        questCompleted: {}
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

    reset(): void {
        this.data = makeDefaultSave();
        this.save();
    }
}
