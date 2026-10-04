# usage-ball 實作計畫

使用者已在 2026-10-04 核可產品與版面。視覺細節以 `DESIGN.md` 為準，產品事實以 `PRODUCT.md` 為準。本檔只寫技術做法與 TDD 步驟。

## 架構

```
Claude Code 引擎
  ├─ session.measure 事件 ──▶ hooks/usage/   （純函式：進度條、顏色、重置時間、警示）
  ├─ turn.complete 事件  ──▶ 警示頻閃、跨線提醒小框
  ├─ tool.call 事件（TaskCreate／TaskUpdate／TodoWrite）──▶ hooks/progress/ 任務清單來源
  ├─ $.fs 讀 HANDOFF.md、docs/handoff-archive/ ──▶ hooks/progress/ 計畫檔來源
  └─ ui.render AbovePrompt ──▶ hooks/band.tsx（組合左右兩區、依寬度收縮）──▶ 畫面 2 行
狀態：$.state（atom），合約在 types/index.d.ts
動畫計時：$.clock（測試用模擬時鐘推進）
```

## 檔案配置

| 檔案 | 內容 |
| --- | --- |
| `.claude-plugin/plugin.json` | 外掛資訊、`types`、`userConfig`：`warnPercent`（預設 80）、`ctxWarnPercent`（預設 70） |
| `hooks/hooks.json` | `{ "modules": ["./register.tsx"] }` |
| `hooks/register.tsx` | 只負責接事件，把資料寫進 atom；邏輯放在下面的純函式 |
| `hooks/band.tsx` | `ui.render` AbovePrompt：讀 atom，排出 2 行，依 `bodyColumns` 收縮 |
| `hooks/usage/format.ts` | 純函式：`brailleBar`、`levelColor`、`formatReset`、`usageRow` |
| `hooks/usage/alerts.ts` | 純函式：跨線偵測（每個 `resetsAt` 只跳一次）、頻閃時序 |
| `hooks/progress/parse.ts` | 純函式：解析 `HANDOFF.md`、封存資料夾檔名、任務清單 |
| `hooks/progress/track.ts` | 純函式：軌道字串、小球位置、空中層、睡覺／慶祝畫面 |
| `types/index.d.ts` | `PluginState['usage-ball']` 合約 |
| `**/*.test.ts(x)` | 與被測檔案放在一起 |

純函式的單元測試直接 `import` 被測檔案；串接事件與畫面的測試，用 `claude-code/testing` 的 `mount`（surface 一律迴圈跑 `['terminal', 'desktop']`）和模擬時鐘。

## 指令

- 局部：`claude plugin test hooks/usage`（這個指令跑整個資料夾）；或暫時只放當前測試檔。
- 全套：`claude plugin test .`
- 外掛檢查：`claude plugin validate .`
- 型別檢查：mod 載入過後才有 `tsc -p .`。如果 `.claude-plugin/types/` 不存在，就標「型別檢查未跑」，由 Claude 在審查時補跑。

## Task 1：額度區（右區＋左區 ctx）

先做出完整的 2 行橫幅骨架。這個階段左區只有 ctx：第 2 行的開頭畫 `ctx ⣿⣿⣿⡄⣀ 63%`。

TDD 依序一次做一個行為（每項都是：寫一個失敗測試 → 跑它看到紅 → 最小實作 → 綠 → 重構）：

1. `brailleBar(42, 10)` → `⣿⣿⣿⣿⡇⣀⣀⣀⣀⣀`；0%、100%、四捨五入到半格的邊界值。
2. `levelColor(p, warn)`：低於 50 → `success`；50 到 warn → `warning`；達到 warn 以上 → `error`。
3. `formatReset(resetsAt, now)`：`(42m)`、`(2h13m)`、`(4d6h)`；沒有 `resetsAt` 時回傳同寬空白。
4. `usageRow`：標籤補到 3 格、百分比補到 4 格並靠右；超過警戒線時變成 `⚠️ 9% left`；沒有數字時顯示 `—`。
5. `session.measure` 把 5h（`five_hour`）、7d（`seven_day`）、ctx 寫進 atom；其他 `kind` 忽略。
6. 畫面：AbovePrompt 輸出 2 行，右區貼齊右邊界、左右兩區之間至少 5 格；`hasSurvey` 時讓位。
7. 寬度收縮：依 DESIGN §7 的順序（這個階段沒有任務名稱，從第 2 步開始）。
8. 進度條長上去：數字變動時，每 100ms 前進 1 個半格，最長 1 秒（模擬時鐘）。
9. 警示頻閃：`turn.complete` 後，超過警戒線的那項 ⚠️ 每 250ms 切換一次、共 3 秒，隱藏時用同寬空白。
10. 跨線提醒小框：跨線時呼叫 `$.ui.toast` 一次；同一個 `resetsAt` 不重複；記錄存在 `$.state`。
11. `userConfig`：`test(name, { options: { warnPercent: 60 } })` 時，警戒線跟著改。

## Task 2：小球進度（左區）

1. `parse.ts`：有 `## 進度` 勾選框時，用勾選框算出 `{done, total, current}`。
2. 沒有勾選框時：數 `## Task N` 標題，`狀態：完成` 算完成；`docs/handoff-archive/*task-N*.md` 的封存檔也算完成，並列入總數（用 Task 編號去除重複）。
3. 都沒有時：用本次對話的任務清單（`tool.call` 的 TaskCreate／TaskUpdate／TodoWrite 結果）。
4. 讀檔時機：`session.start`、每次 `turn.complete`，以及 `FileChanged` 事件（如果有提供）。檔案不存在時當作沒有資料，不可拋錯。
5. `track.ts`：軌道字串，每兩個節點之間 4 格；超過 8 項縮成 2 格；超過 16 項時用視窗加 `…`。
6. 任務名稱：去掉 `Task N：` 前綴，超過 24 格就截斷加 `…`；ctx 接在後面，用 ` · ` 分隔。
7. 跳躍動畫：完成數增加時，依 DESIGN §6.4 的 4 格畫面播放；一次增加多項時連續跳。
8. 睡覺：`isWorking` 為 false 或沒有資料時，在空中層冒 `z`／`zᶻ`／`zᶻz`，每 1 秒換一格，10 秒後停在 `zᶻ`；`isWorking` 轉 true 時醒來。
9. 全部完成：在終點彈 3 下（每下 300ms），出現 `✨` 2 秒後消失，接著進入睡覺。
10. 寬度收縮第 1 步：最先隱藏任務名稱。

## 已知風險

- Codex 的隔離環境可能跑不了 `claude plugin test`（需要 Claude Code 程式和它的設定資料夾）。跑不動時，在施工欄標註，改由 Claude 代跑；不要因此改用其他測試框架。
- `FileChanged` 事件不一定提供；如果沒有，就只靠 `turn.complete` 重新讀檔。
