import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { withFonts } from './lib/fonts';
import { Act0v3 } from './Act0v3';
import { Act4 } from './Act4';
import { Act5 } from './Act5';
import { Act6 } from './Act6';
import { Act7 } from './Act7';
import { Act8 } from './Act8';
import { Act9 } from './Act9';
import { Act10 } from './Act10';

/**
 * Film —— 整片（目前到 157.40 秒，间奏起点）。
 *
 * 为什么要有一个总合成，而不是把 mp4 拼起来：
 *   1. 每段单独渲染会各自编码一次 AAC，接缝处带着编码延迟与填充，
 *      实测在 48.4 / 83.3 / 138.4 三处一阶差分达到 0.15–0.20（全片中位数 0.011）——
 *      听感就是“炸”和卡顿。
 *   2. 各段帧数取整会累积 +0.01–0.02 秒，六段之后音画能差到 0.16 秒。
 *   在这里，**全片只有一条音轨**，每个镜头按真实拍点落在帧上。
 */

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

/** round(秒 × 30)，全部对齐到帧 */
const AT = (s: number) => Math.round(s * FPS);

const CUTS = [
  { at: 0, Comp: Act0v3, end: 28.35 },
  { at: 28.35, Comp: Act4, end: 48.4 },
  { at: 48.4, Comp: Act5, end: 83.21 },
  { at: 83.21, Comp: Act6, end: 110.65 },
  { at: 110.65, Comp: Act7, end: 138.22 },
  { at: 138.22, Comp: Act8, end: 157.4 },
  { at: 157.4, Comp: Act9, end: 242.47 },
  { at: 242.47, Comp: Act10, end: 329.89 },
];

export const FILM_FROM = 0;
export const FILM_TO = 329.89;
export const FILM_FRAMES = AT(FILM_TO) - AT(FILM_FROM);

const FilmInner: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#080b10' }}>
    {/* 唯一音轨。压 1 dB 避开源文件的满刻度削顶（实测 83.89s 处峰值 1.0000） */}
    <Audio src={staticFile('audio/song-master.wav')} />

    {CUTS.map(({ at, Comp, end }, i) => {
      const from = AT(at);
      const to = i + 1 < CUTS.length ? AT(CUTS[i + 1].at) : AT(end);
      return (
        <Sequence key={at} from={from} durationInFrames={to - from} name={`${at}s`}>
          <Comp audio={false} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export const Film = withFonts(FilmInner);

