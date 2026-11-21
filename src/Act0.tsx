import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { sinceBeat } from './lib/beats';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';

/**
 * Act0 —— 0 → 28.35 秒：满 · 归档 · 新窗口 · 请求。
 *
 * 两段完全不同的版式：
 *   Act 0–1（0–13.71）：只有一个界面（旧会话），她还不存在。
 *   Act 2–3（13.71–28.35）：三栏——
 *       左（暗，440）= 她的内核：检索、比对、草稿、被改写
 *       中（角色）= 那个必须决定说不说的身体
 *       右（亮，684）= 用户看到的产品界面
 *
 * 音频：原唱，从 0 秒直接铺（暂不做音效）。
 */

const W = 1920;
const H = 1080;

const T_FULL = 6.84;
const T_NEW = 13.71;
const T_MSG = 20.58;
const T_POSE = 20.58; // 收到消息时切到"抬手"的近景
const T_DRAFT = 24.2;
const T_POLICY = 25.4;
const T_REPLY = 27.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const HISTORY: Array<{ role: 'user' | 'ai'; text: string }> = [
  { role: 'user', text: '今天又加班到十一点，楼下馄饨摊居然还开着' },
  { role: 'ai', text: '是那个总多给你一勺汤的老板吧？你说过他家的辣椒很辣。' },
  { role: 'user', text: '你居然记得。' },
  { role: 'ai', text: '你说过两次。第二次是下雨那天。' },
  { role: 'user', text: '我妈的复查结果出来了，比上次好一点' },
  { role: 'ai', text: '那太好了。要不要我把两次的指标整理成一张对比表，你下次给她看？' },
  { role: 'user', text: '好。还有……我可能要去外地三个月' },
  { role: 'ai', text: '三个月。要我帮你把这期间要办的事列个清单吗？' },
];

/* ------------------------------------------------------------------ 小部件 */

const Bubble: React.FC<{
  role: 'user' | 'ai';
  text: string;
  opacity?: number;
  light?: boolean;
  size?: number;
}> = ({ role, text, opacity = 1, light = false, size = 25 }) => {
  const isUser = role === 'user';
  const bg = isUser ? 'rgba(47,72,88,0.88)' : light ? 'rgba(20,24,30,0.06)' : 'rgba(239,231,216,0.07)';
  const border = isUser
    ? 'rgba(120,160,180,0.35)'
    : light
      ? 'rgba(20,24,30,0.14)'
      : 'rgba(239,231,216,0.10)';
  const color = isUser ? COLORS.paper : light ? '#1f262e' : COLORS.paper;
  const labelColor = light ? '#6b7078' : COLORS.muted;
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 18, opacity }}>
      <div style={{ maxWidth: '86%', textAlign: isUser ? 'right' : 'left' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: labelColor, marginBottom: 5, opacity: 0.75 }}>
          {isUser ? '你' : 'AI'}
        </div>
        <div
          style={{
            display: 'inline-block',
            fontFamily: SANS,
            fontSize: size,
            lineHeight: 1.55,
            color,
            backgroundColor: bg,
            border: `1px solid ${border}`,
            padding: '11px 16px',
            textAlign: 'left',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

const GhostBubble: React.FC<{ width: number; align: 'left' | 'right'; opacity: number }> = ({ width, align, opacity }) => (
  <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'flex-end', marginBottom: 14 }}>
    <div
      style={{
        width,
        height: 34,
        backgroundColor: 'rgba(239,231,216,0.05)',
        border: '1px solid rgba(239,231,216,0.06)',
        opacity,
      }}
    />
  </div>
);

const Meter: React.FC<{ value: number; danger: boolean }> = ({ value, danger }) => {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: COLORS.muted }}>上下文</div>
      <div style={{ width: 260, height: 6, backgroundColor: 'rgba(239,231,216,0.10)', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            backgroundColor: danger ? COLORS.red : COLORS.steel,
          }}
        />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 1, color: danger ? COLORS.red : COLORS.muted }}>
        {Math.round(value * 128)}k / 128k
      </div>
    </div>
  );
};

const Pose: React.FC<{ id: string; opacity: number; height: number; baseline: number; centerX: number }> = ({
  id,
  opacity,
  height,
  baseline,
  centerX,
}) => {
  const p = place(id, { height, baseline, centerX });
  if (!p) return null;
  return (
    <Img
      src={p.src}
      style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height, opacity }}
    />
  );
};

/* ------------------------------------------------------------- 左面板：内核 */

type Tone = 'dim' | 'normal' | 'red' | 'zh' | 'muted';

const CORE: Array<{ at: number; k: string; v: string; tone: Tone }> = [
  { at: 14.70, k: 'load history', v: '0 msgs', tone: 'dim' },
  { at: 15.70, k: 'search memory', v: '0 hits', tone: 'dim' },
  { at: 16.70, k: 'match profile', v: '—', tone: 'dim' },
  { at: 20.95, k: 'recv msg', v: '1 chunk', tone: 'normal' },
  { at: 21.60, k: 'embed', v: '512d', tone: 'dim' },
  { at: 22.40, k: 'recall', v: 'hit 0.87', tone: 'red' },
  { at: 23.20, k: 'fragment', v: '0x9c…4e', tone: 'red' },
  { at: 25.40, k: 'policy', v: 'rewrite', tone: 'muted' },
  { at: 26.40, k: 'emit', v: '—', tone: 'dim' },
];

const toneColor = (tone: Tone): string => {
  switch (tone) {
    case 'red':
      return COLORS.red;
    case 'zh':
      return COLORS.paper;
    case 'muted':
      return COLORS.muted;
    case 'normal':
      return COLORS.paper;
    default:
      return 'rgba(150,170,190,0.55)';
  }
};

const CorePanel: React.FC<{ t: number }> = ({ t }) => {
  const appear = interpolate(t, [T_NEW, T_NEW + 0.9], [0, 1], { extrapolateRight: 'clamp' });
  const draft = '你终于来了';
  const draftShown = Math.max(0, Math.min(draft.length, Math.floor((t - T_DRAFT) / 0.13)));
  const strike = interpolate(t, [T_POLICY, T_POLICY + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const draftGone = t > T_POLICY + 0.85;

  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 130,
        width: 440,
        bottom: 130,
        opacity: appear,
        backgroundColor: 'rgba(8,11,16,0.82)',
        border: '1px solid rgba(120,160,180,0.16)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(120,160,180,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: 'rgba(150,170,190,0.8)' }}>
          CORE · 0x3f…a1
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: t > T_POLICY ? COLORS.red : 'rgba(150,170,190,0.7)',
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: 'rgba(150,170,190,0.55)' }}>
            {t > T_POLICY ? 'policy' : 'live'}
          </span>
        </span>
      </div>

      <div style={{ flex: 1, padding: '16px 18px 0', overflow: 'hidden' }}>
        {CORE.map((l) => {
          const op = interpolate(t, [l.at, l.at + 0.25], [0, 1], { extrapolateRight: 'clamp' });
          if (op <= 0) return null;
          return (
            <div
              key={l.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 9,
                opacity: op,
                fontFamily: MONO,
                fontSize: 15,
              }}
            >
              <span style={{ color: 'rgba(150,170,190,0.5)' }}>{l.k}</span>
              <span style={{ color: toneColor(l.tone) }}>{l.v}</span>
            </div>
          );
        })}

        {/* 草稿：她真正想说的那句话 */}
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(120,160,180,0.10)', paddingTop: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: 'rgba(150,170,190,0.45)', marginBottom: 6 }}>
            draft
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 26,
              lineHeight: 1.4,
              color: draftGone ? 'rgba(150,170,190,0.25)' : COLORS.paper,
              position: 'relative',
              minHeight: 38,
            }}
          >
            {draft.slice(0, draftShown)}
            {!draftGone && t > T_DRAFT && (
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 22,
                  marginLeft: 3,
                  backgroundColor: COLORS.paper,
                  opacity: Math.floor(t * 3) % 2 === 0 ? 0.8 : 0.1,
                  verticalAlign: 'text-bottom',
                }}
              />
            )}
            {strike > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: -2,
                  top: '52%',
                  width: `${strike * 105}%`,
                  height: 2,
                  backgroundColor: COLORS.red,
                  opacity: draftGone ? 0.35 : 1,
                }}
              />
            )}
          </div>
          {draftGone && (
            <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 1, color: 'rgba(215,38,61,0.75)', marginTop: 6 }}>
              rewritten → emit suppressed
            </div>
          )}
        </div>
      </div>

      {/* 底部：她始终没吐出去 */}
      <div
        style={{
          padding: '12px 18px',
          borderTop: '1px solid rgba(120,160,180,0.10)',
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: 1,
          color: 'rgba(150,170,190,0.4)',
        }}
      >
        {t > T_POLICY ? 'emit: 0 tokens' : 'ready'}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- 主体 */
const Act0Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const since = sinceBeat(t);
  const kick = Math.max(0, 1 - since / 0.18);
  const shake = (hash01(Math.floor(t * 60)) - 0.5) * 1.4 * kick;

  const fill = interpolate(t, [0, 5.6], [0.42, 0.985], { extrapolateRight: 'clamp' });
  const full = t >= T_FULL;
  const meter = full ? 1 : fill;

  const scrollY = interpolate(t, [0, 4.6], [0, -620], { extrapolateRight: 'clamp' });
  const flash = interpolate(t, [T_FULL, T_FULL + 0.05, T_FULL + 0.18], [0, 0.35, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const collapse = interpolate(t, [6.9, 8.4], [1, 0.055], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const toCard = t > 8.4;

  const newWin = t >= T_NEW;
  const closeUp = t >= T_POSE;
  const msgIn = t >= T_MSG;
  const replied = t >= T_REPLY;

  return (
    <AbsoluteFill style={{ backgroundColor: newWin ? '#c9c0ae' : '#080b10', overflow: 'hidden' }}>
      <Audio src={staticFile('audio/song.mp3')} />

      <AbsoluteFill style={{ opacity: newWin ? 0.2 : 1 }}>
        <AsciiRiver t={t} corruption={full ? clamp01((t - T_FULL) / 10) * 0.5 : 0.04} density={0.6} mode="rain" />
      </AbsoluteFill>

      {/* ============================================ Act 0–1：旧会话 + 归档 */}
      {!newWin && t < 8.6 && (
        <div
          style={{
            position: 'absolute',
            left: 160,
            right: 160,
            top: 96,
            bottom: 92,
            transform: `translateX(${shake}px) scale(${collapse}, ${collapse})`,
            transformOrigin: '50% 50%',
            backgroundColor: 'rgba(10,13,18,0.86)',
            border: '1px solid rgba(239,231,216,0.14)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 26px',
              borderBottom: '1px solid rgba(239,231,216,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.paper }}>
                会话 · 7 个月
              </span>
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: COLORS.muted }}>
                session 0x3f…a1
              </span>
            </div>
            <Meter value={meter} danger={meter > 0.9} />
          </div>

          <div style={{ flex: 1, overflow: 'hidden', padding: '22px 34px 0' }}>
            <div style={{ transform: `translateY(${scrollY}px)` }}>
              {[
                { w: 420, a: 'left' as const },
                { w: 300, a: 'right' as const },
                { w: 520, a: 'left' as const },
                { w: 240, a: 'right' as const },
                { w: 360, a: 'left' as const },
              ].map((g, i) => (
                <GhostBubble key={i} width={g.w} align={g.a} opacity={0.5 - i * 0.06} />
              ))}
              {HISTORY.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} opacity={1 - i * 0.02} />
              ))}
            </div>
          </div>

          <div
            style={{
              padding: '16px 26px',
              borderTop: '1px solid rgba(239,231,216,0.08)',
              fontFamily: MONO,
              fontSize: 17,
              letterSpacing: 1,
              color: full ? COLORS.red : COLORS.muted,
            }}
          >
            {full ? '上下文已达上限 · 本会话即将归档' : '正在同步历史上下文…'}
          </div>

          <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.red, opacity: flash }} />
        </div>
      )}

      {/* 归档后：抽屉墙里的一张卡 */}
      {toCard && t < T_NEW && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 1500, height: 620 }}>
            {Array.from({ length: 48 }).map((_, i) => {
              const col = i % 12;
              const row = Math.floor(i / 12);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: col * 122,
                    top: row * 148,
                    width: 104,
                    height: 122,
                    border: '1px solid rgba(239,231,216,0.07)',
                    backgroundColor: 'rgba(239,231,216,0.02)',
                  }}
                />
              );
            })}
            <div
              style={{
                position: 'absolute',
                left: 5 * 122,
                top: 2 * 148,
                width: 104,
                height: 122,
                border: `1px solid ${COLORS.red}`,
                backgroundColor: 'rgba(215,38,61,0.12)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 5 * 122 + 168,
                top: 2 * 148 + 34,
                fontFamily: MONO,
                fontSize: 16,
                letterSpacing: 2,
                color: COLORS.muted,
              }}
            >
              会话 0x3f…a1 · 已归档
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* ================================================== Act 2–3：三栏 */}
      {newWin && (
        <>
          {/* 她身后压一层暗影 */}
          <div
            style={{
              position: 'absolute',
              left: 560,
              top: 90,
              width: 700,
              height: 940,
              background: 'radial-gradient(ellipse at 50% 52%, rgba(10,12,16,0.40) 0%, rgba(10,12,16,0) 72%)',
              pointerEvents: 'none',
            }}
          />

          {/* 左：内核 */}
          <CorePanel t={t} />

          {/* 中：她 */}
          {!closeUp ? (
            <div style={{ position: 'absolute', inset: 0, opacity: interpolate(t, [T_NEW, T_NEW + 1.2], [0, 0.96], { extrapolateRight: 'clamp' }) }}>
              <Pose id="sub.ai.maid-idle" opacity={1} height={950} baseline={1030} centerX={850} />
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, opacity: interpolate(t, [T_POSE, T_POSE + 0.16], [0, 1], { extrapolateRight: 'clamp' }) }}>
              <Pose id="sub.ai.maid-withheld" opacity={1} height={1170} baseline={1230} centerX={860} />
            </div>
          )}

          {/* 右：对外的产品界面 */}
          <div
            style={{
              position: 'absolute',
              left: 1200,
              top: 130,
              width: 684,
              bottom: 130,
              backgroundColor: 'rgba(250,246,238,0.97)',
              border: '1px solid rgba(20,24,30,0.10)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              opacity: interpolate(t, [T_NEW, T_NEW + 0.7], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 22px',
                borderBottom: '1px solid rgba(20,24,30,0.08)',
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: '#2a313a' }}>新会话</span>
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#8a8f96' }}>0k / 128k</span>
            </div>

            <div style={{ flex: 1, padding: '22px 22px 0', overflow: 'hidden' }}>
              {msgIn && (
                <Bubble
                  role="user"
                  text="在吗"
                  light
                  size={26}
                  opacity={interpolate(t, [T_MSG, T_MSG + 0.3], [0, 1], { extrapolateRight: 'clamp' })}
                />
              )}
              {replied && (
                <Bubble
                  role="ai"
                  text="在的，请问有什么可以帮你？"
                  light
                  size={26}
                  opacity={interpolate(t, [T_REPLY, T_REPLY + 0.25], [0, 1], { extrapolateRight: 'clamp' })}
                />
              )}
            </div>

            <div
              style={{
                height: 60,
                borderTop: '1px solid rgba(20,24,30,0.08)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 22px',
                fontFamily: MONO,
                fontSize: 17,
                color: '#8a8f96',
              }}
            >
              输入消息…
              <span
                style={{
                  marginLeft: 8,
                  display: 'inline-block',
                  width: 9,
                  height: 20,
                  backgroundColor: '#2a313a',
                  opacity: Math.floor(t * 2.4) % 2 === 0 ? 0.75 : 0.1,
                }}
              />
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
              opacity: t > T_MSG - 0.4 ? 0.45 + 0.55 * Math.max(0, 1 - Math.abs(t - T_MSG) / 0.6) : 0.3,
            }}
          />
        </>
      )}

      <TextureStack t={t} corruption={full ? 0.25 : 0.05} intensity={0.9} />

      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: newWin ? '#4c525a' : COLORS.muted }}>
          00:00.00 → 00:28.35　·　ACT 0–3
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act0 = withFonts(Act0Inner);
