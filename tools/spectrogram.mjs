/* ============================================================================
 * spectrogram.mjs — 声谱图：把音频画成一张图，用来「看」声音
 * ----------------------------------------------------------------------------
 *   node tools/spectrogram.mjs --in input/song.mp3 --from 0 --to 40 --out out/spec.png
 *   node tools/spectrogram.mjs --in "D:\音乐\我记得\我记得 _人声.mp3" --from 0 --to 40
 *
 * 为什么需要：Remotion 自带的 ffmpeg 是精简版，没有 showspectrum / astats。
 * 而「这条人声轨到底干不干净」「分离出来的到底是人声还是吉他」这类问题，
 * 看一张声谱图比听十遍快：人声是带颤音的整齐谐波列，吉他是扫弦的宽频毛刺。
 *
 * 颜色：越亮 = 能量越强。横轴时间，纵轴频率（0 → --maxhz）。
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodeToWav, readWavMono, findFfmpeg } from './lib/audio.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const IN = path.resolve(arg('in', path.join(PROJ, 'input', 'song.mp3')));
const FROM = Number(arg('from', 0));
const TO = Number(arg('to', 40));
const MAXHZ = Number(arg('maxhz', 5000));
const WIDTH = Number(arg('width', 1400));
const HEIGHT = Number(arg('height', 500));
const OUT = path.resolve(arg('out', path.join(PROJ, 'out', `spec-${FROM}-${TO}.png`)));

const ffmpeg = findFfmpeg(PROJ);
if (!ffmpeg) {
  console.error('✘ 找不到自带的 ffmpeg');
  process.exit(1);
}

/* ------------------------------------------------------------------ 解码 */
const tmpWav = path.join(PROJ, '.tmp-render', `spec-${process.pid}.wav`);
fs.mkdirSync(path.dirname(tmpWav), { recursive: true });
decodeToWav(ffmpeg, IN, tmpWav, 22050);
const { samples, sampleRate: SR } = readWavMono(tmpWav);
fs.rmSync(tmpWav, { force: true });

/* --------------------------------------------------------------- 简易 FFT */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const N = 2048;
const HOP = 256;
const win = new Float32Array(N);
for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

const i0 = Math.max(0, Math.floor(FROM * SR));
const i1 = Math.min(samples.length, Math.floor(TO * SR));
const frames = Math.floor((i1 - i0 - N) / HOP) + 1;
if (frames <= 0) {
  console.error('✘ 区间太短');
  process.exit(1);
}

const binHz = SR / N;
const maxBin = Math.min(N / 2, Math.ceil(MAXHZ / binHz));
const cols = WIDTH;
const rows = HEIGHT;

// 每列取一段帧做最大值聚合，避免超过 3000 列
const perCol = Math.max(1, Math.floor(frames / cols));

const re = new Float32Array(N);
const im = new Float32Array(N);
const rgb = Buffer.alloc(cols * rows * 3, 0);
let peak = 1e-9;

// 先扫一遍求峰值，做归一化
const colBins = [];
for (let c = 0; c < cols; c++) {
  const f0 = Math.min(frames - 1, c * perCol);
  const f1 = Math.min(frames, f0 + perCol);
  const acc = new Float32Array(maxBin);
  for (let f = f0; f < f1; f++) {
    const off = i0 + f * HOP;
    for (let i = 0; i < N; i++) {
      re[i] = (samples[off + i] || 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < maxBin; b++) {
      const m = Math.hypot(re[b], im[b]);
      if (m > acc[b]) acc[b] = m;
    }
  }
  for (let b = 0; b < maxBin; b++) if (acc[b] > peak) peak = acc[b];
  colBins.push(acc);
}

/** dB → 颜色（黑 → 铁蓝 → 橙 → 米白） */
function colormap(k) {
  const stops = [
    [0.0, [8, 10, 14]],
    [0.35, [40, 72, 100]],
    [0.6, [180, 60, 50]],
    [0.8, [226, 140, 60]],
    [1.0, [240, 232, 210]],
  ];
  const v = Math.max(0, Math.min(1, k));
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (v - p0) / (p1 - p0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * t));
    }
  }
  return stops[stops.length - 1][1];
}

for (let c = 0; c < cols; c++) {
  const acc = colBins[c];
  for (let r = 0; r < rows; r++) {
    // 纵向：低频在下
    const b = Math.round(((rows - 1 - r) / (rows - 1)) * (maxBin - 1));
    const db = 20 * Math.log10(Math.max(1e-9, acc[b]) / peak);
    const k = Math.max(0, Math.min(1, (db + 80) / 80));
    const [R, G, B] = colormap(k);
    const o = (r * cols + c) * 3;
    rgb[o] = R;
    rgb[o + 1] = G;
    rgb[o + 2] = B;
  }
}

/* ------------------------------------------------------------- 写 PNG */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(cols, 0);
ihdr.writeUInt32BE(rows, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const raw = Buffer.alloc((cols * 3 + 1) * rows);
for (let r = 0; r < rows; r++) {
  raw[r * (cols * 3 + 1)] = 0;
  rgb.copy(raw, r * (cols * 3 + 1) + 1, r * cols * 3, (r + 1) * cols * 3);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
);

console.log(`✔ ${path.relative(PROJ, OUT)}`);
console.log(`  ${path.basename(IN)}  ${FROM}s → ${TO}s  频率 0–${MAXHZ}Hz  ${cols}×${rows}`);
