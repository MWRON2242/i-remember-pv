# HANDOFF · 交接说明

> 这份文件是给「上下文被截断后的新会话」看的。读它 + `README.md` + `ASSETS.md`，
> 就能接上，不需要任何对话历史。

---

## 一句话现状

**工程骨架、数据管线、出片流水线、资产接口、字体全部就绪并跑通；分镜/画面代码还没开始 —— 这是用户明确要求的边界。**

- 正片 `MainFilm`：占位卡（明写「分镜尚未开始」）+ 片尾署名/同人声明，全程带音频
- 自检片 `PipelineTest`：`out/skeleton.mp4`，12 秒，1080p30，渲染 30.7 秒
- `npm run check` 通过（2 条预期内的提醒：无资产、无分镜）
- `tsc --noEmit` 通过

---

## 二、已经做完并验证过的事

| 项 | 结果 |
|---|---|
| 工程 | `D:\deepseek工作区\i-remember-pv`，依赖从旧项目 `code-pv` 整包复制（Remotion 4.0.532 / React 18.3.1 / TS 5.9.3） |
| 音源 | 赵雷《我记得》，329.89 秒；网易云曲目 1974443814 时长一致 |
| 打点 | 768 拍 / 139.73 BPM / 192 小节 / 96 乐句 → `input/song.beats.json` |
| 歌词时间轴 | 47 句 + 18 行名单 → `input/lyrics.json`；首句 28.35s，末句 270.20s |
| 无人声区间 | 8 段：前奏 28.35s / 7.35s / 8.53s / 8.62s / 35.56s（157.4→193.0，最长的器乐段）/ 13.75s / 8.33s / 尾奏 59.69s |
| 字体 | Noto Sans SC 101 个 unicode-range 分片（4.29 MB）+ JetBrains Mono，全部本地 |
| 画幅 | 1920×1080 / 30fps（`input/film.json`） |
| 资产接口 | `public/assets/{bg,subject,fx,ui}` + `input/assets.json` + `tools/check-assets.mjs`（自解 PNG/JPEG 头，查尺寸与 alpha） |
| 流水线 | `check / beats / lyrics / fonts / assets / skeleton / delivery / sheet / verify / master / master-lite / 4k / all` |

---

## 三、铁律

1. **不要开始写分镜** —— 用户要和 DSH 一起讨论，一次只推 2~3 个镜头试验片。
2. **时间纯函数**：任何画面 = f(t)。随机必须走 `prng(n)`，禁止 `Math.random()` / `Date.now()`。
3. **数据入口唯一**：`src/lib/song.ts`。不要在组件里直接 import `input/*.json`。
4. **资产只走 id**：`has('bg.x')` / `assetPath('bg.x')`；缺图必须画 `MISSING: <id>` 占位块。
5. **改完跑 `npm run check`**，它会抓数据之间的矛盾。
6. **歌词原文只在本地**：`input/lyrics.lrc` 与 `lyrics.json` 已在 `.gitignore`。
7. **不要用官方音源做公开视频**（非商业、不盈利、不开激励、投转载）。

---

## 四、这次踩到的坑（都已验证）

| 坑 | 结论 |
|---|---|
| 系统 TEMP 对渲染进程不可写 | `ffmpeg` 写 `C:\Users\...\Temp` 会 Permission denied；所有临时文件固定写项目内 `.tmp-render/` |
| Remotion 自带的 ffmpeg 是精简版 | **没有 `rawvideo` 封装器**，也没有 `select`/`tile` 等滤镜；抽帧用 `-ss t -frames:v 1`，像素检查用 Node zlib 自解 PNG（见 `tools/verify-pixels.mjs`） |
| LRC 分类 | 名单里「Organ：赵雷」这种纯英文乐器名会漏判；正确做法是**歌词开始后一旦出现名单行，后面全部归名单** |
| LRC 与音频是否同版 | 抖机灵的对齐判据（中频起音投票）在密集鼓点上会被带跑，**不能当结论**；可靠证据是平台曲目时长 + 官方 LRC 首句时间 |
| 音频时长 vs 打点表 | `ffmpeg` 报 329.93、打点表 329.89，差 0.04 秒属容器帧对齐误差，容差设 0.15 秒 |
| 输出文件被占用 | Remotion 最后 rename 会 EPERM；`safeOutput()` 先探锁再换名 |
| `tsc` 报错位置 | 用 `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`，不要指望 `npx tsc` 在沙箱里顺 |

---

## 五、下一步（等用户给第一个分镜）

1. 用户给出「某句到某句」的画面描述 → 先做 2~3 个镜头试验片（每段 10~20 秒），不铺全片。
2. 试验片通过后，再写 `input/timeline.json`（段落 → 时间窗）与段落级场景组件。
3. 场景需要的新图，按 `ASSETS.md` 的规范要 Codex 出，`npm run assets` 体检后接入。
4. 全片定稿后再跑 `delivery` → `verify` → `sheet`；母版/4K 按需。

---

## 六、关键数字速查

```
音源时长   329.89 s（5:29.89）
首句人声   28.35 s   ← 前奏 28 秒，开片很长，分镜要单独设计
末句人声   270.20 s
段间最长器乐 157.40 → 192.96 s（35.56 s，副歌后大段留白）
尾奏       270.20 → 329.89 s（59.69 s）
BPM        139.73 · 768 拍 · 每拍 0.4294 s · 4 拍一小节
画幅       1920×1080 @ 30fps
帧数       正片 (329.89+6)×30 = 10077 帧
```
