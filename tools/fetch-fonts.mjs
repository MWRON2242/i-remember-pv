/* ============================================================================
 * fetch-fonts.mjs — 把网页字体抓到本地，渲染时不再依赖网络
 * ----------------------------------------------------------------------------
 *   node tools/fetch-fonts.mjs
 *
 * 为什么不用 <link href="https://fonts.googleapis.com/...">：
 *   1. 渲染机断网 / CDN 抖动 → 整场渲染白跑（旧项目踩过 EPERM 之外的坑）
 *   2. 字体版本会变，同一份代码两次渲染出不同的字 = 不可复现
 *
 * 做法：拉 Google Fonts 的 CSS（带 Chrome UA 才会给 woff2 + unicode-range），
 * 把里面所有字体文件下载到 public/fonts/<family>/，并把 URL 改写成相对路径
 * `url(<family>/<file>)`。运行时 src/lib/fonts.tsx 会把前缀替换成 staticFile()。
 *
 * 产出：
 *   public/fonts/fonts.css            改写后的 @font-face 集合
 *   public/fonts/noto-sans-sc/*.woff2 101 个分片（按 unicode-range 懒加载）
 *   public/fonts/jetbrains-mono/*.ttf 常规 + 粗体
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');
const FONT_ROOT = path.join(PROJ, 'public', 'fonts');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CJK_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap';

const STATIC_FONTS = [
  {
    dir: 'jetbrains-mono',
    family: 'JetBrains Mono',
    files: [
      ['JetBrainsMono-Regular.ttf', 400],
      ['JetBrainsMono-Bold.ttf', 700],
    ],
    url: (f) => `https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/${f}`,
  },
];

const log = (...a) => console.log(...a);

function ensure(d) {
  fs.mkdirSync(d, { recursive: true });
}

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  if (as === 'buffer') return Buffer.from(await res.arrayBuffer());
  return res.text();
}

/** 抓 CJK 分片字体：下载 + 改写 CSS */
async function fetchCjk() {
  const dir = path.join(FONT_ROOT, 'noto-sans-sc');
  ensure(dir);
  log('· 拉取 Google Fonts CSS …');
  const css = await get(CJK_CSS_URL);

  const blocks = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].map((m) => m[0]);
  if (!blocks.length) throw new Error('CSS 里没有 @font-face，UA 可能被降级成 ttf');

  const urls = [...new Set(blocks.flatMap((b) => [...b.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1])))];
  log(`· ${blocks.length} 个 @font-face / ${urls.length} 个唯一字体文件`);

  let done = 0;
  let bytes = 0;
  const queue = [...urls];
  const CONCURRENCY = 8;
  async function worker() {
    while (queue.length) {
      const u = queue.shift();
      const name = path.basename(new URL(u).pathname); // 形如 xxx.4.woff2
      const dst = path.join(dir, name);
      if (!fs.existsSync(dst) || fs.statSync(dst).size === 0) {
        const buf = await get(u, 'buffer');
        fs.writeFileSync(dst, buf);
        bytes += buf.length;
      }
      done++;
      if (done % 20 === 0) log(`  已下载 ${done}/${urls.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  log(`✔ Noto Sans SC：${urls.length} 个文件 / ${(bytes / 1048576).toFixed(2)} MB`);

  // 把 https://fonts.gstatic.com/.../xxx.4.woff2 改写成 noto-sans-sc/xxx.4.woff2
  return blocks
    .join('\n\n')
    .replace(/url\(https:[^)]*\/([^/)]+\.woff2)\)/g, 'url(noto-sans-sc/$1)');
}

/** 抓固定 URL 的字体（等宽） */
async function fetchStatic(spec) {
  const dir = path.join(FONT_ROOT, spec.dir);
  ensure(dir);
  const faces = [];
  for (const [file, weight] of spec.files) {
    const dst = path.join(dir, file);
    if (!fs.existsSync(dst) || fs.statSync(dst).size === 0) {
      log(`· 下载 ${spec.family} ${weight} …`);
      fs.writeFileSync(dst, await get(spec.url(file), 'buffer'));
    }
    faces.push(`@font-face {
  font-family: '${spec.family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: block;
  src: url(${spec.dir}/${file}) format('truetype');
}`);
  }
  log(`✔ ${spec.family}：${spec.files.length} 个文件`);
  return faces.join('\n\n');
}

async function main() {
  ensure(FONT_ROOT);
  const parts = [await fetchCjk()];
  for (const s of STATIC_FONTS) parts.push(await fetchStatic(s));

  const header = `/* 由 tools/fetch-fonts.mjs 生成，请勿手改。
 * URL 是相对 public/fonts/ 的路径；运行时 src/lib/fonts.tsx 会补成 staticFile() 绝对地址。
 */
`;
  const cssPath = path.join(FONT_ROOT, 'fonts.css');
  fs.writeFileSync(cssPath, header + parts.join('\n\n') + '\n');
  log(`\n✔ 写入 ${path.relative(PROJ, cssPath)}（${(fs.statSync(cssPath).size / 1024).toFixed(0)} KB）`);
}

main().catch((e) => {
  console.error('✘ 失败：', e.message);
  process.exit(1);
});
