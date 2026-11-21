/* ============================================================================
 * pitch-shift.mjs — 变调（相位声码器），用来做「同一副嗓子里的另一个人」
 * ----------------------------------------------------------------------------
 *   node tools/pitch-shift.mjs --in public/audio/stems/vocal.mp3 --from 13.5 --to 28.35 \
 *        --semitones 5 --out out/vocal-female.wav
 *
 * 做什么：保持时长不变，把音高整体移动 N 个半音。共振峰跟着一起走 ——
 * 这恰好模拟「声道更小的人」，所以男声 +5 半音听起来像女声，而不是花栗鼠。
 *
 * 为什么不用 sox / ffmpeg：本机没有系统 ffmpeg，自带的是精简版（无 atempo/asetrate），
 * 也没有 Python。这套 DSP 必须自己写，好处是零依赖、结果可复现。
 *
 * 额外选项：
 *   --mix-with <音频>   把结果叠到另一条音频的同一时间窗上
 *   --mix-gain <dB>     叠加时结果的增益（默认 -6）
 *   --only-stem         只输出变调后的干声
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeToWav, readWavMono, findFfmpeg } from './lib/audio.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const flag = (n) => argv.includes('--' + n);

const IN = path.resolve(PROJ, arg('in'));
const FROM = Number(arg('from', 0));
const TO = Number(arg('to', 0));
const SEMITONES = Number(arg('semitones', 5));
const OUT = path.resolve(PROJ, arg('out', 'out/pitch-shift.wav'));
const MIX_WITH = arg('mix-with', null);
const MIX_GAIN_DB = Number(arg('mix-gain', -6));
const SR = 44100;

const ffmpeg = findFfmpeg(PROJ);
if (!ffmpeg) {
  console.error('✘ 找不到自带的 ffmpeg');
  process.exit(1);
}
if (!IN || !fs.existsSync(IN)) {
  console.error('✘ 找不到输入：' + IN);
  process.exit(1);
}

/* ------------------------------------------------------------------ 解码 */
function decode(file) {
  const tmp = path.join(PROJ, '.tmp-render', `ps-${process.pid}-${Math.random().toString(36).slice(2, 6)}.wav`);
  decodeToWav(ffmpeg, file, tmp, SR);
  const { samples } = readWavMono(tmp);
  fs.rmSync(tmp, { force: true });
  return samples;
}

/* ------------------------------------------------------------------ FFT */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const wrap = (p) => {
  while (p > Math.PI) p -= 2 * Math.PI;
  while (p < -Math.PI) p += 2 * Math.PI;
  return p;
};

/**
 * 相位声码器时间伸缩（保持音高）。
 * factor > 1 = 变长。分析跳距 Ha 固定，合成跳距 Hs = Ha * factor。
 */
function timeStretch(x, factor) {
  const N = 2048;
  const Ha = 512;
  const Hs = Math.max(1, Math.round(Ha * factor));
  const half = N / 2 + 1;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  const outLen = Math.ceil(x.length * factor) + N;
  const out = new Float32Array(outLen);
  const norm = new Float32Array(outLen);

  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const prevPhase = new Float32Array(half);
  const sumPhase = new Float32Array(half);
  const omega = (2 * Math.PI * Ha) / N;

  for (let f = 0; ; f++) {
    const start = f * Ha;
    if (start + N > x.length) break;
    for (let i = 0; i < N; i++) {
      re[i] = (x[start + i] || 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);

    const oStart = f * Hs;
    for (let k = 0; k < half; k++) {
      const mag = Math.hypot(re[k], im[k]);
      const phase = Math.atan2(im[k], re[k]);
      let delta = wrap(phase - prevPhase[k] - k * omega);
      prevPhase[k] = phase;
      const trueOmega = k * omega + delta;
      sumPhase[k] += trueOmega * (Hs / Ha);
      const ph = sumPhase[k];
      re[k] = mag * Math.cos(ph);
      im[k] = mag * Math.sin(ph);
      // 共轭对称
      if (k > 0 && k < N / 2) {
        re[N - k] = re[k];
        im[N - k] = -im[k];
      }
    }
    // IFFT：用 FFT 再取共轭实现
    for (let i = 0; i < N; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < N; i++) {
      const v = re[i] / N * win[i];
      if (oStart + i < outLen) {
        out[oStart + i] += v;
        norm[oStart + i] += win[i] * win[i];
      }
    }
  }
  for (let i = 0; i < outLen; i++) if (norm[i] > 1e-6) out[i] /= Math.max(1, norm[i]);
  return out;
}

/** 线性插值重采样（比率 > 1 = 音高升高、时长缩短） */
function resample(x, ratio) {
  const outLen = Math.floor(x.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    out[i] = (x[i0] || 0) * (1 - frac) + (x[i0 + 1] || 0) * frac;
  }
  return out;
}

/** 变调：先按比率拉长，再按比率重采样，时长不变、音高 ×比率 */
function pitchShift(x, semitones) {
  const ratio = Math.pow(2, semitones / 12);
  const stretched = timeStretch(x, ratio);
  return resample(stretched, ratio);
}

/* ------------------------------------------------------------------ 主流程 */
const ratio = Math.pow(2, SEMITONES / 12);
console.log(`变调 +${SEMITONES} 半音（比率 ${ratio.toFixed(4)}）`);

const full = decode(IN);
const i0 = Math.floor(FROM * SR);
const i1 = TO > 0 ? Math.min(full.length, Math.floor(TO * SR)) : full.length;
const seg = full.subarray(i0, i1);
console.log(`  取段 ${FROM}s → ${TO || '末尾'}s（${(seg.length / SR).toFixed(2)} 秒）`);

const shifted = pitchShift(seg, SEMITONES);
console.log(`  变调完成（${(shifted.length / SR).toFixed(2)} 秒）`);

/* 淡入淡出，避免首尾爆音 */
const fade = Math.floor(SR * 0.35);
for (let i = 0; i < fade && i < shifted.length; i++) {
  shifted[i] *= i / fade;
  shifted[shifted.length - 1 - i] *= i / fade;
}

let out = shifted;

if (!flag('only-stem') && MIX_WITH) {
  const mixPath = path.resolve(PROJ, MIX_WITH);
  const master = decode(mixPath);
  const m0 = Math.floor(FROM * SR);
  const len = Math.min(master.length - m0, shifted.length);
  const gain = Math.pow(10, MIX_GAIN_DB / 20);
  out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = (master[m0 + i] || 0) + shifted[i] * gain;
  console.log(`  已与原曲 ${FROM}s 起叠加（结果 ${MIX_GAIN_DB} dB）`);
}

/* 归一化到 -1 dBFS 以内 */
let peak = 0;
for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
const g = peak > 0 ? 0.89 / peak : 1;
for (let i = 0; i < out.length; i++) out[i] *= g;

/* ------------------------------------------------------------- 写 WAV（16bit 单声道） */
const n = out.length;
const buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0, 'ascii');
buf.writeUInt32LE(36 + n * 2, 4);
buf.write('WAVE', 8, 'ascii');
buf.write('fmt ', 12, 'ascii');
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36, 'ascii');
buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const v = Math.max(-1, Math.min(1, out[i]));
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buf);
console.log(`✔ ${path.relative(PROJ, OUT)}（${(buf.length / 1048576).toFixed(2)} MB）`);
