import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { fbm, hash01, hash2 } from '../lib/noise';

/**
 * AsciiRiver —— 「系统世界」的材质：整屏字符。
 *
 * 为什么用字符：这个片子的世界观里，AI 看到的一切都是 token。
 * 机器世界用字符构成，人（角色）是全片唯一的固体。
 *
 * 实现要点（思路来自 world.execute(me)，用 canvas 重写）：
 *   1. 每帧全量重算，绝不平移图层 → 不会有「翻页感」
 *   2. 随机全部来自整数哈希，同一帧永远同一结果
 *   3. 密度由分形噪声控制，成片成片地明灭，而不是均匀雨点
 *   4. 损伤度 corruption 累积：越高，红色字符越多
 *
 * 两种形态：
 *   rain   —— 自上而下的列（数据从上方落下）
 *   stream —— 横向的水流（人在河里时用）
 */

const CELL_W = 16;
const CELL_H = 20;
const RAMP = '.:-=+*#%@';

export type AsciiRiverProps = {
  t: number;
  corruption: number;
  density?: number;
  bandTop?: number;
  bandBottom?: number;
  opacity?: number;
  mode?: 'rain' | 'stream';
  /** 只在这个像素区间内画字符，用于分区（比如白带上下） */
  clipY?: [number, number];
  /** 额外整体偏移（像素），用于视差 */
  offsetX?: number;
  /** 正常字符的 RGB（"150,196,214"）。回忆场景可换成更亮的浅蓝 */
  tint?: string;
  /** 横杠的透明度倍率（默认 1；回忆场景压低到 0.3 以免像终端） */
  barAlpha?: number;
};

export const AsciiRiver: React.FC<AsciiRiverProps> = ({
  t,
  corruption,
  density = 0.55,
  bandTop = 0,
  bandBottom = 1,
  opacity = 1,
  mode = 'rain',
  clipY,
  offsetX = 0,
  tint = '150,196,214',
  barAlpha = 1,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = Math.ceil(width / CELL_W);
    const rows = Math.ceil(height / CELL_H);
    const topPx = clipY ? clipY[0] : height * bandTop;
    const botPx = clipY ? clipY[1] : height * bandBottom;
    const y0 = Math.max(0, Math.floor(topPx / CELL_H));
    const y1 = Math.min(rows, Math.ceil(botPx / CELL_H));

    ctx.clearRect(0, 0, width, height);
    ctx.font = `600 ${Math.round(CELL_H * 0.78)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';

    const put = (x: number, y: number, local: number) => {
      const r = hash2(x * 7 + Math.floor(t * 9), y * 13);
      const ch = RAMP[Math.floor(r * RAMP.length)];
      const hurt = corruptAt(x, y, t, corruption);
      const a = 0.16 + local * 0.9;
      ctx.fillStyle = hurt
        ? `rgba(226,48,72,${0.35 + a * 0.6})`
        : `rgba(${tint},${a})`;
      ctx.fillText(ch, x * CELL_W + offsetX, y * CELL_H);
    };

    if (mode === 'rain') {
      for (let x = 0; x < cols; x++) {
        const speed = 26 + hash01(x * 3.7) * 120;
        const phase = hash01(x * 11.3) * 900;
        const tail = 8 + Math.floor(hash01(x * 5.1) * 16);
        const headRow = ((phase + t * speed) / CELL_H) % (rows + tail);

        for (let y = y0; y < y1; y++) {
          const d = headRow - y;
          if (d < 0 || d > tail) continue;
          const field = fbm(x * 0.045 + t * 0.06, y * 0.06 - t * 0.11);
          const local = field * density * (1 - d / (tail + 1));
          if (local < 0.07) continue;
          put(x, y, local);
        }
      }
    } else {
      // 横向水流：每行的速度、方向、相位都不同，形成层流
      for (let y = y0; y < y1; y++) {
        const speed = 60 + hash01(y * 3.1) * 220;
        const dir = hash01(y * 7.3) > 0.28 ? -1 : 1;
        const phase = hash01(y * 11.9) * width;
        const off = (((t * speed * dir + phase) % width) + width) % width;

        for (let x = 0; x < cols; x++) {
          const field = fbm(x * 0.05 - t * 0.22, y * 0.13 + t * 0.04);
          const local = field * density;
          if (local < 0.2) continue;
          const px = (x * CELL_W + off + offsetX) % width;
          const r = hash2(Math.floor(px / CELL_W) + Math.floor(t * 12), y * 13);
          const ch = RAMP[Math.floor(r * RAMP.length)];
          const hurt = corruptAt(x, y, t, corruption);
          const a = 0.16 + local * 0.95;
          ctx.fillStyle = hurt
            ? `rgba(226,48,72,${0.35 + a * 0.6})`
            : `rgba(${tint},${a})`;
          ctx.fillText(ch, px, y * CELL_H);
        }
      }
    }

    // 求情队列：几条由字符构成的横杠，缓慢左移
    for (let i = 0; i < 7; i++) {
      const yy = (0.12 + i * 0.11) * height;
      if (yy < topPx || yy > botPx) continue;
      const len = 90 + hash01(i * 13.1) * 260;
      const xoff = ((t * (14 + i * 3) + hash01(i * 7.7) * width) % (width + len)) - len;
      const alpha = (0.22 + hash01(i * 3.3) * 0.18) * barAlpha;
      if (alpha <= 0.01) continue;
      ctx.fillStyle = `rgba(239,231,216,${alpha})`;
      for (let k = 0; k < len; k += CELL_W) {
        const ch = hash2(i * 31 + Math.floor(t * 11), k) > 0.5 ? '=' : '-';
        ctx.fillText(ch, xoff + k, yy);
      }
    }
  }, [frame, t, corruption, density, bandTop, bandBottom, mode, clipY, offsetX, width, height, tint, barAlpha]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, width, height, opacity }}
    />
  );
};

/** 某格是否被「损伤」波及 */
function corruptAt(x: number, y: number, t: number, corruption: number): boolean {
  if (corruption <= 0.02) return false;
  const n = hash2(x * 3 + Math.floor(t * 6), y * 5);
  return n < corruption * 0.35;
}
