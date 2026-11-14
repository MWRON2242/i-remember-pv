/* ============================================================================
 * song.ts —— 全片唯一的「数据入口」
 * ----------------------------------------------------------------------------
 * 换歌 / 换音源 / 换画幅时只动 input/ 里的文件，代码一行不改：
 *
 *   1. input/film.json          → 画幅、帧率、音源路径、片尾署名
 *   2. input/song.beats.json    → 打点表（拍点、时长、BPM、段落）   tools/build.mjs beats
 *   3. input/lyrics.json        → 歌词时间轴（逐句时间码 + 无人声区间）tools/build.mjs lyrics
 *   4. input/timeline.json      → 分镜表（定稿后才有）
 *   5. public/audio/<歌>        → 音频本体（Remotion 只能读 public/）
 *
 * 约定：时间单位一律是「秒」，只有 JSX 里才换算成帧。
 * ==========================================================================*/
import filmJson from '../../input/film.json';
import beatsJson from '../../input/song.beats.json';
import lyricsJson from '../../input/lyrics.json';

/* ---------------------------------------------------------------- 画幅与音源 */
export const FILM = {
  title: filmJson.title as string,
  artist: filmJson.artist as string,
  audio: filmJson.audio as string,
  fps: filmJson.fps as number,
  width: filmJson.width as number,
  height: filmJson.height as number,
  outroSeconds: filmJson.outroSeconds as number,
  credits: filmJson.credits as Array<{ text: string; kind: string }>,
};

export const FPS: number = FILM.fps;
export const WIDTH: number = FILM.width;
export const HEIGHT: number = FILM.height;
export const AUDIO_SRC: string = FILM.audio;

/* -------------------------------------------------------------------- 打点 */
export const BEATS: number[] = beatsJson.beats as number[];
export const SONG_DURATION: number = beatsJson.duration as number;
export const BPM: number = beatsJson.bpm as number;
export const BARS: number = beatsJson.bars as number;
export const SECTIONS = beatsJson.sections as Array<{ t: number; name: string; note: string }>;
export const DOWNBEATS: number[] = (beatsJson.downbeats ?? []) as number[];
export const PHRASES: number[] = (beatsJson.phrases ?? []) as number[];

/* -------------------------------------------------------------------- 歌词 */
export type LyricLine = { i: number; t: number; text: string };
export type Gap = {
  from: number;
  to: number;
  len: number;
  kind: 'intro' | 'between' | 'outro';
  afterLine?: number;
};

export const LYRIC_LINES: LyricLine[] = lyricsJson.lines as LyricLine[];
export const LYRIC_COUNT: number = lyricsJson.count as number;
export const FIRST_VOCAL: number = lyricsJson.firstVocalAt as number;
export const LAST_VOCAL: number = lyricsJson.lastVocalAt as number;
export const VOCAL_GAPS: Gap[] = lyricsJson.gaps as Gap[];

/* -------------------------------------------------------------------- 片长 */
/** 正片长度：歌长 + 片尾署名 */
export const FILM_DURATION = SONG_DURATION + FILM.outroSeconds;
/** 正片帧数 */
export const FILM_FRAMES = Math.round(FILM_DURATION * FPS);
/** 歌本身的帧数 */
export const SONG_FRAMES = Math.round(SONG_DURATION * FPS);

/* --------------------------------------------------------- 工程自检片 */
/** 自检片长度（秒） */
export const PIPELINE_TEST_SECONDS = 12;
/** 自检片从哪一秒开始取样：首句人声前 2 秒，保证字幕与卡点都能看到 */
export const PIPELINE_TEST_START = Math.max(0, FIRST_VOCAL - 2);
