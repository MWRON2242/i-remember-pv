import fs from 'node:fs';

function readWav(path) {
  const buf = fs.readFileSync(path);
  let p = 12, dataOff = -1, dataLen = 0, ch = 2, sr = 48000;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = buf.readUInt16LE(p + 10); sr = buf.readUInt32LE(p + 12); }
    if (id === 'data') { dataOff = p + 8; dataLen = Math.min(size, buf.length - dataOff); break; }
    p += 8 + size + (size % 2);
  }
  const n = Math.floor(dataLen / (2 * ch));
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = buf.readInt16LE(dataOff + i * 2 * ch) / 32768;
  return { sr, n, a };
}

const path = process.argv[2] || 'out/_film.wav';
const w = readWav(path);
const sr = w.sr;
console.log(`文件 ${path}  ${(w.n / sr).toFixed(2)}s`);

// 每 5 秒桶：峰值 / RMS(dBFS) / 接近满刻度的样本数
const BUCKET = 5;
const rows = [];
for (let s = 0; s < w.n; s += BUCKET * sr) {
  const e = Math.min(w.n, s + BUCKET * sr);
  let peak = 0, sum = 0, hot = 0;
  for (let i = s; i < e; i++) {
    const v = Math.abs(w.a[i]);
    if (v > peak) peak = v;
    if (v > 0.97) hot++;
    sum += w.a[i] * w.a[i];
  }
  const rms = Math.sqrt(sum / (e - s));
  rows.push({ t: s / sr, peak, db: 20 * Math.log10(rms || 1e-9), hot });
}

console.log('\n时间   峰值    RMS(dBFS)  >0.97样本');
for (const r of rows) {
  if (r.t < 60 || r.t > 120) continue; // 只看出问题附近
  const flag = r.peak > 0.99 ? '  ← 削顶' : r.peak > 0.95 ? '  ← 偏高' : '';
  console.log(`${r.t.toFixed(0).padStart(4)}s  ${r.peak.toFixed(3)}  ${r.db.toFixed(1).padStart(7)}  ${String(r.hot).padStart(6)}${flag}`);
}

// 全片最响的 8 个 1 秒窗口
const W1 = [];
for (let s = 0; s + sr <= w.n; s += sr) {
  let peak = 0;
  for (let i = s; i < s + sr; i++) peak = Math.max(peak, Math.abs(w.a[i]));
  W1.push({ t: s / sr, peak });
}
W1.sort((a, b) => b.peak - a.peak);
console.log('\n全片最响的 8 个 1 秒窗口：');
for (const x of W1.slice(0, 8)) console.log(`  ${x.t.toFixed(0)}s  peak ${x.peak.toFixed(3)}`);

// 检查 83.2 附近是否有阶跃（接缝）
const c = Math.round(83.2 * sr);
let maxD = 0, at = 0;
for (let i = c - sr; i < c + sr; i++) {
  const d = Math.abs(w.a[i] - w.a[i - 1]);
  if (d > maxD) { maxD = d; at = i; }
}
console.log(`\n83.2s ±1s 内最大一阶差分 ${maxD.toFixed(4)} @ ${(at / sr).toFixed(3)}s`);
