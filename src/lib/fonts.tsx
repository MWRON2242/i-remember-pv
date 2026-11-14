/* ============================================================================
 * fonts.tsx —— 字体加载（本地字体，渲染时零网络依赖）
 * ----------------------------------------------------------------------------
 * 字体文件由 tools/fetch-fonts.mjs 抓下来放在 public/fonts/：
 *   public/fonts/fonts.css            @font-face 集合（101 个 unicode-range 分片）
 *   public/fonts/noto-sans-sc/*.woff2 中文正文
 *   public/fonts/jetbrains-mono/*.ttf 数字与界面
 *
 * 为什么要在运行时改写 URL：
 *   CSS 里写的是相对路径，而内联 <style> 的 url() 会相对「页面地址」解析。
 *   这里统一换成 staticFile() 给出的绝对地址，dev 与 render 两种环境都对。
 *
 * 为什么要 delayRender：
 *   字体没加载完就截帧 = 第一帧用回退字体渲染，全片字号与字宽都会变。
 * ==========================================================================*/
import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

let cached: string | null = null;
let injected = false;

function inject(css: string) {
  if (injected) return;
  const el = document.createElement('style');
  el.setAttribute('data-i-remember-pv', 'fonts');
  el.textContent = css;
  document.head.appendChild(el);
  injected = true;
}

/** 把 CSS 里的相对 url() 换成 staticFile 绝对地址 */
function absolutize(css: string): string {
  const base = staticFile('fonts');
  return css.replace(/url\(\s*(?!['"]?(?:https?:|data:))([^)]+?)\s*\)/g, (_m, p1: string) => {
    const clean = p1.replace(/^['"]|['"]$/g, '');
    return `url(${base}/${clean})`;
  });
}

export const FontDefs: React.FC = () => {
  const [handle] = useState<number | null>(() => (cached ? null : delayRender('加载内置字体')));

  useEffect(() => {
    if (cached) return;
    let alive = true;

    const finish = () => {
      if (handle !== null) continueRender(handle);
    };

    (async () => {
      const res = await fetch(staticFile('fonts/fonts.css'));
      const css = absolutize(await res.text());
      if (!alive) return finish();
      cached = css;
      inject(css);

      // 触发实际下载，并等浏览器把字形准备好
      try {
        await document.fonts.load('400 64px "Noto Sans SC"', '我记得');
        await document.fonts.load('700 64px "Noto Sans SC"', '我记得');
        await document.fonts.load('400 32px "JetBrains Mono"', '0123456789');
        await document.fonts.ready;
      } catch {
        /* 字体加载失败不该让渲染挂死：超时兜底继续 */
      }
      finish();
    })().catch(finish);

    return () => {
      alive = false;
    };
  }, [handle]);

  return null;
};

/** 给任意组件套上字体加载（Composition 的 component 用它包一层） */
export function withFonts<P extends object>(Comp: React.FC<P>): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <>
      <FontDefs />
      <Comp {...props} />
    </>
  );
  Wrapped.displayName = `withFonts(${Comp.displayName ?? Comp.name ?? 'Component'})`;
  return Wrapped;
}
