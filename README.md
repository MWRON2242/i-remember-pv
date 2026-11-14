# 《我记得》AI 语境重构音乐 PV

用「AI 与人对话」的语境重拍赵雷《我记得》：把轮回换成不断新开的对话窗口，把行李换成用户被迫重新粘贴的上下文。
画面全部由代码逐帧生成（Remotion + React + TypeScript），美术资产由 Codex 分层出图。

> **当前状态**：工程骨架 + 数据管线 + 出片流水线已就绪，**分镜尚未开始**。
> 正片 `MainFilm` 现在渲染的是「分镜未定」占位卡 + 片尾署名。
> 12 秒工程自检片见 `out/skeleton.mp4`。

---

## 快速开始

```bash
npm run dev          # Remotion Studio，实时预览
npm run check        # 数据自检（音源 / 打点 / 歌词 / 字体 / 资产 / 分镜）
npm run skeleton     # 出 12 秒工程自检片 → out/skeleton.mp4
npm run delivery     # 出交付版 → out/pv.mp4
npm run assets       # 资产体检（Codex 的图进来后必跑）
```

完整命令见 `tools/build.mjs` 头部注释：`beats` / `lyrics` / `fonts` / `assets` / `skeleton` / `delivery` / `sheet` / `verify` / `master` / `master-lite` / `4k` / `all`。

---

## 目录结构

```
input/                 数据源（大部分是「改这里，不用碰代码」）
  film.json            画幅、帧率、音源路径、片尾署名
  lyrics.lrc           带时间码的歌词（不入库，版权）
  lyrics.json          ← tools/parse-lrc.mjs 生成（不入库）
  song.beats.json      ← tools/auto-beats.mjs 生成：768 拍 / 139.73 BPM
  assets.json          Codex 资产登记表
  timeline.json        （分镜定稿后才有）
  song.mp3             音源（不入库）
public/
  audio/song.mp3       渲染时真正读的音频（Remotion 的 staticFile 只认 public/）
  assets/{bg,subject,fx,ui}/   Codex 的分层图（不入库）
  fonts/               内置字体：Noto Sans SC 101 分片 + JetBrains Mono
src/
  Root.tsx             「影片登记处」：Composition 注册
  MainFilm.tsx         正片（当前为占位卡 + 片尾署名）
  PipelineTest.tsx     工程自检片（时间码 / 打点 / 歌词轴 / 字体样张）
  lib/song.ts          全片唯一数据入口
  lib/beats.ts         卡点工具（纯函数，全部只看 t）
  lib/fonts.tsx        本地字体加载 + delayRender 守卫
  lib/theme.ts         颜色令牌与字体栈
  lib/assets.ts        资产清单的代码侧入口（img(id) / has(id)）
tools/                 流水线脚本（全部零依赖，用 Remotion 自带 ffmpeg）
out/                   渲染产物（不入库）
ASSETS.md              给 Codex 的资产规范
docs/HANDOFF.md        交接说明（上下文截断后先读这个）
```

---

## 数据契约（换歌 / 换图 / 换分镜都不用改代码）

| 文件 | 谁生成 | 谁消费 | 说明 |
|---|---|---|---|
| `input/film.json` | 手写 | `lib/song.ts` | 画幅、fps、音源、片尾署名 |
| `input/song.beats.json` | `build.mjs beats` | `lib/song.ts` | 拍点 / BPM / 段落（固定文件名，换歌只换这个文件） |
| `input/lyrics.json` | `build.mjs lyrics` | `lib/song.ts` | 逐句时间码 + 无人声区间 |
| `input/assets.json` | Codex 登记 | `lib/assets.ts` | id → 文件、图层、尺寸 |
| `input/timeline.json` | 分镜定稿后手写 | 场景组件 | 段落 → 时间窗、镜头、参数 |

---

## 技术约定（写代码前先看这几条）

1. **时间纯函数**：给定 `t`（秒）必须唯一确定那一帧。禁止在组件里读 `Math.random()`、`Date.now()`、外部状态。
2. **确定性随机**：需要随机就用 `lib/beats.ts` 的 `prng(n)`（固定种子）。
3. **字体本地化**：字体文件在 `public/fonts/`，`lib/fonts.tsx` 用 `delayRender` 等它真正可用才截帧。改了字体跑 `npm run fonts`。
4. **临时目录在项目内**：`.tmp-render/`。系统 TEMP 在本机对渲染进程不可写（实测 Permission denied），不要写回去。
5. **输出文件占用**：`build.mjs` 用 `safeOutput()` 探锁换名，避免 Remotion 最后 rename 时 EPERM 白渲染一场。渲染前别在播放器里开着 `out/pv.mp4`。
6. **缺资产必须显形**：`has(id)` 为假时画占位块并写 `MISSING: <id>`，不许静默。

---

## 已核实的事实（2026-11 基线）

| 项 | 值 |
|---|---|
| 音源 | 赵雷《我记得》，329.89 秒（网易云曲目 1974443814，时长一致） |
| 前奏 | **28 秒纯器乐**，首句人声 28.35 秒 |
| 打点 | 768 拍 / 139.73 BPM / 192 小节 / 96 乐句 |
| 歌词 | 47 句，末句 270.20 秒；无人声区间 8 段（最长：前奏 28.35s、乐器段 35.56s、尾奏 59.69s） |
| 画幅 | 1920×1080 / 30fps |
| 自检片 | 12 秒 360 帧，渲染用时 30.7 秒（12 核 / 16G） |
| 字体 | Noto Sans SC（101 分片，4.29 MB）+ JetBrains Mono |

> LRC 时间基准已用两种方式确认：平台曲目时长一致（329.89s），官方 LRC 首句 28.15s 与本地 28.35s 同版。
> `tools/audio-profile.mjs` 的自动对齐判据在密集伴奏上不可靠，只当辅助。

---

## 版权

本片为非商业同人创作，不盈利、不开启平台激励、按转载处理。
音源为正式发行录音，**不进入版本库**（`.gitignore` 已排除 `public/audio/`、`input/*.mp3`、`input/lyrics.lrc`、`input/lyrics.json`）。
将来若公开，需替换为自编音源：只需重跑 `beats` 与 `lyrics`，场景代码一行不改。
