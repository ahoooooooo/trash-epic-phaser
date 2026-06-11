# Trash Epic Art Bible v3 — 廢土 Cel-Shaded 手繪(全美術重做基準)

> 2026-06-11 user 明令「美術全部重做,根據遊戲定位自己拍」。本文件是美術唯一真相,
> **取代** `docs/design/v2/visual_design_system.md` 的 style suffix / negative prompt 段
> (v2 的 palette / 材質 / silhouette / pose / 解析度規則**繼續有效**,本文件引用之)。

## 1. 定調:Warm Wasteland Cel(廢土 cel-shaded 手繪)

一句話:**乾淨 anime / cel-shaded 卡通線條 + 廢土磨損材質 + 暖色油燈光,明亮可讀,不 grimdark。**

以遊戲定位推導(養成 + 自動打怪 + 抽卡,直屏 mobile):

| 定位 | 美術推論 |
|---|---|
| 抽卡(R/SR/SSR/UR familiar 是商品) | 立繪要「想抽」— cel 乾淨線條 + 角色魅力 > 暗色寫實恐怖 |
| 自動打怪(玩家長時間盯螢幕走位) | 150px 上下的小尺寸可讀性優先:粗外框線、平塗色塊、剪影清楚 |
| 養成(裝備/天賦/倉庫 UI 高頻開) | 立繪進 UI 卡框要乾淨,鏽板 UI 語言沿用 v2 |
| 世界觀「破敗中有人情味的溫暖求生」 | 暖色、有光、苦中帶暖;**不是**黑暗絕望 painterly |

**Canonical anchor(風格錨,所有生成必附 reference):**
`D:\TrashEpic_Phaser\public\assets\characters\player_scavver_sideview_idle.png`
(拾荒少年 idle — 全遊戲唯一已達標資產,走路 4 幀配方已驗證,保留不重做)

## 2. Style-lock prompt 模板(每張生成必用)

骨架(從 walk v5 驗證配方抽出,角色類):

```
MATCH THE REFERENCE IMAGE ART STYLE EXACTLY — clean ANIME / cel-shaded CARTOON
style with crisp dark outlines and flat cel shading (NOT realistic, NOT painterly,
NOT gritty photo-real, NOT horror). Warm muted wasteland palette: dirty yellow,
grey-orange, rust red, dark olive green, warm orange lamp-light highlights.
Colours stay LIGHT and warm and readable — do not darken or grunge into murk.
Worn-and-torn details REQUIRED: patches, tears, rust, soot smudges (wasteland
survivors, nothing mint condition).
[角色外觀描述 — 從 docs/design/v2/NN_*.md deep design 抄外觀關鍵字]
Full body, [姿勢 per v2 pose 規則], pure solid white background, crisp clean
edges, generous margin, no text, no labels, no borders.
```

Negative 概念(GPT-4o 寫進 prompt 正文):NOT realistic / NOT painterly / NOT horror /
NOT neon / NOT pixel art / no bright pure blue / no fluorescent green / no pure white cloth。

**例外高飽和(v2 繼承)**:蜈蚣綠酸液、火焰小鬼橙火、審判官暗紅內光 — 危險/神祕標識允許。

## 3. 各類資產規格

| 類別 | 數量 | 解析度(v2 繼承) | 重點 |
|---|---|---|---|
| 玩家 | 保留 | 1240×1300(walk 基準) | 不重做;後續新動作沿 walk 配方 |
| Zone 怪物 | 8 普通 + 4 boss | 普通 1024² pad、boss per v2 | 剪影差異化;跑/爬 2 幀(a/b)沿用現有幀數 |
| NPC | 1(綠頭巾)+ 後續 9 | 1024×1536 | 站姿 3/4 view |
| Familiar 立繪 | 16 | 1024×1536 | 抽卡商品,品質最高優先;稀有度氣場遞增 |
| 地圖 top-down | 9 張 zone1 | 沿用現尺寸 | 見 §4 地圖專則 |
| Skin / logo / bg | 3+ | 沿用現尺寸 | 最後做 |

## 4. 地圖專則(修「暗到看不清」的病根)

- 同樣 cel-painted 俯視,但**亮度地板**:可走地面主色調不得暗於 mid-tone(髒黃 #b08850
  到灰橙 #a05a30 區間),炭黑 #2a2520 只用於障礙/陰影
- **可走區 vs 障礙物對比**:障礙(廢墟牆/殘骸)用深色 + 清楚外緣,地面用亮色 —
  玩家一眼看出哪裡能走
- 路徑用更亮的磨損土色畫出,呼應楓谷 spawn point 的動線設計
- 暖橙油燈光點綴(營地/油燈)當視覺記憶點

## 5. QA Gate(每張資產出貨前,走路事件鐵律制度化)

1. **Compare-to-anchor**:新資產與 anchor(玩家 idle)並排合成一張圖,目視確認同一畫風
2. **進遊戲截圖**:資產 swap 進 dev build,與玩家同框截圖確認不打架
3. **Codex 覆核**:codex CLI `-i` 附並排圖 + 原圖,過了才 commit
4. de-bg 走既有 BiRefNet pipeline(hard alpha cutoff,禁 erode — 細棍會斷)

## 6. 量產順序

- **P0 戰鬥同框資產**(玩家盯最久):zone1 怪 8 隻(giantrat a/b、centipede a/b、
  rust_spider、reactor_crawler、mutant_creeper、rust_scorpion)+ boss 3(acidsire、
  kraz、arbiter)+ NPC 綠頭巾
- **P1 地圖 9 張**(zone1 全部,亮度/對比照 §4)
- **P2 抽卡商品**:familiar 16 張 + skin_blackrain + logo/bg
- 每批:生成 → de-bg → QA gate → 進遊戲驗證 → Codex 覆核 → commit → push

## 7. 與 lock / v2 的關係

- 5 玩法 lock 第 1 條「BiRefNet 廢土手繪 + 六色 palette」**完全遵守**(cel-shaded
  仍是手繪語言;palette 不變;禁色不變)
- v2 visual_design_system 的 SDXL painterly style suffix **作廢**(本文件 §2 取代);
  其餘規則(palette 表 / 材質硬規則 / silhouette / pose / 解析度)繼續有效
- 生成工具:GPT-4o(codex imagegen)+ reference 錨圖;SDXL pipeline 留作備援
