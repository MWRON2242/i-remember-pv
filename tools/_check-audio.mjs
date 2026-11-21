import fs from 'node:fs';

const buf = fs.readFileSync('out/_film157.wav');
// 找 data chunk
let p = 12;
let dataOff = -1;
let dataLen = 0;
let ch = 2;
let sr = 48000;
while (p + 8 <= buf.length) {
  const id = buf.toString('ascii', p, p + 4);
  const size = buf.readUInt32LE(p + 4);
  if (id === 'fmt ') {
    ch = buf.readUInt16LE(p + 10);
    sr = buf.readUInt32LE(p + 12);
  }
  if (id === 'data') {
    dataOff = p + 8;
    dataLen = Math.min(size, buf.length - dataOff);
    break;
  }
  p += 8 + size + (size % 2);
}
if (dataOff < 0) throw new Error('no data chunk');

const nFrames = Math.floor(dataLen / (2 * ch));
const readL = (i) => buf.readInt16LE(dataOff + i * 2 * ch) / 32768;

// 全片峰值
let peak = 0;
let peakAt = 0;
let clipped = 0;
for (let i = 0; i < nFrames; i++) {
  const v = readL(i);
  const a = Math.abs(v);
  if (a > peak) { peak = a; peakAt = i / sr; }
  if (a > 0.999) clipped++;
}

// 接缝处的瞬态：一阶差分最大值
const joins = [28.367, 48.433, 83.283, 110.767, 138.383];
const report = joins.map((j) => {
  const c = Math.round(j * sr);
  const w = Math.round(0.05 * sr);
  let maxD = 0, at = 0;
  for (let i = Math.max(1, c - w); i < Math.min(nFrames, c + w); i++) {
    const d = Math.abs(readL(i) - readL(i - 1));
    if (d > maxD) { maxD = d; at = (i - c) / sr; }
  }
  return { join: j, maxDelta: +maxD.toFixed(4), offsetMs: +(at * 1000).toFixed(1) };
});

// 全片一阶差分的中位数与 99 分位，用于对比
const diffs = [];
for (let i = 1; i < nFrames; i += 7) diffs.push(Math.abs(readL(i) - readL(i - 1)));
diffs.sort((a, b) => a - b);
const med = diffs[Math.floor(diffs.length * 0.5)];
const p99 = diffs[Math.floor(diffs.length * 0.99)];

console.log(`采样率 ${sr}  声道 ${ch}  时长 ${(nFrames / sr).toFixed(2)}s`);
console.log(`全片峰值 ${peak.toFixed(4)} @ ${peakAt.toFixed(2)}s，削顶样本 ${clipped}`);
console.log(`一阶差分 中位 ${med.toFixed(5)} / 99分位 ${p99.toFixed(5)}`);
console.log('接缝瞬态：');
for (const r of report) console.log(`  ${r.join.toFixed(3)}s  maxΔ ${r.maxDelta}  (相对接缝 ${r.offsetMs} ms)`);
