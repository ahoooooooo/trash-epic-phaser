// Phase 4c-4 商店改賣 skin — 純外觀(visualOnly,不給攻防血魔,不碰強化上限)
// per docs/design/v2/maplestory_systems_v2.md C. 商店只賣 Skin。貨幣 gold(不開付費幣)。
// 真美術圖待 GPT-4o;現階段商店列表 + 購買 + 持有/裝備記錄,視覺套用先 placeholder。

export type SkinSlot = 'character' | 'weapon' | 'pet' | 'hud';
export type SkinRarity = 'C' | 'U' | 'R' | 'SR';

export interface SkinConfig {
    id: string;
    nameZH: string;
    slot: SkinSlot;
    priceGold: number;
    priceCrystal?: number;  // R/SR 用廢土晶體買(付費幣)
    rarity: SkinRarity;
    visualOnly: true;
}

export const SKINS: SkinConfig[] = [
    // 角色外觀
    { id: 'skin_dust_coat', nameZH: '防塵長衣', slot: 'character', priceGold: 30000, rarity: 'U', visualOnly: true },
    { id: 'skin_crack_mask', nameZH: '裂面呼吸罩', slot: 'character', priceGold: 0, priceCrystal: 80, rarity: 'R', visualOnly: true },
    { id: 'skin_blackrain', nameZH: '黑雨巡者', slot: 'character', priceGold: 0, priceCrystal: 250, rarity: 'SR', visualOnly: true },
    // 武器外觀
    { id: 'skin_saw_pipe', nameZH: '鋸齒鐵管', slot: 'weapon', priceGold: 20000, rarity: 'C', visualOnly: true },
    { id: 'skin_char_saber', nameZH: '焦黑軍刀', slot: 'weapon', priceGold: 0, priceCrystal: 70, rarity: 'R', visualOnly: true },
    { id: 'skin_bone_barrel', nameZH: '白骨槍殼', slot: 'weapon', priceGold: 0, priceCrystal: 180, rarity: 'SR', visualOnly: true },
    // 寵物外觀
    { id: 'skin_can_drone', nameZH: '罐頭偵測機', slot: 'pet', priceGold: 50000, rarity: 'U', visualOnly: true },
    { id: 'skin_shell_buoy', nameZH: '破殼浮標', slot: 'pet', priceGold: 0, priceCrystal: 90, rarity: 'R', visualOnly: true },
    { id: 'skin_soot_cart', nameZH: '煤煙小車', slot: 'pet', priceGold: 0, priceCrystal: 140, rarity: 'SR', visualOnly: true },
    // HUD 主題
    { id: 'skin_rust_screen', nameZH: '鏽屏介面', slot: 'hud', priceGold: 15000, rarity: 'C', visualOnly: true },
    { id: 'skin_mil_green', nameZH: '軍用綠幕', slot: 'hud', priceGold: 40000, rarity: 'U', visualOnly: true },
    { id: 'skin_black_box', nameZH: '黑匣介面', slot: 'hud', priceGold: 0, priceCrystal: 80, rarity: 'R', visualOnly: true }
];

// rarity C/U → gold,R/SR → crystal(廢土晶體,付費幣)
export function skinCurrency(r: SkinRarity): 'gold' | 'crystal' {
    return (r === 'R' || r === 'SR') ? 'crystal' : 'gold';
}
export function skinPrice(s: SkinConfig): { currency: 'gold' | 'crystal'; amount: number } {
    return skinCurrency(s.rarity) === 'crystal'
        ? { currency: 'crystal', amount: s.priceCrystal ?? 0 }
        : { currency: 'gold', amount: s.priceGold };
}

const RARITY_COLOR: Record<SkinRarity, number> = { C: 0xa0a0a0, U: 0x5db04a, R: 0xc88a2f, SR: 0xc060ff };
const SLOT_LABEL: Record<SkinSlot, string> = { character: '角色', weapon: '武器', pet: '寵物', hud: '介面' };

export function getSkin(id: string): SkinConfig | undefined {
    return SKINS.find(s => s.id === id);
}
export function skinRarityColor(r: SkinRarity): number { return RARITY_COLOR[r]; }
export function skinSlotLabel(slot: SkinSlot): string { return SLOT_LABEL[slot]; }
