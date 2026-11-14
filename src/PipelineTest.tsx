import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS, TYPE } from './lib/theme';
import { barAt, beatIndexAt, fmtDuration, fmtTime, flash, sinceBeat } from './lib/beats';
import {
  AUDIO_SRC,
  BEATS,
  BPM,
  FIRST_VOCAL,
  LYRIC_LINES,
  PIPELINE_TEST_START,
  SONG_DURATION,
  VOCAL_GAPS,
} from './lib/song';

/**
 * PipelineTest —— 工程自检片（12 秒）。
 *
 * 它不是分镜，也不该有审美野心。它只回答四个问题：
 *   1. 音频进得来、并且和画面同一个时间轴吗？（看时间码 + 听声音）
 *   2. 打点表准不准？（看底部拍条与脉冲）
 *   3. 歌词时间轴对不对？（看字幕在 28 秒附近逐句跳）
 *   4. 字体真的加载了吗？（看右下角三行样张，而不是回退字体）
 *
 * 所以它故意把「数据」摊开给你看，跑一次就知道整条管线通没通。
 */

const PAD = 72;
const RAIL_Y = 604;
const RAIL_H = 76;

const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: TYPE.micro,
      letterSpacing: 3,
      color: COLORS.muted,
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </div>
);

const PipelineTestInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = PIPELINE_TEST_START + frame / fps;

  const bIdx = beatIndexAt(t);
  const beatFlash = flash(t, 0.3);

  // 当前句 / 下一句
  let cur = -1;
  for (let i = 0; i < LYRIC_LINES.length; i++) if (t >= LYRIC_LINES[i].t) cur = i;
  const currentLine = cur >= 0 ? LYRIC_LINES[cur] : null;
  const nextLine = LYRIC_LINES[cur + 1] ?? null;

  const railX = Math.min(width - PAD * 2, Math.max(0, (t / SONG_DURATION) * (width - PAD * 2)));

  // 底部拍条窗口：t-2.5s 到 t+7.5s
  const winFrom = t - 2.5;
  const winTo = t + 7.5;
  const win = BEATS.map((b, i) => ({ b, i })).filter(({ b }) => b >= winFrom && b <= winTo);
  const stripW = width - PAD * 2;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0e13', color: COLORS.paper, fontFamily: SANS }}>
      <Audio src={staticFile(AUDIO_SRC)} startFrom={Math.round(PIPELINE_TEST_START * fps)} />

      {/* 头部 */}
      <div
        style={{
          position: 'absolute',
          top: PAD - 24,
          left: PAD,
          right: PAD,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <div style={{ fontSize: TYPE.small, fontWeight: 700, letterSpacing: 2 }}>工程自检</div>
          <Label>PIPELINE TEST · 12s</Label>
        </div>
        <Label>
          {width}×{height} · {fps}fps · headphones recommended
        </Label>
      </div>

      {/* 左上：时间 */}
      <div style={{ position: 'absolute', top: 138, left: PAD }}>
        <Label>时间 / TIMECODE</Label>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: 2,
            lineHeight: 1.15,
            marginTop: 10,
          }}
        >
          {fmtTime(t, fps)}
        </div>
        <div style={{ fontFamily: MONO, fontSize: TYPE.small, color: COLORS.muted, marginTop: 6 }}>
          t = {t.toFixed(3)} s　·　frame {String(frame).padStart(4, '0')} / {Math.round(12 * fps)}
        </div>
      </div>

      {/* 左中：打点 */}
      <div style={{ position: 'absolute', top: 360, left: PAD, display: 'flex', gap: 56 }}>
        <div>
          <Label>节拍 / BEAT</Label>
          <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 8 }}>
            {bIdx >= 0 ? `#${bIdx + 1}` : '—'}
            <span style={{ fontSize: TYPE.small, color: COLORS.muted }}> / {BEATS.length}</span>
          </div>
        </div>
        <div>
          <Label>小节 / BAR</Label>
          <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 8 }}>{barAt(t)}</div>
        </div>
        <div>
          <Label>距上一拍 / SINCE</Label>
          <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 8 }}>
            {(sinceBeat(t) * 1000).toFixed(0)}
            <span style={{ fontSize: TYPE.small, color: COLORS.muted }}> ms</span>
          </div>
        </div>
        <div>
          <Label>速度 / BPM</Label>
          <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 8 }}>{BPM.toFixed(2)}</div>
        </div>
        {/* 击打脉冲 */}
        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 999,
              border: `2px solid ${COLORS.red}`,
              opacity: 0.15 + 0.85 * beatFlash,
              transform: `scale(${0.6 + 0.4 * beatFlash})`,
            }}
          />
          <div
            style={{
              width: 18 + 14 * beatFlash,
              height: 18 + 14 * beatFlash,
              borderRadius: 999,
              backgroundColor: COLORS.red,
            }}
          />
        </div>
      </div>

      {/* 歌词时间轴 */}
      <div style={{ position: 'absolute', top: RAIL_Y - 34, left: PAD }}>
        <Label>歌词时间轴 / LYRIC TIMING · 首句 {FIRST_VOCAL.toFixed(2)}s · {LYRIC_LINES.length} 句</Label>
      </div>
      <svg
        style={{ position: 'absolute', top: RAIL_Y, left: PAD }}
        width={stripW}
        height={RAIL_H}
        viewBox={`0 0 ${stripW} ${RAIL_H}`}
      >
        {/* 基线 */}
        <line x1={0} y1={RAIL_H / 2} x2={stripW} y2={RAIL_H / 2} stroke={COLORS.line} strokeWidth={2} />
        {/* 无人声区间 */}
        {VOCAL_GAPS.map((g, i) => {
          const x0 = (g.from / SONG_DURATION) * stripW;
          const x1 = (g.to / SONG_DURATION) * stripW;
          return (
            <rect
              key={`gap-${i}`}
              x={x0}
              y={RAIL_H / 2 - 10}
              width={Math.max(1, x1 - x0)}
              height={20}
              fill={g.kind === 'between' ? COLORS.steel : '#1c242c'}
              opacity={0.75}
            />
          );
        })}
        {/* 每句一个刻度 */}
        {LYRIC_LINES.map((l) => {
          const x = (l.t / SONG_DURATION) * stripW;
          const isCur = currentLine && l.i === currentLine.i;
          return (
            <rect
              key={`ln-${l.i}`}
              x={x}
              y={RAIL_H / 2 - 22}
              width={isCur ? 4 : 2}
              height={44}
              fill={isCur ? COLORS.red : COLORS.paper}
              opacity={isCur ? 1 : 0.55}
            />
          );
        })}
        {/* 播放头 */}
        <line x1={railX} y1={0} x2={railX} y2={RAIL_H} stroke={COLORS.red} strokeWidth={2.5} />
        <circle cx={railX} cy={RAIL_H / 2} r={5} fill={COLORS.red} />
      </svg>

      {/* 当前歌词 */}
      <div style={{ position: 'absolute', top: RAIL_Y + RAIL_H + 40, left: PAD, width: stripW }}>
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: 2,
            lineHeight: 1.25,
            color: currentLine ? COLORS.paper : COLORS.muted,
          }}
        >
          {currentLine ? currentLine.text : '（前奏 · 未到人声）'}
        </div>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 28,
            alignItems: 'baseline',
            fontFamily: MONO,
            fontSize: TYPE.small,
            color: COLORS.muted,
          }}
        >
          <span>第 {currentLine ? currentLine.i : '—'} 句</span>
          <span>起于 {currentLine ? currentLine.t.toFixed(2) : '—'} s</span>
          {nextLine && (
            <span style={{ color: COLORS.paper, opacity: 0.7 }}>
              下一句 +{(nextLine.t - t).toFixed(2)} s　「{nextLine.text}」
            </span>
          )}
        </div>
      </div>

      {/* 字体样张 */}
      <div style={{ position: 'absolute', top: 138, right: PAD, width: 520, textAlign: 'right' }}>
        <Label style={{ textAlign: 'right' }}>字体 / FONTS</Label>
        <div style={{ fontSize: 46, fontWeight: 700, marginTop: 12, letterSpacing: 2 }}>我记得</div>
        <div style={{ fontSize: 26, marginTop: 8, opacity: 0.85 }}>我带着比身体重的行李</div>
        <div style={{ fontFamily: MONO, fontSize: 22, marginTop: 14, color: COLORS.muted }}>
          JetBrains Mono · 0123456789 · {fmtDuration(SONG_DURATION)}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, marginTop: 22, color: COLORS.muted, letterSpacing: 1 }}>
          {PIPELINE_TEST_START.toFixed(2)}s → {(PIPELINE_TEST_START + 12).toFixed(2)}s
        </div>
      </div>

      {/* 底部拍条 */}
      <div style={{ position: 'absolute', left: PAD, bottom: 96, width: stripW, height: 120 }}>
        <div style={{ position: 'relative', height: 92 }}>
          {win.map(({ b, i }) => {
            const x = ((b - winFrom) / (winTo - winFrom)) * stripW;
            const isCur = i === bIdx;
            const isDown = i % 4 === 0;
            return (
              <div key={`beat-${i}`} style={{ position: 'absolute', left: x, bottom: 0 }}>
                <div
                  style={{
                    width: isCur ? 4 : 2,
                    height: isDown ? 64 : 34,
                    backgroundColor: isCur ? COLORS.red : COLORS.paper,
                    opacity: isCur ? 1 : isDown ? 0.8 : 0.35,
                  }}
                />
                {isDown && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 70,
                      left: -10,
                      fontFamily: MONO,
                      fontSize: 15,
                      color: COLORS.muted,
                    }}
                  >
                    {Math.floor(i / 4) + 1}
                  </div>
                )}
              </div>
            );
          })}
          {/* 播放头 */}
          <div
            style={{
              position: 'absolute',
              left: ((t - winFrom) / (winTo - winFrom)) * stripW,
              bottom: -6,
              width: 2,
              height: 100,
              backgroundColor: COLORS.red,
              opacity: 0.9,
            }}
          />
        </div>
        <Label style={{ marginTop: 8 }}>
          拍条 / BEATS · 窗口 {winFrom.toFixed(1)}s → {winTo.toFixed(1)}s
        </Label>
      </div>
    </AbsoluteFill>
  );
};

export const PipelineTest = withFonts(PipelineTestInner);
