/* ============================================================================
 * check-assets.mjs — 资产验收：Codex 丢进来的图，先过这一关
 * ----------------------------------------------------------------------------
 *   node tools/check-assets.mjs           扫 public/assets，按规范体检
 *   node tools/check-assets.mjs --strict  有警告也判失败（定稿前用）
 *
 * 为什么需要：
 *   「分层视差」依赖三件很容易搞错的事 —— 尺寸、透明通道、命名。
 *   等渲染到一半才发现前景图是白底 JPEG，比返工一遍还疼。这个脚本把
 *   这三次错都提前到「拷进目录的下一分钟」。
 *
 * 规范（详见 ASSETS.md）：
 *   public/assets/bg/<id>.png        背景层  不要求 alpha，建议 2 倍分辨率
 *   public/assets/subject/<id>.png   主体层  必须有 alpha，人物/物体
 *   public/assets/fx/<id>.png        特效层  必须有 alpha，光/粒子/碎片
 *   public/assets/ui/<id>.png        界面层  必须有 alpha
 *   文件名：小写字母、数字、连字符，如 bg.street-night.png
 *   清单：input/assets.json 声明每张图的图层与预期尺寸（可选但推荐）
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');
const ROOT = path.join(PROJ, 'public', 'assets');
const MANIFEST_PATH = path.join(PROJ, 'input', 'assets.json');
const STRICT = process.argv.includes('--strict');

const LAYERS = {
  bg: { name: '背景层', alpha: false, minW: 1920, minH: 1080 },
  subject: { name: '主体层', alpha: true, minW: 400, minH: 400 },
  fx: { name: '特效层', alpha: true, minW: 100, minH: 100 },
  ui: { name: '界面层', alpha: true, minW: 100, minH: 100 },
};

const NAME_RE = /^[a-z0-9][a-z0-9.-]*\.(png|webp|jpe?g)$/;

const errors = [];
const warns = [];
const ok = [];

/* ---------------------------------------------------------------- 图像头解析 */
/** PNG：IHDR 有宽高与颜色类型（6/4 = 带 alpha） */
function readPng(buf) {
  if (buf.length < 33) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null; // \x89PNG
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  return { width, height, alpha: colorType === 6 || colorType === 4, type: 'png' };
}

/** JPEG：扫 SOFn 段拿宽高。无 alpha。 */
function readJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), alpha: false, type: 'jpeg' };
    }
    i += 2 + len;
  }
  return null;
}

function readImage(file) {
  const buf = fs.readFileSync(file);
  return readPng(buf) || readJpeg(buf);
}

/* ------------------------------------------------------------------ 扫描 */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const manifest = fs.existsSync(MANIFEST_PATH)
  ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  : null;
const declared = new Map(
  (manifest?.assets ?? []).map((a) => [a.file.replace(/\\/g, '/'), a])
);

const files = walk(ROOT).filter((f) => /\.(png|webp|jpe?g)$/i.test(f));

if (!files.length) {
  console.log('\n资产目录还是空的 —— 这是正常的，Codex 的图还没进来。');
  console.log(`  投放位置：${path.relative(PROJ, ROOT)}\\bg | subject | fx | ui`);
  console.log('  规范见 ASSETS.md，验收就跑 node tools/build.mjs assets\n');
  process.exit(0);
}

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const layerKey = rel.split('/')[0];
  const layer = LAYERS[layerKey];
  const name = path.basename(rel);

  if (!layer) {
    errors.push(`${rel} —— 不在 bg/subject/fx/ui 任何一个图层目录里`);
    continue;
  }
  if (!NAME_RE.test(name)) {
    warns.push(`${rel} —— 文件名不合规范（小写字母/数字/连字符，如 ${layerKey}.street-night.png）`);
  }

  const img = readImage(file);
  if (!img) {
    errors.push(`${rel} —— 读不出宽高，可能不是有效图片（或 webp 暂不支持检查）`);
    continue;
  }

  if (img.width < layer.minW || img.height < layer.minH) {
    warns.push(
      `${rel} —— ${img.width}×${img.height} 偏小（${layer.name}建议 ≥ ${layer.minW}×${layer.minH}）`
    );
  }
  if (layer.alpha && !img.alpha) {
    errors.push(
      `${rel} —— ${layer.name}需要透明背景，但这是${img.type === 'jpeg' ? ' JPEG（没有 alpha）' : '无 alpha 的 PNG'}`
    );
  }

  const decl = declared.get(rel);
  if (decl) {
    if (decl.width && decl.width !== img.width) {
      errors.push(`${rel} —— 清单写 ${decl.width}px 宽，实际 ${img.width}px`);
    }
    if (decl.height && decl.height !== img.height) {
      errors.push(`${rel} —— 清单写 ${decl.height}px 高，实际 ${img.height}px`);
    }
  } else if (manifest) {
    warns.push(`${rel} —— 实际存在但 manifest.json 没有声明`);
  }

  ok.push({ rel, ...img, layer: layerKey });
}

if (manifest) {
  for (const [rel] of declared) {
    if (!fs.existsSync(path.join(ROOT, rel))) errors.push(`${rel} —— manifest 里有，文件不存在`);
  }
}

/* ------------------------------------------------------------------ 报告 */
console.log(`\n资产体检：${files.length} 个文件\n`);
for (const a of ok) {
  const pad = a.rel.padEnd(42);
  const dims = `${a.width}×${a.height}`.padStart(11);
  const alpha = a.alpha ? 'alpha' : '     ';
  console.log(`  ✓ ${pad}${dims}  ${alpha}  ${LAYERS[a.layer].name}`);
}
if (warns.length) {
  console.log('\n提醒：');
  warns.forEach((w) => console.log('  ⚠ ' + w));
}
if (errors.length) {
  console.log('\n错误：');
  errors.forEach((e) => console.log('  ✗ ' + e));
}
console.log(
  `\n${errors.length ? '✗ 不通过' : '✔ 通过'}` +
    (warns.length ? `（${warns.length} 条提醒）` : '') +
    '\n'
);
if (errors.length || (STRICT && warns.length)) process.exit(1);
