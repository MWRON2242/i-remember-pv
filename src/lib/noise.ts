/* ============================================================================
 * noise.ts —— 确定性噪声
 * ----------------------------------------------------------------------------
 * 画面里所有「随机」必须由 t 唯一决定，否则同一帧两次渲染不一样，
 * 就没法回溯、没法审片、也没法做「重渲这一段」。
 *
 * 参考 world.execute(me) 的思路：用整数哈希而不是 Math.random。
 * ==========================================================================*/

/** 32 位整数哈希 → [0,1) */
export function hash01(n: number): number {
  let v = (Math.floor(n) + 0x9e3779b9) >>> 0;
  v = ((v ^ (v >>> 16)) * 0x7feb352d) >>> 0;
  v = ((v ^ (v >>> 15)) * 0x846ca68b) >>> 0;
  v = (v ^ (v >>> 16)) >>> 0;
  return v / 4294967296;
}

/** 二维哈希 → [0,1) */
export function hash2(x: number, y: number): number {
  return hash01(Math.floor(x) * 73856093 ^ Math.floor(y) * 19349663);
}

/** 一维平滑噪声（线性插值 + 平滑步） */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash01(i) * (1 - u) + hash01(i + 1) * u;
}

/** 二维平滑噪声 */
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

/** 分形噪声：叠加三层，得到更自然的密度场 */
export function fbm(x: number, y: number): number {
  return (
    noise2(x, y) * 0.55 +
    noise2(x * 2.13 + 11.7, y * 2.13 - 5.3) * 0.3 +
    noise2(x * 4.37 - 3.1, y * 4.37 + 8.9) * 0.15
  );
}
