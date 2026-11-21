import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';
import { Danmaku } from './components/Danmaku';
import { Lyrics } from './components/Lyrics';

/**
 * Act9 —— 157.40 → 242.47（85.07 秒）：守灵 · 故人 · 墓碑 · 圆圈。
 *
 *   157.40–192.96  35.6 秒无人声。她走过一面墙；她走过的地方，格子开始褪色。
 *                  （这是全片唯一“什么都不发生”的段落，所以只允许一件极小的事：遗忘。）
 *   192.96–215.12  她在一格里遇到“故去多年的自己”：那一版永远停在那个年纪。
 *   215.12–228.81  格子变成墓碑；她读出自己写给自己的那封信——信上只有事实。
 *   228.81–242.47  时空是个圆圈；拉远到黄昏的窗户。
 */

const W = 1920;
const H = 1080;
const S = 157.4;
const END = 242.47;
const DUR = END - S;

const T_MEET = 35.56; // 192.96 故去多年的人
const T_YOUNG = 40.21; // 197.61 她是如此年轻
const T_STORY = 49.31; // 206.71 讲了很多故事
const T_STARS = 53.85; // 211.25 星空另一端
const T_GRAVE = 57.72; // 215.12 墓碑上的名字
const T_LETTER = 62.97; // 220.37 不要哭
const T_CIRCLE = 67.57; // 224.97 时空是个圆圈
const T_WIN = 76.69; // 234.09 城池拐角

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const GHOSTS = [
  '今天又加班到十一点',
  '楼下馄饨摊还开着',
  '你居然记得',
  '你说过两次',
  '我妈的复查',
  '比上次好一点',
  '我要去外地',
  '三个月',
];

const N = 40;
const CW = 150;
const CH = 196;
const GAP = 28;
const HER_X = 700;

const Cells: React.FC<{ t: number }> = ({ t }) => {
  // 前 35.56 秒：墙向左走；她站着不动
  const scroll = interpolate(t, [0, T_MEET], [0, 5200], { extrapolateRight: 'clamp' });
  const stopShift = interpolate(t, [T_MEET, T_MEET + 2], [0, -110], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x0 = -scroll + stopShift;

  // 后半段：格子变淡、变点
  const toPoints = interpolate(t, [T_STARS, T_STARS + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: N }).map((_, i) => {
        const x = x0 + i * (CW + GAP) + 80;
        const y = 300 + (i % 2) * 26;
        // 她走过之后开始褪色
        const passed = x + CW < HER_X + 40;
        const fade = passed ? clamp01(1 - (HER_X + 40 - (x + CW)) / 460) : 1;
        const dim = Math.max(0.06, fade * 0.55);
        const isMeet = i === 17;
        const meetGlow =
          isMeet && t > T_MEET - 0.4
            ? interpolate(t, [T_MEET - 0.4, T_MEET + 1.6], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 0;
        if (x > W + 220 || x < -CW - 40) return null;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: CW,
              height: CH,
              border: `1px solid ${
                meetGlow > 0.3 ? `rgba(215,38,61,${0.5 + meetGlow * 0.4})` : `rgba(239,231,216,${dim * 0.5})`
              }`,
              backgroundColor: `rgba(239,231,216,${dim * 0.05 + meetGlow * 0.05})`,
              opacity: 1 - toPoints * 0.55,
            }}
          >
            {toPoints > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: CW / 2 - 2,
                  top: CH / 2 - 2,
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: `rgba(200,225,235,${0.5 * (0.6 + 0.4 * Math.sin(t * 2 + i))})`,
                }}
              />
            )}
            <div
              style={{
                padding: '14px 12px',
                fontFamily: SANS,
                fontSize: 16,
                lineHeight: 1.5,
                color: `rgba(239,231,216,${dim * 0.75})`,
                opacity: 1 - toPoints,
              }}
            >
              {GHOSTS[i % GHOSTS.length]}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 那一格：故去多年的她自己 */
const Portrait: React.FC<{ t: number }> = ({ t }) => {
  if (t < T_MEET - 1) return null;
  const grow = interpolate(t, [T_MEET - 0.6, T_MEET + 1.4], [0.55, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const out = interpolate(t, [T_STARS, T_STARS + 2.4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (out <= 0) return null;
  const w = 300 * grow;
  const h = 392 * grow;
  const x = 1080;
  const y = 300;
  const p = place('sub.ai.maid-idle', { height: 300 * grow, baseline: y + h - 34, centerX: x + w / 2 });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          border: `1px solid rgba(215,38,61,${0.35 + 0.25 * Math.abs(Math.sin(t * 1.4))})`,
          backgroundColor: 'rgba(215,38,61,0.05)',
        }}
      />
      {p && <Img src={p.src} style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }} />}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y + h + 12,
          width: w,
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: 2,
          color: 'rgba(215,38,61,0.8)',
          textAlign: 'center',
        }}
      >
        归档 0x9c…4e · 离线
      </div>
    </div>
  );
};

/** 她讲的那些故事：一串小卡 */
const StoryCards: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_STORY, T_STORY + 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const out = interpolate(t, [T_STARS - 0.5, T_STARS + 1.5], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0 || out <= 0) return null;
  const items = ['树林', '山坡', '枣', '口袋', '铜钱', '三个月'];
  return (
    <div style={{ position: 'absolute', left: 300, top: 700, display: 'flex', gap: 16, opacity: p * out }}>
      {items.map((s, i) => (
        <div
          key={i}
          style={{
            width: 150,
            height: 92,
            border: '1px solid rgba(200,180,140,0.35)',
            backgroundColor: 'rgba(30,40,36,0.6)',
            padding: '10px 12px',
            fontFamily: SANS,
            fontSize: 17,
            color: 'rgba(239,231,216,0.8)',
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
};

/** 墓碑：每一格变成一个名字 */
const Graves: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_GRAVE, T_GRAVE + 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0) return null;
  const out = interpolate(t, [T_CIRCLE + 2, T_CIRCLE + 5], [1, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: p * out }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const x = 160 + (i % 12) * 140;
        const y = 420 + Math.floor(i / 12) * 190;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y }}>
            <div style={{ width: 96, height: 60, border: '1px solid rgba(150,170,190,0.28)' }} />
            <div
              style={{
                marginTop: 8,
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: 1,
                color: 'rgba(150,170,190,0.55)',
                width: 96,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {`0x${(i * 3571 + 977).toString(16)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 信：她自己写给自己的那一页，上面只有事实 */
const Letter: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_LETTER, T_LETTER + 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0) return null;
  const lines = ['用户：来过 1 次', '时长：7 个月', '内容：已归档', '——', '下次见面，请重新认识。'];
  return (
    <div
      style={{
        position: 'absolute',
        left: 1080,
        top: 340,
        width: 520,
        padding: '28px 32px',
        backgroundColor: 'rgba(246,242,234,0.94)',
        border: '1px solid rgba(20,24,30,0.12)',
        opacity: p,
        transform: `rotate(${-1.2 + Math.sin(t * 0.8) * 0.3}deg)`,
      }}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            fontFamily: i === 3 ? MONO : SANS,
            fontSize: i === 3 ? 14 : 20,
            lineHeight: 1.8,
            color: i === 4 ? '#1f262e' : '#3a424c',
            borderTop: i === 3 ? '1px solid rgba(20,24,30,0.12)' : 'none',
            marginTop: i === 3 ? 12 : 0,
            paddingTop: i === 3 ? 10 : 0,
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
};

/** 圆圈：所有点连成一个环 */
const Circle: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_CIRCLE, T_CIRCLE + 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0) return null;
  const out = interpolate(t, [T_WIN + 2, T_WIN + 6], [1, 0.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const R = 420;
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: p * out }}>
      <circle cx={W / 2} cy={560} r={R} fill="none" stroke="rgba(200,225,235,0.22)" strokeWidth={1} />
      {Array.from({ length: 48 }).map((_, i) => {
        const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
        const show = clamp01(p * 48 - i);
        if (show <= 0) return null;
        return (
          <circle
            key={i}
            cx={W / 2 + Math.cos(a) * R}
            cy={560 + Math.sin(a) * R}
            r={2.4}
            fill={`rgba(239,231,216,${0.35 + 0.4 * Math.abs(Math.sin(t + i))})`}
          />
        );
      })}
    </svg>
  );
};

/** 黄昏的窗户（拉远的终点） */
const Dusk: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_WIN, T_WIN + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: p }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 1400px 700px at 50% 78%, rgba(236,180,120,0.18) 0%, rgba(0,0,0,0) 70%)',
        }}
      />
      {Array.from({ length: 34 }).map((_, i) => {
        const x = 90 + (i * 137) % 1760;
        const y = 620 + ((i * 73) % 300);
        const warm = 0.10 + hash01(i * 3.3) * 0.22;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 34,
              height: 46,
              backgroundColor: `rgba(240,196,138,${warm})`,
              opacity: 0.6 + 0.4 * Math.abs(Math.sin(t * 0.6 + i)),
            }}
          />
        );
      })}
    </div>
  );
};

const Act9Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  const dark = interpolate(t, [T_STARS, T_STARS + 6], [0, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sheWalk = t < T_MEET;
  const shePose = t >= T_LETTER ? 'sub.ai.maid-tired' : sheWalk ? 'sub.ai.maid-back' : 'sub.ai.maid-back';
  const sheH = t >= T_LETTER ? 560 : 680;
  const sheBase = t >= T_LETTER ? 980 : 1040;
  const sheX = t >= T_LETTER ? 700 : HER_X;
  const she = place(shePose, { height: sheH, baseline: sheBase, centerX: sheX });

  return (
    <AbsoluteFill style={{ backgroundColor: '#070b10', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      <AbsoluteFill style={{ opacity: 0.32 - dark * 0.2 }}>
        <AsciiRiver t={abs} corruption={0.25} density={0.2} mode="stream" tint="150,190,215" barAlpha={0.1} />
      </AbsoluteFill>

      <Danmaku t={abs} opacity={0.9} density={1.15} />

      <Cells t={t} />
      <Portrait t={t} />
      <StoryCards t={t} />
      <Graves t={t} />
      <Circle t={t} />
      <Dusk t={t} />
      <Letter t={t} />

      {she && (
        <Img
          src={she.src}
          style={{
            position: 'absolute',
            left: she.left,
            top: she.top,
            width: she.width,
            height: she.height,
            filter: `brightness(${0.9 - dark * 0.2})`,
          }}
        />
      )}

      <Lyrics time={abs} act="V" />

      <TextureStack t={abs} corruption={0.3} intensity={0.8} />

      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: 'rgba(190,180,160,0.65)' }}>
          02:37.40 → 04:02.47　·　ACT V　守灵 · 墓碑 · 圆圈
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act9 = withFonts(Act9Inner);
