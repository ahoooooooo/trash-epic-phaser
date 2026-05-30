// 本地帳號系統(註冊 / 登入)— localStorage,無後端(Firebase Cloud Save 留 Phase 4d)
// 純本地單機,密碼用簡易 hash 存(非 crypto 等級,僅避免明文);帳號目前只 gate 進入 + 顯示玩家名,
// 存檔仍共用單一 STORAGE_KEY(per-account 存檔隔離留 Phase 4d Cloud Save)。

const ACCT_KEY = 'trash-epic-accounts';
const CUR_KEY = 'trash-epic-current-account';

export interface Account {
    username: string;
    pwHash: string;
    createdAt: number;
}

// 簡易非 crypto hash(本地單機,僅避免明文存密碼)
function hashPw(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
}

function readAccounts(): Record<string, Account> {
    try {
        const raw = localStorage.getItem(ACCT_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, Account>;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeAccounts(map: Record<string, Account>): boolean {
    try {
        localStorage.setItem(ACCT_KEY, JSON.stringify(map));
        return true;
    } catch (e) {
        console.warn('[Account] write failed', e);
        return false;
    }
}

// 設定當前登入帳號(含 try/catch:quota/隱私模式 storage 不可寫時回 false)
function setCurrentUser(username: string): boolean {
    try {
        localStorage.setItem(CUR_KEY, username);
        return true;
    } catch (e) {
        console.warn('[Account] set current failed', e);
        return false;
    }
}

export interface AuthResult {
    ok: boolean;
    error?: string;
}

export class AccountService {
    // 帳號格式:3-16 字,英數底線
    static validateUsername(username: string): string | null {
        if (username.length < 3 || username.length > 16) return '帳號需 3-16 字';
        if (!/^[A-Za-z0-9_一-龥]+$/.test(username)) return '帳號只能用 中英數 底線';
        return null;
    }
    static validatePassword(password: string): string | null {
        if (password.length < 4 || password.length > 32) return '密碼需 4-32 字';
        return null;
    }

    static register(username: string, password: string): AuthResult {
        const u = username.trim();
        const uErr = this.validateUsername(u);
        if (uErr) return { ok: false, error: uErr };
        const pErr = this.validatePassword(password);
        if (pErr) return { ok: false, error: pErr };
        const accounts = readAccounts();
        if (accounts[u.toLowerCase()]) return { ok: false, error: '帳號已被使用' };
        accounts[u.toLowerCase()] = { username: u, pwHash: hashPw(password), createdAt: Date.now() };
        // 寫入失敗(quota/隱私模式)不可回 ok:true,否則「UI 顯示成功但沒存」
        if (!writeAccounts(accounts)) return { ok: false, error: '本機儲存不可用' };
        if (!setCurrentUser(u)) return { ok: false, error: '本機儲存不可用' };
        return { ok: true };
    }

    static login(username: string, password: string): AuthResult {
        const u = username.trim();
        if (!u || !password) return { ok: false, error: '請輸入帳號密碼' };
        const accounts = readAccounts();
        const acct = accounts[u.toLowerCase()];
        if (!acct) return { ok: false, error: '帳號不存在' };
        if (acct.pwHash !== hashPw(password)) return { ok: false, error: '密碼錯誤' };
        if (!setCurrentUser(acct.username)) return { ok: false, error: '本機儲存不可用' };
        return { ok: true };
    }

    static loginGuest(): AuthResult {
        if (!setCurrentUser('訪客')) return { ok: false, error: '本機儲存不可用' };
        return { ok: true };
    }

    static currentUser(): string | null {
        // storage 被瀏覽器阻擋(隱私模式/政策)時 getItem 會丟,視為未登入
        try {
            return localStorage.getItem(CUR_KEY);
        } catch {
            return null;
        }
    }

    static isLoggedIn(): boolean {
        return this.currentUser() !== null;
    }

    static logout(): void {
        try {
            localStorage.removeItem(CUR_KEY);
        } catch (e) {
            console.warn('[Account] logout failed', e);
        }
    }
}
