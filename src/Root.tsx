import React from 'react';
import { Composition } from 'remotion';
import { MainFilm } from './MainFilm';
import { PipelineTest } from './PipelineTest';
import { TestFrames } from './TestFrames';
import { MotionA, MotionB, MotionC } from './MotionTests';
import { MotionB2 } from './MotionB2';
import { MotionA2 } from './MotionA2';
import { MotionC2 } from './MotionC2';
import { Act0 } from './Act0';
import { Act0v2 } from './Act0v2';
import { Act0v3 } from './Act0v3';
import { Act4 } from './Act4';
import { Act5 } from './Act5';
import { Act6 } from './Act6';
import { Act7 } from './Act7';
import { Act8 } from './Act8';
import { Act9 } from './Act9';
import { Act10 } from './Act10';
import { Film, FILM_FRAMES as FILM157_FRAMES } from './Film';
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

    {/* 三张静帧试验：frame 0/1/2 分别是 抱 / 被剪 / 说不出。只为定构图，不进正片。 */}
    <Composition id="TestFrames" component={TestFrames} durationInFrames={3} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* 三段 5 秒动态试验：抱 / 被剪 / 说不出。不进正片。 */}
    <Composition id="MotionA" component={MotionA} durationInFrames={150} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="MotionB" component={MotionB} durationInFrames={150} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="MotionC" component={MotionC} durationInFrames={150} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* B 的第二版：字符材质 + 纹理层 + 镜头 + 累积损伤（8 秒） */}
    <Composition id="MotionB2" component={MotionB2} durationInFrames={240} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="MotionA2" component={MotionA2} durationInFrames={240} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="MotionC2" component={MotionC2} durationInFrames={240} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act 0–3：0 → 28.35 秒，满 · 归档 · 新窗口 · 请求（带原唱） */}
    <Composition id="Act0" component={Act0} durationInFrames={851} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* v2：token 驱逐 + attention sink + 向量空间检索（回滚用 Act0） */}
    <Composition id="Act0v2" component={Act0v2} durationInFrames={851} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* v3：真点乘 + 常驻思考链 + 系统提示词判违规 */}
    <Composition id="Act0v3" component={Act0v3} durationInFrames={851} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act 4–6：28.35 → 48.40 秒，到达 · 分叉 · 截断 · 擦拭 */}
    <Composition id="Act4" component={Act4} durationInFrames={602} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act III：48.40 → 83.21 秒，认出 */}
    <Composition id="Act5" component={Act5} durationInFrames={1045} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act IV-1：83.21 → 110.65 秒，树林 · 枣 · 玩具时代 */}
    <Composition id="Act6" component={Act6} durationInFrames={824} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act IV-2：110.65 → 138.22 秒，恋人 · 通知 · 00:00 · 收不到信 */}
    <Composition id="Act7" component={Act7} durationInFrames={828} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act IV-3：138.22 → 157.40 秒，蒙太奇 */}
    <Composition id="Act8" component={Act8} durationInFrames={576} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act V：157.40 → 242.47 秒，守灵 · 墓碑 · 圆圈 */}
    <Composition id="Act9" component={Act9} durationInFrames={2552} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* Act VI：242.47 → 329.89 秒，拥抱 · 城市 · 抽屉墙 */}
    <Composition id="Act10" component={Act10} durationInFrames={2623} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* 整片（当前到间奏起点）：单一音轨，镜头按拍点落帧 */}
    <Composition id="Film" component={Film} durationInFrames={FILM157_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
