# Trash Epic — AI 公司架構 + Codex 接班主席機制

> 唯一真相:本檔定義誰做什麼、token 用完怎麼接班。雙保險存檔(git 永久 + memory 快取)。
> 最後更新 2026-05-30。研究來源:DeepWiki `openai/codex` 全 wiki + 本機 codex-cli 0.130.0 實測。

---

## 1. 組織圖(平時:Claude 當主席)

```
                    ┌──────────────────────────┐
   User(youhao)──→ │  主席 CHAIRMAN            │  方向(1 句話)/ 重大不可逆 yes-no
   不寫 code        │  Claude Opus 4.8 (Max 5x) │
   不挑選項         │  寫所有 Phaser/TS 主代碼  │
                    └──────────┬───────────────┘
                               │ 委派
        ┌──────────────┬───────┴────────┬──────────────────┐
        ▼              ▼                ▼                  ▼
 ┌────────────┐ ┌────────────┐  ┌──────────────┐  ┌────────────────┐
 │ REVIEWER   │ │ COUNCIL    │  │ RESEARCH     │  │ CHEAP LABOR    │
 │ Codex      │ │ Gemini     │  │ DeepWiki/    │  │ 5 API key      │
 │ gpt-5.5    │ │ 2.5 Pro    │  │ GitHub MCP   │  │ NIM/HF/Groq/   │
 │ 每段 code  │ │ 第二意見   │  │ Repomix/     │  │ GAIStudio/GHM  │
 │ 必審 APPROVE│ │ council    │  │ GitIngest    │  │ 翻譯/標註/     │
 │ 才 commit  │ │ design QA  │  │ 真工具挖 repo│  │ boilerplate    │
 └────────────┘ └────────────┘  └──────────────┘  └────────────────┘
   不寫主代碼     不寫主代碼                          絕不寫主代碼
```

| 角色 | 身分 | 職責 | 紅線 |
|---|---|---|---|
| **主席** | Claude Opus 4.8 (Max 5x sub) | 寫全部 Phaser/TS 主代碼、build/deploy、拍小決策、跑 sprite pipeline | — |
| **Reviewer** | Codex gpt-5.5 (`mcp__codex__codex`) | 每段 code 必審 APPROVE/REQUEST CHANGES/REJECT | 不寫主代碼 |
| **Council** | Gemini 2.5 Pro (`mcp__gemini__gemini`) | 第二意見、design QA、翻譯 | 不寫主代碼 |
| **Research** | DeepWiki / GitHub MCP / Repomix / GitIngest | 挖 GitHub repo 用法(不用 WebSearch) | — |
| **Cheap Labor** | NIM/HF/Groq/Google AI Studio/GitHub Models | 翻譯/標註/throwaway script | 絕不寫主代碼、機密禁送 free-train tier |

---

## 2. 接班機制:Claude token 用完 → Codex 升任代理主席

### 2.1 為什麼可行(實測證實 2026-05-30)

codex-cli **0.130.0** 已具備全部主席能力:

| 能力 | 指令 / 機制 | 實測 |
|---|---|---|
| 非互動自主執行 | `codex exec "<prompt>"` | ✅ |
| 跨輪續跑(長任務 loop) | `codex exec resume --last "<next>"` / `resume <id>` | ✅ (rollout JSONL persistence) |
| 讀同一套規則 | `project_doc_fallback_filenames` 含 `CLAUDE.md` + 本 repo `AGENTS.md` | ✅ 答對第一條 Hard Rule |
| 全自主無人值守 | `-s workspace-write -c approval_policy="never"` | ✅ |
| 機器可讀輸出 | `--json` (JSONL events) + `-o last_message.md` | ✅ |
| 自帶長期記憶 | `~/.codex/memories/`(MEMORY.md + memory_summary.md 兩階段 consolidation) | ✅ |
| 呼叫工具 | MCP(playwright/deepwiki) + shell `gemini -p` | ✅ |
| 指定工作目錄 | `--cd <DIR>` / `--add-dir` | ✅ |

### 2.2 接班後的角色重排(關鍵差異)

Codex **不能自審自己寫的 code**(球員兼裁判)。所以接班後:

```
平時:  Claude 寫 → Codex 審 → Gemini 第二意見
接班後:Codex 寫 → Gemini 審(`gemini -p`)→（必要時）NIM council 第三意見
```

- **Reviewer 換成 Gemini CLI**(`gemini -p`,已裝 0.41.2)
- Codex 維持其餘所有 hard rules(5 玩法 lock / must-test / 不付費 / 機密保密)
- 重大不可逆動作(push live / 刪檔 / 真實付費)Codex **照樣停下等 user**,不可自行決定

### 2.3 接班觸發與啟動

**觸發條件**:Claude 回報 quota 將盡 / session 中斷 / user 明令「換 Codex 接手」。

**啟動指令**(user 在任何終端機貼一行即可):
```bash
python "D:/Trash Epic/automation/codex_chairman.py"            # 接續最近 backlog,自動 loop
python "D:/Trash Epic/automation/codex_chairman.py --once"     # 只做一個工作單元
python "D:/Trash Epic/automation/codex_chairman.py --task '修 X bug'"  # 指定任務
```

driver 內部對每個工作單元跑:
```
codex exec --cd D:/TrashEpic_Phaser --skip-git-repo-check \
  -s workspace-write -c approval_policy="never" --json -o last_message.md \
  -p chairman "<工作單元 prompt>"
→ 解析 last_message.md → 跑 npx tsc / vite build → Gemini review → commit/push
→ codex exec resume --last "<下一個單元>"  # 跨輪續跑
```

---

## 3. 治理規則(主席無論是誰都遵守)

1. **5 玩法 lock 不准改**(廢土手繪 / 楓谷 cycle spawn / 楓谷 HitStop / 廢墟地形 / 直屏)— `.claude/rules/gameplay-locks.md`
2. **每段 code 必過 review** 才 commit/deploy(Claude→Codex 審;Codex→Gemini 審)
3. **改完不准沒實測說「修好了」**(tsc + vite build + 本地 prod preview Playwright 走 user 路徑 + 證據)— `.claude/rules/must-test-before-claim-fixed.md`
4. **prod-build 禁忌**(build 過但 runtime crash):`new Phaser.X` / `Phaser.Geom` / `Phaser.Math` / `instanceof Phaser` / 無 arg 的 `setTintFill()`。改用 `Math.hypot` / `setData` / container rect hit / `setTint(c).setTintMode(1)`
5. **不刷卡 / 不付費新 API key**,只用 sub quota + 免費 daily tier
6. **機密**(武器真實上限 / boss 隱藏機制 / 商業策略)禁送 OpenRouter `:free` 等 train-prompt tier
7. **重大不可逆**(刪 project / 真實付費 / push live / store publish)必 user yes-no
8. **User 不做事**:不開 IDE / 不寫 code / 不挑選項;小決策主席自己拍

---

## 4. 檔案地圖

| 檔 | 用途 |
|---|---|
| `D:/TrashEpic_Phaser/AGENTS.md` | Codex 在開發 repo 的主席規則(本機讀) |
| `D:/Trash Epic/AGENTS.md` | Codex 在設計 repo 的規則 |
| `D:/Trash Epic/automation/codex_chairman.py` | 接班 driver(exec + resume loop + Gemini review) |
| `~/.codex/config.toml` | `[profiles.chairman]` + Phaser repo trust |
| `~/.codex/memories/` | Codex 自帶長期記憶 |
| `~/.claude/projects/D--Trash-Epic/memory/` | Claude 記憶(Codex 接班時亦可讀) |

---

## 5. 研究紀錄:Codex CLI 0.130.0 重點(DeepWiki openai/codex)

- **`codex exec`**:positional prompt 或 stdin;`-` 讀 stdin;`--json` 出 JSONL;`-o/--output-last-message` 寫最終訊息;`--output-schema` 限定 JSON 形狀;`--ephemeral` 不落地;`-C/--cd` 工作根;`--add-dir` 加可寫目錄;`--skip-git-repo-check` 非 git 目錄必加。
- **sandbox**:`read-only`(預設)/ `workspace-write`(可寫不可連網)/ `danger-full-access`。
- **approval_policy**:`untrusted` / `on-request` / `on-failure`(deprecated)/ `never`(全自動唯一選擇)。
- **resume/fork**:`codex exec resume --last|<id> "<prompt>"` 跨 invocation 續同一 session;rollout 以 JSONL persist 於 `~/.codex/sessions`,resume 時 replay 重建狀態。
- **config profiles**:`[profiles.NAME]` 群組 model/sandbox/approval/reasoning,`-p NAME` 或 `profile="NAME"` 啟用。
- **projects trust**:`[projects."<path>"] trust_level="trusted"`,非 trusted 且非 git 會拒跑(除非 `--skip-git-repo-check`)。
- **AGENTS.md**:repo 任意層皆可放,越深越優先;直接 system/developer/user 指令 > AGENTS.md;預設讀上限 `project_doc_max_bytes`(本機設 65536)。
- **memories**:`~/.codex/memories/`,`memory_summary.md`(永遠載入系統 prompt,須 v1 開頭)+ `MEMORY.md`(handbook)+ `rollout_summaries/*`;兩階段 consolidation(prune → INIT/INCREMENTAL),自動蒸餾 user 偏好 / 決策觸發 / 失敗護盾。
- **MCP client**:`[mcp_servers.NAME]` stdio(command/args/env/cwd)或 http(url/bearer_token_env_var);per-tool `approval_mode` auto/prompt/approve;`codex mcp add|list` 管理。本機已接 playwright / deepwiki / context7 / openaiDeveloperDocs / node_repl。
- **其他子命令**:`codex review`(非互動 code review)、`codex mcp`、`codex mcp-server`(Codex 自己當 MCP server,即 Claude 用的 `mcp__codex__codex` 來源)、`codex apply`(把 diff git apply 回工作樹)。
