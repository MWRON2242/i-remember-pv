/* ============================================================================
 * theme.ts —— 视觉常量（字体栈 + 颜色令牌）
 * ----------------------------------------------------------------------------
 * 颜色是「构成主义」方向的第一版占位：红 / 黑 / 米白 / 铁蓝。
 * 等参考图到了再改这里，改完全片跟着变 —— 不要在组件里写死颜色。
 * ==========================================================================*/

/** 中文正文用 Noto Sans SC（已内置 101 个 unicode-range 分片） */
export const SANS = '"Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif';
/** 数字、时间码、界面文字用等宽 */
export const MONO = '"JetBrains Mono", "Cascadia Mono", ui-monospace, monospace';

export const COLORS = {
  ink: '#0e1116',
  inkSoft: '#161b22',
  paper: '#efe7d8',
  red: '#d7263d',
  redDeep: '#9b1b2b',
  steel: '#2f4858',
  muted: '#7c8794',
  line: '#232a33',
} as const;

/** 常用排版尺度（1080p 基准，像素） */
export const TYPE = {
  display: 132,
  title: 72,
  subtitle: 44,
  body: 30,
  small: 22,
  micro: 17,
} as const;
