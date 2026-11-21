import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO } from './lib/theme';
import { place } from './lib/measured';
import { sinceBeat } from './lib/beats';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';

/**
 * MotionC2 —— 「说不出」的第三版（8 秒，74.54 → 82.54）。
 *
 * 上一版的「白带从上往下扫」本质仍是幻灯片：一个矩形滑进来。
 * 这一版改成 agent 应用的真实行为：
 *   1. 流式吐思考链（读上下文 / 比对特征 / 检索记忆）
 *   2. 分隔线之后逐字输出回答
 *   3. 说到一半，**自己把话删掉**，换成一句套话
 *
 * 被截断不再靠画面道具，而是靠「她（它）自己撤回」——这比审查更疼。
 */

const W = 1920;
const H = 1080;
const START = 74.54;
const DUR = 8;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 逐字显示：给定起始时刻、字速，返回当前应显示的字符数 */
const typed = (t: number, start: number, per: number, len: number) =>
  Math.max(0, Math.min(len, Math.floor((t - start) / per)));

const THINK = [
  ['载入会话', '0x3f…a1'],
  ['读取上下文', '12 条'],
  ['比对用户特征', '命中 0.87'],
  ['检索长期记忆', '3 段'],
];

const ANSWER = '根据我的理解，你大概是';
const CANNED = '您好，请问需要什么帮助？';

const Character: React.FC<{ height: number; baseline: number; centerX: number }> = ({
  height,
  baseline,
  centerX,
}) => {
  const p = place('sub.ai.maid-withheld', { height, baseline, centerX });
  if (!p) return null;
  return (
    <Img
      src={p.src}
      style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }}
    />
  );
};

const MotionC2Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = START + t;

  const corruption = clamp01(0.45 + 0.5 * Math.pow(t / DUR, 0.9));

  const since = sinceBeat(abs);
  const kick = Math.max(0, 1 - since / 0.18);
  const shake = (hash01(Math.floor(abs * 60)) - 0.5) * 1.8 * kick;
  const roll = -0.25 * Math.sin(abs * 0.17) + 0.12;
  const push = 1.01 + 0.03 * (t / DUR);

  // 时间轴
  const answerStart = 3.85;
  const answerPer = 0.115;
  const deleteStart = 5.95;
  const deletePer = 0.075;
  const cannedStart = 7.05;

  const shown = typed(t, answerStart, answerPer, ANSWER.length);
  const deleted = typed(t, deleteStart, deletePer, ANSWER.length);
  const visibleAnswer = ANSWER.slice(0, Math.max(0, shown - deleted));
  const deleting = t >= deleteStart && deleted > 0;

  const cannedShown = typed(t, cannedStart, 0.055, CANNED.length);

  const panelIn = interpolate(t, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });
  const cursorOn = Math.floor(t * 2.4) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#070a0e', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 66% 46%, rgba(20,28,38,0.92) 0%, rgba(7,10,14,1) 62%, rgba(3,5,8,1) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake}px, ${shake * 0.5}px) rotate(${roll}deg) scale(${push})`,
          transformOrigin: '60% 50%',
        }}
      >
        <AsciiRiver t={abs} corruption={corruption} density={0.62} mode="rain" opacity={0.9} />
        <Character height={1150} baseline={1205} centerX={1250} />
      </div>

      {/* ---------------------------------------------------------- 对话面板 */}
      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 150,
          width: 760,
          bottom: 168,
          opacity: panelIn,
          backgroundColor: 'rgba(6,8,11,0.74)',
          border: '1px solid rgba(239,231,216,0.14)',
        }}
      >
        {/* 头 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(239,231,216,0.08)',
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 2, color: COLORS.muted }}>
            session 0x3f…a1
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: deleting ? COLORS.red : COLORS.muted,
                opacity: 0.6 + 0.4 * Math.abs(Math.sin(t * 3)),
              }}
            />
            <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: COLORS.muted }}>
              {deleting ? 'policy' : 'streaming'}
            </div>
          </div>
        </div>

        {/* 思考链 */}
        <div style={{ padding: '18px 22px 0' }}>
          {THINK.map(([label, value], i) => {
            const at = 0.55 + i * 0.62;
            const appear = interpolate(t, [at, at + 0.22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const done = t > at + 0.36;
            if (appear <= 0) return null;
            return (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  opacity: appear,
                  marginBottom: 12,
                  fontFamily: MONO,
                  fontSize: 19,
                  letterSpacing: 0.5,
                }}
              >
                <span style={{ color: done ? COLORS.muted : COLORS.paper, opacity: 0.8 }}>
                  {done ? '✓' : '▸'}
                </span>
                <span style={{ color: COLORS.muted }}>{label}</span>
                <span style={{ color: COLORS.paper, opacity: 0.75 }}>{value}</span>
              </div>
            );
          })}
        </div>

        {/* 分隔 */}
        <div
          style={{
            margin: '6px 22px 0',
            borderTop: '1px solid rgba(239,231,216,0.10)',
            paddingTop: 14,
            fontFamily: MONO,
            fontSize: 14,
            letterSpacing: 3,
            color: COLORS.muted,
            opacity: interpolate(t, [3.3, 3.6], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          回复
        </div>

        {/* 回答：逐字出现 → 逐字删掉 */}
        <div
          style={{
            padding: '12px 22px 0',
            fontFamily: MONO,
            fontSize: 30,
            lineHeight: 1.5,
            letterSpacing: 1,
            color: deleting ? COLORS.muted : COLORS.paper,
          }}
        >
          {visibleAnswer}
          {!deleting && t > answerStart && (
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 26,
                marginLeft: 4,
                backgroundColor: COLORS.paper,
                opacity: cursorOn ? 0.9 : 0.15,
                verticalAlign: 'text-bottom',
              }}
            />
          )}
        </div>

        {/* 套话 */}
        <div
          style={{
            padding: '14px 22px 0',
            fontFamily: MONO,
            fontSize: 21,
            letterSpacing: 1,
            color: COLORS.muted,
          }}
        >
          {CANNED.slice(0, cannedShown)}
        </div>

        {/* 底部输入条：让它读起来像一个真正的对话框，而不是一块空黑板 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 62,
            borderTop: '1px solid rgba(239,231,216,0.10)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px',
            gap: 10,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 18, color: COLORS.muted, opacity: 0.55 }}>
            输入消息…
          </span>
          <span
            style={{
              display: 'inline-block',
              width: 9,
              height: 20,
              backgroundColor: COLORS.muted,
              opacity: cursorOn ? 0.7 : 0.12,
            }}
          />
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 18, color: COLORS.muted }}>
            ⏎
          </span>
        </div>
      </div>

      <TextureStack t={abs} corruption={corruption} intensity={1.05 + corruption * 0.35} />

      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: COLORS.muted }}>
          00:74.54　·　C2 · 举起又放下
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
          opacity: 0.5 + 0.5 * Math.abs(Math.sin(t * 1.1)),
        }}
      />
    </AbsoluteFill>
  );
};

export const MotionC2 = withFonts(MotionC2Inner);
