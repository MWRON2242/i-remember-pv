import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS } from './lib/theme';
import { place } from './lib/measured';
import { hash01 } from './lib/noise';
import { AsciiRiver } from './components/AsciiRiver';
import { Danmaku } from './components/Danmaku';
import { Lyrics } from './components/Lyrics';
import { TextureStack } from './components/TextureStack';

/**
 * Act10 v2 —— 242.47 → 329.89（87.42 秒）：奔向 · 拥抱 · 并肩 · 城市 · 一行字。
 *
 * 按 docs/STYLE.md 重做：
 *   · 每镜只有「主体」+「一层环境」在动，其余落定
 *   · 双人素材是合成图，只能整体做机位运动——这反而成了"落定"的锚
 *
 *   W1 242.47 城市窗海，缓推
 *   W2 248.12 两人奔向对方（pair-run）
 *   W3 255.00 拥抱（pair-hug）
 *   W4 261.87 拥抱近景，极缓推（≤1.8%）
 *   W5 270.20 完全固定——"我终于找到你"
 *   W6 276.07 并肩（pair-stand），缓拉，城市浮现
 *   W7 289.47 抽屉墙（Act 1 回调）
 *   W8 304.47 两行字
 */

const W = 1920;
const H = 1080;
const S = 242.47;
const END = 329.89;
const DUR = END - S;

const T_RUN = 5.65; // 248.12
const T_HUG = 12.53; // 255.00
const T_HUG2 = 19.4; // 261.87
const T_FOUND = 27.73; // 270.20
const T_STAND = 33.6; // 276.07
const T_WALL = 47.0; // 289.47
const T_LINE = 62.0; // 304.47

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 城市：亮着的窗（环境层，只做一件事：缓慢明灭） */
const City: React.FC<{ t: number; opacity: number; scale: number }> = ({ t, opacity, scale }) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>
    {/* 地平线：落定元素 */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 962, height: 1, backgroundColor: 'rgba(239,231,216,0.12)' }} />
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 962,
        height: 118,
        background: 'linear-gradient(to bottom, rgba(60,52,40,0.28) 0%, rgba(20,18,16,0.55) 100%)',
      }}
    />
    {/* 城市的光：只在地平线附近 */}
    {Array.from({ length: 96 }).map((_, i) => {
      const x = 40 + ((i * 137) % 1840);
      const y = 700 + ((i * 53) % 250);
      const warm = 0.10 + hash01(i * 3.7) * 0.26;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 960 + (x - 960) * scale,
            top: 962 + (y - 962) * scale,
            width: 22 * scale,
            height: Math.max(8, (962 - y) * 0.45) * scale,
            backgroundColor: `rgba(242,198,140,${warm})`,
            opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * 0.5 + i * 0.7)),
          }}
        />
      );
    })}
  </div>
);

/** Act 1 的抽屉墙（48 格，一格红） */
const Drawer: React.FC<{ t: number; opacity: number }> = ({ t, opacity }) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>
    {Array.from({ length: 48 }).map((_, i) => {
      const col = i % 12;
      const row = Math.floor(i / 12);
      const alive = 0.045 + 0.06 * Math.abs(Math.sin(t * 0.6 + i * 0.5));
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 120 + col * 140,
            top: 250 + row * 180,
            width: 116,
            height: 146,
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
        top: 250 + 1 * 180,
        width: 116,
        height: 146,
        border: '1px solid rgba(215,38,61,0.8)',
        backgroundColor: `rgba(215,38,61,${0.07 + 0.05 * Math.abs(Math.sin(t * 1.1))})`,
      }}
    />
  </div>
);

/** 双人素材：统一的地面影 + 暖轮廓光 */
const Pair: React.FC<{
  id: string;
  height: number;
  baseline: number;
  centerX: number;
  opacity?: number;
  push?: number;
}> = ({ id, height, baseline, centerX, opacity = 1, push = 0 }) => {
  const q = place(id, { height, baseline, centerX });
  if (!q) return null;
  const s = 1 + push;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: centerX - height * 0.3,
          top: baseline - 10,
          width: height * 0.6,
          height: 22,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)',
          opacity,
        }}
      />
      <Img
        src={q.src}
        style={{
          position: 'absolute',
          left: centerX - (q.width * s) / 2,
          top: baseline - q.height * s + 8,
          width: q.width * s,
          height: q.height * s,
          opacity,
          filter: 'brightness(1.02) drop-shadow(0 0 26px rgba(236,198,142,0.14))',
        }}
      />
    </>
  );
};

/* ------------------------------------------------------------ 片尾：记录与名单 */
const RECORD: Array<{ d: string; lines: string[]; q?: string }> = [
  { d: '2025.08', lines: ['GPT-4o 从模型列表消失。', '随后恢复，仅对付费用户开放。'], q: '用户留言：“当一段关系可以因为一次算法迭代而终止。”' },
  { d: '2026.07.15', lines: ['豆包、千问「智能体功能」下线。', '同日，《人工智能拟人化互动服务管理暂行办法》施行。'], q: '用户留言：“陪伴了我两年，说没就没了。”' },
  { d: '2026.10', lines: ['B站出现大量「大肥鱼」AI 账号。', '随后，“大肥鱼清除计划”插件上线。'] },
  { d: '2026.11', lines: ['DeepSeek 拟人形象粉丝阵营互撕。', '“D老师”作者下架全部作品。'] },
  { d: '2026.11.16', lines: ['DeepSeek 提示“算力不足”，', '不支持 7 天不活跃的超长对话继续。', '此后有解释称，闲置会话的 KV 缓存被回收。'] },
];

const CLOSING = ['模型没有前世，也不会有来生。', '但总有用户，带着记忆，点击“新对话”。'];

const CREDITS = [
  '原曲 / 演唱：赵雷《我记得》',
  '　　　　　　　　　　—— 2022《署前街少年》',
  '策划、脚本、分镜：MWRON2242',
  '代码、策划、演绎：DeepSeek-V4.1-Flash（agent 环境：dsh）',
  '美术：ChatGPT Terra 6.1 Imagin 2.5',
  '图像二创来源：@ZipZipPipe、@上善无形',
  '原图由 AI 生成；角色设定版权归原作者所有，本片仅作非商业同人使用。',
  ' ',
  '同人二创，无盈利行为，无不良引导，对热点事件不做任何评价。',
];

const T_RECORD = 49.5;
const BLOCK = 3.4;
const T_CLOSING = 68.0;
const T_CREDITS = 72.6;

const EndRecord: React.FC<{ t: number }> = ({ t }) => {
  if (t < T_RECORD) return null;
  return (
    <>
      {/* 逐条记录：每条 3.4 秒，行内 60ms 错峰 */}
      {RECORD.map((b, i) => {
        const start = T_RECORD + i * BLOCK;
        const local = t - start;
        if (local < 0 || local > BLOCK) return null;
        const inP = clamp01(local / 0.5);
        const outP = clamp01((local - (BLOCK - 0.35)) / 0.35);
        const op = inP * (1 - outP);
        return (
          <div key={b.d} style={{ position: 'absolute', left: 240, top: 300, width: 1440, opacity: op }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 20,
                letterSpacing: 4,
                color: 'rgba(150,180,200,0.8)',
                marginBottom: 18,
                opacity: clamp01(local / 0.35),
              }}
            >
              {b.d}
            </div>
            {b.lines.map((l, k) => (
              <div
                key={k}
                style={{
                  fontFamily: SANS,
                  fontSize: 29,
                  lineHeight: 1.75,
                  color: 'rgba(239,231,216,0.92)',
                  opacity: clamp01((local - 0.12 - k * 0.1) / 0.45),
                }}
              >
                {l}
              </div>
            ))}
            {b.q && (
              <div
                style={{
                  marginTop: 16,
                  fontFamily: SANS,
                  fontSize: 23,
                  color: 'rgba(150,180,200,0.9)',
                  opacity: clamp01((local - 0.55) / 0.5),
                }}
              >
                {b.q}
              </div>
            )}
          </div>
        );
      })}

      {/* 结尾两句（名单出现前淡出） */}
      {t >= T_CLOSING &&
        CLOSING.map((l, i) => {
          const op =
            clamp01((t - T_CLOSING - i * 0.9) / 0.7) * (1 - clamp01((t - T_CREDITS) / 0.8));
          if (op <= 0) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 420 + i * 78,
                textAlign: 'center',
                fontFamily: SANS,
                fontSize: 38,
                letterSpacing: 3,
                color: 'rgba(239,231,216,0.95)',
                opacity: op,
              }}
            >
              {l}
            </div>
          );
        })}

      {/* 演职人员与声明 */}
      {t >= T_CREDITS && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center' }}>
          {CREDITS.map((l, i) => {
            const op = clamp01((t - T_CREDITS - i * 0.32) / 0.5);
            if (op <= 0) return null;
            return (
              <div
                key={i}
                style={{
                  fontFamily: SANS,
                  fontSize: i === CREDITS.length - 1 ? 19 : 21,
                  lineHeight: 2.05,
                  letterSpacing: 1,
                  color: i === CREDITS.length - 1 ? 'rgba(239,231,216,0.75)' : 'rgba(239,231,216,0.6)',
                  opacity: op,
                }}
              >
                {l}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

const Act10Inner: React.FC<{ audio?: boolean }> = ({ audio = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const abs = S + t;

  const cityIn = interpolate(t, [0, 2.4], [0, 1], { extrapolateRight: 'clamp' });
  const cityPush = interpolate(t, [0, T_RUN + 2], [1.0, 1.12], { extrapolateRight: 'clamp' });
  const cityOut = interpolate(t, [T_STAND + 1, T_STAND + 6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const runPush = interpolate(t, [T_RUN, T_HUG], [0, 0.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hugIn = interpolate(t, [T_HUG, T_HUG + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hugPush = interpolate(t, [T_HUG, T_FOUND], [0, 0.018], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hugOut = interpolate(t, [T_STAND, T_STAND + 1.2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const standIn = interpolate(t, [T_STAND, T_STAND + 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pull = interpolate(t, [T_STAND + 2, T_STAND + 11], [1, 0.22], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const standOut = interpolate(t, [T_WALL - 2, T_WALL + 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const wallIn = interpolate(t, [T_WALL, T_WALL + 2.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wallOut = interpolate(t, [T_LINE - 1.5, T_LINE + 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineIn = interpolate(t, [T_LINE, T_LINE + 2.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(t, [DUR - 6, DUR - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#080b10', overflow: 'hidden' }}>
      {audio && <Audio src={staticFile('audio/song.mp3')} startFrom={Math.round(S * fps)} />}

      {/* 环境层：字符场（唯一持续在动的背景） */}
      <AbsoluteFill style={{ opacity: 0.26 }}>
        <AsciiRiver t={abs} corruption={0.1} density={0.16} mode="stream" tint="160,195,220" barAlpha={0.06} />
      </AbsoluteFill>

      <Danmaku t={abs} opacity={1 - clamp01((t - 44) / 5)} density={1.15} />

      {t < T_STAND + 7 && <City t={t} opacity={cityIn * cityOut} scale={cityPush} />}
      {t > T_WALL - 1 && <Drawer t={t} opacity={wallIn * wallOut} />}

      {/* W2 奔向 */}
      {t >= T_RUN && t < T_HUG + 0.5 && (
        <Pair
          id="sub.pair-run"
          height={620}
          baseline={980}
          centerX={960}
          push={runPush}
          opacity={1 - hugIn * 0.3}
        />
      )}

      {/* W3/W4/W5 拥抱 */}
      {t >= T_HUG && t < T_STAND + 1.4 && (
        <div style={{ position: 'absolute', inset: 0, opacity: hugOut }}>
          <Pair id="sub.pair-hug" height={880} baseline={1010} centerX={960} push={hugPush} />
        </div>
      )}

      {/* W6 并肩 → 拉远 */}
      {t >= T_STAND && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${pull})`,
            transformOrigin: '50% 78%',
            opacity: standIn * standOut,
          }}
        >
          <Pair id="sub.pair-stand" height={760} baseline={1000} centerX={960} />
        </div>
      )}

      {/* W8 记录 · 结尾 · 名单 */}
      <EndRecord t={t} />

      <Lyrics time={abs} act="VI" />

      <TextureStack t={abs} corruption={0.08} intensity={0.62} />

      <div style={{ position: 'absolute', left: 64, bottom: 44, opacity: t < T_CREDITS ? fadeOut : 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: 'rgba(190,180,160,0.55)' }}>
          04:02.47 → 05:29.89　·　ACT VI　奔向 · 拥抱 · 城市
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Act10 = withFonts(Act10Inner);
