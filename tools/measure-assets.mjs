/* ============================================================================
 * measure-assets.mjs — 量出每张资产里「真正有内容的那块」
 * ----------------------------------------------------------------------------
 *   node tools/measure-assets.mjs
 *
 * 为什么需要：生成模型每次给的画布尺寸、人物高度、底部留白都不一样。
 * 直接按画布对齐 → 切换姿态时人物会跳、会变大小。
 * 正确做法：按 alpha 的包围盒对齐（人物头顶到脚底），画布尺寸只当容器。
 *
 * 产出 input/assets-measured.json：
 *   { id, file, w, h, bbox:{x,y,w,h}, footY, centerX, height }
 * 代码侧用它换算缩放与锚点（src/lib/assets.ts）。
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, '..');
const MANIFEST = path.join(PROJ, 'input', 'assets.json');
const OUT = path.join(PROJ, 'input', 'assets-measured.json');

/** 极简 PNG 解码 → RGB + alpha（8 位） */
function decodePng(png) {
  let p = 8;
  let w = 0;
  let h = 0;
  let ct = 2;
  const idat = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    p += 4;
    const type = png.toString('ascii', p, p + 4);
    p += 4;
    const data = png.subarray(p, p + len);
    p += len + 4;
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const alpha = new Uint8Array(w * h).fill(255);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[q++];
    raw.copy(cur, 0, q, q + stride);
    q += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    if (bpp === 4) for (let x = 0; x < w; x++) alpha[y * w + x] = cur[x * 4 + 3];
    cur.copy(prev);
  }
  return { w, h, alpha };
}

const ALPHA_MIN = 16; // 低于这个算透明，避免抗锯齿噪点撑大包围盒

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const out = { _说明: '由 tools/measure-assets.mjs 生成，记录每张资产的 alpha 包围盒，用于对齐锚点。', assets: [] };

for (const a of manifest.assets ?? []) {
  const file = path.join(PROJ, 'public', 'assets', a.file);
  if (!fs.existsSync(file)) {
    console.log(`✗ 缺文件 ${a.file}`);
    continue;
  }
  const { w, h, alpha } = decodePng(fs.readFileSync(file));
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] >= ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    console.log(`✗ ${a.id} 全透明`);
    continue;
  }
  const bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  out.assets.push({
    id: a.id,
    file: a.file,
    w,
    h,
    bbox,
    footY: bbox.y + bbox.h - 1,
    centerX: bbox.x + bbox.w / 2,
    height: bbox.h,
  });
  console.log(
    `✓ ${a.id.padEnd(24)} 画布 ${w}×${h}  主体 ${bbox.w}×${bbox.h}  底 ${h - 1 - (bbox.y + bbox.h - 1)}px`
  );
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`\n写出 ${path.relative(PROJ, OUT)}`);
