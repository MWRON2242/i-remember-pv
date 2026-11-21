import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { sinceBeat } from './lib/beats';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';

/**
 * MotionA2 —— 「抱」的第二次实现（8 秒，28.35 → 36.35）。
 *
 * 与 B2 同一套：字符材质 + 纹理层 + 镜头 + 累积损伤。
 * 区别只有一处：这里的字符是**横向的水流**（她在河里），不是自上而下的雨。
 */

const W = 1920;
const H = 1080;
const START = 28.35;
const DUR = 8;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const Character: React.FC<{
  id: string;
  height: number;
  baseline: number;
  centerX: number;
}> = ({ id, height, baseline, centerX }) => {
  const p = place(id, { height, baseline, centerX });
  if (!p) return null;
  return (
    <Img
      src={p.src}
      style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }}
    />
  );
};

const MotionA2Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = START + t;

  const corruption = clamp01(0.03 + 0.42 * Math.pow(t / DUR, 1.2));

  const since = sinceBeat(abs);
  const kick = Math.max(0, 1 - since / 0.16);
  const shake = (hash01(Math.floor(abs * 60)) - 0.5) * 1.6 * kick;

  const roll = 0.25 * Math.sin(abs * 0.18) - 0.1;
  const push = 1.0 + 0.05 * (t / DUR) + 0.008 * Math.sin(abs * 0.5);

  // 手位：身高 820、centerX=900 时换算到画面坐标 (686,546)/(760,623)
  const bodyH = 820;
  const sink = 16 * (t / DUR);
  const bob = Math.sin(t * 1.7) * 1.4;
  const centerX = 900;
  const baseline = 1044 + sink + bob;

  const handMidX = 723;
  const boxSize = 236;
  const boxTop = 636 + 3 * kick + sink + bob;

  return (
    <AbsoluteFill style={{ backgroundColor: '#080b10', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 48% 50%, rgba(22,32,44,0.95) 0%, rgba(8,11,16,1) 62%, rgba(4,6,9,1) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake}px, ${shake * 0.6}px) rotate(${roll}deg) scale(${push})`,
          transformOrigin: '50% 55%',
        }}
      >
        {/* 横向水流 */}
        <AsciiRiver t={abs} corruption={corruption} density={0.52} mode="stream" opacity={0.85} />

        <Character id="sub.ai.maid-carry" height={bodyH} baseline={baseline} centerX={centerX} />

        {/* 行李：画在角色之后 → 在身前，手压在它的上沿 */}
        <div
          style={{
            position: 'absolute',
            left: handMidX - boxSize / 2,
            top: boxTop + 24,
            width: boxSize,
            height: boxSize,
            backgroundColor: '#0d1218',
            border: `2px solid ${COLORS.paper}`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 14,
                right: 14,
                top: 22 + i * 32,
                height: 6,
                backgroundColor: COLORS.paper,
                opacity: 0.18 + ((i * 11) % 12) / 100,
              }}
            />
          ))}
        </div>
      </div>

      <TextureStack t={abs} corruption={corruption} intensity={0.85 + corruption * 0.3} />

      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.muted }}>
          00:28.35　·　A2 · 抱
        </div>
        <div style={{ fontFamily: SANS, fontSize: 28, marginTop: 8, color: COLORS.paper }}>
          我带着比身体重的行李
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 42,
          bottom: 42,
          width: 6,
          height: 18,
          backgroundColor: COLORS.red,
          opacity: 0.6 + 0.4 * Math.abs(Math.sin(t * 1.4)),
        }}
      />
    </AbsoluteFill>
  );
};

export const MotionA2 = withFonts(MotionA2Inner);
