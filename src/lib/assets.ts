/* ============================================================================
 * assets.ts —— 资产清单的代码侧入口
 * ----------------------------------------------------------------------------
 * Codex 出的图放在 public/assets/<layer>/，登记在 input/assets.json。
 * 场景代码永远不写文件名，只写 id：
 *
 *     <Img src={img('bg.street-night')} />        有图 → staticFile 路径
 *     has('sub.street-night-hat')                 没有 → false，用来画占位方块
 *
 * 为什么这么绕：图会反复重出、改名、换尺寸。把 id 当接口，改图不动代码；
 * 缺图时占位块会在画面上明写「MISSING: xxx」，不会静默糊过去。
 * ==========================================================================*/
import manifest from '../../input/assets.json';

export type AssetLayer = 'bg' | 'subject' | 'fx' | 'ui';

export type AssetEntry = {
  id: string;
  layer: AssetLayer;
  file: string;
  width?: number;
  height?: number;
  note?: string;
};

export const ASSETS: AssetEntry[] = (manifest.assets ?? []) as AssetEntry[];

/** id → 相对 public/assets 的文件路径 */
const BY_ID = new Map(ASSETS.map((a) => [a.id, a.file.replace(/\\/g, '/')]));

export function has(id: string): boolean {
  return BY_ID.has(id);
}

/** 取资产路径。缺图时返回 undefined —— 调用方必须据此画占位，不许硬用。 */
export function assetPath(id: string): string | undefined {
  return BY_ID.get(id);
}

/** 按图层列出所有 id，方便做「本场景需要哪些图」的清单 */
export function idsByLayer(layer: AssetLayer): string[] {
  return ASSETS.filter((a) => a.layer === layer).map((a) => a.id);
}
