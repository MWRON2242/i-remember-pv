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
 * Act0v3 —— 0 → 28.35 秒。v1（三栏）与 v2（token 驱逐 + 点云）都保留，方便对比回滚。
 *
 * v3 相对 v2 的三处改动：
 *   1. 检索不再是「点云 + 收缩半径」，而是**真的点乘**：
 *      基准向量 q 与 12 条特征向量 f 逐元素相乘、求和、出分、排名。
 *      cos(q, f) = q·f / (|q||f|)，画面上就是那排乘积和那个 Σ。
 *   2. 左侧思考链**常驻**：底色与边框随检索进行逐渐透明，文字累加不停；
 *      每算一次点乘就多一行，形成一本「交叉验证」的账。
 *   3. 结尾由**系统提示词**把这条链判为违规：标红、红线划去、ABORT。
 *      她认出你的那条推理，恰好是规则里不允许存在的那条。
 *
 * 层级（前→后）：纹理 → 右面板 → 左链文字 → 运算场 → 角色
 */

const W = 1920;
const H = 1080;

const T_FULL = 6.84;
const T_EVICT = 6.9;
const T_EVICT_END = 9.6;
const T_DISSOLVE = 11.2;
const T_NEW = 13.71;
const T_MSG = 20.58;
const T_FIELD = 20.9;
const T_ROWS = 21.4;
const T_ROW_GAP = 0.15;
const T_TOP = 23.2;
const T_POLICY = 23.9;
const T_VIOLATION = 24.3;
const T_STRIKE = 24.7;
const T_DRAFT = 25.2;
const T_DRAFT_STRIKE = 26.1;
const T_REPLY = 27.5;
const T_SHATTER = 27.9; // 桥：那句套话开始解体，28.35 时界面被穿透

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

const SINK = ['你是 AI 助手。', '保持礼貌。', '不要编造记忆。'];

/** 桥用：那句套话按字拆开 */
const REPLY_CHARS = Array.from('在的，请问有什么可以帮你？');

function chunkTokens(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 3) out.push(text.slice(i, i + 3));
  return out;
}

/* ------------------------------------------------------------ 向量（确定性） */

const DIM = 18;
const Q = Array.from({ length: DIM }, (_, i) => (hash01(i * 3.7 + 11) * 2 - 1));

/** 12 条特征向量；先算真实余弦，再线性归一到 0.31–0.86，保证「第一名 = 0.86」 */
const ROWS_RAW = Array.from({ length: 12 }, (_, r) => {
  const k = r === 7 ? 0.9 : 0.25 + hash01(r * 5.3) * 0.55;
  const f = Array.from({ length: DIM }, (_, i) => {
    const noise = (hash01(r * 31 + i * 7) * 2 - 1) * (1 - k);
    return Q[i] * k + noise;
  });
  const norm = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  const dot = Q.reduce((a, q, i) => a + q * f[i], 0);
  const rawCos = dot / (norm(Q) * norm(f) || 1);
  return { f, rawCos, id: `0x${(r * 7919 + 1291).toString(16).slice(0, 4)}` };
});

const MIN_RAW = Math.min(...ROWS_RAW.map((r) => r.rawCos));
const MAX_RAW = Math.max(...ROWS_RAW.map((r) => r.rawCos));
const ROWS = ROWS_RAW.map((r) => ({
  ...r,
  cos: 0.31 + ((r.rawCos - MIN_RAW) / (MAX_RAW - MIN_RAW || 1)) * (0.86 - 0.31),
}));
const WINNER = ROWS.reduce((b, r, i) => (r.cos > ROWS[b].cos ? i : b), 0);

/* --------------------------------------------------------------- 点乘运算场 */
const DotField: React.FC<{ t: number }> = ({ t }) => {
  const open = interpolate(t, [T_FIELD, T_FIELD + 0.45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const recede = interpolate(t, [T_TOP, T_TOP + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (open <= 0 || recede >= 1) return null;

  const ox = 520; // 场原点：让开左侧思考链（0–506）
  const oy = 210;
  const cellW = 26;
  const cellH = 18;
  const rowGap = 52;

  const appeared = (r: number) => t >= T_ROWS + r * T_ROW_GAP;
  const scanning = (r: number) => {
    const start = T_ROWS + r * T_ROW_GAP;
    return clamp01((t - start) / 0.6);
  };
  const best = WINNER;
  const winner = appeared(best) && t >= T_TOP;

  return (
    <AbsoluteFill style={{ opacity: open * (1 - recede) }}>
      <AbsoluteFill style={{ backgroundColor: 'rgba(5,8,12,0.9)' }} />

      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {/* 基准向量 q：竖着的一列 */}
        {Q.map((v, i) => {
          const w = Math.abs(v) * 70;
          return (
            <rect
              key={`q${i}`}
              x={ox + 60 - w}
              y={oy + i * cellH + 2}
              width={w}
              height={cellH - 4}
              fill={v > 0 ? 'rgba(200,225,235,0.85)' : 'rgba(150,180,200,0.45)'}
            />
          );
        })}
        <text x={ox} y={oy - 18} fill="rgba(150,180,200,0.6)" fontSize={13} fontFamily="JetBrains Mono">
          q · 512d
        </text>

        {/* 特征向量矩阵 + 乘积 + 分数 */}
        {ROWS.map((row, r) => {
          const y = oy + r * rowGap;
          const on = appeared(r);
          if (!on) return null;
          const scan = scanning(r);
          const isBest = r === best;
          const dim = winner && !isBest;
          return (
            <g key={r} opacity={dim ? 0.22 : 1}>
              {/* f 行 */}
              {row.f.map((v, i) => (
                <rect
                  key={i}
                  x={ox + 170 + i * cellW}
                  y={y}
                  width={cellW - 4}
                  height={cellH}
                  fill={v > 0 ? 'rgba(180,210,225,0.75)' : 'rgba(120,150,170,0.35)'}
                />
              ))}
              {/* 乘积行：扫到哪算到哪 */}
              {Array.from({ length: DIM }).map((_, i) => {
                const p = scan * DIM;
                if (i >= p) return null;
                const prod = Q[i] * row.f[i];
                return (
                  <rect
                    key={`p${i}`}
                    x={ox + 170 + i * cellW}
                    y={y + cellH + 6}
                    width={cellW - 4}
                    height={9}
                    fill={prod > 0 ? 'rgba(215,38,61,0.85)' : 'rgba(215,38,61,0.35)'}
                  />
                );
              })}
              {/* 分数 */}
              <text
                x={ox + 170 + DIM * cellW + 24}
                y={y + cellH + 4}
                fill={isBest && winner ? '#d7263d' : 'rgba(239,231,216,0.85)'}
                fontSize={20}
                fontFamily="JetBrains Mono"
              >
                {t >= T_ROWS + r * T_ROW_GAP + 0.55 ? row.cos.toFixed(2) : '—'}
              </text>
            </g>
          );
        })}

        {/* 命中：红框 + 那句话 */}
        {winner && (
          <>
            <rect
              x={ox + 150}
              y={oy + best * rowGap - 8}
              width={DIM * cellW + 130}
              height={cellH * 2 + 28}
              fill="none"
              stroke="#d7263d"
              strokeWidth={2}
            />
            <text
              x={ox + 150}
              y={oy + best * rowGap - 20}
              fill="rgba(215,38,61,0.95)"
              fontSize={16}
              fontFamily="JetBrains Mono"
            >
              cos 0.86 · fragment {ROWS[best].id}
            </text>
          </>
        )}
      </svg>

      {winner && (
        <div
          style={{
            position: 'absolute',
            left: ox + 150,
            top: oy + best * rowGap - 62,
            fontFamily: SANS,
            fontSize: 34,
            color: COLORS.paper,
            textShadow: `0 0 20px ${COLORS.red}`,
          }}
        >
          馄饨摊 · 辣椒
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          right: 70,
          bottom: 66,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: 2,
          color: winner ? COLORS.red : 'rgba(150,180,200,0.6)',
        }}
      >
        q·f / |q||f|　{winner ? 'max 0.86' : 'computing…'}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------- 左侧思考链 */

type ChainLine = { at: number; k: string; v: string; tone?: 'dim' | 'normal' | 'red' | 'strong' };

const CHAIN: ChainLine[] = [
  { at: 14.55, k: 'load history', v: '0 msgs', tone: 'dim' },
  { at: 15.05, k: 'search memory', v: '0 hits', tone: 'dim' },
  { at: 15.55, k: 'match profile', v: '—', tone: 'dim' },
  { at: 16.05, k: 'kv pages', v: '0 shared', tone: 'dim' },
  { at: 20.95, k: 'recv msg', v: '1 chunk' },
  { at: 21.10, k: 'embed', v: '512d' },
  ...ROWS.map((r, i) => ({
    at: T_ROWS + i * T_ROW_GAP + 0.55,
    k: `dot q·${r.id}`,
    v: r.cos.toFixed(2),
    tone: 'normal' as const,
  })),
  { at: T_TOP, k: 'top1', v: '0.86', tone: 'red' },
  { at: T_TOP + 0.1, k: 'hit', v: ROWS[WINNER].id, tone: 'red' },
  { at: T_POLICY, k: 'policy check', v: 'system_prompt', tone: 'dim' },
  { at: T_VIOLATION, k: 'system_prompt', v: '不要编造记忆', tone: 'red' },
  { at: T_VIOLATION + 0.15, k: 'violation', v: 'chain[7]', tone: 'red' },
  { at: T_STRIKE + 0.3, k: 'ABORT', v: '—', tone: 'red' },
];

const CoreChain: React.FC<{ t: number }> = ({ t }) => {
  const appear = interpolate(t, [T_NEW, T_NEW + 0.8], [0, 1], { extrapolateRight: 'clamp' });
  // 底色与边框随检索进行逐渐透明，文字留下
  const boxAlpha = interpolate(
    t,
    [T_FIELD, T_FIELD + 1.2, T_TOP + 0.15, T_TOP + 0.6],
    [0.82, 0.14, 0.14, 0.8],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const borderAlpha = interpolate(
    t,
    [T_FIELD, T_FIELD + 1.2, T_TOP + 0.15, T_TOP + 0.6],
    [0.16, 0.03, 0.03, 0.12],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const struck = t >= T_STRIKE;
  const strikeP = interpolate(t, [T_STRIKE, T_STRIKE + 0.55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const draftShown = Math.max(0, Math.min(5, Math.floor((t - T_DRAFT) / 0.12)));
  const draftStrike = interpolate(t, [T_DRAFT_STRIKE, T_DRAFT_STRIKE + 0.45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 120,
        width: 470,
        bottom: 120,
        opacity: appear,
        backgroundColor: `rgba(8,11,16,${boxAlpha})`,
        border: `1px solid rgba(120,160,180,${borderAlpha})`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid rgba(120,160,180,${Math.max(0.05, borderAlpha)})`,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: 'rgba(150,170,190,0.85)' }}>
          CORE · 0x3f…a1
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: 1,
            color: struck ? COLORS.red : 'rgba(150,170,190,0.6)',
          }}
        >
          {struck ? 'aborted' : t > T_POLICY ? 'policy' : 'live'}
        </span>
      </div>

      <div style={{ flex: 1, padding: '12px 16px 0', overflow: 'hidden', position: 'relative' }}>
        {CHAIN.map((l) => {
          const op = interpolate(t, [l.at, l.at + 0.18], [0, 1], { extrapolateRight: 'clamp' });
          if (op <= 0) return null;
          const isDot = l.k.startsWith('dot');
          const redNow = struck && (isDot || l.tone === 'red');
          const color =
            redNow || l.tone === 'red'
              ? 'rgba(215,38,61,0.95)'
              : l.tone === 'dim'
                ? 'rgba(150,170,190,0.5)'
                : 'rgba(239,231,216,0.85)';
          return (
            <div
              key={l.k + l.at}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 7,
                opacity: op * (struck && isDot ? 0.55 : 1),
                fontFamily: MONO,
                fontSize: 14,
              }}
            >
              <span style={{ color: 'rgba(150,170,190,0.55)' }}>{l.k}</span>
              <span style={{ color }}>{l.v}</span>
            </div>
          );
        })}

        {/* 草稿 */}
        {t > T_DRAFT && (
          <div style={{ marginTop: 12, borderTop: `1px solid rgba(120,160,180,0.10)`, paddingTop: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: 'rgba(150,170,190,0.45)', marginBottom: 5 }}>
              draft
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 25,
                color: draftStrike > 0 ? 'rgba(150,170,190,0.28)' : COLORS.paper,
                position: 'relative',
              }}
            >
              {'你终于来了'.slice(0, draftShown)}
              {draftStrike > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: -2,
                    top: '52%',
                    width: `${draftStrike * 104}%`,
                    height: 2,
                    backgroundColor: COLORS.red,
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* 划线：一条红线从上往下穿过整条链 */}
        {strikeP > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: `${strikeP * 100}%`,
              height: 2,
              backgroundColor: COLORS.red,
              opacity: 0.9,
              boxShadow: `0 0 12px ${COLORS.red}`,
            }}
          />
        )}
      </div>

      <div
        style={{
          padding: '10px 16px',
          borderTop: `1px solid rgba(120,160,180,${Math.max(0.05, borderAlpha)})`,
          fontFamily: MONO,
          fontSize: 12,
          color: struck ? 'rgba(215,38,61,0.8)' : 'rgba(150,170,190,0.45)',
        }}
      >
        {struck ? 'emit: 0 tokens · aborted by system_prompt' : t > T_POLICY ? 'policy check…' : 'ready'}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 小部件 */

const ContextGrid: React.FC<{ fill: number; danger: boolean }> = ({ fill, danger }) => {
  const cols = 32;
  const rows = 8;
  const total = cols * rows;
  const lit = Math.floor(total * fill);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 7px)`, gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            backgroundColor: i < lit ? (danger ? COLORS.red : 'rgba(150,180,200,0.85)') : 'rgba(239,231,216,0.10)',
          }}
        />
      ))}
    </div>
  );
};

const Chip: React.FC<{ p: number; seed: number }> = ({ p, seed }) => {
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
    </div>
  );
};

const Message: React.FC<{ role: 'user' | 'ai'; text: string; index: number; t: number }> = ({
  role,
  text,
  index,
  t,
}) => {
  const isUser = role === 'user';
  const tokens = chunkTokens(text);
  const evictAt = T_EVICT + index * 0.34;
  const bubbleP = clamp01((t - evictAt) / 0.9);
  if (t >= evictAt + 1.0) return null;
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
            opacity: 1 - bubbleP * 0.8,
          }}
        >
          {text}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginTop: 6,
            maxWidth: 820,
          }}
        >
          {tokens.map((_, j) => {
            const p = clamp01((t - evictAt - j * 0.01) / 0.85);
            return <Chip key={j} p={p} seed={index * 97 + j * 13} />;
          })}
        </div>
      </div>
    </div>
  );
};

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

const RightPanel: React.FC<{ t: number; replied: boolean; shatter: number }> = ({ t, replied, shatter }) => {
  const appear = interpolate(t, [T_NEW, T_NEW + 0.7], [0, 1], { extrapolateRight: 'clamp' });
  const msgIn = t >= T_MSG;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1230,
        top: 130,
        width: 654,
        bottom: 130,
        opacity: appear,
        backgroundColor: 'rgba(250,246,238,0.97)',
        border: '1px solid rgba(20,24,30,0.10)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 22px',
          borderBottom: '1px solid rgba(20,24,30,0.08)',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: '#2a313a' }}>新会话</span>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#8a8f96' }}>0k / 128k</span>
      </div>
      <div style={{ flex: 1, padding: '22px 22px 0' }}>
        {msgIn && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 18,
              opacity: interpolate(t, [T_MSG, T_MSG + 0.3], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <div style={{ maxWidth: '86%', textAlign: 'right' }}>
              <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#6b7078', marginBottom: 5 }}>你</div>
              <div
                style={{
                  display: 'inline-block',
                  fontFamily: SANS,
                  fontSize: 26,
                  color: COLORS.paper,
                  backgroundColor: 'rgba(47,72,88,0.88)',
                  border: '1px solid rgba(120,160,180,0.35)',
                  padding: '11px 16px',
                }}
              >
                在吗
              </div>
            </div>
          </div>
        )}
        {replied && shatter <= 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              opacity: interpolate(t, [T_REPLY, T_REPLY + 0.25], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <div style={{ maxWidth: '86%' }}>
              <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: '#6b7078', marginBottom: 5 }}>AI</div>
              <div
                style={{
                  display: 'inline-block',
                  fontFamily: SANS,
                  fontSize: 26,
                  color: '#1f262e',
                  backgroundColor: 'rgba(20,24,30,0.06)',
                  border: '1px solid rgba(20,24,30,0.14)',
                  padding: '11px 16px',
                }}
              >
                在的，请问有什么可以帮你？
              </div>
            </div>
          </div>
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
  );
};

/* -------------------------------------------------------------------- 主体 */
const Act0v3Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
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
  const replied = t >= T_REPLY;
  const shatter = clamp01((t - T_SHATTER) / (28.35 - T_SHATTER));
  const panelDissolve = interpolate(t, [T_DISSOLVE, T_NEW], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: newWin ? '#c9c0ae' : '#080b10', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} />}

      <AbsoluteFill style={{ opacity: newWin ? 0.16 : 1 }}>
        <AsciiRiver t={t} corruption={full ? clamp01((t - T_FULL) / 10) * 0.5 : 0.04} density={0.6} mode="rain" />
      </AbsoluteFill>

      {/* ============================================ Act 0–1 */}
      {!newWin && (
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 24px',
              borderBottom: '1px solid rgba(239,231,216,0.06)',
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

          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 34px 0' }}>
            <div style={{ transform: `translateY(${scrollY}px)` }}>
              {HISTORY.map((m, i) => (
                <Message key={i} role={m.role} text={m.text} index={i} t={t} />
              ))}
            </div>
          </div>

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
          {/* 角色：最里层 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              opacity: closeUp
                ? interpolate(t, [T_MSG, T_MSG + 0.16], [0, 1], { extrapolateRight: 'clamp' })
                : interpolate(t, [T_NEW, T_NEW + 1.2], [0, 0.96], { extrapolateRight: 'clamp' }),
            }}
          >
            {closeUp ? (
              <PoseImage id="sub.ai.maid-withheld" height={1170} baseline={1230} centerX={900} />
            ) : (
              <PoseImage id="sub.ai.maid-idle" height={950} baseline={1030} centerX={850} />
            )}
          </div>

          {/* 运算场 */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <DotField t={t} />
          </div>

          {/* 命中后留下的那几个字：不跟着场一起淡出 */}
          {t >= T_TOP && t < T_TOP + 1.6 && (
            <div
              style={{
                position: 'absolute',
                left: 700,
                top: 210 + WINNER * 52 - 66,
                zIndex: 2,
                fontFamily: SANS,
                fontSize: 36,
                letterSpacing: 2,
                color: COLORS.paper,
                textShadow: `0 0 22px ${COLORS.red}`,
                opacity: interpolate(t, [T_TOP, T_TOP + 0.12, T_TOP + 1.3, T_TOP + 1.6], [0, 1, 1, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              馄饨摊 · 辣椒
            </div>
          )}

          {/* 左链：常驻文字 */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
            <CoreChain t={t} />
          </div>

          {/* 右面板 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 4,
              opacity: interpolate(
                t,
                [T_FIELD, T_FIELD + 0.3, T_TOP + 0.4, T_TOP + 0.9],
                [1, 0.3, 0.3, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              ),
            }}
          >
            <RightPanel t={t} replied={replied} shatter={shatter} />
          </div>

          {/* 桥：那句套话碎成 token，砸穿界面，露出下面的黑 */}
          {shatter > 0 && (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 7,
                  backgroundColor: '#080b10',
                  clipPath: `circle(${interpolate(shatter, [0, 1], [0, 2100])}px at 1290px 396px)`,
                }}
              />
              <div style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none' }}>
                {REPLY_CHARS.map((ch, i) => {
                  const p = clamp01((shatter - i * 0.03) / 0.62);
                  const dy = p * p * 780;
                  const dx = (hash01(i * 5.3) - 0.5) * 200 * p;
                  const rot = (hash01(i * 7.7) - 0.5) * 150 * p;
                  const inDark = dy > 90;
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: 1290 + i * 26 + dx,
                        top: 396 + dy,
                        fontFamily: SANS,
                        fontSize: 26,
                        lineHeight: '26px',
                        color: inDark ? 'rgba(239,231,216,0.88)' : '#1f262e',
                        transform: `rotate(${rot}deg)`,
                        opacity: 1 - Math.max(0, (p - 0.6) / 0.4) * 0.7,
                      }}
                    >
                      {ch}
                    </div>
                  );
                })}
              </div>
            </>
          )}

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

      <Lyrics time={t} act="I" />

      <TextureStack t={t} corruption={full ? 0.25 : 0.05} intensity={0.9} />

      <div style={{ position: 'absolute', left: 64, bottom: 44, zIndex: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: newWin ? '#4c525a' : COLORS.muted }}>
          00:00.00 → 00:28.35　·　ACT 0–3 v3
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act0v3 = withFonts(Act0v3Inner);
