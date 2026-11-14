import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { withFonts } from './lib/fonts';
import { COLORS, MONO, SANS, TYPE } from './lib/theme';
import { fmtTime } from './lib/beats';
import {
  AUDIO_SRC,
  BPM,
  BEATS,
  FILM,
  HEIGHT,
  LYRIC_COUNT,
  SONG_DURATION,
  WIDTH,
} from './lib/song';

/**
 * MainFilm —— 正片壳子。
 *
 * 现在只做三件事，且都是「工程」而不是「分镜」：
 *   1. 播音频（证明 audio 与 composition 时长对齐）
 *   2. 画一张占位卡，明确写着「画面待分镜」，避免被误当成成片
 *   3. 歌放完后黑场 + 片尾署名与同人声明（内容来自 input/film.json）
 *
 * 分镜定稿后，把 Placeholder 换成按段落调度的场景组件即可；
 * 音频、时长、片尾这三段不用动。
 */
const MainFilmInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const inSong = t < SONG_DURATION;
  const outroStart = SONG_DURATION;
  const creditsOpacity = interpolate(t, [outroStart + 0.8, outroStart + 2.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const placeholderOpacity = interpolate(t, [SONG_DURATION - 0.6, SONG_DURATION], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: SANS }}>
      <Audio src={staticFile(AUDIO_SRC)} />

      {/* 占位卡：歌还在放的时候显示 */}
      {inSong && (
        <AbsoluteFill style={{ opacity: placeholderOpacity }}>
          {/* 顶栏 */}
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 72,
              right: 72,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontFamily: MONO,
              fontSize: TYPE.micro,
              letterSpacing: 2,
              color: COLORS.muted,
            }}
          >
            <span>
              {FILM.artist} · {FILM.title}
            </span>
            <span>
              {fmtTime(t, fps)}　F{String(frame).padStart(5, '0')}　{WIDTH}×{HEIGHT} · {fps}fps
            </span>
          </div>

          {/* 中央占位 */}
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: TYPE.micro,
                letterSpacing: 6,
                color: COLORS.red,
                marginBottom: 26,
              }}
            >
              PROJECT SKELETON · 工程骨架
            </div>
            <div style={{ fontSize: TYPE.display, fontWeight: 700, lineHeight: 1.05, letterSpacing: 4 }}>
              {FILM.title}
            </div>
            <div
              style={{
                marginTop: 34,
                fontSize: TYPE.subtitle,
                color: COLORS.paper,
                opacity: 0.86,
                letterSpacing: 2,
              }}
            >
              分镜尚未开始 · 画面待定
            </div>
            <div
              style={{
                marginTop: 18,
                fontFamily: MONO,
                fontSize: TYPE.small,
                letterSpacing: 3,
                color: COLORS.muted,
              }}
            >
              NOTHING STORYBOARDED YET
            </div>

            {/* 数据摘要：证明数据管线已经通了 */}
            <div
              style={{
                marginTop: 64,
                display: 'flex',
                gap: 44,
                fontFamily: MONO,
                fontSize: TYPE.micro,
                color: COLORS.muted,
                letterSpacing: 1,
              }}
            >
              <span>音源 {fmtTime(SONG_DURATION, fps)}</span>
              <span>{BPM.toFixed(2)} BPM</span>
              <span>{BEATS.length} 拍</span>
              <span>{LYRIC_COUNT} 句歌词</span>
              <span>{WIDTH}×{HEIGHT}</span>
            </div>
          </AbsoluteFill>

          {/* 底部进度条 */}
          <div
            style={{
              position: 'absolute',
              left: 72,
              right: 72,
              bottom: 64,
              height: 2,
              backgroundColor: COLORS.line,
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (t / SONG_DURATION) * 100)}%`,
                height: '100%',
                backgroundColor: COLORS.red,
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* 片尾署名（黑场 + 同人声明） */}
      {!inSong && (
        <AbsoluteFill
          style={{
            backgroundColor: '#000',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: creditsOpacity,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            {FILM.credits.map((c) => (
              <div
                key={c.text}
                style={{
                  fontFamily: SANS,
                  fontSize: c.kind === 'notice' ? TYPE.small : TYPE.body,
                  color: c.kind === 'notice' ? COLORS.muted : COLORS.paper,
                  letterSpacing: c.kind === 'notice' ? 1 : 3,
                  textAlign: 'center',
                }}
              >
                {c.text}
              </div>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const MainFilm = withFonts(MainFilmInner);
