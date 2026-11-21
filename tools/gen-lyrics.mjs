/**
 * gen-lyrics.mjs —— 从 input/lyrics.json 生成 src/data/lyrics.ts
 *
 * 歌词受版权保护：生成物不进公开仓库（见 .gitignore）。
 * 克隆者自备 input/lyrics.lrc 后运行：node tools/gen-lyrics.mjs
 */
import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('input/lyrics.json', 'utf8'));
const lines = j.lines.map((l) => ({ t: +l.t, text: l.text }));
const out = `// 由 tools/gen-lyrics.mjs 生成，勿手改。受版权保护，不进公开仓库。
export type LyricLine = { t: number; text: string };
export const LYRICS: LyricLine[] = ${JSON.stringify(lines, null, 0)};
export const SONG_DURATION = ${j.duration};
`;
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/lyrics.ts', out);
console.log(`生成 ${lines.length} 行 → src/data/lyrics.ts`);
