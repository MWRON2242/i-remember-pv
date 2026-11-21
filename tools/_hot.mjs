import fs from 'node:fs';

function readWav(p) {
  const b = fs.readFileSync(p);
  let o = 12, off = -1, len = 0, ch = 2, sr = 48000;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); }
    if (id === 'data') { off = o + 8; len = Math.min(sz, b.length - off); break; }
    o += 8 + sz + (sz % 2);
  }
  const n = Math.floor(len / (2 * ch));
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = b.readInt16LE(off + i * 2 * ch) / 32768;
  return { sr, n, a };
}

const s = readWav('out/_song.wav');
const sr = s.sr;

function stat(t0, t1) {
  const c0 = Math.round(t0 * sr), c1 = Math.min(s.n, Math.round(t1 * sr));
  let ge999 = 0, ge99 = 0, pk = 0;
  for (let i = c0; i < c1; i++) {
    const v = Math.abs(s.a[i]);
    if (v >= 0.999) ge999++;
    if (v >= 0.99) ge99++;
    if (v > pk) pk = v;
  }
  return { ge999, ge99, pk };
}

for (const [a, b] of [[20, 40], [60, 80], [82, 90], [90, 120], [120, 180], [180, 240], [240, 300], [300, 330]]) {
  const r = stat(a, b);
  console.log(
    `${String(a).padStart(3)}-${String(b).padStart(3)}s  ge0.999:${String(r.ge999).padStart(6)}  ge0.99:${String(r.ge99).padStart(6)}  peak ${r.pk.toFixed(3)}`
  );
}
