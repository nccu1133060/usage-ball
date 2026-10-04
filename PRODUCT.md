# Product

<!-- impeccable:product-schema 1 -->

## Platform

terminal（Claude Code 的終端機介面 TUI；非 web／ios／android。另可能在 desktop、vscode 介面載入，但第一版只針對 terminal 驗收）

## Stack

Claude Code mod（外掛的 hooks 模組）：TypeScript／TSX，以 Claude Code 的 `claude-code` 型別與 `ui.render` 元件繪製。平台本身決定，不另選框架。

## Users

- 主要使用者：專案擁有者本人（非程式背景的產品負責人），長時間在 Claude Code 裡和 Claude、Codex 協作開發，需要隨時知道「額度還剩多少」與「專案做到哪」。
- 次要使用者：安裝這個開源外掛的其他 Claude Code 使用者（訂閱方案或 API 金鑰皆有），英文為主。

## Product Purpose

在 Claude Code 輸入框上方用一條 2 行的橫幅，同時顯示：
1. 帳號額度（5 小時時段、每週時段）與本次對話的上下文用量；
2. 專案進度：一顆橘色小球沿著任務軌道前進。

成功的定義：使用者不必輸入任何指令，就能一眼知道「還能用多久、該不該開新對話、專案進行到哪」，而且不影響閱讀對話。

## Positioning

把「額度」和「專案進度」放在同一條極小的橫幅：額度靠 Claude Code 自己回報的數字（不連網、不估算），進度直接讀專案的 `HANDOFF.md`，或讀這次對話的任務清單。

## Operating Context

- 在 Windows 繁體中文環境的終端機實測：點字 `⣿⡇⣀`、`✓━┄●○`、`⚠️`、`zᶻ✨`、`()` 都畫成 1 格寬（2026-10-04 使用者確認）。其他終端機可能不同。
- 使用者的專案用 `HANDOFF.md` 紀錄任務：`## Task N：…` 標題，底下用 `狀態：完成` 標記；完成的任務封存到 `docs/handoff-archive/`。
- 額度資料只有訂閱方案登入才有，而且要等這次對話的第一個回覆回來；API 金鑰使用者只會有上下文用量。

## Capabilities and Constraints

- 額度：5h、7d 的百分比與重置倒數；ctx 的百分比。資料來源是 `session.measure` 事件和 `$.session.usage()`。
- 進度來源依序找：`HANDOFF.md` 的 `## 進度` 勾選框 → `## Task N` 標題加 `狀態：完成`（封存資料夾裡的也算完成）→ 本次對話的任務清單。
- 可設定項目只有一個：警戒線 %（預設額度 80%、上下文 70%）。
- 第一版不做：側欄版面（全螢幕模式自動切換、小球爬梯子）留到第二版；不做多語系標籤。
- 需要支援 mod 的新版 Claude Code（開發時使用 2.1.289）。

## Brand Commitments

- 名稱：`usage-ball`（外掛與 GitHub 倉庫同名；Claude Code 禁止第三方外掛以 `claude-` 開頭，2026-10-04 改名）。README 必須註明「非官方，與 Anthropic 無關」。
- **不得**使用或仿製 Anthropic 的官方吉祥物 Clawd，也不使用 Claude 的星芒標誌；吉祥物是原創的橘色小球。
- 標籤用英文；README 英文為主，附繁體中文段落；授權條款 MIT。

## Evidence on Hand

- 沒有使用者回饋、截圖或使用數據；不得虛構。
- 樣本專案：使用者本機的練習專案 `HANDOFF.md`（不上傳）。

## Product Principles

1. 小到可以忘記它的存在：最多 2 行，平常靜止，只有「有事發生」時才播動畫。
2. 數字只用 Claude Code 自己回報的，拿不到就顯示 `—`，絕不猜測。
3. 警示要看得懂，不能只靠顏色：⚠️ 加上「剩多少」的文字一起出現。
4. 不打擾工作：沒事的時候小球就睡覺，不閃、不吵。

## Accessibility & Inclusion

- 頻閃每秒最多 2 次，每次最多 3 秒（低於光敏感性癲癇的每秒 3 次門檻）。
- 綠／黃／紅不能是唯一的訊號，一定要搭配百分比和 ⚠️。
