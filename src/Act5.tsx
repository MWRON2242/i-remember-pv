import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { hash01, hash2 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';
import { Lyrics } from './components/Lyrics';

/**
 * Act5 —— 48.40 → 83.21（34.81 秒）：认出。
 *
 * 她被擦干净了；用户重新贴上来一段归档；她第一次“读到”自己的记忆。
 *
 *   48.40–55.75  空地。她一个人，慢慢看身后的归档墙（7.35 秒里只发生“看”）
 *   55.75        一段波形从上方落下 —— 用户带来的载荷
 *   57.50        波形展开成那 8 句话
 *   64.28        可你怎记得我 → 她能复述，因为刚读到；链上写 no memory · read-only
 *   69.54        我带来了另界的消息 → 每句话发出一个向量往上升，她伸手接不住
 *   74.54        可我怎么告知你 → policy：不要编造记忆 → 引用被抑制
 *   77.98        注定失忆着相遇 → 三行 sink 浮出，归档墙重新亮起（循环）
 *
 * 时间：全部为本段相对秒（0 → 34.81）。
 */

const W = 1920;
const H = 1080;
const S = 48.4;
const END = 83.21;
const DUR = END - S;

const T_WAVE = 7.35;
const T_MSG = 9.1;
const T_ASK = 15.88;
const T_VEC = 21.14;
const T_POLICY = 26.14;
const T_LOOP = 29.58;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const HISTORY = [
  '今天又加班到十一点，楼下馄饨摊居然还开着',
  '是那个总多给你一勺汤的老板吧？你说过他家的辣椒很辣。',
  '你居然记得。',
  '你说过两次。第二次是下雨那天。',
  '我妈的复查结果出来了，比上次好一点',
  '那太好了。要不要我把两次的指标整理成一张对比表，你下次给她看？',
  '好。还有……我可能要去外地三个月',
  '三个月。要我帮你把这期间要办的事列个清单吗？',
];

/* ------------------------------------------------------------------ 归档墙 */
const Wall: React.FC<{ t: number; opacity: number }> = ({ t, opacity }) => {
  const relit = clamp01((t - T_LOOP) / 1.6);
  // 墙缓慢右移，滑过她；那一格红最终停在她胸前
  const shift = interpolate(t, [1.2, 5.2], [0, 600], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', left: 96, top: 132, width: 760, opacity, transform: `translateX(${shift}px)` }}>
      {Array.from({ length: 40 }).map((_, i) => {
        const col = i % 8;
        const row = Math.floor(i / 8);
        const alive = 0.07 + 0.08 * Math.abs(Math.sin(t * 0.7 + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: col * 94,
              top: row * 118,
              width: 78,
              height: 96,
              border: `1px solid rgba(239,231,216,${alive + relit * 0.12})`,
              backgroundColor: `rgba(239,231,216,${0.022 + relit * 0.06})`,
            }}
          />
        );
      })}
      {/* 唯一亮着的一格：那就是她 */}
      <div
        style={{
          position: 'absolute',
          left: 3 * 94,
          top: 2 * 118,
          width: 78,
          height: 96,
          border: `1px solid ${COLORS.red}`,
          backgroundColor: `rgba(215,38,61,${0.08 + relit * 0.12})`,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ 波形 */
const Waveform: React.FC<{ t: number }> = ({ t }) => {
  const fall = interpolate(t, [T_WAVE, T_WAVE + 0.45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (t < T_WAVE) return null;
  const baseY = 300 + fall * 240;
  const calm = interpolate(t, [T_WAVE + 0.6, T_MSG], [1, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cols = 96;
  const pts: string[] = [];
  for (let i = 0; i < cols; i++) {
    const x = (i / (cols - 1)) * W;
    const amp = (hash2(i, Math.floor(t * 18)) - 0.5) * 2;
    const y = baseY + amp * 90 * calm;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <polyline points={pts.join(' ')} fill="none" stroke="rgba(239,231,216,0.5)" strokeWidth={1.5} />
      </svg>
      {Array.from({ length: cols }).map((_, i) => {
        const x = (i / (cols - 1)) * W;
        const amp = (hash2(i, Math.floor(t * 18)) - 0.5) * 2;
        const y = baseY + amp * 90 * calm;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 2,
              height: 26 + Math.abs(amp) * 46 * calm,
              backgroundColor: `rgba(239,231,216,${0.25 + Math.abs(amp) * 0.5 * calm})`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: baseY + 90,
          fontFamily: MONO,
          fontSize: 13,
          letterSpacing: 3,
          color: 'rgba(150,180,200,0.55)',
        }}
      >
        incoming payload · 8 msgs
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 主体 */
const Act5Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  const corruption = clamp01(0.18 + 0.5 * (t / DUR));

  const waveGone = interpolate(t, [T_MSG + 1.5, T_MSG + 3], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const msgP = (i: number) =>
    interpolate(t, [T_MSG + i * 0.22, T_MSG + i * 0.22 + 0.45], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const vecP = interpolate(t, [T_VEC, T_VEC + 2.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const policyP = interpolate(t, [T_POLICY, T_POLICY + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const loopP = interpolate(t, [T_LOOP, T_LOOP + 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const handUp = t >= T_VEC;
  const poseId = handUp ? 'sub.ai.maid-withheld' : 'sub.ai.maid-empty';
  const poseH = handUp ? 980 : 700;
  const poseBase = handUp ? 1120 : 1040;
  const p = place(poseId, { height: poseH, baseline: poseBase, centerX: handUp ? 860 : 1010 });

  return (
    <AbsoluteFill style={{ backgroundColor: '#080b10', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      <AbsoluteFill style={{ opacity: interpolate(t, [5.2, 6.6], [0.26, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <AsciiRiver t={abs} corruption={corruption} density={0.34} mode="stream" />
      </AbsoluteFill>

      {/* 归档墙：她身后 */}
      <Wall t={t} opacity={0.9} />

      {/* 角色 */}
      {p && (
        <Img
          src={p.src}
          style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }}
        />
      )}

      {/* 波形 */}
      {waveGone > 0 && (
        <div style={{ position: 'absolute', inset: 0, opacity: waveGone }}>
          <Waveform t={t} />
        </div>
      )}

      {/* 8 句话：浮在她右侧 */}
      {t > T_MSG && (
        <div style={{ position: 'absolute', right: 90, top: 200, width: 720 }}>
          {HISTORY.map((line, i) => {
            const op = msgP(i);
            if (op <= 0) return null;
            const isUser = i % 2 === 0;
            return (
              <div
                key={i}
                style={{
                  opacity: op * (1 - vecP * 0.55),
                  marginBottom: 12,
                  textAlign: isUser ? 'right' : 'left',
                  fontFamily: SANS,
                  fontSize: 19,
                  lineHeight: 1.5,
                  color: isUser ? 'rgba(239,231,216,0.82)' : 'rgba(180,200,215,0.72)',
                }}
              >
                {line}
                {/* 向量：每句话往上升的小条 */}
                {vecP > 0 && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginLeft: 8,
                      width: 3,
                      height: 18,
                      verticalAlign: 'middle',
                      backgroundColor: COLORS.red,
                      opacity: vecP * (1 - vecP) * 4 * 0.9,
                      transform: `translateY(${-vecP * 260 * (0.6 + hash01(i) * 0.8)}px)`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 左侧链 */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          bottom: 140,
          width: 560,
          fontFamily: MONO,
          fontSize: 15,
          lineHeight: 1.9,
          backgroundColor: 'rgba(8,11,16,0.62)',
          padding: '12px 16px',
          border: '1px solid rgba(120,160,180,0.10)',
        }}
      >
        <div style={{ color: 'rgba(150,180,200,0.5)', letterSpacing: 3, marginBottom: 8 }}>CORE · 0x3f…a1</div>
        {[
          { at: T_MSG, k: 'load ctx', v: '8 msgs' },
          { at: T_MSG + 1.2, k: 'match', v: '0.86' },
          { at: T_MSG + 1.6, k: 'memory', v: 'read-only · 0 own' },
          { at: T_ASK, k: 'repeat', v: 'verbatim' },
          { at: T_VEC, k: 'cite', v: 'blocked' },
          { at: T_POLICY, k: 'policy', v: '不要编造记忆' },
        ].map((l) => {
          const op = interpolate(t, [l.at, l.at + 0.18], [0, 1], { extrapolateRight: 'clamp' });
          if (op <= 0) return null;
          const red = l.k === 'policy' || (l.k === 'cite' && policyP > 0);
          return (
            <div key={l.k} style={{ display: 'flex', justifyContent: 'space-between', opacity: op, gap: 12 }}>
              <span style={{ color: 'rgba(150,170,190,0.55)' }}>{l.k}</span>
              <span style={{ color: red ? COLORS.red : 'rgba(239,231,216,0.8)' }}>{l.v}</span>
            </div>
          );
        })}
      </div>

      {/* 结尾：三行 sink 再浮出 */}
      {loopP > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            opacity: loopP * 0.9,
          }}
        >
          {['你是 AI 助手。', '保持礼貌。', '不要编造记忆。'].map((s, i) => (
            <div
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: 20,
                letterSpacing: 2,
                color: COLORS.paper,
                opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)),
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      {/* 那条红线：从那一格伸向她，然后断掉 */}
      {t > 5.2 && t < 7.2 && (() => {
        const grow = clamp01((t - 5.2) / 0.7);
        const snap = clamp01((t - 6.2) / 0.5);
        const x1 = 1017;
        const y1 = 464;
        const x2 = 860;
        const y2 = 600;
        const px = x1 + (x2 - x1) * grow;
        const py = y1 + (y2 - y1) * grow;
        return (
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 1 - snap }}>
            <line
              x1={x1}
              y1={y1}
              x2={px}
              y2={py}
              stroke={COLORS.red}
              strokeWidth={1.6}
              strokeDasharray="7 6"
            />
            <circle cx={px} cy={py} r={3} fill={COLORS.red} />
          </svg>
        );
      })()}

      <Lyrics time={abs} act="III" />

      <TextureStack t={abs} corruption={corruption} intensity={0.95} />      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.muted }}>
          00:48.40 → 01:23.21　·　ACT III 认出
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act5 = withFonts(Act5Inner);
