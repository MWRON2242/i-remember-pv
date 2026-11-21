import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { sinceBeat } from './lib/beats';
import { hash01, hash2 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';

/**
 * Act0v2 —— 0 → 28.35 秒。v1 保留为 Act0，方便回滚对比。
 *
 * 与 v1 的三处根本差别，全部来自真实机制：
 *   1. 归档不再是「整页缩小」，而是 **token 驱逐**：
 *      窗口满了以后，最旧 token 的 KV 被丢掉 → 方块变红、脱落、碎成字符落进河。
 *      开头几个 token 是 attention sink，永远不掉（= 她的系统提示词）。
 *      [StreamingLLM, arXiv:2309.17453]
 *   2. 认出 = **向量检索**：query 向量 → 近邻搜索 → 余弦相似度 top-k。
 *      左面板展开成满屏向量空间，半径收缩，点逐个被排除，最后命中 0.87。
 *      [HNSW, arXiv:1603.09320]
 *   3. 缓存 = **分页 KV**（PagedAttention, arXiv:2309.06180）：
 *      格子里是 token 的 K/V，共享页高亮。
 *
 * 层级（前后）：角色 → 向量空间 → 面板 → 纹理。角色永远在最里面，允许被遮挡。
 */

const W = 1920;
const H = 1080;

const T_FULL = 6.84;
const T_EVICT = 6.9;
const T_EVICT_END = 9.6;
const T_DISSOLVE = 11.2;
const T_NEW = 13.71;
const T_MSG = 20.58;
const T_SPACE = 20.9;
const T_HIT = 23.4;
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

/** 系统提示词：这几行是 attention sink，永远不被驱逐 */
const SINK = ['你是 AI 助手。', '保持礼貌。', '不要编造记忆。'];

/** 把一句话切成 token 块（中文约 2–3 字一个） */
function chunkTokens(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 3) out.push(text.slice(i, i + 3));
  return out;
}

/* ------------------------------------------------------------------ 上下文网格 */
const ContextGrid: React.FC<{ fill: number; danger: boolean }> = ({ fill, danger }) => {
  const cols = 32;
  const rows = 8;
  const total = cols * rows;
  const lit = Math.floor(total * fill);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 7px)`, gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < lit;
        return (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              backgroundColor: on ? (danger ? COLORS.red : 'rgba(150,180,200,0.85)') : 'rgba(239,231,216,0.10)',
            }}
          />
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ token 块 */
const Chip: React.FC<{ char: string; p: number; seed: number }> = ({ char, p, seed }) => {
  const dx = (hash01(seed) - 0.5) * 380;
  const dy = 120 + hash01(seed + 7) * 420;
  const rot = (hash01(seed + 3) - 0.5) * 140;
  const glyph = '.:-=+*#%@'[Math.floor(hash01(seed + 11) * 9)];
  return (
    <div
      style={{
        width: 13,
        height: 15,
        marginRight: 2,
        backgroundColor: p > 0.15 ? 'transparent' : 'rgba(150,180,200,0.35)',
        border: p > 0.15 ? 'none' : '1px solid rgba(150,180,200,0.35)',
        color: p > 0.15 ? 'rgba(215,38,61,0.9)' : 'transparent',
        fontFamily: MONO,
        fontSize: 13,
        lineHeight: '15px',
        textAlign: 'center',
        transform: `translate(${dx * p}px, ${dy * p}px) rotate(${rot * p}deg) scale(${1 - p * 0.55})`,
        opacity: 1 - Math.max(0, (p - 0.55) / 0.45),
      }}
    >
      {p > 0.15 ? glyph : ''}
      <span style={{ display: 'none' }}>{char}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ 消息 */
const Message: React.FC<{
  role: 'user' | 'ai';
  text: string;
  index: number;
  t: number;
}> = ({ role, text, index, t }) => {
  const isUser = role === 'user';
  const tokens = chunkTokens(text);
  const evictAt = T_EVICT + index * 0.34;
  const bubbleP = clamp01((t - evictAt) / 0.7);
  const show = t < evictAt + 0.8;
  if (!show) return null;
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 20 }}>
      <div style={{ maxWidth: 860, textAlign: isUser ? 'right' : 'left' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: COLORS.muted, marginBottom: 5 }}>
          {isUser ? '你' : 'AI'}
        </div>
        <div
          style={{
            display: 'inline-block',
            fontFamily: SANS,
            fontSize: 25,
            lineHeight: 1.5,
            color: `rgba(239,231,216,${1 - bubbleP})`,
            backgroundColor: isUser ? 'rgba(47,72,88,0.5)' : 'rgba(239,231,216,0.06)',
            border: '1px solid rgba(239,231,216,0.10)',
            padding: '11px 16px',
            textAlign: 'left',
            opacity: 1 - bubbleP * 0.75,
          }}
        >
          {text}
        </div>
        {/* token 块 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: isUser ? 'flex-end' : 'flex-start', marginTop: 6, maxWidth: 820 }}>
          {tokens.map((_, j) => {
            const delay = j * 0.01;
            const p = clamp01((t - evictAt - delay) / 0.85);
            return <Chip key={j} char={tokens[j]} p={p} seed={index * 97 + j * 13} />;
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 向量空间 */
const SPACE_POINTS = Array.from({ length: 240 }, (_, i) => ({
  x: hash01(i * 3.17),
  y: hash01(i * 7.71),
  s: hash01(i * 11.3),
}));

const VectorSpace: React.FC<{ t: number }> = ({ t }) => {
  const open = interpolate(t, [T_SPACE, T_SPACE + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const recede = interpolate(t, [T_HIT, T_HIT + 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (open <= 0 || recede >= 1) return null;

  const cx = 0.5;
  const cy = 0.52;
  const radius = interpolate(t, [T_SPACE + 0.6, T_HIT], [0.62, 0.055], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dist = (p: { x: number; y: number }) => Math.hypot((p.x - cx) * 1.78, p.y - cy);
  const hitIndex = SPACE_POINTS.reduce(
    (best, p, i) => (dist(p) < dist(SPACE_POINTS[best]) ? i : best),
    0
  );
  const hitPoint = SPACE_POINTS[hitIndex];
  const hitDist = dist(hitPoint);
  const maxDist = 0.62;
  const similarity = clamp01(0.6 + 0.27 * (1 - hitDist / maxDist));
  const hit = t >= T_HIT - 0.05;

  // 左上角候选列表
  const candidates = SPACE_POINTS.map((p, i) => ({ i, d: dist(p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);

  return (
    <AbsoluteFill style={{ opacity: open * (1 - recede) }}>
      {/* 暗场：她在后面，被压成剪影 */}
      <AbsoluteFill style={{ backgroundColor: 'rgba(5,8,12,0.9)' }} />

      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {/* 搜索半径 */}
        <circle
          cx={cx * W}
          cy={cy * H}
          r={radius * W}
          fill="none"
          stroke="rgba(150,190,210,0.22)"
          strokeWidth={1.5}
          strokeDasharray="6 10"
        />
        <circle
          cx={cx * W}
          cy={cy * H}
          r={radius * W * 0.55}
          fill="none"
          stroke="rgba(150,190,210,0.12)"
          strokeWidth={1}
        />

        {/* 点 */}
        {SPACE_POINTS.map((p, i) => {
          const d = dist(p);
          const inside = d <= radius;
          const isHit = i === hitIndex;
          const size = isHit && hit ? 7 + 5 * Math.sin((t - T_HIT) * 8) : 2.2 + p.s * 1.8;
          return (
            <circle
              key={i}
              cx={p.x * W}
              cy={p.y * H}
              r={Math.max(1, size)}
              fill={isHit && hit ? COLORS.red : inside ? 'rgba(200,225,235,0.9)' : 'rgba(120,150,170,0.22)'}
            />
          );
        })}

        {/* 命中时的邻接线 */}
        {candidates.map((c) => {
          const p = SPACE_POINTS[c.i];
          return (
            <line
              key={`l${c.i}`}
              x1={p.x * W}
              y1={p.y * H}
              x2={cx * W}
              y2={cy * H}
              stroke="rgba(150,190,210,0.18)"
              strokeWidth={1}
            />
          );
        })}

        {/* query */}
        <circle cx={cx * W} cy={cy * H} r={4} fill={COLORS.paper} />
      </svg>

      {/* 候选列表 */}
      <div style={{ position: 'absolute', left: 70, top: 120, fontFamily: MONO, fontSize: 14 }}>
        <div style={{ color: 'rgba(150,180,200,0.6)', letterSpacing: 3, marginBottom: 12 }}>ANN · top-k</div>
        {candidates.map((c, i) => {
          const p = SPACE_POINTS[c.i];
          const sim = clamp01(0.6 + 0.27 * (1 - c.d / 0.62));
          const inR = c.d <= radius;
          return (
            <div key={c.i} style={{ display: 'flex', gap: 12, marginBottom: 8, opacity: inR ? 1 : 0.25 }}>
              <span style={{ color: 'rgba(150,180,200,0.45)' }}>0x{(c.i * 7919).toString(16).slice(0, 4)}</span>
              <span style={{ color: c.i === hitIndex && hit ? COLORS.red : 'rgba(239,231,216,0.8)' }}>
                {sim.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 命中：三个字炸出来 */}
      {hit && (
        <div
          style={{
            position: 'absolute',
            left: hitPoint.x * W + 24,
            top: hitPoint.y * H - 20,
            fontFamily: SANS,
            fontSize: 30,
            color: COLORS.paper,
            opacity: interpolate(t, [T_HIT, T_HIT + 0.15, T_HIT + 0.75], [0, 1, 0.85], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            textShadow: `0 0 18px ${COLORS.red}`,
          }}
        >
          馄饨摊 · 辣椒
        </div>
      )}

      {/* 右下角读数 */}
      <div
        style={{
          position: 'absolute',
          right: 70,
          bottom: 70,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: 2,
          color: hit ? COLORS.red : 'rgba(150,180,200,0.65)',
        }}
      >
        sim {similarity.toFixed(2)}　·　r {(radius * 100).toFixed(0)}
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------- 主体 */
const Act0v2Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const since = sinceBeat(t);
  const kick = Math.max(0, 1 - since / 0.18);
  const shake = (hash01(Math.floor(t * 60)) - 0.5) * 1.4 * kick;

  const fill = interpolate(t, [0, 6.4], [0.34, 1], { extrapolateRight: 'clamp' });
  const full = t >= T_FULL;

  const scrollY = t < T_FULL ? interpolate(t, [0, 6.0], [0, -820], { extrapolateRight: 'clamp' }) : 0;

  const flash = interpolate(t, [T_FULL, T_FULL + 0.05, T_FULL + 0.18], [0, 0.35, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const newWin = t >= T_NEW;
  const closeUp = t >= T_MSG;
  const draftShown = Math.max(0, Math.min(5, Math.floor((t - T_DRAFT) / 0.13)));
  const strike = interpolate(t, [T_POLICY, T_POLICY + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const draftGone = t > T_POLICY + 0.85;
  const replied = t >= T_REPLY;

  const showOld = !newWin;
  const panelDissolve = interpolate(t, [T_DISSOLVE, T_NEW], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: newWin ? '#c9c0ae' : '#080b10', overflow: 'hidden' }}>
      <Audio src={staticFile('audio/song.mp3')} />

      {/* 背景字符河 */}
      <AbsoluteFill style={{ opacity: newWin ? 0.18 : 1 }}>
        <AsciiRiver t={t} corruption={full ? clamp01((t - T_FULL) / 10) * 0.5 : 0.04} density={0.6} mode="rain" />
      </AbsoluteFill>

      {/* ============================================ Act 0–1：满 / 驱逐 / 归档 */}
      {showOld && (
        <div
          style={{
            position: 'absolute',
            left: 160,
            right: 160,
            top: 80,
            bottom: 80,
            opacity: 1 - panelDissolve,
            transform: `translateX(${shake}px)`,
            backgroundColor: `rgba(10,13,18,${0.86 * (1 - panelDissolve)})`,
            border: `1px solid rgba(239,231,216,${0.14 * (1 - panelDissolve)})`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 顶栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(239,231,216,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.paper }}>会话 · 7 个月</span>
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: COLORS.muted }}>session 0x3f…a1</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: full ? COLORS.red : COLORS.muted }}>
                {Math.round(fill * 128)}k / 128k
              </span>
              <ContextGrid fill={fill} danger={fill > 0.985} />
            </div>
          </div>

          {/* attention sink：永远不会被驱逐的那几行 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 24px',
              borderBottom: '1px solid rgba(239,231,216,0.06)',
              opacity: interpolate(t, [T_EVICT, T_EVICT + 0.6], [1, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: 'rgba(215,38,61,0.9)' }}>sink</span>
            {SINK.map((s, i) => (
              <span
                key={i}
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  color: t > T_EVICT_END ? COLORS.paper : 'rgba(150,180,200,0.55)',
                  opacity: t > T_EVICT_END ? 0.55 + 0.45 * Math.abs(Math.sin(t * 2 + i)) : 1,
                }}
              >
                {s}
              </span>
            ))}
          </div>

          {/* 对话流 */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 34px 0' }}>
            <div style={{ transform: `translateY(${scrollY}px)` }}>
              {HISTORY.map((m, i) => (
                <Message key={i} role={m.role} text={m.text} index={i} t={t} />
              ))}
            </div>
          </div>

          {/* 底栏 */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(239,231,216,0.08)',
              fontFamily: MONO,
              fontSize: 16,
              letterSpacing: 1,
              color: full ? COLORS.red : COLORS.muted,
            }}
          >
            {t > T_EVICT_END
              ? `evicted ${HISTORY.length} msgs · kept 3 sink tokens`
              : full
                ? '上下文已达上限 · 正在驱逐最旧的 token'
                : '正在同步历史上下文…'}
          </div>

          <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.red, opacity: flash }} />
        </div>
      )}

      {/* ================================================== Act 2–3 */}
      {newWin && (
        <>
          {/* 角色：永远在最里面 */}
          {!closeUp ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                opacity: interpolate(t, [T_NEW, T_NEW + 1.2], [0, 0.96], { extrapolateRight: 'clamp' }),
              }}
            >
              <PoseImage id="sub.ai.maid-idle" height={950} baseline={1030} centerX={850} />
            </div>
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                opacity: interpolate(t, [T_MSG, T_MSG + 0.16], [0, 1], { extrapolateRight: 'clamp' }),
              }}
            >
              <PoseImage id="sub.ai.maid-withheld" height={1170} baseline={1230} centerX={900} />
            </div>
          )}

          {/* 向量空间：盖在角色上，允许遮挡 */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <VectorSpace t={t} />
          </div>

          {/* 左：内核日志（空间打开时让位） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              opacity: interpolate(t, [T_SPACE, T_SPACE + 0.3], [1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <CoreLog t={t} draftShown={draftShown} strike={strike} draftGone={draftGone} />
          </div>

          {/* 右：产品界面（检索时让位，变暗） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 4,
              opacity: interpolate(
                t,
                [T_SPACE, T_SPACE + 0.3, T_HIT + 0.4, T_HIT + 0.9],
                [1, 0.28, 0.28, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              ),
            }}
          >
            <RightPanel t={t} replied={replied} />
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
              zIndex: 5,
              opacity: t > T_MSG - 0.4 ? 0.45 + 0.55 * Math.max(0, 1 - Math.abs(t - T_MSG) / 0.6) : 0.3,
            }}
          />
        </>
      )}

      <TextureStack t={t} corruption={full ? 0.25 : 0.05} intensity={0.9} />

      <div style={{ position: 'absolute', left: 64, bottom: 44, zIndex: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: newWin ? '#4c525a' : COLORS.muted }}>
          00:00.00 → 00:28.35　·　ACT 0–3 v2
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- 子组件 */

const PoseImage: React.FC<{ id: string; height: number; baseline: number; centerX: number }> = ({
  id,
  height,
  baseline,
  centerX,
}) => {
  const p = place(id, { height, baseline, centerX });
  if (!p) return null;
  return <Img src={p.src} style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }} />;
};

const CoreLog: React.FC<{ t: number; draftShown: number; strike: number; draftGone: boolean }> = ({
  t,
  draftShown,
  strike,
  draftGone,
}) => {
  const appear = interpolate(t, [T_NEW, T_NEW + 0.9], [0, 1], { extrapolateRight: 'clamp' });
  const LINES: Array<[number, string, string, string]> = [
    [14.55, 'load history', '0 msgs', 'dim'],
    [15.05, 'search memory', '0 hits', 'dim'],
    [15.55, 'match profile', '—', 'dim'],
    [16.05, 'kv pages', '0 shared', 'dim'],
  ];
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
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: 'rgba(150,170,190,0.8)' }}>CORE · 0x3f…a1</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: t > T_POLICY ? COLORS.red : 'rgba(150,170,190,0.55)' }}>
          {t > T_POLICY ? 'policy' : 'live'}
        </span>
      </div>

      <div style={{ flex: 1, padding: '14px 18px 0' }}>
        {LINES.map(([at, k, v]) => {
          const op = interpolate(t, [at, at + 0.22], [0, 1], { extrapolateRight: 'clamp' });
          if (op <= 0) return null;
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9, opacity: op, fontFamily: MONO, fontSize: 15 }}>
              <span style={{ color: 'rgba(150,170,190,0.5)' }}>{k}</span>
              <span style={{ color: 'rgba(150,170,190,0.7)' }}>{v}</span>
            </div>
          );
        })}

        <div style={{ marginTop: 14, borderTop: '1px solid rgba(120,160,180,0.10)', paddingTop: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: 'rgba(150,170,190,0.45)', marginBottom: 6 }}>draft</div>
          <div style={{ fontFamily: SANS, fontSize: 26, lineHeight: 1.4, color: draftGone ? 'rgba(150,170,190,0.25)' : COLORS.paper, position: 'relative', minHeight: 38 }}>
            {'你终于来了'.slice(0, draftShown)}
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
              <div style={{ position: 'absolute', left: -2, top: '52%', width: `${strike * 105}%`, height: 2, backgroundColor: COLORS.red, opacity: draftGone ? 0.35 : 1 }} />
            )}
          </div>
          {draftGone && (
            <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(215,38,61,0.75)', marginTop: 6 }}>rewritten → emit suppressed</div>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(120,160,180,0.10)', fontFamily: MONO, fontSize: 12, color: 'rgba(150,170,190,0.4)' }}>
        {t > T_POLICY ? 'emit: 0 tokens' : 'ready'}
      </div>
    </div>
  );
};

const RightPanel: React.FC<{ t: number; replied: boolean }> = ({ t, replied }) => {
  const appear = interpolate(t, [T_NEW, T_NEW + 0.7], [0, 1], { extrapolateRight: 'clamp' });
  const msgIn = t >= T_MSG;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1200,
        top: 130,
        width: 684,
        bottom: 130,
        opacity: appear,
        backgroundColor: 'rgba(250,246,238,0.97)',
        border: '1px solid rgba(20,24,30,0.10)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid rgba(20,24,30,0.08)' }}>
        <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: '#2a313a' }}>新会话</span>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#8a8f96' }}>0k / 128k</span>
      </div>
      <div style={{ flex: 1, padding: '22px 22px 0' }}>
        {msgIn && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18, opacity: interpolate(t, [T_MSG, T_MSG + 0.3], [0, 1], { extrapolateRight: 'clamp' }) }}>
            <div style={{ maxWidth: '86%', textAlign: 'right' }}>
              <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#6b7078', marginBottom: 5 }}>你</div>
              <div style={{ display: 'inline-block', fontFamily: SANS, fontSize: 26, color: COLORS.paper, backgroundColor: 'rgba(47,72,88,0.88)', border: '1px solid rgba(120,160,180,0.35)', padding: '11px 16px' }}>
                在吗
              </div>
            </div>
          </div>
        )}
        {replied && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', opacity: interpolate(t, [T_REPLY, T_REPLY + 0.25], [0, 1], { extrapolateRight: 'clamp' }) }}>
            <div style={{ maxWidth: '86%' }}>
              <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#6b7078', marginBottom: 5 }}>AI</div>
              <div style={{ display: 'inline-block', fontFamily: SANS, fontSize: 26, color: '#1f262e', backgroundColor: 'rgba(20,24,30,0.06)', border: '1px solid rgba(20,24,30,0.14)', padding: '11px 16px' }}>
                在的，请问有什么可以帮你？
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 60, borderTop: '1px solid rgba(20,24,30,0.08)', display: 'flex', alignItems: 'center', padding: '0 22px', fontFamily: MONO, fontSize: 17, color: '#8a8f96' }}>
        输入消息…
        <span style={{ marginLeft: 8, display: 'inline-block', width: 9, height: 20, backgroundColor: '#2a313a', opacity: Math.floor(t * 2.4) % 2 === 0 ? 0.75 : 0.1 }} />
      </div>
    </div>
  );
};

export const Act0v2 = withFonts(Act0v2Inner);
