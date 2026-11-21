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

const film = readWav('out/_film.wav');
const song = readWav('out/_song.wav');
const sr = 48000;

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
console.log('秒   原曲RMS   成片RMS   差(dB)   原曲峰值  成片峰值');
for (let s = 76; s <= 92; s++) {
  const c = Math.round(s * sr);
  let ef = 0, es = 0, pf = 0, ps = 0;
  const n = sr;
  for (let i = c; i < c + n && i < Math.min(film.n, song.n); i++) {
    ef += film.a[i] ** 2; es += song.a[i] ** 2;
    pf = Math.max(pf, Math.abs(film.a[i])); ps = Math.max(ps, Math.abs(song.a[i]));
  }
  console.log(
    `${String(s).padStart(3)}s  ${db(Math.sqrt(es / n)).toFixed(1).padStart(6)}  ${db(Math.sqrt(ef / n)).toFixed(1).padStart(7)}  ${(
      db(Math.sqrt(ef / n)) - db(Math.sqrt(es / n))
    ).toFixed(2).padStart(6)}  ${ps.toFixed(3).padStart(7)}  ${pf.toFixed(3).padStart(7)}`
  );
}

// 真实峰值估算：4 倍线性插值
function truePeak(a, from, to) {
  let tp = 0;
  for (let i = from + 1; i < to - 1; i++) {
    const x0 = a[i - 1], x1 = a[i], x2 = a[i + 1];
    for (let k = 0; k < 4; k++) {
      const u = k / 4;
      const v = Math.abs(x1 + 0.5 * u * (x2 - x0) + 0.5 * u * u * (x2 - 2 * x1 + x0));
      if (v > tp) tp = v;
    }
  }
  return tp;
}
const a = Math.round(80 * sr), b = Math.round(95 * sr);
console.log(`\n82–95s 真实峰值(4x 插值估算)：成片 ${truePeak(film.a, a, b).toFixed(3)}  原曲 ${truePeak(song.a, a, b).toFixed(3)}`);
