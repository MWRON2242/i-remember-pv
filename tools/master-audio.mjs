/**
 * master-audio.mjs —— 把原曲做成可用母带（立体声，按帧处理）。
 *
 * 原曲实测：82 秒处 RMS −16 → −10.8（+5.3 dB 台阶）；从 82 秒起峰值钉在 1.000，
 * 全曲 400+ 个削平样本；4× 插值真峰值 1.003，超过 0dBFS。
 *
 * 处理（方案 B）：82–85 秒缓降 −2.5 dB；之后保持；再用前瞻峰值限幅压到 −2 dBTP 附近。
 */
import fs from 'node:fs';

const IN = 'out/_song.wav';
const OUT = 'public/audio/song-master.wav';

function readWav(path) {
  const buf = fs.readFileSync(path);
  let p = 12, off = -1, len = 0, ch = 2, sr = 48000;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = buf.readUInt16LE(p + 10); sr = buf.readUInt32LE(p + 12); }
    if (id === 'data') { off = p + 8; len = Math.min(size, buf.length - off); break; }
    p += 8 + size + (size % 2);
  }
  const total = Math.floor(len / 2); // 交错样本数
  const a = new Float32Array(total);
  for (let i = 0; i < total; i++) a[i] = buf.readInt16LE(off + i * 2) / 32768;
  return { sr, ch, frames: Math.floor(total / ch), a };
}

function writeWav(path, sr, ch, a) {
  const bytes = a.length * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + bytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(bytes, 40);
  for (let i = 0; i < a.length; i++) {
    const v = Math.max(-1, Math.min(1, a[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path, buf);
}

const src = readWav(IN);
const { sr, ch, frames } = src;
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

/* ---------- 1. 增益自动化 ---------- */
const DOWN = Math.pow(10, -2.5 / 20);
const y = new Float32Array(frames * ch);
for (let f = 0; f < frames; f++) {
  const t = f / sr;
  const g = t <= 82 ? 1 : t >= 85 ? DOWN : 1 + (DOWN - 1) * ((t - 82) / 3);
  for (let c = 0; c < ch; c++) y[f * ch + c] = src.a[f * ch + c] * g;
}

/* ---------- 2. 前瞻峰值限幅（按帧取两声道最大值） ---------- */
const CEIL = Math.pow(10, -2.2 / 20);
const LOOK = Math.round(0.01 * sr);

const framePeak = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  let m = 0;
  for (let c = 0; c < ch; c++) m = Math.max(m, Math.abs(y[f * ch + c]));
  framePeak[f] = m;
}

const maxAhead = new Float32Array(frames);
{
  const dq = [];
  for (let i = 0; i < frames; i++) {
    while (dq.length && framePeak[dq[dq.length - 1]] <= framePeak[i]) dq.pop();
    dq.push(i);
    while (dq[0] < i - LOOK) dq.shift();
    maxAhead[i] = framePeak[dq[0]];
  }
}

const gEnv = new Float32Array(frames);
const aUp = Math.exp(-1 / (0.12 * sr));
let g = 1;
for (let i = 0; i < frames; i++) {
  const ideal = maxAhead[i] > CEIL ? CEIL / maxAhead[i] : 1;
  g = ideal < g ? ideal : aUp * g + (1 - aUp) * ideal;
  gEnv[i] = g;
}

let peakBefore = 0, peakAfter = 0, reduced = 0;
const out = new Float32Array(frames * ch);
for (let f = 0; f < frames; f++) {
  const gg = gEnv[f];
  for (let c = 0; c < ch; c++) {
    const v = y[f * ch + c] * gg;
    out[f * ch + c] = v;
    peakAfter = Math.max(peakAfter, Math.abs(v));
    peakBefore = Math.max(peakBefore, Math.abs(y[f * ch + c]));
  }
  if (gg < 0.999) reduced++;
}

function truePeak(a, chN) {
  let tp = 0;
  for (let c = 0; c < chN; c++) {
    for (let i = 1; i < a.length / chN - 1; i++) {
      const x0 = a[(i - 1) * chN + c], x1 = a[i * chN + c], x2 = a[(i + 1) * chN + c];
      for (let k = 0; k < 4; k++) {
        const u = k / 4;
        const v = Math.abs(x1 + 0.5 * u * (x2 - x0) + 0.5 * u * u * (x2 - 2 * x1 + x0));
        if (v > tp) tp = v;
      }
    }
  }
  return tp;
}

fs.mkdirSync('public/audio', { recursive: true });
writeWav(OUT, sr, ch, out);

console.log(`时长 ${(frames / sr).toFixed(2)}s  声道 ${ch}  采样率 ${sr}`);
console.log(`限幅前峰值 ${peakBefore.toFixed(3)}（${db(peakBefore).toFixed(2)} dBFS）`);
console.log(`限幅后峰值 ${peakAfter.toFixed(3)}（${db(peakAfter).toFixed(2)} dBFS）`);
const tp = truePeak(out, ch);
console.log(`真峰值（4x） ${tp.toFixed(3)}（${db(tp).toFixed(2)} dBTP）`);
console.log(`限幅生效帧 ${reduced}（${((reduced / frames) * 100).toFixed(2)}%）`);
console.log(`写出 ${OUT}`);
