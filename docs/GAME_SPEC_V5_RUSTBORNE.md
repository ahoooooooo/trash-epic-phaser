# GAME_SPEC V5 —《鏽境 RUSTBORNE》(2026-06-12 user 正式產品定義)

> 取代 GAME_SPEC_V3 的方向層;玩法基底沿用既有 ARPG(楓谷式走位刷怪)。
> user 原話:「名字重新設計 / 一定要可以玩家交易 / 武器強化 / 裝備升級 /
> 打怪升等獲取資源 / 或解主線任務獲取資源 / 不限定工具 / 做出一款高質感遊戲」

## 一句話
廢土生存 MMO-lite ARPG:打怪與主線雙軌養成,武器裝備無上限強化,玩家市集自由交易。

## 名字
- 中文:**鏽境**(備選:餘燼紀元、廢墟之子)
- 英文:**RUSTBORNE**
- 舊名「破爛史詩 Trash Epic」退役;logo 重製(鍛鐵風格沿用 v4 成功配方)

## 五大支柱(user 硬需求,缺一不可)
1. **玩家交易**:市集掛單制(上架武器/裝備/素材 → 全服玩家瀏覽購買)
   - 後端 Firestore transaction 保證原子性(扣貨上架/扣錢交貨一體,杜絕複製)
   - 手續費 5%(金幣 sink,經濟健康)
   - Phase 2 再評估面對面即時交易
2. **武器強化**:沿用既有無上限強化 + 強化石(真實上限彩蛋保密規則不變)
3. **裝備升級**:沿用既有防具強化 + bonus 屬性,擴充升星/突破
4. **打怪資源軌**:楓谷 cycle spawn 刷怪 → EXP/金幣/素材/裝備掉落(既有)
5. **主線任務軌**:10 章廢土主線(每章 3-5 節),獎勵 = 大額資源 + 首通裝備 + 劇情解鎖地圖
   - 與打怪軌互補:打怪 = 穩定細水,主線 = 階段大注

## 技術架構
- **客戶端**:Phaser 4 + TS(沿用;部署 GitHub Pages 不變)
- **後端**:Firebase 免費層(Spark)
  - Auth:匿名登入起步 → Email 綁定(既有 Login/Register UI 接真後端)
  - Firestore:雲端存檔(取代 localStorage 為唯一權威)+ 市集 collection
  - Security Rules:存檔只能本人寫、市集交易走 transaction、關鍵數值範圍驗證(基本防作弊)
- **美術**:v4 美術先行生產線(全屏插畫/UI kit/雙字體)鋪滿全部畫面,禁 code 矩形 UI

## 高質感標準(每頁出貨門檻)
全屏插畫或材質底 + 美術面板/按鈕資產 + Noto Serif/Sans TC + 進場動畫 + 粒子氛圍 + 音效(Phase 2)

## 里程碑
- **M0 重塑**:新名/新 logo/spec(本檔)
- **M1 後端地基**:Firebase 專案 + Auth + 雲存檔讀寫 + 離線 fallback(user 需一次性 `firebase login`)
- **M2 市集**:掛單/瀏覽/購買 + transaction + 手續費 + 市集 UI(美術先行)
- **M3 主線**:10 章任務鏈 + 任務 UI + 章節獎勵表
- **M4 質感全面化**:五 tab 頁 + HUD + 戰鬥演出全部 UI kit 化
- **M5 經濟平衡 + 防作弊強化 + 公測準備

## 不變的鐵律
tsc+build+Playwright+Codex APPROVE;美術 compare-to-anchor;不付費(Firebase 守在免費額度,
用量告警);機密不送 free-tier LLM;武器強化真實上限保密。
