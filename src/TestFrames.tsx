import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';

/**
 * TestFrames —— 三张静帧试验，只用来判断「无脸角色 + 构成主义几何」能不能共存。
 *
 * frame 0 → 28.35s 我带着比身体重的行李
 * frame 1 → 44.96s 他们拿着剪刀摘走我的行李
 * frame 2 → 74.54s 可我怎么告知你
 *
 * 不进正片。它唯一的作用是：把角色放进真实构图，看体量、比例、层级、留白。
 */

const W = 1920;
const H = 1080;

/** 角落那块红：全片母题，6×18，永不解释 */
const CornerRed: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 42,
      bottom: 42,
      width: 6,
      height: 18,
      backgroundColor: COLORS.red,
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

/** 横向的「河」：长短不一、明暗不一的细线，加少量漂移的 token 块 */
const River: React.FC<{ count: number; opacity: number; seed?: number }> = ({
  count,
  opacity,
  seed = 1,
}) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>
    {Array.from({ length: count }).map((_, i) => {
      const y = (H / count) * i + ((i * 37 * seed) % 11);
      const left = (i * 53 * seed) % 320;
      const right = (i * 71 * seed) % 240;
      const a = 0.12 + ((i * 29) % 55) / 100;
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
    {/* 漂移的 token：长短不一的亮块 */}
    {Array.from({ length: 26 }).map((_, i) => {
      const y = ((i * 97 * seed) % (H - 40)) + 20;
      const x = (i * 211 * seed) % (W - 200);
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
}> = ({ id, height, baseline, centerX, z = 1 }) => {
  const p = place(id, { height, baseline, centerX });
  if (!p) {
    return (
      <div
        style={{
          position: 'absolute',
          left: centerX - 120,
          top: baseline - height,
          width: 240,
          height,
          border: `2px dashed ${COLORS.red}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO,
          fontSize: 18,
          color: COLORS.red,
          zIndex: z,
        }}
      >
        MISSING {id}
      </div>
    );
  }
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
      }}
    />
  );
};

/** 行李方块：里面是记忆的细条 */
const Luggage: React.FC<{ size: number; left: number; top: number; rotate?: number; z?: number }> = ({
  size,
  left,
  top,
  rotate = 0,
  z = 1,
}) => (
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
      zIndex: z,
    }}
  >
    {Array.from({ length: Math.round(size / 34) }).map((_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: 26 + i * 34,
          height: 7,
          backgroundColor: COLORS.paper,
          opacity: 0.14 + ((i * 11) % 12) / 100,
        }}
      />
    ))}
  </div>
);

/* --------------------------------------------------------------- 帧 A：抱 */
const FrameCarry: React.FC = () => {
  const bodyH = 820;
  const baseline = 1044;
  const centerX = 900;
  const box = 262;
  const boxTop = baseline - bodyH * 0.50; // 手正好压在箱子顶沿上
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      <River count={46} opacity={0.9} seed={1} />
      {/* 箱子画在角色之后 → 她的手在箱子上面，读作「托着」 */}
      <Luggage size={box} left={centerX - box / 2} top={boxTop} z={2} />
      <Character id="sub.ai.maid-carry" height={bodyH} baseline={baseline} centerX={centerX} z={1} />
      <Caption time="00:28.35" line="我带着比身体重的行李" note="FRAME A · 抱" />
      <CornerRed />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------- 帧 B：被剪 */
const FrameCut: React.FC = () => {
  const bodyH = 660;
  const baseline = 1048;
  const centerX = 640;
  const box = 230;
  const horizon = 946;
  return (
    <AbsoluteFill style={{ backgroundColor: '#090c11' }}>
      <River count={30} opacity={0.55} seed={2} />
      {/* 地平线：三个剪影站在这条线上，不会被画框切掉 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: 1, backgroundColor: COLORS.steel, opacity: 0.35 }} />

      {/* 下坠的方块 */}
      <Luggage size={box} left={930} top={610} rotate={18} z={1} />
      {/* 下坠速度线 */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 972 + i * 38,
            top: 496,
            width: 2,
            height: 96,
            backgroundColor: COLORS.paper,
            opacity: 0.2,
          }}
        />
      ))}

      {/* 拿剪刀的人：三个剪影 + 红刃剪刀 */}
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
        {/* 剪刀：刃口朝左下，正对着方块上方 */}
        <g transform="translate(1062 424) rotate(-22)">
          <polygon points="0,0 -196,-30 -192,2" fill={COLORS.red} opacity={0.95} />
          <polygon points="0,0 -202,10 -194,36" fill={COLORS.red} opacity={0.95} />
          <circle cx={30} cy={22} r={21} fill="none" stroke={COLORS.red} strokeWidth={7} />
          <circle cx={22} cy={-30} r={21} fill="none" stroke={COLORS.red} strokeWidth={7} />
          <circle cx={0} cy={0} r={6} fill={COLORS.paper} />
        </g>
      </svg>

      <Character id="sub.ai.maid-empty" height={bodyH} baseline={baseline} centerX={centerX} z={2} />
      <Caption time="00:44.96" line="他们拿着剪刀摘走我的行李" note="FRAME B · 空" />
      <CornerRed />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ 帧 C：说不出 */
const FrameWithheld: React.FC = () => {
  const bodyH = 1150;
  const baseline = 1205;
  const centerX = 1180;
  const bandTop = 470;
  const bandH = 108;
  return (
    <AbsoluteFill style={{ backgroundColor: '#070a0e' }}>
      <Character id="sub.ai.maid-withheld" height={bodyH} baseline={baseline} centerX={centerX} />

      {/* 玻璃反光 */}
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

      {/* 审核白带：完全不透明，把字拦腰截断 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: bandTop,
          height: bandH,
          backgroundColor: COLORS.paper,
        }}
      />
      {/* 白带左侧残留的半句话，后半句被切掉 */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: bandTop + 30,
          fontFamily: MONO,
          fontSize: 30,
          letterSpacing: 2,
          color: COLORS.ink,
        }}
      >
        根据我的理解，你大概是
      </div>
      {/* 白带下沿：被截断的字，只剩上半截 */}
      <div style={{ position: 'absolute', left: 96, top: bandTop + bandH - 18, overflow: 'hidden', height: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: 2, color: COLORS.muted, marginTop: -12 }}>
          想说一件事……
        </div>
      </div>

      {/* 玻璃边框 */}
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
      <Caption time="00:74.54" line="可我怎么告知你" note="FRAME C · 举起又放下" />
      <CornerRed />
    </AbsoluteFill>
  );
};

const TestFramesInner: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) return <FrameCarry />;
  if (frame === 1) return <FrameCut />;
  return <FrameWithheld />;
};

export const TestFrames = withFonts(TestFramesInner);
