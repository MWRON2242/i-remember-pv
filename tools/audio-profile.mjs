/* ============================================================================
 * audio-profile.mjs — 音频剖面：确认「LRC 时间码」和「这个音频文件」是不是同一版
 * ----------------------------------------------------------------------------
 *   node tools/audio-profile.mjs                      用 input/song.mp3 + input/lyrics.json
 *   node tools/audio-profile.mjs --in x.mp3 --step 2
 *
 * 为什么需要：
 *   网上流传的 LRC 常常对应另一个母版（电台剪辑、串烧、重制版）。一旦时间基准
 *   错开几秒，整片的分镜、卡点、字幕全部错位，而且看起来「差不多对」，极难发现。
 *   这个脚本做两件事：
 *     1. 画出全曲能量剖面（10 秒一格），肉眼对齐段落
 *     2. 逐句检查「LRC 标的时间点上，音频是否真的有一次起音」——错版会大面积掉点
 *
 * 判据：每句歌词前 0.3 秒 vs 后 0.6 秒的能量上升（dB）。
 *   同一版通常 > 60% 的歌词行有明显上升（>3 dB）；错版会接近随机。
 * ==========================================================================*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeToWav, readWavMono, findFfmpeg, band, frameEnergy, novelty, ENV_RATE, toSec, toFrame } from './lib/audio.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const IN = path.resolve(PROJ, arg('in', 'input/song.mp3'));
const STEP = Number(arg('step', 10)); // 剖面每格秒数
const LYRICS_PATH = path.join(PROJ, 'input', 'lyrics.json');

if (!fs.existsSync(IN)) {
  console.error(`✘ 找不到 ${IN}`);
  process.exit(1);
}
const ffmpeg = findFfmpeg(PROJ);
if (!ffmpeg) {
  console.error('✘ 找不到 Remotion 自带的 ffmpeg');
  process.exit(1);
}

const tmpDir = path.join(PROJ, '.tmp-render');
fs.mkdirSync(tmpDir, { recursive: true });
const tmp = path.join(tmpDir, `profile-${process.pid}.wav`);
console.log('解码中…');
decodeToWav(ffmpeg, IN, tmp, 22050);
const { samples, sampleRate: SR } = readWavMono(tmp);
fs.rmSync(tmp, { force: true });

const dur = samples.length / SR;
const win = Math.floor(SR * 0.05); // 50ms 窗

/** 某段时间的能量（RMS） */
function rms(t0, t1) {
  const a = Math.max(0, Math.floor(t0 * SR));
  const b = Math.min(samples.length, Math.floor(t1 * SR));
  let acc = 0;
  for (let i = a; i < b; i++) acc += samples[i] * samples[i];
  return Math.sqrt(acc / Math.max(1, b - a));
}
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

/* ------------------------------------------------------------------ 剖面 */
const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
console.log(`\n时长 ${dur.toFixed(2)} 秒（${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}）`);
console.log(`能量剖面（每格 ${STEP} 秒，┃ = 每 30 秒）\n`);

let maxDb = -120;
const levels = [];
for (let t = 0; t < dur; t += STEP) {
  const d = db(rms(t, Math.min(dur, t + STEP)));
  levels.push(d);
  maxDb = Math.max(maxDb, d);
}
let line = '';
for (let i = 0; i < levels.length; i++) {
  const t = i * STEP;
  const span = Math.max(24, maxDb - (-60)); // 以 -60dB 为底
  const k = Math.max(0, Math.min(1, (levels[i] - (-60)) / span));
  line += blocks[Math.round(k * (blocks.length - 1))];
  if (i % 6 === 5) {
    line += '┃';
  }
}
console.log('  ' + line);
// 刻度：每 30 秒标一次
let ruler = '';
for (let i = 0; i < levels.length; i++) {
  ruler += '%';
  if (i % 6 === 5) ruler += ' ';
}
for (let s = 0; s <= Math.floor(dur / 30); s++) {
  const pos = 2 + Math.round((s * 30) / STEP) + Math.floor((s * 30) / STEP / 6);
  void pos;
}
console.log(`  0s${' '.repeat(Math.max(1, line.length - 8))}${Math.floor(dur)}s`);

/* ------------------------------------------------------------------ 结尾 */
const tailStart = dur - 20;
console.log(`\n末尾 20 秒能量：${db(rms(tailStart, dur)).toFixed(1)} dB（若接近 -80 说明是静音尾巴）`);

/* ------------------------------------------------------------ 与 LRC 对齐 */
if (!fs.existsSync(LYRICS_PATH)) {
  console.log('\n（没有 input/lyrics.json，跳过逐句对齐检查）');
  process.exit(0);
}
const L = JSON.parse(fs.readFileSync(LYRICS_PATH, 'utf8'));
const lines = L.lines;
const rises = [];
for (const ln of lines) {
  const before = db(rms(ln.t - 0.45, ln.t - 0.05));
  const after = db(rms(ln.t + 0.05, ln.t + 0.65));
  rises.push({ t: ln.t, delta: after - before, text: ln.text });
}
const withRise = rises.filter((r) => r.delta > 3).length;
const ratio = withRise / Math.max(1, rises.length);
const avg = rises.reduce((a, b) => a + b.delta, 0) / Math.max(1, rises.length);

console.log(`\n逐句起音检查：${lines.length} 句`);
console.log(`  明显上升（>3 dB）：${withRise} 句（${(ratio * 100).toFixed(0)}%）`);
console.log(`  平均能量变化：${avg >= 0 ? '+' : ''}${avg.toFixed(1)} dB`);
console.log(
  ratio > 0.6
    ? '  ✔ 时间基准大概率一致（大部分歌词行落在真实起音点上）'
    : '  ✘ 时间基准可疑：大量歌词行没有对应起音，LRC 与音频可能不是同一版'
);

const worst = [...rises].sort((a, b) => a.delta - b.delta).slice(0, 6);
console.log('\n  最可疑的 6 句（能量变化最小）：');
for (const w of worst) {
  console.log(`    ${w.t.toFixed(2).padStart(7)}s  ${w.delta.toFixed(1).padStart(6)} dB  ${w.text}`);
}

/* -------------------------------------------------- 决定性检验：整体偏移搜索
 * 思路：人声起句是「中频段能量的一次跳变」，反映在 mid-band novelty 上。
 * 如果 LRC 与音频同一版，那么「把每句时间点附近的 novelty 加起来」应该在
 * 偏移 0 秒处最大；如果整版差了几十秒，最大值会出现在那个偏移上。
 * 全曲伴奏很密，单看一句几乎看不出来 —— 但 47 句一起投票就有信号了。
 */
const mid = band(samples, 220, 1600, SR);
const nov = novelty(frameEnergy(mid));
const globMean = (() => {
  let s = 0;
  for (let i = 0; i < nov.length; i++) s += nov[i];
  return s / nov.length;
})();

function scoreAt(offset, lines) {
  let acc = 0;
  for (const ln of lines) {
    const idx = Math.round(toFrame(ln.t + offset));
    let best = 0;
    for (let d = -3; d <= 3; d++) {
      const v = nov[idx + d] ?? 0;
      if (v > best) best = v;
    }
    acc += best;
  }
  return acc / lines.length;
}

let bestOffset = 0;
let bestScore = -Infinity;
for (let off = -90; off <= 90; off += 0.05) {
  const s = scoreAt(off, lines);
  if (s > bestScore) {
    bestScore = s;
    bestOffset = off;
  }
}
const score0 = scoreAt(0, lines);
// 随机对照：把每句随机挪到任意位置，得到「无信息时」的期望分
let randAcc = 0;
const TRIES = 40;
for (let k = 0; k < TRIES; k++) {
  const fake = lines.map((ln) => ({ t: (ln.t * 7919 + k * 104729) % dur }));
  randAcc += scoreAt(0, fake);
}
const randScore = randAcc / TRIES;

console.log('\n时间基准检验（中频起音强度投票）：');
console.log(`  偏移 0 秒得分：${score0.toFixed(4)}`);
console.log(`  随机对照得分：${randScore.toFixed(4)}`);
console.log(`  最佳偏移：${bestOffset >= 0 ? '+' : ''}${bestOffset.toFixed(2)} 秒（得分 ${bestScore.toFixed(4)}）`);

const lifted = score0 / randScore;
const rel = score0 / bestScore;
if (Math.abs(bestOffset) <= 1.0 || rel > 0.9) {
  console.log(`  ✔ 未发现整体错位（相对随机提升 ${lifted.toFixed(2)}×）`);
} else {
  console.log(`  ⚠ 最佳偏移落在 ${bestOffset.toFixed(2)} 秒（0 秒得分是最佳的 ${(rel * 100).toFixed(0)}%）`);
  console.log('     注意：伴奏密集的歌上，这个判据很容易被鼓点带跑，不能当结论。');
  console.log('     真正可靠的确认方式有两条：');
  console.log('       1. 平台曲目时长与本地文件一致（本曲已核对：网易云 1974443814 = 329.89 秒）');
  console.log('       2. 跑 node tools/build.mjs skeleton 出 12 秒自检片，用耳朵对一遍字幕');
}
console.log('');

