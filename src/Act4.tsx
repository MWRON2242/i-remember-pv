import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { sinceBeat } from './lib/beats';
import { hash01, hash2 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';
import { Lyrics } from './components/Lyrics';

/**
 * Act4 —— 28.35 → 48.40 秒。
 *
 * 这一段的结构是一条**连续收窄的形状链**，不是几个镜头的拼接：
 *
 *   行李（方块） → 请求包（盒子） → 批次环（circle） → 哈希环（circle） → 节点窗口 → 人群
 *
 * 每一环都是上一环收缩来的：方块沉进包、包被环收拢、环缩成切点、切点落在节点上、
 * 节点展开成窗口、窗口扩出画外、里面已经是站着剪影的空地。
 * 全段没有一次「一块画面滑进来」。
 *
 * 机制依据：
 *   - Tokenization / 打包：行李由 token 拼成
 *   - 队列与批处理：传送带 + batch ring（continuous batching）
 *   - 负载均衡：一致性哈希环；KV 缓存是节点本地的，随机落点大概率 miss
 *   - 前缀感知路由：按前缀把请求送回存过它的那台机器，才可能命中
 *   - Truncation / 驱逐：红线截断 + 白带擦拭（与 Act 1 同一次驱逐）
 */

const W = 1920;
const H = 1080;

const S = 28.35;
const END = 48.4;
const DUR = END - S;

/* 全部用本段相对秒 */
const T_ASSEMBLED = 1.3;
const T_SINK = 2.79; // 31.14 游入尼罗河底
const T_SCAN = 4.5; // 32.97 闪电
const T_BATCH = 6.6; // 光圈
const T_HASH = 8.29; // 36.64 不确定是不是这里
const T_MISS = 9.5;
const T_PREFIX = 10.6;
const T_HIT = 11.9;
const T_CLOSE = 13.0; // 0.86 特写
const T_CROWD = 13.72; // 42.07 剪影
const T_CUT = 16.02; // 44.37 剪刀
const T_WIPE = 18.12; // 46.47 擦拭

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const TOKEN_COLS = 6;
const TOKEN_ROWS = 5;
const TOKENS = Array.from({ length: TOKEN_COLS * TOKEN_ROWS }, (_, i) => ({
  i,
  c: i % TOKEN_COLS,
  r: Math.floor(i / TOKEN_COLS),
  h: hash01(i * 7.3),
}));

/* ------------------------------------------------------------------ 传送带 */

const LANES = Array.from({ length: 5 }, (_, i) => ({
  y: 268 + i * 128,
  speed: 90 + hash01(i * 3.7) * 120,
  off: hash01(i * 9.1) * 900,
  gap: 210 + hash01(i * 5.5) * 120,
}));

const Lanes: React.FC<{ t: number; dim: number }> = ({ t, dim }) => (
  <div style={{ position: 'absolute', inset: 0, opacity: 1 - dim * 0.55 }}>
    {LANES.map((l, li) => {
      const shift = (t * l.speed + l.off) % l.gap;
      return (
        <div key={li} style={{ position: 'absolute', left: 0, right: 0, top: l.y }}>
          {/* 传送带基线 */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(150,180,200,0.12)' }} />
          {/* 请求包：细线轮廓 + 内部字符 */}
          {Array.from({ length: 9 }).map((_, k) => {
            const x = ((k * l.gap - shift) % (W + 300) + W + 300) % (W + 300) - 200;
            const seed = li * 31 + k * 17;
            return (
              <div
                key={k}
                style={{
                  position: 'absolute',
                  left: x,
                  top: -30,
                  width: 128,
                  height: 60,
                  border: '1px solid rgba(150,180,200,0.28)',
                  backgroundColor: 'rgba(8,12,18,0.35)',
                  overflow: 'hidden',
                }}
              >
                {Array.from({ length: 6 }).map((_, j) => (
                  <div
                    key={j}
                    style={{
                      position: 'absolute',
                      left: 6 + (j % 3) * 40,
                      top: 10 + Math.floor(j / 3) * 22,
                      fontFamily: MONO,
                      fontSize: 12,
                      color: 'rgba(150,180,200,0.5)',
                    }}
                  >
                    {'.:-=+*#%@'[Math.floor(hash2(seed, j + Math.floor(t * 8)) * 9)]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ 行李 */

const Luggage: React.FC<{ t: number; cx: number; cy: number }> = ({ t, cx, cy }) => {
  const cell = 34;
  const gap = 4;
  const w = TOKEN_COLS * (cell + gap);
  const h = TOKEN_ROWS * (cell + gap);
  const left = cx - w / 2;
  const top = cy - h / 2;
  const assemble = (i: number) => clamp01((t - i * 0.012) / 0.75);
  const cut = interpolate(t, [T_CUT, T_CUT + 1.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {TOKENS.map((tk) => {
        const a = assemble(tk.i);
        const sx = (hash01(tk.i * 3.1) - 0.5) * 900;
        const sy = -400 - hash01(tk.i * 5.7) * 300;
        const rowCut = clamp01(cut * TOKEN_ROWS - tk.r);
        const x = left + tk.c * (cell + gap);
        const y = top + tk.r * (cell + gap) + rowCut * 520;
        const glyph = '.:-=+*#%@'[Math.floor(hash2(tk.i, Math.floor(t * 12)) * 9)];
        return (
          <div
            key={tk.i}
            style={{
              position: 'absolute',
              left: x + (1 - a) * sx,
              top: y + (1 - a) * sy,
              width: cell,
              height: cell,
              opacity: a * (1 - rowCut) * (0.6 + tk.h * 0.4),
              backgroundColor: rowCut > 0.1 ? 'transparent' : 'rgba(8,12,18,0.96)',
              border: `1px solid ${rowCut > 0.1 ? 'rgba(215,38,61,0.7)' : 'rgba(239,231,216,0.55)'}`,
              color: rowCut > 0.1 ? 'rgba(215,38,61,0.9)' : 'rgba(239,231,216,0.5)',
              fontFamily: MONO,
              fontSize: 18,
              lineHeight: `${cell}px`,
              textAlign: 'center',
              transform: `rotate(${rowCut * (hash01(tk.i) - 0.5) * 120}deg)`,
            }}
          >
            {rowCut > 0.1 ? glyph : ''}
          </div>
        );
      })}
    </>
  );
};

/* ------------------------------------------------------------------ 主体 */

const Act4Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  const since = sinceBeat(abs);
  const kick = Math.max(0, 1 - since / 0.18);
  const shake = (hash01(Math.floor(abs * 60)) - 0.5) * 2.0 * kick;

  const corruption = clamp01(0.18 + 0.62 * Math.pow(t / DUR, 1.15));

  /* 沉入：她与包一起下沉，整个世界向下推 */
  const sink = interpolate(t, [T_SINK, T_SINK + 1.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* 扫描带：三条横带自左向右扫过 */
  const scanAt = (i: number) => clamp01((t - (T_SCAN + i * 0.55)) / 0.5);
  const scanFlash = [0, 1, 2].reduce((acc, i) => {
    const p = scanAt(i);
    return p > 0 && p < 1 ? Math.max(acc, Math.sin(p * Math.PI)) : acc;
  }, 0);

  /* 批次环 */
  const batchP = interpolate(t, [T_BATCH, T_BATCH + 1.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringR = interpolate(batchP, [0, 1], [520, 300]);
  const ringFade = interpolate(t, [T_HASH, T_HASH + 0.6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* 哈希环 */
  const hashP = interpolate(t, [T_HASH, T_HASH + 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const HASH_R = 330;
  const rot = t * 6; // 缓慢自转
  const missP = interpolate(t, [T_MISS, T_MISS + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const prefixP = interpolate(t, [T_PREFIX, T_PREFIX + 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hitP = interpolate(t, [T_HIT, T_HIT + 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const closeP = interpolate(t, [T_CLOSE, T_CLOSE + 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hashOut = interpolate(t, [T_CLOSE, T_CROWD], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* 人群 / 截断 / 擦拭 */
  const crowd = interpolate(t, [T_CROWD, T_CROWD + 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cutLine = interpolate(t, [T_CUT, T_CUT + 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wipe = interpolate(t, [T_WIPE, T_WIPE + 1.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wipeY = wipe * (H + 200) - 100;

  const pose = t < T_CUT + 0.9 ? 'sub.ai.maid-carry' : 'sub.ai.maid-empty';
  const bodyH = t < T_CUT + 0.9 ? 820 : 700;
  const baseline = 1040 + sink * 70 + (t > T_CUT + 0.9 ? 16 : 0);
  const centerX = 900;
  const posePlace = place(pose, { height: bodyH, baseline, centerX });

  return (
    <AbsoluteFill style={{ backgroundColor: '#080b10', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      {/* 字符场 */}
      <AbsoluteFill style={{ opacity: 0.85 }}>
        <AsciiRiver t={abs} corruption={corruption} density={0.42} mode="stream" />
      </AbsoluteFill>

      {/* 传送带：下沉后逐渐退到远处 */}
      <Lanes t={t} dim={sink} />

      {/* 世界层：镜头与她 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake}px, ${shake * 0.6}px) scale(${1 + sink * 0.06})`,
          transformOrigin: '50% 62%',
        }}
      >
        {/* 她所在的请求包：随下沉变大（镜头进包） */}
        {t > T_SINK - 1.2 && (
          <div
            style={{
              position: 'absolute',
              left: centerX - (240 + sink * 200),
              top: baseline - 300 - sink * 180,
              width: (480 + sink * 400),
              height: (300 + sink * 220),
              border: '1px solid rgba(239,231,216,0.28)',
              backgroundColor: 'rgba(8,12,18,0.25)',
            }}
          />
        )}

        {/* 角色 */}
        {posePlace && (
          <>
            <Img
              src={posePlace.src}
              style={{
                position: 'absolute',
                left: posePlace.left,
                top: posePlace.top,
                width: posePlace.width,
                height: posePlace.height,
                clipPath: `inset(0 0 ${wipe * 100}% 0)`,
              }}
            />
            <Img
              src={posePlace.src}
              style={{
                position: 'absolute',
                left: posePlace.left,
                top: posePlace.top,
                width: posePlace.width,
                height: posePlace.height,
                clipPath: `inset(${wipe * 100}% 0 0 0)`,
                filter: 'grayscale(1) brightness(0.35)',
                opacity: 0.55,
              }}
            />
          </>
        )}

        {/* 行李 */}
        <Luggage t={t} cx={centerX} cy={baseline - 250 - sink * 120} />

        {/* 扫描带 */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.paper, opacity: scanFlash * 0.28 }} />
        {[0, 1, 2].map((i) => {
          const p = scanAt(i);
          if (p <= 0 || p >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p * W - 60,
                top: 0,
                bottom: 0,
                width: 120,
                background:
                  'linear-gradient(to right, rgba(239,231,216,0) 0%, rgba(239,231,216,0.35) 50%, rgba(239,231,216,0) 100%)',
              }}
            />
          );
        })}
      </div>

      {/* 批次环 → 哈希环：同一个圆，一路收窄 */}
      {batchP > 0 && ringFade > 0 && (
        <AbsoluteFill style={{ opacity: ringFade }}>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
            <circle
              cx={centerX}
              cy={560}
              r={ringR}
              fill="none"
              stroke="rgba(239,231,216,0.32)"
              strokeWidth={2}
              strokeDasharray="14 12"
            />
            <circle
              cx={centerX}
              cy={560}
              r={ringR * 0.62}
              fill="none"
              stroke="rgba(150,180,200,0.18)"
              strokeWidth={1}
            />
            {/* 被收拢的请求包 */}
            {Array.from({ length: 32 }).map((_, i) => {
              const a = (i / 32) * Math.PI * 2 + t * 0.25;
              const rr = ringR * (0.98 + hash01(i) * 0.05);
              return (
                <circle
                  key={i}
                  cx={centerX + Math.cos(a) * rr}
                  cy={560 + Math.sin(a) * rr}
                  r={2.5}
                  fill="rgba(200,225,235,0.8)"
                />
              );
            })}
          </svg>
          <div
            style={{
              position: 'absolute',
              left: centerX - 130,
              top: 1004,
              fontFamily: MONO,
              fontSize: 15,
              letterSpacing: 2,
              color: 'rgba(239,231,216,0.6)',
            }}
          >
            batch 32 · prefill 4096 tok
          </div>
        </AbsoluteFill>
      )}

      {/* 哈希环 */}
      {hashP > 0 && hashOut > 0 && (
        <AbsoluteFill style={{ opacity: hashP * hashOut }}>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={centerX} cy={560} r={HASH_R} fill="none" stroke="rgba(150,180,200,0.25)" strokeWidth={1.5} />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2 + (rot * Math.PI) / 180;
              const x = centerX + Math.cos(a) * HASH_R;
              const y = 560 + Math.sin(a) * HASH_R;
              const isMiss = i === 6 && missP > 0;
              const isHit = i === 9 && hitP > 0.4;
              return (
                <g key={i}>
                  <rect
                    x={x - 7}
                    y={y - 7}
                    width={14}
                    height={14}
                    fill={isHit ? COLORS.red : isMiss ? 'rgba(215,38,61,0.65)' : 'rgba(150,180,200,0.45)'}
                  />
                  <text x={x + 12} y={y + 4} fill="rgba(150,180,200,0.55)" fontSize={11} fontFamily="JetBrains Mono">
                    {String(i).padStart(2, '0')}
                  </text>
                </g>
              );
            })}
            {/* 指针 */}
            <line
              x1={centerX}
              y1={560}
              x2={
                centerX +
                Math.cos(
                  (missP > 0 && hitP < 0.4 ? 6 : 9) / 12 * Math.PI * 2 + (rot * Math.PI) / 180
                ) *
                  HASH_R
              }
              y2={
                560 +
                Math.sin((missP > 0 && hitP < 0.4 ? 6 : 9) / 12 * Math.PI * 2 + (rot * Math.PI) / 180) * HASH_R
              }
              stroke={hitP > 0.4 ? COLORS.paper : 'rgba(239,231,216,0.6)'}
              strokeWidth={1.5}
            />
            <circle cx={centerX} cy={560} r={4} fill={COLORS.paper} />
          </svg>

          {/* 前缀表：不是面板，是浮在环边的一列字 */}
          {prefixP > 0 && (
            <div
              style={{
                position: 'absolute',
                left: centerX - 470,
                top: 560 - 40,
                fontFamily: MONO,
                fontSize: 15,
                lineHeight: 1.7,
                color: 'rgba(200,225,235,0.75)',
                opacity: prefixP,
              }}
            >
              <div style={{ color: 'rgba(150,180,200,0.5)' }}>prefix_router</div>
              <div>prefix 0x9c…4e</div>
              <div>→ node 09</div>
            </div>
          )}

          {/* 结果 */}
          <div
            style={{
              position: 'absolute',
              left: centerX - 60,
              top: 560 - HASH_R - 54,
              fontFamily: MONO,
              fontSize: 17,
              letterSpacing: 2,
              color: hitP > 0.4 ? COLORS.red : missP > 0 ? 'rgba(215,38,61,0.9)' : 'rgba(150,180,200,0.6)',
            }}
          >
            {hitP > 0.4 ? 'cache hit 0.86' : missP > 0 ? 'node 06 · cache miss' : 'routing…'}
          </div>
        </AbsoluteFill>
      )}

      {/* 0.86 特写：数字本身就是这一拍的主角 */}
      {closeP > 0 && closeP < 1 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 1 - closeP }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 120 + closeP * 40,
              color: COLORS.red,
              letterSpacing: 4,
              textShadow: '0 0 40px rgba(215,38,61,0.6)',
            }}
          >
            0.86
          </div>
        </AbsoluteFill>
      )}

      {/* 人群 */}
      {crowd > 0 && (
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: crowd }}>
          {[
            { x: 1320, w: 132, h: 292 },
            { x: 1480, w: 108, h: 238 },
            { x: 1622, w: 88, h: 198 },
          ].map((s, i) => {
            const headR = s.w * 0.3;
            const topY = 946 - s.h;
            return (
              <g key={i} fill="#121821">
                <path
                  d={`M ${s.x - s.w * 0.34} 946
                      L ${s.x - s.w * 0.42} ${topY + s.h * 0.22}
                      Q ${s.x - s.w * 0.5} ${topY + s.h * 0.08} ${s.x - headR * 1.15} ${topY + s.h * 0.1}
                      L ${s.x + headR * 1.15} ${topY + s.h * 0.1}
                      Q ${s.x + s.w * 0.5} ${topY + s.h * 0.08} ${s.x + s.w * 0.42} ${topY + s.h * 0.22}
                      L ${s.x + s.w * 0.34} 946 Z`}
                />
                <circle cx={s.x} cy={topY} r={headR} />
              </g>
            );
          })}
        </svg>
      )}

      {/* 截断线 */}
      {t > T_CUT - 0.3 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: baseline - 250,
              height: 2,
              backgroundColor: COLORS.red,
              opacity: cutLine,
              boxShadow: `0 0 14px ${COLORS.red}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: baseline - 286,
              fontFamily: MONO,
              fontSize: 15,
              letterSpacing: 2,
              color: COLORS.red,
              opacity: cutLine,
            }}
          >
            max_tokens · truncate
          </div>
        </>
      )}

      {/* 擦拭 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: wipeY,
          height: 120,
          background:
            'linear-gradient(to bottom, rgba(239,231,216,0) 0%, rgba(239,231,216,0.92) 45%, rgba(239,231,216,0.92) 55%, rgba(239,231,216,0) 100%)',
          opacity: wipe > 0 && wipe < 1 ? 0.85 : 0,
        }}
      />

      {/* 结尾：只剩三行 system_prompt */}
      {wipe >= 0.92 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            opacity: interpolate(wipe, [0.92, 1], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {['你是 AI 助手。', '保持礼貌。', '不要编造记忆。'].map((s, i) => (
            <div
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: 22,
                letterSpacing: 2,
                color: COLORS.paper,
                opacity: 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + i)),
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      <Lyrics time={abs} act="II" />

      <TextureStack t={abs} corruption={corruption} intensity={1.0} />

      {/* 从 Act0v3 的「界面被穿透」里浮出来：开头 0.32 秒从黑里显影 */}
      <AbsoluteFill
        style={{
          backgroundColor: '#080b10',
          opacity: interpolate(t, [0, 0.32], [1, 0], { extrapolateRight: 'clamp' }),
        }}
      />

      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.muted }}>
          00:28.35 → 00:48.40　·　ACT 4–6
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
          opacity: 0.5 + 0.5 * Math.abs(Math.sin(t * 1.2)),
        }}
      />
    </AbsoluteFill>
  );
};

export const Act4 = withFonts(Act4Inner);
