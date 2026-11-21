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

const film = readWav('out/_film157.wav');
const song = readWav('out/_song.wav');
const sr = 48000;

const cuts = [0, 28.367, 48.4, 83.2, 110.667, 138.233, 157.0];
console.log('时间      窗口RMS(片/曲)    相关系数   最佳对齐偏移');
for (const c of cuts) {
  const w = Math.round(0.08 * sr);
  const c0 = Math.round(c * sr);
  // 在 ±40ms 内找最佳对齐
  let best = { r: -2, off: 0 };
  for (let off = -Math.round(0.04 * sr); off <= Math.round(0.04 * sr); off += 4) {
    let sxy = 0, sxx = 0, syy = 0, sx = 0, sy = 0, n = 0;
    for (let i = c0 - w; i < c0 + w; i++) {
      const j = i + off;
      if (i < 0 || j < 0 || i >= film.n || j >= song.n) continue;
      const x = film.a[i], y = song.a[j];
      sxy += x * y; sxx += x * x; syy += y * y; sx += x; sy += y; n++;
    }
    if (n < 100) continue;
    const cov = sxy / n - (sx / n) * (sy / n);
    const vx = sxx / n - (sx / n) ** 2;
    const vy = syy / n - (sy / n) ** 2;
    const r = cov / Math.sqrt(vx * vy || 1e-12);
    if (r > best.r) best = { r, off };
  }
  // 该窗口的 RMS 比
  let ef = 0, es = 0, n = 0;
  for (let i = c0 - w; i < c0 + w; i++) {
    const j = i + best.off;
    if (i < 0 || j < 0 || i >= film.n || j >= song.n) continue;
    ef += film.a[i] ** 2; es += song.a[j] ** 2; n++;
  }
  const rf = Math.sqrt(ef / n), rs = Math.sqrt(es / n);
  console.log(
    `${c.toFixed(3).padStart(7)}  ${rf.toFixed(4)} / ${rs.toFixed(4)}  = ${(rf / (rs || 1)).toFixed(3)}   r=${best.r.toFixed(4)}  ${(best.off / sr * 1000).toFixed(1)}ms`
  );
}
