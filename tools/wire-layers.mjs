/**
 * wire-layers.mjs —— 给各幕接上「歌词 / 弹幕」两层。
 * 一次性脚本，跑完即可删除；不改 HTML，只做精确字符串替换。
 */
import fs from 'node:fs';

const ACTS = [
  { file: 'src/Act0v3.tsx', act: 'I', time: 't', danmaku: false },
  { file: 'src/Act4.tsx', act: 'II', time: 'abs', danmaku: false },
  { file: 'src/Act5.tsx', act: 'III', time: 'abs', danmaku: false },
  { file: 'src/Act6.tsx', act: 'IV', time: 'abs', danmaku: false },
  { file: 'src/Act7.tsx', act: 'IV', time: 'abs', danmaku: false },
  { file: 'src/Act8.tsx', act: 'IV', time: 'abs', danmaku: false },
  { file: 'src/Act9.tsx', act: 'V', time: 'abs', danmaku: true },
  { file: 'src/Act10.tsx', act: 'VI', time: 'abs', danmaku: true },
];

for (const a of ACTS) {
  let s = fs.readFileSync(a.file, 'utf8');
  const before = s;

  // 1) import
  if (!s.includes("from './components/Lyrics'")) {
    s = s.replace(
      "import { TextureStack } from './components/TextureStack';",
      "import { TextureStack } from './components/TextureStack';\nimport { Lyrics } from './components/Lyrics';"
    );
  }
  if (a.danmaku && !s.includes("from './components/Danmaku'")) {
    s = s.replace(
      "import { Lyrics } from './components/Lyrics';",
      "import { Danmaku } from './components/Danmaku';\nimport { Lyrics } from './components/Lyrics';"
    );
  }

  // 2) 弹幕：插在背景字符场之后、第一个前景元素之前（层级低于角色）
  if (a.danmaku) {
    const anchor =
      a.file.includes('Act9')
        ? '      <Cells t={t} />'
        : '      {t < T_STAND + 7 && <City t={t} opacity={cityIn * cityOut} scale={cityPush} />}';
    if (s.includes(anchor) && !s.includes('<Danmaku')) {
      s = s.replace(
        anchor,
        `      <Danmaku t={${a.time}} opacity={0.9} density={1.15} />\n\n${anchor}`
      );
    }
  }

  // 3) 歌词：插在纹理层之前（纹理压在最上面，字会被颗粒感吃掉一点，正好）
  if (!s.includes('<Lyrics')) {
    s = s.replace(
      /(\n\s*)<TextureStack /,
      `$1<Lyrics time={${a.time}} act="${a.act}" />$1<TextureStack `
    );
  }

  if (s !== before) {
    fs.writeFileSync(a.file, s);
    console.log(`✓ ${a.file}  act=${a.act}  danmaku=${a.danmaku}`);
  } else {
    console.log(`… ${a.file} 无变化`);
  }
}
