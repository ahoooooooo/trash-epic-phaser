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
}

const DEFAULT_SAVE: SaveData = {
    version: SAVE_VERSION,
    level: 1,
    exp: 0,
    gold: 0,
    totalKills: 0,
    playtimeSec: 0,
    lastSavedAt: 0
};

export class SaveService {
    private static _instance: SaveService | null = null;
    private data: SaveData = { ...DEFAULT_SAVE };

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
                this.data = { ...DEFAULT_SAVE };
                return this.data;
            }
            const parsed = JSON.parse(raw) as Partial<SaveData>;
            if (parsed.version !== SAVE_VERSION) {
                console.warn('[Save] version mismatch — reset');
                this.data = { ...DEFAULT_SAVE };
                return this.data;
            }
            this.data = { ...DEFAULT_SAVE, ...parsed };
        } catch (e) {
            console.warn('[Save] load failed', e);
            this.data = { ...DEFAULT_SAVE };
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
    addKill(): void { this.data.totalKills++; }
    addPlaytimeSec(sec: number): void { this.data.playtimeSec += sec; }

    reset(): void {
        this.data = { ...DEFAULT_SAVE };
        this.save();
    }
}
