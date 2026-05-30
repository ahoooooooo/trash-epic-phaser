// 裝備武器解析 — 統一 base 武器(5 把)與掉落生成武器的取得
// currentWeaponId 可能指向 base WEAPONS 的 id 或掉落生成武器的 GeneratedWeapon.id
// 注意:droppedWeapons 外層 wrapper id 與 JSON 內 gw.id 不同,必須比對 parse 後的 gw.id
import { WEAPONS, WeaponDef } from './WeaponService';
import { GeneratedWeapon, generatedWeaponToDef } from './WeaponGenerator';
import { SaveService } from './SaveService';

function isValidGeneratedWeapon(gw: unknown): gw is GeneratedWeapon {
    if (typeof gw !== 'object' || gw === null) return false;
    const w = gw as Record<string, unknown>;
    return typeof w.id === 'string'
        && typeof w.element === 'string'
        && typeof w.category === 'string'
        && Number.isFinite(w.baseDamage)
        && Number.isFinite(w.attackIntervalMs)
        && Number.isFinite(w.range);
}

export function getEquippedWeaponDef(): WeaponDef {
    const id = SaveService.instance.getCurrentWeaponId();
    const base = WEAPONS.find(w => w.id === id);
    if (base) return base;
    // 掉落武器:逐筆 parse 比對 gw.id(外層 wrapper id 不可用)
    for (const entry of SaveService.instance.getDroppedWeapons()) {
        try {
            const gw = JSON.parse(entry.data) as unknown;
            if (isValidGeneratedWeapon(gw) && gw.id === id) return generatedWeaponToDef(gw);
        } catch {
            // 損毀資料 → 跳過
        }
    }
    return WEAPONS[0];
}
