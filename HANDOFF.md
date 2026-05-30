# 接力棒 HANDOFF — Codex 接手就讀這個

> **觸發**:user 說「幫我繼續下去 / 繼續 / 接手」→ 你(Codex)就以代理主席身分,讀本檔挑最上面那個未完成項目開始做。
> 規則全在 `AGENTS.md`(同目錄,你已自動讀到)。完整架構 `docs/AI_COMPANY.md`。
> **這份檔案 Claude 每次收工會更新**;你做完一個項目也要更新它(把完成的劃掉、補新狀態),下一棒才接得上。

---

## 現在狀態(2026-05-30)
- 專案:`D:\TrashEpic_Phaser`(Phaser 4 + TS + Vite),live https://ahoooooooo.github.io/trash-epic-phaser/(repo `ahoooooooo/trash-epic-phaser`,8 個 o)。
- push main → GitHub Actions auto-deploy ~40-60s。
- Phase 4c 程式 roadmap + user 6 大需求 A-F + 變現 + FTUE + 每日簽到 + 主動技能 + 3 隻真新怪 sprite + 10 特色天賦 **全部已完成上線**。
- build 狀態:綠(tsc 0 error / vite build 過 / live 200)。
- 最近(本 session):①UI 直屏防誤觸(右列內縮/tab 間距/搖桿排除底部)②camera HUD-safe band(camera bounds 上下延伸 HUD 高度,角色走到地圖頂/底不被血條/經驗條遮;bg 補滿延伸帶)— 皆 Codex APPROVE + Playwright 實測上線。

## 你接手做事的鐵律(違背就停)
1. **改完不准沒實測說「修好了」**:`npx tsc --noEmit` → `npm run build` → `npx vite preview --port 4180` 從 root `/` 開 → Playwright 1080×1920 設假存檔(localStorage)→ click(540,1610) 進 game → 截圖。三者+證據缺一不可。
2. **你不能自審**:改完 `git add -A` 後 `git diff HEAD` 丟給 `gemini -p`(要 reviewer 第一行只回 `VERDICT: APPROVE` 才 commit)。連 3 次過不了就停下報 user。
3. **prod-build 禁忌**(build 過但 runtime crash):禁 `new Phaser.X`/`Phaser.Geom`/`Phaser.Math`/`instanceof Phaser`/無 arg `setTintFill()`。改用 `Math.hypot`/`setData`/container rect hit/`setTint(c).setTintMode(1)`,fill 閃完一定 `setTintMode(0)` 還原。
4. **5 玩法 lock 不准改**:廢土手繪 / 楓谷 7.56s cycle spawn / 楓谷 HitStop 手感 / 廢墟地形 / 直屏 1080×1920。
5. **重大不可逆**(刪 project / 真實付費 / store publish)停下等 user。push 是 auto-deploy 例行,可自行做。
6. 廢土 palette:炭黑#1a1612 / 髒黃#b08850 / 灰橙#a05a30 / 暖橙#ff8830 / 鏽紅#8b3a1f / 深綠#4a5d3a。禁鮮藍 / 螢光綠 / 純白。

## 下一步 backlog(由上往下做,挑最上面未劃掉的)
1. **[x] UI 直屏擁擠誤觸**(2026-05-30 完成)— 右側技能鈕+藥水列從貼邊 `VIEW_W-70` 內縮到右緣 46px margin(技能/藥水右對齊 1034)、底部 5 tab 間距 12→24px(`tabW-24`)、`VirtualJoystick` 排除底部 200px(避免點左下 tab 誤觸搖桿)。tsc+build+Codex APPROVE+Playwright 進遊戲截圖(右列內縮/tab 間距/天賦 tab 開 Talent)實測。
2. **[~] 留存深化**(QA⑥)— 每日簽到已做;**2026-05-30 加擊殺里程碑**(累積殺 100/500/1k/2.5k/5k/10k/25k/50k 領晶體 + 慶祝 toast,SaveService.killMilestoneIdx 一次結算積欠/舊存檔補發,晶體立即落盤,idx clamp 防篡改;Codex APPROVE 3 輪 + Playwright 99→101 驗 idx/crystal)。**2026-05-30 加週挑戰**(recurring):本週擊殺 300 隻領 30 晶體,每 7 天桶 floor(now/604800000)重置(SaveService.tickWeeklyChallenge,toast 慶祝,晶體立即落盤)。Codex APPROVE + Playwright 299→300/weekRewardClaimed/crystal+30 實測。留存三層:每日簽到 + 擊殺里程碑(永久)+ 週挑戰(recurring)。**2026-05-30 加週挑戰 HUD 進度條**:minimap 下方淺藍進度條顯示「週挑戰 N/300」,達標變金黃「已達成 ★」(SaveService.getWeekStatus read-only getter,每殺 updateWeekChallengeBar 刷新;WEEK_GOAL/WEEK_CRYSTAL 抽 module const 與結算共用避漂移)。Codex APPROVE(1 輪 clean)+ Playwright 實測 150→152 淺藍半滿 / claimed 金黃全滿。**仍待**:廢土主線串 quest(QA⑨)。
   ※ 註:2026-05-30 曾誤記「lastLoginClaimAt 沒保存」為 bug,已查證 SaveService line 168/223 有正確還原,**非 bug**(舊存檔沒領過才每次彈,正常)。
2.5 **[x] 廢土主線 quest 串接**(QA⑨,2026-05-30 完成)— 原本 quest 鏈只 3 段(q1 巨鼠 / q2 食人花 / q3 boss)。擴成 7 段廢土主線:q4 鏽巢清剿(rust_spider×8 乾井路)/ q5 爐心爬蟲(reactor_crawler×8 爐心門 +10💎)/ q6 焦土清剿(mutant_creeper×20 +15💎)/ q7 終章·巨鼠王再臨(boss×2 +30💎)。加 QuestDef.rewardCrystal 主線里程碑發晶體(premium 貨幣)。**先查證所有 targetMobId 都有 zone spawn**(避開沒生的 sentry_drone/rad_worm 否則卡死)。Codex APPROVE(1 輪 clean,還驗 q7 boss 殺50普通怪可重觸發)+ Playwright 端到端:q1-3 完成→clerk 出 q4;q1-4 完成+q5 滿→領獎 crystal 35→45(+10)/gold+280/自動推進 q6 實測。

3. **[ ] 第 4+ 隻真新怪 sprite 或怪的 2-frame 動畫**— pipeline ~3.5min/隻(見下「美術 pipeline」)。目前 3 隻真新怪是單張 wobble,可生 walk frame 做真動畫;或新增廢土飛蟲/變種狗/巨型蠍。
4. **[ ] 4c-5:6 張 painted 地圖**(GPT-4o)— 廢料鎮/乾井路/鏽蝕巷/爐心門等,目前是純色底。需專門 session 跑 pipeline(quota+慢+逐張接 bgKey),不適合長 loop 尾端硬跑。
5. **[x] 核心循環單一 → 精英怪系統**(2026-05-30 完成)— 8% mob 變精英(MobData.isElite,不污染共用 blueprint):1.5× scale / 金黃 0xffd040 tint / 3.5× HP / 4× 金幣+EXP / ×3 掉落機率 / spawn 金環+「精英怪出現」公告 / kill「精英擊破」+shake。給掛機加狩獵小目標。Codex APPROVE(2 輪,抓到 EXP 漏倍率)+ Playwright ELITE_CHANCE=1.0 實測金黃+大+公告+更肉。**增強(同日)**:小地圖精英=金黃大點(一眼可獵)+ 接觸傷害 ×1.6(肉+痛=真風險決策)。可續加:事件波/小目標任務。
6. **[x] 武器強化 UI**(2026-05-30 完成 — 修活死系統)— Explore 發現 weaponEnh 後端有但**從沒 UI**(enh 永遠 0)。Inventory 武器摘要下加「強化武器」按鈕:顯示 +enh/cost/持有金,點擊花金幣 +1(無上限)→ scene.restart 重繪。Codex APPROVE + Playwright 實測 +2→+3/gold -100/攻擊 13→14。
   **[x] 防具強化 armorEnh**(2026-05-30 完成 — 裝備進程系統完整)— SaveService armorEnh(ownedId→enh)+ getArmorEnh/addArmorEnh + ArmorService.effectiveDefense/armorEnhanceCost(鏡像武器)+ getTotalArmorDefense 套 effectiveDefense(減傷反映強化)+ Inventory openSlotPicker 加「⚒ 強化」row + equip frame 顯示「防 N +M」。Codex APPROVE + Playwright 防11→防13(+1)/gold-50/armorEnh persist 實測。**小尾巴**:賣/丟防具未清 armorEnh(微記憶體殘留,可接受,日後可在 removeOwnedArmor 順手刪)。
7. **[x] 金幣掉落 juice**(2026-05-30,楓谷爽感)— spawnGoldDrop 改枚數隨金額(boss/精英多枚噴發,cap 6);killMob 傳精英 ×4 金額。純視覺不影響經濟。Codex APPROVE。

做完一項:更新本檔(劃掉 + 補完成紀錄)→ commit/push → 一句話報告 user + live URL。

8. **[x] Boss 頂部 HP 血條**(2026-05-30 完成 — boss 戰深度)— 原本 boss 只有出現橫幅+震屏,**無持續血條**,玩家不知剩多少 HP。加頂部「☠ 廢料巨鼠王」紅色血條(player plate 下方 barY=150,depth 1400):boss spawn 建立 / update 每幀讀 boss mob.hp 刷新 fill 寬(rage 時轉鮮紅 0xff2020)/ 擊敗 destroyBossHpBar。create() reset 欄位防 scene restart stale ref。Codex APPROVE(1 輪 clean,逐一驗 boss死/玩家死/換地圖/restart 各路徑清除)+ Playwright 暫設 trigger=3 farm boss 實測血條出現/跨 10+ cycle 無 stacking/死亡後消失,還原 50 + 出貨版 smoke 0 error。

9. **[x] 註冊頁 / 登入頁**(2026-05-30 user 要求「像其他手遊直式遊戲要有註冊頁登入頁」)— 本地帳號系統(localStorage,無後端,Cloud Save 留 Phase 4d):`AccountService`(register/login/loginGuest/currentUser,密碼簡易 hash 僅避明文,所有 storage read/write/remove 都 try/catch guard)+ `Login` scene(廢土風 + DOM input 帳密 + 登入/註冊/訪客 三鈕)+ `Register` scene(帳號/密碼/確認密碼)。main.ts 加 `dom:{createContainer:true}`;Preloader 改 `isLoggedIn()?MainMenu:Login`(auto-login)。Codex APPROVE(3 輪:抓到「寫入失敗假成功」+「開機讀取路徑 crash」storage 健壯性,修完過)+ Playwright 全流程:Login 渲染/註冊建帳號→MainMenu/auto-login 跳過/登出回 Login/錯密碼擋下/對密碼登入/訪客試玩。**註**:帳號目前只 gate 進入,存檔仍共用單一 key(per-account 隔離留 Phase 4d)。

## 美術 pipeline(要生 sprite/地圖時)
在 `D:\Trash Epic`(非 git,跑 codex exec 要 `--skip-git-repo-check`):
1. `python -m automation.codex_imagegen --asset-id X --count 1 --prompt-file P.txt`(GPT-4o ~105s)
2. `python -m tools.image_pipeline.run_pipeline --skip-gate --skip-mirror "絕對路徑candidate_01.png"`(BiRefNet 去白底 ~84s)
3. cp 到 `public/assets/...` → `python scripts/compress_assets.py`(Pillow quantize 壓 ~16%)→ Preloader load + 接 MOB_BLUEPRINTS/MapService。
prompt 要點:top-down overhead、廢土 palette、純白底、isolated 易去背。單張 sprite 不 play frame anim,用 idle wobble tween,killMob 要 killTweensOf。

## 設計真相 doc
- `D:\Trash Epic\docs\design\v2\maplestory_systems_v2.md`(藥水/skin/地圖 spec)
- `D:\Trash Epic\docs\design\v2\visual_design_system.md`(UI design system)
- 大批視覺迭代可用 visual-iterate sub-agent。
