import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { hash01 } from '../lib/noise';

/**
 * TextureStack —— 全片统一的「胶片感 / CRT 感」纹理层。
 *
 * 这一层是治「PPT 感」的关键：只要画面里始终有东西在逐帧变化，
 * 哪怕主体是静止的，眼睛也不会觉得这是一页幻灯片。
 *
 * 四个成分：
 *   1. 颗粒（grain）：每帧重画的噪声，逐帧换位置
 *   2. 扫描线（scanlines）：缓慢滚动的横纹
 *   3. 色差（chromatic）：红/青两层的极低透明度偏移
 *   4. 暗角（vignette）+ CRT 亮带：呼吸感
 */

export type TextureStackProps = {
  t: number;
  corruption: number;
  intensity?: number;
};

export const TextureStack: React.FC<TextureStackProps> = ({ t, corruption, intensity = 1 }) => {
  const grainRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gw = canvas.width;
    const gh = canvas.height;
    const img = ctx.createImageData(gw, gh);
    const seed = Math.floor(frame * 7);
    for (let i = 0; i < gw * gh; i++) {
      const v = hash01(seed + i * 2654435761);
      const g = Math.floor(120 + v * 135);
      img.data[i * 4] = g;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [frame]);

  const grainOpacity = (0.05 + corruption * 0.05) * intensity;
  const scanPos = (t * 9) % 6;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* 颗粒 */}
      <canvas
        ref={grainRef}
        width={220}
        height={124}
        style={{
          position: 'absolute',
          inset: 0,
          width,
          height,
          opacity: grainOpacity,
          mixBlendMode: 'overlay',
          filter: 'contrast(140%)',
        }}
      />

      {/* 扫描线 */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 3px)',
          backgroundPosition: `0 ${scanPos}px`,
          opacity: 0.35 * intensity,
          mixBlendMode: 'multiply',
        }}
      />

      {/* 色差：红/青极低透明度斜纹，反向缓慢移动 */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, rgba(255,40,60,0.10) 0px, rgba(255,40,60,0.10) 2px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 9px)',
          backgroundPosition: `${(t * 7) % 40}px 0`,
          opacity: 0.5 * intensity,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-linear-gradient(65deg, rgba(40,200,255,0.10) 0px, rgba(40,200,255,0.10) 2px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 9px)',
          backgroundPosition: `${-(t * 5) % 40}px 0`,
          opacity: 0.45 * intensity,
          mixBlendMode: 'screen',
        }}
      />

      {/* CRT 亮带：自上而下缓慢扫过 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${((t * 0.12) % 1.3) * 100 - 15}%`,
          height: 180,
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.035) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.035) 55%, rgba(255,255,255,0) 100%)',
          opacity: intensity,
        }}
      />

      {/* 暗角 */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%)',
          opacity: 0.75 + 0.1 * Math.sin(t * 0.9),
        }}
      />
    </AbsoluteFill>
  );
};
