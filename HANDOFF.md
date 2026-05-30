# 接力棒 HANDOFF — Codex 接手就讀這個

> **觸發**:user 說「幫我繼續下去 / 繼續 / 接手」→ 你(Codex)就以代理主席身分,讀本檔挑最上面那個未完成項目開始做。
> 規則全在 `AGENTS.md`(同目錄,你已自動讀到)。完整架構 `docs/AI_COMPANY.md`。
> **這份檔案 Claude 每次收工會更新**;你做完一個項目也要更新它(把完成的劃掉、補新狀態),下一棒才接得上。

---

## 現在狀態(2026-05-30)
- 專案:`D:\TrashEpic_Phaser`(Phaser 4 + TS + Vite),live https://ahoooooooo.github.io/trash-epic-phaser/(repo `ahoooooooo/trash-epic-phaser`,8 個 o)。
- push main → GitHub Actions auto-deploy ~40-60s。
- Phase 4c 程式 roadmap + user 6 大需求 A-F + 變現 + FTUE + 每日簽到 + 主動技能 + 4 隻真新怪 sprite + 10 特色天賦 **全部已完成上線**。
- build 狀態:綠(tsc 0 error / vite build 過 / live 200)。
- 最近(本 session):**夥伴(familiar)被動效果系統**(backlog #14)— 14 隻 familiar 原本純收集無戰鬥效果,現各補 ONE 個被動 effect(方向照 design 角色,rarity 階梯)+ 出戰機制 + 戰鬥套用 + 夥伴頁出戰 UI。Codex APPROVE + Playwright 實測 HP 1280→1430 + 出戰/切換/卸下/owned-lock 全驗。commit 38c80a9 上線。

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

3. **[x] 第 4 隻真新怪 sprite — 廢土巨蠍**(Phase 4c-20,2026-05-30 完成)— GPT-4o(154s,一次過零 retry)+ BiRefNet(72s)生鏽蝕金屬巨蠍(雙鉗+尾刺+八腳俯視,廢土 palette),壓成 palette PNG 562KB(對齊其他 mob)。MOB_BLUEPRINTS idx 12 `rust_scorpion`(type Insect,hp320/dmg34/exp40/gold24,scale0.16,加入單幀 wobble 清單)。新增**鏽蝕沙坑 sand_pit**(field lv40-90,一圖一怪只 spawn idx12)鏡像 creeper_vale,從乾井路雙向 portal + WorldMap node/edge。tsc+build+Codex APPROVE(零 critical)+ Playwright 進沙坑實測多隻巨蠍 spawn 整圖只有蠍。**仍可續**:怪的 2-frame walk 真動畫(目前 4 隻真新怪都單張 wobble);或再生廢土飛蟲/變種狗。
4. **[x] 4c-5:6 張 painted 地圖**(GPT-4o,2026-05-30 完成)— 廢料鎮/毒花谷/乾井路/鏽蝕沙坑/鏽蝕巷/爐心門 各生專屬 top-down painted 底(取代純色/共用底)。整合:MapConfig 加 `bgKey?: string`,8 圖各設,Game.ts bg 選擇改 `bgKey ?? (town?guild:wasteland)` fallback(沒設的不破圖),Preloader load 6 張。圖壓到 768×1152 ~770KB。Codex APPROVE + Playwright 實測 scrap_town(鏽鐵棚屋鎮)/sand_pit(鏽橙沙坑)/core_gate(反應爐輻射綠)各自專屬底正確鋪上。8 張地圖全有 painted 底了。
5. **[x] 核心循環單一 → 精英怪系統**(2026-05-30 完成)— 8% mob 變精英(MobData.isElite,不污染共用 blueprint):1.5× scale / 金黃 0xffd040 tint / 3.5× HP / 4× 金幣+EXP / ×3 掉落機率 / spawn 金環+「精英怪出現」公告 / kill「精英擊破」+shake。給掛機加狩獵小目標。Codex APPROVE(2 輪,抓到 EXP 漏倍率)+ Playwright ELITE_CHANCE=1.0 實測金黃+大+公告+更肉。**增強(同日)**:小地圖精英=金黃大點(一眼可獵)+ 接觸傷害 ×1.6(肉+痛=真風險決策)。可續加:事件波/小目標任務。
6. **[x] 武器強化 UI**(2026-05-30 完成 — 修活死系統)— Explore 發現 weaponEnh 後端有但**從沒 UI**(enh 永遠 0)。Inventory 武器摘要下加「強化武器」按鈕:顯示 +enh/cost/持有金,點擊花金幣 +1(無上限)→ scene.restart 重繪。Codex APPROVE + Playwright 實測 +2→+3/gold -100/攻擊 13→14。
   **[x] 防具強化 armorEnh**(2026-05-30 完成 — 裝備進程系統完整)— SaveService armorEnh(ownedId→enh)+ getArmorEnh/addArmorEnh + ArmorService.effectiveDefense/armorEnhanceCost(鏡像武器)+ getTotalArmorDefense 套 effectiveDefense(減傷反映強化)+ Inventory openSlotPicker 加「⚒ 強化」row + equip frame 顯示「防 N +M」。Codex APPROVE + Playwright 防11→防13(+1)/gold-50/armorEnh persist 實測。**小尾巴**:賣/丟防具未清 armorEnh(微記憶體殘留,可接受,日後可在 removeOwnedArmor 順手刪)。
7. **[x] 金幣掉落 juice**(2026-05-30,楓谷爽感)— spawnGoldDrop 改枚數隨金額(boss/精英多枚噴發,cap 6);killMob 傳精英 ×4 金額。純視覺不影響經濟。Codex APPROVE。

做完一項:更新本檔(劃掉 + 補完成紀錄)→ commit/push → 一句話報告 user + live URL。

8. **[x] Boss 頂部 HP 血條**(2026-05-30 完成 — boss 戰深度)— 原本 boss 只有出現橫幅+震屏,**無持續血條**,玩家不知剩多少 HP。加頂部「☠ 廢料巨鼠王」紅色血條(player plate 下方 barY=150,depth 1400):boss spawn 建立 / update 每幀讀 boss mob.hp 刷新 fill 寬(rage 時轉鮮紅 0xff2020)/ 擊敗 destroyBossHpBar。create() reset 欄位防 scene restart stale ref。Codex APPROVE(1 輪 clean,逐一驗 boss死/玩家死/換地圖/restart 各路徑清除)+ Playwright 暫設 trigger=3 farm boss 實測血條出現/跨 10+ cycle 無 stacking/死亡後消失,還原 50 + 出貨版 smoke 0 error。

9. **[x] 註冊頁 / 登入頁**(2026-05-30 user 要求「像其他手遊直式遊戲要有註冊頁登入頁」)— 本地帳號系統(localStorage,無後端,Cloud Save 留 Phase 4d):`AccountService`(register/login/loginGuest/currentUser,密碼簡易 hash 僅避明文,所有 storage read/write/remove 都 try/catch guard)+ `Login` scene(廢土風 + DOM input 帳密 + 登入/註冊/訪客 三鈕)+ `Register` scene(帳號/密碼/確認密碼)。main.ts 加 `dom:{createContainer:true}`;Preloader 改 `isLoggedIn()?MainMenu:Login`(auto-login)。Codex APPROVE(3 輪:抓到「寫入失敗假成功」+「開機讀取路徑 crash」storage 健壯性,修完過)+ Playwright 全流程:Login 渲染/註冊建帳號→MainMenu/auto-login 跳過/登出回 Login/錯密碼擋下/對密碼登入/訪客試玩。**註**:帳號目前只 gate 進入,存檔仍共用單一 key(per-account 隔離留 Phase 4d)。

10. **[x] 一圖一怪真正做到**(2026-05-30 user 指出沒做到)— 查證起始圖 wasteland_outskirts spawn idxs 是 `[0,11]`=巨鼠+食人花(**2 種,違反**)。修:wasteland 改 `[0]` 純巨鼠 + 新增獨立 field 圖 `creeper_vale`(毒花谷)`[11]` 純食人花 + 雙向 portal + WorldMap 節點/邊 + q2/q6 描述改指毒花谷。現 4 戰鬥圖各一怪:廢土外圍=巨鼠 / 毒花谷=食人花 / 乾井路=機械蜘蛛 / 爐心門=輻射機甲蟲。Codex APPROVE + Playwright 實測兩圖各自只見對應怪。

11. **[x] 登入/註冊頁美感升級**(2026-05-30 user「要有美感 現在完全沒有」)— visual-iterate agent 迭代 3 輪:新增 `authUi.ts` 共用 helper(廢土背景+vignette+暖光、厚重多層標題、鏽蝕金屬卡+鉚釘、鏽橙 header 牌、發光 CTA、DOM input focus 發光、裝飾 decals)+ rewrite `Login.ts`(加主角立繪 hero)+ `Register.ts`。廢土 palette 嚴守。Codex APPROVE + Playwright 註冊/登入/錯密碼/訪客全流程實測沒破壞 + live 確認上線。commit 7fc1feb。

12. **[x] 裝備頁重設計 + 裝備種類擴充**(2026-05-30 user「裝備頁也要重新設計 更精美 裝備的種類也要設計」)— **A 種類擴充** `ArmorService.ts`:每部位 base 名 4-5→8-10 個(廢土風:鉛襯/骨製/輪胎/管線/焊接/防化/廢核…);新增 optional `ArmorDef.bonus`(ArmorBonus stat hp/atk/crit/dodge + value,tier 越高機率帶 TIER_BONUS_CHANCE N10%→SSR100%,generateRandomArmor roll);純顯示用**不接 maxHP HUD**;新 export armorBonusLabel/armorBonusColor;effectiveDefense/armorEnhanceCost/armorDisplayName/各既有 export 不破壞;optional 欄位向後相容舊存檔。**B 裝備頁** `Inventory.ts`:paper-doll 中央改正面立繪 `player_portrait`(fallback player_idle)+ 框→立繪連線(graphics,已裝 rarity 亮線/空槽暗線)+ 底座暖橙光暈;裝備框雙層鏽蝕框 + rarity 邊框(N灰/R藍/SR紫/SSR金)+ 部位 icon 名牌 + 鉚釘 + bonus 標籤 + 空槽「＋ 空」;摘要面板加「套裝加成」總計列(已裝 bonus 依 stat 加總,顯示用)。既有互動全保留(picker/裝/卸/強化/返回/attack+totalDef)。tsc 0 error + build 過 + Codex APPROVE(1 輪 clean,確認 optional bonus 相容 getTotalArmorDefense + 無 forbidden Phaser pattern)+ Playwright 端到端:進裝備頁截圖(立繪+連線+rarity框+bonus 標籤)→點頭盔框開 picker(顯示卸下/強化/SSR暴擊+5%金框/R閃避+3%藍框)→換裝 R 頭盔→總防禦 79→60、套裝加成即時更新實測。

13. **[x] Boss 尾巴橫掃 telegraph 招式**(2026-05-30,backlog 清完後從 design doc 02_boss_giantrat.md 挑「設計已定未實作」招式)— 廢料巨鼠原本只碰撞+rage,設計的「尾巴橫掃 大範圍 telegraph」未實作。加:玩家靠近時 boss 出鏽紅預警圈(windup 950ms 跟著 boss)→ 結算 contactDamage×2 範圍 AoE,玩家可在 windup 走出躲開(技巧表現),rage 時冷卻減半。狀態機 windup→resolve→cooldown;create/handleBossDefeated/boss死於windup 各路徑清 ring 防洩漏;takeDamage 尊重 i-frame。Codex APPROVE(1 輪 clean)+ Playwright 暫設 trigger=3 farm boss 實測預警弧出現+boss 傷害提升(level60 被打死/level300 存活)+無 crash,還原 50。

14. **[x] 夥伴(familiar)被動效果系統**(2026-05-30,「設計已定未實作」缺口 — 14 隻 familiar 純收集無戰鬥效果,整個 gacha/夥伴 loop 純裝飾)— 逐讀 docs/design/v2/16~28_familiar_*.md 取每隻角色定位,各定 ONE 個被動 effect(`FamiliarEffect={stat,value,label}`,stat 為 TalentBuff 數值欄位,方向嚴格照 design,數值 rarity 階梯 R<SR<SSR<UR):pip 撿取範圍+15% / mira 掉落+8% / grub 最大HP+150 / zix 金幣+10% / neek 傷害+5% / dorl 減傷+4% / fire_imp 傷害+10% / ironguard 減傷+8% / frost_witch 暴擊率+6% / axe_brothers 攻速+12% / blackmarket_fox 金幣+30% / prophet 傷害+18% / shadow_hunter 暴擊率+12% / appraisal_queen 掉落+25%。SaveService 加 `activeFamiliarId`(forward-compat merge + owned 守門 setter,只允許已擁有出戰、null 卸下);`computeTalentBuff()` 摺進 active familiar effect(TalentService import FAMILIAR_POOL,無循環依賴),戰鬥 9 處讀 buff 自動吃到。Gacha 夥伴頁加出戰收藏區(已擁有可點出戰 / 出戰中高亮 / 卸下 / owned-only / 未擁有鎖 / effect.label 顯示);不破壞 doPull/showResults。Codex APPROVE(1 輪 clean,確認 owned 雙守門 / 無循環 / forward-compat / TS 健全 / 無 forbidden Phaser pattern)+ Playwright prod-preview 實測:出戰 maxHpFlat+150 夥伴後 HUD HP 1280→1430(buff 真套到戰鬥)+ 點 fire_imp 出戰切換 + 卸下回 null + 未擁有鎖,全驗。commit 38c80a9。

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
