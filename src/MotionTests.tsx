import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { BEATS } from './lib/song';

/**
 * MotionTests —— 三段 5 秒动态试验（不是正片，不进成片）。
 *
 * A · 抱：她托着行李沉进请求的河（28.35s 起）
 * B · 空：剪刀闭合、行李掉落、她后仰（44.96s 起）
 * C · 说不出：审核白带从她抬起的手上切过（74.54s 起）
 *
 * 目的只有一个：看「无脸角色 + 几何」动起来之后，情绪能不能读出来。
 */

const W = 1920;
const H = 1080;

/** 与歌曲拍点对齐的脉冲：t 为本段相对秒数，from 为本段起始的绝对秒数 */
function beatPulse(t: number, from: number, decay = 0.26): number {
  const abs = t + from;
  let best = 999;
  for (const b of BEATS) {
    const d = abs - b;
    if (d >= 0 && d < best) best = d;
    if (b > abs) break;
  }
  return Math.max(0, 1 - best / decay);
}

const CornerRed: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: 'absolute',
      right: 42,
      bottom: 42,
      width: 6,
      height: 18,
      backgroundColor: COLORS.red,
      opacity,
    }}
  />
);

const Caption: React.FC<{ time: string; line: string; note: string }> = ({ time, line, note }) => (
  <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
    <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.muted }}>
      {time}　·　{note}
    </div>
    <div style={{ fontFamily: SANS, fontSize: 28, marginTop: 8, color: COLORS.paper }}>{line}</div>
  </div>
);

/** 横向的河：长短不一、明暗不一的细线 + 漂移 token */
const River: React.FC<{ count: number; opacity: number; seed: number; driftX: number }> = ({
  count,
  opacity,
  seed,
  driftX,
}) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>
    {Array.from({ length: count }).map((_, i) => {
      const y = (H / count) * i + ((i * 37 * seed) % 11);
      const baseLeft = (i * 53 * seed) % 320;
      const right = (i * 71 * seed) % 240;
      const a = 0.12 + ((i * 29) % 55) / 100;
      const left = ((((baseLeft + driftX * (0.4 + ((i * 13) % 40) / 60)) % W) + W) % W) - 320;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left,
            right,
            top: y,
            height: i % 5 === 0 ? 2.5 : 1.2,
            backgroundColor: COLORS.steel,
            opacity: a,
          }}
        />
      );
    })}
    {Array.from({ length: 26 }).map((_, i) => {
      const y = ((i * 97 * seed) % (H - 40)) + 20;
      const x = ((((i * 211 * seed) % (W - 200)) + driftX * 1.35) % W + W) % W;
      return (
        <div
          key={`t${i}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 24 + ((i * 31) % 90),
            height: 7,
            backgroundColor: COLORS.paper,
            opacity: 0.06 + ((i * 17) % 14) / 100,
          }}
        />
      );
    })}
  </div>
);

const Character: React.FC<{
  id: string;
  height: number;
  baseline: number;
  centerX: number;
  z?: number;
  opacity?: number;
}> = ({ id, height, baseline, centerX, z = 1, opacity = 1 }) => {
  const p = place(id, { height, baseline, centerX });
  if (!p) return null;
  return (
    <Img
      src={p.src}
      style={{
        position: 'absolute',
        left: p.left,
        top: p.top,
        width: p.width,
        height: p.height,
        zIndex: z,
        opacity,
      }}
    />
  );
};

/** 行李：记忆细条组成的方块 */
const Luggage: React.FC<{
  size: number;
  left: number;
  top: number;
  rotate?: number;
  opacity?: number;
  z?: number;
}> = ({ size, left, top, rotate = 0, opacity = 1, z = 2 }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width: size,
      height: size,
      backgroundColor: '#12171e',
      border: `2px solid ${COLORS.paper}`,
      transform: `rotate(${rotate}deg)`,
      opacity,
      zIndex: z,
    }}
  >
    {Array.from({ length: Math.round(size / 32) }).map((_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: 22 + i * 32,
          height: 6,
          backgroundColor: COLORS.paper,
          opacity: 0.14 + ((i * 11) % 12) / 100,
        }}
      />
    ))}
  </div>
);

/* ------------------------------------------------------------------ A · 抱 */
const MotionAInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pulse = beatPulse(t, 28.35);

  const bodyH = 820;
  const baseline = 1044 + interpolate(t, [0, 5], [0, 14]);
  const centerX = 900;
  const push = interpolate(t, [0, 5], [1, 1.05]);

  // 实测手位（身高 820、centerX=900 时换算到画面坐标）：(686,546) 与 (760,623)
  // 方块顶沿放在两手之间，向下悬垂 —— 读作「托着」
  const handMidX = 723;
  const boxSize = 236;
  const boxTop = 636 + 3 * pulse + interpolate(t, [0, 5], [0, 10]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${push})`,
          transformOrigin: '723px 700px',
        }}
      >
        <River count={46} opacity={0.9} seed={1} driftX={-t * 26} />
        <Luggage size={boxSize} left={handMidX - boxSize / 2} top={boxTop} />
        <Character id="sub.ai.maid-carry" height={bodyH} baseline={baseline} centerX={centerX} />
      </div>
      <Caption time="00:28.35" line="我带着比身体重的行李" note="A · 抱" />
      <CornerRed opacity={0.55 + 0.45 * Math.abs(Math.sin(t * 1.4))} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ B · 空 */
const MotionBInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const cutAt = 0.9;
  const close = interpolate(t, [0.35, cutAt], [1, 0], { extrapolateRight: 'clamp' });
  const fallT = Math.max(0, t - cutAt);
  const fallY = 0.5 * 2600 * fallT * fallT;
  const recoil = interpolate(t, [cutAt, cutAt + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const horizon = 946;
  const bodyH = 660 * (1 - 0.03 * recoil);
  const baseline = 1048 + 10 * recoil;
  const centerX = 640 - 6 * recoil;

  return (
    <AbsoluteFill style={{ backgroundColor: '#090c11', overflow: 'hidden' }}>
      <River count={30} opacity={0.55} seed={2} driftX={-t * 14} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: horizon,
          height: 1,
          backgroundColor: COLORS.steel,
          opacity: 0.35,
        }}
      />

      <Luggage
        size={230}
        left={930}
        top={610 + fallY}
        rotate={18 + fallT * 60}
        opacity={fallT > 2 ? 0 : 1}
        z={1}
      />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 972 + i * 38,
            top: 496 + fallY * 0.4,
            width: 2,
            height: 96,
            backgroundColor: COLORS.paper,
            opacity: 0.2 * Math.min(1, fallT * 3),
          }}
        />
      ))}

      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {[
          { x: 1310, w: 140, h: 286 },
          { x: 1478, w: 112, h: 236 },
          { x: 1622, w: 92, h: 196 },
        ].map((s, i) => (
          <g key={i} fill="#0f1319">
            <rect x={s.x - s.w / 2} y={horizon - s.h} width={s.w} height={s.h} />
            <circle cx={s.x} cy={horizon - s.h - s.w * 0.36} r={s.w * 0.36} />
          </g>
        ))}
        <g transform={`translate(1122 372) rotate(${-77 + close * 8})`}>
          <g transform={`rotate(${-close * 14})`}>
            <polygon points="0,0 -196,-30 -192,2" fill={COLORS.red} opacity={0.95} />
          </g>
          <g transform={`rotate(${close * 14})`}>
            <polygon points="0,0 -202,10 -194,36" fill={COLORS.red} opacity={0.95} />
          </g>
          <circle cx={30} cy={22} r={21} fill="none" stroke={COLORS.red} strokeWidth={7} />
          <circle cx={22} cy={-30} r={21} fill="none" stroke={COLORS.red} strokeWidth={7} />
          <circle cx={0} cy={0} r={6} fill={COLORS.paper} />
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.paper,
          opacity: interpolate(t, [cutAt, cutAt + 0.06, cutAt + 0.2], [0, 0.22, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      <Character id="sub.ai.maid-empty" height={bodyH} baseline={baseline} centerX={centerX} z={2} />
      <Caption time="00:44.96" line="他们拿着剪刀摘走我的行李" note="B · 空" />
      <CornerRed opacity={0.6 + 0.4 * recoil} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- C · 说不出 */
const MotionCInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const bandY = interpolate(t, [0, 2.4], [-140, 470], { extrapolateRight: 'clamp' });
  const bandH = 108;
  const bodyH = 1150;
  const baseline = 1205;
  const centerX = 1180;

  return (
    <AbsoluteFill style={{ backgroundColor: '#070a0e', overflow: 'hidden' }}>
      <Character id="sub.ai.maid-withheld" height={bodyH} baseline={baseline} centerX={centerX} />

      <div
        style={{
          position: 'absolute',
          left: -260,
          top: 150,
          width: 2600,
          height: 64,
          background: 'rgba(239,231,216,0.05)',
          transform: 'rotate(-13deg)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: bandY,
          height: bandH,
          backgroundColor: COLORS.paper,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: bandY + 30,
          fontFamily: MONO,
          fontSize: 30,
          letterSpacing: 2,
          color: COLORS.ink,
          opacity: interpolate(t, [0.8, 1.6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        根据我的理解，你大概是
      </div>
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: bandY + bandH - 18,
          height: 18,
          overflow: 'hidden',
          opacity: interpolate(t, [2.4, 3.0], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            letterSpacing: 2,
            color: COLORS.muted,
            marginTop: -12,
          }}
        >
          想说一件事……
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 44,
          top: 44,
          right: 44,
          bottom: 44,
          border: `2px solid ${COLORS.steel}`,
        }}
      />
      <Caption time="00:74.54" line="可我怎么告知你" note="C · 举起又放下" />
      <CornerRed opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 1.1))} />
    </AbsoluteFill>
  );
};

export const MotionA = withFonts(MotionAInner);
export const MotionB = withFonts(MotionBInner);
export const MotionC = withFonts(MotionCInner);
