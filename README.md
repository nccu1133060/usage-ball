# usage-ball

A two-row band above the Claude Code prompt. The right side shows your rate-limit usage. The left side has an orange ball that hops along your project's task track.

![usage-ball band: a task track with a sleeping orange ball on the left, 5h and 7d usage bars on the right](docs/screenshot.png)

> **Unofficial.** usage-ball is a fan-made mod. It is not affiliated with, endorsed by, or sponsored by Anthropic.

## What it shows

```
           zᶻ                                                  5h   ⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀  42% (2h13m)   [-]
  ✓━━━━✓━━━━●┄┄┄┄○┄┄┄┄○  2/5 Write tests · ctx ⣿⣿⣿⡇⣀  63%      7d   ⣿⣿⣀⣀⣀⣀⣀⣀⣀⣀  18% (4d6h)
```

**Usage (right, plus `ctx` on the left)**
- `5h` and `7d`: how much of your subscription's 5-hour and weekly windows you have used, with time until reset.
- `ctx`: how full this conversation's context window is.
- Bars are green below 50%, yellow from 50%, and red from the warning line. At the warning line the number turns into `⚠️ 9% left`, and the ⚠️ flashes for 3 seconds after each reply. Crossing the line also pops up one toast per window.
- Before the first reply, or on API-key logins with no rate-limit data, the band shows `—`.

**Progress (left)**
- The ball sits on the task you are working on. When a task is finished, it jumps to the next node. When the last task is finished, it bounces at the end with ✨.
- While Claude is waiting for you, the ball sleeps: `z`, then `zᶻ`, then `zᶻz`, settling on `zᶻ` after 10 seconds.
- Progress comes from the first source that has any:
  1. A `## 進度` (progress) checklist in `HANDOFF.md` at the folder where you started Claude Code:
     ```markdown
     ## 進度

     - [x] Task 1 Login page
     - [ ] Task 2 Write tests
     - [ ] Task 3 Release
     ```
  2. `## Task N` headings in `HANDOFF.md`. A task counts as done when its section has a `狀態：完成` (status: done) or `狀態：已合併` (status: merged) line, or when `docs/handoff-archive/` has a file named like `…task-N….md`.
  3. The task list Claude keeps in this conversation (TaskCreate / TaskUpdate / TodoWrite).
- With no source at all, a single ball sleeps next to `ctx`.

The band always stays two rows high. On narrow terminals it drops, in order: the task name, then shortens the bars, then the reset times, then the bars, until only the numbers are left.

The mod only reads numbers Claude Code already has and files in your project folder. It never makes network requests, calls a model, or spends tokens.

## Requirements

- A recent Claude Code with function-hook mods. Developed and tested on **Claude Code 2.1.289**, Windows 11, Windows Terminal.
- Rate-limit bars need a Claude subscription login. On API-key logins, only `ctx` has numbers.

## Install

In Claude Code:

```
/plugin marketplace add nccu1133060/usage-ball
/plugin install usage-ball@usage-ball
```

Or try it without installing, from a clone:

```
git clone https://github.com/nccu1133060/usage-ball
claude --plugin-dir ./usage-ball
```

## Settings

| Option | Default | Meaning |
| --- | --- | --- |
| `warnPercent` | `80` | Warning line for the 5h and 7d windows |
| `ctxWarnPercent` | `70` | Warning line for context. Lower, because Claude Code compacts long conversations |

Change them with `claude plugin configure usage-ball`, or in Claude Code's plugin settings.

## Known limits

- The glyphs (`⣿ ⡇ ⣀ ✓ ━ ┄ ● ○ ⚠️ ᶻ ✨`) were checked to be one cell wide in Windows Terminal. Other terminals or fonts may draw some of them wider, which shifts the alignment.
- `HANDOFF.md` is read from the folder where Claude Code started, after each reply.

## Development

```
claude plugin test .       # 51 tests
claude plugin validate .
tsc -p .                   # after the mod has loaded once, which writes .claude-plugin/types/
```

`DESIGN.md` is the visual spec. `PRODUCT.md` describes the product, and `docs/plan.md` the build plan.

## 繁體中文說明

usage-ball 是一個 Claude Code 外掛（mod）。它在輸入框上方加一條 2 行的橫幅：

- **右邊**：訂閱額度的 5 小時與每週用量，以及距離重置的時間。
- **左下 `ctx`**：這次對話的上下文用了幾成。
- **左邊**：一顆橘色小球，沿著專案的任務軌道往前跳。

用量低於 50% 是綠色，50% 以上是黃色，到警戒線（預設額度 80%、上下文 70%）變紅色，並顯示 `⚠️ 剩餘 %`。專案進度依序讀取：`HANDOFF.md` 的 `## 進度` 勾選框 → `## Task N` 標題加上 `狀態：完成` → 這次對話的任務清單。Claude 在等你回話時，小球會睡覺冒 Z。

安裝：在 Claude Code 輸入 `/plugin marketplace add nccu1133060/usage-ball`，再輸入 `/plugin install usage-ball@usage-ball`。

本專案為非官方粉絲作品，與 Anthropic 無關。

## License

[MIT](LICENSE)
