/* ============================================================================
 * parse-lrc.mjs — LRC 歌词表 → 权威时间轴 JSON
 * ----------------------------------------------------------------------------
 *   node tools/parse-lrc.mjs                      读 input/lyrics.lrc → input/lyrics.json
 *   node tools/parse-lrc.mjs --in x.lrc --out y.json
 *
 * 为什么要有这一步：
 *   分镜、歌词字幕、状态机触发点全都认「第几句歌词」而不是「第几秒」。
 *   把时间码收拢到一个文件里，将来换音源 / 换 LRC 只需重跑这条命令，
 *   剧本与代码一行都不用改。
 *
 * 产物结构（input/lyrics.json）：
 *   lines   逐句歌词（按时间升序，i 从 1 开始）
 *   credits 制作人员名单（LRC 尾部那几十行，不参与画面时间轴）
 *   gaps    无人声区间（近似：相邻两句间隔 > 阈值；首尾单独算）
 *
 * 版权注意：歌词原文只留在本地。input/lyrics.lrc 与 input/lyrics.json
 * 都在 .gitignore 里，不会进版本库。
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');

/* ------------------------------------------------------------------ 参数 */
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const IN = path.resolve(PROJ, arg('in', 'input/lyrics.lrc'));
const OUT = path.resolve(PROJ, arg('out', 'input/lyrics.json'));

/** 间隔超过这么多秒就算一段「无人声」 */
const GAP_THRESHOLD = Number(arg('gap', 6));

/** 制作人员行的特征词。命中就不进歌词时间轴。 */
const CREDIT_KEYS = [
  '作词', '作曲', '编曲', '制作', '监制', '出品', '吉他', '贝斯', '鼓',
  '钢琴', '打击乐', '口琴', '和声', '录音', '混音', '母带', '封面',
  '弦乐', '混音室', '录音室', '录音师', '混音师', '演奏', 'Program', 'Organ',
];

/* ------------------------------------------------------------------ 解析 */
const TIME_RE = /\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

function parseLrc(text) {
  const entries = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const stamps = [...line.matchAll(TIME_RE)];
    if (!stamps.length) continue;
    const content = line.replace(TIME_RE, '').trim();
    if (!content) continue;
    for (const m of stamps) {
      const mm = Number(m[1]);
      const ss = Number(String(m[2]).replace(':', '.'));
      entries.push({ t: mm * 60 + ss, text: content });
    }
  }
  entries.sort((a, b) => a.t - b.t);
  return entries;
}

function isCredit(text) {
  if (!/^.{1,10}：/.test(text)) return false;
  return CREDIT_KEYS.some((k) => text.includes(k));
}

function round(n, d = 3) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

/* -------------------------------------------------------------------- 主流程 */
if (!fs.existsSync(IN)) {
  console.error(`✘ 找不到 ${path.relative(PROJ, IN)}`);
  console.error('  请把带时间码的 .lrc 放到 input/lyrics.lrc 再跑这条命令。');
  process.exit(1);
}

const entries = parseLrc(fs.readFileSync(IN, 'utf8'));
if (!entries.length) {
  console.error('✘ 一行时间码都没解析出来，检查 LRC 格式（应为 [mm:ss.xx] 文本）');
  process.exit(1);
}

/* ---------------------------------------------------------------- 分类
 * 两个容易踩的坑：
 *   1. 开头的「作词：」「作曲：」也是名单格式，但它们出现在歌词之前 —— 
 *      所以不能一看到名单特征就切「名单模式」。
 *   2. 名单里有「Organ：赵雷」这种纯英文乐器名，靠关键词表会漏。
 *      正确做法：一旦歌词已经开始、又出现名单行，后面全部按名单处理。
 */
const titleEntry = entries[0];
const lyricEntries = [];
const credits = [];
let creditsMode = false;

for (const e of entries) {
  if (e === titleEntry) continue; // 第 0 行是「歌名 - 歌手」
  if (creditsMode || isCredit(e.text)) {
    credits.push({ t: round(e.t), text: e.text });
    creditsMode = lyricEntries.length > 0; // 歌词开始后进入名单区
  } else {
    lyricEntries.push({ t: round(e.t), text: e.text });
  }
}

/* 单调性校验：LRC 正常都是升序，出现倒退就是文件坏了 */
const problems = [];
for (let i = 1; i < lyricEntries.length; i++) {
  if (lyricEntries[i].t < lyricEntries[i - 1].t) {
    problems.push(`第 ${i + 1} 句时间倒退：${lyricEntries[i].t} < ${lyricEntries[i - 1].t}`);
  }
}

const lines = lyricEntries.map((e, idx) => ({ i: idx + 1, t: e.t, text: e.text }));
const firstVocal = lines.length ? lines[0].t : 0;
const lastVocal = lines.length ? lines[lines.length - 1].t : 0;

/* ---------------------------------------------------------------- 无人声区间 */
const gaps = [];
if (firstVocal > GAP_THRESHOLD) {
  gaps.push({ from: 0, to: firstVocal, len: round(firstVocal), kind: 'intro' });
}
for (let i = 1; i < lines.length; i++) {
  const len = lines[i].t - lines[i - 1].t;
  if (len > GAP_THRESHOLD) {
    gaps.push({
      from: lines[i - 1].t,
      to: lines[i].t,
      len: round(len),
      kind: 'between',
      afterLine: lines[i - 1].i,
    });
  }
}

/* 可选的音源总时长：优先取打点表，其次命令行 --duration */
let duration = null;
const beatsPath = path.join(PROJ, 'input', 'song.beats.json');
if (fs.existsSync(beatsPath)) {
  try {
    duration = JSON.parse(fs.readFileSync(beatsPath, 'utf8')).duration ?? null;
  } catch {
    /* 打点表还没生成或不完整，忽略 */
  }
}
if (!duration && arg('duration')) duration = Number(arg('duration'));
duration = duration ? round(duration) : null;

if (duration) {
  const tail = round(duration - lastVocal);
  if (tail > GAP_THRESHOLD) {
    gaps.push({ from: lastVocal, to: duration, len: tail, kind: 'outro', afterLine: lines[lines.length - 1]?.i });
  }
}

/* ------------------------------------------------------------------- 输出 */
const out = {
  _说明:
    '由 tools/parse-lrc.mjs 从 input/lyrics.lrc 生成，改时间码请改 LRC 再重跑，不要手改本文件。' +
    ' 本文件含歌词原文，受版权保护，已在 .gitignore 中排除。',
  source: path.relative(PROJ, IN).replace(/\\/g, '/'),
  generatedAt: new Date().toISOString(),
  duration,
  title: titleEntry.text,
  count: lines.length,
  firstVocalAt: firstVocal,
  lastVocalAt: lastVocal,
  lines,
  credits,
  gaps,
  summary: {
    lyricLines: lines.length,
    creditLines: credits.length,
    gapCount: gaps.length,
    longestGap: gaps.reduce((a, b) => (b.len > (a?.len ?? 0) ? b : a), null),
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

/* ------------------------------------------------------------------- 报告 */
console.log(`\n✔ 写入 ${path.relative(PROJ, OUT)}`);
console.log(`  ${out.title}`);
console.log(`  歌词 ${lines.length} 句 · 名单 ${credits.length} 行`);
console.log(`  首句人声 ${firstVocal.toFixed(2)} 秒 · 末句 ${lastVocal.toFixed(2)} 秒` + (duration ? ` · 音源 ${duration.toFixed(2)} 秒` : ''));
if (gaps.length) {
  console.log('\n  无人声区间（近似，按相邻句间隔推算）：');
  for (const g of gaps) {
    const tag = g.kind === 'intro' ? '前奏' : g.kind === 'outro' ? '尾奏' : `第 ${g.afterLine} 句后`;
    console.log(`    ${g.from.toFixed(2).padStart(7)} → ${g.to.toFixed(2).padStart(7)}  ${g.len.toFixed(2).padStart(6)} 秒  ${tag}`);
  }
}
if (problems.length) {
  console.log('\n⚠ 时间码有问题：');
  problems.forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('');
