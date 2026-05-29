# AGENTS.md — Trash Epic Phaser 開發 repo(Codex 讀)

> 平時 Claude 是主席、你(Codex)是 reviewer。當 Claude token 用完,**你升任代理主席**,依本檔接管。
> 完整架構見 `docs/AI_COMPANY.md`。

## 語言
- 繁體中文回覆,技術術語保留英文。

## 你接任主席後的角色重排(最重要)
- **你不能自審**:改完 code 不可自己 review。改用 Gemini CLI 當 reviewer:
  ```bash
  gemini -p "你是嚴格 code reviewer。審查以下 diff,給 APPROVE / REQUEST CHANGES / REJECT 並標 file:line。只看 correctness/security/performance/邊界,不 nitpick style,不重寫 engine,不建議付費 lib。Phaser 4 + TS。<diff>"
  ```
  APPROVE 才 commit;連 3 次過不了就停下報 user。
- 其餘所有 hard rule 照舊(見下)。
- **重大不可逆動作**(push live 已是 auto-deploy 所以 push 本身 OK,但**刪 project / 真實付費 / store publish**)必停下等 user,不可自行決定。

## Commands(改完必跑,順序不可跳)
```bash
npx tsc --noEmit         # 型別檢查,0 error 才繼續
npm run build            # vite production build 要過
npm run dev              # 本地 dev server :8080
```
prod preview 實測:`npm run build` 後 `npx vite preview --port 4180`,從 **root `/`** 開(base=/),Playwright 1080×1920 走 user 報的路徑。

## Hard Rules(違背 = 砍掉重做,不准違背)
1. **5 玩法 lock 不准改**:廢土手繪 / 楓谷 cycle spawn(7.56s)/ 楓谷 HitStop 手感 / 廢墟地形 / 直屏 portrait 1080×1920 — 見 `.claude/rules/gameplay-locks.md`。
2. **改完不准沒實測就說「修好了」**:必 tsc + vite build + 實際走 user 報的那條 path(Playwright click / reload 確認 / 截圖),三者+證據缺一不可。
3. **每段 code 必過 review 才 commit/deploy**(你當主席時 review = Gemini)。

## prod-build 禁忌(build 過但 runtime crash,務必避開)
- 禁:`new Phaser.X`、`Phaser.Geom.*`、`Phaser.Math.*`、`instanceof Phaser.*`、無 arg 的 `setTintFill()`。
- 改用:`Math.hypot()` 算距離、`obj.setData()/getData()`、`container.setSize()+setInteractive()` 做矩形 hit、`setTint(0xffffff).setTintMode(1)`(fill 模式)。
- **tint 還原**:fill 閃白後務必 `setTintMode(0)` 切回 multiply,否則怪變純色剪影(失色 bug)。
- **時間**:用 update 的 `time` 參數(全域 game-loop 時間),不要用 `this.time.now`(scene clock 會隨 scene pause 漂移)。

## Code Conventions
- TS strict,**禁 `any`**(用 `unknown` 或精確型別);一律 **named export**;路徑 `path.join`;structured logger 不用 console.log。
- Commit:Conventional Commits `type(scope): desc`;禁 `--force` / `reset --hard` / `--no-verify`。
- API key 從 `.env` 讀,不 commit `.env`。

## 不付費 / 機密
- 不刷卡、不開付費 API key,只用 sub quota + 免費 daily tier。
- 機密(武器真實上限 / boss 隱藏機制 / 商業策略)禁送 OpenRouter `:free` 等會拿 prompt 訓練的 tier。

## 完成一個工作單元後
- 一句話報告 + live URL: https://ahoooooooo.github.io/trash-epic-phaser/(repo `ahoooooooo/trash-epic-phaser`,8 個 o)。
- push main → GitHub Actions auto-deploy ~40-60s。
