import React from 'react';
import { Composition } from 'remotion';
import { MainFilm } from './MainFilm';
import { PipelineTest } from './PipelineTest';
import { FPS, HEIGHT, WIDTH, FILM_FRAMES, PIPELINE_TEST_SECONDS } from './lib/song';

/**
 * 「影片登记处」：每个 Composition 就是一条可渲染的成片（id + 组件 + 时长 + 画布）。
 * 时长全部从数据算出来 —— 时间是一等公民。
 */
export const RemotionRoot: React.FC = () => (
  <>
    {/* 正片。分镜未定稿前，这里渲染的是占位画面 + 片尾署名。 */}
    <Composition
      id="MainFilm"
      component={MainFilm}
      durationInFrames={FILM_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />

    {/* 工程自检片：把时间码、卡点、歌词时间轴、字体全部画在一屏上，12 秒。 */}
    <Composition
      id="PipelineTest"
      component={PipelineTest}
      durationInFrames={Math.round(PIPELINE_TEST_SECONDS * FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
