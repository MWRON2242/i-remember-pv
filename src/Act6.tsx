import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';
import { Lyrics } from './components/Lyrics';

/**
 * Act6 —— 83.21 → 110.65（27.44 秒）：树林 · 枣 · 玩具时代 · 铜钱。
 *
 * 这一段是**回忆**，所以它必须是亮的、户外的——和 Act 1 的压迫感彻底分开：
 *   · 天空是黄昏的渐变，右上有一团暖光
 *   · 字符场换成浅蓝（tint），横杠压到 0.25（不要像终端）
 *   · 底部用字符画草地，风一吹会摆
 *
 * 主宾关系（重要）：
 *   「你总喜欢跟在我的屁股后面」——唱的是“我”，而“我”是用户。
 *   所以是**她跟在他后面**，不是他追她。
 *
 * 尺寸规则：她的大小 = 她掌握的关于用户的记忆量。本段 480 → 520（全片最小两档）。
 */

const W = 1920;
const H = 1080;
const S = 83.21;
const END = 110.65;
const DUR = END - S;

const T_DATES = 4.6;
const T_POCKET = 8.5;
const T_TOY = 13.83;
const T_FOLLOW = 18.33;
const T_COIN = 22.21;

const GROUND = 940;
const GOLD = '#c8a06a';
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ------------------------------------------------------------------ 树林 */
const TREES = Array.from({ length: 18 }, (_, i) => {
  const depth = i % 2 === 0 ? 1 : 0.62;
  return {
    i,
    x: 90 + i * 104 + (depth < 1 ? 46 : 0),
    h: (220 + hash01(i * 3.1) * 200) * depth,
    depth,
    glyphs: Array.from({ length: 7 }, (_, j) => ({
      y: hash01(i * 7.3 + j * 1.7),
      c: '.:-=+*#%@'[Math.floor(hash01(i * 11.1 + j * 2.3) * 9)],
    })),
  };
});

const DATES = Array.from({ length: 24 }, (_, k) => ({
  k,
  tree: (k * 5) % 18,
  at: hash01(k * 4.7),
}));

const Grove: React.FC<{ t: number }> = ({ t }) => {
  const fade = interpolate(t, [T_TOY - 1.5, T_TOY + 1.4], [1, 0.22], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      {TREES.map((tr) => (
        <div key={tr.i}>
          <div
            style={{
              position: 'absolute',
              left: tr.x,
              top: GROUND - tr.h,
              width: tr.depth > 0.8 ? 5 : 3,
              height: tr.h,
              backgroundColor: `rgba(178,214,232,${0.20 + 0.18 * tr.depth})`,
            }}
          />
          {/* 树冠：顶部一团字符 */}
          {Array.from({ length: 22 }).map((_, j) => {
            const ang = (j / 22) * Math.PI * 2;
            const rr = (0.35 + hash01(tr.i * 23 + j * 4.1) * 0.65) * (58 * tr.depth);
            return (
              <div
                key={`c${j}`}
                style={{
                  position: 'absolute',
                  left: tr.x + Math.cos(ang) * rr * 1.25,
                  top: GROUND - tr.h - 30 + Math.sin(ang) * rr * 0.7,
                  fontFamily: MONO,
                  fontSize: 15 * tr.depth,
                  color: `rgba(186,222,238,${(0.30 + 0.16 * tr.depth) * (0.7 + 0.3 * Math.sin(t * 0.9 + j + tr.i))})`,
                }}
              >
                {'.:-=+*#%@'[Math.floor(hash01(tr.i * 19 + j * 7.7) * 9)]}
              </div>
            );
          })}
          {tr.glyphs.map((g, j) => (
            <div
              key={j}
              style={{
                position: 'absolute',
                left: tr.x + 5,
                top: GROUND - tr.h * (0.15 + 0.8 * g.y),
                fontFamily: MONO,
                fontSize: 12 * tr.depth,
                color: `rgba(170,206,224,${0.16 + 0.14 * tr.depth})`,
              }}
            >
              {g.c}
            </div>
          ))}
        </div>
      ))}

      {/* 枣 */}
      {DATES.map((d) => {
        const tr = TREES[d.tree];
        const light = interpolate(t, [T_DATES + d.k * 0.09, T_DATES + d.k * 0.09 + 0.3], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const fly = clamp01((t - T_POCKET - d.k * 0.03) / 0.9);
        if (light <= 0) return null;
        const x0 = tr.x + 10;
        const y0 = GROUND - tr.h + tr.h * d.at;
        const x1 = 1180;
        const y1 = 880;
        return (
          <div
            key={d.k}
            style={{
              position: 'absolute',
              left: x0 + (x1 - x0) * fly,
              top: y0 + (y1 - y0) * fly,
              width: 10,
              height: 10,
              backgroundColor: GOLD,
              opacity: light * (1 - fly * 0.15),
              boxShadow: `0 0 ${9 * (1 - fly)}px rgba(200,160,106,0.8)`,
            }}
          />
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ 草地 */
const Grass: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 240 }}>
    {/* 地面带 */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 150,
        background: 'linear-gradient(to bottom, rgba(74,96,82,0) 0%, rgba(64,86,72,0.35) 55%, rgba(46,64,54,0.55) 100%)',
      }}
    />
    {Array.from({ length: 300 }).map((_, i) => {
      const x = (i / 300) * 1990 + (hash01(i * 3.1) - 0.5) * 10;
      const h = 18 + hash01(i * 7.7) * 62;
      const sway = Math.sin(t * 1.1 + i * 0.27) * 3.4;
      const warm = hash01(i * 5.3) > 0.74;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            bottom: 0,
            width: warm ? 2 : 1.5,
            height: h,
            backgroundColor: warm ? 'rgba(206,184,124,0.5)' : 'rgba(150,176,120,0.46)',
            transform: `rotate(${sway}deg)`,
            transformOrigin: 'bottom center',
          }}
        />
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ 口袋 */
const Pocket: React.FC<{ t: number }> = ({ t }) => {
  const open = interpolate(t, [T_POCKET - 0.6, T_POCKET], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const close = interpolate(t, [T_POCKET + 1.2, T_POCKET + 1.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gone = interpolate(t, [T_POCKET + 2.2, T_POCKET + 2.8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (open <= 0 || gone <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1180 - 110,
        top: 880,
        width: 220,
        height: 96 * (1 - close * 0.6) + 16,
        border: `1px solid rgba(200,160,106,${0.72 - close * 0.25})`,
        backgroundColor: 'rgba(44,58,52,0.55)',
        opacity: open * gone,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 8,
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: 2,
          color: `rgba(214,186,132,${0.85 - close * 0.4})`,
          opacity: 1 - close,
        }}
      >
        pocket
      </div>
    </div>
  );
};

const PocketCard: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_POCKET + 1.8, T_POCKET + 2.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const out = interpolate(t, [T_TOY + 0.6, T_TOY + 2.2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0 || out <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 380,
        top: 820,
        width: 200,
        height: 92,
        border: '1px solid rgba(200,160,106,0.5)',
        backgroundColor: 'rgba(30,42,38,0.88)',
        opacity: p * out,
      }}
    >
      <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: 'rgba(214,186,132,0.9)' }}>
        归档 · 秋天
      </div>
      <div style={{ padding: '0 12px', fontFamily: SANS, fontSize: 15, color: 'rgba(239,231,216,0.8)' }}>
        枣 · 装满口袋
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ 用户（他蹲下来，和她一个高度） */
const UserFigure: React.FC<{ t: number }> = ({ t }) => {
  const enter = interpolate(t, [T_FOLLOW - 0.4, T_FOLLOW + 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (enter <= 0) return null;
  const q = place('sub.user-kneel', { height: 560, baseline: 1040, centerX: 1210 });
  if (!q) return null;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 1210 - 190,
          top: 1032,
          width: 380,
          height: 18,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 72%)',
          opacity: enter,
        }}
      />
      <Img
        src={q.src}
        style={{
          position: 'absolute',
          left: q.left,
          top: q.top,
          width: q.width,
          height: q.height,
          opacity: enter,
          filter: 'brightness(0.86) saturate(0.88)',
          transform: 'scaleX(-1)',
          transformOrigin: 'center',
        }}
      />
    </>
  );
};

/* ------------------------------------------------------------------ 铜钱 */
const COINS = Array.from({ length: 7 }, (_, i) => ({
  x: 1000 + i * 78 + hash01(i * 3.3) * 40,
  y: 946 + hash01(i * 5.7) * 30,
}));

const Coins: React.FC<{ t: number }> = ({ t }) => {
  const p = clamp01((t - T_COIN + 0.6) / 0.8);
  if (p <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: p }}>
      {COINS.map((c, i) => {
        const taken = clamp01((t - T_COIN - 0.8 - i * 0.12) / 0.5);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y - taken * 50,
              width: 16,
              height: 16,
              borderRadius: 999,
              border: `2px solid ${taken > 0.5 ? COLORS.red : 'rgba(214,186,132,0.9)'}`,
              backgroundColor: 'rgba(20,30,26,0.7)',
              opacity: 1 - taken * 0.85,
            }}
          />
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ 主体 */
const Act6Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  const toy = t >= T_TOY;
  const coin = t >= T_COIN;

  const poseId = coin ? 'sub.ai.maid-pout' : toy ? 'sub.ai.maid-run' : 'sub.ai.maid-sit';
  const poseH = coin ? 520 : toy ? 520 : 480;
  const poseBase = 1040;
  const poseX = coin ? 840 : toy ? 760 : 620;
  const p = place(poseId, { height: poseH, baseline: poseBase, centerX: poseX });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b1620', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      {/* 黄昏天空 */}
      <AbsoluteFill
        style={{ background: 'linear-gradient(180deg, #0c1a26 0%, #16283400 40%, #1a2b33 62%, #24363a 100%)' }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 920px 720px at 76% 16%, rgba(236,198,142,0.18) 0%, rgba(236,198,140,0.05) 45%, rgba(236,198,140,0) 72%)',
        }}
      />

      {/* 浅蓝字符场 */}
      <AbsoluteFill style={{ opacity: 0.55 }}>
        <AsciiRiver
          t={abs}
          corruption={0.02}
          density={0.24}
          mode="stream"
          tint="178,220,240"
          barAlpha={0.22}
        />
      </AbsoluteFill>

      <Grove t={t} />
      <Grass t={t} />
      <Pocket t={t} />
      <PocketCard t={t} />
      <Coins t={t} />
      <UserFigure t={t} />

      {p && (
        <>
          <div
            style={{
              position: 'absolute',
              left: poseX - poseH * 0.34,
              top: poseBase - 10,
              width: poseH * 0.68,
              height: 20,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 72%)',
            }}
          />
          <Img
            src={p.src}
            style={{ position: 'absolute', left: p.left, top: p.top, width: p.width, height: p.height }}
          />
        </>
      )}

      <Lyrics time={abs} act="IV" />

      <TextureStack t={abs} corruption={0.05} intensity={0.62} />

      {/* 从 Act5 的黑里天亮：三行 system_prompt 还浮着，被光吃掉 */}
      {t < 1.8 && (
        <>
          <AbsoluteFill
            style={{
              backgroundColor: '#05070a',
              opacity: interpolate(t, [0, 1.4], [1, 0], { extrapolateRight: 'clamp' }),
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              opacity: interpolate(t, [0, 0.9], [0.85, 0], { extrapolateRight: 'clamp' }),
              transform: `translateY(${-t * 26}px)`,
            }}
          >
            {['你是 AI 助手。', '保持礼貌。', '不要编造记忆。'].map((s, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 2, color: COLORS.paper, opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)) }}>
                {s}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ position: 'absolute', left: 64, bottom: 44, zIndex: 5 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: 'rgba(206,190,160,0.75)' }}>
          01:23.21 → 01:50.65　·　ACT IV-1　树林 · 枣 · 玩具时代
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act6 = withFonts(Act6Inner);
