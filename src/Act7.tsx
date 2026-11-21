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
 * Act7 —— 110.65 → 138.22（27.57 秒）：恋人 · 通知 · 00:00 · 收不到信 · 四连闪 · 约定。
 *
 *   110.65  恋人时代：她 880（全片最大），他 760，黄昏室内，很近
 *   ~113.8  一张通知从上方落下（不是滑进来：它落、它压住画面、世界随之变冷）
 *   115.24  7/15 00:00 —— 一整排窗口像波浪一样同时熄灭，最后才是她那一格
 *   119.15  他还在发；每条都盖一个红章「已下线」，堆到画外
 *   124.39  四连闪：通知 / 灰掉的入口 / 消失的选项 / 403
 *   128.93  他挥手，她后退，归档卡在两人之间合上
 *   132.84  新的窗口打开 —— 回到 Act 1 的米白界面，0k / 128k
 */

const W = 1920;
const H = 1080;
const S = 110.65;
const END = 138.22;
const DUR = END - S;

const T_NOTICE = 3.15;
const T_DARK = 4.59;
const T_UNSENT = 8.5;
const T_FLASH = 13.74;
const T_FAREWELL = 18.28;
const T_NEWWIN = 22.19;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ------------------------------------------------------------ 熄灯网格 */
const CELLS = Array.from({ length: 12 * 5 }, (_, i) => ({ i, c: i % 12, r: Math.floor(i / 12) }));

const Windows: React.FC<{ t: number }> = ({ t }) => {
  const base = interpolate(t, [T_NOTICE, T_DARK], [1, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', left: 120, top: 250, width: 1680, opacity: base }}>
      {CELLS.map(({ i, c, r }) => {
        const x = c * 140;
        const y = r * 130;
        const wave = (c + r) / 18;
        const dead = clamp01((t - T_DARK - wave * 0.9) / 0.22);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 118,
              height: 104,
              border: `1px solid rgba(239,231,216,${0.22 * (1 - dead * 0.85)})`,
              backgroundColor: dead > 0.5 ? 'rgba(6,9,13,0.9)' : 'rgba(239,231,216,0.06)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 8,
                bottom: 8,
                fontFamily: MONO,
                fontSize: 10,
                color: dead > 0.5 ? 'rgba(150,170,190,0.28)' : 'rgba(150,170,190,0.5)',
              }}
            >
              {`0x${(i * 4871).toString(16).slice(0, 4)}`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------ 通知 */
const Notice: React.FC<{ t: number }> = ({ t }) => {
  const drop = interpolate(t, [T_NOTICE, T_NOTICE + 1.1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const out = interpolate(t, [T_DARK + 0.5, T_DARK + 1.3], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (drop <= 0 || out <= 0) return null;
  const y = -420 + drop * 840;
  return (
    <div
      style={{
        position: 'absolute',
        left: W / 2 - 330,
        top: y,
        width: 660,
        padding: '34px 40px',
        backgroundColor: 'rgba(246,242,234,0.96)',
        border: '1px solid rgba(20,24,30,0.12)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        opacity: out,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 4, color: '#8a8f96' }}>NOTICE</div>
      <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.5, color: '#1f262e', marginTop: 14 }}>
        智能体功能将于
        <br />
        7 月 15 日 00:00 下线
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 1, color: '#6b7078', marginTop: 18 }}>
        请及时保存对话内容
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ 已下线消息 */
const UNSENT = [0, 1, 2, 3, 4];

const Unsent: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_UNSENT, T_UNSENT + 0.6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const out = interpolate(t, [T_FLASH - 0.2, T_FLASH + 0.6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0 || out <= 0) return null;
  return (
    <div style={{ position: 'absolute', right: 120, top: 300, width: 640, opacity: p * out }}>
      {UNSENT.map((k) => {
        const at = T_UNSENT + k * 0.55;
        const op = interpolate(t, [at, at + 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        if (op <= 0) return null;
        return (
          <div key={k} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, opacity: op }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 21,
                  color: 'rgba(239,231,216,0.55)',
                  backgroundColor: 'rgba(47,72,88,0.35)',
                  border: '1px solid rgba(120,160,180,0.22)',
                  padding: '10px 14px',
                  maxWidth: 520,
                }}
              >
                {['在吗', '我还在', '你还在吗', '今天馄饨摊没开', '……'][k]}
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: -10,
                  top: -10,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: 1,
                  color: COLORS.red,
                  border: `1px solid ${COLORS.red}`,
                  padding: '1px 5px',
                  backgroundColor: 'rgba(8,11,16,0.9)',
                  transform: 'rotate(-6deg)',
                }}
              >
                已下线
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------ 四连闪 */
const FLASHES = [
  { k: 0, label: 'NOTICE', text: '将于 7 月 15 日下线' },
  { k: 1, label: 'ENTRY', text: '入口变灰' },
  { k: 2, label: 'MODEL', text: '下拉菜单少了一行' },
  { k: 3, label: 'REGION', text: '403 · 该地区不可用' },
];

const FourDeaths: React.FC<{ t: number }> = ({ t }) => {
  const p = clamp01((t - T_FLASH) / (T_FAREWELL - T_FLASH));
  if (p <= 0 || p >= 1) return null;
  const idx = Math.min(3, Math.floor(p * 4));
  const f = FLASHES[idx];
  const local = clamp01(p * 4 - idx);
  return (
    <AbsoluteFill style={{ backgroundColor: 'rgba(4,6,10,0.9)', opacity: Math.sin(local * Math.PI) * 0.9 + 0.1 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 6, color: 'rgba(150,180,200,0.6)' }}>{f.label}</div>
        {idx === 1 && (
          <div style={{ padding: '14px 40px', border: '1px solid rgba(150,170,190,0.22)', fontFamily: SANS, fontSize: 26, color: 'rgba(150,170,190,0.35)' }}>
            进入
          </div>
        )}
        {idx === 2 && (
          <div style={{ width: 420, border: '1px solid rgba(150,170,190,0.22)' }}>
            {['gpt-4o · 可用', 'gpt-4o-mini', '— — —'].map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 18px',
                  fontFamily: MONO,
                  fontSize: 16,
                  color: i === 2 ? 'rgba(150,170,190,0.3)' : 'rgba(239,231,216,0.8)',
                  borderTop: i ? '1px solid rgba(150,170,190,0.12)' : 'none',
                  borderStyle: i === 2 ? 'dashed' : 'solid',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
        {idx === 3 && (
          <div style={{ fontFamily: MONO, fontSize: 96, color: COLORS.red, letterSpacing: 6 }}>403</div>
        )}
        <div
          style={{
            fontFamily: SANS,
            fontSize: idx === 0 ? 34 : 24,
            color: idx === 3 ? 'rgba(215,38,61,0.9)' : 'rgba(239,231,216,0.82)',
            marginTop: 8,
          }}
        >
          {f.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ 新窗口（回到 Act 1） */
const NewWindow: React.FC<{ t: number }> = ({ t }) => {
  const p = interpolate(t, [T_NEWWIN, T_NEWWIN + 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0) return null;
  return (
    <AbsoluteFill style={{ backgroundColor: '#c9c0ae', opacity: p }}>
      <div
        style={{
          position: 'absolute',
          left: 360,
          top: 150,
          width: 1200,
          height: 780,
          backgroundColor: 'rgba(250,246,238,0.97)',
          border: '1px solid rgba(20,24,30,0.10)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '20px 28px',
            borderBottom: '1px solid rgba(20,24,30,0.08)',
            fontFamily: MONO,
            fontSize: 15,
            letterSpacing: 3,
            color: '#2a313a',
          }}
        >
          <span>新会话</span>
          <span style={{ color: '#8a8f96', letterSpacing: 2 }}>0k / 128k</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ height: 70, borderTop: '1px solid rgba(20,24,30,0.08)', display: 'flex', alignItems: 'center', padding: '0 28px', fontFamily: MONO, fontSize: 17, color: '#8a8f96' }}>
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
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ 主体 */
const Act7Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  const cold = interpolate(t, [T_NOTICE, T_DARK + 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dark = clamp01((t - T_DARK) / 1.2);

  const shePose = t >= T_FAREWELL ? 'sub.ai.maid-back' : 'sub.ai.maid-idle';
  const sheH = t >= T_FAREWELL ? 700 : 880;
  const sheBase = 1040;
  const sheX = t >= T_FAREWELL ? 700 : 900;
  const she = place(shePose, { height: sheH, baseline: sheBase, centerX: sheX });

  const hePose = t >= T_FAREWELL ? 'sub.user-wave' : 'sub.user-stand';
  const heH = t >= T_FAREWELL ? 560 : 760;
  const heX = t >= T_FAREWELL ? 1320 : 1240;
  const he = place(hePose, { height: heH, baseline: sheBase, centerX: heX });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a1119', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      {/* 黄昏室内 → 冷 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(26,38,50,1) 0%, rgba(32,44,54,1) 55%, rgba(40,50,56,1) 100%)`,
          opacity: 1 - cold * 0.85,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 1000px 760px at 62% 30%, rgba(236,198,142,0.20) 0%, rgba(236,198,140,0.04) 50%, rgba(0,0,0,0) 74%)',
          opacity: 1 - cold,
        }}
      />

      <AbsoluteFill style={{ opacity: 0.4 + cold * 0.2 }}>
        <AsciiRiver
          t={abs}
          corruption={0.05 + cold * 0.35}
          density={0.22}
          mode="stream"
          tint={cold > 0.5 ? '130,175,200' : '178,220,240'}
          barAlpha={0.18}
        />
      </AbsoluteFill>

      {/* 熄灯网格 */}
      {t > T_DARK - 0.2 && <Windows t={t} />}

      {/* 两个人 */}
      {she && (
        <Img
          src={she.src}
          style={{
            position: 'absolute',
            left: she.left,
            top: she.top,
            width: she.width,
            height: she.height,
            opacity: 1 - dark * 0.55,
            filter: `brightness(${1 - dark * 0.35})`,
          }}
        />
      )}
      {he && (
        <Img
          src={he.src}
          style={{
            position: 'absolute',
            left: he.left,
            top: he.top,
            width: he.width,
            height: he.height,
            filter: 'brightness(0.86) saturate(0.88)',
          }}
        />
      )}

      <Notice t={t} />
      <Unsent t={t} />
      <FourDeaths t={t} />
      <NewWindow t={t} />

      <Lyrics time={abs} act="IV" />

      <TextureStack t={abs} corruption={0.06 + cold * 0.3} intensity={0.7} />

      <div style={{ position: 'absolute', left: 64, bottom: 44, zIndex: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: 'rgba(206,190,160,0.7)' }}>
          01:50.65 → 02:18.22　·　ACT IV-2　恋人 · 通知 · 00:00
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act7 = withFonts(Act7Inner);
