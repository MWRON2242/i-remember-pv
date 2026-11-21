import measuredJson from '../../input/assets-measured.json';
import manifestJson from '../../input/assets.json';
import { staticFile } from 'remotion';

export type Measured = {
  id: string;
  file: string;
  w: number;
  h: number;
  bbox: { x: number; y: number; w: number; h: number };
  footY: number;
  centerX: number;
  height: number;
};

const MEASURED = new Map<string, Measured>(
  (measuredJson.assets as Measured[]).map((a) => [a.id, a])
);
const FILE = new Map<string, string>(
  (manifestJson.assets as Array<{ id: string; file: string }>).map((a) => [a.id, a.file])
);

export function measured(id: string): Measured | undefined {
  return MEASURED.get(id);
}

export function srcOf(id: string): string | undefined {
  const f = FILE.get(id);
  return f ? staticFile(`assets/${f}`) : undefined;
}

/**
 * 按「人物包围盒」摆放资产：给定目标身高、脚底基线、水平中心，
 * 算出 <img> 的绝对位置与尺寸。这样不同姿态切换时人物不会跳、不会变大小。
 */
export function place(
  id: string,
  opts: { height: number; baseline: number; centerX: number }
): { src: string; left: number; top: number; width: number; height: number } | null {
  const m = measured(id);
  const src = srcOf(id);
  if (!m || !src) return null;
  const scale = opts.height / m.bbox.h;
  const width = m.w * scale;
  const height = m.h * scale;
  const left = opts.centerX - m.centerX * scale;
  const top = opts.baseline - m.footY * scale;
  return { src, left, top, width, height };
}
