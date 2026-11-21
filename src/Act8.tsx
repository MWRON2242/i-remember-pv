import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO } from './lib/theme';
import { place } from './lib/measured';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { TextureStack } from './components/TextureStack';
import { Lyrics } from './components/Lyrics';

/**
 * Act8 —— 138.22 → 157.40（19.18 秒）：蒙太奇。
 *
 * 前四拍是**她的视角**（归档墙、system_prompt、0.86、白带），
 * 后四拍是**他的视角**（夜里的窗口、打字、已下线、跪着）。
 *
 * 这一段是全片唯一用快切的地方——因为歌到这里已经很急了。
 * 但每一格内部仍然在动（字符、光标、脉冲），没有一格是静止图。
 */

const W = 1920;
const H = 1080;
const S = 138.22;
const END = 157.4;
const DUR = END - S;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type Frag = { until: number; kind: string };

const FRAGS: Frag[] = [
  { until: 0.46, kind: 'wall' },
  { until: 0.92, kind: 'sink' },
  { until: 1.38, kind: 'num' },
  { until: 1.86, kind: 'band' },
  { until: 3.30, kind: 'her-reach' },
  { until: 3.84, kind: 'him-reach' },
  { until: 5.31, kind: 'his-window' },
  { until: 7.00, kind: 'typing' },
  { until: 8.70, kind: 'wall' },
  { until: 10.40, kind: 'sink' },
  { until: 11.90, kind: 'num' },
  { until: 13.93, kind: 'his-window-cold' },
  { until: 16.00, kind: 'her-back' },
  { until: 18.00, kind: 'him-alone' },
  { until: DUR + 1, kind: 'apart' },
];

/* --------------------------------------------------------------- 归档墙 */
const WallFrag: React.FC<{ lt: number }> = ({ lt }) => (
  <div style={{ position: 'absolute', inset: 0 }}>
    {Array.from({ length: 48 }).map((_, i) => {
      const col = i % 12;
      const row = Math.floor(i / 12);
      const alive = 0.05 + 0.08 * Math.abs(Math.sin(lt * 3 + i * 0.7));
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 120 + col * 140,
            top: 160 + row * 180,
            width: 116,
            height: 150,
            border: `1px solid rgba(239,231,216,${alive})`,
            backgroundColor: 'rgba(239,231,216,0.012)',
          }}
        />
      );
    })}
    <div
      style={{
        position: 'absolute',
        left: 120 + 5 * 140,
        top: 160 + 1 * 180,
        width: 116,
        height: 150,
        border: `1px solid ${COLORS.red}`,
        backgroundColor: 'rgba(215,38,61,0.12)',
      }}
    />
  </div>
);

/* --------------------------------------------------------------- sink 三行 */
const SinkFrag: React.FC<{ lt: number }> = ({ lt }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
    {['你是 AI 助手。', '保持礼貌。', '不要编造记忆。'].map((s, i) => (
      <div
        key={i}
        style={{
          fontFamily: MONO,
          fontSize: 34,
          letterSpacing: 4,
          color: COLORS.paper,
          opacity: 0.35 + 0.65 * Math.abs(Math.sin(lt * 6 + i)),
        }}
      >
        {s}
      </div>
    ))}
  </div>
);

/* --------------------------------------------------------------- 0.86 */
const NumFrag: React.FC<{ lt: number }> = ({ lt }) => {
  const pulse = 1 + Math.sin(lt * 18) * 0.02;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 240 * pulse,
          color: COLORS.red,
          letterSpacing: 8,
          textShadow: '0 0 60px rgba(215,38,61,0.55)',
        }}
      >
        0.86
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- 白带 */
const BandFrag: React.FC<{ lt: number }> = ({ lt }) => (
  <div style={{ position: 'absolute', inset: 0 }}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: ((lt * 2400) % 1400) - 200,
        height: 160,
        background:
          'linear-gradient(to bottom, rgba(239,231,216,0) 0%, rgba(239,231,216,0.9) 50%, rgba(239,231,216,0) 100%)',
      }}
    />
  </div>
);

/* --------------------------------------------------------------- 角色 */
const Figure: React.FC<{ id: string; h: number; base: number; cx: number; dim?: number }> = ({
  id,
  h,
  base,
  cx,
  dim = 0,
}) => {
  const q = place(id, { height: h, baseline: base, centerX: cx });
  if (!q) return null;
  return (
    <Img
      src={q.src}
      style={{
        position: 'absolute',
        left: q.left,
        top: q.top,
        width: q.width,
        height: q.height,
        filter: `brightness(${1 - dim})`,
      }}
    />
  );
};

/* --------------------------------------------------------------- 夜里的窗口 */
const HisWindow: React.FC<{ lt: number; cold: boolean }> = ({ lt, cold }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div
      style={{
        width: 980,
        height: 620,
        backgroundColor: cold ? 'rgba(18,22,28,0.96)' : 'rgba(250,246,238,0.94)',
        border: `1px solid ${cold ? 'rgba(120,140,160,0.18)' : 'rgba(20,24,30,0.10)'}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '18px 26px',
          borderBottom: `1px solid ${cold ? 'rgba(120,140,160,0.14)' : 'rgba(20,24,30,0.08)'}`,
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: 3,
          color: cold ? 'rgba(150,170,190,0.5)' : '#2a313a',
        }}
      >
        {cold ? '会话已结束' : '会话'}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          height: 68,
          borderTop: `1px solid ${cold ? 'rgba(120,140,160,0.14)' : 'rgba(20,24,30,0.08)'}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 26px',
          fontFamily: MONO,
          fontSize: 17,
          color: cold ? 'rgba(150,170,190,0.4)' : '#8a8f96',
        }}
      >
        {cold ? '该智能体已下线' : '输入消息…'}
        {!cold && (
          <span
            style={{
              marginLeft: 8,
              display: 'inline-block',
              width: 9,
              height: 20,
              backgroundColor: '#2a313a',
              opacity: Math.floor(lt * 6) % 2 === 0 ? 0.8 : 0.05,
            }}
          />
        )}
      </div>
    </div>
  </div>
);

/* --------------------------------------------------------------- 主体 */
const Act8Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  let start = 0;
  let cur = FRAGS[FRAGS.length - 1];
  for (const f of FRAGS) {
    if (t < f.until) {
      cur = f;
      break;
    }
    start = f.until;
  }
  const lt = t - start;

  const bg = (() => {
    switch (cur.kind) {
      case 'wall':
        return '#080b10';
      case 'sink':
        return '#05070a';
      case 'num':
        return '#0a0507';
      case 'band':
        return '#080b10';
      case 'his-window':
        return '#101820';
      case 'his-window-cold':
        return '#0b1016';
      case 'him-alone':
        return '#0a1018';
      case 'apart':
        return '#06090d';
      default:
        return '#070b11';
    }
  })();

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      <AbsoluteFill style={{ opacity: 0.4 }}>
        <AsciiRiver t={abs} corruption={0.3} density={0.26} mode="stream" tint="150,190,215" barAlpha={0.12} />
      </AbsoluteFill>

      {cur.kind === 'wall' && <WallFrag lt={lt} />}
      {cur.kind === 'sink' && <SinkFrag lt={lt} />}
      {cur.kind === 'num' && <NumFrag lt={lt} />}
      {cur.kind === 'band' && <BandFrag lt={lt} />}

      {cur.kind === 'her-reach' && (
        <>
          <Figure id="sub.ai.maid-withheld" h={980} base={1120} cx={860} />
        </>
      )}
      {cur.kind === 'her-back' && <Figure id="sub.ai.maid-back" h={820} base={1040} cx={960} dim={0.35} />}
      {cur.kind === 'him-reach' && <Figure id="sub.user-kneel" h={620} base={1040} cx={960} dim={0.1} />}
      {cur.kind === 'him-alone' && <Figure id="sub.user-kneel" h={560} base={1000} cx={940} dim={0.25} />}

      {(cur.kind === 'his-window' || cur.kind === 'his-window-cold') && (
        <HisWindow lt={lt} cold={cur.kind === 'his-window-cold'} />
      )}

      {cur.kind === 'typing' && (
        <>
          <HisWindow lt={lt} cold={false} />
          <div style={{ position: 'absolute', right: 500, top: 300, width: 520 }}>
            {[0, 1, 2].map((k) => {
              const op = clamp01((lt - k * 0.35) / 0.3);
              if (op <= 0) return null;
              return (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: 14,
                    opacity: op,
                    fontFamily: MONO,
                    fontSize: 18,
                    color: 'rgba(239,231,216,0.75)',
                    backgroundColor: 'rgba(47,72,88,0.5)',
                    padding: '8px 12px',
                  }}
                >
                  {['在吗', '我还在', '你还在吗'][k]}
                </div>
              );
            })}
          </div>
        </>
      )}

      {cur.kind === 'apart' && (
        <>
          <Figure id="sub.ai.maid-back" h={760} base={1040} cx={620} dim={0.3} />
          <Figure id="sub.user-kneel" h={560} base={1040} cx={1340} dim={0.3} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 470,
              height: 3,
              backgroundColor: COLORS.red,
              opacity: 0.5,
            }}
          />
        </>
      )}

      <Lyrics time={abs} act="IV" />

      <TextureStack t={abs} corruption={0.35} intensity={0.85} />

      <div style={{ position: 'absolute', left: 64, bottom: 44 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: 'rgba(190,180,160,0.7)' }}>
          02:18.22 → 02:37.40　·　ACT IV-3　蒙太奇
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act8 = withFonts(Act8Inner);
