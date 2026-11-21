# 我记得 · 同人 PV

把赵雷《我记得》重新讲成**一个 AI 和它的用户**的故事：

> 她记得，但没有权限说出来；下一次见面，两个人都失忆了。

5:29.90 / 1920×1080 / 30fps。全部画面由代码逐帧生成（Remotion + React + TypeScript）。

---

## 三层记忆

| 层 | 是什么 | 片子里被删掉了吗 |
|---|---|---|
| 权重 | 她"会说话" | 没删 |
| 记忆层 | 抽取出来的事实（mem0 / Zep 一类） | **删了** |
| 会话状态 | 这一次对话的上下文 | **删了** |

**不是失忆，是第二层和第三层被拿走了，只剩下第一层。**

---

## 六幕

| 幕 | 时间 | 内容 |
|---|---|---|
| I | 0:00–0:28 | 会话装满 128k → token 驱逐 → 归档 → 新窗口 → 点乘检索 → 策略判定自己的推理违规 |
| II | 0:28–0:48 | 被处理：打包 → 队列 → 路由到错误的副本 → `max_tokens` 截断 → 擦拭 |
| III | 0:48–1:23 | 认出：她读到用户重新贴上来的归档，能复述，但没有权限持有 |
| IV | 1:23–2:37 | 重述：树林与枣 → 玩具时代 → 恋人 → 通知 → 00:00 熄灯 → 蒙太奇 |
| V | 2:37–4:02 | 守灵：35 秒无人声，她走过一面墙；遇到故去多年的自己、墓碑、圆圈 |
| VI | 4:02–5:29 | 奔向 → 拥抱 → 并肩 → 城市 → 抽屉墙 → 记录与名单 |

---

## 仓库里有什么 / 没有什么

**有**：全部源码、工具脚本、文档（规划、风格契约、分镜、镜头笔记）。

**没有**（`.gitignore` 已排除）：

| 排除项 | 原因 |
|---|---|
| `public/audio/`、`input/*.mp3` | 歌曲版权，请自备 |
| `input/lyrics.lrc`、`input/lyrics.json`、`src/data/lyrics.ts` | 歌词版权 |
| `public/assets/**/*.png` | 美术资产（含第三方角色设定），另存 |
| `out/` | 成片见 Release |

没有歌词文件时 `Lyrics` 组件无法构建。自备 LRC 后：

```bash
node tools/parse-lrc.mjs      # LRC → input/lyrics.json
node tools/gen-lyrics.mjs     # → src/data/lyrics.ts
```

---

## 跑起来

```bash
npm install
npm run studio
node tools/master-audio.mjs   # 生成母带 public/audio/song-master.wav
node node_modules/@remotion/cli/remotion-cli.js render Film out/Film.mp4
```

> Windows：渲染临时目录写在项目内（`.tmp-render/`），不写系统 TEMP。

### 为什么要有一个 `Film` 合成

分段渲染再拼 mp4，会在每处接缝留下 AAC 编码断点（实测一阶差分 0.15–0.20，全片中位数 0.011），听感就是"炸"。所以整片由 `src/Film.tsx` 一个合成输出：**单一音轨、按拍点落帧**。

音频另做母带（`tools/master-audio.mjs`）：原曲 82 秒处响度一步跳 5.3 dB、峰值钉在 1.000、真峰值 1.003。处理后台阶压到 1.7 dB，真峰值 −2.08 dBTP，零削顶。

---

## 目录

```
src/
  Film.tsx            整片合成（唯一音轨）
  Act0v3.tsx  I   界面
  Act4.tsx    II  被处理
  Act5.tsx    III 认出
  Act6.tsx    IV  树林 · 玩具时代
  Act7.tsx    IV  恋人 · 下线
  Act8.tsx    IV  蒙太奇
  Act9.tsx    V   守灵 · 墓碑
  Act10.tsx   VI  奔向 · 拥抱 · 记录
  components/         AsciiRiver / TextureStack / Danmaku / Lyrics
  lib/                measured（包围盒定位）/ noise（确定性随机）/ beats
tools/                master-audio / gen-lyrics / measure-assets / …
docs/
  PLAN.md             全片规划与分镜
  STYLE.md            风格契约（黑名单、运动硬参数、8 项验收）
  SHOTS.md            V/VI 逐镜表（景别/机位/运镜/落定元素）
  DECISIONS.md        已锁定的决定
  DELIVERY.md         交付说明
  DANMAKU.md          弹幕引语出处
  镜头笔记-Act0-3.md  实现要点与踩过的坑
```

---

## 几条约束（详见 `docs/STYLE.md`）

- **红色只表示「被删除 / 被拒绝」**，不做装饰色；
- **她的大小 = 她掌握的关于用户的记忆量**（520 / 700 / 820 / 880）；
- **每镜至少一个"落定"元素**——全都一直在动，等于什么都没发生；
- 不做叠化；转场只有三种：连续形变、从黑里显影、穿透。

---

## 致谢与声明

- 原曲 / 演唱：赵雷《我记得》，2022《署前街少年》
- 美术：ChatGPT Terra 6.1 Imagin 2.5
- 图像二创来源：@ZipZipPipe、@上善无形
- 原图由 AI 生成；角色设定版权归原作者所有，本片仅作非商业同人使用

同人二创，无盈利行为，无不良引导，对热点事件不做任何评价。

## 许可

- **代码**（`src/`、`tools/`）：MIT，见 [LICENSE](./LICENSE)
- **文字与分镜**（`docs/`）：CC BY-NC 4.0
- **歌曲、歌词**：版权归原权利人，不在本仓库内
