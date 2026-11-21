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
 * MotionB2 —— 「空」的第二次实现（8 秒，44.96 → 52.96）。
 *
 * 与第一版的区别只有一句话：**画面不再由图层位移构成，而是每帧重新生成。**
 *   1. 机器世界换成字符材质（AsciiRiver），逐帧重算，不是平移
 *   2. 全屏纹理层（颗粒/扫描线/色差/暗角），逐帧变化
 *   3. 镜头：缓慢侧滚 + 呼吸推拉 + 拍点抖动
 *   4. 累积损伤 corruption：越往后越脏，永不回退
 */

const W = 1920;
const H = 1080;
const START = 44.96;
const DUR = 8;
const CUT_AT = 1.2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const Character: React.FC<{
  id: string;
  height: number;
  baseline: number;
  centerX: number;
  style?: React.CSSProperties;
}> = ({ id, height, baseline, centerX, style }) => {
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
        ...style,
      }}
    />
  );
};

const MotionB2Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // 相对本段的秒数 0..8
  const abs = START + t;

  /* ------------------------------------------------------------ 累积损伤 */
  const corruption = clamp01(0.04 + 0.9 * Math.pow(t / DUR, 1.35));

  /* ---------------------------------------------------------------- 镜头 */
  const since = sinceBeat(abs);
  const kick = Math.max(0, 1 - since / 0.16);
  const shakeX = (hash01(Math.floor(abs * 60)) - 0.5) * 2 * 2.4 * kick;
  const shakeY = (hash01(Math.floor(abs * 60) + 17) - 0.5) * 2 * 1.8 * kick;
  const roll = 0.35 * Math.sin(abs * 0.21) + 0.12;
  const push = 1.02 + 0.014 * Math.sin(abs * 0.53) + 0.008 * (t / DUR);

  /* ------------------------------------------------------------ 帧级抖动 */
  const gf = Math.floor(abs * 15);
  const jolt = corruption > 0.22 && hash01(gf) < 0.1 ? (hash01(gf + 3) - 0.5) * 30 : 0;
  const redGlitch = corruption > 0.3 && hash01(gf + 9) < 0.07;

  /* ---------------------------------------------------------------- 动作 */
  const cut = t >= CUT_AT;
  const close = interpolate(t, [0.7, CUT_AT], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fallT = Math.max(0, t - CUT_AT);
  const fallY = 0.5 * 2400 * fallT * fallT;
  const recoil = interpolate(t, [CUT_AT, CUT_AT + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bob = Math.sin(t * 1.9) * 1.6;

  const horizon = 946;
  const bodyH = 672 * (1 - 0.035 * recoil);
  const baseline = 1048 + 12 * recoil + bob;
  const centerX = 640 - 8 * recoil;

  return (
    <AbsoluteFill style={{ backgroundColor: '#080b10', overflow: 'hidden' }}>
      {/* 底：一点中心亮、四周暗的底色，避免整幅死黑 */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 46% 52%, rgba(24,34,46,0.95) 0%, rgba(9,12,17,1) 58%, rgba(4,6,9,1) 100%)',
        }}
      />
      {/* -------------------------------------------------- 场景层（会跟着镜头动） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shakeX + jolt}px, ${shakeY}px) rotate(${roll}deg) scale(${push})`,
          transformOrigin: '50% 55%',
        }}
      >
        {/* 字符河：机器世界 */}
        <AsciiRiver t={abs} corruption={corruption} density={0.8} bandBottom={0.9} opacity={1} />

        {/* 地平线 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: horizon,
            height: 1,
            backgroundColor: COLORS.steel,
            opacity: 0.28,
          }}
        />

        {/* 下坠的方块 */}
        {(!cut || fallY < H) && (
          <div
            style={{
              position: 'absolute',
              left: 930,
              top: 610 + fallY,
              width: 230,
              height: 230,
              backgroundColor: '#10151c',
              border: `2px solid ${COLORS.paper}`,
              transform: `rotate(${18 + fallT * 70}deg)`,
              opacity: 1 - clamp01(fallT / 2.2),
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
                  opacity: 0.16 + ((i * 11) % 12) / 100,
                }}
              />
            ))}
          </div>
        )}

        {/* 三个剪影：加了肩膀斜切，不再像柱子 */}
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          {[
            { x: 1310, w: 132, h: 292 },
            { x: 1470, w: 108, h: 238 },
            { x: 1612, w: 88, h: 198 },
          ].map((s, i) => {
            const headR = s.w * 0.3;
            const topY = horizon - s.h;
            return (
              <g key={i} fill="#1a222c">
                <path
                  d={`M ${s.x - s.w * 0.34} ${horizon}
                      L ${s.x - s.w * 0.42} ${topY + s.h * 0.22}
                      Q ${s.x - s.w * 0.5} ${topY + s.h * 0.08} ${s.x - headR * 1.15} ${topY + s.h * 0.1}
                      L ${s.x + headR * 1.15} ${topY + s.h * 0.1}
                      Q ${s.x + s.w * 0.5} ${topY + s.h * 0.08} ${s.x + s.w * 0.42} ${topY + s.h * 0.22}
                      L ${s.x + s.w * 0.34} ${horizon} Z`}
                />
                <circle cx={s.x} cy={topY} r={headR} />
              </g>
            );
          })}

          {/* 剪刀 */}
          <g transform={`translate(1122 372) rotate(${-77 + close * 8})`}>
            <g transform={`rotate(${-close * 15})`}>
              <polygon points="0,0 -196,-30 -192,2" fill={COLORS.red} opacity={0.95} />
            </g>
            <g transform={`rotate(${close * 15})`}>
              <polygon points="0,0 -202,10 -194,36" fill={COLORS.red} opacity={0.95} />
            </g>
            <circle cx={30} cy={22} r={21} fill="none" stroke={COLORS.red} strokeWidth={7} />
            <circle cx={22} cy={-30} r={21} fill="none" stroke={COLORS.red} strokeWidth={7} />
            <circle cx={0} cy={0} r={6} fill={COLORS.paper} />
          </g>
        </svg>

        {/* 角色 */}
        <Character
          id="sub.ai.maid-empty"
          height={bodyH}
          baseline={baseline}
          centerX={centerX}
          style={{ zIndex: 3 }}
        />
      </div>

      {/* ------------------------------------------------------- 剪断瞬间的红闪 */}
      <AbsoluteFill
        style={{
          backgroundColor: redGlitch ? 'rgba(215,38,61,0.10)' : 'rgba(0,0,0,0)',
        }}
      />

      {/* ------------------------------------------------------------------ 纹理 */}
      <TextureStack t={abs} corruption={corruption} intensity={0.9 + corruption * 0.3} />

      {/* ------------------------------------------------------------------ 字幕 */}
      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.muted }}>
          00:44.96　·　B2 · 空
        </div>
        <div style={{ fontFamily: SANS, fontSize: 28, marginTop: 8, color: COLORS.paper }}>
          他们拿着剪刀摘走我的行李
        </div>
      </div>

      {/* 角落那块红 */}
      <div
        style={{
          position: 'absolute',
          right: 42,
          bottom: 42,
          width: 6,
          height: 18,
          backgroundColor: COLORS.red,
          opacity: 0.6 + 0.4 * Math.abs(Math.sin(t * 1.3)),
        }}
      />
    </AbsoluteFill>
  );
};

export const MotionB2 = withFonts(MotionB2Inner);
