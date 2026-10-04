# usage-ball（Codex）

- 先讀 `HANDOFF.md` 中指派給你的 Task 區塊，只改它的「檔案範圍」。
- 視覺規格以 `DESIGN.md` 為準，技術計畫以 `docs/plan.md` 為準；介面說明在 `docs/plugin-api/`，`claude-code.d.ts` 用 grep 查，不要整份讀。
- 依 TDD 一次做一個行為：先寫一個失敗測試並跑它看到紅 → 最小實作 → 綠 → 重構。
- 測試：`claude plugin test <資料夾>`（局部）、`claude plugin test .`（全套）；檢查：`claude plugin validate .`。指令跑不動時，在施工欄寫明錯誤，不要換成其他測試框架。
- 只修改檔案，不提交、不推送。
- 不得使用或仿製 Anthropic 的官方吉祥物與標誌。
