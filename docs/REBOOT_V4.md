# REBOOT v4 — 美術先行重建(2026-06-12 user「視覺有夠廉價 整個專案重新開始 重新架構」)

## 病因(為什麼之前廉價)
UI 全是工程師畫的:code 矩形 + emoji 圖標 + 系統字體 + 純黑底。
市售手遊質感 = 整屏插畫背景 + 美術設計的面板/按鈕資產 + 專用字體 + 光效層次。
我們的 GPT-4o 產線本來就能生這些,只是之前用錯生產方式。

## 三決策
1. **美術先行生產線**:每個畫面先生「全屏完稿級概念圖/資產」→ 切 PNG(面板 9-slice)→ Phaser 只組裝。
   任何 UI 不准再用 code 矩形 + emoji 充當(臨時 debug 除外)。
2. **引擎留 Phaser**:引擎不是病因;部署鏈(Pages/URL 手機驗收)是 user 工作流核心,換引擎零視覺收益。
3. **scenes 全重寫**:舊 scenes 廢棄(git 留史),只保留純邏輯層:
   SaveService(含 v2 familiarLevels/tdStageStars)、GachaService、TDService、TalentService 等。
   遊戲概念維持 user 拍板的**塔防養成**(部署名單=抽卡擁有、守軍永久Lv、關卡推進、結算入帳)。

## 視覺語言 v4
- 基調:廢土黃昏 — 暗鐵 + 暖金 + 鏽紅 + 深 teal 陰影(從 Art Bible v3 palette 升級,加金屬質感層)
- 字體:Noto Serif TC(標題,襯線莊重)+ Noto Sans TC(內文)— Google Fonts 免費,webfont 載入
- 每屏結構:整屏插畫背景(上 15%/下 25% 壓暗給 UI)→ 美術面板層 → 文字層 → 粒子/光效層(餘燼、燈光呼吸)
- 進場動畫:面板滑入 + 按鈕 Back.out + 資源條 count-up

## 生產順序
- **Phase A 視覺基礎**(進行中):主城全屏插畫(ui_home_bg_v4)+ UI kit 九件套(ui_kit_v4,白底切件)+
  中文 logo(ui_logo_v4)→ 切資產 → 組第一張 premium 主城(關卡選擇)→ user 驗收視覺方向
- **Phase B 邏輯移植**:塔防養成四頁(主城/戰鬥/守軍營/招募)全部套新 UI kit 重寫
- **Phase C 戰鬥質感**:HUD 美術化、波次 banner、勝敗結算演出、塔攻擊特效升級

## UI kit 切件規範
- 來源圖白底 → 連通元件切割(沿用 BiRefNet/hard-alpha 工具鏈)
- 面板/按鈕存 `public/assets/ui/`,9-slice 參數記在 UIKit.ts 常數
- 字體 Google Fonts CDN(index.html link),Phaser Text fontFamily 指定

## 不變的鐵律
tsc+build+Playwright 實測+Codex APPROVE 才出貨;美術必 compare-to-anchor;不付費;不抄模板。
